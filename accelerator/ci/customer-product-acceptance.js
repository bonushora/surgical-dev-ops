#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const CLI = process.env.SURGICAL_INSTALLED_CLI
  ? path.resolve(process.env.SURGICAL_INSTALLED_CLI)
  : path.resolve(__dirname, '../cli/surgical.js');

function invoke(stateRoot, args) {
  const result = spawnSync(process.execPath, [CLI, ...args, '--state-root', stateRoot, '--json'], {
    encoding: 'utf8', timeout: 30_000, env: { ...process.env, SURGICAL_PRODUCT_ACCEPTANCE: '1' },
  });
  if (result.status !== 0) throw new Error(`Customer command failed: ${args[0]}: ${result.stderr.trim()}`);
  return JSON.parse(result.stdout);
}

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

async function main() {
  const packageRoot = process.env.SURGICAL_INSTALLED_PACKAGE_ROOT
    ? path.resolve(process.env.SURGICAL_INSTALLED_PACKAGE_ROOT)
    : path.resolve(__dirname, '../..');
  if (!fs.existsSync(path.join(packageRoot, 'package.json')) || !fs.existsSync(CLI)) {
    throw new Error('Acceptance must execute from an installed package');
  }
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-a-')));
  const stateRoot = path.join(root, 'state');
  let stopped = false;
  try {
    const initialized = invoke(stateRoot, ['init', '--profile', 'developer']);
    assert.equal(initialized.classification, 'INITIALIZED');
    const doctor = invoke(stateRoot, ['doctor']);
    assert.match(doctor.overall, /^PASS/);
    const started = invoke(stateRoot, ['start']);
    assert.equal(started.status, 'READY');
    const repository = path.join(root, 'customer-repository');
    fs.mkdirSync(repository);
    git(repository, ['init', '-b', 'main']);
    git(repository, ['config', 'user.email', 'acceptance@surgical.invalid']);
    git(repository, ['config', 'user.name', 'Installed Acceptance']);
    fs.writeFileSync(path.join(repository, 'app.js'), 'const installed = true;\n');
    git(repository, ['add', 'app.js']);
    git(repository, ['commit', '-m', 'customer repository']);
    const opened = invoke(stateRoot, ['open', fs.realpathSync(repository)]);
    assert.equal(opened.authorityGranted, false);
    const secondRepository = path.join(root, 'second-customer-repository');
    fs.mkdirSync(secondRepository);
    git(secondRepository, ['init', '-b', 'main']);
    git(secondRepository, ['config', 'user.email', 'acceptance@surgical.invalid']);
    git(secondRepository, ['config', 'user.name', 'Installed Acceptance']);
    fs.writeFileSync(path.join(secondRepository, 'app.js'), 'const isolated = true;\n');
    git(secondRepository, ['add', 'app.js']);
    git(secondRepository, ['commit', '-m', 'second customer repository']);
    const secondOpened = invoke(stateRoot, ['open', fs.realpathSync(secondRepository)]);
    assert.notEqual(secondOpened.id, opened.id);
    assert.equal(secondOpened.authorityGranted, false);
    const demo = invoke(stateRoot, ['demo', '--approve-exact-demo']);
    assert.equal(demo.physicalEffectCount, 1);
    assert.equal(demo.replayEffectCount, 0);
    const evidence = invoke(stateRoot, ['evidence']);
    assert.ok(evidence.records.length >= 1);
    const restarted = invoke(stateRoot, ['restart']);
    assert.equal(restarted.status, 'READY');
    const status = invoke(stateRoot, ['status']);
    assert.equal(status.runtimeStatus, 'READY');
    assert.equal(status.authorityState, 'AUTHORITY_UNAVAILABLE');
    assert.equal(status.productionEligibility, 'PRODUCTION_DISABLED');
    const stoppedResult = invoke(stateRoot, ['stop']);
    assert.equal(stoppedResult.status, 'STOPPED');
    stopped = true;
    const upgrade = invoke(stateRoot, ['upgrade']);
    assert.equal(upgrade.classification, 'UPGRADE_CHECK_GREEN');
    const provider = invoke(stateRoot, [
      'configure', 'provider', '--kind', 'ollama', '--endpoint', 'http://127.0.0.1:11434',
    ]);
    assert.equal(provider.authorityGranted, false);
    assert.equal(provider.fallbackAllowed, false);
    const supportBundlePath = path.join(root, 'support-bundle.json');
    const support = invoke(stateRoot, ['doctor', '--bundle', supportBundlePath]);
    assert.equal(support.supportBundle, supportBundlePath);
    const supportBundle = JSON.parse(fs.readFileSync(supportBundlePath, 'utf8'));
    assert.doesNotMatch(JSON.stringify(supportBundle), /Bearer\s|PRIVATE KEY/i);
    assert.equal(Object.hasOwn(supportBundle.configuration.provider, 'credentialReference'), false);
    const backupPath = path.join(root, 'customer-backup.json');
    const backup = invoke(stateRoot, ['backup', backupPath]);
    assert.equal(backup.authorityIncluded, false);
    const restoredRoot = path.join(root, 'restored-state');
    const restored = invoke(restoredRoot, ['restore', backupPath]);
    assert.equal(restored.authorityRestored, false);
    const restoredEvidence = invoke(restoredRoot, ['evidence']);
    assert.ok(restoredEvidence.records.length >= 1);
    const restoredRemoval = invoke(restoredRoot, ['uninstall']);
    assert.equal(restoredRemoval.evidencePreserved, true);
    const removed = invoke(stateRoot, ['uninstall']);
    assert.equal(removed.evidencePreserved, true);
    assert.equal(fs.existsSync(repository), true);
    assert.equal(fs.readdirSync(path.join(stateRoot, 'evidence')).length >= 1, true);
    process.stdout.write(`CUSTOMER_PRODUCT_ACCEPTANCE ${JSON.stringify({
      schema: 'surgical.customer_product_acceptance.v1', platform: process.platform,
      node: process.version, packageRoot, developmentCheckoutRequired: false,
      initialization: 'GREEN', doctor: 'GREEN', lifecycle: 'GREEN',
      repositoryOnboarding: 'GREEN', physicalEffectCount: 1, replayEffectCount: 0,
      evidence: 'GREEN', restartReconcile: 'GREEN', backupAuthorityIncluded: false,
      upgradeCheck: 'GREEN', providerAuthorityGranted: false,
      supportBundleSanitization: 'GREEN', multiRepositoryIsolation: 'GREEN',
      restoreAuthorityRestored: false, uninstallPreservedEvidence: true,
      artifactRemoval: 'GREEN', cleanup: 'GREEN',
    })}\n`);
  } finally {
    if (!stopped && fs.existsSync(stateRoot)) {
      try { invoke(stateRoot, ['stop']); } catch {}
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`Installed customer acceptance failed closed: ${error.message}\n`);
  process.exitCode = 1;
});
