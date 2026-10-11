'use strict';

const crypto = require('node:crypto');

const ENVELOPE_SCHEMA = 'sdo.store_integrity_envelope.v1';
const PURPOSE = 'sdo.store-integrity/v1';
const CANONICAL_VERSION = 'sdo.canonical-json/v1';
const ZERO_HEAD = '0'.repeat(64);

const ENVELOPE_KEYS = Object.freeze([
  'authorizationFingerprint',
  'canonicalVersion',
  'epoch',
  'generation',
  'humanAuthorityReference',
  'keyId',
  'lifecycleState',
  'payload',
  'payloadDigest',
  'physicalWorkspaceIdentity',
  'previousHead',
  'purpose',
  'repositoryIdentity',
  'schema',
  'signature',
  'storeId',
  'storeRoot',
  'transitionType'
].sort());

function canonicalize(value) {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value !== value.normalize('NFC')) {
      throw new Error('Store-integrity canonical strings must already be NFC.');
    }
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new Error('Store-integrity canonical numbers must be safe integers.');
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') {
    throw new Error('Store-integrity canonical value is unsupported.');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('Store-integrity canonical objects must be plain objects.');
  }
  const output = {};
  for (const key of Object.keys(value).sort()) {
    if (key !== key.normalize('NFC') || value[key] === undefined) {
      throw new Error('Store-integrity canonical object is ambiguous.');
    }
    output[key] = canonicalize(value[key]);
  }
  return output;
}

function canonicalBytes(value) {
  return Buffer.from(JSON.stringify(canonicalize(value)), 'utf8');
}

function digest(value) {
  return crypto.createHash('sha256').update(
    Buffer.isBuffer(value) ? value : canonicalBytes(value)
  ).digest('hex');
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} contains missing or unknown fields.`);
  }
}

function sha(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} must be a canonical SHA-256 digest.`);
  }
}

function baseEnvelope({ context, generation, previousHead, payload, transitionType }) {
  sha(payload.authorizationFingerprint, 'Authorization fingerprint');
  sha(payload.physicalWorkspaceIdentity, 'Physical workspace identity');
  sha(previousHead, 'Previous committed head');
  if (!Number.isSafeInteger(generation) || generation < 1) {
    throw new Error('Store-integrity generation must be a positive safe integer.');
  }
  if (!['CLAIM', 'CONSUME'].includes(transitionType)) {
    throw new Error('Store-integrity transition type is unsupported.');
  }
  if (!['CLAIMED', 'CONSUMED'].includes(payload.state)) {
    throw new Error('Store-integrity lifecycle state is unsupported.');
  }
  return {
    schema: ENVELOPE_SCHEMA,
    purpose: PURPOSE,
    canonicalVersion: CANONICAL_VERSION,
    storeId: context.storeId,
    epoch: context.epoch,
    generation,
    previousHead,
    repositoryIdentity: context.repositoryIdentity,
    physicalWorkspaceIdentity: payload.physicalWorkspaceIdentity,
    authorizationFingerprint: payload.authorizationFingerprint,
    humanAuthorityReference: payload.authorizationFingerprint,
    transitionType,
    lifecycleState: payload.state,
    payloadDigest: digest(payload),
    keyId: context.keyId,
    payload: canonicalize(payload)
  };
}

function recordCommitment(envelope) {
  const { signature: _signature, storeRoot: _storeRoot, ...base } = envelope;
  return digest(base);
}

function computeStoreRoot(envelopes) {
  const entries = [...envelopes]
    .map((envelope) => ({
      authorizationFingerprint: envelope.authorizationFingerprint,
      commitment: recordCommitment(envelope)
    }))
    .sort((left, right) => left.authorizationFingerprint.localeCompare(right.authorizationFingerprint));
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.authorizationFingerprint)) {
      throw new Error('Store-integrity state contains duplicate authorization positions.');
    }
    seen.add(entry.authorizationFingerprint);
  }
  return digest({ schema: 'sdo.store_integrity_root.v1', entries });
}

function unsignedEnvelope(envelope) {
  const { signature: _signature, ...unsigned } = envelope;
  return unsigned;
}

function finalizeEnvelope({ base, storeRoot, sign }) {
  sha(storeRoot, 'Whole-store root');
  const unsigned = { ...base, storeRoot };
  const signature = sign(unsigned);
  return Object.freeze({ ...unsigned, signature });
}

function validateEnvelopeShape(envelope) {
  exactKeys(envelope, ENVELOPE_KEYS, 'Store-integrity envelope');
  if (
    envelope.schema !== ENVELOPE_SCHEMA ||
    envelope.purpose !== PURPOSE ||
    envelope.canonicalVersion !== CANONICAL_VERSION
  ) {
    throw new Error('Store-integrity envelope schema or purpose is unsupported.');
  }
  for (const [value, label] of [
    [envelope.previousHead, 'Previous head'],
    [envelope.repositoryIdentity, 'Repository identity'],
    [envelope.physicalWorkspaceIdentity, 'Physical workspace identity'],
    [envelope.authorizationFingerprint, 'Authorization fingerprint'],
    [envelope.humanAuthorityReference, 'Human authority reference'],
    [envelope.payloadDigest, 'Payload digest'],
    [envelope.keyId, 'Integrity key ID'],
    [envelope.storeRoot, 'Whole-store root']
  ]) sha(value, label);
  if (!Number.isSafeInteger(envelope.generation) || envelope.generation < 1) {
    throw new Error('Store-integrity envelope generation is malformed.');
  }
  if (envelope.humanAuthorityReference !== envelope.authorizationFingerprint) {
    throw new Error('Store-integrity human-authority reference binding is invalid.');
  }
  if (envelope.payloadDigest !== digest(envelope.payload)) {
    throw new Error('Store-integrity payload digest mismatch.');
  }
  if (
    envelope.payload.authorizationFingerprint !== envelope.authorizationFingerprint ||
    envelope.payload.physicalWorkspaceIdentity !== envelope.physicalWorkspaceIdentity ||
    envelope.payload.state !== envelope.lifecycleState
  ) {
    throw new Error('Store-integrity envelope payload binding mismatch.');
  }
  if (
    (envelope.transitionType === 'CLAIM' && envelope.lifecycleState !== 'CLAIMED') ||
    (envelope.transitionType === 'CONSUME' && envelope.lifecycleState !== 'CONSUMED') ||
    !['CLAIM', 'CONSUME'].includes(envelope.transitionType)
  ) {
    throw new Error('Store-integrity lifecycle transition is invalid.');
  }
  if (typeof envelope.signature !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.signature)) {
    throw new Error('Store-integrity signature is malformed.');
  }
  return envelope;
}

module.exports = Object.freeze({
  CANONICAL_VERSION,
  ENVELOPE_SCHEMA,
  PURPOSE,
  ZERO_HEAD,
  baseEnvelope,
  canonicalBytes,
  canonicalize,
  computeStoreRoot,
  digest,
  exactKeys,
  finalizeEnvelope,
  recordCommitment,
  unsignedEnvelope,
  validateEnvelopeShape
});
