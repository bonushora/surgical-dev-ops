'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { evaluateCapabilityGrant } = require('../../accelerator/core/capability-grant');
const { evaluateR3ApprovalAuthority } = require('../../accelerator/core/risk-classification');
const { evaluateVerifiedHumanIdentityAssertion } = require('../../accelerator/core/human-identity-assertion');
const { verifyHumanIdentityAssertion } = require('../../accelerator/adapters/identity-verification-adapter');

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-capability-'));
fs.writeFileSync(path.join(workspace, 'target.txt'), 'read-only\n');
test.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

function request(overrides = {}) {
  return {
    operationId: 'op-1', workspace, policyDecision: 'ALLOWED', riskLevel: 'R0',
    lifecycleState: 'PENDING', capabilityType: 'FILESYSTEM_READ',
    scope: { paths: ['target.txt'] }, expiresAt: '2026-08-20T13:00:00.000Z',
    idempotency: 'IDEMPOTENT', ...overrides
  };
}

function authority(overrides = {}) {
  return {
    operationId: 'op-1', workspace, policyDecision: 'ALLOWED', riskLevel: 'R0',
    lifecycleState: 'PENDING', capabilityType: 'FILESYSTEM_READ',
    scope: { paths: ['target.txt'] }, evaluatedAt: '2026-08-20T12:00:00.000Z',
    idempotency: 'IDEMPOTENT', ...overrides
  };
}

function r3Approval(overrides = {}) {
  const verifiedIdentityAssertion = evaluateVerifiedHumanIdentityAssertion({
    schema: 'sdo.verified_human_identity_assertion.v1', verification: 'VERIFIED',
    assertionId: 'assertion-1', subject: { id: 'human-1', type: 'HUMAN' }, issuer: 'issuer:test',
    authentication: { method: 'PASSKEY', context: 'MFA' },
    issuedAt: '2026-08-20T11:55:00.000Z', expiresAt: '2026-08-20T13:00:00.000Z',
    audience: ['surgical-devops'], operationId: 'op-1', workspace,
    tenantId: 'tenant-1', projectId: 'project-1', revocationStatus: 'NOT_REVOKED',
    verifiedAt: '2026-08-20T11:59:00.000Z'
  }).assertion;
  return evaluateR3ApprovalAuthority({ approvalAuthorityId: 'approval-1', operationId: 'op-1',
    approver: { id: 'human-1', type: 'HUMAN' }, decision: 'APPROVED', riskLevel: 'R3',
    capabilityType: 'FILESYSTEM_PATCH', action: 'PATCH_FILE', workspace,
    tenantId: 'tenant-1', projectId: 'project-1', verifiedIdentityAssertion,
    scope: { target: { path: 'target.txt',
      beforeSha256: crypto.createHash('sha256').update('read-only\n').digest('hex'),
      replacementSha256: crypto.createHash('sha256').update('after\n').digest('hex') } },
    policyDecision: 'APPROVAL_REQUIRED', timestamp: '2026-08-20T12:00:00.000Z',
    expiresAt: '2026-08-20T13:00:00.000Z', ...overrides }).authority;
}

function identityVerification(approvalAuthority = r3Approval()) {
  return verifyHumanIdentityAssertion({ rawAssertion: { token: 'test' },
    trustedIssuers: ['issuer:test'], expected: {
      subjectId: 'human-1', audience: 'surgical-devops', operationId: 'op-1', workspace,
      tenantId: 'tenant-1', projectId: 'project-1', observedAt: '2026-08-20T12:00:00.000Z'
    } }, { verify() { return { status: 'VERIFIED',
    assertion: approvalAuthority.verifiedIdentityAssertion, verifierId: 'test-port' }; } });
}

function r3Grant(overrides = {}, authorityOverrides = {}) {
  const approvalAuthority = r3Approval();
  const verifiedIdentity = identityVerification(approvalAuthority);
  const scope = approvalAuthority.scope;
  return evaluateCapabilityGrant(request({ policyDecision: 'APPROVAL_REQUIRED', riskLevel: 'R3',
    capabilityType: 'FILESYSTEM_PATCH', scope, approvalAuthority,
    identityVerification: verifiedIdentity,
    tenantId: 'tenant-1', projectId: 'project-1', ...overrides }),
  authority({ policyDecision: 'APPROVAL_REQUIRED', riskLevel: 'R3', capabilityType: 'FILESYSTEM_PATCH',
    scope, approvalAuthority, identityVerification: verifiedIdentity,
    tenantId: 'tenant-1', projectId: 'project-1', ...authorityOverrides }));
}

test('default deny without authoritative policy', () => {
  assert.equal(evaluateCapabilityGrant(request()).decision, 'DENIED');
});

test('valid bounded filesystem-read grant is allowed', () => {
  assert.equal(evaluateCapabilityGrant(request(), authority()).decision, 'ALLOWED');
});

test('valid bounded Git-read grant is allowed', () => {
  const capabilityType = 'GIT_READ';
  const scope = { operations: ['status', 'diff'] };
  assert.equal(evaluateCapabilityGrant(
    request({ capabilityType, scope }), authority({ capabilityType, scope })
  ).decision, 'ALLOWED');
});

test('valid bounded process-validation grant is allowed', () => {
  const capabilityType = 'PROCESS_VALIDATION';
  const scope = { selectors: ['NODE_SYNTAX_CHECK'], paths: ['target.txt'] };
  assert.equal(evaluateCapabilityGrant(
    request({ capabilityType, scope }), authority({ capabilityType, scope })
  ).decision, 'ALLOWED');
});

test('R1 and R2 single-file patch grants are denied', () => {
  const capabilityType = 'FILESYSTEM_PATCH';
  const scope = { target: {
    path: 'target.txt',
    beforeSha256: crypto.createHash('sha256').update('read-only\n').digest('hex'),
    replacementSha256: crypto.createHash('sha256').update('after\n').digest('hex')
  } };
  const result = evaluateCapabilityGrant(
    request({ capabilityType, riskLevel: 'R1', scope }),
    authority({ capabilityType, riskLevel: 'R1', scope })
  );
  assert.equal(result.decision, 'DENIED');
  assert.equal(evaluateCapabilityGrant(
    request({ capabilityType, riskLevel: 'R2', scope }),
    authority({ capabilityType, riskLevel: 'R2', scope })
  ).decision, 'DENIED');
});

test('valid R3 patch grant binds human approval authority', () => {
  const result = r3Grant();
  assert.equal(result.decision, 'ALLOWED');
  assert.equal(result.grant.approvalAuthorityFingerprint, r3Approval().fingerprint);
  assert.equal(result.grant.verifiedIdentityAssertionFingerprint,
    r3Approval().verifiedIdentityAssertionFingerprint);
  assert.equal(result.grant.identityVerificationEvidenceFingerprint,
    identityVerification().evidence.fingerprint);
});

test('R3 grant rejects verified identity or tenant substitution', () => {
  assert.equal(r3Grant({ approvalAuthority: { ...r3Approval(),
    verifiedIdentityAssertionFingerprint: 'f'.repeat(64) } }).decision, 'DENIED');
  assert.equal(r3Grant({ tenantId: 'other' }).decision, 'DENIED');
  assert.equal(r3Grant({ projectId: 'other' }).decision, 'DENIED');
  assert.equal(r3Grant({ identityVerification: undefined }).decision, 'DENIED');
});

test('R3 patch grant denies missing or mismatched authority', () => {
  assert.equal(r3Grant({ approvalAuthority: undefined }).decision, 'DENIED');
  assert.equal(r3Grant({ operationId: 'other' }).decision, 'DENIED');
  assert.equal(r3Grant({ workspace: os.tmpdir() }).decision, 'DENIED');
  assert.equal(r3Grant({ scope: { target: { path: 'other.txt', beforeSha256: 'a'.repeat(64) } } }).decision, 'DENIED');
  assert.equal(r3Grant({ approvalAuthority: { ...r3Approval(), fingerprint: 'f'.repeat(64) } }).decision, 'DENIED');
});

test('R3 patch grant denies action, capability and expired authority mismatch', () => {
  assert.equal(r3Grant({ capabilityType: 'FILESYSTEM_READ' }).decision, 'DENIED');
  assert.equal(r3Grant({ approvalAuthority: { ...r3Approval(), action: 'READ_FILE' } }).decision, 'DENIED');
  assert.equal(r3Grant({}, { evaluatedAt: '2026-08-20T13:00:00.000Z' }).decision, 'DENIED');
});

test('filesystem patch scope cannot be broadened or made ambiguous', () => {
  const capabilityType = 'FILESYSTEM_PATCH';
  const target = { path: 'target.txt', beforeSha256: 'a'.repeat(64) };
  assert.equal(evaluateCapabilityGrant(
    request({ capabilityType, riskLevel: 'R1', scope: { target, paths: ['other.txt'] } }),
    authority({ capabilityType, riskLevel: 'R1', scope: { target } })
  ).decision, 'DENIED');
  assert.equal(evaluateCapabilityGrant(
    request({ capabilityType, riskLevel: 'R1', scope: { target: { ...target, path: 'other.txt' } } }),
    authority({ capabilityType, riskLevel: 'R1', scope: { target } })
  ).decision, 'DENIED');
});

test('filesystem patch cannot use read-only R0 risk', () => {
  const capabilityType = 'FILESYSTEM_PATCH';
  const scope = { target: { path: 'target.txt', beforeSha256: 'a'.repeat(64) } };
  assert.equal(evaluateCapabilityGrant(
    request({ capabilityType, scope }), authority({ capabilityType, scope })
  ).decision, 'DENIED');
});

test('unknown process-validation selector is denied', () => {
  const capabilityType = 'PROCESS_VALIDATION';
  const scope = { selectors: ['PACKAGE_TEST'], paths: ['target.txt'] };
  assert.equal(evaluateCapabilityGrant(
    request({ capabilityType, scope }), authority({ capabilityType, scope })
  ).decision, 'DENIED');
});

test('missing policy is denied', () => {
  assert.equal(evaluateCapabilityGrant(request({ policyDecision: undefined }), authority()).decision, 'DENIED');
});

test('denied policy is denied', () => {
  assert.equal(evaluateCapabilityGrant(
    request({ policyDecision: 'DENIED' }), authority({ policyDecision: 'DENIED' })
  ).decision, 'DENIED');
});

test('wrong operationId is denied', () => {
  assert.equal(evaluateCapabilityGrant(request({ operationId: 'op-2' }), authority()).decision, 'DENIED');
});

test('wrong workspace is denied', () => {
  assert.equal(evaluateCapabilityGrant(request({ workspace: os.tmpdir() }), authority()).decision, 'DENIED');
});

test('expired grant is denied', () => {
  assert.equal(evaluateCapabilityGrant(
    request({ expiresAt: '2026-08-20T12:00:00.000Z' }), authority()
  ).decision, 'DENIED');
});

test('invalid lifecycle state is denied', () => {
  assert.equal(evaluateCapabilityGrant(
    request({ lifecycleState: 'COMPLETED' }), authority({ lifecycleState: 'COMPLETED' })
  ).decision, 'DENIED');
});

test('missing or ambiguous scope is denied', () => {
  assert.equal(evaluateCapabilityGrant(request({ scope: undefined }), authority()).decision, 'DENIED');
  assert.equal(evaluateCapabilityGrant(request({ scope: { paths: [] } }), authority()).decision, 'DENIED');
});

test('scope broadening attempt is denied', () => {
  fs.writeFileSync(path.join(workspace, 'other.txt'), 'other\n');
  assert.equal(evaluateCapabilityGrant(
    request({ scope: { paths: ['target.txt', 'other.txt'] } }), authority()
  ).decision, 'DENIED');
});

function assertCapabilityDenied(capabilityType) {
  assert.equal(evaluateCapabilityGrant(
    request({ capabilityType }), authority({ capabilityType })
  ).decision, 'DENIED');
}

test('filesystem write capability is always denied', () => {
  assertCapabilityDenied('FILESYSTEM_WRITE');
});

test('Git mutation capability is always denied', () => {
  assertCapabilityDenied('GIT_WRITE');
});

test('process or shell capability is always denied', () => {
  assertCapabilityDenied('PROCESS_EXECUTE');
});

test('network capability is always denied', () => {
  assertCapabilityDenied('NETWORK_ACCESS');
});

test('credential capability is always denied', () => {
  assertCapabilityDenied('CREDENTIAL_ACCESS');
});

test('service mutation capability is always denied', () => {
  assertCapabilityDenied('SERVICE_MUTATION');
});

test('remote repository mutation capability is always denied', () => {
  assertCapabilityDenied('REMOTE_REPOSITORY_MUTATION');
});

test('allowed grant and nested scope are immutable', () => {
  const result = evaluateCapabilityGrant(request(), authority());
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.grant));
  assert.ok(Object.isFrozen(result.grant.scope));
  assert.ok(Object.isFrozen(result.grant.scope.paths));
  assert.throws(() => { result.grant.capabilityType = 'FILESYSTEM_WRITE'; }, TypeError);
});
