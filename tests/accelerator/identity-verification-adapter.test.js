'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  verifyHumanIdentityAssertion,
  validateIdentityVerificationResult
} = require('../../accelerator/adapters/identity-verification-adapter');
const { createAuthoritativeClock } = require('../../accelerator/core/authoritative-clock');

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-verifier-'));
test.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

function assertion(overrides = {}) {
  return { schema: 'sdo.verified_human_identity_assertion.v1', verification: 'VERIFIED',
    assertionId: 'assertion-1', subject: { id: 'human-1', type: 'HUMAN' },
    issuer: 'issuer:test', authentication: { method: 'PASSKEY', context: 'MFA' },
    issuedAt: '2026-08-20T11:55:00.000Z', expiresAt: '2026-08-20T13:00:00.000Z',
    audience: ['surgical-devops'], operationId: 'op-1', workspace,
    tenantId: 'tenant-1', projectId: 'project-1', revocationStatus: 'NOT_REVOKED',
    verifiedAt: '2026-08-20T11:59:00.000Z', ...overrides };
}

function request(overrides = {}) {
  return { rawAssertion: { compact: 'provider-neutral-token' }, trustedIssuers: ['issuer:test'],
    expected: { subjectId: 'human-1', audience: 'surgical-devops', operationId: 'op-1',
      workspace, tenantId: 'tenant-1', projectId: 'project-1' }, ...overrides };
}

function temporal(wallTime = '2026-08-20T12:00:00.000Z') {
  const clock = createAuthoritativeClock({ port: { read: () => ({
    schema: 'sdo.system_clock_observation.v1', availability: 'AVAILABLE', source: 'TEST',
    wallTime, monotonicNanoseconds: '1000000000'
  }) } });
  return { reading: clock.read(), requireCurrent: true };
}

function verifier(output = { status: 'VERIFIED', assertion: assertion(), verifierId: 'test-port' }) {
  return { verify() { return output; } };
}

test('explicitly trusted issuer succeeds with immutable evidence', () => {
  const result = verifyHumanIdentityAssertion(request(), verifier(), temporal());
  assert.equal(result.decision, 'VERIFIED');
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.assertion));
  assert.ok(Object.isFrozen(result.evidence));
  assert.strictEqual(validateIdentityVerificationResult(result, request().expected, temporal()), result);
});

test('verification evidence fingerprint substitution fails validation', () => {
  const result = verifyHumanIdentityAssertion(request(), verifier(), temporal());
  const substituted = Object.freeze({ ...result, evidence: Object.freeze({ ...result.evidence,
    fingerprint: 'f'.repeat(64) }) });
  assert.equal(validateIdentityVerificationResult(substituted, request().expected, temporal()), null);
});

test('untrusted issuer fails closed', () => {
  assert.equal(verifyHumanIdentityAssertion(request({ trustedIssuers: ['issuer:other'] }), verifier(), temporal()).decision, 'DENIED');
});

test('verifier exception and negative result fail closed', () => {
  assert.equal(verifyHumanIdentityAssertion(request(), { verify() { throw new Error('bad signature'); } }, temporal()).decision, 'DENIED');
  assert.equal(verifyHumanIdentityAssertion(request(), verifier({ status: 'DENIED' }), temporal()).decision, 'DENIED');
});

test('malformed verified output fails closed', () => {
  assert.equal(verifyHumanIdentityAssertion(request(), verifier({ status: 'VERIFIED', assertion: { approved: true } }), temporal()).decision, 'DENIED');
});

test('context mismatches and expiry fail closed', () => {
  assert.equal(verifyHumanIdentityAssertion(request({ expected: { ...request().expected, operationId: 'op-2' } }), verifier(), temporal()).decision, 'DENIED');
  assert.equal(verifyHumanIdentityAssertion(request({ expected: { ...request().expected, tenantId: 'other' } }), verifier(), temporal()).decision, 'DENIED');
  assert.equal(verifyHumanIdentityAssertion(request(), verifier(), temporal('2026-08-20T13:00:00.000Z')).decision, 'DENIED');
});

test('adapter has no hardcoded IdP and accepts a different explicitly trusted issuer', () => {
  const local = assertion({ issuer: 'local:offline-authority' });
  const result = verifyHumanIdentityAssertion(
    request({ trustedIssuers: ['local:offline-authority'] }), verifier({ status: 'VERIFIED', assertion: local }), temporal()
  );
  assert.equal(result.decision, 'VERIFIED');
  assert.equal(result.assertion.issuer, 'local:offline-authority');
});
