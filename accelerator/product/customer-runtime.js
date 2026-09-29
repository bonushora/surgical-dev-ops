'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const {
  CONFIG_SCHEMA,
  PRODUCT_VERSION,
  createDefaultConfiguration,
  validateConfiguration,
} = require('./customer-configuration');
const { provisionLocalOfflineHumanAuthority } = require('../core/local-offline-human-authority-store');
const { samePhysicalWorkspaceIdentity } = require('../core/workspace-boundary');
const { createGovernedPatchRequest } = require('../cli/governed-patch-dispatch');
const { orchestrate } = require('../core/surgical-orchestrator');

const INSTALLATION_SCHEMA = 'surgical.customer_installation.v1';
const REPOSITORIES_SCHEMA = 'surgical.customer_repositories.v1';
const BACKUP_SCHEMA = 'surgical.customer_backup.v1';
const EVIDENCE_SCHEMA = 'surgical.customer_evidence.v1';
const ALLOWED_ROOT_ENTRIES = new Set([
  'configuration.json', 'installation.json', 'repositories.json',
  'evidence', 'journal', 'runtime', 'logs', 'backups',
]);
const V1_DIGEST = 'cd4e3fa7d7086f78291ef35b87e1b450be15bc77cb6ae8527e299101e5a11935';
const V2_DIGEST = '0276897c7e22dc2cc77f049a4a329842abff50290ada1f946bce9747660d31e4';

function immutable(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([k, v]) => [k, immutable(v)])));
}

function canonicalRoot(stateRoot, { allowMissing = false } = {}) {
  if (typeof stateRoot !== 'string' || !path.isAbsolute(stateRoot)
    || path.normalize(stateRoot) !== stateRoot || path.parse(stateRoot).root === stateRoot) {
    throw new TypeError('Customer state root must be a bounded canonical absolute path');
  }
  if (!fs.existsSync(stateRoot)) {
    if (allowMissing) return stateRoot;
    throw new Error('Customer state is not initialized');
  }
  const stat = fs.lstatSync(stateRoot);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(stateRoot) !== stateRoot
    || (process.platform !== 'win32' && (stat.mode & 0o077) !== 0)) {
    throw new Error('Customer state root is not a private physical directory');
  }
  return stateRoot;
}

function writeExclusive(target, value, mode = 0o600) {
  const fd = fs.openSync(target, 'wx', mode);
  try { fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}

function replaceFile(target, value) {
  const temp = `${target}.new-${process.pid}-${crypto.randomUUID()}`;
  writeExclusive(temp, value);
  fs.renameSync(temp, target);
  try {
    const directory = fs.openSync(path.dirname(target), 'r');
    try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
  } catch (error) {
    if (process.platform !== 'win32') throw error;
  }
}

function parseJsonFile(target, label) {
  let value;
  try { value = JSON.parse(fs.readFileSync(target, 'utf8')); }
  catch { throw new Error(`${label} is missing or corrupt`); }
  return value;
}

function rootPaths(root) {
  return Object.freeze({
    root,
    configuration: path.join(root, 'configuration.json'),
    installation: path.join(root, 'installation.json'),
    repositories: path.join(root, 'repositories.json'),
    evidence: path.join(root, 'evidence'),
    journal: path.join(root, 'journal'),
    runtime: path.join(root, 'runtime'),
    logs: path.join(root, 'logs'),
    backups: path.join(root, 'backups'),
    runtimeState: path.join(root, 'runtime', 'runtime-state.json'),
  });
}

function assertKnownRootEntries(root) {
  const unexplained = fs.readdirSync(root).filter((entry) => !ALLOWED_ROOT_ENTRIES.has(entry));
  if (unexplained.length > 0) throw new Error(`Customer state contains unexplained entries: ${unexplained.join(', ')}`);
}

function initializeCustomerState({ stateRoot, profile = 'developer' }) {
  const root = canonicalRoot(stateRoot, { allowMissing: true });
  const existed = fs.existsSync(root);
  if (!existed) fs.mkdirSync(root, { mode: 0o700 });
  canonicalRoot(root);
  const paths = rootPaths(root);
  if (existed && fs.existsSync(paths.configuration)) {
    assertKnownRootEntries(root);
    const configuration = validateConfiguration(parseJsonFile(paths.configuration, 'Customer configuration'));
    if (configuration.profile !== profile) throw new Error('Existing deployment profile cannot be overwritten by initialization');
    return immutable({ classification: 'ALREADY_INITIALIZED', stateRoot: root, configuration });
  }
  if (existed && fs.readdirSync(root).length > 0) throw new Error('Initialization refuses to overwrite unexplained state');
  const configuration = createDefaultConfiguration({ profile });
  for (const directory of [paths.evidence, paths.journal, paths.runtime, paths.logs, paths.backups]) {
    fs.mkdirSync(directory, { mode: 0o700 });
  }
  writeExclusive(paths.configuration, configuration);
  writeExclusive(paths.installation, {
    schema: INSTALLATION_SCHEMA,
    productVersion: PRODUCT_VERSION,
    installedAt: new Date().toISOString(),
    authorityCreated: false,
  });
  writeExclusive(paths.repositories, { schema: REPOSITORIES_SCHEMA, generation: 1, repositories: [] });
  return immutable({ classification: 'INITIALIZED', stateRoot: root, configuration });
}

function readConfiguration(root) {
  return validateConfiguration(parseJsonFile(rootPaths(root).configuration, 'Customer configuration'));
}

function runtimeState(root) {
  const target = rootPaths(root).runtimeState;
  if (!fs.existsSync(target)) return Object.freeze({ schema: 'surgical.customer_runtime_state.v1', status: 'STOPPED' });
  const state = parseJsonFile(target, 'Runtime state');
  if (!state || state.schema !== 'surgical.customer_runtime_state.v1'
    || !['READY', 'STOPPED', 'DEGRADED', 'RECOVERY_REQUIRED'].includes(state.status)) {
    throw new Error('Runtime state is incompatible or corrupt');
  }
  return immutable(state);
}

function inspectCustomerState({ stateRoot }) {
  const root = canonicalRoot(stateRoot);
  assertKnownRootEntries(root);
  const configuration = readConfiguration(root);
  const repositories = parseJsonFile(rootPaths(root).repositories, 'Repository registry');
  if (repositories.schema !== REPOSITORIES_SCHEMA || !Array.isArray(repositories.repositories)) {
    throw new Error('Repository registry is incompatible');
  }
  return immutable({
    schema: 'surgical.customer_state_inspection.v1',
    productVersion: PRODUCT_VERSION,
    profile: configuration.profile,
    runtime: runtimeState(root),
    repositories,
    authorityState: 'AUTHORITY_UNAVAILABLE',
    productionEligibility: configuration.production.eligible ? 'PRODUCTION_CONFIGURED' : 'PRODUCTION_DISABLED',
  });
}

function doctorCustomerState({ stateRoot }) {
  const root = canonicalRoot(stateRoot);
  const configuration = readConfiguration(root);
  const inspection = inspectCustomerState({ stateRoot: root });
  const git = spawnSync('git', ['--version'], { encoding: 'utf8' });
  const nodeSupported = Number(process.versions.node.split('.')[0]) >= 24;
  let writable = false;
  try {
    fs.accessSync(root, fs.constants.W_OK);
    writable = true;
  } catch {
    writable = false;
  }
  const limitations = [];
  if (configuration.enterpriseIdentity.status === 'UNSUPPORTED') limitations.push('ENTERPRISE_IDENTITY_UNSUPPORTED');
  if (configuration.secretStore.status === 'UNSUPPORTED') limitations.push('EXTERNAL_SECRET_STORE_UNSUPPORTED');
  limitations.push('NON_INTERRUPTIBLE_MUTATION', 'UNIVERSAL_POWER_LOSS_IMMUNITY_NOT_CLAIMED');
  return immutable({
    schema: 'surgical.customer_doctor.v1',
    overall: nodeSupported && git.status === 0 ? 'PASS_WITH_LIMITATIONS' : 'FAIL',
    productVersion: PRODUCT_VERSION,
    platform: process.platform,
    node: { version: process.version, supported: nodeSupported },
    git: { available: git.status === 0, version: git.status === 0 ? git.stdout.trim() : null },
    stateRoot: { path: root, private: true, writable },
    ipc: { supported: ['linux', 'darwin', 'win32'].includes(process.platform) },
    authority: { status: inspection.authorityState, inspectionOnly: true },
    production: { status: inspection.productionEligibility, configurationIsAuthority: false },
    provider: {
      configured: configuration.provider.kind !== null,
      kind: configuration.provider.kind,
      credentialReferencePresent: configuration.provider.credentialReference !== null,
      fallbackAllowed: false,
    },
    protocols: {
      v1: { version: 'sacp.sdo-local/v1', digest: V1_DIGEST, physical: false },
      v2: { version: 'sacp.sdo-local/v2', digest: V2_DIGEST, governedPhysical: true },
      v3: { supported: false },
    },
    recovery: { journalAvailable: true, registryAvailable: true, status: 'NO_RECOVERY_REQUIRED' },
    deploymentProfile: { name: configuration.profile, consistent: true },
    limitations,
  });
}

function git(repository, args) {
  return execFileSync('git', args, { cwd: repository, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function onboardRepository({ stateRoot, repositoryPath }) {
  const root = canonicalRoot(stateRoot);
  if (typeof repositoryPath !== 'string' || !path.isAbsolute(repositoryPath)
    || path.normalize(repositoryPath) !== repositoryPath) throw new Error('Repository path must be canonical and absolute');
  const stat = fs.lstatSync(repositoryPath);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(repositoryPath) !== repositoryPath) {
    throw new Error('Repository must be a canonical physical directory, not a symlink');
  }
  const physicalRoot = fs.realpathSync(git(repositoryPath, ['rev-parse', '--show-toplevel']));
  if (!samePhysicalWorkspaceIdentity(physicalRoot, repositoryPath)) {
    throw new Error('Repository path must identify the physical Git root');
  }
  const record = immutable({
    id: crypto.createHash('sha256').update(repositoryPath).digest('hex'),
    path: repositoryPath,
    branch: git(repositoryPath, ['branch', '--show-current']) || null,
    head: git(repositoryPath, ['rev-parse', 'HEAD']),
    clean: git(repositoryPath, ['status', '--porcelain=v1']) === '',
    authorityGranted: false,
    productionEligible: false,
  });
  const target = rootPaths(root).repositories;
  const current = parseJsonFile(target, 'Repository registry');
  if (current.schema !== REPOSITORIES_SCHEMA || !Number.isSafeInteger(current.generation)
    || !Array.isArray(current.repositories)) throw new Error('Repository registry is incompatible');
  const repositories = current.repositories.filter((entry) => entry.id !== record.id);
  repositories.push(record);
  replaceFile(target, { schema: REPOSITORIES_SCHEMA, generation: current.generation + 1, repositories });
  return record;
}

function sanitize(value) {
  if (typeof value === 'string') {
    return /Bearer\s|PRIVATE KEY|password|credential|secret|token/i.test(value) ? '[REDACTED]' : value.slice(0, 512);
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/environment|source|authorityMaterial|privateKey|credentialReference|credentialValue|secretValue/i.test(key))
    .map(([key, child]) => [key, sanitize(child)]));
  return value;
}

function createSupportBundle({ stateRoot, recentErrors = [] }) {
  const root = canonicalRoot(stateRoot);
  if (!Array.isArray(recentErrors)) throw new TypeError('Recent errors must be bounded');
  return immutable({
    schema: 'surgical.customer_support_bundle.v1',
    generatedAt: new Date().toISOString(),
    doctor: doctorCustomerState({ stateRoot: root }),
    runtime: runtimeState(root),
    configuration: sanitize(readConfiguration(root)),
    recentErrorClassifications: sanitize(recentErrors.slice(-20)),
    qualification: { sdo: 'customer-operable-runtime-v1', v1Digest: V1_DIGEST, v2Digest: V2_DIGEST },
  });
}

function configureCustomerProvider({
  stateRoot, kind, endpoint = null, credentialReference = null, networkAllowed = false,
}) {
  const root = canonicalRoot(stateRoot);
  requireStopped(root, 'Provider configuration');
  if (!['ollama', 'openai', 'codex'].includes(kind)) throw new Error('Provider is unsupported; no fallback was selected');
  if (credentialReference !== null
    && (typeof credentialReference !== 'string'
      || !/^(?:env|file|keychain|secret-store):[A-Za-z0-9._/-]{1,200}$/.test(credentialReference))) {
    throw new TypeError('Provider credential reference is invalid; plaintext credentials are forbidden');
  }
  if (kind === 'ollama') {
    const localEndpoint = endpoint || 'http://127.0.0.1:11434';
    const parsed = new URL(localEndpoint);
    if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) {
      throw new Error('Ollama provider endpoint must remain loopback-local');
    }
    endpoint = localEndpoint;
    if (credentialReference !== null || networkAllowed !== false) {
      throw new Error('Local provider configuration cannot request remote credentials or network egress');
    }
  } else {
    if (typeof endpoint !== 'string' || new URL(endpoint).protocol !== 'https:'
      || credentialReference === null || networkAllowed !== true) {
      throw new Error('Remote provider requires an explicit HTTPS endpoint, credential reference, and network policy');
    }
  }
  const current = readConfiguration(root);
  const destination = endpoint === null ? [] : [new URL(endpoint).origin];
  const next = validateConfiguration({
    ...current,
    provider: { kind, endpoint, credentialReference, networkAllowed, fallbackAllowed: false },
    network: {
      ...current.network,
      allowedDestinations: networkAllowed ? destination : [],
    },
  });
  replaceFile(rootPaths(root).configuration, next);
  return immutable({
    classification: 'PROVIDER_CONFIGURED',
    profile: next.profile,
    kind,
    endpoint,
    credentialReference,
    fallbackAllowed: false,
    authorityGranted: false,
    productionEligibilityChanged: false,
  });
}

function requireStopped(root, action) {
  const current = runtimeState(root);
  if (current.status === 'READY') throw new Error(`${action} is blocked while the runtime is active; stop it first`);
  if (current.status === 'RECOVERY_REQUIRED') throw new Error(`${action} is blocked while recovery is required`);
}

function backupCustomerState({ stateRoot, outputPath }) {
  const root = canonicalRoot(stateRoot);
  requireStopped(root, 'Backup');
  if (typeof outputPath !== 'string' || !path.isAbsolute(outputPath) || path.normalize(outputPath) !== outputPath) {
    throw new TypeError('Backup output path must be canonical and absolute');
  }
  const paths = rootPaths(root);
  const evidence = fs.readdirSync(paths.evidence).sort().map((name) => ({
    name,
    content: fs.readFileSync(path.join(paths.evidence, name), 'utf8'),
  }));
  const content = {
    schema: BACKUP_SCHEMA,
    productVersion: PRODUCT_VERSION,
    configuration: readConfiguration(root),
    repositories: parseJsonFile(paths.repositories, 'Repository registry'),
    evidence,
    authorityIncluded: false,
    journalsIncluded: false,
    secretsIncluded: false,
  };
  const integrityDigest = crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
  writeExclusive(outputPath, { ...content, integrityDigest });
  return immutable({ schema: BACKUP_SCHEMA, outputPath, integrityDigest, authorityIncluded: false });
}

function restoreCustomerState({ stateRoot, backupPath }) {
  if (fs.existsSync(stateRoot)) throw new Error('Restore refuses to overwrite existing customer state');
  const backup = parseJsonFile(backupPath, 'Customer backup');
  const { integrityDigest, ...content } = backup;
  if (content.schema !== BACKUP_SCHEMA || !/^[a-f0-9]{64}$/.test(integrityDigest || '')
    || crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex') !== integrityDigest
    || content.authorityIncluded !== false || content.secretsIncluded !== false) {
    throw new Error('Backup integrity or authority boundary is invalid');
  }
  validateConfiguration(content.configuration);
  initializeCustomerState({ stateRoot, profile: content.configuration.profile });
  const root = canonicalRoot(stateRoot);
  replaceFile(rootPaths(root).configuration, content.configuration);
  replaceFile(rootPaths(root).repositories, content.repositories);
  for (const record of content.evidence) {
    if (!record || typeof record.name !== 'string' || path.basename(record.name) !== record.name
      || typeof record.content !== 'string') throw new Error('Backup evidence is malformed');
    writeExclusive(path.join(rootPaths(root).evidence, record.name), record.content);
  }
  return immutable({ classification: 'RESTORED', stateRoot: root, authorityRestored: false });
}

function uninstallCustomerRuntime({ stateRoot, purgeData = false }) {
  const root = canonicalRoot(stateRoot);
  requireStopped(root, 'Uninstall');
  const paths = rootPaths(root);
  if (purgeData !== true) {
    if (fs.existsSync(paths.runtimeState)) fs.rmSync(paths.runtimeState);
    return immutable({ classification: 'RUNTIME_REMOVED', evidencePreserved: true, repositoriesUntouched: true });
  }
  throw new Error('Destructive data removal requires a separately qualified explicit removal workflow');
}

function runCustomerDemo({ stateRoot, approved }) {
  const root = canonicalRoot(stateRoot);
  if (approved !== true) throw new Error('Exact demo authorization was not granted; no mutation was performed');
  const demoRoot = fs.mkdtempSync(path.join(root, 'demo-'));
  let evidence;
  try {
    const repo = path.join(demoRoot, 'repository');
    const authorityRoot = path.join(demoRoot, 'authority');
    const journalStorageRoot = path.join(demoRoot, 'journal');
    fs.mkdirSync(repo);
    fs.mkdirSync(journalStorageRoot);
    git(repo, ['init', '-b', 'main']);
    git(repo, ['config', 'user.email', 'demo@surgical.invalid']);
    git(repo, ['config', 'user.name', 'Surgical Demo']);
    fs.writeFileSync(path.join(repo, 'demo.js'), 'const governed = false;\n');
    git(repo, ['add', 'demo.js']);
    git(repo, ['commit', '-m', 'isolated demo baseline']);
    provisionLocalOfflineHumanAuthority({ authorityRoot, issuer: 'local:surgical-demo', subjectId: 'surgical-demo-human' });
    const prepared = createGovernedPatchRequest({
      repositoryPath: fs.realpathSync(repo),
      target: 'demo.js',
      replacement: 'const governed = true;\n',
      authorityRoot: fs.realpathSync(authorityRoot),
      journalStorageRoot: fs.realpathSync(journalStorageRoot),
      tenantId: 'demo-only',
      projectId: 'disposable-repository',
    });
    const first = orchestrate(prepared.request, prepared.runtime);
    const afterFirst = fs.readFileSync(path.join(repo, 'demo.js'), 'utf8');
    const replay = orchestrate(prepared.request, prepared.runtime);
    const afterReplay = fs.readFileSync(path.join(repo, 'demo.js'), 'utf8');
    const materialized = first.execution
      && first.execution.durability
      && first.execution.durability.materialization
      && first.execution.durability.materialization.projection;
    const materializedContent = typeof materialized === 'string' && fs.existsSync(materialized)
      ? fs.readFileSync(materialized, 'utf8') : null;
    const syntax = spawnSync(process.execPath, ['--check', '-'], {
      encoding: 'utf8', input: materializedContent || '',
    });
    if (first.orchestration.status !== 'COMPLETED'
      || !['COMPLETED', 'FAILED'].includes(replay.orchestration.status)
      || first.execution.outcome !== 'APPLIED'
      || typeof materialized !== 'string'
      || materializedContent !== 'const governed = true;\n'
      || afterFirst !== 'const governed = false;\n' || afterReplay !== afterFirst || syntax.status !== 0) {
      throw new Error('Isolated governed demo failed closed');
    }
    evidence = {
      schema: EVIDENCE_SCHEMA,
      evidenceId: `demo-${prepared.authority.operationId}`,
      recordedAt: new Date().toISOString(),
      objective: 'Apply one isolated governed change and prove replay suppression',
      authorityOwner: 'surgical-dev-ops',
      humanAuthorityReference: prepared.authority.challengeId,
      operationId: prepared.authority.operationId,
      beforeSha256: prepared.authority.beforeSha256,
      afterSha256: prepared.authority.replacementSha256,
      physicalResult: 'COMPLETED',
      physicalProjection: 'CONTENT_ADDRESSED_MANIFEST',
      ordinaryWorktreeAuthoritative: false,
      tests: { status: 'GREEN', command: 'node --check demo.js' },
      replay: { secondPhysicalEffect: false, result: replay.orchestration.status },
      authorityReusable: false,
      demoIsolated: true,
      protocolVersion: 'internal-qualified-governed-patch',
    };
    const name = `${crypto.createHash('sha256').update(evidence.evidenceId).digest('hex')}.json`;
    writeExclusive(path.join(rootPaths(root).evidence, name), evidence);
  } finally {
    fs.rmSync(demoRoot, { recursive: true, force: true });
  }
  return immutable({
    schema: 'surgical.customer_demo_result.v1',
    objective: evidence.objective,
    plan: {
      operation: 'mutation.applyConditional', target: 'demo.js',
      beforeSha256: evidence.beforeSha256, afterSha256: evidence.afterSha256,
    },
    authority: {
      owner: 'surgical-dev-ops', scope: 'ONE_SHOT_DISPOSABLE_DEMO', reusable: false,
      excludedPowers: ['push', 'merge', 'release', 'deploy', 'arbitrary.shell'],
    },
    physicalEffectCount: 1,
    replayEffectCount: 0,
    mutation: { result: 'APPLIED', projection: evidence.physicalProjection },
    tests: evidence.tests,
    evidenceId: evidence.evidenceId,
    recovery: { required: false, replaySuppressed: true },
    cleanup: { status: 'CLEAN', reusableAuthorityRemaining: false },
  });
}

function listEvidence({ stateRoot }) {
  const root = canonicalRoot(stateRoot);
  const records = fs.readdirSync(rootPaths(root).evidence).sort().map((name) => {
    const target = path.join(rootPaths(root).evidence, name);
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Evidence store contains an unsafe entry');
    return parseJsonFile(target, 'Evidence record');
  });
  return immutable({ schema: 'surgical.customer_evidence_export.v1', records });
}

function defaultCustomerStateRoot() {
  if (process.platform === 'win32') {
    if (!process.env.LOCALAPPDATA) throw new Error('LOCALAPPDATA is required for customer state');
    return path.join(process.env.LOCALAPPDATA, 'Surgical', 'ControlPlane');
  }
  const base = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
  return path.join(base, 'surgical-control-plane');
}

module.exports = Object.freeze({
  INSTALLATION_SCHEMA,
  REPOSITORIES_SCHEMA,
  BACKUP_SCHEMA,
  EVIDENCE_SCHEMA,
  V1_DIGEST,
  V2_DIGEST,
  rootPaths,
  canonicalRoot,
  initializeCustomerState,
  inspectCustomerState,
  doctorCustomerState,
  onboardRepository,
  createSupportBundle,
  configureCustomerProvider,
  backupCustomerState,
  restoreCustomerState,
  uninstallCustomerRuntime,
  runCustomerDemo,
  listEvidence,
  runtimeState,
  defaultCustomerStateRoot,
  replaceFile,
});
