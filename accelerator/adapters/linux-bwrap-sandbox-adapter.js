'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');
const { canonicalizeAuthorizedRoot } = require('../core/workspace-boundary');

const BWRAP = '/usr/bin/bwrap';
const TIMEOUT_MS = 5000;
const MAX_OUTPUT_BYTES = 32 * 1024;
const PROBE = path.resolve(__dirname, '../native/linux/bwrap-sandbox-probe.js');
const CODEX_PROBE = path.resolve(__dirname, '../native/linux/codex-containment-probe.js');
const CODEX_EXECUTABLE_FD = '__SDO_CODEX_EXECUTABLE_FD__';

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

function qualifiedRuntime(requirement) {
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
  if (!fs.statSync(node).isFile() || !fs.statSync(PROBE).isFile()) {
    throw new Error('Qualified Bubblewrap runtime is unavailable.');
  }
  return { workspace, node };
}

function containmentArguments(workspace, node) {
  return [
    '--unshare-user', '--unshare-pid', '--unshare-net', '--unshare-ipc', '--unshare-uts',
    '--new-session', '--die-with-parent', '--clearenv',
    '--dir', '/runtime', '--ro-bind', node, '/runtime/node',
    '--ro-bind', PROBE, '/runtime/probe.js',
    '--dir', '/usr', '--ro-bind', '/usr/lib', '/usr/lib',
    '--ro-bind', '/usr/lib64', '/usr/lib64', '--symlink', 'usr/lib', '/lib',
    '--symlink', 'usr/lib64', '/lib64', '--proc', '/proc', '--dev', '/dev',
    '--tmpfs', '/tmp', '--dir', '/nonexistent', '--ro-bind', workspace, '/workspace',
    '--chdir', '/workspace', '--setenv', 'PATH', '/runtime', '--setenv', 'HOME', '/nonexistent'
  ];
}

function codexContainmentArguments(cognitiveRoot, runtimeBindings) {
  const arguments_ = [
    '--unshare-user', '--unshare-pid', '--unshare-net', '--unshare-ipc', '--unshare-uts',
    '--new-session', '--die-with-parent', '--dir', '/runtime'
  ];
  if (runtimeBindings.some((binding) => binding.target.startsWith('/usr/'))) {
    arguments_.push('--dir', '/usr');
  }
  for (const binding of runtimeBindings) {
    arguments_.push('--ro-bind', binding.source, binding.target);
  }
  arguments_.push(
    '--dir', '/cognitive', '--bind', cognitiveRoot, '/cognitive',
    '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp',
    '--chdir', '/cognitive/workspace',
    '--setenv', 'PATH', '/runtime',
    '--setenv', 'HOME', '/cognitive/home',
    '--setenv', 'TMPDIR', '/cognitive/tmp',
    '--setenv', 'LANG', 'C.UTF-8'
  );
  return arguments_;
}

function qualifiedCodexRoot(cognitiveRoot) {
  if (process.platform !== 'linux' || !fs.existsSync(BWRAP) || !fs.statSync(BWRAP).isFile()) {
    const error = new Error('CODEX_CONTAINMENT_UNAVAILABLE: Linux Bubblewrap is unavailable.');
    error.code = 'CODEX_CONTAINMENT_UNAVAILABLE';
    throw error;
  }
  const root = fs.realpathSync(cognitiveRoot);
  const stat = fs.statSync(root);
  if (!stat.isDirectory() || (stat.mode & 0o777) !== 0o700) {
    throw new Error('Codex cognitive root is not a restricted directory.');
  }
  return root;
}

function attestLinuxCodexContainment(cognitiveRoot, observedAt) {
  const root = qualifiedCodexRoot(cognitiveRoot);
  const observation = timestamp(observedAt, 'Codex containment observedAt');
  const node = fs.realpathSync(process.execPath);
  if (!fs.statSync(node).isFile() || !fs.statSync(CODEX_PROBE).isFile()) {
    throw new Error('Codex containment probe runtime is unavailable.');
  }
  const bubblewrapArguments = [
    ...codexContainmentArguments(root, [
      { source: node, target: '/runtime/node' },
      { source: CODEX_PROBE, target: '/runtime/probe.js' },
      { source: '/usr/lib', target: '/usr/lib' },
      { source: '/usr/lib64', target: '/usr/lib64' }
    ]),
    '--symlink', 'usr/lib', '/lib',
    '--symlink', 'usr/lib64', '/lib64',
    '--remount-ro', '/',
    '/runtime/node', '/runtime/probe.js'
  ];
  const result = childProcess.spawnSync(BWRAP, bubblewrapArguments, {
    cwd: root,
    shell: false,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
    windowsHide: true,
    env: {
      PATH: '/usr/bin:/bin',
      HOME: '/cognitive/home',
      TMPDIR: '/cognitive/tmp',
      LANG: 'C.UTF-8'
    }
  });
  if (result.error || result.signal || result.status !== 0 || result.stderr.trim()) {
    const error = new Error('Linux Codex containment attestation failed closed.');
    Object.defineProperty(error, 'cause', {
      value: new Error(JSON.stringify({
        status: result.status,
        signal: result.signal,
        errorCode: result.error && result.error.code || null,
        stdout: String(result.stdout || '').slice(0, 4096),
        stderr: String(result.stderr || '').replaceAll(root, '<COGNITIVE_ROOT>').slice(0, 4096)
      }))
    });
    throw error;
  }
  let probe;
  try { probe = JSON.parse(result.stdout); } catch {
    throw new Error('Linux Codex containment evidence is malformed.');
  }
  if (probe.schema !== 'sdo.codex_linux_containment_probe.v1' ||
      !probe.cognitiveWriteEnabled || !probe.externalWriteDenied ||
      !probe.hostFilesystemHidden || !probe.networkDenied ||
      !probe.genericProcessDenied || !probe.environmentMinimal ||
      !probe.homeIsolated || !probe.tempIsolated || probe.noNewPrivs !== '1' ||
      probe.effectiveCapabilities !== '0000000000000000') {
    throw new Error('Linux Codex containment controls are not qualified.');
  }
  return deepFreeze({
    schema: 'sdo.codex_cognitive_containment_attestation.v1',
    decision: 'ENFORCED',
    platform: 'linux',
    adapterId: 'sdo.linux_bwrap_codex.v1',
    sandboxKind: 'linux-bubblewrap-cognitive-namespace',
    observedAt: observation,
    controls: {
      hostFilesystemHidden: true,
      originalWorkspaceDenied: true,
      externalWriteDenied: true,
      networkDenied: true,
      secretAccessDenied: true
    },
    probe
  });
}

function createLinuxCodexCognitiveLaunchSpec({
  cognitiveRoot,
  codexExecutable,
  codexExecutableArguments = [],
  runtimeBindings = [],
  observedAt
}) {
  const root = qualifiedCodexRoot(cognitiveRoot);
  const executable = fs.realpathSync(codexExecutable);
  if (!fs.statSync(executable).isFile()) {
    throw new Error('Qualified Codex executable is unavailable.');
  }
  if (!Array.isArray(codexExecutableArguments) ||
      codexExecutableArguments.some((value) => typeof value !== 'string' || value.includes('\0')) ||
      !Array.isArray(runtimeBindings) || runtimeBindings.some((binding) =>
        !binding || typeof binding.source !== 'string' || typeof binding.target !== 'string' ||
        !path.isAbsolute(binding.source) || !path.posix.isAbsolute(binding.target))) {
    throw new Error('Codex cognitive runtime bindings are malformed.');
  }
  const qualifiedBindings = runtimeBindings.map((binding) => ({
    source: fs.realpathSync(binding.source),
    target: binding.target
  }));
  const attestation = attestLinuxCodexContainment(root, observedAt);
  return deepFreeze({
    schema: 'sdo.codex_cognitive_launch_spec.v1',
    platform: 'linux',
    nativeLauncher: BWRAP,
    nativeArguments: [
      ...codexContainmentArguments(root, [
        { source: CODEX_EXECUTABLE_FD, target: '/runtime/codex' },
        ...qualifiedBindings
      ]),
      ...(qualifiedBindings.some((binding) => binding.target === '/usr/lib')
        ? ['--symlink', 'usr/lib', '/lib'] : []),
      ...(qualifiedBindings.some((binding) => binding.target === '/usr/lib64')
        ? ['--symlink', 'usr/lib64', '/lib64'] : []),
      '--remount-ro', '/',
      '/runtime/codex',
      ...codexExecutableArguments
    ],
    executable,
    executableFdToken: CODEX_EXECUTABLE_FD,
    sdkWorkingDirectory: '/cognitive/workspace',
    attestation
  });
}

function attestLinuxBwrapSandbox({ requirement, observedAt, expiresAt }) {
  const { workspace, node } = qualifiedRuntime(requirement);
  const observation = timestamp(observedAt, 'observedAt');
  const expiry = timestamp(expiresAt, 'expiresAt');
  if (Date.parse(expiry) <= Date.parse(observation)) {
    throw new Error('Sandbox evidence expiry is invalid.');
  }
  const bubblewrapArguments = [
    ...containmentArguments(workspace, node), '/runtime/node', '/runtime/probe.js'
  ];
  const input = JSON.stringify({ operationId: requirement.operationId,
    requirementFingerprint: requirement.fingerprint });
  const result = childProcess.spawnSync(BWRAP, bubblewrapArguments, {
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

function executeLinuxBwrapNodeTest({
  requirement,
  target,
  observedAt,
  expiresAt,
  timeoutMs,
  maxOutputBytes
}) {
  const { workspace, node } = qualifiedRuntime(requirement);
  if (requirement.operationType !== 'RUN_NODE_TEST' ||
      requirement.target !== target || typeof target !== 'string' || !target) {
    throw new Error('Bubblewrap Node test target is not operation-bound.');
  }
  const canonicalTarget = fs.realpathSync(path.resolve(workspace, target));
  const relativeTarget = path.relative(workspace, canonicalTarget);
  if (!relativeTarget || relativeTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relativeTarget) ||
      !fs.statSync(canonicalTarget).isFile()) {
    throw new Error('Bubblewrap Node test target is outside the workspace.');
  }
  const observation = timestamp(observedAt, 'observedAt');
  const expiry = timestamp(expiresAt, 'expiresAt');
  const adapterEvidence = attestLinuxBwrapSandbox({
    requirement,
    observedAt: observation,
    expiresAt: expiry
  });
  const sandboxTarget = relativeTarget.split(path.sep).join('/');
  const sandboxedArguments = [
    '--permission',
    '--allow-fs-read=/workspace',
    '--test-isolation=none',
    '--test',
    sandboxTarget
  ];
  const bubblewrapArguments = [
    ...containmentArguments(workspace, node),
    '/runtime/node',
    ...sandboxedArguments
  ];
  const arguments_ = bubblewrapArguments;
  const result = childProcess.spawnSync(BWRAP, arguments_, {
    cwd: workspace,
    shell: false,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: maxOutputBytes,
    windowsHide: true,
    env: { PATH: '/usr/bin:/bin' }
  });
  return {
    adapterEvidence,
    executable: BWRAP,
    arguments: arguments_,
    sandboxedExecutable: '/runtime/node',
    sandboxedArguments,
    result
  };
}

module.exports = deepFreeze({
  attestLinuxBwrapSandbox,
  executeLinuxBwrapNodeTest,
  createLinuxCodexCognitiveLaunchSpec,
  attestLinuxCodexContainment
});
