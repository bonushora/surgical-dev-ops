'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const CLI = path.resolve(__dirname, '../../accelerator/cli/surgical.js');

function run(stateRoot, args, extra = {}) {
  return spawnSync(process.execPath, [CLI, ...args, '--state-root', stateRoot], {
    encoding: 'utf8',
    timeout: 20_000,
    env: { ...process.env, SURGICAL_PRODUCT_TEST: '1' },
    ...extra,
  });
}

test('customer CLI performs init doctor lifecycle demo evidence and safe removal', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-c-')));
  const stateRoot = path.join(root, 'state');
  t.after(() => {
    run(stateRoot, ['stop']);
    fs.rmSync(root, { recursive: true, force: true });
  });

  let result = run(stateRoot, ['init', '--profile', 'developer', '--json']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).classification, 'INITIALIZED');

  result = run(stateRoot, ['doctor', '--json']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(JSON.parse(result.stdout).overall, /^PASS/);

  result = run(stateRoot, ['start', '--json']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'READY');

  result = run(stateRoot, ['status', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const status = JSON.parse(result.stdout);
  assert.equal(status.runtimeStatus, 'READY');
  assert.equal(status.authorityState, 'AUTHORITY_INFRASTRUCTURE_QUALIFIED');
  assert.equal(status.mutationAuthorityGranted, false);
  assert.equal(status.productionEligibility, 'PRODUCTION_DISABLED');

  result = run(stateRoot, ['demo', '--approve-exact-demo', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const demo = JSON.parse(result.stdout);
  assert.equal(demo.physicalEffectCount, 1);
  assert.equal(demo.replayEffectCount, 0);
  assert.equal(demo.tests.status, 'GREEN');
  assert.equal(demo.cleanup.status, 'CLEAN');

  result = run(stateRoot, ['evidence', '--json']);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(JSON.parse(result.stdout).records.length >= 1);

  result = run(stateRoot, ['restart', '--json']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'READY');

  result = run(stateRoot, ['stop', '--json']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'STOPPED');

  result = run(stateRoot, ['uninstall', '--json']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).evidencePreserved, true);
});

test('product lifecycle rejects malformed state second instance and unsafe operations', (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-x-')));
  const stateRoot = path.join(root, 'state');
  t.after(() => {
    run(stateRoot, ['stop']);
    fs.rmSync(root, { recursive: true, force: true });
  });
  assert.equal(run(stateRoot, ['init', '--profile', 'financial']).status, 0);
  assert.equal(run(stateRoot, ['start']).status, 0);
  const second = run(stateRoot, ['start']);
  assert.notEqual(second.status, 0);
  assert.match(second.stderr, /already|running/i);
  const unsafeUpgrade = run(stateRoot, ['upgrade', '--apply']);
  assert.notEqual(unsafeUpgrade.status, 0);
  assert.match(unsafeUpgrade.stderr, /active|stop/i);
  const unsafeBackup = run(stateRoot, ['backup', path.join(root, 'backup.json')]);
  assert.notEqual(unsafeBackup.status, 0);
  assert.match(unsafeBackup.stderr, /active|stop/i);
  const unsafeUninstall = run(stateRoot, ['uninstall']);
  assert.notEqual(unsafeUninstall.status, 0);
  assert.match(unsafeUninstall.stderr, /active|stop/i);
});

test('customer product surfaces fail closed on absent approval corrupt state and stale endpoint', (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-f-')));
  const stateRoot = path.join(root, 'state');
  t.after(() => {
    run(stateRoot, ['stop']);
    fs.rmSync(root, { recursive: true, force: true });
  });
  assert.equal(run(stateRoot, ['init', '--profile', 'developer']).status, 0);
  const deniedDemo = run(stateRoot, ['demo']);
  assert.notEqual(deniedDemo.status, 0);
  assert.match(deniedDemo.stderr, /approval|authorization/i);
  assert.deepEqual(fs.readdirSync(path.join(stateRoot, 'evidence')), []);
  if (process.platform !== 'win32') {
    fs.writeFileSync(path.join(stateRoot, 'runtime', 'control.sock'), 'not-a-socket');
    const stale = run(stateRoot, ['start']);
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /readiness|stale|failed closed/i);
    fs.rmSync(path.join(stateRoot, 'runtime', 'control.sock'));
  }
  const configurationPath = path.join(stateRoot, 'configuration.json');
  const configuration = JSON.parse(fs.readFileSync(configurationPath, 'utf8'));
  fs.writeFileSync(configurationPath, JSON.stringify({ ...configuration, unknown: true }));
  const corrupt = run(stateRoot, ['doctor']);
  assert.notEqual(corrupt.status, 0);
  assert.match(corrupt.stderr, /unknown|schema|configuration/i);
});
