'use strict';

const FORBIDDEN_OUTPUT_KEYS =
  new Set([
    'command',
    'shell',
    'mutationProvider',
    'capabilityGrant',
    'grant',
    'authorization',
    'approval',
    'privateKey',
    'credential',
    'compareAndReplace',
    'write',
    'patch',
    'execution'
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

function rejectForbiddenOutputKeys(
  value
) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(
      'Ollama cognitive output is malformed.'
    );
  }

  for (const key of Object.keys(value)) {
    if (
      FORBIDDEN_OUTPUT_KEYS.has(key)
    ) {
      throw new Error(
        `Ollama cognitive output contains forbidden authority field: ${key}.`
      );
    }
  }
}

function createMessages(request) {
  return deepFreeze([
    {
      role:
        'system',

      content:
        'You are a cognitive provider inside Surgical DevOps. ' +
        'Return only JSON cognitive evidence. ' +
        'Do not claim execution authority, shell authority, mutation authority, ' +
        'authorization authority, credentials, private keys or capability grants.'
    },

    {
      role:
        'user',

      content:
        JSON.stringify({
          capability:
            request.capability,

          objective:
            request.objective,

          context:
            request.context
        })
    }
  ]);
}

function createTransportRequest(
  model,
  request
) {
  return deepFreeze({
    operation:
      'CHAT',

    model,

    stream:
      false,

    temperature:
      0,

    messages:
      createMessages(request)
  });
}

function parseOllamaResponse(
  response
) {
  if (
    !response ||
    typeof response !== 'object' ||
    Array.isArray(response)
  ) {
    throw new Error(
      'Ollama response is malformed.'
    );
  }

  if (
    !response.message ||
    typeof response.message !== 'object' ||
    response.message.role !==
      'assistant' ||
    typeof response.message.content !==
      'string' ||
    !response.message.content.trim()
  ) {
    throw new Error(
      'Ollama response message is malformed.'
    );
  }

  let output;

  try {
    output =
      JSON.parse(
        response.message.content
      );
  } catch {
    throw new Error(
      'Ollama response content is not valid JSON.'
    );
  }

  rejectForbiddenOutputKeys(
    output
  );

  return deepFreeze({
    ...output
  });
}

function createOllamaAIProviderAdapter(
  input
) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error(
      'Ollama adapter configuration is required.'
    );
  }

  const providerId =
    requireText(
      input.providerId,
      'providerId'
    );

  const model =
    requireText(
      input.model,
      'model'
    );

  if (
    typeof input.transport !==
      'function'
  ) {
    throw new Error(
      'Ollama transport is required.'
    );
  }

  const transport =
    input.transport;

  async function invoke(
    request
  ) {
    if (
      !request ||
      typeof request !== 'object' ||
      request.schema !==
        'sdo.ai_cognitive_request.v1'
    ) {
      throw new Error(
        'Ollama cognitive request is malformed.'
      );
    }

    if (
      request.providerId !==
        providerId
    ) {
      throw new Error(
        'Ollama adapter provider binding mismatch.'
      );
    }

    const transportRequest =
      createTransportRequest(
        model,
        request
      );

    const response =
      await transport(
        transportRequest
      );

    const output =
      parseOllamaResponse(
        response
      );

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
        'COMPLETED',

      output
    });
  }

  return Object.freeze({
    schema:
      'sdo.ollama_ai_provider_adapter.v1',

    providerId,

    model,

    invoke
  });
}

module.exports = Object.freeze({
  createOllamaAIProviderAdapter
});
