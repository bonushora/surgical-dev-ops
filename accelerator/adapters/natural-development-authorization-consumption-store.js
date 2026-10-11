'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  CLAIM_SCHEMA,
  COMMIT_SCHEMA,
  validateNaturalDevelopmentAuthorizationClaim,
  validateNaturalDevelopmentAuthorizationConsumption
} = require('../cli/natural-development-authorization-consumption');
const identity = require('./natural-development-store-integrity-identity');
const witness = require('./natural-development-monotonic-witness');
const transition = require('./natural-development-store-transition');

const MAX_RECORD_BYTES = 256 * 1024;
const READ_PURPOSE = Object.freeze({
  CURRENT_AUTHORITY: 'CURRENT_AUTHORITY',
  HISTORICAL_RECONCILIATION: 'HISTORICAL_RECONCILIATION'
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalRoot(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root) || path.normalize(root) !== root) {
    throw new Error('Canonical absolute G7 authorization store root is required.');
  }
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('G7 authorization store root is unsafe.');
  return fs.realpathSync(root);
}

function recordPath(root, authorizationFingerprint) {
  if (!/^[a-f0-9]{64}$/.test(authorizationFingerprint || '')) {
    throw new Error('Canonical authorization fingerprint is required.');
  }
  return path.join(canonicalRoot(root), `${authorizationFingerprint}.json`);
}

function hydrate(raw) {
  if (!raw || (raw.schema !== CLAIM_SCHEMA && raw.schema !== COMMIT_SCHEMA)) {
    throw new Error('Persisted G7 authorization record is malformed.');
  }
  const value = deepFreeze(raw);
  return value.schema === CLAIM_SCHEMA
    ? validateNaturalDevelopmentAuthorizationClaim(value)
    : validateNaturalDevelopmentAuthorizationConsumption(value);
}

function parseSafeFile(target, label = 'Persisted G7 authorization record') {
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_RECORD_BYTES) throw new Error(`${label} is unsafe.`);
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function readLegacyRecord(target, authorizationFingerprint) {
  const record = hydrate(parseSafeFile(target));
  if (record.authorizationFingerprint !== authorizationFingerprint) {
    throw new Error('Persisted G7 authorization record does not match its requested storage position.');
  }
  return record;
}

function requireReadContext({ readPurpose, expectedPhysicalWorkspaceIdentity }) {
  if (readPurpose !== READ_PURPOSE.CURRENT_AUTHORITY && readPurpose !== READ_PURPOSE.HISTORICAL_RECONCILIATION) {
    throw new Error('Explicit G7 authorization record read purpose is required.');
  }
  if (readPurpose === READ_PURPOSE.CURRENT_AUTHORITY && !/^[a-f0-9]{64}$/.test(expectedPhysicalWorkspaceIdentity || '')) {
    throw new Error('Current-authority G7 read requires the expected physical workspace identity.');
  }
}

function serialize(value) {
  const data = JSON.stringify(value, null, 2) + '\n';
  if (Buffer.byteLength(data) > MAX_RECORD_BYTES) throw new Error('G7 authorization record size bound exceeded.');
  return data;
}

function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, 'r');
  try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
}

function writeExclusive(target, value) {
  const descriptor = fs.openSync(target, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, serialize(value), 'utf8');
    fs.fsyncSync(descriptor);
  } finally { fs.closeSync(descriptor); }
  fsyncDirectory(path.dirname(target));
}

function replaceAtomically(target, value) {
  const directory = path.dirname(target);
  const temporary = path.join(directory, `.g7-${process.pid}-${crypto.randomUUID()}.tmp`);
  const descriptor = fs.openSync(temporary, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, serialize(value), 'utf8');
    fs.fsyncSync(descriptor);
  } finally { fs.closeSync(descriptor); }
  try {
    fs.renameSync(temporary, target);
    fsyncDirectory(directory);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
}

function verifyEnvelope(context, envelope, authorizationFingerprint) {
  transition.validateEnvelopeShape(envelope);
  if (
    envelope.storeId !== context.storeId || envelope.epoch !== context.epoch ||
    envelope.repositoryIdentity !== context.repositoryIdentity || envelope.keyId !== context.keyId
  ) throw new Error('Persisted G7 store-integrity envelope context binding mismatch.');
  if (envelope.authorizationFingerprint !== authorizationFingerprint) {
    throw new Error('Persisted G7 authorization record does not match its requested storage position.');
  }
  identity.verifyStoreTransitionSignature(context, transition.unsignedEnvelope(envelope), envelope.signature);
  const payload = hydrate(envelope.payload);
  if (
    (payload.schema === CLAIM_SCHEMA && envelope.transitionType !== 'CLAIM') ||
    (payload.schema === COMMIT_SCHEMA && envelope.transitionType !== 'CONSUME')
  ) throw new Error('Persisted G7 store-integrity lifecycle binding mismatch.');
  return payload;
}

function loadVerifiedStore(stateRoot) {
  const root = canonicalRoot(stateRoot);
  const context = identity.loadIntegrityContext(root);
  const committed = witness.loadCommittedState(context);
  const envelopes = [];
  const byFingerprint = new Map();
  const generations = new Set();
  for (const entry of fs.readdirSync(root).sort()) {
    const target = path.join(root, entry);
    const stat = fs.lstatSync(target);
    if (entry === '.g10-linearizable' && stat.isDirectory() && !stat.isSymbolicLink()) continue;
    const match = /^([a-f0-9]{64})\.json$/.exec(entry);
    if (!match || !stat.isFile() || stat.isSymbolicLink()) {
      throw new Error('G7 contains an unknown or unsafe persisted artifact.');
    }
    const envelope = parseSafeFile(target, 'Persisted G7 store-integrity envelope');
    const payload = verifyEnvelope(context, envelope, match[1]);
    if (generations.has(envelope.generation)) throw new Error('G7 contains duplicate store-integrity generations.');
    generations.add(envelope.generation);
    if (envelope.generation > committed.generation) throw new Error('G7 store is newer than its committed witness.');
    envelopes.push(envelope);
    byFingerprint.set(match[1], Object.freeze({ envelope, payload }));
  }
  const rootDigest = transition.computeStoreRoot(envelopes);
  if (rootDigest !== committed.storeRoot) {
    throw new Error('G7 whole-store root does not match the independent monotonic witness.');
  }
  return Object.freeze({ context, committed, envelopes: Object.freeze(envelopes), byFingerprint, rootDigest });
}

function provisionEmptyTestStore(stateRoot, repositoryIdentity) {
  const root = canonicalRoot(stateRoot);
  const contextPath = identity.contextPathForStateRoot(root);
  if (fs.existsSync(contextPath)) return;
  if (fs.readdirSync(root).length !== 0) {
    throw new Error('A non-empty G7 store without integrity context cannot be provisioned or migrated implicitly.');
  }
  const fixtureRoot = path.dirname(root);
  identity.provisionEphemeralTestStoreIntegrity({
    testOnly: true,
    fixtureRoot,
    stateRoot: root,
    identityRoot: path.join(fixtureRoot, '.natural-development-store-integrity-identity'),
    witnessRoot: path.join(fixtureRoot, '.natural-development-store-integrity-witness'),
    storeId: crypto.randomBytes(32).toString('hex'),
    epoch: crypto.randomBytes(32).toString('hex'),
    repositoryIdentity
  });
}

function buildEnvelope(verified, payload, transitionType, replacingFingerprint = null) {
  const base = transition.baseEnvelope({
    context: verified.context,
    generation: verified.committed.generation + 1,
    previousHead: verified.committed.headDigest,
    payload,
    transitionType
  });
  const candidates = verified.envelopes.filter((item) => item.authorizationFingerprint !== replacingFingerprint);
  candidates.push(base);
  const storeRoot = transition.computeStoreRoot(candidates);
  return transition.finalizeEnvelope({
    base,
    storeRoot,
    sign: (unsigned) => identity.signStoreTransition(verified.context, unsigned)
  });
}

function publishTransition({ verified, envelope, target, replace }) {
  const prepared = witness.prepareTransition(verified.context, { expected: verified.committed, envelope });
  if (replace) replaceAtomically(target, envelope);
  else writeExclusive(target, envelope);
  const reparsed = parseSafeFile(target, 'Published G7 store-integrity envelope');
  verifyEnvelope(verified.context, reparsed, envelope.authorizationFingerprint);
  if (transition.digest(reparsed) !== transition.digest(envelope)) {
    throw new Error('Published G7 store-integrity envelope does not match its prepared transition.');
  }
  witness.commitPreparedTransition(verified.context, prepared);
  const reopened = loadVerifiedStore(verified.context.stateRoot);
  if (reopened.committed.headDigest !== transition.digest(envelope)) {
    throw new Error('Durable G7 transition could not be confirmed against its witness.');
  }
  return reopened.byFingerprint.get(envelope.authorizationFingerprint).payload;
}

function claimNaturalDevelopmentAuthorization({ stateRoot, claim } = {}) {
  validateNaturalDevelopmentAuthorizationClaim(claim);
  provisionEmptyTestStore(stateRoot, claim.physicalWorkspaceIdentity);
  const verified = loadVerifiedStore(stateRoot);
  const target = recordPath(stateRoot, claim.authorizationFingerprint);
  if (verified.byFingerprint.has(claim.authorizationFingerprint) || fs.existsSync(target)) {
    const existing = verified.byFingerprint.get(claim.authorizationFingerprint);
    throw new Error(existing && existing.payload.schema === COMMIT_SCHEMA
      ? 'G4 authorization was already durably consumed; replay denied.'
      : 'G4 authorization already has a durable claim; replay denied.');
  }
  const envelope = buildEnvelope(verified, claim, 'CLAIM');
  const persisted = publishTransition({ verified, envelope, target, replace: false });
  if (persisted.schema !== CLAIM_SCHEMA || persisted.claimFingerprint !== claim.claimFingerprint) {
    throw new Error('Durable G7 claim could not be confirmed.');
  }
  return Object.freeze({
    schema: 'sdo.natural_development_authorization_claim_receipt.v1',
    authorizationFingerprint: claim.authorizationFingerprint,
    claimFingerprint: claim.claimFingerprint,
    state: 'CLAIMED', reusable: false, operationalAuthority: false,
    mutationAuthority: false, dispatchAuthority: false
  });
}

function commitNaturalDevelopmentAuthorization({ stateRoot, consumption } = {}) {
  validateNaturalDevelopmentAuthorizationConsumption(consumption);
  const verified = loadVerifiedStore(stateRoot);
  const target = recordPath(stateRoot, consumption.authorizationFingerprint);
  const item = verified.byFingerprint.get(consumption.authorizationFingerprint);
  if (!item || !fs.existsSync(target)) throw new Error('Durable G7 claim is required before consumption commit.');
  const current = item.payload;
  if (current.schema === COMMIT_SCHEMA) {
    if (current.consumptionFingerprint === consumption.consumptionFingerprint) {
      return Object.freeze({
        schema: 'sdo.natural_development_authorization_consumption_receipt.v1',
        authorizationFingerprint: current.authorizationFingerprint,
        consumptionFingerprint: current.consumptionFingerprint,
        state: 'CONSUMED', replay: 'IDEMPOTENT_READ_ONLY', operationalAuthority: false,
        mutationAuthority: false, dispatchAuthority: false
      });
    }
    throw new Error('Conflicting G7 authorization consumption replay was denied.');
  }
  for (const key of [
    'claimFingerprint', 'authorizationFingerprint', 'operationId', 'physicalWorkspaceIdentity',
    'target', 'beforeSha256', 'replacementSha256'
  ]) {
    if (current[key] !== consumption[key]) throw new Error('G7 consumption does not match its exact durable claim.');
  }
  const envelope = buildEnvelope(verified, consumption, 'CONSUME', consumption.authorizationFingerprint);
  const persisted = publishTransition({ verified, envelope, target, replace: true });
  if (persisted.schema !== COMMIT_SCHEMA || persisted.consumptionFingerprint !== consumption.consumptionFingerprint) {
    throw new Error('Durable G7 consumption could not be confirmed.');
  }
  return Object.freeze({
    schema: 'sdo.natural_development_authorization_consumption_receipt.v1',
    authorizationFingerprint: persisted.authorizationFingerprint,
    consumptionFingerprint: persisted.consumptionFingerprint,
    state: 'CONSUMED', replay: 'DENIED', operationalAuthority: false,
    mutationAuthority: false, dispatchAuthority: false
  });
}

function loadNaturalDevelopmentAuthorizationConsumption({
  stateRoot, authorizationFingerprint, readPurpose, expectedPhysicalWorkspaceIdentity
} = {}) {
  requireReadContext({ readPurpose, expectedPhysicalWorkspaceIdentity });
  const root = canonicalRoot(stateRoot);
  const target = recordPath(root, authorizationFingerprint);
  const hasContext = fs.existsSync(identity.contextPathForStateRoot(root));
  if (!hasContext) {
    if (readPurpose === READ_PURPOSE.CURRENT_AUTHORITY) {
      throw new Error('Store-integrity context is required; legacy unverified state cannot be used as current authority.');
    }
    return fs.existsSync(target) ? readLegacyRecord(target, authorizationFingerprint) : null;
  }
  const verified = loadVerifiedStore(root);
  const item = verified.byFingerprint.get(authorizationFingerprint);
  if (!item) return null;
  if (
    readPurpose === READ_PURPOSE.CURRENT_AUTHORITY &&
    item.payload.physicalWorkspaceIdentity !== expectedPhysicalWorkspaceIdentity
  ) throw new Error('Persisted G7 authorization record does not match the expected physical workspace context.');
  if (readPurpose === READ_PURPOSE.CURRENT_AUTHORITY) {
    identity.assertActiveSignerAvailable(verified.context);
  }
  return item.payload;
}

module.exports = Object.freeze({
  MAX_RECORD_BYTES,
  READ_PURPOSE,
  claimNaturalDevelopmentAuthorization,
  commitNaturalDevelopmentAuthorization,
  loadNaturalDevelopmentAuthorizationConsumption
});
