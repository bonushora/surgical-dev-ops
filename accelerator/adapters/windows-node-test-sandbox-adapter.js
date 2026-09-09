'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { canonicalizeAuthorizedRoot } = require('../core/workspace-boundary');

const HELPER = path.resolve(__dirname, '../native/windows/sdo-node-test-sandbox.exe');
const MARKER = 'SDO_WIN32_NODE_TEST_EVIDENCE ';
const DIAGNOSTIC_OUTPUT_LIMIT = 4096;

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

function diagnosticText(value, sensitiveValues) {
  let text = typeof value === 'string' ? value : '';
  for (const [sensitive, replacement] of sensitiveValues) {
    if (sensitive) text = text.split(sensitive).join(replacement);
  }
  text = text
    .replace(/[A-Z]:\\Users\\[^\\\r\n]+/gi, '[USER_HOME]')
    .replace(
      /((?:authorization|cookie|password|passwd|secret|token|api[-_]?key)\s*[:=]\s*)[^\r\n,;]+/gi,
      '$1[REDACTED]'
    );
  return text.slice(0, DIAGNOSTIC_OUTPUT_LIMIT);
}

function windowsNodeTestFailure(message, result, context, phase) {
  const error = result && result.error;
  const sensitiveValues = [
    [HELPER, '[HELPER]'],
    [context.workspace, '[WORKSPACE]'],
    [context.node, '[NODE_EXECUTABLE]']
  ];
  const diagnostic = deepFreeze({
    executable: path.basename(HELPER),
    arguments: [
      '[OPERATION_ID]',
      '[REQUIREMENT_FINGERPRINT]',
      '[WORKSPACE]',
      '[TARGET]',
      '[NODE_EXECUTABLE]',
      String(context.timeoutMs)
    ],
    status: Number.isInteger(result && result.status) ? result.status : null,
    signal: typeof (result && result.signal) === 'string' ? result.signal : null,
    errorCode: error && error.code ? String(error.code).slice(0, 128) : null,
    errorMessage: diagnosticText(error && error.message, sensitiveValues),
    stdout: diagnosticText(result && result.stdout, sensitiveValues),
    stderr: diagnosticText(result && result.stderr, sensitiveValues),
    markerPresent: typeof (result && result.stdout) === 'string' &&
      result.stdout.includes(MARKER),
    phase
  });
  const failure = new Error(`${message} ${JSON.stringify(diagnostic)}`);
  failure.code = 'WIN32_NODE_TEST_EXECUTION_FAILED';
  failure.diagnostic = diagnostic;
  return failure;
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
  const failure = (message, phase) => windowsNodeTestFailure(
    message, result, { workspace, node, timeoutMs }, phase
  );
  if (result.error || typeof result.stdout !== 'string') {
    const spawnCodes = new Set(['ENOENT', 'EACCES', 'EPERM']);
    const phase = result.error && result.error.code === 'ETIMEDOUT'
      ? 'timeout'
      : result.error && spawnCodes.has(result.error.code)
        ? 'spawn'
        : 'execution';
    throw failure('Win32 native Node test helper failed closed.', phase);
  }
  const markerIndex = result.stdout.lastIndexOf(`\n${MARKER}`);
  if (markerIndex < 0 || result.stdout.indexOf(`\n${MARKER}`) !== markerIndex) {
    throw failure('Win32 native Node test helper evidence is absent.', 'evidence-parse');
  }
  const stdout = result.stdout.slice(0, markerIndex);
  let native;
  try {
    native = JSON.parse(result.stdout.slice(markerIndex + 1 + MARKER.length).trim());
  } catch {
    throw failure('Win32 native Node test helper evidence is malformed.', 'evidence-parse');
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
    throw failure(
      'Win32 native Node test helper evidence is invalid or divergent.', 'evidence-parse'
    );
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
      '--preserve-symlinks',
      '--preserve-symlinks-main',
      '--permission',
      `--allow-fs-read=${native.stagingWorkspace}`,
      '--test-isolation=none',
      '--test',
      native.target
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
