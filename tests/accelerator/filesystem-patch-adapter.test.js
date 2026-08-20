'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { evaluateCapabilityGrant } = require('../../accelerator/core/capability-grant');
const { evaluateR3ApprovalAuthority } = require('../../accelerator/core/risk-classification');
const { evaluateVerifiedHumanIdentityAssertion } = require('../../accelerator/core/human-identity-assertion');
const { verifyHumanIdentityAssertion } = require('../../accelerator/adapters/identity-verification-adapter');
const { patchFileWithGrant } = require('../../accelerator/adapters/filesystem-patch-adapter');
const { createAuthoritativeClock } = require('../../accelerator/core/authoritative-clock');
const {
  createMutationTransaction, bindMutationLock, transitionMutationTransaction,
  deriveMutationLockId
} = require('../../accelerator/core/mutation-transaction');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-fs-patch-'));
const workspace = path.join(root, 'repo');
const sibling = path.join(root, 'repo-secret');
fs.mkdirSync(workspace);
fs.mkdirSync(sibling);
const targetPath = path.join(workspace, 'target.txt');
fs.writeFileSync(path.join(sibling, 'secret.txt'), 'secret\n');
test.after(() => fs.rmSync(root, { recursive: true, force: true }));
test.beforeEach(() => {
  try { fs.rmSync(targetPath, { recursive: true, force: true }); } catch {}
  fs.writeFileSync(targetPath, 'before\n');
});

const NOW = '2026-08-20T12:00:00.000Z';
const EXPIRY = '2026-08-20T13:00:00.000Z';
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');

function frozen(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) frozen(child);
  return Object.freeze(value);
}

function clockAt(start = NOW, stepMilliseconds = 1) {
  let count = 0;
  const startMs = Date.parse(start);
  return createAuthoritativeClock({ port: { read: () => {
    const offset = count++ * stepMilliseconds;
    return { schema: 'sdo.system_clock_observation.v1', availability: 'AVAILABLE',
      source: 'TEST', wallTime: new Date(startMs + offset).toISOString(),
      monotonicNanoseconds: String(1000000000n + BigInt(offset) * 1000000n) };
  } } });
}

function clockSequence(observations) {
  let index = 0;
  const clock = createAuthoritativeClock({ port: { read: () => {
    const value = observations[Math.min(index++, observations.length - 1)];
    if (value instanceof Error) throw value;
    return { schema: 'sdo.system_clock_observation.v1', availability: 'AVAILABLE',
      source: 'TEST', ...value };
  } } });
  return { clock, reads: () => index };
}

function issue(overrides = {}) {
  const scope = overrides.scope || {
    target: { path: 'target.txt', beforeSha256: digest('before\n'),
      replacementSha256: digest('after\n') }
  };
  const verifiedIdentityAssertion = evaluateVerifiedHumanIdentityAssertion({
    schema: 'sdo.verified_human_identity_assertion.v1', verification: 'VERIFIED',
    assertionId: 'assertion-patch', subject: { id: 'human-1', type: 'HUMAN' },
    issuer: 'issuer:test', authentication: { method: 'PASSKEY', context: 'MFA' },
    issuedAt: '2026-08-20T11:55:00.000Z', expiresAt: EXPIRY,
    audience: ['surgical-devops'], operationId: 'op-patch', workspace,
    tenantId: 'tenant-1', projectId: 'project-1', revocationStatus: 'NOT_REVOKED',
    verifiedAt: '2026-08-20T11:59:00.000Z'
  }).assertion;
  const approvalAuthority = evaluateR3ApprovalAuthority({
    approvalAuthorityId: 'approval-patch', operationId: 'op-patch',
    approver: { id: 'human-1', type: 'HUMAN' }, decision: 'APPROVED', riskLevel: 'R3',
    capabilityType: 'FILESYSTEM_PATCH', action: 'PATCH_FILE', workspace, scope,
    tenantId: 'tenant-1', projectId: 'project-1', verifiedIdentityAssertion,
    policyDecision: 'APPROVAL_REQUIRED', timestamp: NOW, expiresAt: EXPIRY
  }).authority;
  const identityVerification = verifyHumanIdentityAssertion({ rawAssertion: { token: 'test' },
    trustedIssuers: ['issuer:test'], expected: { subjectId: 'human-1',
      audience: 'surgical-devops', operationId: 'op-patch', workspace,
      tenantId: 'tenant-1', projectId: 'project-1' }
  }, { verify() { return { status: 'VERIFIED', assertion: verifiedIdentityAssertion,
    verifierId: 'test-port' }; } }, { reading: clockAt().read(), requireCurrent: true });
  const common = {
    operationId: 'op-patch', workspace, policyDecision: 'APPROVAL_REQUIRED', riskLevel: 'R3',
    lifecycleState: 'PENDING', capabilityType: 'FILESYSTEM_PATCH', scope,
    idempotency: 'IDEMPOTENT', tenantId: 'tenant-1', projectId: 'project-1',
    approvalAuthority, identityVerification
  };
  return evaluateCapabilityGrant(
    { ...common, expiresAt: EXPIRY, ...overrides.request },
    { ...common, evaluatedAt: NOW, ...overrides.authority }, overrides.clock || clockAt()
  );
}

function patch(overrides = {}) {
  const clock = overrides.authoritativeClock || clockAt();
  const request = { ...overrides };
  delete request.authoritativeClock;
  const patchRequest = {
    operationId: 'op-patch', workspace, target: 'target.txt', replacement: 'after\n',
    grantEvaluation: issue(), observedAt: NOW, ...request
  };
  const grant = patchRequest.grantEvaluation && patchRequest.grantEvaluation.grant;
  let mutationTransaction = null;
  if (grant) {
    let transaction = createMutationTransaction({ operationId: patchRequest.operationId,
      workspace, target: grant.scope.target.canonicalPath,
      beforeSha256: grant.scope.target.beforeSha256,
      replacementSha256: grant.scope.target.replacementSha256,
      grantFingerprint: grant.fingerprint,
      approvalAuthorityFingerprint: grant.approvalAuthorityFingerprint,
      verifiedIdentityAssertionFingerprint: grant.verifiedIdentityAssertionFingerprint,
      idempotencyKey: 'adapter-test' });
    const lock = Object.freeze({ schema: 'sdo.mutation_lock.v1',
      adapter: 'FILESYSTEM_EXCLUSIVE_CREATE', version: 1,
      lockId: deriveMutationLockId(workspace, grant.scope.target.canonicalPath),
      transactionId: transaction.transactionId, operationId: transaction.operationId,
      workspace, target: grant.scope.target.canonicalPath,
      ownerToken: 'a'.repeat(64), ownerProcess: 'test:adapter', acquiredAt: NOW });
    transaction = bindMutationLock(transaction, lock);
    let journal = frozen({ journalId: 'b'.repeat(64),
      identity: { transactionId: transaction.transactionId }, transaction });
    mutationTransaction = {
      current: () => frozen({ transaction, journal, lockRetained: true }),
      advance(stage) {
        transaction = transitionMutationTransaction(transaction, stage);
        journal = frozen({ ...journal, transaction });
        return transaction;
      },
      requireRecovery() {
        if (transaction.stage !== 'RECOVERY_REQUIRED') this.advance('RECOVERY_REQUIRED');
        return transaction;
      }
    };
  }
  return patchFileWithGrant(patchRequest,
    { authoritativeClock: clock, mutationTransaction });
}

test('valid single-file replacement', () => {
  assert.equal(patch().outcome, 'APPLIED');
  assert.equal(fs.readFileSync(targetPath, 'utf8'), 'after\n');
});

test('BEFORE hash mismatch fails closed', () => {
  fs.writeFileSync(targetPath, 'stale\n');
  assert.throws(() => patch(), /BEFORE hash mismatch/);
  assert.equal(fs.readFileSync(targetPath, 'utf8'), 'stale\n');
});

test('missing grant fails closed', () => {
  assert.throws(() => patch({ grantEvaluation: undefined }), /valid immutable ALLOWED/);
});

test('expired grant fails closed', () => {
  assert.throws(() => patch({ authoritativeClock: clockAt(EXPIRY) }), /authority/i);
});

test('authority expiring exactly at the physical commit boundary causes zero mutation', () => {
  const start = new Date(Date.parse(EXPIRY) - 2).toISOString();
  assert.throws(() => patch({ authoritativeClock: clockAt(start, 1) }), /physical commit/);
  assert.equal(fs.readFileSync(targetPath, 'utf8'), 'before\n');
});

test('all authority valid one instant before expiry permits physical commit', () => {
  const start = new Date(Date.parse(EXPIRY) - 3).toISOString();
  assert.equal(patch({ authoritativeClock: clockAt(start, 1) }).outcome, 'APPLIED');
});

test('post-commit expiry is not rechecked to erase authorized physical reality', () => {
  const sequence = clockSequence([
    { wallTime: new Date(Date.parse(EXPIRY) - 3).toISOString(), monotonicNanoseconds: '1000000000' },
    { wallTime: new Date(Date.parse(EXPIRY) - 2).toISOString(), monotonicNanoseconds: '1001000000' },
    { wallTime: new Date(Date.parse(EXPIRY) - 1).toISOString(), monotonicNanoseconds: '1002000000' },
    { wallTime: EXPIRY, monotonicNanoseconds: '1003000000' }
  ]);
  const result = patch({ authoritativeClock: sequence.clock });
  assert.equal(result.outcome, 'APPLIED');
  assert.equal(sequence.reads(), 3);
  assert.equal(result.temporalAuthority.decision, 'ALLOWED');
  assert.equal(fs.readFileSync(targetPath, 'utf8'), 'after\n');
});

test('rollback suspicious-forward and unavailable clocks deny before replacement', () => {
  const cases = [
    clockSequence([
      { wallTime: NOW, monotonicNanoseconds: '1000000000' },
      { wallTime: '2026-08-20T11:59:59.999Z', monotonicNanoseconds: '1001000000' }
    ]).clock,
    clockSequence([
      { wallTime: NOW, monotonicNanoseconds: '1000000000' },
      { wallTime: '2026-08-20T12:00:05.000Z', monotonicNanoseconds: '1001000000' }
    ]).clock,
    clockSequence([
      { wallTime: NOW, monotonicNanoseconds: '1000000000' }, new Error('unavailable')
    ]).clock
  ];
  for (const authoritativeClock of cases) {
    assert.throws(() => patch({ authoritativeClock }), /before physical commit/);
    assert.equal(fs.readFileSync(targetPath, 'utf8'), 'before\n');
  }
});

test('caller observedAt cannot keep expired mutation authority alive', () => {
  assert.throws(() => patch({ observedAt: '2020-01-01T00:00:00.000Z',
    authoritativeClock: clockAt(EXPIRY) }), /authority/i);
  assert.equal(fs.readFileSync(targetPath, 'utf8'), 'before\n');
});

test('operationId mismatch fails closed', () => {
  assert.throws(() => patch({ operationId: 'other' }), /operationId mismatch/);
});

test('workspace mismatch fails closed', () => {
  assert.throws(() => patch({ workspace: fs.realpathSync(os.tmpdir()) }), /workspace mismatch/);
});

test('target outside exact scope fails closed', () => {
  fs.writeFileSync(path.join(workspace, 'other.txt'), 'before\n');
  assert.throws(() => patch({ target: 'other.txt' }), /outside the exact authorized/);
});

test('traversal attempt fails closed', () => {
  assert.throws(() => patch({ target: '../repo-secret/secret.txt' }), /escapes authorized workspace/);
});

test('sibling-prefix escape fails closed', () => {
  assert.throws(() => patch({ target: `${workspace}-secret/secret.txt` }), /escapes authorized workspace/);
});

test('symlink target fails closed', () => {
  const link = path.join(workspace, 'link.txt');
  fs.writeFileSync(link, 'before\n');
  const grantEvaluation = issue({
    scope: { target: { path: 'link.txt', beforeSha256: digest('before\n'),
      replacementSha256: digest('after\n') } }
  });
  fs.unlinkSync(link);
  fs.symlinkSync(targetPath, link);
  assert.throws(
    () => patch({ target: 'link.txt', grantEvaluation }),
    /Symlink targets are forbidden/
  );
});

test('directory target fails closed', () => {
  fs.rmSync(targetPath);
  fs.mkdirSync(targetPath);
  assert.equal(issue().decision, 'DENIED');
});

test('nonexistent target creation attempt fails closed', () => {
  fs.rmSync(targetPath);
  assert.equal(issue().decision, 'DENIED');
  assert.equal(fs.existsSync(targetPath), false);
});

test('multi-file or broadened scope is denied', () => {
  const target = { path: 'target.txt', beforeSha256: digest('before\n'),
    replacementSha256: digest('after\n') };
  assert.equal(issue({ scope: { target, paths: ['other.txt'] } }).decision, 'DENIED');
});

test('stale concurrent target change before replacement fails closed', () => {
  const original = fs.readFileSync;
  let reads = 0;
  fs.readFileSync = function (...args) {
    reads += 1;
    if (reads === 2) fs.writeFileSync(targetPath, 'concurrent\n');
    return original.apply(this, args);
  };
  try {
    assert.throws(() => patch(), /changed concurrently/);
  } finally {
    fs.readFileSync = original;
  }
  assert.equal(fs.readFileSync(targetPath, 'utf8'), 'concurrent\n');
});

test('AFTER hash and bound evidence are valid', () => {
  const result = patch();
  assert.equal(result.operationId, 'op-patch');
  assert.equal(result.workspace, workspace);
  assert.equal(result.target.canonical, targetPath);
  assert.equal(result.beforeSha256, digest('before\n'));
  assert.equal(result.afterSha256, digest('after\n'));
});

test('returned evidence is deeply immutable', () => {
  const result = patch();
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.target));
  assert.throws(() => { result.outcome = 'FAILED'; }, TypeError);
});

test('standalone already-applied state requires finalized journal proof', () => {
  const grantEvaluation = issue();
  patch({ grantEvaluation });
  assert.throws(() => patch({ grantEvaluation }), /FINALIZED_SUCCESS journal/);
  assert.equal(fs.readFileSync(targetPath, 'utf8'), 'after\n');
});

test('conflicting retry fails closed', () => {
  const grantEvaluation = issue();
  patch({ grantEvaluation });
  assert.throws(() => patch({ grantEvaluation, replacement: 'different\n' }), /authorized SHA-256/);
});

test('R1 and R2 patch grants are denied before adapter dispatch', () => {
  for (const riskLevel of ['R1', 'R2']) {
    assert.equal(issue({ request: { riskLevel }, authority: { riskLevel } }).decision, 'DENIED');
  }
});

test('verification failure restores only provably owned output', () => {
  const original = fs.readFileSync;
  let reads = 0;
  fs.readFileSync = function (...args) {
    reads += 1;
    if (reads === 3) return Buffer.from('invalid-observation\n');
    return original.apply(this, args);
  };
  try {
    assert.throws(() => patch(), (error) => error.evidence.recovery === 'RESTORED');
  } finally {
    fs.readFileSync = original;
  }
  assert.equal(fs.readFileSync(targetPath, 'utf8'), 'before\n');
});

test('verification failure does not restore unowned state', () => {
  const original = fs.readFileSync;
  let reads = 0;
  fs.readFileSync = function (...args) {
    reads += 1;
    if (reads === 3) {
      fs.writeFileSync(targetPath, 'external\n');
      return Buffer.from('external\n');
    }
    return original.apply(this, args);
  };
  try {
    assert.throws(() => patch(), (error) =>
      error.evidence.recovery === 'NOT_ATTEMPTED_UNPROVEN_OWNERSHIP');
  } finally {
    fs.readFileSync = original;
  }
  assert.equal(fs.readFileSync(targetPath, 'utf8'), 'external\n');
});

test('general filesystem write remains denied', () => {
  assert.equal(issue({ request: { capabilityType: 'FILESYSTEM_WRITE' },
    authority: { capabilityType: 'FILESYSTEM_WRITE' } }).decision, 'DENIED');
});

test('Git process network credentials and package installation remain denied', () => {
  for (const capabilityType of ['GIT_WRITE', 'PROCESS_EXECUTE', 'NETWORK_ACCESS',
    'CREDENTIAL_ACCESS', 'PACKAGE_INSTALL']) {
    assert.equal(issue({ request: { capabilityType }, authority: { capabilityType } }).decision, 'DENIED');
  }
  const source = fs.readFileSync(
    path.join(__dirname, '../../accelerator/adapters/filesystem-patch-adapter.js'), 'utf8'
  );
  assert.doesNotMatch(source, /child_process|execFile|spawn|http|https|\.\/git/);
});
