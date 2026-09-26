'use strict';

const crypto = require('node:crypto');

const PROTOCOL_VERSION = 'sacp.sdo-local/v1';
const OPERATIONS = Object.freeze([
  'negotiate', 'capabilities', 'submit', 'reconcile', 'cancel', 'inspect',
]);
const RESULT_CLASSIFICATIONS = Object.freeze([
  'accepted', 'running', 'succeeded', 'failed', 'cancelled', 'rejected',
  'unknown', 'indeterminate', 'authentication_failure',
  'authorization_failure', 'protocol_failure', 'unsupported_capability',
  'stale_state', 'transport_failure', 'internal_failure',
]);
const PROTOCOL_CAPABILITIES = Object.freeze([
  'cancel', 'inspect', 'reconcile', 'submit',
]);
const CREDENTIAL_FIELD = /authorization|bearer|credential|password|passwd|private.?key|provider.?token|secret|token|(^|_)(env|environment)($|_)|raw.?request|http.?request/i;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{7,255}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const GIT_HEAD = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;

const REQUEST_FIELDS = Object.freeze({
  negotiate: Object.freeze(['protocolVersion', 'requestId', 'supportedVersions']),
  capabilities: Object.freeze(['protocolVersion', 'requestId']),
  submit: Object.freeze([
    'protocolVersion', 'requestId', 'operationId', 'idempotencyKey',
    'intentFingerprint', 'principal', 'authority', 'requestedCapability',
    'workspace', 'repository', 'expectedState', 'approvalReference', 'submittedAt',
  ]),
  reconcile: Object.freeze([
    'protocolVersion', 'requestId', 'operationId', 'idempotencyKey',
    'intentFingerprint', 'principal', 'authority', 'workspace', 'repository',
    'externalExecutionId', 'afterObservationSequence',
  ]),
  cancel: Object.freeze([
    'protocolVersion', 'requestId', 'operationId', 'idempotencyKey',
    'intentFingerprint', 'principal', 'authority', 'workspace', 'repository',
    'externalExecutionId', 'afterObservationSequence',
  ]),
  inspect: Object.freeze([
    'protocolVersion', 'requestId', 'operationId', 'idempotencyKey',
    'intentFingerprint', 'principal', 'authority', 'workspace', 'repository',
    'externalExecutionId', 'afterObservationSequence',
  ]),
});

const SCHEMA_DOCUMENT = Object.freeze({
  protocolVersion: PROTOCOL_VERSION,
  operations: OPERATIONS,
  resultClassifications: RESULT_CLASSIFICATIONS,
  protocolCapabilities: PROTOCOL_CAPABILITIES,
  requests: REQUEST_FIELDS,
  submitBindings: Object.freeze([
    'protocolVersion', 'requestId', 'operationId', 'idempotencyKey',
    'intentFingerprint', 'principal', 'authority', 'requestedCapability',
    'workspace', 'repository', 'expectedState', 'approvalReference', 'submittedAt',
  ]),
  secretPolicy: Object.freeze({
    recursiveCredentialFieldRejection: true,
    bearerValueRejection: true,
    privateKeyValueRejection: true,
    rawHttpRequestRejection: true,
    environmentObjectRejection: true,
  }),
  transport: 'deferred',
  physicalDispatchDefault: false,
});

class ProtocolError extends Error {
  constructor(classification, code, message) {
    super(message);
    this.name = 'ProtocolError';
    this.classification = classification;
    this.code = code;
  }
}

function failure(classification, code) {
  const messages = {
    UNSUPPORTED_PROTOCOL_VERSION: 'Protocol version is unsupported',
    MALFORMED_PROTOCOL_MESSAGE: 'Protocol message is malformed',
    CREDENTIAL_MATERIAL_REJECTED: 'Credential material is forbidden',
    BINDING_MISMATCH: 'Protocol binding is invalid',
    STALE_OBSERVATION_SEQUENCE: 'Observation sequence is stale',
    RESULT_STATE_REGRESSION: 'Result state regression is forbidden',
    UNSUPPORTED_CAPABILITY: 'Protocol capability is unsupported',
    TRANSPORT_FAILURE: 'Protocol transport failed',
    INTERNAL_FAILURE: 'Protocol operation failed',
  };
  return new ProtocolError(
    classification,
    code,
    messages[code] || 'Protocol operation was rejected',
  );
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function deepFreezeCopy(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreezeCopy));
  const copy = {};
  for (const key of Object.keys(value)) copy[key] = deepFreezeCopy(value[key]);
  return Object.freeze(copy);
}

function assertCredentialFree(value) {
  const pending = [value];
  const seen = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current === 'string') {
      if (/\bBearer\s/i.test(current) || /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(current)) {
        throw failure('protocol_failure', 'CREDENTIAL_MATERIAL_REJECTED');
      }
      continue;
    }
    if (current === null || typeof current !== 'object') continue;
    if (seen.has(current)) throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
    seen.add(current);
    for (const key of Reflect.ownKeys(current)) {
      if (typeof key !== 'string' || CREDENTIAL_FIELD.test(key)) {
        throw failure('protocol_failure', 'CREDENTIAL_MATERIAL_REJECTED');
      }
      pending.push(current[key]);
    }
  }
}

function exactFields(value, required, optional = []) {
  if (!isPlainObject(value)) throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  const allowed = new Set([...required, ...optional]);
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string' || !allowed.has(key))
    || required.some((key) => !Object.hasOwn(value, key))) {
    throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  }
}

function assertDenseArray(value) {
  if (!Array.isArray(value)) throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  const allowed = new Set(['length']);
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
    }
    allowed.add(String(index));
  }
  if (Reflect.ownKeys(value).some(
    (key) => typeof key !== 'string' || !allowed.has(key),
  )) throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
}

function requireIdentifier(value) {
  if (typeof value !== 'string' || !IDENTIFIER.test(value) || value.includes('..')) {
    throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  }
  return value;
}

function requireTimestamp(value) {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  }
  return value;
}

function requireSequence(value, allowZero = true) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  }
  return value;
}

function validatePrincipal(value) {
  exactFields(value, ['type', 'id']);
  if (!['human', 'agent', 'service'].includes(value.type)) {
    throw failure('authentication_failure', 'BINDING_MISMATCH');
  }
  requireIdentifier(value.id);
}

function validateAuthority(value) {
  exactFields(value, ['reference', 'delegationReference']);
  requireIdentifier(value.reference);
  requireIdentifier(value.delegationReference);
}

function validateWorkspace(value) {
  exactFields(value, ['path', 'physicalIdentity']);
  if (typeof value.path !== 'string'
    || (!value.path.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(value.path))
    || value.path.includes('\0')
    || value.path.split(/[\\/]+/).includes('..')
    || !DIGEST.test(value.physicalIdentity)) {
    throw failure('authorization_failure', 'BINDING_MISMATCH');
  }
}

function validateRepository(value) {
  exactFields(value, ['id', 'head']);
  requireIdentifier(value.id);
  if (!GIT_HEAD.test(value.head)) throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
}

function validateExpectedState(value, repository) {
  exactFields(value, ['repositoryHead', 'worktreeFingerprint', 'cas']);
  if (!GIT_HEAD.test(value.repositoryHead)
    || value.repositoryHead !== repository.head
    || !DIGEST.test(value.worktreeFingerprint)
    || !DIGEST.test(value.cas)) {
    throw failure('stale_state', 'BINDING_MISMATCH');
  }
}

function validateBinding(input) {
  requireIdentifier(input.requestId);
  requireIdentifier(input.operationId);
  requireIdentifier(input.idempotencyKey);
  if (!DIGEST.test(input.intentFingerprint)) {
    throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  }
  validatePrincipal(input.principal);
  validateAuthority(input.authority);
  validateWorkspace(input.workspace);
  validateRepository(input.repository);
}

function validateRequest(operation, input) {
  if (!isPlainObject(input) || input.protocolVersion !== PROTOCOL_VERSION) {
    throw failure('protocol_failure', 'UNSUPPORTED_PROTOCOL_VERSION');
  }
  assertCredentialFree(input);
  if (!Object.hasOwn(REQUEST_FIELDS, operation)) {
    throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  }
  exactFields(input, REQUEST_FIELDS[operation]);
  requireIdentifier(input.requestId);
  if (operation === 'negotiate') {
    assertDenseArray(input.supportedVersions);
    if (input.supportedVersions.length === 0
      || new Set(input.supportedVersions).size !== input.supportedVersions.length
      || input.supportedVersions.some((version) => typeof version !== 'string')) {
      throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
    }
  } else if (operation !== 'capabilities') {
    validateBinding(input);
    if (operation === 'submit') {
      requireIdentifier(input.requestedCapability);
      validateExpectedState(input.expectedState, input.repository);
      requireIdentifier(input.approvalReference);
      requireTimestamp(input.submittedAt);
    } else {
      requireIdentifier(input.externalExecutionId);
      requireSequence(input.afterObservationSequence);
    }
  }
  return deepFreezeCopy(input);
}

function canonicalSerialize(value, stack = new Set()) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object' || stack.has(value)) {
    throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  }
  stack.add(value);
  let serialized;
  if (Array.isArray(value)) {
    assertDenseArray(value);
    serialized = `[${value.map((entry) => canonicalSerialize(entry, stack)).join(',')}]`;
  } else {
    if (!isPlainObject(value)
      || Reflect.ownKeys(value).some((key) => typeof key !== 'string')
      || Object.values(value).some((entry) => entry === undefined)) {
      throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
    }
    serialized = `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalSerialize(value[key], stack)}`
    ).join(',')}}`;
  }
  stack.delete(value);
  return serialized;
}

const SCHEMA_DIGEST = crypto.createHash('sha256')
  .update(canonicalSerialize(SCHEMA_DOCUMENT), 'utf8')
  .digest('hex');

function validateNegotiationResult(result, request) {
  assertCredentialFree(result);
  exactFields(result, [
    'requestId', 'selectedVersion', 'supportedVersions', 'classification', 'code',
  ]);
  assertDenseArray(result.supportedVersions);
  if (result.requestId !== request.requestId
    || !Array.isArray(result.supportedVersions)
    || result.supportedVersions.some((version) => typeof version !== 'string')
    || (result.selectedVersion !== null && result.selectedVersion !== PROTOCOL_VERSION)
    || !['accepted', 'protocol_failure'].includes(result.classification)
    || typeof result.code !== 'string') {
    throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  }
  return deepFreezeCopy(result);
}

function validateCapabilitiesResult(result, request) {
  assertCredentialFree(result);
  exactFields(result, [
    'protocolVersion', 'requestId', 'capabilities', 'physicalDispatchEnabled',
    'classification', 'code', 'schemaDigest',
  ]);
  assertDenseArray(result.capabilities);
  if (result.protocolVersion !== PROTOCOL_VERSION
    || result.requestId !== request.requestId
    || !Array.isArray(result.capabilities)
    || result.capabilities.some((capability) => !PROTOCOL_CAPABILITIES.includes(capability))
    || new Set(result.capabilities).size !== result.capabilities.length
    || JSON.stringify([...result.capabilities].sort()) !== JSON.stringify(result.capabilities)
    || typeof result.physicalDispatchEnabled !== 'boolean'
    || result.classification !== 'accepted'
    || result.code !== 'CAPABILITIES_DISCOVERED'
    || result.schemaDigest !== SCHEMA_DIGEST) {
    throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  }
  return deepFreezeCopy(result);
}

function validateOperationResult(result, request) {
  assertCredentialFree(result);
  exactFields(result, [
    'protocolVersion', 'requestId', 'operationId', 'idempotencyKey',
    'intentFingerprint', 'externalExecutionId', 'classification', 'code',
    'observationSequence', 'observedAt',
  ]);
  if (result.protocolVersion !== PROTOCOL_VERSION
    || result.requestId !== request.requestId
    || result.operationId !== request.operationId
    || result.idempotencyKey !== request.idempotencyKey
    || result.intentFingerprint !== request.intentFingerprint
    || !RESULT_CLASSIFICATIONS.includes(result.classification)
    || typeof result.code !== 'string'
    || (result.externalExecutionId !== null && !IDENTIFIER.test(result.externalExecutionId))
    || (request.externalExecutionId
      && result.externalExecutionId !== request.externalExecutionId)
    || requireSequence(result.observationSequence, false) === undefined
    || (request.afterObservationSequence !== undefined
      && result.observationSequence <= request.afterObservationSequence)) {
    throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  }
  requireTimestamp(result.observedAt);
  return deepFreezeCopy(result);
}

module.exports = Object.freeze({
  PROTOCOL_VERSION,
  OPERATIONS,
  RESULT_CLASSIFICATIONS,
  PROTOCOL_CAPABILITIES,
  SCHEMA_DOCUMENT,
  SCHEMA_DIGEST,
  ProtocolError,
  failure,
  isPlainObject,
  deepFreezeCopy,
  assertCredentialFree,
  exactFields,
  canonicalSerialize,
  validateRequest,
  validateNegotiationResult,
  validateCapabilitiesResult,
  validateOperationResult,
});
