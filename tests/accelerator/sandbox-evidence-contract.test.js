'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  createMachineAccessRequest,
  createMachineAccessAuthority,
  createMachineAccessOperation
} = require('../../accelerator/core/machine-access-contract');
const {
  createSandboxRequirement,
  createSandboxEvidence
} = require('../../accelerator/core/sandbox-evidence-contract');

const NOW = '2099-01-01T00:00:00.000Z';
const OBSERVED = '2099-01-01T00:01:00.000Z';
const EXPIRES = '2099-01-01T00:05:00.000Z';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function operation() {
  const request = createMachineAccessRequest({
    requestId: 'sandbox-request', operationId: 'sandbox-operation',
    workspace: process.cwd(), operationType: 'READ_FILE', target: 'package.json',
    purpose: 'Read within qualified containment.', requestedAt: NOW
  });
  const grant = freeze({
    operationId: request.operationId, workspace: request.workspace,
    capabilityType: request.capabilityType, action: request.action,
    riskLevel: request.riskLevel, policyDecision: 'ALLOWED',
    lifecycleState: 'PENDING', fingerprint: 'a'.repeat(64)
  });
  const grantEvaluation = freeze({
    schema: 'sdo.capability_grant_evaluation.v1', decision: 'ALLOWED', grant
  });
  const authority = createMachineAccessAuthority({
    authorityId: 'sandbox-authority', request, grantEvaluation,
    issuedAt: NOW, expiresAt: EXPIRES
  });
  return createMachineAccessOperation({ request, authority });
}

function requirement(platform = 'linux') {
  return createSandboxRequirement({
    requirementId: 'sandbox-requirement', operation: operation(), platform, requiredAt: NOW
  });
}

function adapterEvidence(bound, overrides = {}) {
  return freeze({
    schema: 'sdo.sandbox_adapter_evidence.v1', decision: 'ENFORCED',
    sandboxKind: 'qualified-test-isolation', adapterId: 'sandbox-test-adapter',
    operationId: bound.operationId, workspace: bound.workspace,
    platform: bound.platform, requirementFingerprint: bound.fingerprint,
    controls: {
      workspaceReadOnly: true, workspaceBound: true, networkDenied: true,
      genericProcessDenied: true, secretAccessDenied: true
    },
    observedAt: OBSERVED, expiresAt: EXPIRES, ...overrides
  });
}

test('sandbox requirement is deterministic operation-bound and immutable', () => {
  assert.deepEqual(requirement(), requirement());
  assert.equal(Object.isFrozen(requirement()), true);
  assert.match(requirement().fingerprint, /^[a-f0-9]{64}$/);
});

test('sandbox requirement supports only qualified target platforms', () => {
  for (const platform of ['linux', 'darwin', 'win32']) {
    assert.equal(requirement(platform).platform, platform);
  }
  assert.throws(() => requirement('freebsd'), /unsupported/);
});

test('enforced adapter evidence produces bound immutable SandboxEvidence', () => {
  const bound = requirement();
  const evidence = createSandboxEvidence({
    requirement: bound, adapterEvidence: adapterEvidence(bound), observedAt: OBSERVED
  });
  assert.equal(evidence.operationFingerprint, bound.operationFingerprint);
  assert.equal(evidence.requirementFingerprint, bound.fingerprint);
  assert.equal(Object.isFrozen(evidence), true);
});

test('missing mutable denied substituted or stale adapter evidence fails closed', () => {
  const bound = requirement();
  assert.throws(() => createSandboxEvidence({
    requirement: bound, adapterEvidence: null, observedAt: OBSERVED
  }), /shape/);
  assert.throws(() => createSandboxEvidence({
    requirement: bound, adapterEvidence: { ...adapterEvidence(bound) }, observedAt: OBSERVED
  }), /Immutable|binding|frozen|mismatch/i);
  assert.throws(() => createSandboxEvidence({
    requirement: bound,
    adapterEvidence: adapterEvidence(bound, { decision: 'DENIED' }), observedAt: OBSERVED
  }), /binding mismatch/);
  assert.throws(() => createSandboxEvidence({
    requirement: bound,
    adapterEvidence: adapterEvidence(bound, { operationId: 'substituted' }), observedAt: OBSERVED
  }), /binding mismatch/);
  assert.throws(() => createSandboxEvidence({
    requirement: bound,
    adapterEvidence: adapterEvidence(bound, { expiresAt: OBSERVED }), observedAt: OBSERVED
  }), /stale/);
});

test('every required containment control must be enforced', () => {
  const bound = requirement();
  const controls = { ...adapterEvidence(bound).controls, networkDenied: false };
  assert.throws(() => createSandboxEvidence({
    requirement: bound,
    adapterEvidence: adapterEvidence(bound, { controls }), observedAt: OBSERVED
  }), /not enforced/);
});

test('contract source has no detection shell network provider or mutation authority', () => {
  const source = fs.readFileSync(
    require.resolve('../../accelerator/core/sandbox-evidence-contract'), 'utf8'
  );
  assert.doesNotMatch(source, /child_process|spawn|execSync|https?|node:net|Codex|Ollama|writeFile|unlink|rename/);
});
