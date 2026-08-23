'use strict';

const {
  createAICognitiveRequest
} = require('./ai-provider-invocation');

const {
  executeAICognitiveRequest
} = require('./ai-provider-execution');

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

function createGovernedAIRuntime(input) {
  requirePlainObject(
    input,
    'Governed AI runtime configuration'
  );

  const selector =
    requirePlainObject(
      input.selector,
      'AI provider selector'
    );

  if (
    selector.schema !==
      'sdo.ai_provider_selector.v1' ||
    typeof selector.select !==
      'function' ||
    !Object.isFrozen(selector)
  ) {
    throw new Error(
      'AI provider selector is malformed or mutable.'
    );
  }

  const providerPorts =
    requirePlainObject(
      input.providerPorts,
      'AI provider ports'
    );

  const executionSeams =
    requirePlainObject(
      input.executionSeams,
      'AI provider execution seams'
    );

  async function invoke(requestInput) {
    requirePlainObject(
      requestInput,
      'Governed AI invocation'
    );

    const providerId =
      requireText(
        requestInput.providerId,
        'providerId'
      );

    const selection =
      selector.select(providerId);

    if (
      !selection ||
      selection.decision !==
        'SELECTED' ||
      selection.providerId !==
        providerId
    ) {
      throw new Error(
        selection &&
        typeof selection.reason ===
          'string'
          ? selection.reason
          : 'AI provider selection was denied.'
      );
    }

    const providerPort =
      providerPorts[providerId];

    if (!providerPort) {
      throw new Error(
        'Selected AI provider port is unavailable.'
      );
    }

    const executionSeam =
      executionSeams[providerId];

    if (!executionSeam) {
      throw new Error(
        'Selected AI provider execution seam is unavailable.'
      );
    }

    const cognitiveRequest =
      createAICognitiveRequest(
        providerPort,
        {
          requestId:
            requestInput.requestId,

          capability:
            requestInput.capability,

          objective:
            requestInput.objective,

          context:
            requestInput.context
        }
      );

    if (
      cognitiveRequest.providerId !==
        providerId
    ) {
      throw new Error(
        'Selected AI provider does not match cognitive request binding.'
      );
    }

    return executeAICognitiveRequest(
      executionSeam,
      cognitiveRequest
    );
  }

  return Object.freeze({
    schema:
      'sdo.governed_ai_runtime.v1',

    invoke
  });
}

module.exports = Object.freeze({
  createGovernedAIRuntime
});
