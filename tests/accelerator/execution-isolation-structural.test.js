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
  createLinuxBwrapExecutionProvider
} = require('../../accelerator/adapters/linux-bwrap-execution-provider');

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-isolation-structural-')));
const workspaceA = path.join(root, 'workspace-a');
const workspaceB = path.join(root, 'workspace-b');
fs.mkdirSync(workspaceA);
fs.mkdirSync(workspaceB);
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

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
    argv: ['/usr/bin/node', '--version'],
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
    argv: ['/usr/bin/node'],
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
  assert.notEqual(envelope().digest, envelope({ argv: ['/usr/bin/node', '-p', '1'] }).digest);
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
