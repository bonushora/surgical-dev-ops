'use strict';

const {
  PROTOCOL_VERSION,
  PHYSICAL_CAPABILITY,
  PROTOCOL_CAPABILITIES,
  SCHEMA_DIGEST,
  ProtocolError,
  assertCredentialFree,
  deepFreezeCopy,
  validateRequest,
} = require('./control-plane-protocol-v2');

const DESCRIPTOR_FIELDS = Object.freeze([
  'protocolVersion', 'capability', 'physicalDispatchEnabled', 'authorityOwner',
  'genericShell', 'genericFilesystemWriter', 'providerCredential',
]);

function serviceError(classification, code) {
  return new ProtocolError(classification, code, 'Physical protocol service rejected the operation');
}

function timestamp(now) {
  let value;
  try { value = now(); } catch { throw serviceError('internal_failure', 'INTERNAL_FAILURE'); }
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw serviceError('internal_failure', 'INTERNAL_FAILURE');
  }
  return value;
}

function exactDescriptor(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Reflect.ownKeys(value).length !== DESCRIPTOR_FIELDS.length
    || DESCRIPTOR_FIELDS.some((field) => !Object.hasOwn(value, field))) return false;
  return value.protocolVersion === PROTOCOL_VERSION
    && value.capability === PHYSICAL_CAPABILITY
    && value.physicalDispatchEnabled === true
    && value.authorityOwner === 'surgical-dev-ops'
    && value.genericShell === false
    && value.genericFilesystemWriter === false
    && value.providerCredential === false;
}

function evidence(value, request) {
  const fields = ['transactionId', 'journalId', 'recoveryStatus', 'effectFingerprint'];
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Reflect.ownKeys(value).length !== fields.length
    || fields.some((field) => !Object.hasOwn(value, field))) {
    throw serviceError('internal_failure', 'PHYSICAL_EVIDENCE_REQUIRED');
  }
  const transactionId = value.transactionId;
  const journalId = value.journalId;
  if (typeof transactionId !== 'string' || transactionId.length < 8
    || typeof journalId !== 'string' || journalId.length < 8
    || !['COMMITTED', 'RECOVERED'].includes(value.recoveryStatus)
    || !/^[a-f0-9]{64}$/.test(value.effectFingerprint)) {
    throw serviceError('internal_failure', 'PHYSICAL_EVIDENCE_REQUIRED');
  }
  return deepFreezeCopy({
    transactionId,
    journalId,
    recoveryStatus: value.recoveryStatus,
    effectFingerprint: value.effectFingerprint,
  });
}

function createControlPlanePhysicalService(options = {}) {
  const allowed = new Set(['registry', 'governedPhysicalExecutor', 'now', 'createExternalExecutionId']);
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Reflect.ownKeys(options).some((key) => typeof key !== 'string' || !allowed.has(key))
    || !options.registry || ['claim', 'get', 'observe', 'inspect'].some((method) => typeof options.registry[method] !== 'function')
    || typeof options.now !== 'function' || typeof options.createExternalExecutionId !== 'function') {
    throw new TypeError('Physical protocol service dependencies are invalid');
  }
  let executor = null;
  if (options.governedPhysicalExecutor !== undefined) {
    if (!options.governedPhysicalExecutor || typeof options.governedPhysicalExecutor.describe !== 'function'
      || typeof options.governedPhysicalExecutor.execute !== 'function'
      || typeof options.governedPhysicalExecutor.reconcile !== 'function') {
      throw new TypeError('Governed physical executor is invalid');
    }
    const descriptor = options.governedPhysicalExecutor.describe();
    if (!exactDescriptor(descriptor)) throw new TypeError('Governed physical executor descriptor is invalid');
    executor = options.governedPhysicalExecutor;
  }
  const metrics = {
    protocolValidations: 0,
    registryClaims: 0,
    physicalDispatches: 0,
    identicalReplays: 0,
    reconciliations: 0,
    automaticResubmissions: 0,
  };

  function result(request, entry, code = entry.lastCode) {
    return deepFreezeCopy({
      protocolVersion: PROTOCOL_VERSION,
      requestId: request.requestId,
      operationId: request.operationId,
      idempotencyKey: request.idempotencyKey,
      intentFingerprint: request.intentFingerprint,
      externalExecutionId: entry.externalExecutionId,
      classification: entry.currentObservationState,
      code,
      observationSequence: entry.observationSequence,
      observedAt: entry.observedAt,
      ...(entry.currentObservationState === 'succeeded'
        ? { physicalEvidence: entry.physicalEvidence }
        : {}),
    });
  }

  function observationRequest(request, entry) {
    return deepFreezeCopy({
      protocolVersion: PROTOCOL_VERSION,
      requestId: request.requestId,
      operationId: entry.operationId,
      idempotencyKey: entry.idempotencyKey,
      intentFingerprint: entry.intentFingerprint,
      principal: entry.principal,
      authority: entry.authority,
      workspace: entry.workspace,
      repository: entry.repository,
      physicalExecution: entry.physicalExecution,
      externalExecutionId: entry.externalExecutionId,
      afterObservationSequence: entry.observationSequence,
    });
  }

  async function negotiate(input) {
    const request = validateRequest('negotiate', input);
    metrics.protocolValidations += 1;
    const compatible = request.supportedVersions.includes(PROTOCOL_VERSION);
    return deepFreezeCopy({
      requestId: request.requestId,
      selectedVersion: compatible ? PROTOCOL_VERSION : null,
      supportedVersions: [PROTOCOL_VERSION],
      classification: compatible ? 'accepted' : 'protocol_failure',
      code: compatible ? 'PROTOCOL_NEGOTIATED' : 'UNSUPPORTED_PROTOCOL_VERSION',
    });
  }

  async function capabilities(input) {
    const request = validateRequest('capabilities', input);
    metrics.protocolValidations += 1;
    const capabilities = executor ? [...PROTOCOL_CAPABILITIES] : ['inspect', 'reconcile'];
    return deepFreezeCopy({
      protocolVersion: PROTOCOL_VERSION,
      requestId: request.requestId,
      capabilities,
      physicalDispatchEnabled: executor !== null,
      classification: 'accepted',
      code: 'CAPABILITIES_DISCOVERED',
      schemaDigest: SCHEMA_DIGEST,
    });
  }

  async function submit(input) {
    const request = validateRequest('submit', input);
    metrics.protocolValidations += 1;
    if (!executor) throw serviceError('unsupported_capability', 'PHYSICAL_DISPATCH_DISABLED');
    let externalExecutionId;
    try { externalExecutionId = options.createExternalExecutionId(request); }
    catch { throw serviceError('internal_failure', 'REGISTRY_FAILURE'); }
    metrics.registryClaims += 1;
    const claim = options.registry.claim({ request, externalExecutionId, observedAt: timestamp(options.now) });
    if (!claim.created) {
      metrics.identicalReplays += 1;
      return result(request, claim.entry, 'IDENTICAL_PHYSICAL_REPLAY');
    }
    metrics.physicalDispatches += 1;
    try {
      const execution = await executor.execute(deepFreezeCopy({ request, externalExecutionId }));
      if (!execution || execution.classification !== 'succeeded') {
        throw serviceError('internal_failure', 'INVALID_PHYSICAL_EXECUTOR_RESULT');
      }
      const observed = options.registry.observe({
        request: observationRequest(request, claim.entry),
        classification: 'succeeded',
        code: execution.code || 'PHYSICAL_MUTATION_SUCCEEDED',
        observedAt: timestamp(options.now),
        physicalEvidence: evidence(execution.physicalEvidence, request),
      });
      return result(request, observed);
    } catch (caught) {
      const classification = caught && caught.classification;
      const code = caught && caught.code;
      if (classification === 'indeterminate') {
        const observed = options.registry.observe({
          request: observationRequest(request, claim.entry),
          classification: 'indeterminate',
          code: code || 'PHYSICAL_OUTCOME_INDETERMINATE',
          observedAt: timestamp(options.now),
        });
        return result(request, observed);
      }
      const rejected = ['authorization_failure', 'authentication_failure', 'stale_state', 'protocol_failure'].includes(classification)
        ? 'rejected' : 'failed';
      options.registry.observe({
        request: observationRequest(request, claim.entry),
        classification: rejected,
        code: code || 'PHYSICAL_DISPATCH_FAILED',
        observedAt: timestamp(options.now),
      });
      if (caught instanceof ProtocolError) throw caught;
      if (classification && code) throw serviceError(classification, code);
      throw serviceError('internal_failure', 'PHYSICAL_DISPATCH_FAILED');
    }
  }

  async function reconcile(input) {
    const request = validateRequest('reconcile', input);
    metrics.protocolValidations += 1;
    metrics.reconciliations += 1;
    const current = options.registry.get(request);
    let classification = current.currentObservationState;
    let code = current.lastCode || 'PHYSICAL_EVIDENCE_UNKNOWN';
    let physicalEvidence = current.physicalEvidence;
    if (!['succeeded', 'failed', 'cancelled', 'rejected'].includes(classification) && executor) {
      const recovered = await executor.reconcile(deepFreezeCopy({ request, entry: current }));
      if (recovered && recovered.classification) {
        classification = recovered.classification;
        code = recovered.code || 'PHYSICAL_EVIDENCE_UNKNOWN';
        if (classification === 'succeeded') physicalEvidence = evidence(recovered.physicalEvidence, request);
      }
    }
    const observed = options.registry.observe({
      request: observationRequest(request, current), classification, code,
      observedAt: timestamp(options.now), ...(physicalEvidence ? { physicalEvidence } : {}),
    });
    return result(request, observed);
  }

  async function inspect(input) {
    const request = validateRequest('inspect', input);
    const current = options.registry.get(request);
    const observed = options.registry.observe({
      request: observationRequest(request, current),
      classification: current.currentObservationState,
      code: current.lastCode || 'OBSERVATION_INSPECTED',
      observedAt: timestamp(options.now),
      ...(current.physicalEvidence ? { physicalEvidence: current.physicalEvidence } : {}),
    });
    return result(request, observed);
  }

  async function cancel(input) {
    validateRequest('cancel', input);
    throw serviceError('unsupported_capability', 'NON_INTERRUPTIBLE_MUTATION');
  }

  return Object.freeze({
    protocolVersion: PROTOCOL_VERSION,
    schemaDigest: SCHEMA_DIGEST,
    physicalDispatchEnabled: executor !== null,
    negotiate, capabilities, submit, reconcile, inspect, cancel,
    inspectMetrics: () => deepFreezeCopy(metrics),
  });
}

module.exports = Object.freeze({ createControlPlanePhysicalService });
