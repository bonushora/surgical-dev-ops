'use strict';

const ENDPOINT =
  'http://127.0.0.1:11434/api/chat';

const TIMEOUT_MS =
  180000;

const MAX_RESPONSE_BYTES =
  131072;

const ALLOWED_CONFIGURATION_KEYS =
  new Set([
    'fetchImplementation'
  ]);

const ALLOWED_REQUEST_KEYS =
  new Set([
    'operation',
    'model',
    'stream',
    'temperature',
    'messages'
  ]);

function deepFreeze(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (
    const child
    of Object.values(value)
  ) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function requirePlainObject(
  value,
  label
) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${label} is malformed.`
    );
  }

  return value;
}

function rejectUnknownKeys(
  value,
  allowed,
  label
) {
  for (
    const key
    of Object.keys(value)
  ) {
    if (!allowed.has(key)) {
      throw new Error(
        `${label} contains forbidden configuration or authority field: ${key}.`
      );
    }
  }
}

function validateConfiguration(
  input
) {
  requirePlainObject(
    input,
    'Local Ollama transport configuration'
  );

  rejectUnknownKeys(
    input,
    ALLOWED_CONFIGURATION_KEYS,
    'Local Ollama transport configuration'
  );

  if (
    typeof input.fetchImplementation !==
      'function'
  ) {
    throw new Error(
      'Local Ollama transport fetch implementation is required.'
    );
  }
}

function validateMessages(
  messages
) {
  if (
    !Array.isArray(messages) ||
    messages.length === 0
  ) {
    throw new Error(
      'Local Ollama transport request messages are malformed.'
    );
  }

  for (const message of messages) {
    if (
      !message ||
      typeof message !== 'object' ||
      Array.isArray(message) ||
      ![
        'system',
        'user',
        'assistant'
      ].includes(message.role) ||
      typeof message.content !== 'string' ||
      !message.content.trim()
    ) {
      throw new Error(
        'Local Ollama transport request messages are malformed.'
      );
    }
  }
}

function validateRequest(
  request
) {
  requirePlainObject(
    request,
    'Local Ollama transport request'
  );

  rejectUnknownKeys(
    request,
    ALLOWED_REQUEST_KEYS,
    'Local Ollama transport request'
  );

  if (
    request.operation !==
      'CHAT'
  ) {
    throw new Error(
      'Local Ollama transport request operation must be CHAT.'
    );
  }

  if (
    typeof request.model !==
      'string' ||
    !request.model.trim()
  ) {
    throw new Error(
      'Local Ollama transport request model is required.'
    );
  }

  if (
    request.stream !==
      false
  ) {
    throw new Error(
      'Local Ollama transport request stream must be false.'
    );
  }

  if (
    request.temperature !==
      0
  ) {
    throw new Error(
      'Local Ollama transport request temperature must be zero.'
    );
  }

  validateMessages(
    request.messages
  );
}

async function readBoundedText(
  response
) {
  if (
    !response ||
    typeof response !== 'object' ||
    typeof response.status !== 'number'
  ) {
    throw new Error(
      'Local Ollama transport response is malformed.'
    );
  }

  if (
    response.status < 200 ||
    response.status >= 300
  ) {
    throw new Error(
      'Local Ollama HTTP request failed.'
    );
  }

  if (
    !response.body ||
    typeof response.body.getReader !==
      'function'
  ) {
    throw new Error(
      'Local Ollama transport response body is malformed.'
    );
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder();

  let totalBytes =
    0;

  let text =
    '';

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
          'Local Ollama transport response is malformed.'
        );
      }

      totalBytes +=
        value.byteLength;

      if (
        totalBytes >
        MAX_RESPONSE_BYTES
      ) {
        throw new Error(
          'Local Ollama response exceeds size limit.'
        );
      }

      text +=
        decoder.decode(
          value,
          {
            stream:
              true
          }
        );
    }

    text +=
      decoder.decode();

    return text;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // No authority or cleanup escalation.
    }
  }
}

function parseResponse(
  text
) {
  let parsed;

  try {
    parsed =
      JSON.parse(text);
  } catch {
    throw new Error(
      'Local Ollama response contains malformed JSON.'
    );
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      'Local Ollama response is malformed.'
    );
  }

  return deepFreeze(parsed);
}

function createLocalOllamaTransport(
  input
) {
  validateConfiguration(
    input
  );

  const fetchImplementation =
    input.fetchImplementation;

  async function invoke(
    request
  ) {
    validateRequest(
      request
    );

    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () =>
          controller.abort(),
        TIMEOUT_MS
      );

    const body =
      JSON.stringify({
        model:
          request.model.trim(),

        messages:
          request.messages,

        stream:
          false,

        format:
          'json',

        options: {
          temperature:
            0
        }
      });

    let response;

    try {
      response =
        await fetchImplementation(
          ENDPOINT,
          {
            method:
              'POST',

            headers: {
              'content-type':
                'application/json'
            },

            body,

            signal:
              controller.signal
          }
        );
    } catch {
      throw new Error(
        'Local Ollama transport failed.'
      );
    } finally {
      clearTimeout(timer);
    }

    const text =
      await readBoundedText(
        response
      );

    return parseResponse(
      text
    );
  }

  return Object.freeze({
    schema:
      'sdo.ollama_local_transport.v1',

    endpoint:
      ENDPOINT,

    invoke
  });
}

module.exports = Object.freeze({
  createLocalOllamaTransport
});
