'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { classifyMutationRecovery } = require('../../accelerator/core/mutation-recovery');
const { createMutationTransaction, bindMutationLock, deriveMutationLockId,
  transitionMutationTransaction, createCommitAuthorityEvidence,
  bindCommitAuthorityEvidence } = require('../../accelerator/core/mutation-transaction');
const { createAuthoritativeClock, evaluateMutationAuthority } =
  require('../../accelerator/core/authoritative-clock');

const workspace = path.resolve('/tmp/sdo-recovery-core');
const target = path.join(workspace, 'target.txt');
function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) {
  Object.freeze(value); for (const child of Object.values(value)) freeze(child); } return value; }
function clock() { return createAuthoritativeClock({ port: { read: () => ({
  schema: 'sdo.system_clock_observation.v1', availability: 'AVAILABLE', source: 'TEST',
  wallTime: '2026-08-20T14:00:00.000Z', monotonicNanoseconds: '1000' }) } }); }
function prepared() { return createMutationTransaction({ operationId: 'op-recovery', workspace,
  target, beforeSha256: 'a'.repeat(64), replacementSha256: 'b'.repeat(64),
  grantFingerprint: 'c'.repeat(64), approvalAuthorityFingerprint: 'd'.repeat(64),
  verifiedIdentityAssertionFingerprint: 'e'.repeat(64), idempotencyKey: 'recovery-1' }); }
function locked() { const transaction = prepared(); return bindMutationLock(transaction, freeze({
  schema: 'sdo.mutation_lock.v1', adapter: 'FILESYSTEM_EXCLUSIVE_CREATE', version: 1,
  lockId: deriveMutationLockId(workspace, target), transactionId: transaction.transactionId,
  operationId: transaction.operationId, workspace, target, ownerToken: '1'.repeat(64),
  ownerProcess: 'dead:test', acquiredAt: '2026-08-20T12:00:00.000Z' })); }
function committed() { let transaction = locked();
  transaction = transitionMutationTransaction(transaction, 'BEFORE_VERIFIED');
  transaction = transitionMutationTransaction(transaction, 'MUTATION_STARTED');
  const bound = (fingerprint) => ({ issuedAt: '2026-08-20T11:00:00.000Z',
    expiresAt: '2026-08-20T13:00:00.000Z', fingerprint });
  const evaluation = evaluateMutationAuthority(createAuthoritativeClock({ port: { read: () => ({
    schema: 'sdo.system_clock_observation.v1', availability: 'AVAILABLE', source: 'TEST',
    wallTime: '2026-08-20T12:00:00.000Z', monotonicNanoseconds: '900' }) } }), {
    identity: bound(transaction.verifiedIdentityAssertionFingerprint),
    approval: bound(transaction.approvalAuthorityFingerprint), grant: bound(transaction.grantFingerprint) });
  const evidence = createCommitAuthorityEvidence(transaction, { policyDecision: 'ALLOWED',
    riskLevel: 'R3', capabilityType: 'FILESYSTEM_PATCH', action: 'PATCH_FILE',
    scope: { target: { canonicalPath: target, beforeSha256: transaction.beforeSha256,
      replacementSha256: transaction.replacementSha256 } }, authoritativeEvaluation: evaluation });
  return bindCommitAuthorityEvidence(transaction, evidence); }
function classify(transaction, physicalClassification, lockClassification = 'MATCHED') {
  const journal = freeze({ journalId: 'f'.repeat(64), identity: {
    transactionId: transaction.transactionId }, transaction });
  const physical = freeze({ transactionId: transaction.transactionId, workspace, target,
    sha256: physicalClassification === 'BEFORE' ? transaction.beforeSha256
      : physicalClassification === 'REPLACEMENT' ? transaction.replacementSha256
        : physicalClassification === 'OTHER' ? '9'.repeat(64) : null,
    classification: physicalClassification });
  return classifyMutationRecovery({ journal, physical,
    lock: freeze({ classification: lockClassification }),
    authoritativeObservation: clock().observe() });
}

test('BEFORE state before durable commit reconciles only as NOT_APPLIED', () => {
  const result = classify(locked(), 'BEFORE');
  assert.equal(result.recoveryClassification, 'NOT_APPLIED');
  assert.equal(result.terminalStage, 'FINALIZED_FAILED');
});

test('replacement plus durable historical commit authority reconciles without new authority', () => {
  const result = classify(committed(), 'REPLACEMENT');
  assert.equal(result.recoveryClassification, 'PREVIOUSLY_AUTHORIZED_APPLIED');
  assert.equal(result.terminalStage, 'FINALIZED_SUCCESS');
  assert.equal(result.commitAuthorityFingerprint, committed().commitAuthority.fingerprint);
});

test('other unavailable missing or ambiguous state remains RECOVERY_UNRESOLVED', () => {
  for (const [physical, lock] of [['OTHER', 'MATCHED'], ['UNAVAILABLE', 'MATCHED'],
    ['BEFORE', 'MISSING'], ['REPLACEMENT', 'CORRUPT']]) {
    assert.equal(classify(committed(), physical, lock).recoveryClassification,
      'RECOVERY_UNRESOLVED');
  }
});

test('expired historical authority can corroborate but never causes physical mutation', () => {
  const result = classify(committed(), 'REPLACEMENT');
  assert.equal(result.authoritativeObservation.reading.wallTime, '2026-08-20T14:00:00.000Z');
  assert.equal(result.recoveryClassification, 'PREVIOUSLY_AUTHORIZED_APPLIED');
  assert.equal(Object.isFrozen(result), true);
});
