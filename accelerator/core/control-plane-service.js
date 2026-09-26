'use strict';

const {
  PROTOCOL_VERSION,
  PROTOCOL_CAPABILITIES,
  SCHEMA_DIGEST,
  ProtocolError,
  assertCredentialFree,
  deepFreezeCopy,
  exactFields,
  validateRequest,
} = require('./control-plane-protocol');

const OPTION_FIELDS = new Set([
  'registry', 'gateway', 'now', 'createExternalExecutionId',
  'invokeNonPhysicalGateway', 'supportedRequestedCapabilities',
  'supportsCancellation',
]);

function serviceError(classification, code, message = 'Protocol service rejected the operation') {
  return new ProtocolError(classification, code, message);
}

function requireTimestamp(now) {
  let value;
  try {
    value = now();
  } catch {
    throw serviceError('internal_failure', 'INTERNAL_FAILURE');
  }
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw serviceError('internal_failure', 'INTERNAL_FAILURE');
  }
  return value;
}

function createControlPlaneProtocolService(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Reflect.ownKeys(options).some((key) => typeof key !== 'string' || !OPTION_FIELDS.has(key))) {
    throw new TypeError('Control Plane protocol service options are invalid');
  }
  if (!options.registry
    || ['claim', 'get', 'observe', 'inspect'].some(
      (method) => typeof options.registry[method] !== 'function',
    )
    || typeof options.now !== 'function'
    || typeof options.createExternalExecutionId !== 'function') {
    throw new TypeError('Control Plane protocol service dependencies are invalid');
  }
  assertCredentialFree(options.supportedRequestedCapabilities || []);
  const requestedCapabilities = Object.freeze([
    ...(options.supportedRequestedCapabilities || ['mutation.propose']),
  ].sort());
  if (requestedCapabilities.length === 0
    || new Set(requestedCapabilities).size !== requestedCapabilities.length
    || requestedCapabilities.some((value) => typeof value !== 'string' || value.length < 8)) {
    throw new TypeError('Requested capability catalog is invalid');
  }
  const supportsCancellation = options.supportsCancellation === true;
  const invokeNonPhysicalGateway = options.invokeNonPhysicalGateway === true;
  if (invokeNonPhysicalGateway) {
    if (!options.gateway || typeof options.gateway.describe !== 'function'
      || typeof options.gateway.submit !== 'function') {
      throw new TypeError('Injected non-physical governed gateway is invalid');
    }
    const descriptor = options.gateway.describe();
    if (!descriptor || descriptor.protocol !== 'sdo.non_physical_gateway.v1'
      || descriptor.physicalDispatch !== false) {
      throw new TypeError('Injected gateway must prove physical dispatch is disabled');
    }
  }

  function result(request, entry, classification, code) {
    return deepFreezeCopy({
      protocolVersion: PROTOCOL_VERSION,
      requestId: request.requestId,
      operationId: request.operationId,
      idempotencyKey: request.idempotencyKey,
      intentFingerprint: request.intentFingerprint,
      externalExecutionId: entry.externalExecutionId,
      classification,
      code,
      observationSequence: entry.observationSequence,
      observedAt: entry.observedAt,
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
      externalExecutionId: entry.externalExecutionId,
      afterObservationSequence: request.afterObservationSequence,
    });
  }

  async function negotiate(input) {
    const request = validateRequest('negotiate', input);
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
    const available = PROTOCOL_CAPABILITIES.filter(
      (capability) => capability !== 'cancel' || supportsCancellation,
    );
    return deepFreezeCopy({
      protocolVersion: PROTOCOL_VERSION,
      requestId: request.requestId,
      capabilities: available,
      physicalDispatchEnabled: false,
      classification: 'accepted',
      code: 'CAPABILITIES_DISCOVERED',
      schemaDigest: SCHEMA_DIGEST,
    });
  }

  async function submit(input) {
    const request = validateRequest('submit', input);
    if (!requestedCapabilities.includes(request.requestedCapability)) {
      throw serviceError('unsupported_capability', 'UNSUPPORTED_CAPABILITY');
    }
    let externalExecutionId;
    try {
      externalExecutionId = options.createExternalExecutionId({
        operationId: request.operationId,
        idempotencyKey: request.idempotencyKey,
        intentFingerprint: request.intentFingerprint,
      });
    } catch {
      throw serviceError('internal_failure', 'REGISTRY_FAILURE');
    }
    let claim;
    try {
      claim = options.registry.claim({
        request,
        externalExecutionId,
        observedAt: requireTimestamp(options.now),
      });
    } catch (error) {
      if (error instanceof ProtocolError) throw error;
      throw serviceError('internal_failure', 'REGISTRY_FAILURE');
    }
    if (invokeNonPhysicalGateway && claim.created) {
      try {
        await options.gateway.submit(request);
      } catch {
        const observeRequest = observationRequest({
          ...request,
          afterObservationSequence: claim.entry.observationSequence,
        }, claim.entry);
        const indeterminate = options.registry.observe({
          request: observeRequest,
          classification: 'indeterminate',
          code: 'NON_PHYSICAL_GATEWAY_FAILURE',
          observedAt: requireTimestamp(options.now),
        });
        return result(request, indeterminate, 'indeterminate', 'NON_PHYSICAL_GATEWAY_FAILURE');
      }
    }
    return result(
      request,
      claim.entry,
      'accepted',
      claim.created ? 'SUBMISSION_REGISTERED' : 'IDENTICAL_REPLAY',
    );
  }

  async function observe(operation, input, classification, code) {
    const request = validateRequest(operation, input);
    let current;
    try {
      current = options.registry.get(request);
      const observed = options.registry.observe({
        request: observationRequest(request, current),
        classification,
        code,
        observedAt: requireTimestamp(options.now),
      });
      return result(request, observed, classification, code);
    } catch (error) {
      if (error instanceof ProtocolError) throw error;
      throw serviceError('internal_failure', 'REGISTRY_FAILURE');
    }
  }

  async function reconcile(input) {
    return observe('reconcile', input, 'unknown', 'OBSERVATION_UNKNOWN');
  }

  async function inspect(input) {
    const request = validateRequest('inspect', input);
    const current = options.registry.get(request);
    return observe(
      'inspect',
      request,
      current.currentObservationState,
      'OBSERVATION_INSPECTED',
    );
  }

  async function cancel(input) {
    const request = validateRequest('cancel', input);
    if (!supportsCancellation) {
      throw serviceError('unsupported_capability', 'UNSUPPORTED_CAPABILITY');
    }
    return observe('cancel', request, 'cancelled', 'CANCELLATION_REGISTERED');
  }

  return Object.freeze({
    protocolVersion: PROTOCOL_VERSION,
    physicalDispatchEnabled: false,
    negotiate,
    capabilities,
    submit,
    reconcile,
    cancel,
    inspect,
  });
}

module.exports = Object.freeze({
  createControlPlaneProtocolService,
});
