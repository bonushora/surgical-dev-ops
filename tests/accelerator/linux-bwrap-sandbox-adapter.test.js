'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const childProcess = require('node:child_process');
const {
  createMachineAccessRequest,
  createMachineAccessAuthority,
  createMachineAccessOperation
} = require('../../accelerator/core/machine-access-contract');
const { createSandboxRequirement, createSandboxEvidence } =
  require('../../accelerator/core/sandbox-evidence-contract');
const { attestLinuxBwrapSandbox } =
  require('../../accelerator/adapters/linux-bwrap-sandbox-adapter');

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
    requestId: 'bwrap-request', operationId: 'bwrap-operation', workspace: process.cwd(),
    operationType: 'READ_FILE', target: 'package.json', purpose: 'Qualify containment.',
    requestedAt: NOW
  });
  const grantEvaluation = freeze({
    schema: 'sdo.capability_grant_evaluation.v1', decision: 'ALLOWED',
    grant: {
      operationId: request.operationId, workspace: request.workspace,
      capabilityType: request.capabilityType, action: request.action,
      riskLevel: request.riskLevel, policyDecision: 'ALLOWED', lifecycleState: 'PENDING',
      fingerprint: 'a'.repeat(64)
    }
  });
  const authority = createMachineAccessAuthority({
    authorityId: 'bwrap-authority', request, grantEvaluation,
    issuedAt: NOW, expiresAt: EXPIRES
  });
  return createMachineAccessOperation({ request, authority });
}

test('Linux Bubblewrap emits contract-consumable native evidence', {
  skip: process.platform !== 'linux' || !fs.existsSync('/usr/bin/bwrap')
}, () => {
  const requirement = createSandboxRequirement({
    requirementId: 'bwrap-requirement', operation: operation(), platform: 'linux', requiredAt: NOW
  });
  const adapterEvidence = attestLinuxBwrapSandbox({ requirement, observedAt: OBSERVED,
    expiresAt: EXPIRES });
  const evidence = createSandboxEvidence({ requirement, adapterEvidence, observedAt: OBSERVED });
  assert.equal(evidence.sandboxKind, 'linux-bubblewrap-user-namespace');
  assert.equal(evidence.controls.networkDenied, true);
  assert.equal(evidence.controls.workspaceReadOnly, true);
  assert.equal(Object.isFrozen(evidence), true);
  assert.equal(fs.existsSync('.sdo-sandbox-adapter-probe'), false);
});

test('adapter rejects malformed requirement and invalid evidence lifetime', () => {
  assert.throws(() => attestLinuxBwrapSandbox({
    requirement: {}, observedAt: OBSERVED, expiresAt: EXPIRES
  }), /Immutable Linux|unavailable/);
  if (process.platform === 'linux' && fs.existsSync('/usr/bin/bwrap')) {
    const requirement = createSandboxRequirement({
      requirementId: 'bwrap-requirement', operation: operation(), platform: 'linux', requiredAt: NOW
    });
    assert.throws(() => attestLinuxBwrapSandbox({
      requirement, observedAt: OBSERVED, expiresAt: OBSERVED
    }), /expiry/);
  }
});

test('adapter fails closed without the qualified network namespace launcher', {
  skip: process.platform !== 'linux'
}, (context) => {
  const originalExists = fs.existsSync.bind(fs);
  context.mock.method(fs, 'existsSync', (candidate) =>
    candidate === '/usr/bin/unshare' ? false : originalExists(candidate));
  const requirement = createSandboxRequirement({
    requirementId: 'bwrap-requirement', operation: operation(), platform: 'linux', requiredAt: NOW
  });
  assert.throws(() => attestLinuxBwrapSandbox({
    requirement, observedAt: OBSERVED, expiresAt: EXPIRES
  }), /network namespace launcher is unavailable/);
});

test('network namespace initialization failure blocks the operation', {
  skip: process.platform !== 'linux' || !fs.existsSync('/usr/bin/bwrap')
}, (context) => {
  context.mock.method(childProcess, 'spawnSync', () => ({
    status: 1, signal: null, stdout: '', stderr: 'namespace initialization denied\n'
  }));
  const requirement = createSandboxRequirement({
    requirementId: 'bwrap-requirement', operation: operation(), platform: 'linux', requiredAt: NOW
  });
  assert.throws(() => attestLinuxBwrapSandbox({
    requirement, observedAt: OBSERVED, expiresAt: EXPIRES
  }), /attestation failed closed/);
});

test('adapter fixes executable arguments environment and disables shell', () => {
  const source = fs.readFileSync(
    require.resolve('../../accelerator/adapters/linux-bwrap-sandbox-adapter'), 'utf8'
  );
  assert.match(source, /const BWRAP = '\/usr\/bin\/bwrap'/);
  assert.match(source, /const NETWORK_NAMESPACE_LAUNCHER = '\/usr\/bin\/unshare'/);
  assert.match(source, /shell: false/);
  assert.match(source, /'--user', '--map-current-user', '--net', '--', BWRAP/);
  assert.doesNotMatch(source, /--unshare-net/);
  assert.match(source, /--ro-bind/);
  assert.match(source, /--permission/);
  assert.match(source, /--test-isolation=none/);
  assert.match(source, /executeLinuxBwrapNodeTest/);
  assert.doesNotMatch(source, /execSync|https?|node:net|FILESYSTEM_PATCH|writeFileSync/);
});
