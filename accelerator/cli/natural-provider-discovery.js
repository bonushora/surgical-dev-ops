'use strict';

/*
 * NATURAL local cognitive-provider discovery.
 *
 * Discovery is deliberately bounded to the local Ollama HTTP API.
 *
 * It does not:
 * - invoke a cognitive model;
 * - select operational authority;
 * - execute a shell;
 * - mutate configuration;
 * - install software;
 * - download models;
 * - authenticate to remote providers; or
 * - change Orchestrator authority.
 */

const OLLAMA_TAGS_ENDPOINT =
  'http://127.0.0.1:11434/api/tags';

const {
  QUALIFIED_LOCAL_MODELS,
  DEFAULT_MODEL_PROFILE,
  requireQualifiedLocalModel
} = require(
  './natural-qualified-model-registry'
);

const DEFAULT_PROVIDER_ID =
  DEFAULT_MODEL_PROFILE.providerId;

const DEFAULT_MODEL =
  DEFAULT_MODEL_PROFILE.model;

const {
  NATURAL_LOCAL_INFERENCE_PROFILE
} = require(
  './natural-local-inference-profile'
);

const DISCOVERY_TIMEOUT_MS =
  1500;

const MAX_RESPONSE_BYTES =
  262144;

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

function unavailable(
  reason,
  profile = DEFAULT_MODEL_PROFILE
) {
  return deepFreeze({
    schema:
      'sdo.natural_provider_discovery.v1',

    providerId:
      profile.providerId,

    provider:
      'Ollama',

    model:
      profile.model,

    modelProfile:
      profile.profile,

    local:
      true,

    available:
      false,

    cognitiveAuthority:
      false,

    operationalAuthority:
      false,

    inferenceProfile:
      NATURAL_LOCAL_INFERENCE_PROFILE,

    reason
  });
}

async function readBoundedResponse(response) {
  if (
    !response ||
    typeof response !== 'object' ||
    typeof response.status !== 'number'
  ) {
    throw new Error(
      'Ollama discovery response is malformed.'
    );
  }

  if (
    response.status < 200 ||
    response.status >= 300
  ) {
    throw new Error(
      'Ollama discovery HTTP request failed.'
    );
  }

  if (
    !response.body ||
    typeof response.body.getReader !== 'function'
  ) {
    throw new Error(
      'Ollama discovery response body is malformed.'
    );
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder();

  let totalBytes = 0;
  let text = '';

  try {
    while (true) {
      const {
        done,
        value
      } =
        await reader.read();

      if (done) {
        break;
      }

      if (!(value instanceof Uint8Array)) {
        throw new Error(
          'Ollama discovery response is malformed.'
        );
      }

      totalBytes +=
        value.byteLength;

      if (
        totalBytes >
        MAX_RESPONSE_BYTES
      ) {
        throw new Error(
          'Ollama discovery response exceeds size limit.'
        );
      }

      text +=
        decoder.decode(
          value,
          {
            stream: true
          }
        );
    }

    text += decoder.decode();

    return text;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Discovery owns no cleanup escalation authority.
    }
  }
}

function parseModels(text) {
  let payload;

  try {
    payload =
      JSON.parse(text);
  } catch {
    throw new Error(
      'Ollama discovery returned malformed JSON.'
    );
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    !Array.isArray(payload.models)
  ) {
    throw new Error(
      'Ollama discovery model inventory is malformed.'
    );
  }

  return payload.models;
}

async function discoverNaturalDefaultProvider(
  input = {}
) {
  let profile;

  try {
    profile =
      requireQualifiedLocalModel(
        input.model ||
        DEFAULT_MODEL
      );
  } catch {
    return unavailable(
      'Requested local model is not qualified for NATURAL.',
      DEFAULT_MODEL_PROFILE
    );
  }

  const fetchImplementation =
    input.fetchImplementation ||
    globalThis.fetch;

  if (
    typeof fetchImplementation !==
    'function'
  ) {
    return unavailable(
      'Local Ollama discovery is unavailable.',
      profile
    );
  }

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      DISCOVERY_TIMEOUT_MS
    );

  let response;

  try {
    response =
      await fetchImplementation(
        OLLAMA_TAGS_ENDPOINT,
        {
          method: 'GET',
          signal: controller.signal
        }
      );
  } catch {
    return unavailable(
      'Local Ollama service is unavailable.',
      profile
    );
  } finally {
    clearTimeout(timer);
  }

  let models;

  try {
    const text =
      await readBoundedResponse(
        response
      );

    models =
      parseModels(text);
  } catch {
    return unavailable(
      'Local Ollama model inventory could not be verified.',
      profile
    );
  }

  const found =
    models.some(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        (
          entry.name === profile.model ||
          entry.model === profile.model
        )
    );

  if (!found) {
    return unavailable(
      `${profile.label} is not installed in the local Ollama runtime.`,
      profile
    );
  }

  return deepFreeze({
    schema:
      'sdo.natural_provider_discovery.v1',

    providerId:
      profile.providerId,

    provider:
      'Ollama',

    model:
      profile.model,

    modelProfile:
      profile.profile,

    local:
      true,

    available:
      true,

    cognitiveAuthority:
      true,

    operationalAuthority:
      false,

    inferenceProfile:
      NATURAL_LOCAL_INFERENCE_PROFILE,

    reason:
      `Local Ollama and ${profile.label} were verified.`
  });
}

module.exports = Object.freeze({
  OLLAMA_TAGS_ENDPOINT,
  DEFAULT_PROVIDER_ID,
  DEFAULT_MODEL,
  QUALIFIED_LOCAL_MODELS,
  discoverNaturalDefaultProvider
});
