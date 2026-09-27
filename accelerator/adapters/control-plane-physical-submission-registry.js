'use strict';

const {
  ProtocolError,
  RESULT_CLASSIFICATIONS,
  assertCredentialFree,
  canonicalSerialize,
  deepFreezeCopy,
  exactFields,
  validateRequest,
} = require('../core/control-plane-protocol-v2');

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled', 'rejected']);
const PROGRESS = Object.freeze({
  accepted: 1, running: 2, unknown: 2, indeterminate: 2,
  succeeded: 3, failed: 3, cancelled: 3, rejected: 3,
});

function error(classification, code) {
  return new ProtocolError(classification, code, 'Physical submission registry rejected the operation');
}

function same(left, right) {
  return canonicalSerialize(left) === canonicalSerialize(right);
}

function timestamp(value) {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function createInMemoryControlPlanePhysicalSubmissionRegistry() {
  const records = new Map();
  const idempotency = new Map();
  const external = new Map();
  const metrics = { claims: 0, durableWrites: 0, replayClaims: 0, observations: 0 };

  function entry(record) {
    return deepFreezeCopy({
      request: record.request,
      operationId: record.request.operationId,
      idempotencyKey: record.request.idempotencyKey,
      intentFingerprint: record.request.intentFingerprint,
      principal: record.request.principal,
      authority: record.request.authority,
      workspace: record.request.workspace,
      repository: record.request.repository,
      physicalExecution: record.request.physicalExecution,
      externalExecutionId: record.externalExecutionId,
      currentObservationState: record.currentObservationState,
      observationSequence: record.observationSequence,
      observedAt: record.observedAt,
      lastCode: record.lastCode,
      ...(record.physicalEvidence ? { physicalEvidence: record.physicalEvidence } : {}),
    });
  }

  function requireBound(request) {
    const record = records.get(request.operationId);
    if (!record || idempotency.get(request.idempotencyKey) !== record) {
      throw error('unknown', 'UNKNOWN_SUBMISSION');
    }
    if (!same(record.request.principal, request.principal)) throw error('authorization_failure', 'PRINCIPAL_SUBSTITUTION');
    if (!same(record.request.authority, request.authority)) throw error('authorization_failure', 'AUTHORITY_WIDENING');
    if (!same(record.request.workspace, request.workspace) || !same(record.request.repository, request.repository)) {
      throw error('stale_state', 'WORKSPACE_REPOSITORY_MISMATCH');
    }
    if (!same(record.request.physicalExecution, request.physicalExecution)) {
      throw error('authorization_failure', 'PHYSICAL_EXECUTION_BINDING_MISMATCH');
    }
    if (record.request.intentFingerprint !== request.intentFingerprint) throw error('protocol_failure', 'INTENT_FINGERPRINT_MISMATCH');
    if (request.externalExecutionId !== undefined && request.externalExecutionId !== record.externalExecutionId) {
      throw error('protocol_failure', 'FORGED_EXTERNAL_EXECUTION_ID');
    }
    return record;
  }

  function claim(input) {
    exactFields(input, ['request', 'externalExecutionId', 'observedAt']);
    assertCredentialFree(input);
    const request = validateRequest('submit', input.request);
    if (typeof input.externalExecutionId !== 'string' || input.externalExecutionId.length < 8 || !timestamp(input.observedAt)) {
      throw error('internal_failure', 'REGISTRY_FAILURE');
    }
    metrics.claims += 1;
    const keyed = idempotency.get(request.idempotencyKey);
    if (keyed) {
      if (same(keyed.request, request)) {
        metrics.replayClaims += 1;
        return deepFreezeCopy({ created: false, entry: entry(keyed) });
      }
      throw error('protocol_failure', 'IDEMPOTENCY_CONFLICT');
    }
    const existing = records.get(request.operationId);
    if (existing) {
      if (!same(existing.request.principal, request.principal)) throw error('authorization_failure', 'PRINCIPAL_SUBSTITUTION');
      if (!same(existing.request.authority, request.authority)) throw error('authorization_failure', 'AUTHORITY_WIDENING');
      throw error('protocol_failure', 'OPERATION_BINDING_CONFLICT');
    }
    if (external.has(input.externalExecutionId)) throw error('protocol_failure', 'EXTERNAL_EXECUTION_ID_CONFLICT');
    const record = {
      request,
      externalExecutionId: input.externalExecutionId,
      currentObservationState: 'accepted',
      observationSequence: 1,
      observedAt: input.observedAt,
      lastCode: 'SUBMISSION_REGISTERED',
      physicalEvidence: null,
    };
    records.set(request.operationId, record);
    idempotency.set(request.idempotencyKey, record);
    external.set(input.externalExecutionId, record);
    metrics.durableWrites += 1;
    return deepFreezeCopy({ created: true, entry: entry(record) });
  }

  function get(request) {
    assertCredentialFree(request);
    return entry(requireBound(request));
  }

  function observe(input) {
    exactFields(input, ['request', 'classification', 'code', 'observedAt'], ['physicalEvidence']);
    assertCredentialFree(input);
    const record = requireBound(input.request);
    if (!RESULT_CLASSIFICATIONS.includes(input.classification) || typeof input.code !== 'string'
      || input.code.length < 1 || input.code.length > 256 || !timestamp(input.observedAt)) {
      throw error('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
    }
    if (input.request.afterObservationSequence !== record.observationSequence) {
      throw error('stale_state', 'STALE_OBSERVATION_SEQUENCE');
    }
    const previous = PROGRESS[record.currentObservationState] || 0;
    const next = PROGRESS[input.classification] || 0;
    if ((TERMINAL.has(record.currentObservationState) && input.classification !== record.currentObservationState)
      || next < previous) {
      throw error('protocol_failure', 'RESULT_STATE_REGRESSION');
    }
    if (input.classification === 'succeeded' && !input.physicalEvidence) {
      throw error('internal_failure', 'PHYSICAL_EVIDENCE_REQUIRED');
    }
    record.currentObservationState = input.classification;
    record.observationSequence += 1;
    record.observedAt = input.observedAt;
    record.lastCode = input.code;
    if (input.physicalEvidence) record.physicalEvidence = deepFreezeCopy(input.physicalEvidence);
    metrics.observations += 1;
    metrics.durableWrites += 1;
    return entry(record);
  }

  return Object.freeze({
    claim, get, observe,
    inspect: () => Object.freeze([...records.values()].map(entry)),
    inspectMetrics: () => deepFreezeCopy(metrics),
  });
}

module.exports = Object.freeze({ createInMemoryControlPlanePhysicalSubmissionRegistry });
