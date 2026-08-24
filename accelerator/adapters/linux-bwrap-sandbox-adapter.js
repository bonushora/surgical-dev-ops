'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');
const { canonicalizeAuthorizedRoot } = require('../core/workspace-boundary');

const BWRAP = '/usr/bin/bwrap';
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

function attestLinuxBwrapSandbox({ requirement, observedAt, expiresAt }) {
  if (process.platform !== 'linux') throw new Error('Linux Bubblewrap sandbox is unavailable.');
  if (!requirement || !Object.isFrozen(requirement) ||
      requirement.schema !== 'sdo.sandbox_requirement.v1' || requirement.platform !== 'linux') {
    throw new Error('Immutable Linux sandbox requirement is required.');
  }
  if (!fs.existsSync(BWRAP) || !fs.statSync(BWRAP).isFile()) {
    throw new Error('Qualified Bubblewrap executable is unavailable.');
  }
  const workspace = canonicalizeAuthorizedRoot(requirement.workspace);
  const node = fs.realpathSync(process.execPath);
  const helperHost = path.join(workspace, 'accelerator/native/linux/bwrap-sandbox-probe.js');
  if (!fs.statSync(node).isFile() || !fs.statSync(helperHost).isFile()) {
    throw new Error('Qualified Bubblewrap runtime is unavailable.');
  }
  const observation = timestamp(observedAt, 'observedAt');
  const expiry = timestamp(expiresAt, 'expiresAt');
  if (Date.parse(expiry) <= Date.parse(observation)) {
    throw new Error('Sandbox evidence expiry is invalid.');
  }
  const args = [
    '--unshare-user', '--unshare-pid', '--unshare-net', '--unshare-ipc', '--unshare-uts',
    '--new-session', '--die-with-parent', '--clearenv',
    '--dir', '/runtime', '--ro-bind', node, '/runtime/node',
    '--dir', '/usr', '--ro-bind', '/usr/lib', '/usr/lib',
    '--ro-bind', '/usr/lib64', '/usr/lib64', '--symlink', 'usr/lib', '/lib',
    '--symlink', 'usr/lib64', '/lib64', '--proc', '/proc', '--dev', '/dev',
    '--tmpfs', '/tmp', '--dir', '/nonexistent', '--ro-bind', workspace, '/workspace',
    '--chdir', '/workspace', '--setenv', 'PATH', '/runtime', '--setenv', 'HOME', '/nonexistent',
    '/runtime/node', '/workspace/accelerator/native/linux/bwrap-sandbox-probe.js'
  ];
  const input = JSON.stringify({ operationId: requirement.operationId,
    requirementFingerprint: requirement.fingerprint });
  const result = childProcess.spawnSync(BWRAP, args, {
    cwd: workspace, shell: false, input, encoding: 'utf8', timeout: TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true, env: { PATH: '/usr/bin:/bin' }
  });
  if (result.error || result.signal || result.status !== 0 || result.stderr.trim()) {
    throw new Error('Bubblewrap sandbox attestation failed closed.');
  }
  let probe;
  try { probe = JSON.parse(result.stdout); } catch {
    throw new Error('Bubblewrap sandbox evidence is malformed.');
  }
  if (probe.schema !== 'sdo.linux_bwrap_probe_result.v1' ||
      probe.operationId !== requirement.operationId ||
      probe.requirementFingerprint !== requirement.fingerprint ||
      !probe.workspaceReadOnly || !probe.workspaceBound || !probe.networkDenied ||
      !probe.genericProcessDenied || !probe.secretAccessDenied || !probe.environmentMinimal ||
      probe.noNewPrivs !== '1' || probe.effectiveCapabilities !== '0000000000000000') {
    throw new Error('Bubblewrap sandbox controls are not qualified.');
  }
  return deepFreeze({
    schema: 'sdo.sandbox_adapter_evidence.v1', decision: 'ENFORCED',
    sandboxKind: 'linux-bubblewrap-user-namespace', adapterId: 'sdo.linux_bwrap.v1',
    operationId: requirement.operationId, workspace: requirement.workspace, platform: 'linux',
    requirementFingerprint: requirement.fingerprint,
    controls: { workspaceReadOnly: true, workspaceBound: true, networkDenied: true,
      genericProcessDenied: true, secretAccessDenied: true },
    observedAt: observation, expiresAt: expiry
  });
}

module.exports = deepFreeze({ attestLinuxBwrapSandbox });
