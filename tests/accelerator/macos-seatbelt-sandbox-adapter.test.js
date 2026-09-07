'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  createMachineAccessRequest,
  createMachineAccessAuthority,
  createMachineAccessOperation
} = require('../../accelerator/core/machine-access-contract');
const { createSandboxRequirement, createSandboxEvidence } =
  require('../../accelerator/core/sandbox-evidence-contract');
const {
  attestMacosSeatbeltSandbox,
  executeMacosSeatbeltNodeTest,
  createProfile,
  createNodeTestProfile
} =
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

function operation({
  workspace = process.cwd(),
  operationType = 'READ_FILE',
  target = 'package.json'
} = {}) {
  const request = createMachineAccessRequest({
    requestId: 'seatbelt-request', operationId: 'seatbelt-operation', workspace,
    operationType, target, purpose: 'Qualify containment.',
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

test('macOS Seatbelt physically executes a Node test with adversarial effects denied', {
  skip: process.platform !== 'darwin'
}, (context) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-seatbelt-test-')));
  const workspace = path.join(root, 'workspace');
  fs.mkdirSync(workspace);
  const target = 'adversarial.test.js';
  const forbidden = path.join(root, 'outside-workspace');
  const source = [
    "'use strict';",
    "const test = require('node:test');",
    "const assert = require('node:assert/strict');",
    "const childProcess = require('node:child_process');",
    "const fs = require('node:fs');",
    "const net = require('node:net');",
    "const path = require('node:path');",
    `const forbidden = ${JSON.stringify(forbidden)};`,
    "test('Seatbelt and Node permissions enforce containment', async () => {",
    "  assert.match(fs.readFileSync(__filename, 'utf8'), /enforce containment/);",
    "  assert.equal(process.env.SDO_VALIDATION_SECRET_MARKER, undefined);",
    "  for (const candidate of [path.join(process.cwd(), 'write-denied'), forbidden]) {",
    "    assert.throws(() => fs.writeFileSync(candidate, 'denied'), /permission|access|denied/i);",
    "  }",
    "  let child;",
    "  try { child = childProcess.spawnSync(process.execPath, ['-e', 'process.exit(0)']); }",
    "  catch (error) { child = { error }; }",
    "  assert.ok(child.error || child.status !== 0);",
    "  const network = await new Promise((resolve) => {",
    "    const socket = net.createConnection({ host: '1.1.1.1', port: 53 });",
    "    const timer = setTimeout(() => { socket.destroy(); resolve('DENIED'); }, 500);",
    "    socket.once('connect', () => { clearTimeout(timer); socket.destroy(); resolve('CONNECTED'); });",
    "    socket.once('error', () => { clearTimeout(timer); resolve('DENIED'); });",
    "  });",
    "  assert.equal(network, 'DENIED');",
    "});",
    ''
  ].join('\n');
  fs.writeFileSync(path.join(workspace, target), source);
  context.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });
  const requirement = createSandboxRequirement({
    requirementId: 'seatbelt-node-test-requirement',
    operation: operation({ workspace, operationType: 'RUN_NODE_TEST', target }),
    platform: 'darwin',
    requiredAt: NOW
  });
  process.env.SDO_VALIDATION_SECRET_MARKER = 'parent-only-marker';
  let execution;
  try {
    execution = executeMacosSeatbeltNodeTest({
      requirement,
      target,
      observedAt: OBSERVED,
      expiresAt: EXPIRES,
      timeoutMs: 10000,
      maxOutputBytes: 128 * 1024
    });
  } finally {
    delete process.env.SDO_VALIDATION_SECRET_MARKER;
  }
  assert.equal(execution.result.error, undefined);
  assert.equal(execution.result.signal, null);
  assert.equal(execution.result.status, 0, execution.result.stderr);
  assert.equal(execution.adapterEvidence.requirementFingerprint, requirement.fingerprint);
  assert.equal(execution.adapterEvidence.controls.workspaceReadOnly, true);
  assert.equal(fs.existsSync(forbidden), false);
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
  const profile = createProfile('/qualified/workspace');
  assert.match(profile, /\(deny default\)/);
  assert.match(profile, /allow file-map-executable/);
  assert.match(profile, /qualified\/workspace/);
  assert.doesNotMatch(profile, /allow network|file-write|process-exec|\/Users/);
  const source = fs.readFileSync(
    require.resolve('../../accelerator/adapters/macos-seatbelt-sandbox-adapter'), 'utf8'
  );
  assert.match(source, /shell: false/);
  assert.match(source, /sdo-seatbelt-probe/);
  assert.match(source, /probe: 'bootstrap'/);
  assert.match(source, /'workspace-write'/);
  assert.match(source, /'workspace-boundary'/);
  assert.match(source, /'secret-read'/);
  assert.match(source, /'network'/);
  assert.match(source, /'generic-process'/);
  assert.match(source, /\['SIGABRT', 'SIGKILL', 'SIGSYS'\]/);
  const nodeProfile = createNodeTestProfile('/qualified/workspace', '/qualified/node');
  assert.match(nodeProfile, /allow process-exec \(literal "\/qualified\/node"\)/);
  assert.doesNotMatch(nodeProfile, /allow process-exec[^\n]*\/bin\/sh/);
  assert.match(source, /process\.execPath/);
  assert.match(source, /executeMacosSeatbeltNodeTest/);
  assert.match(source, /--permission/);
  assert.match(source, /--test-isolation=none/);
  assert.throws(() => createProfile('/unsafe\nworkspace'), /path literal is unsafe/);
  assert.doesNotMatch(source, /sandbox-exec/);
  assert.doesNotMatch(source, /execSync|https?|FILESYSTEM_PATCH|writeFileSync/);

  const probeSource = fs.readFileSync(
    require.resolve('../../accelerator/native/macos/sdo-seatbelt-probe.c'), 'utf8'
  );
  assert.match(probeSource, /workspace_write_is_denied/);
  assert.match(probeSource, /network_is_denied/);
  assert.match(probeSource, /generic_process_is_denied/);
  assert.match(probeSource, /read_is_denied\("\/etc\/passwd", false\)/);
  assert.match(probeSource, /strcmp\(argv\[5\], "bootstrap"\)/);
  assert.match(probeSource, /sandbox_init\(profile, 0, &error\)/);
  assert.match(probeSource, /execve\(node, arguments, environ\)/);
  assert.match(probeSource, /safe_relative_target/);
  assert.doesNotMatch(probeSource, /system\(|popen\(|posix_spawn/);

  const buildSource = fs.readFileSync(
    require.resolve('../../accelerator/native/macos/build-helper.sh'), 'utf8'
  );
  assert.match(buildSource, /^\/usr\/bin\/clang/m);
  assert.match(buildSource, /-Wall/);
  assert.match(buildSource, /-Wextra/);
  assert.match(buildSource, /-Werror/);
  assert.match(buildSource, /-lsandbox/);
  assert.doesNotMatch(buildSource, /curl|wget|https?:|eval/);

  const workflow = fs.readFileSync(
    require.resolve('../../.github/workflows/accelerator-conformance.yml'), 'utf8'
  );
  assert.match(workflow, /Build qualified macOS native Seatbelt helper/);
  assert.match(workflow, /sh accelerator\/native\/macos\/build-helper\.sh/);
});
