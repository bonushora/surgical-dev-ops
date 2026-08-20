'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { classifyScope, evaluateR3ApprovalAuthority } = require('../../accelerator/core/risk-classification');
const { evaluateVerifiedHumanIdentityAssertion } = require('../../accelerator/core/human-identity-assertion');

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-risk-'));
test.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

function approval(overrides = {}) {
  const verifiedIdentityAssertion = evaluateVerifiedHumanIdentityAssertion({
    schema: 'sdo.verified_human_identity_assertion.v1', verification: 'VERIFIED',
    assertionId: 'assertion-1', subject: { id: 'human-1', type: 'HUMAN' },
    issuer: 'issuer:test', authentication: { method: 'PASSKEY', context: 'MFA' },
    issuedAt: '2026-08-20T11:55:00.000Z', expiresAt: '2026-08-20T13:00:00.000Z',
    audience: ['surgical-devops'], operationId: 'op-r3', workspace,
    tenantId: 'tenant-1', projectId: 'project-1', revocationStatus: 'NOT_REVOKED',
    verifiedAt: '2026-08-20T11:59:00.000Z'
  }).assertion;
  return evaluateR3ApprovalAuthority({
    approvalAuthorityId: 'approval-1', operationId: 'op-r3',
    approver: { id: 'human-1', type: 'HUMAN' }, decision: 'APPROVED', riskLevel: 'R3',
    capabilityType: 'FILESYSTEM_PATCH', action: 'PATCH_FILE', workspace,
    tenantId: 'tenant-1', projectId: 'project-1', verifiedIdentityAssertion,
    scope: { target: { path: 'target.js', beforeSha256: 'a'.repeat(64) } },
    policyDecision: 'APPROVAL_REQUIRED', timestamp: '2026-08-20T12:00:00.000Z',
    expiresAt: '2026-08-20T13:00:00.000Z', ...overrides
  }).authority;
}

function r3Input(overrides = {}) {
  const scope = { target: { path: 'target.js', beforeSha256: 'a'.repeat(64) } };
  return input({ facts: { ...input().facts, critical: true }, operationId: 'op-r3', workspace,
    capabilityType: 'FILESYSTEM_PATCH', action: 'PATCH_FILE', scope,
    tenantId: 'tenant-1', projectId: 'project-1',
    observedAt: '2026-08-20T12:30:00.000Z',
    policy: { decision: 'APPROVAL_REQUIRED', approvalAuthority: approval() }, ...overrides });
}

function input(overrides = {}) {
  return {
    files: [{ path: 'target.js', lines: 20 }],
    mode: 'PATCH',
    estimatedDiffLines: 1,
    architecturalChange: false,
    worktreeClean: true,
    facts: {
      readOnly: false, externalEffect: false, reversible: true,
      sensitive: false, critical: false, irreversible: false
    },
    policy: { decision: 'ALLOW' },
    ...overrides
  };
}

test('classifies bounded observation as R0', () => {
  const result = classifyScope(input({
    mode: 'OBSERVE', estimatedDiffLines: 0,
    facts: { readOnly: true, externalEffect: false, reversible: false, sensitive: false, critical: false, irreversible: false }
  }));
  assert.equal(result.classification.level, 'R0');
  assert.equal(result.policy.decision, 'ALLOWED');
});

test('OBSERVE with mutating facts is denied', () => {
  const result = classifyScope(input({ mode: 'OBSERVE' }));
  assert.equal(result.policy.decision, 'DENIED');
  assert.equal(result.classification.executionAllowed, false);
});

test('caller risk cannot rescue contradictory mode and facts', () => {
  const result = classifyScope(input({ mode: 'OBSERVE', risk: 'R3' }));
  assert.equal(result.policy.decision, 'DENIED');
  assert.equal(result.classification.executionAllowed, false);
});

test('mutating mode with read-only facts is denied', () => {
  const facts = { readOnly: true, externalEffect: false, reversible: false, sensitive: false, critical: false, irreversible: false };
  assert.equal(classifyScope(input({ facts })).policy.decision, 'DENIED');
});

test('classifies reversible local patch as R1', () => {
  assert.equal(classifyScope(input()).classification.level, 'R1');
});

test('classifies sensitive operation as R2', () => {
  const facts = { ...input().facts, sensitive: true };
  assert.equal(classifyScope(input({ facts })).classification.level, 'R2');
});

test('classifies critical operation as R3', () => {
  const facts = { ...input().facts, critical: true };
  assert.equal(classifyScope(input({ facts })).classification.level, 'R3');
});

test('caller risk cannot downgrade computed risk', () => {
  const facts = { ...input().facts, sensitive: true };
  const result = classifyScope(input({ facts, risk: 'R0' }));
  assert.equal(result.classification.computedLevel, 'R2');
  assert.equal(result.classification.level, 'R2');
});

test('malformed, negative and NaN numeric inputs are denied', () => {
  for (const estimatedDiffLines of [-1, NaN, '1']) {
    assert.equal(classifyScope(input({ estimatedDiffLines })).policy.decision, 'DENIED');
  }
  assert.equal(classifyScope(input({ files: [{ path: 'x', lines: NaN }] })).policy.decision, 'DENIED');
});

test('missing, non-array and empty file scopes are denied', () => {
  for (const files of [undefined, 'target.js', []]) {
    assert.equal(classifyScope(input({ files })).policy.decision, 'DENIED');
  }
});

test('invalid mode is denied', () => {
  assert.equal(classifyScope(input({ mode: 'SHELL' })).policy.decision, 'DENIED');
});

test('missing required facts are denied', () => {
  assert.equal(classifyScope(input({ facts: undefined })).policy.decision, 'DENIED');
  const ambiguous = { ...input().facts, reversible: false };
  assert.equal(classifyScope(input({ facts: ambiguous })).policy.decision, 'DENIED');
});

test('missing or ambiguous policy is denied', () => {
  assert.equal(classifyScope(input({ policy: undefined })).policy.decision, 'DENIED');
  assert.equal(classifyScope(input({ policy: { decision: 'MAYBE' } })).policy.decision, 'DENIED');
});

test('R3 without approval requires approval and cannot execute', () => {
  const facts = { ...input().facts, critical: true };
  const result = classifyScope(input({ facts, policy: { decision: 'APPROVAL_REQUIRED' } }));
  assert.equal(result.policy.decision, 'DENIED');
  assert.equal(result.classification.executionAllowed, false);
});

test('R3 with valid explicit human approval is allowed by policy', () => {
  const result = classifyScope(r3Input());
  assert.equal(result.policy.decision, 'ALLOWED');
  assert.equal(result.classification.executionAllowed, true);
  assert.equal(result.policy.approvalAuthority.fingerprint, approval().fingerprint);
});

test('malformed or inexact R3 authority is denied', () => {
  assert.equal(classifyScope(r3Input({ policy: { decision: 'APPROVAL_REQUIRED', approvalAuthority: { approved: true } } })).policy.decision, 'DENIED');
  assert.equal(classifyScope(r3Input({ scope: { target: { path: 'other.js', beforeSha256: 'a'.repeat(64) } } })).policy.decision, 'DENIED');
});

test('unverified identity or approver substitution cannot authorize R3', () => {
  const valid = approval();
  assert.equal(classifyScope(r3Input({ policy: { decision: 'APPROVAL_REQUIRED',
    approvalAuthority: { ...valid, verifiedIdentityAssertion: { approved: true } } } })).policy.decision, 'DENIED');
  assert.equal(classifyScope(r3Input({ policy: { decision: 'APPROVAL_REQUIRED',
    approvalAuthority: { ...valid, approver: { id: 'agent-1', type: 'HUMAN' } } } })).policy.decision, 'DENIED');
});

test('approval authority cannot downgrade risk or rewrite policy', () => {
  assert.equal(classifyScope(r3Input({ risk: 'R0' })).classification.level, 'R3');
  assert.equal(classifyScope(r3Input({ policy: { decision: 'ALLOW', approvalAuthority: approval() } })).policy.decision, 'DENIED');
});
