'use strict';

const crypto = require('crypto');

const {
  evaluateAIProviderPort
} = require('./ai-provider');

const FORBIDDEN_CONTEXT_KEYS =
  new Set([
    'grant',
    'grantEvaluation',
    'capabilityGrant',
    'mutationProvider',
    'providerQualification',
    'compareAndReplace',
    'privateKey',
    'credential',
    'shell',
    'command',
    'executable'
  ]);

const FORBIDDEN_RESULT_KEYS =
  new Set([
    'execution',
    'command',
    'shell',
    'patch',
    'write',
    'grant',
    'capabilityGrant',
    'mutationProvider',
    'compareAndReplace',
    'authorization',
    'approval',
    'privateKey',
    'credential'
  ]);

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

function isDeepFrozen(
  value,
  seen = new Set()
) {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return true;
  }

  if (seen.has(value)) {
    return true;
  }

  if (!Object.isFrozen(value)) {
    return false;
  }

  seen.add(value);

  return Object
    .values(value)
    .every(
      (child) =>
        isDeepFrozen(child, seen)
    );
}

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
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

function requirePlainObject(
  value,
  name
) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${name} must be an object.`
    );
  }

  return value;
}

function rejectForbiddenKeys(
  value,
  forbidden,
  label
) {
  for (const key of Object.keys(value)) {
    if (forbidden.has(key)) {
      throw new Error(
        `${label} contains forbidden authority field: ${key}.`
      );
    }
  }
}

function createAICognitiveRequest(
  providerPort,
  input
) {
  requirePlainObject(
    input,
    'AI cognitive request'
  );

  const requestId =
    requireText(
      input.requestId,
      'requestId'
    );

  const objective =
    requireText(
      input.objective,
      'objective'
    );

  const evaluation =
    evaluateAIProviderPort(
      providerPort,
      {
        capability:
          input.capability
      }
    );

  if (
    !evaluation ||
    evaluation.decision !==
      'ALLOWED'
  ) {
    const reason =
      evaluation &&
      typeof evaluation.reason === 'string'
        ? evaluation.reason
        : 'AI provider capability was denied.';

    throw new Error(reason);
  }

  const context =
    requirePlainObject(
      input.context,
      'AI cognitive context'
    );

  rejectForbiddenKeys(
    context,
    FORBIDDEN_CONTEXT_KEYS,
    'AI cognitive context'
  );

  const descriptor =
    {
      schema:
        'sdo.ai_cognitive_request.v1',

      requestId,

      providerId:
        evaluation.providerId,

      capability:
        evaluation.capability,

      objective,

      context:
        deepFreeze({
          ...context
        })
    };

  return deepFreeze({
    ...descriptor,

    fingerprint:
      fingerprint(descriptor)
  });
}

function validateAICognitiveResult(
  result,
  request
) {
  if (
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    !isDeepFrozen(result)
  ) {
    throw new Error(
      'AI cognitive result is malformed or not deeply immutable.'
    );
  }

  if (
    !request ||
    request.schema !==
      'sdo.ai_cognitive_request.v1' ||
    !isDeepFrozen(request)
  ) {
    throw new Error(
      'AI cognitive request binding is malformed.'
    );
  }

  if (
    result.schema !==
      'sdo.ai_cognitive_result.v1'
  ) {
    throw new Error(
      'AI cognitive result schema is malformed.'
    );
  }

  rejectForbiddenKeys(
    result,
    FORBIDDEN_RESULT_KEYS,
    'AI cognitive result'
  );

  if (
    result.requestId !==
      request.requestId ||
    result.requestFingerprint !==
      request.fingerprint ||
    result.providerId !==
      request.providerId ||
    result.capability !==
      request.capability
  ) {
    throw new Error(
      'AI cognitive result is not exactly bound to the request.'
    );
  }

  if (
    ![
      'COMPLETED',
      'FAILED'
    ].includes(result.status)
  ) {
    throw new Error(
      'AI cognitive result status is malformed.'
    );
  }

  if (result.status === 'COMPLETED') {
    if (
      !result.output ||
      typeof result.output !== 'object' ||
      Array.isArray(result.output) ||
      !isDeepFrozen(result.output)
    ) {
      throw new Error(
        'Completed AI cognitive result output is malformed or not immutable.'
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        result,
        'reason'
      ) &&
      result.reason !== undefined &&
      result.reason !== null
    ) {
      throw new Error(
        'Completed AI cognitive result cannot carry a failure reason.'
      );
    }
  }

  if (result.status === 'FAILED') {
    if (result.output !== null) {
      throw new Error(
        'Failed AI cognitive result must not expose successful output.'
      );
    }

    requireText(
      result.reason,
      'AI cognitive failure reason'
    );
  }

  return result;
}

module.exports = Object.freeze({
  createAICognitiveRequest,
  validateAICognitiveResult
});
