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
  bindMutationLock,
  deriveMutationLockId,
  transitionMutationTransaction
} = require('../../accelerator/core/mutation-transaction');
const {
  createMutationJournalAdapter
} = require('../../accelerator/adapters/mutation-journal-adapter');

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

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

function lockMetadata(transaction, token = '1'.repeat(64)) {
  return freeze({
    schema: 'sdo.mutation_lock.v1',
    adapter: 'FILESYSTEM_EXCLUSIVE_CREATE',
    version: 1,
    lockId: deriveMutationLockId(transaction.workspace, transaction.target),
    transactionId: transaction.transactionId,
    operationId: transaction.operationId,
    workspace: transaction.workspace,
    target: transaction.target,
    ownerToken: token,
    ownerProcess: 'journal-test-process',
    acquiredAt: '2026-08-20T12:00:00.000Z'
  });
}

function locked(transaction, token) {
  return bindMutationLock(transaction, lockMetadata(transaction, token));
}

function advance(transaction, stages) {
  return stages.reduce(transitionMutationTransaction, transaction);
}

function fixture(t) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-journal-test-')));
  const storageRoot = path.join(base, 'journal');
  const workspace = path.join(base, 'workspace');
  fs.mkdirSync(storageRoot, { mode: 0o700 });
  fs.mkdirSync(workspace, { mode: 0o700 });
  const target = path.join(workspace, 'target.txt');
  fs.writeFileSync(target, 'before\n');
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return { base, storageRoot: fs.realpathSync(storageRoot),
    workspace: fs.realpathSync(workspace), target: fs.realpathSync(target) };
}

function prepared(setup, overrides = {}) {
  return createMutationTransaction(definition(setup.workspace, setup.target, overrides));
}

function journalDirectory(setup, state) {
  return path.join(setup.storageRoot, state.journalId);
}

function recordFile(setup, state, sequence) {
  return path.join(journalDirectory(setup, state), `${String(sequence).padStart(8, '0')}.json`);
}

function childRequest(payload) {
  return new Promise((resolve, reject) => {
    const child = fork(__filename, ['--journal-child', JSON.stringify(payload)], {
      shell: false,
      stdio: ['ignore', 'ignore', 'pipe', 'ipc']
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString().slice(0, 4096); });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Bounded journal child timed out.'));
    }, 5000);
    child.once('message', (message) => {
      clearTimeout(timer);
      resolve({ child, message, stderr });
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function waitExit(child) {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null) {
      child.exitCode === 0 ? resolve() : reject(new Error(`Journal child exited ${child.exitCode}.`));
      return;
    }
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Bounded journal child exit timed out.'));
    }, 5000);
    child.once('exit', (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`Journal child exited ${code}.`));
    });
  });
}

if (process.argv[2] === '--journal-child') {
  try {
    const payload = JSON.parse(process.argv[3]);
    const adapter = createMutationJournalAdapter({ storageRoot: payload.storageRoot });
    let transaction = createMutationTransaction(payload.definition);
    if (payload.lock) transaction = bindMutationLock(transaction, freeze(payload.lock));
    if (payload.action === 'reopen') {
      const state = adapter.reopen(transaction);
      process.send({ ok: true, stage: state.transaction.stage, count: state.records.length });
      process.exit(0);
    } else if (payload.action === 'append') {
      const state = adapter.append(transaction);
      process.send({ ok: true, stage: state.transaction.stage,
        recordHash: state.records.at(-1).recordHash });
      process.exit(0);
    } else {
      throw new Error('Unknown fixed journal child action.');
    }
  } catch (error) {
    if (process.send) process.send({ ok: false, error: error.message });
    process.exit(0);
  }
} else {
  test('creates a journal only inside a configured trusted storage root', (t) => {
    const setup = fixture(t);
    const transaction = prepared(setup);
    const state = createMutationJournalAdapter({ storageRoot: setup.storageRoot })
      .create(transaction);
    assert.equal(state.transaction.stage, 'PREPARED');
    assert.equal(path.dirname(journalDirectory(setup, state)), setup.storageRoot);
    assert.ok(fs.statSync(recordFile(setup, state, 1)).isFile());
  });

  test('journal identity is deterministic and binds complete transaction authority', (t) => {
    const setup = fixture(t);
    const transaction = prepared(setup);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    const first = adapter.create(transaction);
    const second = adapter.reopen(prepared(setup));
    assert.equal(first.journalId, second.journalId);
    for (const field of [
      'transactionId', 'operationId', 'workspace', 'target', 'beforeSha256',
      'replacementSha256', 'grantFingerprint', 'approvalAuthorityFingerprint',
      'verifiedIdentityAssertionFingerprint', 'replayIdentity'
    ]) assert.equal(first.identity[field], transaction[field]);
  });

  test('appends ordered hash-chained transaction stages', (t) => {
    const setup = fixture(t);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    const initial = prepared(setup);
    adapter.create(initial);
    const held = locked(initial);
    adapter.append(held);
    const verified = transitionMutationTransaction(held, 'BEFORE_VERIFIED');
    const state = adapter.append(verified);
    assert.deepEqual(state.records.map((record) => record.sequence), [1, 2, 3]);
    assert.equal(state.records[1].previousRecordHash, state.records[0].recordHash);
    assert.equal(state.records[2].previousRecordHash, state.records[1].recordHash);
  });

  test('reopen reconstructs equivalent deeply immutable transaction history', (t) => {
    const setup = fixture(t);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    const initial = prepared(setup);
    adapter.create(initial);
    const held = locked(initial);
    adapter.append(held);
    const expected = transitionMutationTransaction(held, 'BEFORE_VERIFIED');
    adapter.append(expected);
    const reopened = createMutationJournalAdapter({ storageRoot: setup.storageRoot })
      .reopen(initial);
    assert.deepEqual(reopened.transaction, expected);
    assert.ok(Object.isFrozen(reopened));
    assert.ok(Object.isFrozen(reopened.records));
    assert.ok(reopened.records.every(Object.isFrozen));
    assert.ok(Object.isFrozen(reopened.transaction.history));
  });

  test('separate process can reopen and reconstruct persisted state', async (t) => {
    const setup = fixture(t);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    const initial = prepared(setup);
    adapter.create(initial);
    adapter.append(locked(initial));
    const result = await childRequest({ action: 'reopen', storageRoot: setup.storageRoot,
      definition: definition(setup.workspace, setup.target) });
    await waitExit(result.child);
    assert.deepEqual(result.message, { ok: true, stage: 'LOCKED', count: 2 });
  });

  test('transaction, operation and target correlation cannot be substituted', (t) => {
    const setup = fixture(t);
    const initial = prepared(setup);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    const state = adapter.create(initial);
    const file = recordFile(setup, state, 1);
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    record.operationId = 'other-operation';
    fs.writeFileSync(file, `${JSON.stringify(record)}\n`);
    assert.throws(() => adapter.reopen(initial), /correlation|hash/);
  });

  test('identical duplicate append returns deterministic equivalent state', (t) => {
    const setup = fixture(t);
    const initial = prepared(setup);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    adapter.create(initial);
    const held = locked(initial);
    const first = adapter.append(held);
    const replay = adapter.append(held);
    assert.deepEqual(replay, first);
    assert.equal(replay.records.length, 2);
  });

  test('same sequence with conflicting content fails closed', (t) => {
    const setup = fixture(t);
    const initial = prepared(setup);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    adapter.create(initial);
    adapter.append(locked(initial, '1'.repeat(64)));
    assert.throws(() => adapter.append(locked(initial, '2'.repeat(64))), /Conflicting/);
  });

  test('truncated final record fails closed', (t) => {
    const setup = fixture(t);
    const initial = prepared(setup);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    const state = adapter.create(initial);
    fs.writeFileSync(recordFile(setup, state, 1), '{"schema":');
    assert.throws(() => adapter.reopen(initial), /truncated|invalid JSON/);
  });

  test('malformed record and invalid JSON fail closed', (t) => {
    const setup = fixture(t);
    const initial = prepared(setup);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    const state = adapter.create(initial);
    fs.writeFileSync(recordFile(setup, state, 1), 'not-json\n');
    assert.throws(() => adapter.reopen(initial), /invalid JSON/);
  });

  test('altered payload and record hash corruption are detected', (t) => {
    const setup = fixture(t);
    const initial = prepared(setup);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    const state = adapter.create(initial);
    const file = recordFile(setup, state, 1);
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    record.payload.definition.idempotencyKey = 'altered';
    fs.writeFileSync(file, `${JSON.stringify(record)}\n`);
    assert.throws(() => adapter.reopen(initial), /identity|hash|correlation/);
  });

  test('missing record and sequence gap fail closed', (t) => {
    const setup = fixture(t);
    const initial = prepared(setup);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    let state = adapter.create(initial);
    const held = locked(initial);
    state = adapter.append(held);
    state = adapter.append(transitionMutationTransaction(held, 'BEFORE_VERIFIED'));
    fs.unlinkSync(recordFile(setup, state, 2));
    assert.throws(() => adapter.reopen(initial), /missing|reordered/);
  });

  test('reordered records fail closed', (t) => {
    const setup = fixture(t);
    const initial = prepared(setup);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    let state = adapter.create(initial);
    state = adapter.append(locked(initial));
    const one = fs.readFileSync(recordFile(setup, state, 1));
    const two = fs.readFileSync(recordFile(setup, state, 2));
    fs.writeFileSync(recordFile(setup, state, 1), two);
    fs.writeFileSync(recordFile(setup, state, 2), one);
    assert.throws(() => adapter.reopen(initial), /sequence|PREPARED|identity/);
  });

  test('wrong transaction identity cannot append into another journal', (t) => {
    const setup = fixture(t);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    const first = prepared(setup);
    adapter.create(first);
    const conflicting = prepared(setup, {
      operationId: 'operation-2', idempotencyKey: 'operation-2-patch'
    });
    assert.throws(() => adapter.append(locked(conflicting)), /does not exist/);
  });

  test('unsafe, unresolved and noncanonical storage roots fail closed', (t) => {
    const setup = fixture(t);
    assert.throws(() => createMutationJournalAdapter({
      storageRoot: `${setup.storageRoot}${path.sep}..${path.sep}journal`
    }), /canonical/);
    assert.throws(() => createMutationJournalAdapter({
      storageRoot: path.join(setup.base, 'missing')
    }), /cannot be resolved/);
    assert.throws(() => createMutationJournalAdapter({ storageRoot: 'relative' }), /canonical/);
  });

  test('symlink storage root and symlink record escape fail closed', (t) => {
    const setup = fixture(t);
    const rootLink = path.join(setup.base, 'journal-link');
    try { fs.symlinkSync(setup.storageRoot, rootLink, 'dir'); } catch (error) {
      if (error.code === 'EPERM') return t.skip('Symlink creation is unavailable.');
      throw error;
    }
    assert.throws(() => createMutationJournalAdapter({ storageRoot: rootLink }), /unsafe/);
    const initial = prepared(setup);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    const state = adapter.create(initial);
    const external = path.join(setup.base, 'external-record');
    fs.writeFileSync(external, fs.readFileSync(recordFile(setup, state, 1)));
    fs.unlinkSync(recordFile(setup, state, 1));
    fs.symlinkSync(external, recordFile(setup, state, 1));
    assert.throws(() => adapter.reopen(initial));
  });

  test('two processes converge on an identical same-sequence append', async (t) => {
    const setup = fixture(t);
    const initial = prepared(setup);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    adapter.create(initial);
    const lock = lockMetadata(initial, '1'.repeat(64));
    const payload = { action: 'append', storageRoot: setup.storageRoot,
      definition: definition(setup.workspace, setup.target), lock };
    const [one, two] = await Promise.all([childRequest(payload), childRequest(payload)]);
    await Promise.all([waitExit(one.child), waitExit(two.child)]);
    assert.equal(one.message.ok, true);
    assert.equal(two.message.ok, true);
    assert.equal(one.message.recordHash, two.message.recordHash);
    assert.equal(adapter.reopen(initial).records.length, 2);
  });

  test('two processes cannot append conflicting records at one sequence', async (t) => {
    const setup = fixture(t);
    const initial = prepared(setup);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    adapter.create(initial);
    const base = { action: 'append', storageRoot: setup.storageRoot,
      definition: definition(setup.workspace, setup.target) };
    const [one, two] = await Promise.all([
      childRequest({ ...base, lock: lockMetadata(initial, '1'.repeat(64)) }),
      childRequest({ ...base, lock: lockMetadata(initial, '2'.repeat(64)) })
    ]);
    await Promise.all([waitExit(one.child), waitExit(two.child)]);
    assert.equal([one.message.ok, two.message.ok].filter(Boolean).length, 1);
    assert.match([one.message, two.message].find((message) => !message.ok).error,
      /Conflicting/);
    assert.equal(adapter.reopen(initial).records.length, 2);
  });

  test('terminal journal permits identical replay but rejects conflicting terminal append', (t) => {
    const setup = fixture(t);
    const initial = prepared(setup);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    adapter.create(initial);
    const held = locked(initial);
    adapter.append(held);
    let transaction = held;
    for (const stage of ['BEFORE_VERIFIED', 'MUTATION_STARTED', 'PHYSICAL_APPLIED',
      'AFTER_VERIFIED', 'EVIDENCE_RECORDED']) {
      transaction = transitionMutationTransaction(transaction, stage);
      adapter.append(transaction);
    }
    const successful = transitionMutationTransaction(transaction, 'FINALIZED_SUCCESS');
    adapter.append(successful);
    assert.equal(adapter.append(successful).transaction.stage, 'FINALIZED_SUCCESS');
    const conflicting = transitionMutationTransaction(transaction, 'FINALIZED_FAILED');
    assert.throws(() => adapter.append(conflicting), /Conflicting/);
  });

  test('RECOVERED proceeds through evidence to failed finalization', (t) => {
    const setup = fixture(t);
    const initial = prepared(setup);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    adapter.create(initial);
    let transaction = locked(initial);
    adapter.append(transaction);
    for (const stage of ['BEFORE_VERIFIED', 'MUTATION_STARTED', 'RECOVERY_REQUIRED', 'RECOVERED']) {
      transaction = transitionMutationTransaction(transaction, stage);
      adapter.append(transaction);
    }
    transaction = transitionMutationTransaction(transaction, 'EVIDENCE_RECORDED');
    adapter.append(transaction);
    transaction = transitionMutationTransaction(transaction, 'FINALIZED_FAILED');
    assert.equal(adapter.append(transaction).transaction.stage, 'FINALIZED_FAILED');
  });

  test('unexpected or partial pending entries make journal ambiguous', (t) => {
    const setup = fixture(t);
    const initial = prepared(setup);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    const state = adapter.create(initial);
    fs.writeFileSync(path.join(journalDirectory(setup, state), '.pending-crash'), '{');
    assert.throws(() => adapter.reopen(initial), /ambiguous/);
  });

  test('journal foundation exposes no arbitrary record or filesystem write API', (t) => {
    const setup = fixture(t);
    const adapter = createMutationJournalAdapter({ storageRoot: setup.storageRoot });
    assert.deepEqual(Object.keys(adapter).sort(), ['append', 'create', 'reopen']);
    assert.ok(Object.isFrozen(adapter));
  });

  test('journal port is integrated while fsync and restart recovery remain deferred', () => {
    const source = fs.readFileSync(path.join(__dirname,
      '../../accelerator/adapters/mutation-journal-adapter.js'), 'utf8');
    const orchestrator = fs.readFileSync(path.join(__dirname,
      '../../accelerator/core/surgical-orchestrator.js'), 'utf8');
    const patch = fs.readFileSync(path.join(__dirname,
      '../../accelerator/adapters/filesystem-patch-adapter.js'), 'utf8');
    const lock = fs.readFileSync(path.join(__dirname,
      '../../accelerator/adapters/mutation-lock-adapter.js'), 'utf8');
    assert.doesNotMatch(source, /fsyncSync|fdatasyncSync|Date\.now|new Date/);
    assert.match(orchestrator, /mutationJournalAdapter/);
    assert.doesNotMatch(orchestrator, /mutation-journal-adapter/);
    assert.doesNotMatch(patch, /mutation-journal-adapter/);
    assert.doesNotMatch(lock, /mutation-journal-adapter/);
  });
}
