'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  evaluateVerifiedHumanIdentityAssertion,
  reconcileVerifiedHumanIdentityAssertion
} = require('../../accelerator/core/human-identity-assertion');
const { createAuthoritativeClock } = require('../../accelerator/core/authoritative-clock');

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-identity-'));
test.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

function assertion(overrides = {}) {
  return {
    schema: 'sdo.verified_human_identity_assertion.v1', verification: 'VERIFIED',
    assertionId: 'assertion-1', subject: { id: 'human-1', type: 'HUMAN' },
    issuer: 'https://trusted.example',
    authentication: { method: 'PUBLIC_KEY', context: 'MFA' },
    issuedAt: '2026-08-20T11:55:00.000Z', expiresAt: '2026-08-20T13:00:00.000Z',
    audience: ['surgical-devops'], operationId: 'op-1', workspace,
    tenantId: 'tenant-1', projectId: 'project-1', revocationStatus: 'NOT_REVOKED',
    verifiedAt: '2026-08-20T11:59:00.000Z', ...overrides
  };
}

function expected(overrides = {}) {
  return { subjectId: 'human-1', issuer: 'https://trusted.example', audience: 'surgical-devops',
    operationId: 'op-1', workspace, tenantId: 'tenant-1', projectId: 'project-1', ...overrides };
}

function temporal(wallTime = '2026-08-20T12:00:00.000Z') {
  const clock = createAuthoritativeClock({ port: { read: () => ({
    schema: 'sdo.system_clock_observation.v1', availability: 'AVAILABLE', source: 'TEST',
    wallTime, monotonicNanoseconds: '1000000000'
  }) } });
  return { reading: clock.read(), requireCurrent: true };
}

test('valid assertion is normalized, fingerprinted and deeply immutable', () => {
  const result = evaluateVerifiedHumanIdentityAssertion(assertion(), expected(), temporal());
  assert.equal(result.decision, 'VERIFIED');
  assert.match(result.assertion.fingerprint, /^[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(result.assertion));
  assert.ok(Object.isFrozen(result.assertion.subject));
});

test('malformed and unverified assertions fail closed', () => {
  assert.equal(evaluateVerifiedHumanIdentityAssertion({ approved: true }, expected()).decision, 'DENIED');
  assert.equal(evaluateVerifiedHumanIdentityAssertion(assertion({ verification: 'CLAIMED' }), expected()).decision, 'DENIED');
});

test('expired assertion fails closed', () => {
  assert.equal(evaluateVerifiedHumanIdentityAssertion(assertion(), expected(),
    temporal('2026-08-20T13:00:00.000Z')).decision, 'DENIED');
});

test('wrong audience and operation fail closed', () => {
  assert.equal(evaluateVerifiedHumanIdentityAssertion(assertion(), expected({ audience: 'other' })).decision, 'DENIED');
  assert.equal(evaluateVerifiedHumanIdentityAssertion(assertion(), expected({ operationId: 'op-2' })).decision, 'DENIED');
});

test('wrong tenant or project fails closed', () => {
  assert.equal(evaluateVerifiedHumanIdentityAssertion(assertion(), expected({ tenantId: 'other' })).decision, 'DENIED');
  assert.equal(evaluateVerifiedHumanIdentityAssertion(assertion(), expected({ projectId: 'other' })).decision, 'DENIED');
});

test('caller-supplied arbitrary assertion fingerprint is rejected', () => {
  assert.equal(evaluateVerifiedHumanIdentityAssertion(assertion({ fingerprint: 'f'.repeat(64) }), expected()).decision, 'DENIED');
});

test('identical assertion replay is deterministic', () => {
  const first = evaluateVerifiedHumanIdentityAssertion(assertion(), expected()).assertion;
  assert.deepEqual(reconcileVerifiedHumanIdentityAssertion(first, assertion(), expected()), first);
});

test('conflicting assertion replay fails closed', () => {
  const first = evaluateVerifiedHumanIdentityAssertion(assertion(), expected()).assertion;
  assert.throws(() => reconcileVerifiedHumanIdentityAssertion(first,
    assertion({ authentication: { method: 'PASSKEY', context: 'MFA' } }), expected()),
  /Conflicting/);
});
