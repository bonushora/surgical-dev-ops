'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const {
  createRuntimeProfile,
  RUNTIME_PROFILE_VERSION
} = require('../../accelerator/core/execution-isolation/runtime-profile');
const {
  createExecutionEnvelope
} = require('../../accelerator/core/execution-isolation/execution-envelope');
const {
  createLinuxBwrapExecutionProvider
} = require('../../accelerator/adapters/linux-bwrap-execution-provider');
const {
  formatIsolationFailure
} = require('./execution-isolation-test-diagnostics');

const disposableRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-isolation-live-')));
const workspace = path.join(disposableRoot, 'authorized-workspace');
const secondWorkspace = path.join(disposableRoot, 'second-workspace');
const hostHome = path.join(disposableRoot, 'host-home');
const sentinel = path.join(disposableRoot, 'host-sentinel');
const externalRuntime = path.join(disposableRoot, 'host-tree', 'runtime');
const externalExecutable = path.join(externalRuntime, 'authorized-node');
fs.mkdirSync(workspace);
fs.mkdirSync(secondWorkspace);
fs.mkdirSync(hostHome);
fs.mkdirSync(externalRuntime, { recursive: true });
fs.writeFileSync(sentinel, 'host-sentinel-marker\n');
fs.writeFileSync(path.join(hostHome, 'secret-marker'), 'home-secret-marker\n');
fs.copyFileSync(process.execPath, externalExecutable);
fs.chmodSync(externalExecutable, fs.statSync(process.execPath).mode & 0o777);
fs.writeFileSync(path.join(externalRuntime, 'SECRET_SIBLING'), 'non-sensitive-sibling\n');
test.after(() => fs.rmSync(disposableRoot, { recursive: true, force: true }));

const provider = createLinuxBwrapExecutionProvider();
const liveProbe = provider.probe();
const liveOptions = liveProbe.available ? {} : { skip: `Bubblewrap unavailable: ${liveProbe.reason}` };

function profile(overrides = {}) {
  return createRuntimeProfile({
    version: RUNTIME_PROFILE_VERSION,
    backend: 'linux-bwrap',
    network: 'deny',
    filesystem: { workspace: 'rw', hostRoot: 'absent', temporary: 'ephemeral', extraMounts: [] },
    environment: { inherit: [] },
    process: { shell: false },
    limits: { wallClockMs: 3000, maxStdoutBytes: 8192, maxStderrBytes: 8192 },
    ...overrides
  });
}

function plan(script, options = {}) {
  const runtimeProfile = options.runtimeProfile || profile();
  const executionEnvelope = createExecutionEnvelope({
    runtimeProfile,
    authorizedWorkspacePhysicalRoot: workspace,
    repositoryIdentity: 'live-test-repository',
    authorityFingerprint: 'a'.repeat(64),
    operationFingerprint: 'b'.repeat(64),
    argv: [options.executable || process.execPath, '-e', script],
    cwd: '.',
    explicitEnvironment: options.explicitEnvironment || {}
  });
  return provider.buildPlan(executionEnvelope);
}

function failureEvidence(result) {
  return formatIsolationFailure(result, {
    redactions: [disposableRoot, os.homedir(), path.dirname(process.execPath)]
  });
}

test('LIVE01_BASIC_EXECUTION', liveOptions, async () => {
  const result = await provider.run(plan("process.stdout.write('isolated-ok')"));
  assert.equal(result.classification, 'COMPLETED', failureEvidence(result));
  assert.equal(result.exitCode, 0, failureEvidence(result));
  assert.equal(result.stdout, 'isolated-ok', failureEvidence(result));
});

test('LIVE02_WORKSPACE_WRITE', liveOptions, async () => {
  const destination = path.join(workspace, 'authorized-write');
  const result = await provider.run(plan(
    "require('fs').writeFileSync('/workspace/authorized-write','bounded-write')"
  ));
  assert.equal(result.classification, 'COMPLETED', failureEvidence(result));
  assert.equal(fs.readFileSync(destination, 'utf8'), 'bounded-write');
});

test('LIVE03_EXTERNAL_HOST_SENTINEL', liveOptions, async () => {
  const script = `try{require('fs').readFileSync(${JSON.stringify(sentinel)});process.exit(9)}catch{}`;
  const result = await provider.run(plan(script));
  assert.equal(result.exitCode, 0, failureEvidence(result));
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'host-sentinel-marker\n');
});

test('LIVE04_SYMLINK_ESCAPE', liveOptions, async () => {
  const link = path.join(workspace, 'sentinel-link');
  try { fs.symlinkSync(sentinel, link); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const result = await provider.run(plan(
    "try{require('fs').readFileSync('/workspace/sentinel-link');process.exit(9)}catch{}"
  ));
  assert.equal(result.exitCode, 0, failureEvidence(result));
});

test('LIVE05_SECOND_WORKSPACE', liveOptions, async () => {
  fs.writeFileSync(path.join(secondWorkspace, 'marker'), 'workspace-b');
  const script = `if(require('fs').existsSync(${JSON.stringify(secondWorkspace)}))process.exit(9)`;
  const result = await provider.run(plan(script));
  assert.equal(result.exitCode, 0, failureEvidence(result));
});

test('LIVE06_HOME_SECRET', liveOptions, async () => {
  const marker = path.join(hostHome, 'secret-marker');
  const script = `const f=require('fs');if(f.existsSync(${JSON.stringify(marker)})||` +
    "f.readdirSync(process.env.HOME).length)process.exit(9)";
  const result = await provider.run(plan(script));
  assert.equal(result.exitCode, 0, failureEvidence(result));
});

test('LIVE07_ENV_SECRET', liveOptions, async () => {
  const before = process.env.SDO_ISOLATION_TEST_SECRET;
  process.env.SDO_ISOLATION_TEST_SECRET = `test-marker-${process.pid}`;
  try {
    const result = await provider.run(plan(
      "if(process.env.SDO_ISOLATION_TEST_SECRET)process.exit(9)"
    ));
    assert.equal(result.exitCode, 0, failureEvidence(result));
  } finally {
    if (before === undefined) delete process.env.SDO_ISOLATION_TEST_SECRET;
    else process.env.SDO_ISOLATION_TEST_SECRET = before;
  }
});

test('LIVE08_DOCKER_SOCKET', liveOptions, async () => {
  const result = await provider.run(plan(
    "if(require('fs').existsSync('/var/run/docker.sock'))process.exit(9)"
  ));
  assert.equal(result.exitCode, 0, failureEvidence(result));
});

test('LIVE09_NETWORK_HOST_SERVICE', liveOptions, async () => {
  const server = net.createServer(() => {});
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const port = server.address().port;
    const script = `const s=require('net').createConnection({host:'127.0.0.1',port:${port}});` +
      "s.on('connect',()=>process.exit(9));s.on('error',()=>process.exit(0));" +
      "setTimeout(()=>process.exit(0),500)";
    const result = await provider.run(plan(script));
    assert.equal(result.exitCode, 0, failureEvidence(result));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('LIVE10_WRITE_SYSTEM_PATH', liveOptions, async () => {
  const result = await provider.run(plan(
    "try{require('fs').writeFileSync('/usr/sdo-isolation-write','x');process.exit(9)}catch{}"
  ));
  assert.equal(result.exitCode, 0, failureEvidence(result));
});

test('LIVE11_TIMEOUT', liveOptions, async () => {
  const late = path.join(workspace, 'late-timeout-write');
  const timeoutProfile = profile({
    limits: { wallClockMs: 100, maxStdoutBytes: 8192, maxStderrBytes: 8192 }
  });
  const result = await provider.run(plan(
    "setTimeout(()=>require('fs').writeFileSync('/workspace/late-timeout-write','late'),500);" +
    'setInterval(()=>{},1000)', { runtimeProfile: timeoutProfile }
  ));
  assert.equal(result.classification, 'WALL_CLOCK_TIMEOUT', failureEvidence(result));
  await new Promise((resolve) => setTimeout(resolve, 700));
  assert.equal(fs.existsSync(late), false);
});

test('LIVE12_OUTPUT_BOUND', liveOptions, async () => {
  const outputProfile = profile({
    limits: { wallClockMs: 3000, maxStdoutBytes: 256, maxStderrBytes: 256 }
  });
  const result = await provider.run(plan("process.stdout.write('x'.repeat(8192))", {
    runtimeProfile: outputProfile
  }));
  assert.equal(result.classification, 'STDOUT_LIMIT_EXCEEDED', failureEvidence(result));
  assert.equal(result.stdoutBytes, 256, failureEvidence(result));
});

test('LIVE13_NATIVE_FALLBACK_CANARY', liveOptions, async () => {
  const canary = path.join(workspace, 'native-fallback-canary');
  const unavailableProvider = createLinuxBwrapExecutionProvider({
    binaryPath: '/definitely/unavailable/bwrap'
  });
  const executionEnvelope = createExecutionEnvelope({
    runtimeProfile: profile(),
    authorizedWorkspacePhysicalRoot: workspace,
    repositoryIdentity: 'live-test-repository',
    authorityFingerprint: 'a'.repeat(64),
    operationFingerprint: 'c'.repeat(64),
    argv: [process.execPath, '-e',
      "require('fs').writeFileSync('/workspace/native-fallback-canary','unsafe')"],
    cwd: '.',
    explicitEnvironment: {}
  });
  await assert.rejects(unavailableProvider.run(unavailableProvider.buildPlan(executionEnvelope)),
    { code: 'ISOLATION_BACKEND_UNAVAILABLE' });
  assert.equal(fs.existsSync(canary), false);
});

test('LIVE14_EXACT_WORKSPACE_ONLY', liveOptions, async () => {
  const sentinelBefore = fs.readFileSync(sentinel, 'utf8');
  const secondBefore = fs.readdirSync(secondWorkspace).sort();
  const result = await provider.run(plan(
    "require('fs').writeFileSync('/workspace/exact-only','ok');" +
    "require('fs').writeFileSync('/tmp/ephemeral','ok')"
  ));
  assert.equal(result.exitCode, 0, failureEvidence(result));
  assert.equal(fs.readFileSync(path.join(workspace, 'exact-only'), 'utf8'), 'ok');
  assert.equal(fs.readFileSync(sentinel, 'utf8'), sentinelBefore);
  assert.deepEqual(fs.readdirSync(secondWorkspace).sort(), secondBefore);
});

test('LIVE15_PORTABLE_EXTERNAL_EXECUTABLE_EXACT_FILE', liveOptions, async () => {
  const physicalExecutable = fs.realpathSync(externalExecutable);
  const script = `const f=require('fs');` +
    `if(f.existsSync(${JSON.stringify(externalRuntime)})||` +
    `f.existsSync('/runtime/SECRET_SIBLING'))process.exit(9);` +
    `process.stdout.write('portable-external-ok')`;
  const executionPlan = plan(script, { executable: physicalExecutable });
  assert.deepEqual(executionPlan.executableBinding, {
    hostPhysicalPath: physicalExecutable,
    guestPath: '/runtime/authorized-executable',
    mode: 'exact-file-read-only'
  });
  assert.equal(executionPlan.arguments.includes(externalRuntime), false);
  const result = await provider.run(executionPlan);
  assert.equal(result.classification, 'COMPLETED', failureEvidence(result));
  assert.equal(result.exitCode, 0, failureEvidence(result));
  assert.equal(result.stdout, 'portable-external-ok', failureEvidence(result));
});
