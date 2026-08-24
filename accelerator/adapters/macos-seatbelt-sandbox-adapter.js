'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const { canonicalizeAuthorizedRoot } = require('../core/workspace-boundary');

const TIMEOUT_MS = 5000;
const MAX_OUTPUT_BYTES = 32 * 1024;

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
  if (process.platform !== 'darwin') throw new Error('macOS Seatbelt sandbox is unavailable.');
  if (!requirement || !Object.isFrozen(requirement) ||
      requirement.schema !== 'sdo.sandbox_requirement.v1' || requirement.platform !== 'darwin') {
    throw new Error('Immutable macOS sandbox requirement is required.');
  }
  const workspace = canonicalizeAuthorizedRoot(requirement.workspace);
  const helper = path.join(workspace, 'accelerator/native/macos/sdo-seatbelt-probe');
  if (!fs.existsSync(helper) || !fs.statSync(helper).isFile()) {
    throw new Error('Qualified native macOS Seatbelt helper is unavailable.');
  }
  const observation = timestamp(observedAt, 'observedAt');
  const expiry = timestamp(expiresAt, 'expiresAt');
  if (Date.parse(expiry) <= Date.parse(observation)) {
    throw new Error('Sandbox evidence expiry is invalid.');
  }
  const profile = createProfile(workspace);
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

module.exports = deepFreeze({ attestMacosSeatbeltSandbox, createProfile });
