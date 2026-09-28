'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');

const {
  CONFIG_SCHEMA,
  PRODUCT_VERSION,
  createDefaultConfiguration,
  validateConfiguration,
} = require('../../accelerator/product/customer-configuration');
const {
  initializeCustomerState,
  inspectCustomerState,
  doctorCustomerState,
  onboardRepository,
  createSupportBundle,
  backupCustomerState,
  restoreCustomerState,
  uninstallCustomerRuntime,
  configureCustomerProvider,
} = require('../../accelerator/product/customer-runtime');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surgical-product-runtime-'));
  const stateRoot = path.join(root, 'state');
  return { root, stateRoot };
}

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

function repository(root, name = 'repo') {
  const repo = path.join(root, name);
  fs.mkdirSync(repo);
  git(repo, ['init', '-b', 'main']);
  git(repo, ['config', 'user.email', 'customer@example.invalid']);
  git(repo, ['config', 'user.name', 'Customer Fixture']);
  fs.writeFileSync(path.join(repo, 'target.js'), 'const value = 1;\n');
  git(repo, ['add', 'target.js']);
  git(repo, ['commit', '-m', 'fixture']);
  return fs.realpathSync(repo);
}

test('profiles are policy overlays and financial defaults fail closed', () => {
  const developer = createDefaultConfiguration({ profile: 'developer' });
  const enterprise = createDefaultConfiguration({ profile: 'enterprise' });
  const financial = createDefaultConfiguration({ profile: 'financial' });
  for (const config of [developer, enterprise, financial]) {
    assert.equal(config.schema, CONFIG_SCHEMA);
    assert.equal(config.productVersion, PRODUCT_VERSION);
    assert.equal(config.production.eligible, false);
    assert.equal(config.authority.configurationIsAuthority, false);
    assert.equal(config.authority.profileIsAuthority, false);
    assert.equal(config.repository.automaticEnrollment, false);
  }
  assert.equal(financial.telemetry.externalEnabled, false);
  assert.equal(financial.network.mode, 'DENY_BY_DEFAULT');
  assert.equal(financial.provider.networkAllowed, false);
  assert.equal(financial.enterpriseIdentity.requiredForProduction, true);
  assert.equal(enterprise.enterpriseIdentity.status, 'UNSUPPORTED');
});

test('configuration is exact, versioned, credential-reference only, and never authority', () => {
  const config = createDefaultConfiguration({ profile: 'developer' });
  assert.deepEqual(validateConfiguration(config), config);
  assert.throws(() => validateConfiguration({ ...config, surprise: true }), /unknown|exact/i);
  assert.throws(() => validateConfiguration({
    ...config,
    provider: { ...config.provider, credentialReference: 'plaintext:secret' },
  }), /credential reference/i);
  assert.throws(() => validateConfiguration({
    ...config,
    authority: { ...config.authority, configurationIsAuthority: true },
  }), /authority/i);
});

test('initialization is private restart-safe and cannot overwrite unexplained state', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const first = initializeCustomerState({ stateRoot: state.stateRoot, profile: 'developer' });
  assert.equal(first.classification, 'INITIALIZED');
  assert.equal(fs.statSync(state.stateRoot).mode & 0o077, 0);
  const second = initializeCustomerState({ stateRoot: state.stateRoot, profile: 'developer' });
  assert.equal(second.classification, 'ALREADY_INITIALIZED');
  fs.writeFileSync(path.join(state.stateRoot, 'unexplained'), 'x');
  assert.throws(
    () => initializeCustomerState({ stateRoot: state.stateRoot, profile: 'developer' }),
    /unexplained/i,
  );
});

test('doctor is inspection-only and distinguishes readiness from authority', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  initializeCustomerState({ stateRoot: state.stateRoot, profile: 'financial' });
  const before = inspectCustomerState({ stateRoot: state.stateRoot });
  const report = doctorCustomerState({ stateRoot: state.stateRoot });
  const after = inspectCustomerState({ stateRoot: state.stateRoot });
  assert.equal(report.overall, 'PASS_WITH_LIMITATIONS');
  assert.equal(report.authority.status, 'AUTHORITY_UNAVAILABLE');
  assert.equal(report.production.status, 'PRODUCTION_DISABLED');
  assert.equal(report.protocols.v1.digest, 'cd4e3fa7d7086f78291ef35b87e1b450be15bc77cb6ae8527e299101e5a11935');
  assert.equal(report.protocols.v2.digest, '0276897c7e22dc2cc77f049a4a329842abff50290ada1f946bce9747660d31e4');
  assert.deepEqual(after, before);
});

test('repository onboarding uses physical Git evidence and grants no authority', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  initializeCustomerState({ stateRoot: state.stateRoot, profile: 'developer' });
  const repo = repository(state.root);
  const enrolled = onboardRepository({ stateRoot: state.stateRoot, repositoryPath: repo });
  assert.equal(enrolled.path, repo);
  assert.equal(enrolled.branch, 'main');
  assert.match(enrolled.head, /^[a-f0-9]{40}$/);
  assert.equal(enrolled.authorityGranted, false);
  const alias = path.join(state.root, 'alias');
  fs.symlinkSync(repo, alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(
    () => onboardRepository({ stateRoot: state.stateRoot, repositoryPath: alias }),
    /physical|symlink|canonical/i,
  );
});

test('support bundle sanitizes hostile content and excludes source authority and credentials', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  initializeCustomerState({ stateRoot: state.stateRoot, profile: 'developer' });
  const bundle = createSupportBundle({
    stateRoot: state.stateRoot,
    recentErrors: ['Bearer should-not-leak', '-----BEGIN PRIVATE KEY-----', 'STALE_CAS'],
  });
  const serialized = JSON.stringify(bundle);
  assert.doesNotMatch(serialized, /should-not-leak|BEGIN PRIVATE KEY/);
  assert.equal(Object.hasOwn(bundle.configuration.provider, 'credentialReference'), false);
  assert.match(serialized, /REDACTED/);
  assert.equal(Object.hasOwn(bundle, 'environment'), false);
  assert.equal(Object.hasOwn(bundle, 'repositorySource'), false);
  assert.equal(Object.hasOwn(bundle, 'authorityMaterial'), false);
  assert.equal(bundle.doctor.stateRoot.writable, true);
});

test('backup restore and uninstall preserve evidence and never resurrect authority', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  initializeCustomerState({ stateRoot: state.stateRoot, profile: 'developer' });
  fs.writeFileSync(path.join(state.stateRoot, 'evidence', 'sample.json'), JSON.stringify({ schema: 'sample.v1' }));
  const backupPath = path.join(state.root, 'backup.json');
  const backup = backupCustomerState({ stateRoot: state.stateRoot, outputPath: backupPath });
  assert.equal(backup.authorityIncluded, false);
  const restoredRoot = path.join(state.root, 'restored');
  const restored = restoreCustomerState({ stateRoot: restoredRoot, backupPath });
  assert.equal(restored.authorityRestored, false);
  assert.equal(fs.existsSync(path.join(restoredRoot, 'evidence', 'sample.json')), true);
  const removal = uninstallCustomerRuntime({ stateRoot: restoredRoot, purgeData: false });
  assert.equal(removal.evidencePreserved, true);
  assert.equal(fs.existsSync(path.join(restoredRoot, 'evidence', 'sample.json')), true);
});

test('provider configuration uses references, never fallback or operational authority', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  initializeCustomerState({ stateRoot: state.stateRoot, profile: 'financial' });
  assert.throws(() => configureCustomerProvider({
    stateRoot: state.stateRoot,
    kind: 'openai',
    endpoint: 'https://api.openai.example/v1',
    credentialReference: 'plaintext-value',
    networkAllowed: true,
  }), /credential reference/i);
  const configured = configureCustomerProvider({
    stateRoot: state.stateRoot,
    kind: 'openai',
    endpoint: 'https://api.openai.example/v1',
    credentialReference: 'env:OPENAI_API_KEY',
    networkAllowed: true,
  });
  assert.equal(configured.authorityGranted, false);
  assert.equal(configured.fallbackAllowed, false);
  assert.equal(configured.profile, 'financial');
  const stored = JSON.parse(fs.readFileSync(path.join(state.stateRoot, 'configuration.json'), 'utf8'));
  assert.equal(stored.provider.credentialReference, 'env:OPENAI_API_KEY');
  assert.equal(JSON.stringify(stored).includes('plaintext-value'), false);
  assert.equal(stored.production.eligible, false);
});
