'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createMutationRecoveryAdapter } =
  require('../../accelerator/adapters/mutation-recovery-adapter');
const { createMutationJournalAdapter } =
  require('../../accelerator/adapters/mutation-journal-adapter');
const lockAdapter = require('../../accelerator/adapters/mutation-lock-adapter');
const { createMutationTransaction, transitionMutationTransaction,
  createCommitAuthorityEvidence, bindCommitAuthorityEvidence } =
  require('../../accelerator/core/mutation-transaction');
const { createAuthoritativeClock, evaluateMutationAuthority } =
  require('../../accelerator/core/authoritative-clock');

function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function clock(wallTime = '2026-08-20T14:00:00.000Z') { return createAuthoritativeClock({
  port: { read: () => ({ schema: 'sdo.system_clock_observation.v1',
    availability: 'AVAILABLE', source: 'TEST', wallTime, monotonicNanoseconds: '1000' }) } }); }
function fixture(t) { const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-recover-')));
  const workspace = path.join(root, 'workspace'); const journals = path.join(root, 'journals');
  fs.mkdirSync(workspace); fs.mkdirSync(journals); const target = path.join(workspace, 'target.txt');
  fs.writeFileSync(target, 'before\n'); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, workspace: fs.realpathSync(workspace), journals: fs.realpathSync(journals), target }; }
function setup(t) { const f = fixture(t); const transaction = createMutationTransaction({
  operationId: 'op-recovery', workspace: f.workspace, target: f.target,
  beforeSha256: digest('before\n'), replacementSha256: digest('after\n'),
  grantFingerprint: digest('grant'), approvalAuthorityFingerprint: digest('approval'),
  verifiedIdentityAssertionFingerprint: digest('human'), idempotencyKey: 'recover-1' });
  const journal = createMutationJournalAdapter({ storageRoot: f.journals }); journal.create(transaction);
  const acquired = lockAdapter.acquireMutationLock({ transaction, workspace: f.workspace,
    target: 'target.txt' });
  journal.append(acquired.transaction); return { ...f, initial: transaction,
    transaction: acquired.transaction, journal }; }
function commit(s) { let tx = transitionMutationTransaction(s.transaction, 'BEFORE_VERIFIED'); s.journal.append(tx);
  tx = transitionMutationTransaction(tx, 'MUTATION_STARTED'); s.journal.append(tx);
  const bound = (fingerprint) => ({ issuedAt: '2026-08-20T11:00:00.000Z',
    expiresAt: '2026-08-20T13:00:00.000Z', fingerprint });
  const evaluation = evaluateMutationAuthority(clock('2026-08-20T12:00:00.000Z'), {
    identity: bound(tx.verifiedIdentityAssertionFingerprint),
    approval: bound(tx.approvalAuthorityFingerprint), grant: bound(tx.grantFingerprint) });
  const authority = createCommitAuthorityEvidence(tx, { policyDecision: 'ALLOWED', riskLevel: 'R3',
    capabilityType: 'FILESYSTEM_PATCH', action: 'PATCH_FILE', scope: { target: {
      canonicalPath: tx.target, beforeSha256: tx.beforeSha256,
      replacementSha256: tx.replacementSha256 } }, authoritativeEvaluation: evaluation });
  tx = bindCommitAuthorityEvidence(tx, authority); s.journal.append(tx); s.transaction = tx; return tx; }
function port() { return { verifyTerminated({ ownerProcess }) {
  return { decision: 'TERMINATED', ownerProcess, verifierId: 'trusted-test-liveness' }; } }; }
function recovery(s, overrides = {}) { return createMutationRecoveryAdapter({ journalAdapter: s.journal,
  lockAdapter, authoritativeClock: clock(), ownerTerminationPort: port(), ...overrides }); }
function advance(s, stage) { s.transaction = transitionMutationTransaction(s.transaction, stage);
  s.journal.append(s.transaction); return s.transaction; }

test('restart before commit with BEFORE state finalizes failed without remutation', (t) => {
  const s = setup(t); const before = fs.statSync(s.target).ino;
  const result = recovery(s).recover({ transaction: s.initial });
  assert.equal(result.recoveryClassification, 'NOT_APPLIED');
  assert.equal(result.finalRecoveryState, 'FINALIZED_FAILED');
  assert.equal(fs.readFileSync(s.target, 'utf8'), 'before\n');
  assert.equal(fs.statSync(s.target).ino, before);
});

test('restart after authorized replacement reconciles success without remutation', (t) => {
  const s = setup(t); commit(s); fs.writeFileSync(s.target, 'after\n');
  const before = fs.statSync(s.target).ino;
  const result = recovery(s).recover({ transaction: s.initial });
  assert.equal(result.recoveryClassification, 'PREVIOUSLY_AUTHORIZED_APPLIED');
  assert.equal(result.finalRecoveryState, 'FINALIZED_SUCCESS');
  assert.equal(fs.statSync(s.target).ino, before);
});

test('neither hash becomes terminal unresolved and retains mutation lock', (t) => {
  const s = setup(t); commit(s); fs.writeFileSync(s.target, 'external\n');
  const result = recovery(s).recover({ transaction: s.initial });
  assert.equal(result.recoveryClassification, 'RECOVERY_UNRESOLVED');
  assert.equal(result.finalRecoveryState, 'RECOVERY_UNRESOLVED');
  assert.equal(result.lockDisposition, 'RETAINED');
  assert.equal(fs.readFileSync(s.target, 'utf8'), 'external\n');
});

test('ambiguous owner is not reclaimed without trusted termination proof', (t) => {
  const s = setup(t); const result = recovery(s, { ownerTerminationPort: null })
    .recover({ transaction: s.initial });
  assert.equal(result.recoveryClassification, 'RECOVERY_UNRESOLVED');
  assert.equal(lockAdapter.inspectMutationLock({ transaction: s.transaction }).classification, 'MATCHED');
});

test('recovery ownership is cross-process exclusive and non-owner claims contend', (t) => {
  const s = setup(t); const termination = Object.freeze({ decision: 'TERMINATED',
    ownerProcess: s.transaction.lock.ownerProcess });
  const first = lockAdapter.acquireMutationRecoveryClaim({ transaction: s.transaction,
    terminationEvidence: termination });
  const second = lockAdapter.acquireMutationRecoveryClaim({ transaction: s.transaction,
    terminationEvidence: termination });
  assert.equal(first.decision, 'ACQUIRED'); assert.equal(second.decision, 'CONTENDED');
  lockAdapter.releaseMutationRecoveryClaim({ transaction: s.transaction, claim: first.claim });
});

test('corrupt or truncated journal fails closed before reconciliation', (t) => {
  const s = setup(t); const state = s.journal.reopen(s.initial);
  fs.writeFileSync(path.join(s.journals, state.journalId, '00000002.json'), '{');
  assert.throws(() => recovery(s).recover({ transaction: s.initial }), /truncated|invalid JSON/);
  assert.equal(fs.readFileSync(s.target, 'utf8'), 'before\n');
});

test('all durable crash stages reconcile by evidence with zero replacement replay', (t) => {
  const stages = ['LOCKED', 'BEFORE_VERIFIED', 'MUTATION_STARTED',
    'COMMIT_AUTHORITY_VERIFIED', 'PHYSICAL_APPLIED', 'AFTER_VERIFIED',
    'EVIDENCE_RECORDED', 'FINALIZED_SUCCESS'];
  for (const stage of stages) {
    const s = setup(t);
    if (stage === 'BEFORE_VERIFIED') advance(s, stage);
    if (stage === 'MUTATION_STARTED') { advance(s, 'BEFORE_VERIFIED'); advance(s, stage); }
    if (!['LOCKED', 'BEFORE_VERIFIED', 'MUTATION_STARTED'].includes(stage)) {
      commit(s);
      fs.writeFileSync(s.target, 'after\n');
      for (const next of ['PHYSICAL_APPLIED', 'AFTER_VERIFIED', 'EVIDENCE_RECORDED',
        'FINALIZED_SUCCESS']) {
        if (stage === 'COMMIT_AUTHORITY_VERIFIED') break;
        advance(s, next);
        if (next === stage) break;
      }
    }
    const inode = fs.statSync(s.target).ino;
    const result = recovery(s).recover({ transaction: s.initial });
    assert.equal(fs.statSync(s.target).ino, inode, stage);
    assert.notEqual(result.physicalClassification, 'OTHER', stage);
  }
});

test('PREPARED and acquired-before-LOCKED crashes remain fail-closed without remutation', (t) => {
  for (const acquire of [false, true]) {
    const f = fixture(t);
    const initial = createMutationTransaction({ operationId: 'op-recovery', workspace: f.workspace,
      target: f.target, beforeSha256: digest('before\n'), replacementSha256: digest('after\n'),
      grantFingerprint: digest('grant'), approvalAuthorityFingerprint: digest('approval'),
      verifiedIdentityAssertionFingerprint: digest('human'), idempotencyKey: 'recover-early' });
    const journal = createMutationJournalAdapter({ storageRoot: f.journals }); journal.create(initial);
    const acquired = acquire ? lockAdapter.acquireMutationLock({ transaction: initial,
      workspace: f.workspace, target: 'target.txt' }) : null;
    const result = createMutationRecoveryAdapter({ journalAdapter: journal, lockAdapter,
      authoritativeClock: clock(), ownerTerminationPort: port() }).recover({ transaction: initial });
    assert.equal(result.recoveryClassification, 'RECOVERY_UNRESOLVED');
    assert.equal(fs.readFileSync(f.target, 'utf8'), 'before\n');
    if (acquired) lockAdapter.releaseMutationLock({ transaction: acquired.transaction,
      lock: acquired.lock });
  }
});

test('recovery crash after durable reconciliation resumes without remutation', (t) => {
  const s = setup(t); commit(s); fs.writeFileSync(s.target, 'after\n');
  let failed = false;
  const failingJournal = { create: s.journal.create, reopen: s.journal.reopen,
    append(transaction) { if (!failed && transaction.stage === 'EVIDENCE_RECORDED') {
      failed = true; throw new Error('Injected recovery crash.'); }
    return s.journal.append(transaction); } };
  const inode = fs.statSync(s.target).ino;
  assert.throws(() => recovery(s, { journalAdapter: failingJournal })
    .recover({ transaction: s.initial }), /recovery crash/);
  const result = recovery(s).recover({ transaction: s.initial });
  assert.equal(result.finalRecoveryState, 'FINALIZED_SUCCESS');
  assert.equal(fs.statSync(s.target).ino, inode);
});
