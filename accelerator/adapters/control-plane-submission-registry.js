'use strict';

const {
  PROTOCOL_VERSION,
  ProtocolError,
  RESULT_CLASSIFICATIONS,
  assertCredentialFree,
  canonicalSerialize,
  deepFreezeCopy,
  exactFields,
  validateRequest,
} = require('../core/control-plane-protocol');

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled', 'rejected']);
const PROGRESS = Object.freeze({ accepted: 1, running: 2, succeeded: 3, failed: 3, cancelled: 3, rejected: 3 });

function registryError(classification, code) {
  return new ProtocolError(classification, code, 'Submission registry rejected the operation');
}

function same(left, right) {
  return canonicalSerialize(left) === canonicalSerialize(right);
}

function bindingFrom(request) {
  return {
    protocolVersion: request.protocolVersion,
    operationId: request.operationId,
    requestId: request.requestId,
    idempotencyKey: request.idempotencyKey,
    intentFingerprint: request.intentFingerprint,
    principal: request.principal,
    authority: request.authority,
    workspace: request.workspace,
    repository: request.repository,
  };
}

function createInMemoryControlPlaneSubmissionRegistry() {
  const byOperation = new Map();
  const byIdempotency = new Map();
  const byExternal = new Map();

  function requireBound(request) {
    const record = byOperation.get(request.operationId);
    const keyed = byIdempotency.get(request.idempotencyKey);
    if (!record || !keyed || record !== keyed) {
      throw registryError('unknown', 'UNKNOWN_SUBMISSION');
    }
    if (!same(record.principal, request.principal)) {
      throw registryError('authorization_failure', 'PRINCIPAL_SUBSTITUTION');
    }
    if (!same(record.authority, request.authority)) {
      throw registryError('authorization_failure', 'AUTHORITY_WIDENING');
    }
    if (!same(record.workspace, request.workspace)
      || !same(record.repository, request.repository)) {
      throw registryError('stale_state', 'WORKSPACE_REPOSITORY_MISMATCH');
    }
    if (record.intentFingerprint !== request.intentFingerprint) {
      throw registryError('protocol_failure', 'INTENT_FINGERPRINT_MISMATCH');
    }
    if (request.externalExecutionId !== undefined
      && request.externalExecutionId !== record.externalExecutionId) {
      throw registryError('protocol_failure', 'FORGED_EXTERNAL_EXECUTION_ID');
    }
    return record;
  }

  function claim(input) {
    exactFields(input, ['request', 'externalExecutionId', 'observedAt']);
    assertCredentialFree(input);
    const request = validateRequest('submit', input.request);
    if (typeof input.externalExecutionId !== 'string'
      || input.externalExecutionId.length < 8) {
      throw registryError('internal_failure', 'REGISTRY_FAILURE');
    }
    const existingKey = byIdempotency.get(request.idempotencyKey);
    if (existingKey) {
      if (same(existingKey.request, request)) {
        return deepFreezeCopy({ created: false, entry: existingKey });
      }
      throw registryError('protocol_failure', 'IDEMPOTENCY_CONFLICT');
    }
    const existingOperation = byOperation.get(request.operationId);
    if (existingOperation) {
      if (!same(existingOperation.principal, request.principal)) {
        throw registryError('authorization_failure', 'PRINCIPAL_SUBSTITUTION');
      }
      if (!same(existingOperation.authority, request.authority)) {
        throw registryError('authorization_failure', 'AUTHORITY_WIDENING');
      }
      if (!same(existingOperation.workspace, request.workspace)
        || !same(existingOperation.repository, request.repository)) {
        throw registryError('stale_state', 'WORKSPACE_REPOSITORY_MISMATCH');
      }
      throw registryError('protocol_failure', 'OPERATION_BINDING_CONFLICT');
    }
    if (byExternal.has(input.externalExecutionId)) {
      throw registryError('protocol_failure', 'EXTERNAL_EXECUTION_ID_CONFLICT');
    }
    const entry = deepFreezeCopy({
      ...bindingFrom(request),
      request,
      externalExecutionId: input.externalExecutionId,
      currentObservationState: 'accepted',
      observationSequence: 1,
      observedAt: input.observedAt,
    });
    byOperation.set(entry.operationId, entry);
    byIdempotency.set(entry.idempotencyKey, entry);
    byExternal.set(entry.externalExecutionId, entry);
    return deepFreezeCopy({ created: true, entry });
  }

  function get(request) {
    assertCredentialFree(request);
    return deepFreezeCopy(requireBound(request));
  }

  function observe(input) {
    exactFields(input, ['request', 'classification', 'code', 'observedAt']);
    assertCredentialFree(input);
    const request = input.request;
    const record = requireBound(request);
    if (!RESULT_CLASSIFICATIONS.includes(input.classification)) {
      throw registryError('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
    }
    if (request.afterObservationSequence !== record.observationSequence) {
      throw registryError('stale_state', 'STALE_OBSERVATION_SEQUENCE');
    }
    const previousRank = PROGRESS[record.currentObservationState];
    const nextRank = PROGRESS[input.classification];
    if (TERMINAL.has(record.currentObservationState)
      && input.classification !== record.currentObservationState) {
      throw registryError('stale_state', 'RESULT_STATE_REGRESSION');
    }
    if (previousRank !== undefined && nextRank !== undefined && nextRank < previousRank) {
      throw registryError('stale_state', 'RESULT_STATE_REGRESSION');
    }
    const next = deepFreezeCopy({
      ...record,
      currentObservationState: input.classification,
      observationSequence: record.observationSequence + 1,
      observedAt: input.observedAt,
      lastCode: input.code,
    });
    byOperation.set(next.operationId, next);
    byIdempotency.set(next.idempotencyKey, next);
    byExternal.set(next.externalExecutionId, next);
    return next;
  }

  function inspect() {
    return Object.freeze([...byOperation.values()]
      .sort((left, right) => left.operationId.localeCompare(right.operationId))
      .map(deepFreezeCopy));
  }

  return Object.freeze({
    protocolVersion: PROTOCOL_VERSION,
    claim,
    get,
    observe,
    inspect,
  });
}

module.exports = Object.freeze({
  createInMemoryControlPlaneSubmissionRegistry,
});
