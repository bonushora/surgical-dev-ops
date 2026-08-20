'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createOperationRecord: createOperationRecordCore,
  appendAdapterEvidence,
  finalizeOperationRecord
} = require('../../accelerator/core/operation-record');
const { evaluateR3ApprovalAuthority } = require('../../accelerator/core/risk-classification');
const { evaluateVerifiedHumanIdentityAssertion } = require('../../accelerator/core/human-identity-assertion');
const { verifyHumanIdentityAssertion } = require('../../accelerator/adapters/identity-verification-adapter');
const { createAuthoritativeClock, classifyMutationAuthority } =
  require('../../accelerator/core/authoritative-clock');

const TIME = '2026-08-20T12:00:00.000Z';
const WORKSPACE = fs.realpathSync(os.tmpdir());

function clockAt(wallTime = TIME) {
  return createAuthoritativeClock({ port: { read: () => ({
    schema: 'sdo.system_clock_observation.v1', availability: 'AVAILABLE', source: 'TEST',
    wallTime, monotonicNanoseconds: '1000000000'
  }) } });
}

function createOperationRecord(value, clock = null) {
  return createOperationRecordCore(value,
    value && value.riskLevel === 'R3' ? (clock || clockAt()) : clock);
}

function events(riskLevel = 'R0', operationId = 'op-1', authority = null) {
  const result = [
    { type: 'intent', operationId, timestamp: TIME,
      objective: 'Record an authorized operation.' },
    { type: 'policy', operationId, timestamp: TIME,
      policyDecision: riskLevel === 'R3' ? 'APPROVAL_REQUIRED' : 'ALLOWED', riskLevel }
  ];
  if (riskLevel === 'R3') {
    result.push({ type: 'approval', operationId, timestamp: TIME,
      approverId: 'human-1', decision: 'APPROVED', approvalTimestamp: TIME,
      approvalAuthorityId: authority && authority.approvalAuthorityId,
      approvalAuthorityFingerprint: authority && authority.fingerprint,
      verifiedIdentityAssertionFingerprint:
        authority && authority.verifiedIdentityAssertionFingerprint });
  }
  result.push({ type: 'state', operationId, timestamp: TIME, status: 'RECORDED' });
  return result;
}

function input(overrides = {}) {
  return {
    operationId: 'op-1',
    requester: { id: 'requester-1', type: 'HUMAN' },
    workspace: WORKSPACE,
    objective: 'Record an authorized operation.',
    policyDecision: 'ALLOWED',
    riskLevel: 'R0',
    idempotency: 'IDEMPOTENT',
    events: events(),
    ...overrides
  };
}

function r3(overrides = {}) {
  const scope = { target: { path: 'target.js', beforeSha256: 'c'.repeat(64),
    replacementSha256: 'd'.repeat(64) } };
  const verifiedIdentityAssertion = evaluateVerifiedHumanIdentityAssertion({
    schema: 'sdo.verified_human_identity_assertion.v1', verification: 'VERIFIED',
    assertionId: 'assertion-1', subject: { id: 'human-1', type: 'HUMAN' }, issuer: 'issuer:test',
    authentication: { method: 'PASSKEY', context: 'MFA' }, issuedAt: '2026-08-20T11:55:00.000Z',
    expiresAt: '2026-08-20T13:00:00.000Z', audience: ['surgical-devops'],
    operationId: 'op-1', workspace: WORKSPACE, tenantId: 'tenant-1', projectId: 'project-1',
    revocationStatus: 'NOT_REVOKED', verifiedAt: '2026-08-20T11:59:00.000Z'
  }).assertion;
  const approvalAuthority = evaluateR3ApprovalAuthority({
    approvalAuthorityId: 'approval-1', operationId: 'op-1',
    approver: { id: 'human-1', type: 'HUMAN' }, decision: 'APPROVED', riskLevel: 'R3',
    capabilityType: 'FILESYSTEM_PATCH', action: 'PATCH_FILE', workspace: WORKSPACE, scope,
    tenantId: 'tenant-1', projectId: 'project-1', verifiedIdentityAssertion,
    policyDecision: 'APPROVAL_REQUIRED', timestamp: TIME,
    expiresAt: '2026-08-20T13:00:00.000Z'
  }).authority;
  const identityVerification = verifyHumanIdentityAssertion({ rawAssertion: { token: 'test' },
    trustedIssuers: ['issuer:test'], expected: { subjectId: 'human-1',
      audience: 'surgical-devops', operationId: 'op-1', workspace: WORKSPACE,
      tenantId: 'tenant-1', projectId: 'project-1' }
  }, { verify() { return { status: 'VERIFIED', assertion: verifiedIdentityAssertion,
    verifierId: 'test-port' }; } }, { reading: clockAt().read(), requireCurrent: true });
  return input({
    policyDecision: 'APPROVAL_REQUIRED',
    riskLevel: 'R3',
    approvalAuthority, identityVerification,
    capabilityType: 'FILESYSTEM_PATCH', action: 'PATCH_FILE', scope,
    tenantId: 'tenant-1', projectId: 'project-1',
    observedAt: '2026-08-20T12:30:00.000Z',
    events: events('R3', 'op-1', approvalAuthority),
    ...overrides
  });
}

function record(overrides = {}) {
  return createOperationRecord(input(overrides)).record;
}

function patchRecord() {
  return record({ riskLevel: 'R1', events: events('R1') });
}

function r3PatchRecord() {
  return createOperationRecord(r3()).record;
}

function frozen(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) frozen(child);
  return Object.freeze(value);
}

const GRANT = 'a'.repeat(64);

function evidence(adapterType = 'FILESYSTEM_READ', overrides = {}) {
  const action = adapterType === 'GIT_READ' ? 'HEAD_COMMIT'
    : adapterType === 'PROCESS_VALIDATION' ? 'NODE_SYNTAX_CHECK'
      : adapterType === 'FILESYSTEM_PATCH' ? 'PATCH_FILE' : 'READ_FILE';
  const beforeSha256 = 'c'.repeat(64);
  const replacementSha256 = 'd'.repeat(64);
  const patchTarget = { requested: 'target.js', canonical: `${WORKSPACE}/target.js` };
  const payload = adapterType === 'GIT_READ'
    ? { schema: 'sdo.git_read_result.v1', operationId: 'op-1', workspace: WORKSPACE,
        selector: action, result: 'a'.repeat(40) }
    : adapterType === 'PROCESS_VALIDATION'
      ? { schema: 'sdo.process_validation_result.v1', operationId: 'op-1', workspace: WORKSPACE,
          selector: action, validation: { status: 'PASSED', successfulCompletionEligible: true } }
      : adapterType === 'FILESYSTEM_PATCH'
        ? { schema: 'sdo.filesystem_patch_result.v1', operationId: 'op-1', workspace: WORKSPACE,
            target: patchTarget, beforeSha256, afterSha256: replacementSha256,
            outcome: 'APPLIED', recovery: 'NOT_REQUIRED' }
      : { schema: 'sdo.filesystem_read_result.v1', operationId: 'op-1', workspace: WORKSPACE,
          target: { requested: 'target.js', canonical: `${WORKSPACE}/target.js` },
          evidence: { bytes: 1, sha256: 'b'.repeat(64), content: 'x' } };
  return {
    evidenceId: `${adapterType}-1`, operationId: 'op-1', workspace: WORKSPACE,
    adapterType, action, grantFingerprint: GRANT, policyDecision: 'ALLOWED',
    riskLevel: adapterType === 'FILESYSTEM_PATCH' ? 'R1' : 'R0', lifecycleState: 'PENDING',
    outcome: adapterType === 'PROCESS_VALIDATION' ? 'PASSED'
      : adapterType === 'FILESYSTEM_PATCH' ? 'APPLIED' : 'SUCCEEDED',
    timestamp: TIME, payload: frozen(payload),
    ...(adapterType === 'FILESYSTEM_PATCH' ? {
      target: patchTarget, beforeSha256, replacementSha256,
      afterSha256: replacementSha256, recovery: 'NOT_REQUIRED'
    } : {}),
    ...overrides
  };
}

function r3Evidence(record, overrides = {}) {
  const base = evidence('FILESYSTEM_PATCH');
  const evaluation = classifyMutationAuthority(clockAt().read(), {
    identity: { issuedAt: record.verifiedIdentityAssertion.issuedAt,
      expiresAt: record.verifiedIdentityAssertion.expiresAt,
      fingerprint: record.verifiedIdentityAssertionFingerprint },
    approval: { issuedAt: record.approvalAuthority.timestamp,
      expiresAt: record.approvalAuthority.expiresAt,
      fingerprint: record.approvalAuthority.fingerprint },
    grant: { issuedAt: TIME, expiresAt: '2026-08-20T13:00:00.000Z', fingerprint: GRANT }
  });
  const temporalAuthority = frozen({ schema: 'sdo.mutation_commit_authority.v1',
    commitBoundary: 'IMMEDIATELY_BEFORE_ATOMIC_REPLACEMENT', physicalCommit: 'APPLIED',
    decision: 'ALLOWED', evaluation });
  const transactionId = 'e'.repeat(64);
  const journalId = 'f'.repeat(64);
  const transaction = frozen({ transactionId, journalId, stage: 'AFTER_VERIFIED',
    lockId: '9'.repeat(64), classification: 'IN_PROGRESS' });
  return evidence('FILESYSTEM_PATCH', { riskLevel: 'R3',
    approvalAuthorityFingerprint: record.approvalAuthority.fingerprint,
    verifiedIdentityAssertionFingerprint: record.verifiedIdentityAssertionFingerprint,
    identityVerificationEvidenceFingerprint: record.identityVerificationEvidenceFingerprint,
    transactionId, journalId,
    payload: frozen({ ...base.payload, observedAt: TIME, temporalAuthority, transaction }),
    ...overrides });
}

function finalState(overrides = {}) {
  return {
    operationId: 'op-1', workspace: WORKSPACE, lifecycleState: 'COMPLETED',
    outcome: 'SUCCESS', successfulCompletionEligible: true, timestamp: TIME,
    ...overrides
  };
}

test('valid R0 operation requires no approval', () => {
  const result = createOperationRecord(input());
  assert.equal(result.decision, 'ALLOWED');
  assert.equal(result.record.approval, null);
});

test('valid R3 operation binds explicit approval', () => {
  const result = createOperationRecord(r3());
  assert.equal(result.decision, 'ALLOWED');
  assert.equal(result.record.approvalAuthority.operationId, 'op-1');
  assert.ok(Object.isFrozen(result.record.approvalAuthority));
  assert.equal(result.record.verifiedIdentityAssertionFingerprint,
    result.record.approvalAuthority.verifiedIdentityAssertionFingerprint);
  assert.equal(result.record.identityVerificationEvidenceFingerprint,
    result.record.identityVerification.evidence.fingerprint);
});

test('R3 operation record requires authoritative current-time validation', () => {
  assert.equal(createOperationRecordCore(r3()).decision, 'DENIED');
  assert.equal(createOperationRecordCore(r3(),
    clockAt('2026-08-20T13:00:00.000Z')).decision, 'DENIED');
});

test('R3 without approval is denied', () => {
  assert.equal(createOperationRecord(r3({ approvalAuthority: undefined })).decision, 'DENIED');
});

test('approval operationId mismatch is denied', () => {
  const approvalAuthority = { ...r3().approvalAuthority, operationId: 'op-other' };
  assert.equal(createOperationRecord(r3({ approvalAuthority })).decision, 'DENIED');
});

test('missing approver identity is denied', () => {
  const approvalAuthority = { ...r3().approvalAuthority, approver: undefined };
  assert.equal(createOperationRecord(r3({ approvalAuthority })).decision, 'DENIED');
});

test('non-human approver identity is denied', () => {
  const approvalAuthority = { ...r3().approvalAuthority, approver: { id: 'agent-1', type: 'AGENT' } };
  assert.equal(createOperationRecord(r3({ approvalAuthority })).decision, 'DENIED');
});

test('malformed approval timestamp is denied', () => {
  const approvalAuthority = { ...r3().approvalAuthority, timestamp: 'not-a-time' };
  assert.equal(createOperationRecord(r3({ approvalAuthority })).decision, 'DENIED');
});

test('approval cannot tamper with policy or risk', () => {
  const approvalAuthority = { ...r3().approvalAuthority, policyDecision: 'ALLOWED', riskLevel: 'R0' };
  assert.equal(createOperationRecord(r3({ approvalAuthority })).decision, 'DENIED');
});

test('operation record rejects verified identity substitution', () => {
  const approvalAuthority = { ...r3().approvalAuthority,
    verifiedIdentityAssertionFingerprint: 'f'.repeat(64) };
  assert.equal(createOperationRecord(r3({ approvalAuthority })).decision, 'DENIED');
});

test('operation record rejects missing or substituted verification evidence', () => {
  assert.equal(createOperationRecord(r3({ identityVerification: undefined })).decision, 'DENIED');
  const identityVerification = frozen({ ...r3().identityVerification,
    evidence: { ...r3().identityVerification.evidence, fingerprint: 'f'.repeat(64) } });
  assert.equal(createOperationRecord(r3({ identityVerification })).decision, 'DENIED');
});

test('operation evaluation, record and nested events are immutable', () => {
  const result = createOperationRecord(input());
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.record));
  assert.ok(Object.isFrozen(result.record.events));
  assert.ok(Object.isFrozen(result.record.events[0]));
  assert.throws(() => { result.record.operationId = 'changed'; }, TypeError);
});

test('valid mandatory events retain deterministic order', () => {
  const result = createOperationRecord(input());
  assert.deepEqual(result.record.events.map((event) => event.type), ['intent', 'policy', 'state']);
});

test('missing mandatory event is denied', () => {
  assert.equal(createOperationRecord(input({ events: events().slice(0, 2) })).decision, 'DENIED');
});

test('duplicate mandatory event is denied', () => {
  const duplicated = [events()[0], events()[1], events()[1], events()[2]];
  assert.equal(createOperationRecord(input({ events: duplicated })).decision, 'DENIED');
});

test('out-of-order mandatory events are denied', () => {
  const unordered = [events()[1], events()[0], events()[2]];
  assert.equal(createOperationRecord(input({ events: unordered })).decision, 'DENIED');
});

test('chronologically out-of-order event timestamps are denied', () => {
  const unordered = events();
  unordered[1] = { ...unordered[1], timestamp: '2026-08-20T11:59:59.000Z' };
  assert.equal(createOperationRecord(input({ events: unordered })).decision, 'DENIED');
});

test('valid filesystem-read evidence appends immutably', () => {
  const original = record();
  const next = appendAdapterEvidence(original, evidence());
  assert.equal(original.adapterEvidence.length, 0);
  assert.equal(next.adapterEvidence[0].adapterType, 'FILESYSTEM_READ');
  assert.ok(Object.isFrozen(next));
  assert.ok(Object.isFrozen(next.adapterEvidence[0].payload));
});

test('valid Git-read evidence appends', () => {
  assert.equal(appendAdapterEvidence(record(), evidence('GIT_READ'))
    .adapterEvidence[0].action, 'HEAD_COMMIT');
});

test('valid process-validation PASSED evidence remains completion eligible', () => {
  const next = appendAdapterEvidence(record(), evidence('PROCESS_VALIDATION'));
  assert.equal(finalizeOperationRecord(next, finalState()).finalization.outcome, 'SUCCESS');
});

test('process-validation FAILED evidence blocks successful completion', () => {
  const payload = frozen({
    schema: 'sdo.process_validation_result.v1', operationId: 'op-1', workspace: WORKSPACE,
    selector: 'NODE_SYNTAX_CHECK',
    validation: { status: 'FAILED', successfulCompletionEligible: false }
  });
  const next = appendAdapterEvidence(record(), evidence('PROCESS_VALIDATION', {
    outcome: 'FAILED', payload
  }));
  assert.throws(() => finalizeOperationRecord(next, finalState()), /inconsistent/);
  assert.equal(finalizeOperationRecord(next, finalState({
    lifecycleState: 'FAILED', outcome: 'FAILED', successfulCompletionEligible: false
  })).finalization.lifecycleState, 'FAILED');
});

test('evidence operationId mismatch fails closed', () => {
  assert.throws(() => appendAdapterEvidence(record(), evidence('FILESYSTEM_READ', {
    operationId: 'op-other'
  })), /operationId mismatch/);
});

test('evidence workspace mismatch fails closed', () => {
  assert.throws(() => appendAdapterEvidence(record(), evidence('FILESYSTEM_READ', {
    workspace: path.join(WORKSPACE, 'other')
  })), /workspace mismatch/);
});

test('unknown adapter and action fail closed', () => {
  assert.throws(() => appendAdapterEvidence(record(), evidence('DISCOVERY')), /Unknown or forbidden/);
  assert.throws(() => appendAdapterEvidence(record(), evidence('GIT_READ', { action: 'PUSH' })),
    /Unknown or forbidden/);
});

test('policy risk and lifecycle mismatches fail closed', () => {
  for (const override of [
    { policyDecision: 'DENIED' }, { riskLevel: 'R2' }, { lifecycleState: 'COMPLETED' }
  ]) assert.throws(() => appendAdapterEvidence(record(), evidence('GIT_READ', override)), /context mismatch/);
});

test('missing or malformed capability binding fails closed', () => {
  assert.throws(() => appendAdapterEvidence(record(), evidence('GIT_READ', {
    grantFingerprint: undefined
  })), /grant binding/);
});

test('malformed evidence timestamp fails closed', () => {
  assert.throws(() => appendAdapterEvidence(record(), evidence('GIT_READ', {
    timestamp: 'yesterday'
  })), /timestamp/);
});

test('mutable or malformed payload fails closed', () => {
  assert.throws(() => appendAdapterEvidence(record(), evidence('GIT_READ', {
    payload: { schema: 'sdo.git_read_result.v1' }
  })), /deeply immutable/);
});

test('ordered adapter evidence sequence is preserved', () => {
  const first = appendAdapterEvidence(record(), evidence());
  const second = appendAdapterEvidence(first, evidence('GIT_READ'));
  assert.deepEqual(second.adapterEvidence.map((item) => item.adapterType),
    ['FILESYSTEM_READ', 'GIT_READ']);
  assert.deepEqual(second.events, record().events);
});

test('identical evidence replay returns the same record', () => {
  const item = evidence();
  const next = appendAdapterEvidence(record(), item);
  assert.strictEqual(appendAdapterEvidence(next, item), next);
});

test('conflicting replay with the same identity fails closed', () => {
  const next = appendAdapterEvidence(record(), evidence());
  assert.throws(() => appendAdapterEvidence(next, evidence('FILESYSTEM_READ', {
    timestamp: '2026-08-20T12:00:01.000Z'
  })), /Conflicting duplicate/);
});

test('append after finalization fails closed', () => {
  const next = appendAdapterEvidence(record(), evidence());
  const completed = finalizeOperationRecord(next, finalState());
  assert.throws(() => appendAdapterEvidence(completed, evidence('GIT_READ')), /after finalization/);
});

test('valid finalization is immutable and versioned', () => {
  const next = appendAdapterEvidence(record(), evidence());
  const completed = finalizeOperationRecord(next, finalState());
  assert.equal(completed.finalization.lifecycleState, 'COMPLETED');
  assert.equal(completed.version, 3);
  assert.ok(Object.isFrozen(completed.finalization));
});

test('invalid finalization fails closed', () => {
  const next = appendAdapterEvidence(record(), evidence());
  assert.throws(() => finalizeOperationRecord(next, finalState({
    lifecycleState: 'FAILED', outcome: 'SUCCESS'
  })), /inconsistent/);
});

test('valid FILESYSTEM_PATCH evidence appends immutably', () => {
  const next = appendAdapterEvidence(patchRecord(), evidence('FILESYSTEM_PATCH'));
  assert.equal(next.adapterEvidence[0].action, 'PATCH_FILE');
  assert.ok(Object.isFrozen(next.adapterEvidence[0].target));
  assert.ok(Object.isFrozen(next.adapterEvidence[0].payload));
});

test('matching R3 patch evidence requires and preserves approval authority', () => {
  const record = r3PatchRecord();
  const item = r3Evidence(record);
  const next = appendAdapterEvidence(record, item);
  assert.equal(next.adapterEvidence[0].approvalAuthorityFingerprint,
    record.approvalAuthority.fingerprint);
  assert.ok(Object.isFrozen(next.approvalAuthority));
  assert.equal(next.adapterEvidence[0].payload.temporalAuthority.decision, 'ALLOWED');
  assert.equal(next.adapterEvidence[0].payload.temporalAuthority.evaluation.reading.wallTime, TIME);
  assert.ok(Object.isFrozen(next.adapterEvidence[0].payload.temporalAuthority));
});

test('R3 patch finalization correlates terminal journal and transaction identity', () => {
  const record = r3PatchRecord();
  const next = appendAdapterEvidence(record, r3Evidence(record));
  const evidenceItem = next.adapterEvidence[0];
  const completed = finalizeOperationRecord(next, finalState({
    mutationTransaction: { transactionId: evidenceItem.transactionId,
      journalId: evidenceItem.journalId, stage: 'FINALIZED_SUCCESS',
      lockDisposition: 'RELEASED' }
  }));
  assert.equal(completed.finalization.mutationTransaction.stage, 'FINALIZED_SUCCESS');
  assert.throws(() => finalizeOperationRecord(next, finalState({
    mutationTransaction: { transactionId: evidenceItem.transactionId,
      journalId: '0'.repeat(64), stage: 'FINALIZED_SUCCESS', lockDisposition: 'RELEASED' }
  })), /transaction\/journal/);
});

test('R3 patch evidence without matching approval authority is rejected', () => {
  const record = r3PatchRecord();
  assert.throws(() => appendAdapterEvidence(record, evidence('FILESYSTEM_PATCH', {
    riskLevel: 'R3'
  })), /malformed or inconsistently bound/);
  assert.throws(() => appendAdapterEvidence(record, evidence('FILESYSTEM_PATCH', {
    riskLevel: 'R3', approvalAuthorityFingerprint: 'f'.repeat(64)
  })), /malformed or inconsistently bound/);
});

test('conflicting R3 approval authority replay fails closed', () => {
  const record = r3PatchRecord();
  const matching = r3Evidence(record);
  const next = appendAdapterEvidence(record, matching);
  assert.throws(() => appendAdapterEvidence(next, evidence('FILESYSTEM_PATCH', {
    evidenceId: 'FILESYSTEM_PATCH-2', riskLevel: 'R3',
    approvalAuthorityFingerprint: 'f'.repeat(64)
  })), /malformed or inconsistently bound/);
});

test('filesystem-patch exact target binding is required', () => {
  assert.throws(() => appendAdapterEvidence(patchRecord(), evidence('FILESYSTEM_PATCH', {
    target: { requested: 'other.js', canonical: `${WORKSPACE}/other.js` }
  })), /malformed or inconsistently bound/);
});

test('filesystem-patch BEFORE and replacement hashes are validated', () => {
  for (const override of [{ beforeSha256: 'bad' }, { replacementSha256: 'bad' }]) {
    assert.throws(() => appendAdapterEvidence(patchRecord(), evidence('FILESYSTEM_PATCH', override)),
      /malformed or inconsistently bound/);
  }
});

test('filesystem-patch AFTER hash must equal the authorized replacement on success', () => {
  assert.throws(() => appendAdapterEvidence(patchRecord(), evidence('FILESYSTEM_PATCH', {
    afterSha256: 'e'.repeat(64)
  })), /AFTER or recovery/);
});

test('same filesystem-patch replacement replay is deterministic', () => {
  const item = evidence('FILESYSTEM_PATCH');
  const next = appendAdapterEvidence(patchRecord(), item);
  assert.strictEqual(appendAdapterEvidence(next, item), next);
  assert.strictEqual(appendAdapterEvidence(next, evidence('FILESYSTEM_PATCH', {
    evidenceId: 'FILESYSTEM_PATCH-replay', timestamp: '2026-08-20T12:00:01.000Z'
  })), next);
});

test('different filesystem-patch replacement hash is a conflicting replay', () => {
  const next = appendAdapterEvidence(patchRecord(), evidence('FILESYSTEM_PATCH'));
  const replacementSha256 = 'e'.repeat(64);
  const payload = frozen({
    ...evidence('FILESYSTEM_PATCH').payload,
    afterSha256: replacementSha256
  });
  assert.throws(() => appendAdapterEvidence(next, evidence('FILESYSTEM_PATCH', {
    evidenceId: 'FILESYSTEM_PATCH-2', replacementSha256,
    afterSha256: replacementSha256, payload
  })), /replacement replay/);
});

test('stale filesystem-patch BEFORE evidence fails closed', () => {
  const next = appendAdapterEvidence(patchRecord(), evidence('FILESYSTEM_PATCH'));
  const beforeSha256 = 'e'.repeat(64);
  const payload = frozen({ ...evidence('FILESYSTEM_PATCH').payload, beforeSha256 });
  assert.throws(() => appendAdapterEvidence(next, evidence('FILESYSTEM_PATCH', {
    evidenceId: 'FILESYSTEM_PATCH-2', beforeSha256, payload
  })), /BEFORE evidence/);
});

test('malformed filesystem-patch recovery evidence fails closed', () => {
  assert.throws(() => appendAdapterEvidence(patchRecord(), evidence('FILESYSTEM_PATCH', {
    recovery: 'BEST_EFFORT'
  })), /inconsistently bound/);
});

function failedPatch(recovery) {
  const base = evidence('FILESYSTEM_PATCH');
  return evidence('FILESYSTEM_PATCH', {
    outcome: 'FAILED', afterSha256: null, recovery,
    payload: frozen({ ...base.payload, outcome: 'FAILED', recovery })
  });
}

test('verification failure and compensating restore remain explicit failure evidence', () => {
  const next = appendAdapterEvidence(patchRecord(), failedPatch('RESTORED'));
  assert.equal(next.adapterEvidence[0].outcome, 'FAILED');
  assert.equal(next.adapterEvidence[0].recovery, 'RESTORED');
  assert.throws(() => finalizeOperationRecord(next, finalState()), /inconsistent/);
});

test('unprovable recovery remains explicit failure evidence', () => {
  const next = appendAdapterEvidence(
    patchRecord(), failedPatch('NOT_ATTEMPTED_UNPROVEN_OWNERSHIP')
  );
  assert.equal(next.adapterEvidence[0].outcome, 'FAILED');
  assert.equal(finalizeOperationRecord(next, finalState({
    lifecycleState: 'FAILED', outcome: 'FAILED', successfulCompletionEligible: false
  })).finalization.outcome, 'FAILED');
});

test('filesystem-patch append after finalization is denied', () => {
  const next = appendAdapterEvidence(patchRecord(), evidence('FILESYSTEM_PATCH'));
  const completed = finalizeOperationRecord(next, finalState());
  assert.throws(() => appendAdapterEvidence(completed, evidence('FILESYSTEM_PATCH')),
    /after finalization/);
});

test('discovery and inspection cannot masquerade as controlled evidence', () => {
  for (const adapterType of ['DISCOVERY', 'DECLARATIVE_INSPECTION']) {
    assert.throws(() => appendAdapterEvidence(record(), evidence(adapterType)), /Unknown or forbidden/);
  }
});
