'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
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
  createLinuxBwrapExecutionProvider,
  INTERNAL_AUTHORIZED_EXECUTABLE
} = require('../../accelerator/adapters/linux-bwrap-execution-provider');
const {
  formatIsolationFailure,
  MAX_DIAGNOSTIC_STDERR_BYTES
} = require('./execution-isolation-test-diagnostics');

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-isolation-structural-')));
const workspaceA = path.join(root, 'workspace-a');
const workspaceB = path.join(root, 'workspace-b');
fs.mkdirSync(workspaceA);
fs.mkdirSync(workspaceB);
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

function executableFixture(...segments) {
  const destination = path.join(root, ...segments);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(process.execPath, destination);
  fs.chmodSync(destination, fs.statSync(process.execPath).mode & 0o777);
  return fs.realpathSync(destination);
}

const externalExecutable = executableFixture('external-runtime', 'authorized-node');
const visibleExecutable = executableFixture('visible-runtime', 'authorized-node');
const simulatedHomeExecutable = executableFixture(
  'simulated-home', '.nvm', 'versions', 'node', 'current', 'bin', 'node');
const simulatedOptExecutable = executableFixture(
  'simulated-opt', 'hostedtoolcache', 'node', 'current', 'x64', 'bin', 'node');

function rawProfile(overrides = {}) {
  return {
    version: RUNTIME_PROFILE_VERSION,
    backend: 'linux-bwrap',
    network: 'deny',
    filesystem: { workspace: 'rw', hostRoot: 'absent', temporary: 'ephemeral', extraMounts: [] },
    environment: { inherit: [] },
    process: { shell: false },
    limits: { wallClockMs: 1000, maxStdoutBytes: 4096, maxStderrBytes: 4096 },
    ...overrides
  };
}

function envelope(overrides = {}) {
  return createExecutionEnvelope({
    runtimeProfile: createRuntimeProfile(rawProfile()),
    authorizedWorkspacePhysicalRoot: workspaceA,
    repositoryIdentity: 'repository-a',
    authorityFingerprint: 'a'.repeat(64),
    operationFingerprint: 'b'.repeat(64),
    argv: [process.execPath, '--version'],
    cwd: '.',
    explicitEnvironment: {},
    ...overrides
  });
}

test('A01 valid v1 policy accepted', () => {
  const profile = createRuntimeProfile(rawProfile());
  assert.equal(profile.version, RUNTIME_PROFILE_VERSION);
  assert.match(profile.digest, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(profile), true);
  assert.throws(() => createExecutionEnvelope({
    runtimeProfile: Object.freeze({ ...profile }),
    authorizedWorkspacePhysicalRoot: workspaceA,
    repositoryIdentity: 'repository-a',
    authorityFingerprint: 'a'.repeat(64),
    operationFingerprint: 'b'.repeat(64),
    argv: [process.execPath],
    cwd: '.',
    explicitEnvironment: {}
  }), /normalized immutable/);
});

test('A02 unknown policy field rejected', () => {
  assert.throws(() => createRuntimeProfile({ ...rawProfile(), surprise: true }), /shape/);
});

test('A03 unknown backend rejected', () => {
  assert.throws(() => createRuntimeProfile(rawProfile({ backend: 'native' })), /backend/);
});

test('A04 network allow rejected', () => {
  assert.throws(() => createRuntimeProfile(rawProfile({ network: 'allow' })), /network/);
});

test('A05 extra host mount rejected', () => {
  assert.throws(() => createRuntimeProfile(rawProfile({
    filesystem: { workspace: 'rw', hostRoot: 'absent', temporary: 'ephemeral', extraMounts: ['/'] }
  })), /filesystem/);
});

test('A06 shell=true rejected', () => {
  assert.throws(() => createRuntimeProfile(rawProfile({ process: { shell: true } })), /Shell/);
});

test('A07 string command or shell expression rejected', () => {
  assert.throws(() => envelope({ argv: '/bin/sh -c true' }), /argv/);
});

test('A08 empty argv rejected', () => {
  assert.throws(() => envelope({ argv: [] }), /argv/);
});

test('A09 invalid timeout rejected', () => {
  assert.throws(() => createRuntimeProfile(rawProfile({
    limits: { wallClockMs: 0, maxStdoutBytes: 10, maxStderrBytes: 10 }
  })), /wallClockMs/);
});

test('A10 invalid output limits rejected', () => {
  assert.throws(() => createRuntimeProfile(rawProfile({
    limits: { wallClockMs: 10, maxStdoutBytes: -1, maxStderrBytes: 10 }
  })), /maxStdoutBytes/);
});

test('A11 changed policy changes digest', () => {
  const first = createRuntimeProfile(rawProfile());
  const second = createRuntimeProfile(rawProfile({
    limits: { wallClockMs: 1001, maxStdoutBytes: 4096, maxStderrBytes: 4096 }
  }));
  assert.notEqual(first.digest, second.digest);
});

test('A12 changed workspace changes execution digest', () => {
  assert.notEqual(envelope().digest,
    envelope({ authorizedWorkspacePhysicalRoot: workspaceB }).digest);
});

test('A13 changed argv changes execution digest', () => {
  assert.notEqual(envelope().digest, envelope({ argv: [process.execPath, '-p', '1'] }).digest);
});

test('A14 changed authority fingerprint changes execution digest', () => {
  assert.notEqual(envelope().digest, envelope({ authorityFingerprint: 'c'.repeat(64) }).digest);
});

test('A15 backend unavailable fails closed', () => {
  const provider = createLinuxBwrapExecutionProvider({ binaryPath: '/definitely/missing/bwrap' });
  assert.equal(provider.probe().available, false);
});

test('A16 backend unavailable never executes native process', async () => {
  let workloadSpawns = 0;
  const processPort = {
    spawnSync() { return { error: Object.assign(new Error('missing'), { code: 'ENOENT' }) }; },
    spawn() { workloadSpawns += 1; throw new Error('must not execute'); }
  };
  const provider = createLinuxBwrapExecutionProvider({
    binaryPath: '/usr/bin/bwrap', processPort
  });
  const plan = provider.buildPlan(envelope());
  await assert.rejects(provider.run(plan), { code: 'ISOLATION_BACKEND_UNAVAILABLE' });
  assert.equal(workloadSpawns, 0);
});

test('A17 ambient environment inheritance denied', () => {
  assert.throws(() => createRuntimeProfile(rawProfile({ environment: { inherit: ['PATH'] } })),
    /inheritance/);
  assert.throws(() => envelope({ explicitEnvironment: { GITHUB_TOKEN: 'test-marker' } }),
    /not allowed/);
});

test('A18 workspace outside authorized physical root denied', () => {
  assert.throws(() => envelope({ cwd: workspaceB }), /within/);
});

test('A19 cwd symlink substitution denied', () => {
  const real = path.join(workspaceA, 'real');
  const link = path.join(workspaceA, 'link');
  fs.mkdirSync(real, { recursive: true });
  try { fs.symlinkSync(real, link); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  assert.throws(() => envelope({ cwd: 'link' }), /physically/);
});

test('A20 deterministic buildPlan returns equivalent plan', () => {
  const provider = createLinuxBwrapExecutionProvider();
  assert.deepEqual(provider.buildPlan(envelope()), provider.buildPlan(envelope()));
});

test('A21 plan contains no host-root writable mount', () => {
  const plan = createLinuxBwrapExecutionProvider().buildPlan(envelope());
  const writableSources = plan.arguments.flatMap((value, index, values) =>
    value === '--bind' ? [values[index + 1]] : []);
  assert.deepEqual(writableSources, [workspaceA]);
  assert.equal(writableSources.includes('/'), false);
});

test('A22 plan contains no Docker socket', () => {
  const plan = createLinuxBwrapExecutionProvider().buildPlan(envelope());
  assert.equal(plan.arguments.some((value) => value.includes('docker.sock')), false);
});

test('A23 plan contains no arbitrary HOME mount', () => {
  const plan = createLinuxBwrapExecutionProvider().buildPlan(envelope());
  assert.equal(plan.arguments.includes(os.homedir()), false);
  assert.equal(plan.arguments.includes('/tmp/home'), true);
});

test('A24 plan requests network namespace isolation', () => {
  const plan = createLinuxBwrapExecutionProvider().buildPlan(envelope());
  assert.equal(plan.arguments.includes('--unshare-net'), true);
});

test('A25 workload uses shell=false', () => {
  const plan = createLinuxBwrapExecutionProvider().buildPlan(envelope());
  assert.equal(plan.spawnOptions.shell, false);
  assert.equal(plan.arguments.includes('sh -c'), false);
});

test('R01 executable in an existing runtime root needs no exact-file mount', () => {
  const provider = createLinuxBwrapExecutionProvider({
    runtimeDirectories: [path.dirname(visibleExecutable)]
  });
  const plan = provider.buildPlan(envelope({ argv: [visibleExecutable, '--version'] }));
  assert.equal(plan.executableBinding.mode, 'system-runtime');
  assert.equal(plan.executableBinding.guestPath, visibleExecutable);
  assert.equal(plan.arguments.includes(INTERNAL_AUTHORIZED_EXECUTABLE), false);
});

test('R02 external executable receives one exact-file read-only binding', () => {
  const plan = createLinuxBwrapExecutionProvider().buildPlan(
    envelope({ argv: [externalExecutable, '--version'] }));
  const mountIndex = plan.arguments.findIndex((value, index, values) =>
    value === '--ro-bind' && values[index + 1] === externalExecutable);
  assert.notEqual(mountIndex, -1);
  assert.equal(plan.arguments[mountIndex + 2], INTERNAL_AUTHORIZED_EXECUTABLE);
  assert.deepEqual(plan.executableBinding, {
    hostPhysicalPath: externalExecutable,
    guestPath: INTERNAL_AUTHORIZED_EXECUTABLE,
    mode: 'exact-file-read-only'
  });
});

test('R03 external executable parent directory is not mounted', () => {
  const plan = createLinuxBwrapExecutionProvider().buildPlan(
    envelope({ argv: [externalExecutable] }));
  assert.equal(plan.arguments.includes(path.dirname(externalExecutable)), false);
});

test('R04 executable below simulated HOME does not expose the HOME tree', () => {
  const simulatedHome = path.join(root, 'simulated-home');
  const plan = createLinuxBwrapExecutionProvider().buildPlan(
    envelope({ argv: [simulatedHomeExecutable] }));
  assert.equal(plan.arguments.includes(simulatedHome), false);
  assert.equal(plan.executableBinding.hostPhysicalPath, simulatedHomeExecutable);
});

test('R05 executable below simulated opt does not expose the opt tree', () => {
  const simulatedOpt = path.join(root, 'simulated-opt');
  const plan = createLinuxBwrapExecutionProvider().buildPlan(
    envelope({ argv: [simulatedOptExecutable] }));
  assert.equal(plan.arguments.includes(simulatedOpt), false);
  assert.equal(plan.executableBinding.hostPhysicalPath, simulatedOptExecutable);
});

test('R06 symlink executable resolves to its exact physical target', () => {
  const link = path.join(root, 'executable-link');
  fs.symlinkSync(externalExecutable, link, 'file');
  const executionEnvelope = envelope({ argv: [link, '--version'] });
  assert.equal(executionEnvelope.argv[0], externalExecutable);
  const plan = createLinuxBwrapExecutionProvider().buildPlan(executionEnvelope);
  assert.equal(plan.executableBinding.hostPhysicalPath, externalExecutable);
});

test('R07 missing executable is rejected before plan construction', () => {
  assert.throws(() => envelope({ argv: [path.join(root, 'missing-executable')] }),
    /physically resolved/);
});

test('R08 directory cannot be authorized as an executable', () => {
  assert.throws(() => envelope({ argv: [workspaceA] }), /regular file/);
});

test('R08B non-executable file is rejected', {
  skip: process.platform === 'win32' ? 'Windows does not expose POSIX execute mode.' : false
}, () => {
  const notExecutable = path.join(root, 'not-executable');
  fs.writeFileSync(notExecutable, 'fixture');
  fs.chmodSync(notExecutable, 0o600);
  assert.throws(() => envelope({ argv: [notExecutable] }), /readable and executable/);
});

test('R09 physical executable mapping changes the deterministic plan digest', () => {
  const otherExecutable = executableFixture('other-runtime', 'authorized-node');
  const provider = createLinuxBwrapExecutionProvider();
  const first = provider.buildPlan(envelope({ argv: [externalExecutable] }));
  const second = provider.buildPlan(envelope({ argv: [otherExecutable] }));
  assert.notEqual(first.executableBinding.hostPhysicalPath,
    second.executableBinding.hostPhysicalPath);
  assert.notEqual(first.digest, second.digest);
});

test('R10 arbitrary additional runtime mount remains rejected', () => {
  assert.throws(() => createRuntimeProfile(rawProfile({
    filesystem: {
      workspace: 'rw', hostRoot: 'absent', temporary: 'ephemeral',
      extraMounts: [path.dirname(externalExecutable)]
    }
  })), /filesystem/);
});

test('R11 unavailable backend remains fail-closed without native fallback', async () => {
  let workloadSpawns = 0;
  const processPort = {
    spawnSync() { return { error: Object.assign(new Error('missing'), { code: 'ENOENT' }) }; },
    spawn() { workloadSpawns += 1; throw new Error('native fallback'); }
  };
  const provider = createLinuxBwrapExecutionProvider({ processPort });
  await assert.rejects(provider.run(provider.buildPlan(envelope())),
    { code: 'ISOLATION_BACKEND_UNAVAILABLE' });
  assert.equal(workloadSpawns, 0);
});

test('R12 failure diagnostics are bounded and redact physical paths', () => {
  const marker = path.join(root, 'private-marker');
  const formatted = formatIsolationFailure({
    classification: 'PROCESS_FAILED',
    exitCode: 1,
    signal: null,
    stderr: `${marker}:${'x'.repeat(MAX_DIAGNOSTIC_STDERR_BYTES * 2)}`,
    planDigest: 'd'.repeat(64)
  }, { redactions: [root] });
  const evidence = JSON.parse(formatted);
  assert.equal(evidence.classification, 'PROCESS_FAILED');
  assert.equal(evidence.stderr.includes(root), false);
  assert.ok(evidence.stderr.length <= MAX_DIAGNOSTIC_STDERR_BYTES);
  assert.deepEqual(Object.keys(evidence).sort(),
    ['classification', 'exitCode', 'planDigest', 'signal', 'stderr']);
});
