'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');
const test = require('node:test');

const {
  createMutationTransaction,
  bindMutationLock
} = require('../../accelerator/core/mutation-transaction');
const {
  resolveMutationLockIdentity,
  acquireMutationLock,
  releaseMutationLock
} = require('../../accelerator/adapters/mutation-lock-adapter');

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function definition(workspace, target, overrides = {}) {
  return {
    operationId: 'operation-1',
    workspace,
    target,
    beforeSha256: digest('before'),
    replacementSha256: digest('replacement'),
    grantFingerprint: digest('grant'),
    approvalAuthorityFingerprint: digest('approval'),
    verifiedIdentityAssertionFingerprint: digest('human'),
    idempotencyKey: 'operation-1-patch',
    ...overrides
  };
}

function workspaceFixture(t, names = ['target.txt']) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-lock-test-')));
  for (const name of names) fs.writeFileSync(path.join(root, name), `content:${name}\n`);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function transactionFor(root, relative = 'target.txt', overrides = {}) {
  return createMutationTransaction(definition(root, fs.realpathSync(path.join(root, relative)), overrides));
}

function acquire(root, relative = 'target.txt', overrides = {}) {
  const transaction = transactionFor(root, relative, overrides);
  return acquireMutationLock({ transaction, workspace: root, target: relative });
}

function userNamespace() {
  const identity = typeof process.getuid === 'function'
    ? `uid:${process.getuid()}`
    : `user:${os.userInfo().username}:${os.homedir()}`;
  return crypto.createHash('sha256').update(identity).digest('hex').slice(0, 24);
}

function physicalLockPath(lockId) {
  return path.join(fs.realpathSync(os.tmpdir()),
    `sdo-mutation-locks-v1-${userNamespace()}`, `${lockId}.lock`);
}

function immutable(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) immutable(child);
  }
  return value;
}

function childAcquire(payload) {
  return new Promise((resolve, reject) => {
    const child = fork(__filename, ['--lock-child', JSON.stringify(payload)], {
      shell: false,
      stdio: ['ignore', 'ignore', 'pipe', 'ipc']
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Bounded lock child timed out.'));
    }, 5000);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('message', (message) => {
      clearTimeout(timer);
      if (!message || message.error) {
        child.kill();
        reject(new Error(message && message.error || 'Lock child failed.'));
        return;
      }
      resolve({ child, message });
    });
  });
}

function stopChild(child, release = true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Bounded lock child release timed out.'));
    }, 5000);
    child.once('exit', (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`Lock child exited ${code}.`));
    });
    child.send({ release });
  });
}

if (process.argv[2] === '--lock-child') {
  try {
    const payload = JSON.parse(process.argv[3]);
    const transaction = createMutationTransaction(payload.definition);
    const result = acquireMutationLock({
      transaction,
      workspace: payload.workspace,
      target: payload.target
    });
    if (result.decision !== 'ACQUIRED') throw new Error(`Unexpected ${result.decision}.`);
    process.send({ decision: result.decision, lock: result.lock });
    process.once('message', ({ release }) => {
      if (release) releaseMutationLock({ transaction: result.transaction, lock: result.lock });
      process.exit(0);
    });
  } catch (error) {
    if (process.send) process.send({ error: error.message });
    process.exit(1);
  }
} else {
  test('lock identity is deterministic and internally derived', (t) => {
    const root = workspaceFixture(t);
    const first = resolveMutationLockIdentity({ workspace: root, target: 'target.txt' });
    const second = resolveMutationLockIdentity({ workspace: root, target: './target.txt' });
    assert.equal(first.lockId, second.lockId);
    assert.match(first.lockId, /^[a-f0-9]{64}$/);
    assert.equal(first.target, fs.realpathSync(path.join(root, 'target.txt')));
  });

  test('symlink aliases converge on the same physical lock identity', (t) => {
    const root = workspaceFixture(t);
    const alias = path.join(root, 'alias.txt');
    try { fs.symlinkSync('target.txt', alias); } catch (error) {
      if (error.code === 'EPERM') return t.skip('Symlink creation is unavailable.');
      throw error;
    }
    const direct = resolveMutationLockIdentity({ workspace: root, target: 'target.txt' });
    const linked = resolveMutationLockIdentity({ workspace: root, target: 'alias.txt' });
    assert.equal(linked.lockId, direct.lockId);
    assert.equal(linked.target, direct.target);
  });

  test('same target permits one exclusive owner and explicit contention', (t) => {
    const root = workspaceFixture(t);
    const owner = acquire(root);
    t.after(() => releaseMutationLock({ transaction: owner.transaction, lock: owner.lock }));
    const contender = acquire(root);
    assert.equal(owner.decision, 'ACQUIRED');
    assert.equal(contender.decision, 'CONTENDED');
    assert.equal(contender.lockId, owner.lock.lockId);
  });

  test('two processes cannot acquire the same canonical target concurrently', async (t) => {
    const root = workspaceFixture(t);
    const transaction = transactionFor(root);
    const held = await childAcquire({
      definition: definition(root, transaction.target), workspace: root, target: 'target.txt'
    });
    t.after(() => { if (held.child.connected) held.child.kill(); });
    const contender = acquire(root);
    assert.equal(contender.decision, 'CONTENDED');
    assert.equal(contender.ownerTransactionId, transaction.transactionId);
    await stopChild(held.child);
  });

  test('two-process conflicting transactions cannot own one target simultaneously', async (t) => {
    const root = workspaceFixture(t);
    const first = transactionFor(root);
    const held = await childAcquire({
      definition: definition(root, first.target), workspace: root, target: 'target.txt'
    });
    t.after(() => { if (held.child.connected) held.child.kill(); });
    const conflict = acquire(root, 'target.txt', {
      operationId: 'operation-2', replacementSha256: digest('different'),
      idempotencyKey: 'operation-2-patch'
    });
    assert.equal(conflict.decision, 'CONTENDED');
    assert.notEqual(conflict.transactionId, conflict.ownerTransactionId);
    await stopChild(held.child);
  });

  test('independent canonical targets can be locked concurrently', (t) => {
    const root = workspaceFixture(t, ['one.txt', 'two.txt']);
    const one = acquire(root, 'one.txt');
    const two = acquire(root, 'two.txt', {
      operationId: 'operation-2', idempotencyKey: 'operation-2-patch'
    });
    t.after(() => releaseMutationLock({ transaction: one.transaction, lock: one.lock }));
    t.after(() => releaseMutationLock({ transaction: two.transaction, lock: two.lock }));
    assert.equal(one.decision, 'ACQUIRED');
    assert.equal(two.decision, 'ACQUIRED');
    assert.notEqual(one.lock.lockId, two.lock.lockId);
  });

  test('ownership is transaction-bound and lock metadata is deeply immutable', (t) => {
    const root = workspaceFixture(t);
    const owner = acquire(root);
    t.after(() => releaseMutationLock({ transaction: owner.transaction, lock: owner.lock }));
    assert.equal(owner.lock.transactionId, owner.transaction.transactionId);
    assert.equal(owner.lock.operationId, owner.transaction.operationId);
    assert.equal(owner.lock.target, owner.transaction.target);
    assert.ok(Object.isFrozen(owner));
    assert.ok(Object.isFrozen(owner.lock));
    assert.ok(Object.isFrozen(owner.transaction));
    assert.equal(owner.transaction.stage, 'LOCKED');
  });

  test('non-owner and mutable release attempts fail closed', (t) => {
    const root = workspaceFixture(t);
    const owner = acquire(root);
    t.after(() => releaseMutationLock({ transaction: owner.transaction, lock: owner.lock }));
    assert.throws(() => releaseMutationLock({
      transaction: owner.transaction,
      lock: { ...owner.lock }
    }), /exact immutable/);
  });

  test('transaction, operation and target release mismatches are denied', (t) => {
    const root = workspaceFixture(t);
    const owner = acquire(root);
    t.after(() => releaseMutationLock({ transaction: owner.transaction, lock: owner.lock }));
    for (const override of [
      { transactionId: '1'.repeat(64) },
      { operationId: 'other-operation' },
      { target: path.join(root, 'other.txt') }
    ]) {
      const changed = immutable({ ...owner.lock, ...override });
      const forged = immutable({ ...owner.transaction, lock: changed });
      assert.throws(() => releaseMutationLock({ transaction: forged, lock: changed }));
    }
  });

  test('malformed acquisition and caller-supplied identity fail closed', (t) => {
    const root = workspaceFixture(t);
    const transaction = transactionFor(root);
    assert.throws(() => acquireMutationLock({
      transaction: { ...transaction }, workspace: root, target: 'target.txt'
    }));
    assert.throws(() => acquireMutationLock({
      transaction, workspace: root, target: '../target.txt', lockId: '1'.repeat(64)
    }));
  });

  test('corrupt lock record fails closed and is not reclaimed', (t) => {
    const root = workspaceFixture(t);
    const identity = resolveMutationLockIdentity({ workspace: root, target: 'target.txt' });
    const file = physicalLockPath(identity.lockId);
    fs.writeFileSync(file, '{corrupt', { mode: 0o600 });
    t.after(() => { try { fs.unlinkSync(file); } catch {} });
    assert.throws(() => acquire(root), /malformed or corrupt/);
    assert.equal(fs.readFileSync(file, 'utf8'), '{corrupt');
  });

  test('ambiguous orphan lock remains contended and is not reclaimed', async (t) => {
    const root = workspaceFixture(t);
    const transaction = transactionFor(root);
    const held = await childAcquire({
      definition: definition(root, transaction.target), workspace: root, target: 'target.txt'
    });
    await stopChild(held.child, false);
    const contender = acquire(root);
    assert.equal(contender.decision, 'CONTENDED');
    const metadata = immutable(held.message.lock);
    const rebound = bindMutationLock(transaction, metadata);
    t.after(() => releaseMutationLock({ transaction: rebound, lock: metadata }));
    assert.ok(fs.existsSync(physicalLockPath(metadata.lockId)));
  });

  test('repeated release is deterministic and cannot delete a new owner lock', (t) => {
    const root = workspaceFixture(t);
    const first = acquire(root);
    assert.equal(releaseMutationLock({ transaction: first.transaction, lock: first.lock }).decision,
      'RELEASED');
    assert.equal(releaseMutationLock({ transaction: first.transaction, lock: first.lock }).decision,
      'NOT_HELD');
    const second = acquire(root, 'target.txt', {
      operationId: 'operation-2', idempotencyKey: 'operation-2-patch'
    });
    t.after(() => releaseMutationLock({ transaction: second.transaction, lock: second.lock }));
    assert.throws(() => releaseMutationLock({ transaction: first.transaction, lock: first.lock }),
      /mismatch/);
    assert.equal(acquire(root).decision, 'CONTENDED');
  });

  test('lock operations never modify physical target contents', (t) => {
    const root = workspaceFixture(t);
    const target = path.join(root, 'target.txt');
    const before = fs.readFileSync(target);
    const owner = acquire(root);
    releaseMutationLock({ transaction: owner.transaction, lock: owner.lock });
    assert.deepEqual(fs.readFileSync(target), before);
  });

  test('lock foundation remains disconnected from mutation dispatch', () => {
    const patch = fs.readFileSync(path.join(__dirname,
      '../../accelerator/adapters/filesystem-patch-adapter.js'), 'utf8');
    const orchestrator = fs.readFileSync(path.join(__dirname,
      '../../accelerator/core/surgical-orchestrator.js'), 'utf8');
    assert.doesNotMatch(patch, /mutation-lock-adapter/);
    assert.doesNotMatch(orchestrator, /mutation-lock-adapter/);
  });
}
