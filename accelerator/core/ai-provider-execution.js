'use strict';

const {
  validateAICognitiveResult
} = require('./ai-provider-invocation');

const trustedExecutionSeams =
  new WeakSet();

function deepFreeze(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function requireText(value, name) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    throw new Error(
      `${name} is required.`
    );
  }

  return value.trim();
}

function createAIProviderExecutionSeam(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error(
      'AI provider execution seam configuration is required.'
    );
  }

  const providerId =
    requireText(
      input.providerId,
      'providerId'
    );

  if (typeof input.invoke !== 'function') {
    throw new Error(
      'AI provider execution seam invoke function is required.'
    );
  }

  const seam =
    Object.freeze({
      schema:
        'sdo.ai_provider_execution_seam.v1',

      providerId,

      invoke:
        input.invoke
    });

  trustedExecutionSeams.add(seam);

  return seam;
}

function failedResult(
  request,
  reason
) {
  return deepFreeze({
    schema:
      'sdo.ai_cognitive_result.v1',

    requestId:
      request.requestId,

    requestFingerprint:
      request.fingerprint,

    providerId:
      request.providerId,

    capability:
      request.capability,

    status:
      'FAILED',

    output:
      null,

    reason
  });
}

function validateExecutionSeam(
  seam,
  request
) {
  if (
    !seam ||
    typeof seam !== 'object' ||
    !Object.isFrozen(seam) ||
    !trustedExecutionSeams.has(seam) ||
    seam.schema !==
      'sdo.ai_provider_execution_seam.v1' ||
    typeof seam.invoke !== 'function'
  ) {
    throw new Error(
      'AI provider execution seam is malformed, mutable, or untrusted.'
    );
  }

  if (
    !request ||
    typeof request !== 'object' ||
    request.schema !==
      'sdo.ai_cognitive_request.v1' ||
    !Object.isFrozen(request)
  ) {
    throw new Error(
      'AI cognitive request is malformed.'
    );
  }

  if (
    seam.providerId !==
      request.providerId
  ) {
    throw new Error(
      'AI provider execution seam provider does not match request binding.'
    );
  }
}

async function executeAICognitiveRequest(
  seam,
  request
) {
  validateExecutionSeam(
    seam,
    request
  );

  let rawResult;

  try {
    rawResult =
      await seam.invoke(request);
  } catch {
    const failure =
      failedResult(
        request,
        'AI provider invocation failed.'
      );

    return validateAICognitiveResult(
      failure,
      request
    );
  }

  return validateAICognitiveResult(
    rawResult,
    request
  );
}

module.exports = Object.freeze({
  createAIProviderExecutionSeam,
  executeAICognitiveRequest
});
