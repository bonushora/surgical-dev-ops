'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { canonicalizeAuthorizedRoot } = require('../core/workspace-boundary');

const HELPER = path.resolve(__dirname, '../native/windows/sdo-node-test-sandbox.exe');
const MARKER = 'SDO_WIN32_NODE_TEST_EVIDENCE ';

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

function executeWindowsNodeTest({
  requirement,
  target,
  observedAt,
  expiresAt,
  timeoutMs,
  maxOutputBytes
}) {
  if (process.platform !== 'win32') throw new Error('Win32 sandbox is unavailable.');
  if (!requirement || !Object.isFrozen(requirement) ||
      requirement.schema !== 'sdo.sandbox_requirement.v1' || requirement.platform !== 'win32' ||
      requirement.operationType !== 'RUN_NODE_TEST' || requirement.target !== target) {
    throw new Error('Immutable Win32 Node test requirement is required.');
  }
  const workspace = canonicalizeAuthorizedRoot(requirement.workspace);
  const canonicalTarget = fs.realpathSync(path.resolve(workspace, target));
  const relativeTarget = path.relative(workspace, canonicalTarget);
  if (!relativeTarget || relativeTarget.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeTarget) || !fs.statSync(canonicalTarget).isFile()) {
    throw new Error('Win32 Node test target is outside the workspace.');
  }
  if (!fs.existsSync(HELPER) || !fs.statSync(HELPER).isFile()) {
    throw new Error('Qualified native Win32 Node test helper is unavailable.');
  }
  const observation = timestamp(observedAt, 'observedAt');
  const expiry = timestamp(expiresAt, 'expiresAt');
  if (Date.parse(expiry) <= Date.parse(observation)) {
    throw new Error('Win32 sandbox evidence expiry is invalid.');
  }
  const node = fs.realpathSync(process.execPath);
  const helperArguments = [
    requirement.operationId,
    requirement.fingerprint,
    workspace,
    relativeTarget.split(path.sep).join('\\'),
    node,
    String(timeoutMs)
  ];
  const result = childProcess.spawnSync(HELPER, helperArguments, {
    cwd: workspace,
    shell: false,
    encoding: 'utf8',
    timeout: timeoutMs + 5000,
    maxBuffer: maxOutputBytes + 64 * 1024,
    windowsHide: true,
    env: {}
  });
  if (result.error || typeof result.stdout !== 'string') {
    throw new Error('Win32 native Node test helper failed closed.');
  }
  const markerIndex = result.stdout.lastIndexOf(`\n${MARKER}`);
  if (markerIndex < 0 || result.stdout.indexOf(`\n${MARKER}`) !== markerIndex) {
    throw new Error('Win32 native Node test helper evidence is absent.');
  }
  const stdout = result.stdout.slice(0, markerIndex);
  let native;
  try {
    native = JSON.parse(result.stdout.slice(markerIndex + 1 + MARKER.length).trim());
  } catch {
    throw new Error('Win32 native Node test helper evidence is malformed.');
  }
  const controls = {
    workspaceReadOnly: native.workspaceReadOnly,
    workspaceBound: native.workspaceBound,
    networkDenied: native.networkDenied,
    genericProcessDenied: native.genericProcessDenied,
    secretAccessDenied: native.secretAccessDenied
  };
  if (!native || native.schema !== 'sdo.windows_node_test_sandbox_result.v1' ||
      native.decision !== 'ENFORCED' || native.operationId !== requirement.operationId ||
      native.requirementFingerprint !== requirement.fingerprint ||
      native.workspace !== workspace || native.target !== relativeTarget.split(path.sep).join('\\') ||
      native.appContainerNoNetworkCapabilities !== true || native.jobTreeKillEnabled !== true ||
      typeof native.stagingWorkspace !== 'string' || !native.stagingWorkspace ||
      typeof native.stagedNode !== 'string' || !native.stagedNode ||
      typeof native.stagedTarget !== 'string' || !native.stagedTarget ||
      Object.values(controls).some((value) => value !== true)) {
    throw new Error('Win32 native Node test helper evidence is invalid or divergent.');
  }
  return {
    adapterEvidence: deepFreeze({
      schema: 'sdo.sandbox_adapter_evidence.v1',
      decision: 'ENFORCED',
      sandboxKind: 'windows-appcontainer-job-node',
      adapterId: 'sdo.windows_appcontainer_job.v1',
      operationId: requirement.operationId,
      workspace: requirement.workspace,
      platform: 'win32',
      requirementFingerprint: requirement.fingerprint,
      controls,
      observedAt: observation,
      expiresAt: expiry
    }),
    executable: HELPER,
    arguments: helperArguments,
    sandboxedExecutable: native.stagedNode,
    sandboxedArguments: [
      '--permission',
      `--allow-fs-read=${native.stagingWorkspace}`,
      '--test-isolation=none',
      '--test',
      native.stagedTarget
    ],
    result: { ...result, stdout, stderr: result.stderr || '' }
  };
}

function createWindowsCodexCognitiveLaunchSpec() {
  const reason = process.platform !== 'win32'
    ? 'Windows AppContainer physical qualification was not executed on this platform.'
    : 'Windows AppContainer Codex streaming helper is not physically qualified.';
  const error = new Error(`CODEX_CONTAINMENT_UNAVAILABLE: ${reason}`);
  error.code = 'CODEX_CONTAINMENT_UNAVAILABLE';
  throw error;
}

module.exports = deepFreeze({
  executeWindowsNodeTest,
  createWindowsCodexCognitiveLaunchSpec
});
