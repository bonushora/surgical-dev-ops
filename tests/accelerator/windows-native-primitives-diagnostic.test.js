'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const {
  createWindowsNativeDurabilityBridge
} = require('../../accelerator/adapters/windows-native-durability-bridge');
const { executeWindowsNodeTest } =
  require('../../accelerator/adapters/windows-node-test-sandbox-adapter');
const {
  createMachineAccessRequest,
  createMachineAccessAuthority,
  createMachineAccessOperation
} = require('../../accelerator/core/machine-access-contract');
const { createSandboxRequirement } =
  require('../../accelerator/core/sandbox-evidence-contract');

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function outcome(run) {
  try {
    const value = run();
    return { ok: true, value: value === undefined ? null : value };
  } catch (error) {
    return {
      ok: false,
      code: error && error.code ? String(error.code) : null,
      message: error && error.message ? String(error.message) : String(error)
    };
  }
}

test('Windows native filesystem and Git primitives are observable without changing production semantics', (t) => {
  if (process.platform !== 'win32') {
    return t.skip('Windows-only native capability observation.');
  }

  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-win-native-probe-'));
  const file = path.join(base, 'probe.txt');
  fs.writeFileSync(file, 'probe\n');

  t.after(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  const fileFsync = outcome(() => {
    const fd = fs.openSync(file, fs.constants.O_RDWR);
    try {
      fs.fsyncSync(fd);
      return 'FSYNC_CONFIRMED';
    } finally {
      fs.closeSync(fd);
    }
  });

  const directoryFsync = outcome(() => {
    const fd = fs.openSync(base, fs.constants.O_RDONLY);
    try {
      fs.fsyncSync(fd);
      return 'DIRECTORY_FSYNC_CONFIRMED';
    } finally {
      fs.closeSync(fd);
    }
  });

  const gitRoot = outcome(() => childProcess.execFileSync(
    'git', ['rev-parse', '--show-toplevel'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }
  ).trim());

  const gitRootPhysical = gitRoot.ok
    ? outcome(() => fs.realpathSync(gitRoot.value))
    : { ok: false, code: 'NOT_ATTEMPTED', message: 'Git root unavailable.' };

  const nativeBridge = createWindowsNativeDurabilityBridge();
  const nativeDirectoryFlush = outcome(() => {
    if (!nativeBridge.available()) throw new Error('Windows native durability helper unavailable.');
    return nativeBridge.flushDirectory(base);
  });

  const evidence = {
    schema: 'sdo.windows_native_primitives_probe.v1',
    platform: process.platform,
    node: process.version,
    cwd: process.cwd(),
    cwdPhysical: outcome(() => fs.realpathSync(process.cwd())),
    tmpdir: os.tmpdir(),
    tmpdirPhysical: outcome(() => fs.realpathSync(os.tmpdir())),
    oNoFollow: typeof fs.constants.O_NOFOLLOW === 'number'
      ? fs.constants.O_NOFOLLOW : null,
    fileFsync,
    directoryFsync,
    nativeDirectoryFlush,
    gitRoot,
    gitRootPhysical,
    stackUsesBackslash: (new Error().stack || '').includes('\\')
  };

  console.log(`SDO_WINDOWS_NATIVE_PROBE ${JSON.stringify(evidence)}`);
});

test('existing Win32 helper is not misrepresented as NODE_TEST_FILE containment', () => {
  const helper = fs.readFileSync(require.resolve(
    '../../accelerator/native/windows/sdo-fs-durability.cpp'), 'utf8');
  const bridge = fs.readFileSync(require.resolve(
    '../../accelerator/adapters/windows-native-durability-bridge'), 'utf8');
  const validation = fs.readFileSync(require.resolve(
    '../../accelerator/adapters/process-validation-adapter'), 'utf8');
  const nodeSandbox = fs.readFileSync(require.resolve(
    '../../accelerator/native/windows/sdo-node-test-sandbox.cpp'), 'utf8');
  const nodeAdapter = fs.readFileSync(require.resolve(
    '../../accelerator/adapters/windows-node-test-sandbox-adapter'), 'utf8');
  const build = fs.readFileSync(require.resolve(
    '../../accelerator/native/windows/build-helper.cmd'), 'utf8');
  assert.match(helper, /CreateFileW/);
  assert.match(helper, /FlushFileBuffers/);
  assert.doesNotMatch(helper, /AppContainer|CreateRestrictedToken|CreateJobObject|Windows Filtering Platform/);
  assert.doesNotMatch(bridge, /NODE_TEST_FILE|SandboxEvidence/);
  assert.match(validation, /win32: executeWindowsNodeTest/);
  assert.match(nodeSandbox, /CreateAppContainerProfile/);
  assert.match(nodeSandbox, /CapabilityCount = 0/);
  assert.match(nodeSandbox, /JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE/);
  assert.match(nodeSandbox, /JOB_OBJECT_LIMIT_ACTIVE_PROCESS/);
  assert.match(nodeSandbox, /SetEntriesInAclW/);
  assert.match(nodeSandbox, /CREATE_SUSPENDED/);
  assert.match(nodeSandbox, /AssignProcessToJobObject/);
  assert.match(nodeSandbox, /WaitForSingleObject/);
  assert.match(nodeSandbox, /TerminateJobObject/);
  assert.match(nodeSandbox, /JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE/);
  assert.match(nodeSandbox, /--permission/);
  assert.match(nodeSandbox, /--test-isolation=none/);
  assert.match(nodeAdapter, /sdo-node-test-sandbox\.exe/);
  assert.match(nodeAdapter, /native Node test helper evidence is absent/);
  assert.match(build, /sdo-node-test-sandbox\.cpp/);
  assert.match(build, /sdo-node-test-sandbox\.exe/);
});

test('Win32 Node test failures retain bounded sanitized execution diagnostics', () => {
  const adapter = fs.readFileSync(require.resolve(
    '../../accelerator/adapters/windows-node-test-sandbox-adapter'), 'utf8');
  assert.match(adapter, /const DIAGNOSTIC_OUTPUT_LIMIT = 4096/);
  for (const field of [
    'executable', 'arguments', 'status', 'signal', 'errorCode', 'errorMessage',
    'stdout', 'stderr', 'markerPresent'
  ]) {
    assert.match(adapter, new RegExp(`${field}:`));
  }
  assert.match(adapter, /\r?\n    phase\r?\n/);
  assert.match(adapter, /\[OPERATION_ID\]/);
  assert.match(adapter, /\[REQUIREMENT_FINGERPRINT\]/);
  assert.match(adapter, /\[WORKSPACE\]/);
  assert.match(adapter, /\[NODE_EXECUTABLE\]/);
  assert.match(adapter, /\[REDACTED\]/);
  assert.match(adapter, /'evidence-parse'/);
  assert.match(adapter, /env: \{\}/);
  assert.doesNotMatch(adapter, /process\.env/);
});

test('Windows Job Object timeout terminates the native test tree', {
  skip: process.platform !== 'win32'
}, () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-win-node-timeout-')));
  const target = 'timeout.test.js';
  fs.writeFileSync(path.join(workspace, target), [
    "const test = require('node:test');",
    "test('never completes', () => new Promise(() => {}));",
    ''
  ].join('\n'));
  const observedAt = '2099-01-01T00:01:00.000Z';
  const expiresAt = '2099-01-01T00:05:00.000Z';
  const request = createMachineAccessRequest({
    requestId: 'win-timeout-request',
    operationId: 'win-timeout-operation',
    workspace,
    operationType: 'RUN_NODE_TEST',
    target,
    purpose: 'Qualify Windows process-tree timeout.',
    requestedAt: observedAt
  });
  const grantEvaluation = deepFreeze({
    schema: 'sdo.capability_grant_evaluation.v1',
    decision: 'ALLOWED',
    grant: {
      operationId: request.operationId,
      workspace: request.workspace,
      capabilityType: request.capabilityType,
      action: request.action,
      riskLevel: request.riskLevel,
      policyDecision: 'ALLOWED',
      lifecycleState: 'PENDING',
      fingerprint: 'a'.repeat(64)
    }
  });
  const authority = createMachineAccessAuthority({
    authorityId: 'win-timeout-authority',
    request,
    grantEvaluation,
    issuedAt: observedAt,
    expiresAt
  });
  const requirement = createSandboxRequirement({
    requirementId: 'win-timeout-requirement',
    operation: createMachineAccessOperation({ request, authority }),
    platform: 'win32',
    requiredAt: observedAt
  });
  try {
    const execution = executeWindowsNodeTest({
      requirement,
      target,
      observedAt,
      expiresAt,
      timeoutMs: 100,
      maxOutputBytes: 64 * 1024
    });
    assert.equal(execution.result.status, 124);
    assert.equal(execution.adapterEvidence.controls.genericProcessDenied, true);
    assert.equal(execution.adapterEvidence.controls.networkDenied, true);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
