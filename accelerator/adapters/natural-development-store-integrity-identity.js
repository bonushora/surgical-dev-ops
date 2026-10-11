'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const transition = require('./natural-development-store-transition');

const CONTEXT_SCHEMA = 'sdo.store_integrity_test_context.v1';
const KEY_SCHEMA = 'sdo.store_integrity_key_lifecycle.v1';
const PURPOSE = transition.PURPOSE;
const CONTEXT_SUFFIX = '.sdo-store-integrity-context.json';
const PRIVATE_KEY_FILE = 'private-key.pkcs8.pem';
const KEY_METADATA_FILE = 'key-lifecycle.json';

const CONTEXT_KEYS = Object.freeze([
  'epoch', 'fixtureRoot', 'identityRoot', 'keyId', 'purpose',
  'repositoryIdentity', 'schema', 'stateRoot', 'storeId', 'witnessRoot'
].sort());
const KEY_KEYS = Object.freeze([
  'algorithm', 'epoch', 'keyId', 'lifecycle', 'publicKeySpkiDer',
  'purpose', 'schema', 'storeId'
].sort());

function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, 'r');
  try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
}

function writeExclusiveJson(target, value, mode = 0o600) {
  const descriptor = fs.openSync(target, 'wx', mode);
  try {
    fs.writeFileSync(descriptor, JSON.stringify(value, null, 2) + '\n', 'utf8');
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fsyncDirectory(path.dirname(target));
}

function writeExclusiveBytes(target, bytes, mode = 0o600) {
  const descriptor = fs.openSync(target, 'wx', mode);
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fsyncDirectory(path.dirname(target));
}

function canonicalAbsolute(value, label, { mustExist = true } = {}) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || path.normalize(value) !== value) {
    throw new Error(`${label} must be a canonical absolute path.`);
  }
  if (!mustExist) return value;
  const stat = fs.lstatSync(value);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a physical directory.`);
  }
  return fs.realpathSync(value);
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith('..' + path.sep) && relative !== '..';
}

function contextPathForStateRoot(stateRoot) {
  if (typeof stateRoot !== 'string' || !path.isAbsolute(stateRoot) || path.normalize(stateRoot) !== stateRoot) {
    throw new Error('Canonical absolute G7 state root is required for store integrity.');
  }
  return stateRoot + CONTEXT_SUFFIX;
}

function assertTestRuntime() {
  const main = process.argv[1] || '';
  if (!process.env.NODE_TEST_CONTEXT && !/\.test\.js$/.test(main)) {
    throw new Error('Ephemeral store-integrity provisioning is test-only.');
  }
}

function assertSha(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} must be a canonical SHA-256 digest.`);
  }
}

function readStrictJson(target, label, maxBytes = 64 * 1024) {
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) {
    throw new Error(`${label} is unsafe.`);
  }
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function provisionEphemeralTestStoreIntegrity({
  testOnly,
  fixtureRoot,
  stateRoot,
  identityRoot,
  witnessRoot,
  storeId,
  epoch,
  repositoryIdentity
} = {}) {
  assertTestRuntime();
  if (testOnly !== true) {
    throw new Error('Explicit testOnly acknowledgement is required for integrity-key provisioning.');
  }
  const fixture = canonicalAbsolute(fixtureRoot, 'Test fixture root');
  const temp = fs.realpathSync(os.tmpdir());
  if (!isInside(temp, fixture)) {
    throw new Error('Store-integrity test fixture must be a fresh descendant of the OS temporary root.');
  }
  for (const [value, label] of [
    [stateRoot, 'G7 state root'],
    [identityRoot, 'Integrity identity root'],
    [witnessRoot, 'Witness root']
  ]) {
    canonicalAbsolute(value, label, { mustExist: false });
    if (!isInside(fixture, value)) throw new Error(`${label} must stay inside the isolated fixture.`);
  }
  if (isInside(stateRoot, identityRoot) || isInside(stateRoot, witnessRoot) || identityRoot === stateRoot || witnessRoot === stateRoot) {
    throw new Error('Integrity identity and witness must be outside G7.');
  }
  assertSha(storeId, 'Store ID');
  assertSha(epoch, 'Witness epoch');
  assertSha(repositoryIdentity, 'Repository identity');

  fs.mkdirSync(stateRoot, { recursive: true, mode: 0o700 });
  fs.mkdirSync(identityRoot, { recursive: true, mode: 0o700 });
  fs.mkdirSync(witnessRoot, { recursive: true, mode: 0o700 });
  const state = fs.realpathSync(stateRoot);
  const identity = fs.realpathSync(identityRoot);
  const witness = fs.realpathSync(witnessRoot);
  if (!isInside(fixture, state) || !isInside(fixture, identity) || !isInside(fixture, witness)) {
    throw new Error('Store-integrity fixture resolved outside its isolated root.');
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicDer = publicKey.export({ type: 'spki', format: 'der' });
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const keyId = transition.digest({
    algorithm: 'Ed25519',
    purpose: PURPOSE,
    publicKeySpkiDer: publicDer.toString('base64')
  });
  const metadata = {
    schema: KEY_SCHEMA,
    purpose: PURPOSE,
    algorithm: 'Ed25519',
    keyId,
    storeId,
    epoch,
    lifecycle: 'ACTIVE',
    publicKeySpkiDer: publicDer.toString('base64')
  };
  writeExclusiveBytes(path.join(identity, PRIVATE_KEY_FILE), privatePem, 0o600);
  writeExclusiveJson(path.join(identity, KEY_METADATA_FILE), metadata);

  const context = {
    schema: CONTEXT_SCHEMA,
    purpose: PURPOSE,
    fixtureRoot: fixture,
    stateRoot: state,
    identityRoot: identity,
    witnessRoot: witness,
    storeId,
    epoch,
    repositoryIdentity,
    keyId
  };
  writeExclusiveJson(contextPathForStateRoot(state), context);
  require('./natural-development-monotonic-witness').bootstrapTestWitness(context);
  return Object.freeze({
    schema: CONTEXT_SCHEMA,
    purpose: PURPOSE,
    stateRoot: state,
    storeId,
    epoch,
    repositoryIdentity,
    keyId,
    operationalAuthority: false,
    mutationAuthority: false,
    dispatchAuthority: false,
    approvalAuthority: false
  });
}

function loadIntegrityContext(stateRoot) {
  const state = canonicalAbsolute(stateRoot, 'G7 state root');
  const target = contextPathForStateRoot(state);
  if (!fs.existsSync(target)) {
    throw new Error('Store-integrity context is required; legacy unverified state cannot be used as current authority.');
  }
  const context = readStrictJson(target, 'Store-integrity context');
  transition.exactKeys(context, CONTEXT_KEYS, 'Store-integrity context');
  if (context.schema !== CONTEXT_SCHEMA || context.purpose !== PURPOSE || context.stateRoot !== state) {
    throw new Error('Store-integrity context binding is invalid.');
  }
  for (const [value, label] of [
    [context.storeId, 'Store ID'],
    [context.epoch, 'Witness epoch'],
    [context.repositoryIdentity, 'Repository identity'],
    [context.keyId, 'Integrity key ID']
  ]) assertSha(value, label);
  const fixture = canonicalAbsolute(context.fixtureRoot, 'Test fixture root');
  const identity = canonicalAbsolute(context.identityRoot, 'Integrity identity root');
  const witness = canonicalAbsolute(context.witnessRoot, 'Witness root');
  if (
    !isInside(fixture, state) || !isInside(fixture, identity) || !isInside(fixture, witness) ||
    isInside(state, identity) || isInside(state, witness) || identity === state || witness === state
  ) {
    throw new Error('Store-integrity physical trust boundary is invalid.');
  }
  return Object.freeze({ ...context, fixtureRoot: fixture, stateRoot: state, identityRoot: identity, witnessRoot: witness });
}

function loadKeyMetadata(context, { requireActive = false } = {}) {
  const metadata = readStrictJson(path.join(context.identityRoot, KEY_METADATA_FILE), 'Integrity key lifecycle');
  transition.exactKeys(metadata, KEY_KEYS, 'Integrity key lifecycle');
  if (
    metadata.schema !== KEY_SCHEMA || metadata.purpose !== PURPOSE || metadata.algorithm !== 'Ed25519' ||
    metadata.keyId !== context.keyId || metadata.storeId !== context.storeId || metadata.epoch !== context.epoch
  ) {
    throw new Error('Store-integrity key lifecycle binding is invalid.');
  }
  if (!['ACTIVE', 'REVOKED', 'ROTATING'].includes(metadata.lifecycle)) {
    throw new Error('Store-integrity key lifecycle state is unknown.');
  }
  if (requireActive && metadata.lifecycle !== 'ACTIVE') {
    throw new Error('Store-integrity key is not active; authority use is blocked.');
  }
  const publicDer = Buffer.from(metadata.publicKeySpkiDer, 'base64');
  const expectedKeyId = transition.digest({ algorithm: 'Ed25519', purpose: PURPOSE, publicKeySpkiDer: publicDer.toString('base64') });
  if (expectedKeyId !== metadata.keyId) throw new Error('Store-integrity public key ID mismatch.');
  return Object.freeze({ ...metadata, publicDer });
}

function assertActiveSignerAvailable(context) {
  const metadata = loadKeyMetadata(context, { requireActive: true });
  const target = path.join(context.identityRoot, PRIVATE_KEY_FILE);
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) {
    throw new Error('Store-integrity private key is unavailable or unsafe.');
  }
  let privateKey;
  try {
    privateKey = crypto.createPrivateKey(fs.readFileSync(target));
  } catch {
    throw new Error('Store-integrity private key is unavailable or malformed.');
  }
  const derived = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  if (!derived.equals(metadata.publicDer)) {
    throw new Error('Store-integrity private key does not match the admitted public identity.');
  }
  return true;
}

function domainBytes(domain, value) {
  return Buffer.concat([
    Buffer.from(`${PURPOSE}\n${domain}\n`, 'utf8'),
    transition.canonicalBytes(value)
  ]);
}

function sign(context, domain, value) {
  assertActiveSignerAvailable(context);
  const target = path.join(context.identityRoot, PRIVATE_KEY_FILE);
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) {
    throw new Error('Store-integrity private key is unavailable or unsafe.');
  }
  const privateKey = crypto.createPrivateKey(fs.readFileSync(target));
  return crypto.sign(null, domainBytes(domain, value), privateKey).toString('base64');
}

function verify(context, domain, value, signature) {
  const metadata = loadKeyMetadata(context);
  if (metadata.lifecycle !== 'ACTIVE') {
    throw new Error('Store-integrity key lifecycle is not uniquely active.');
  }
  let valid = false;
  try {
    const publicKey = crypto.createPublicKey({ key: metadata.publicDer, type: 'spki', format: 'der' });
    valid = crypto.verify(null, domainBytes(domain, value), publicKey, Buffer.from(signature, 'base64'));
  } catch {}
  if (!valid) throw new Error('Store-integrity signature verification failed.');
  return true;
}

function signStoreTransition(context, value) { return sign(context, 'STORE_TRANSITION', value); }
function verifyStoreTransitionSignature(context, value, signature) { return verify(context, 'STORE_TRANSITION', value, signature); }
function signWitnessEvent(context, value) { return sign(context, 'WITNESS_EVENT', value); }
function verifyWitnessEventSignature(context, value, signature) { return verify(context, 'WITNESS_EVENT', value, signature); }

module.exports = Object.freeze({
  CONTEXT_SCHEMA,
  KEY_SCHEMA,
  PURPOSE,
  assertActiveSignerAvailable,
  contextPathForStateRoot,
  loadIntegrityContext,
  loadKeyMetadata,
  provisionEphemeralTestStoreIntegrity,
  signStoreTransition,
  signWitnessEvent,
  verifyStoreTransitionSignature,
  verifyWitnessEventSignature
});
