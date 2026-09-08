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
  assert.match(nodeSandbox,
    /L"HOME="[\s\S]*L"PATH="[\s\S]*L"SystemRoot="[\s\S]*L"TEMP="[\s\S]*L"TMP="/);
  assert.match(nodeSandbox, /entries\.insert\(entries\.begin\(\), L"=" \+ drive \+ L"=" \+ workspace\)/);
  assert.match(nodeSandbox, /SDO_WIN32_NODE_TEST_INTERNAL/);
  assert.match(nodeSandbox, /stage=/);
  assert.match(nodeSandbox, /win32Error=/);
  assert.match(nodeSandbox, /internalCode=/);
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

test('Windows AppContainer environment comparison is isolated, sanitized and structural', () => {
  const diagnostic = fs.readFileSync(path.join(
    __dirname, 'fixtures/windows-appcontainer-environment-diagnostic.cpp'
  ), 'utf8');
  const build = fs.readFileSync(path.join(
    __dirname, 'fixtures/build-windows-appcontainer-environment-diagnostic.cmd'
  ), 'utf8');
  const workflow = fs.readFileSync(path.join(
    __dirname, '../../.github/workflows/accelerator-conformance.yml'
  ), 'utf8');
  const productionBuild = fs.readFileSync(path.join(
    __dirname, '../../accelerator/native/windows/build-helper.cmd'
  ), 'utf8');
  const productionAdapter = fs.readFileSync(path.join(
    __dirname, '../../accelerator/adapters/windows-node-test-sandbox-adapter.js'
  ), 'utf8');

  assert.match(diagnostic, /manualCurrentEnvironment/);
  assert.match(diagnostic, /CreateEnvironmentBlock\(&nativeEnvironment, token, FALSE\)/);
  assert.match(diagnostic, /nativeSanitizedEnvironment\(\s*nullptr/);
  assert.match(diagnostic, /DestroyEnvironmentBlock\(nativeEnvironment\)/);
  assert.match(diagnostic, /const BOOL created = CreateProcessW\([\s\S]+const DWORD createError = created \? ERROR_SUCCESS : GetLastError\(\)/);
  assert.match(diagnostic, /PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES/);
  assert.match(diagnostic, /JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE/);
  assert.match(diagnostic, /JOB_OBJECT_LIMIT_ACTIVE_PROCESS/);
  assert.match(diagnostic, /AssignProcessToJobObject/);
  assert.match(diagnostic, /TerminateJobObject/);
  assert.match(diagnostic, /grantAppContainerReadExecute/);
  assert.match(diagnostic, /restoreDacl/);
  assert.match(diagnostic, /CreateAppContainerProfile/);
  assert.match(diagnostic, /DeleteAppContainerProfile/);
  assert.match(diagnostic, /GetFileAttributesW/);
  assert.match(diagnostic, /GetEffectiveRightsFromAclW/);
  assert.match(diagnostic, /MapGenericMask/);
  assert.match(diagnostic, /enum class AclAssessment/);
  assert.match(diagnostic, /kAllowed/);
  assert.match(diagnostic, /kDenied/);
  assert.match(diagnostic, /kIndeterminate/);
  assert.match(diagnostic, /aclAssessmentName/);
  assert.match(diagnostic, /ERROR_REPARSE_TAG_INVALID/);
  assert.match(diagnostic, /SetCurrentDirectoryW\(stagedWorkspace\.c_str\(\)\)/);
  assert.match(diagnostic, /SetCurrentDirectoryW\(originalCurrentDirectory\.data\(\)\)/);
  assert.match(diagnostic, /variant=[\s\S]+environmentSource=[\s\S]+entryNames=\[/);
  assert.match(diagnostic, /const EnvironmentMetadata& environment/);
  assert.match(diagnostic, /reportVariant\("A", "manual"/);
  assert.match(diagnostic, /reportVariant\("C", "minimal-native"/);
  assert.match(diagnostic, /reportArgumentVariant\(\s*"D", "explicit-workspace"/);
  assert.match(diagnostic, /reportArgumentVariant\(\s*"E", "null-confined-parent"/);
  assert.match(diagnostic,
    /reportArgumentVariant\(\s*"F", "explicit-executable-directory"/);
  assert.match(diagnostic, /stagedExecutable\.wstring\(\), nullptr, nativeSanitized/);
  for (const field of [
    'applicationNameMode=absolute', 'executablePathKind=', 'executableExists=',
    'executableType=', 'aclAssessment=', 'aclDiagnosticCode=',
    'executableBasename=',
    'commandLineMode=explicit-separated', 'argcExpected=2',
    'currentDirectoryMode=', 'currentDirectoryPathKind=',
    'currentDirectoryExists=', 'currentDirectoryAclAssessment=',
    'currentDirectoryBasename=', 'environmentSource=native-sanitized',
    'appContainer=true', 'creationFlags=', 'startupInfoExBytes=',
    'securityCapabilities=true', 'attributeListValid=true',
    'creationToken=calling-process', 'createProcess=', 'win32Error=', 'stage=',
    'childExit=', 'cleanup='
  ]) {
    assert.match(diagnostic, new RegExp(field));
  }
  assert.match(diagnostic,
    /creationFlags=CREATE_SUSPENDED\|CREATE_UNICODE_ENVIRONMENT\|[\s\S]+EXTENDED_STARTUPINFO_PRESENT/);
  assert.match(diagnostic, /L"SystemRoot"/);
  assert.match(diagnostic, /L"windir"/);
  assert.match(diagnostic, /L"ComSpec"/);
  assert.match(diagnostic, /L"HOME"/);
  assert.match(diagnostic, /L"TEMP"/);
  assert.match(diagnostic, /L"TMP"/);
  assert.match(diagnostic, /L"PATH"/);
  assert.doesNotMatch(diagnostic, /GetEnvironmentStrings|SetEnvironmentVariable/);
  assert.doesNotMatch(diagnostic,
    /L"(?:TOKEN|SECRET|PASSWORD|COOKIE|AUTHORIZATION|API_KEY|SSH|GITHUB|AZURE|USERPROFILE|APPDATA|LOCALAPPDATA)"/i);
  assert.doesNotMatch(diagnostic, /entryValues|std::wcout|modulePath\s*<</);
  assert.match(diagnostic, /--inert-child/);
  assert.match(build, /\/W4 \/WX \/MT \/utf-8/);
  assert.match(workflow,
    /Compare Windows AppContainer environment contracts[\s\S]+matrix\.os == 'windows-latest' && github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow,
    /build-windows-appcontainer-environment-diagnostic\.cmd[\s\S]+windows-appcontainer-environment-diagnostic\.exe/);
  assert.doesNotMatch(productionBuild, /environment-diagnostic/);
  assert.doesNotMatch(productionAdapter, /environment-diagnostic/);
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
