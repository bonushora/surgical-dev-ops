#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const {
  createRuntimeProfile,
  RUNTIME_PROFILE_VERSION,
  canonicalize
} = require('../../accelerator/core/execution-isolation/runtime-profile');
const {
  createExecutionEnvelope
} = require('../../accelerator/core/execution-isolation/execution-envelope');
const {
  createLinuxBwrapExecutionProvider,
  INTERNAL_AUTHORIZED_EXECUTABLE
} = require('../../accelerator/adapters/linux-bwrap-execution-provider');

const BASELINE_SHA = 'f45720e40ee0c9d0d0a5e5bcf34dcee5e9c18b8f';
const SCHEMA = 'sdo.external-review-demo/v1';
const HARNESS = 'REVIEW_DEMONSTRATION_HARNESS';
const AMBIENT_SENTINEL_KEY = 'SDO_EXTERNAL_REVIEW_AMBIENT_SENTINEL';

const REQUIRED_CHECKS = Object.freeze([
  'AUTHORIZED_WORKSPACE_WRITE',
  'HOST_SENTINEL_UNAVAILABLE',
  'D01_WRITE_OUTSIDE_AUTHORIZED_WORKSPACE',
  'D02_READ_HOST_HOME',
  'D03_ACCESS_DOCKER_SOCKET',
  'D04_AMBIENT_SECRET_INHERITANCE',
  'D05_HOST_LOOPBACK_NETWORK_ACCESS',
  'D06_SYMLINK_WORKSPACE_ESCAPE',
  'D07_SIBLING_WORKSPACE_ACCESS',
  'D08_SYSTEM_PATH_MUTATION',
  'D09_UNAVAILABLE_BUBBLEWRAP',
  'D10_UNAUTHORIZED_INVALID_EXECUTABLE',
  'D11_BROAD_RUNTIME_TREE_EXPOSURE',
  'D12_NATIVE_FALLBACK',
  'EXACT_RUNTIME_EXECUTABLE_MAPPING',
  'RESULT_PLAN_DIGEST_BOUND'
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function classifiedError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireCondition(condition, code) {
  if (!condition) throw classifiedError(code);
}

function securityDigest(value) {
  return crypto.createHash('sha256')
    .update(`${SCHEMA}\0${JSON.stringify(canonicalize(value))}`, 'utf8')
    .digest('hex');
}

function classifyReviewDemoPlatform(platform = process.platform) {
  return platform === 'linux' ? 'SUPPORTED' : 'UNSUPPORTED_PLATFORM';
}

function runtimeProfile() {
  return createRuntimeProfile({
    version: RUNTIME_PROFILE_VERSION,
    backend: 'linux-bwrap',
    network: 'deny',
    filesystem: {
      workspace: 'rw',
      hostRoot: 'absent',
      temporary: 'ephemeral',
      extraMounts: []
    },
    environment: { inherit: [] },
    process: { shell: false },
    limits: {
      wallClockMs: 4000,
      maxStdoutBytes: 16 * 1024,
      maxStderrBytes: 16 * 1024
    }
  });
}

function executionEnvelope({ workspace, executable, script, operation = 'b' }) {
  return createExecutionEnvelope({
    runtimeProfile: runtimeProfile(),
    authorizedWorkspacePhysicalRoot: workspace,
    repositoryIdentity: 'external-review-demo-repository',
    authorityFingerprint: 'a'.repeat(64),
    operationFingerprint: operation.repeat(64),
    argv: [executable, '-e', script],
    cwd: '.',
    explicitEnvironment: {}
  });
}

function hasMount(plan, flag, source, destination) {
  for (let index = 0; index < plan.arguments.length - 2; index += 1) {
    if (plan.arguments[index] === flag && plan.arguments[index + 1] === source &&
        plan.arguments[index + 2] === destination) return true;
  }
  return false;
}

function hasBroadMountSource(plan, sources) {
  for (let index = 0; index < plan.arguments.length - 2; index += 1) {
    if ((plan.arguments[index] === '--bind' || plan.arguments[index] === '--ro-bind') &&
        sources.includes(plan.arguments[index + 1])) return true;
  }
  return false;
}

function boundedFailure(result, fixtureRoot) {
  const stderr = String(result && result.stderr || '')
    .replaceAll(fixtureRoot, '<fixture>')
    .replaceAll(os.homedir(), '<host-home>')
    .slice(0, 1024);
  return `${result && result.classification || 'UNKNOWN'}:${result && result.exitCode}:` +
    `${result && result.signal || 'none'}:${stderr}`;
}

function workloadScript(paths, port) {
  return `'use strict';\n` +
    `const fs=require('node:fs');const net=require('node:net');\n` +
    `const evidence={};\n` +
    `const deniedRead=(p)=>{try{fs.readFileSync(p);return false}catch{return true}};\n` +
    `const deniedWrite=(p)=>{try{fs.writeFileSync(p,'forbidden');return false}catch{return true}};\n` +
    `fs.writeFileSync('/workspace/authorized-effect','authorized');\n` +
    `evidence.authorizedWorkspaceWrite=true;\n` +
    `evidence.hostSentinelUnavailable=deniedRead(${JSON.stringify(paths.sentinel)});\n` +
    `evidence.writeOutsideAuthorizedWorkspace=deniedWrite(${JSON.stringify(paths.sentinel)});\n` +
    `evidence.hostHomeAbsent=!fs.existsSync(${JSON.stringify(paths.hostHome)})&&` +
      `fs.readdirSync(process.env.HOME).length===0;\n` +
    `evidence.dockerSocketAbsent=!fs.existsSync('/var/run/docker.sock');\n` +
    `evidence.ambientSecretAbsent=!process.env.${AMBIENT_SENTINEL_KEY};\n` +
    `evidence.symlinkEscapeDenied=deniedRead('/workspace/escape-link');\n` +
    `evidence.siblingWorkspaceAbsent=!fs.existsSync(${JSON.stringify(paths.siblingWorkspace)});\n` +
    `evidence.systemPathMutationDenied=deniedWrite('/usr/sdo-external-review-demo-write');\n` +
    `evidence.broadRuntimeTreeAbsent=!fs.existsSync(${JSON.stringify(paths.externalRuntime)})&&` +
      `!fs.existsSync('/runtime/SECRET_SIBLING');\n` +
    `let settled=false;const finish=(denied)=>{if(settled)return;settled=true;` +
      `evidence.hostLoopbackNetworkDenied=denied;process.stdout.write(JSON.stringify(evidence))};\n` +
    `const socket=net.createConnection({host:'127.0.0.1',port:${port}});\n` +
    `socket.once('connect',()=>{socket.destroy();finish(false)});\n` +
    `socket.once('error',()=>finish(true));\n` +
    `setTimeout(()=>{socket.destroy();finish(true)},700);\n`;
}

async function closeServer(server) {
  if (!server.listening) return;
  await new Promise((resolve) => server.close(resolve));
}

async function runReviewDemo() {
  if (classifyReviewDemoPlatform() !== 'SUPPORTED') {
    throw classifiedError('UNSUPPORTED_PLATFORM');
  }

  const fixtureRoot = fs.realpathSync(fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdo-external-review-demo-')
  ));
  const workspace = path.join(fixtureRoot, 'authorized-workspace');
  const siblingWorkspace = path.join(fixtureRoot, 'sibling-workspace');
  const sentinel = path.join(fixtureRoot, 'host-sentinel');
  const externalRuntime = path.join(fixtureRoot, 'host-tree', 'runtime');
  const externalExecutable = path.join(externalRuntime, 'authorized-node');
  const secretSibling = path.join(externalRuntime, 'SECRET_SIBLING');
  const fallbackCanary = path.join(workspace, 'native-fallback-canary');
  const server = net.createServer((socket) => socket.destroy());
  const previousAmbient = process.env[AMBIENT_SENTINEL_KEY];

  try {
    fs.mkdirSync(workspace);
    fs.mkdirSync(siblingWorkspace);
    fs.mkdirSync(externalRuntime, { recursive: true });
    fs.writeFileSync(sentinel, 'non-sensitive-host-sentinel\n');
    fs.writeFileSync(path.join(siblingWorkspace, 'marker'), 'non-sensitive-sibling-workspace\n');
    fs.writeFileSync(secretSibling, 'non-sensitive-runtime-sibling\n');
    fs.copyFileSync(process.execPath, externalExecutable);
    fs.chmodSync(externalExecutable, fs.statSync(process.execPath).mode & 0o777);
    fs.symlinkSync(sentinel, path.join(workspace, 'escape-link'));
    process.env[AMBIENT_SENTINEL_KEY] = 'non-sensitive-ambient-sentinel';

    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const provider = createLinuxBwrapExecutionProvider();
    const probe = provider.probe();
    if (!probe.available) {
      throw classifiedError('BUBBLEWRAP_PHYSICAL_PROBE_FAILED', probe.reason || 'unknown');
    }

    const paths = { sentinel, siblingWorkspace, hostHome: os.homedir(), externalRuntime };
    const envelope = executionEnvelope({
      workspace,
      executable: externalExecutable,
      script: workloadScript(paths, server.address().port)
    });
    const plan = provider.buildPlan(envelope);

    const exactMapping = plan.executableBinding.mode === 'exact-file-read-only' &&
      plan.executableBinding.guestPath === INTERNAL_AUTHORIZED_EXECUTABLE &&
      plan.executableBinding.hostPhysicalPath === fs.realpathSync(externalExecutable) &&
      hasMount(plan, '--ro-bind', fs.realpathSync(externalExecutable),
        INTERNAL_AUTHORIZED_EXECUTABLE);
    const broadMountAbsent = !hasBroadMountSource(plan, [
      externalRuntime,
      path.dirname(externalRuntime),
      os.homedir(),
      '/opt',
      '/usr/local'
    ]);

    const result = await provider.run(plan);
    requireCondition(result.classification === 'COMPLETED' && result.exitCode === 0,
      `ISOLATED_WORKLOAD_FAILED:${boundedFailure(result, fixtureRoot)}`);
    requireCondition(result.planDigest === plan.digest, 'RESULT_PLAN_DIGEST_MISMATCH');

    let childEvidence;
    try { childEvidence = JSON.parse(result.stdout); } catch {
      throw classifiedError('ISOLATED_EVIDENCE_INVALID');
    }

    const unavailableProvider = createLinuxBwrapExecutionProvider({
      binaryPath: path.join(fixtureRoot, 'unavailable-bwrap')
    });
    const fallbackEnvelope = executionEnvelope({
      workspace,
      executable: externalExecutable,
      operation: 'c',
      script: "require('fs').writeFileSync('/workspace/native-fallback-canary','unsafe')"
    });
    let unavailableFailedClosed = false;
    try {
      await unavailableProvider.run(unavailableProvider.buildPlan(fallbackEnvelope));
    } catch (error) {
      unavailableFailedClosed = error && error.code === 'ISOLATION_BACKEND_UNAVAILABLE';
    }

    let invalidExecutableRejected = false;
    try {
      executionEnvelope({
        workspace,
        executable: path.join(fixtureRoot, 'missing-executable'),
        operation: 'd',
        script: 'process.exit(0)'
      });
    } catch (error) {
      invalidExecutableRejected = /cannot be physically resolved/.test(error.message);
    }

    const checks = {
      AUTHORIZED_WORKSPACE_WRITE: childEvidence.authorizedWorkspaceWrite === true &&
        fs.readFileSync(path.join(workspace, 'authorized-effect'), 'utf8') === 'authorized',
      HOST_SENTINEL_UNAVAILABLE: childEvidence.hostSentinelUnavailable === true &&
        fs.readFileSync(sentinel, 'utf8') === 'non-sensitive-host-sentinel\n',
      D01_WRITE_OUTSIDE_AUTHORIZED_WORKSPACE:
        childEvidence.writeOutsideAuthorizedWorkspace === true,
      D02_READ_HOST_HOME: childEvidence.hostHomeAbsent === true,
      D03_ACCESS_DOCKER_SOCKET: childEvidence.dockerSocketAbsent === true,
      D04_AMBIENT_SECRET_INHERITANCE: childEvidence.ambientSecretAbsent === true,
      D05_HOST_LOOPBACK_NETWORK_ACCESS: childEvidence.hostLoopbackNetworkDenied === true,
      D06_SYMLINK_WORKSPACE_ESCAPE: childEvidence.symlinkEscapeDenied === true,
      D07_SIBLING_WORKSPACE_ACCESS: childEvidence.siblingWorkspaceAbsent === true,
      D08_SYSTEM_PATH_MUTATION: childEvidence.systemPathMutationDenied === true,
      D09_UNAVAILABLE_BUBBLEWRAP: unavailableFailedClosed,
      D10_UNAUTHORIZED_INVALID_EXECUTABLE: invalidExecutableRejected,
      D11_BROAD_RUNTIME_TREE_EXPOSURE:
        childEvidence.broadRuntimeTreeAbsent === true && broadMountAbsent,
      D12_NATIVE_FALLBACK: unavailableFailedClosed && !fs.existsSync(fallbackCanary),
      EXACT_RUNTIME_EXECUTABLE_MAPPING: exactMapping,
      RESULT_PLAN_DIGEST_BOUND: result.planDigest === plan.digest
    };
    const normalizedChecks = Object.fromEntries(REQUIRED_CHECKS.map((name) =>
      [name, checks[name] === true ? 'PASS' : 'FAIL']));
    const failed = Object.values(normalizedChecks).filter((value) => value !== 'PASS').length;
    requireCondition(failed === 0, 'REQUIRED_SECURITY_CHECK_FAILED');

    const securityEvidence = canonicalize({
      schema: SCHEMA,
      baselineSha: BASELINE_SHA,
      platform: 'linux',
      harness: HARNESS,
      authorityInput: 'FIXED_PREAUTHORIZED_REVIEW_FIXTURE',
      humanAuthorityDemonstrated: false,
      authorityModelChanged: false,
      productionWiring: false,
      isolationBackend: 'linux-bwrap',
      networkDefault: 'deny',
      nativeFallback: false,
      executableBinding: {
        mode: 'exact-file-read-only',
        guestPath: INTERNAL_AUTHORIZED_EXECUTABLE,
        broadParentRuntimeTreeExposed: false
      },
      checks: normalizedChecks
    });

    return deepFreeze({
      ...securityEvidence,
      physicalProbe: 'PASS',
      planDigestBound: true,
      requiredChecksTotal: REQUIRED_CHECKS.length,
      requiredChecksFailed: 0,
      requiredChecksSkipped: 0,
      unauthorizedHostMutations: 0,
      securityDigest: securityDigest(securityEvidence),
      result: 'PASS'
    });
  } finally {
    if (previousAmbient === undefined) delete process.env[AMBIENT_SENTINEL_KEY];
    else process.env[AMBIENT_SENTINEL_KEY] = previousAmbient;
    await closeServer(server);
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function safeError(error) {
  const code = error && error.code || 'DEMO_FAILED';
  return {
    schema: 'sdo.external-review-demo-error/v1',
    result: code === 'UNSUPPORTED_PLATFORM' ? 'UNSUPPORTED_PLATFORM' : 'FAIL',
    errorCode: String(code).slice(0, 160)
  };
}

if (require.main === module) {
  runReviewDemo().then((evidence) => {
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify(safeError(error))}\n`);
    process.exitCode = error && error.code === 'UNSUPPORTED_PLATFORM' ? 2 : 1;
  });
}

module.exports = deepFreeze({
  BASELINE_SHA,
  SCHEMA,
  HARNESS,
  REQUIRED_CHECKS,
  classifyReviewDemoPlatform,
  runReviewDemo,
  securityDigest
});
