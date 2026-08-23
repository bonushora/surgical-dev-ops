'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const {
  OLLAMA_TAGS_ENDPOINT,
  DEFAULT_PROVIDER_ID,
  DEFAULT_MODEL,
  discoverNaturalDefaultProvider
} = require(
  '../../accelerator/cli/natural-provider-discovery'
);

function responseFor(payload) {
  const bytes =
    new TextEncoder()
      .encode(
        JSON.stringify(payload)
      );

  let sent = false;

  return {
    status: 200,

    body: {
      getReader() {
        return {
          async read() {
            if (sent) {
              return {
                done: true,
                value: undefined
              };
            }

            sent = true;

            return {
              done: false,
              value: bytes
            };
          },

          releaseLock() {}
        };
      }
    }
  };
}

test(
  'NATURAL discovers local Llama 3 through bounded Ollama inventory',
  async () => {
    let observedUrl = null;
    let observedOptions = null;

    const result =
      await discoverNaturalDefaultProvider({
        fetchImplementation:
          async (url, options) => {
            observedUrl = url;
            observedOptions = options;

            return responseFor({
              models: [
                {
                  name:
                    'llama3:latest',
                  model:
                    'llama3:latest'
                }
              ]
            });
          }
      });

    assert.equal(
      observedUrl,
      OLLAMA_TAGS_ENDPOINT
    );

    assert.equal(
      observedOptions.method,
      'GET'
    );

    assert.equal(
      result.providerId,
      DEFAULT_PROVIDER_ID
    );

    assert.equal(
      result.model,
      DEFAULT_MODEL
    );

    assert.equal(
      result.available,
      true
    );

    assert.equal(
      result.local,
      true
    );

    assert.equal(
      result.cognitiveAuthority,
      true
    );

    assert.equal(
      result.operationalAuthority,
      false
    );

    assert.ok(
      Object.isFrozen(result)
    );
  }
);

test(
  'NATURAL remains deterministic when Ollama is unavailable',
  async () => {
    const result =
      await discoverNaturalDefaultProvider({
        fetchImplementation:
          async () => {
            throw new Error(
              'connection refused'
            );
          }
      });

    assert.equal(
      result.available,
      false
    );

    assert.equal(
      result.operationalAuthority,
      false
    );

    assert.match(
      result.reason,
      /ollama|unavailable/i
    );
  }
);

test(
  'NATURAL does not claim provider availability when Llama 3 is absent',
  async () => {
    const result =
      await discoverNaturalDefaultProvider({
        fetchImplementation:
          async () =>
            responseFor({
              models: [
                {
                  name:
                    'another-model:latest'
                }
              ]
            })
      });

    assert.equal(
      result.available,
      false
    );

    assert.equal(
      result.providerId,
      'ollama:llama3'
    );

    assert.equal(
      result.operationalAuthority,
      false
    );

    assert.match(
      result.reason,
      /llama 3|not installed/i
    );
  }
);

test(
  'provider discovery exposes no mutation or shell surface',
  () => {
    const boundary =
      require(
        '../../accelerator/cli/natural-provider-discovery'
      );

    for (const forbidden of [
      'exec',
      'execute',
      'spawn',
      'shell',
      'command',
      'patch',
      'write',
      'install',
      'pull',
      'download',
      'approve',
      'authorize',
      'grant',
      'privateKey',
      'credential'
    ]) {
      assert.equal(
        Object.prototype
          .hasOwnProperty.call(
            boundary,
            forbidden
          ),
        false
      );
    }
  }
);
