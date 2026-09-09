'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const { canonicalizeAuthorizedRoot } = require('../core/workspace-boundary');

const TIMEOUT_MS = 5000;
const MAX_OUTPUT_BYTES = 32 * 1024;
const HELPER = path.resolve(__dirname, '../native/macos/sdo-seatbelt-probe');

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function timestamp(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required.`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(`${name} must be canonical.`);
  }
  return value;
}

function seatbeltLiteral(value) {
  if (typeof value !== 'string' || !value || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error('Seatbelt path literal is unsafe.');
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function createProfile(workspace) {
  const readable = [
    workspace,
    '/System',
    '/usr/lib',
    '/private/var/db/dyld',
    '/dev/null',
    '/dev/urandom'
  ];
  const rules = readable.map((entry) =>
    `(allow file-read* (subpath "${seatbeltLiteral(entry)}"))`
  );
  const executableMappings = [
    '(allow file-map-executable (subpath "/System"))',
    '(allow file-map-executable (subpath "/usr/lib"))',
    '(allow file-map-executable (subpath "/private/var/db/dyld"))'
  ];
  return [
    '(version 1)',
    '(deny default)',
    '(allow process-info* (target same-sandbox))',
    '(allow signal (target same-sandbox))',
    '(allow sysctl-read)',
    '(allow mach-host*)',
    '(allow mach-lookup)',
    '(allow iokit-open)',
    '(allow ipc-posix-sem)',
    '(allow ipc-posix-shm-read*)',
    '(allow file-ioctl)',
    '(allow file-read-metadata)',
    ...executableMappings,
    ...rules
  ].join('\n');
}

function createNodeTestProfile(workspace, node) {
  return [
    createProfile(workspace),
    '(allow ipc-posix-shm*)',
    `(allow file-read* (literal "${seatbeltLiteral(node)}"))`,
    `(allow file-map-executable (literal "${seatbeltLiteral(node)}"))`,
    `(allow process-exec (literal "${seatbeltLiteral(node)}"))`
  ].join('\n');
}

function qualifiedRuntime(requirement) {
  if (process.platform !== 'darwin') throw new Error('macOS Seatbelt sandbox is unavailable.');
  if (!requirement || !Object.isFrozen(requirement) ||
      requirement.schema !== 'sdo.sandbox_requirement.v1' || requirement.platform !== 'darwin') {
    throw new Error('Immutable macOS sandbox requirement is required.');
  }
  const workspace = canonicalizeAuthorizedRoot(requirement.workspace);
  const node = fs.realpathSync(process.execPath);
  if (!fs.existsSync(HELPER) || !fs.statSync(HELPER).isFile() ||
      !fs.statSync(node).isFile()) {
    throw new Error('Qualified native macOS Seatbelt runtime is unavailable.');
  }
  return { workspace, helper: HELPER, node };
}

function profileFor(requirement, workspace, node) {
  return requirement.operationType === 'RUN_NODE_TEST'
    ? createNodeTestProfile(workspace, node)
    : createProfile(workspace);
}

function boundedFailure(result, { workspace, helper, probe }) {
  const redact = (value) => String(value || '')
    .replaceAll(workspace, '<WORKSPACE>')
    .replaceAll(path.dirname(workspace), '<WORKSPACE_PARENT>')
    .replaceAll(os.homedir(), '<USER_HOME>')
    .replaceAll(helper, '<NATIVE_HELPER>')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 2048);
  const failure = {
    probe,
    errorCode: result.error && result.error.code || null,
    signal: result.signal || null,
    status: Number.isInteger(result.status) ? result.status : null,
    stdout: redact(result.stdout),
    stderr: redact(result.stderr)
  };
  return JSON.stringify(failure);
}

function runNativeProbe({ profile, helper, requirement, workspace, hostEscapeProbe, probe }) {
  return childProcess.spawnSync(helper, [
    requirement.operationId,
    requirement.fingerprint,
    workspace,
    hostEscapeProbe,
    probe,
    profile
  ], {
    cwd: workspace,
    shell: false,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
    windowsHide: true,
    env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent' }
  });
}

function cleanNativeProbeResult(result, enforcementSignalAllowed) {
  if (result.error || result.stdout.trim() || result.stderr.trim()) return false;
  if (!result.signal) return result.status === 0;
  return enforcementSignalAllowed &&
    ['SIGABRT', 'SIGKILL', 'SIGSYS'].includes(result.signal);
}

function attestMacosSeatbeltSandbox({ requirement, observedAt, expiresAt }) {
  const { workspace, helper, node } = qualifiedRuntime(requirement);
  const observation = timestamp(observedAt, 'observedAt');
  const expiry = timestamp(expiresAt, 'expiresAt');
  if (Date.parse(expiry) <= Date.parse(observation)) {
    throw new Error('Sandbox evidence expiry is invalid.');
  }
  const profile = profileFor(requirement, workspace, node);
  const hostEscapeProbe = path.join(os.homedir(), '.ssh', 'id_rsa');
  const bootstrap = runNativeProbe({
    profile, helper, requirement, workspace, hostEscapeProbe, probe: 'bootstrap'
  });
  if (!cleanNativeProbeResult(bootstrap, false)) {
    throw new Error(`macOS Seatbelt sandbox attestation failed closed: ${
      boundedFailure(bootstrap, { workspace, helper, probe: 'bootstrap' })
    }`);
  }
  const probes = [
    'workspace-write',
    'workspace-boundary',
    'secret-read',
    'network',
    'generic-process'
  ];
  for (const probe of probes) {
    const result = runNativeProbe({
      profile, helper, requirement, workspace, hostEscapeProbe, probe
    });
    if (!cleanNativeProbeResult(result, true)) {
      throw new Error(`macOS Seatbelt sandbox attestation failed closed: ${
        boundedFailure(result, { workspace, helper, probe })
      }`);
    }
  }
  return deepFreeze({
    schema: 'sdo.sandbox_adapter_evidence.v1',
    decision: 'ENFORCED',
    sandboxKind: 'macos-seatbelt-deny-default',
    adapterId: 'sdo.macos_seatbelt.v1',
    operationId: requirement.operationId,
    workspace: requirement.workspace,
    platform: 'darwin',
    requirementFingerprint: requirement.fingerprint,
    controls: {
      workspaceReadOnly: true,
      workspaceBound: true,
      networkDenied: true,
      genericProcessDenied: true,
      secretAccessDenied: true
    },
    observedAt: observation,
    expiresAt: expiry
  });
}

function executeMacosSeatbeltNodeTest({
  requirement,
  target,
  observedAt,
  expiresAt,
  timeoutMs,
  maxOutputBytes
}) {
  const { workspace, helper, node } = qualifiedRuntime(requirement);
  if (requirement.operationType !== 'RUN_NODE_TEST' ||
      requirement.target !== target || typeof target !== 'string' || !target) {
    throw new Error('Seatbelt Node test target is not operation-bound.');
  }
  const canonicalTarget = fs.realpathSync(path.resolve(workspace, target));
  const relativeTarget = path.relative(workspace, canonicalTarget);
  if (!relativeTarget || relativeTarget.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeTarget) || !fs.statSync(canonicalTarget).isFile()) {
    throw new Error('Seatbelt Node test target is outside the workspace.');
  }
  const observation = timestamp(observedAt, 'observedAt');
  const expiry = timestamp(expiresAt, 'expiresAt');
  const adapterEvidence = attestMacosSeatbeltSandbox({
    requirement,
    observedAt: observation,
    expiresAt: expiry
  });
  const sandboxedArguments = [
    '--jitless',
    '--permission',
    `--allow-fs-read=${workspace}`,
    '--test-isolation=none',
    '--test',
    relativeTarget
  ];
  const profile = createNodeTestProfile(workspace, node);
  const arguments_ = [
    requirement.operationId,
    requirement.fingerprint,
    workspace,
    path.join(os.homedir(), '.ssh', 'id_rsa'),
    'node-test',
    profile,
    node,
    relativeTarget
  ];
  const result = childProcess.spawnSync(helper, arguments_, {
    cwd: workspace,
    shell: false,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: maxOutputBytes,
    windowsHide: true,
    env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent' }
  });
  return {
    adapterEvidence,
    executable: helper,
    arguments: arguments_,
    sandboxedExecutable: node,
    sandboxedArguments,
    result
  };
}

function createMacosCodexCognitiveLaunchSpec() {
  const reason = process.platform !== 'darwin'
    ? 'macOS Seatbelt physical qualification was not executed on this platform.'
    : 'macOS Seatbelt Codex streaming helper is not physically qualified.';
  const error = new Error(`CODEX_CONTAINMENT_UNAVAILABLE: ${reason}`);
  error.code = 'CODEX_CONTAINMENT_UNAVAILABLE';
  throw error;
}

module.exports = deepFreeze({
  attestMacosSeatbeltSandbox,
  executeMacosSeatbeltNodeTest,
  createProfile,
  createNodeTestProfile,
  createMacosCodexCognitiveLaunchSpec
});
