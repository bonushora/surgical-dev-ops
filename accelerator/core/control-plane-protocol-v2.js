'use strict';

const crypto = require('node:crypto');

const PROTOCOL_VERSION = 'sacp.sdo-local/v2';
const PHYSICAL_CAPABILITY = 'mutation.applyConditional';
const OPERATIONS = Object.freeze(['negotiate', 'capabilities', 'submit', 'reconcile', 'cancel', 'inspect']);
const RESULT_CLASSIFICATIONS = Object.freeze([
  'accepted', 'running', 'succeeded', 'failed', 'cancelled', 'rejected',
  'unknown', 'indeterminate', 'authentication_failure', 'authorization_failure',
  'protocol_failure', 'unsupported_capability', 'stale_state', 'transport_failure',
  'internal_failure',
]);
const PROTOCOL_CAPABILITIES = Object.freeze(['inspect', PHYSICAL_CAPABILITY, 'reconcile', 'submit']);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{7,255}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const GIT_HEAD = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const CREDENTIAL_FIELD = /bearer|credential|password|passwd|private.?key|provider.?token|secret|(^|_)(env|environment)($|_)|raw.?request|http.?request/i;

const COMMON_BINDING_FIELDS = Object.freeze([
  'protocolVersion', 'requestId', 'operationId', 'idempotencyKey',
  'intentFingerprint', 'principal', 'authority', 'workspace', 'repository',
  'physicalExecution',
]);
const REQUEST_FIELDS = Object.freeze({
  negotiate: Object.freeze(['protocolVersion', 'requestId', 'supportedVersions']),
  capabilities: Object.freeze(['protocolVersion', 'requestId']),
  submit: Object.freeze([
    ...COMMON_BINDING_FIELDS, 'requestedCapability', 'expectedState',
    'approvalReference', 'submittedAt',
  ]),
  reconcile: Object.freeze([...COMMON_BINDING_FIELDS, 'afterObservationSequence']),
  cancel: Object.freeze([...COMMON_BINDING_FIELDS, 'externalExecutionId', 'afterObservationSequence']),
  inspect: Object.freeze([...COMMON_BINDING_FIELDS, 'externalExecutionId', 'afterObservationSequence']),
});
const PHYSICAL_EXECUTION_FIELDS = Object.freeze([
  'target', 'beforeSha256', 'afterSha256', 'contractFingerprint',
  'proposalFingerprint', 'authorizationFingerprint', 'executionReference',
]);

const SCHEMA_DOCUMENT = Object.freeze({
  protocolVersion: PROTOCOL_VERSION,
  operations: OPERATIONS,
  resultClassifications: RESULT_CLASSIFICATIONS,
  protocolCapabilities: PROTOCOL_CAPABILITIES,
  requests: REQUEST_FIELDS,
  optionalRequestFields: Object.freeze({ reconcile: Object.freeze(['externalExecutionId']) }),
  physicalExecutionFields: PHYSICAL_EXECUTION_FIELDS,
  submitBindings: Object.freeze([
    ...REQUEST_FIELDS.submit,
  ]),
  secretPolicy: Object.freeze({
    recursiveCredentialFieldRejection: true,
    bearerValueRejection: true,
    privateKeyValueRejection: true,
    rawHttpRequestRejection: true,
    environmentObjectRejection: true,
    localAuthorityMaterialTransportForbidden: true,
  }),
  transport: 'sacp.sdo-local-ipc/v1',
  physicalDispatchDefault: false,
  authorityOwner: 'surgical-dev-ops',
});

class ProtocolError extends Error {
  constructor(classification, code, message = 'Physical protocol operation was rejected') {
    super(message);
    this.name = 'ProtocolError';
    this.classification = classification;
    this.code = code;
  }
}

function failure(classification, code) {
  return new ProtocolError(classification, code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function deepFreezeCopy(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreezeCopy));
  return Object.freeze(Object.fromEntries(Object.keys(value).map((key) => [key, deepFreezeCopy(value[key])])));
}

function credentialField(key) {
  return CREDENTIAL_FIELD.test(key) || /^(authorization|token)$/i.test(key);
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
      if (typeof key !== 'string' || credentialField(key)) {
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
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  }
  if (Reflect.ownKeys(value).some((key) => key !== 'length' && !/^\d+$/.test(String(key)))) {
    throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  }
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
    || value.path.includes('\0') || value.path.split(/[\\/]+/).includes('..')
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
  if (!GIT_HEAD.test(value.repositoryHead) || value.repositoryHead !== repository.head
    || !DIGEST.test(value.worktreeFingerprint) || !DIGEST.test(value.cas)) {
    throw failure('stale_state', 'BINDING_MISMATCH');
  }
}

function validatePhysicalExecution(value) {
  exactFields(value, PHYSICAL_EXECUTION_FIELDS);
  if (typeof value.target !== 'string' || value.target.length < 1 || value.target.length > 2048
    || value.target.includes('\0') || value.target.split(/[\\/]+/).includes('..')
    || /^[/\\]/.test(value.target) || /^[A-Za-z]:[\\/]/.test(value.target)
    || ['beforeSha256', 'afterSha256', 'contractFingerprint', 'proposalFingerprint', 'authorizationFingerprint']
      .some((field) => !DIGEST.test(value[field]))) {
    throw failure('authorization_failure', 'PHYSICAL_EXECUTION_BINDING_MISMATCH');
  }
  requireIdentifier(value.executionReference);
}

function validateBinding(input) {
  requireIdentifier(input.requestId);
  requireIdentifier(input.operationId);
  requireIdentifier(input.idempotencyKey);
  if (!DIGEST.test(input.intentFingerprint)) throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  validatePrincipal(input.principal);
  validateAuthority(input.authority);
  validateWorkspace(input.workspace);
  validateRepository(input.repository);
  validatePhysicalExecution(input.physicalExecution);
}

function validateRequest(operation, input) {
  if (!isPlainObject(input) || input.protocolVersion !== PROTOCOL_VERSION) {
    throw failure('protocol_failure', 'UNSUPPORTED_PROTOCOL_VERSION');
  }
  assertCredentialFree(input);
  if (!Object.hasOwn(REQUEST_FIELDS, operation)) throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  exactFields(input, REQUEST_FIELDS[operation], operation === 'reconcile' ? ['externalExecutionId'] : []);
  requireIdentifier(input.requestId);
  if (operation === 'negotiate') {
    assertDenseArray(input.supportedVersions);
    if (input.supportedVersions.length === 0 || new Set(input.supportedVersions).size !== input.supportedVersions.length
      || input.supportedVersions.some((version) => typeof version !== 'string')) {
      throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
    }
  } else if (operation !== 'capabilities') {
    validateBinding(input);
    if (operation === 'submit') {
      if (input.requestedCapability !== PHYSICAL_CAPABILITY) throw failure('unsupported_capability', 'UNSUPPORTED_CAPABILITY');
      validateExpectedState(input.expectedState, input.repository);
      requireIdentifier(input.approvalReference);
      requireTimestamp(input.submittedAt);
    } else {
      if (operation !== 'reconcile' || Object.hasOwn(input, 'externalExecutionId')) requireIdentifier(input.externalExecutionId);
      requireSequence(input.afterObservationSequence);
    }
  }
  return deepFreezeCopy(input);
}

function canonicalSerialize(value, stack = new Set()) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object' || stack.has(value)) throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  stack.add(value);
  let serialized;
  if (Array.isArray(value)) {
    assertDenseArray(value);
    serialized = `[${value.map((entry) => canonicalSerialize(entry, stack)).join(',')}]`;
  } else {
    if (!isPlainObject(value) || Reflect.ownKeys(value).some((key) => typeof key !== 'string')
      || Object.values(value).some((entry) => entry === undefined)) {
      throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
    }
    serialized = `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalSerialize(value[key], stack)}`).join(',')}}`;
  }
  stack.delete(value);
  return serialized;
}

const SCHEMA_DIGEST = crypto.createHash('sha256').update(canonicalSerialize(SCHEMA_DOCUMENT), 'utf8').digest('hex');

function validateNegotiationResult(result, request) {
  assertCredentialFree(result);
  exactFields(result, ['requestId', 'selectedVersion', 'supportedVersions', 'classification', 'code']);
  assertDenseArray(result.supportedVersions);
  if (result.requestId !== request.requestId || result.supportedVersions.some((version) => typeof version !== 'string')
    || (result.selectedVersion !== null && result.selectedVersion !== PROTOCOL_VERSION)
    || !['accepted', 'protocol_failure'].includes(result.classification) || typeof result.code !== 'string') {
    throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  }
  return deepFreezeCopy(result);
}

function validateCapabilitiesResult(result, request) {
  assertCredentialFree(result);
  exactFields(result, ['protocolVersion', 'requestId', 'capabilities', 'physicalDispatchEnabled', 'classification', 'code', 'schemaDigest']);
  assertDenseArray(result.capabilities);
  if (result.protocolVersion !== PROTOCOL_VERSION || result.requestId !== request.requestId
    || result.capabilities.some((capability) => !PROTOCOL_CAPABILITIES.includes(capability))
    || new Set(result.capabilities).size !== result.capabilities.length
    || JSON.stringify([...result.capabilities].sort()) !== JSON.stringify(result.capabilities)
    || typeof result.physicalDispatchEnabled !== 'boolean' || result.classification !== 'accepted'
    || result.code !== 'CAPABILITIES_DISCOVERED' || result.schemaDigest !== SCHEMA_DIGEST
    || result.physicalDispatchEnabled !== result.capabilities.includes(PHYSICAL_CAPABILITY)) {
    throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  }
  return deepFreezeCopy(result);
}

function validatePhysicalEvidence(value) {
  exactFields(value, ['transactionId', 'journalId', 'recoveryStatus', 'effectFingerprint']);
  requireIdentifier(value.transactionId);
  requireIdentifier(value.journalId);
  if (!['COMMITTED', 'RECOVERED'].includes(value.recoveryStatus) || !DIGEST.test(value.effectFingerprint)) {
    throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  }
}

function validateOperationResult(result, request) {
  assertCredentialFree(result);
  exactFields(result, [
    'protocolVersion', 'requestId', 'operationId', 'idempotencyKey', 'intentFingerprint',
    'externalExecutionId', 'classification', 'code', 'observationSequence', 'observedAt',
  ], ['physicalEvidence']);
  if (result.protocolVersion !== PROTOCOL_VERSION || result.requestId !== request.requestId
    || result.operationId !== request.operationId || result.idempotencyKey !== request.idempotencyKey
    || result.intentFingerprint !== request.intentFingerprint || !RESULT_CLASSIFICATIONS.includes(result.classification)
    || typeof result.code !== 'string' || (result.externalExecutionId !== null && !IDENTIFIER.test(result.externalExecutionId))
    || (request.externalExecutionId && result.externalExecutionId !== request.externalExecutionId)
    || requireSequence(result.observationSequence, false) === undefined
    || (request.afterObservationSequence !== undefined && result.observationSequence <= request.afterObservationSequence)) {
    throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  }
  requireTimestamp(result.observedAt);
  if (Object.hasOwn(result, 'physicalEvidence')) validatePhysicalEvidence(result.physicalEvidence);
  if (result.classification === 'succeeded' && !Object.hasOwn(result, 'physicalEvidence')) {
    throw failure('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
  }
  return deepFreezeCopy(result);
}

module.exports = Object.freeze({
  PROTOCOL_VERSION, PHYSICAL_CAPABILITY, OPERATIONS, RESULT_CLASSIFICATIONS,
  PROTOCOL_CAPABILITIES, REQUEST_FIELDS, PHYSICAL_EXECUTION_FIELDS, SCHEMA_DOCUMENT,
  SCHEMA_DIGEST, ProtocolError, failure, isPlainObject, deepFreezeCopy,
  assertCredentialFree, exactFields, canonicalSerialize, validateRequest,
  validateNegotiationResult, validateCapabilitiesResult, validateOperationResult,
});
