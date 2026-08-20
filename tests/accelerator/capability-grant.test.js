'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { evaluateCapabilityGrant } = require('../../accelerator/core/capability-grant');

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

test('valid exact single-file patch grant is allowed', () => {
  const capabilityType = 'FILESYSTEM_PATCH';
  const scope = { target: {
    path: 'target.txt',
    beforeSha256: crypto.createHash('sha256').update('read-only\n').digest('hex')
  } };
  const result = evaluateCapabilityGrant(
    request({ capabilityType, riskLevel: 'R1', scope }),
    authority({ capabilityType, riskLevel: 'R1', scope })
  );
  assert.equal(result.decision, 'ALLOWED');
  assert.equal(result.grant.scope.target.canonicalPath, path.join(workspace, 'target.txt'));
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
