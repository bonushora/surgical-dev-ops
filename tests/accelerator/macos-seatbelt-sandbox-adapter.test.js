'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  createMachineAccessRequest,
  createMachineAccessAuthority,
  createMachineAccessOperation
} = require('../../accelerator/core/machine-access-contract');
const { createSandboxRequirement, createSandboxEvidence } =
  require('../../accelerator/core/sandbox-evidence-contract');
const { attestMacosSeatbeltSandbox, createProfile } =
  require('../../accelerator/adapters/macos-seatbelt-sandbox-adapter');

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
    requestId: 'seatbelt-request', operationId: 'seatbelt-operation', workspace: process.cwd(),
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
    authorityId: 'seatbelt-authority', request, grantEvaluation,
    issuedAt: NOW, expiresAt: EXPIRES
  });
  return createMachineAccessOperation({ request, authority });
}

test('macOS Seatbelt emits contract-consumable native evidence', {
  skip: process.platform !== 'darwin'
}, () => {
  const requirement = createSandboxRequirement({
    requirementId: 'seatbelt-requirement', operation: operation(),
    platform: 'darwin', requiredAt: NOW
  });
  const adapterEvidence = attestMacosSeatbeltSandbox({
    requirement, observedAt: OBSERVED, expiresAt: EXPIRES
  });
  const evidence = createSandboxEvidence({ requirement, adapterEvidence, observedAt: OBSERVED });
  assert.equal(evidence.sandboxKind, 'macos-seatbelt-deny-default');
  assert.equal(evidence.controls.networkDenied, true);
  assert.equal(evidence.controls.workspaceReadOnly, true);
  assert.equal(Object.isFrozen(evidence), true);
  assert.equal(fs.existsSync('.sdo-seatbelt-probe'), false);
});

test('macOS adapter rejects malformed requirement and invalid evidence lifetime', () => {
  assert.throws(() => attestMacosSeatbeltSandbox({
    requirement: {}, observedAt: OBSERVED, expiresAt: EXPIRES
  }), /Immutable macOS|unavailable/);
  if (process.platform === 'darwin') {
    const requirement = createSandboxRequirement({
      requirementId: 'seatbelt-requirement', operation: operation(),
      platform: 'darwin', requiredAt: NOW
    });
    assert.throws(() => attestMacosSeatbeltSandbox({
      requirement, observedAt: OBSERVED, expiresAt: OBSERVED
    }), /expiry/);
  }
});

test('Seatbelt profile is deny-default operation-bound and network-silent', () => {
  const profile = createProfile('/qualified/workspace', '/qualified/native-helper');
  assert.match(profile, /\(deny default\)/);
  assert.match(profile, /allow process-exec/);
  assert.match(profile, /allow file-map-executable/);
  assert.match(profile, /literal "\/qualified\/native-helper"/);
  assert.match(profile, /qualified\/workspace/);
  assert.doesNotMatch(profile, /allow network|file-write|\/Users/);
  const source = fs.readFileSync(
    require.resolve('../../accelerator/adapters/macos-seatbelt-sandbox-adapter'), 'utf8'
  );
  assert.match(source, /const SANDBOX_EXEC = '\/usr\/bin\/sandbox-exec'/);
  assert.match(source, /shell: false/);
  assert.match(source, /sdo-seatbelt-probe/);
  assert.match(source, /probe: 'bootstrap'/);
  assert.match(source, /'workspace-write'/);
  assert.match(source, /'workspace-boundary'/);
  assert.match(source, /'secret-read'/);
  assert.match(source, /'network'/);
  assert.match(source, /'generic-process'/);
  assert.match(source, /\['SIGABRT', 'SIGKILL', 'SIGSYS'\]/);
  assert.doesNotMatch(source, /process\.execPath|--jitless|dynamic-code-generation/);
  assert.doesNotMatch(source, /execSync|https?|FILESYSTEM_PATCH|writeFileSync/);

  const probeSource = fs.readFileSync(
    require.resolve('../../accelerator/native/macos/sdo-seatbelt-probe.c'), 'utf8'
  );
  assert.match(probeSource, /workspace_write_is_denied/);
  assert.match(probeSource, /network_is_denied/);
  assert.match(probeSource, /generic_process_is_denied/);
  assert.match(probeSource, /read_is_denied\("\/etc\/passwd", false\)/);
  assert.match(probeSource, /strcmp\(argv\[5\], "bootstrap"\)/);
  assert.doesNotMatch(probeSource, /system\(|popen\(|posix_spawn/);

  const buildSource = fs.readFileSync(
    require.resolve('../../accelerator/native/macos/build-helper.sh'), 'utf8'
  );
  assert.match(buildSource, /^\/usr\/bin\/clang/m);
  assert.match(buildSource, /-Wall/);
  assert.match(buildSource, /-Wextra/);
  assert.match(buildSource, /-Werror/);
  assert.doesNotMatch(buildSource, /curl|wget|https?:|eval/);

  const workflow = fs.readFileSync(
    require.resolve('../../.github/workflows/accelerator-conformance.yml'), 'utf8'
  );
  assert.match(workflow, /Build qualified macOS native Seatbelt helper/);
  assert.match(workflow, /sh accelerator\/native\/macos\/build-helper\.sh/);
});
