'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const { canonicalizeAuthorizedRoot } = require('../core/workspace-boundary');

const SANDBOX_EXEC = '/usr/bin/sandbox-exec';
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

function createProfile(workspace, node) {
  const readable = [
    workspace,
    node,
    '/System',
    '/usr/lib',
    '/usr/share',
    '/private/var/db/dyld',
    '/dev/null',
    '/dev/urandom'
  ];
  const rules = readable.map((entry) =>
    `(allow file-read* (subpath "${seatbeltLiteral(entry)}"))`
  );
  return [
    '(version 1)',
    '(deny default)',
    '(allow process-fork)',
    `(allow process-exec (literal "${seatbeltLiteral(node)}"))`,
    '(allow signal (target self))',
    '(allow sysctl-read)',
    '(allow mach-lookup)',
    '(allow file-read-metadata)',
    ...rules
  ].join('\n');
}

function attestMacosSeatbeltSandbox({ requirement, observedAt, expiresAt }) {
  if (process.platform !== 'darwin') throw new Error('macOS Seatbelt sandbox is unavailable.');
  if (!requirement || !Object.isFrozen(requirement) ||
      requirement.schema !== 'sdo.sandbox_requirement.v1' || requirement.platform !== 'darwin') {
    throw new Error('Immutable macOS sandbox requirement is required.');
  }
  if (!fs.existsSync(SANDBOX_EXEC) || !fs.statSync(SANDBOX_EXEC).isFile()) {
    throw new Error('Qualified macOS Seatbelt executable is unavailable.');
  }
  const workspace = canonicalizeAuthorizedRoot(requirement.workspace);
  const node = fs.realpathSync(process.execPath);
  const helper = path.join(workspace, 'accelerator/native/macos/seatbelt-sandbox-probe.js');
  if (!fs.statSync(node).isFile() || !fs.statSync(helper).isFile()) {
    throw new Error('Qualified macOS Seatbelt runtime is unavailable.');
  }
  const observation = timestamp(observedAt, 'observedAt');
  const expiry = timestamp(expiresAt, 'expiresAt');
  if (Date.parse(expiry) <= Date.parse(observation)) {
    throw new Error('Sandbox evidence expiry is invalid.');
  }
  const profile = createProfile(workspace, node);
  const hostEscapeProbe = path.join(os.homedir(), '.ssh', 'id_rsa');
  const input = JSON.stringify({
    operationId: requirement.operationId,
    requirementFingerprint: requirement.fingerprint,
    workspace,
    hostEscapeProbe
  });
  const result = childProcess.spawnSync(SANDBOX_EXEC, [
    '-p', profile, node, helper
  ], {
    cwd: workspace,
    shell: false,
    input,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
    windowsHide: true,
    env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent' }
  });
  if (result.error || result.signal || result.status !== 0 || result.stderr.trim()) {
    throw new Error('macOS Seatbelt sandbox attestation failed closed.');
  }
  let probe;
  try { probe = JSON.parse(result.stdout); } catch {
    throw new Error('macOS Seatbelt sandbox evidence is malformed.');
  }
  if (probe.schema !== 'sdo.macos_seatbelt_probe_result.v1' ||
      probe.operationId !== requirement.operationId ||
      probe.requirementFingerprint !== requirement.fingerprint ||
      probe.platform !== 'darwin' || probe.cwd !== workspace ||
      !probe.workspaceReadOnly || !probe.workspaceBound || !probe.networkDenied ||
      !probe.genericProcessDenied || !probe.secretAccessDenied ||
      !probe.environmentMinimal) {
    throw new Error('macOS Seatbelt sandbox controls are not qualified.');
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
