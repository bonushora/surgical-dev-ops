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

const DEFAULT_PROVIDER_ID =
  'ollama:llama3';

const DEFAULT_MODEL =
  'llama3:latest';

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

function unavailable(reason) {
  return deepFreeze({
    schema:
      'sdo.natural_provider_discovery.v1',

    providerId:
      DEFAULT_PROVIDER_ID,

    provider:
      'Ollama',

    model:
      DEFAULT_MODEL,

    local:
      true,

    available:
      false,

    cognitiveAuthority:
      false,

    operationalAuthority:
      false,

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
  const fetchImplementation =
    input.fetchImplementation ||
    globalThis.fetch;

  if (
    typeof fetchImplementation !==
    'function'
  ) {
    return unavailable(
      'Local Ollama discovery is unavailable.'
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
      'Local Ollama service is unavailable.'
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
      'Local Ollama model inventory could not be verified.'
    );
  }

  const found =
    models.some(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        (
          entry.name === DEFAULT_MODEL ||
          entry.model === DEFAULT_MODEL
        )
    );

  if (!found) {
    return unavailable(
      'Llama 3 is not installed in the local Ollama runtime.'
    );
  }

  return deepFreeze({
    schema:
      'sdo.natural_provider_discovery.v1',

    providerId:
      DEFAULT_PROVIDER_ID,

    provider:
      'Ollama',

    model:
      DEFAULT_MODEL,

    local:
      true,

    available:
      true,

    cognitiveAuthority:
      true,

    operationalAuthority:
      false,

    reason:
      'Local Ollama and Llama 3 were verified.'
  });
}

module.exports = Object.freeze({
  OLLAMA_TAGS_ENDPOINT,
  DEFAULT_PROVIDER_ID,
  DEFAULT_MODEL,
  discoverNaturalDefaultProvider
});
