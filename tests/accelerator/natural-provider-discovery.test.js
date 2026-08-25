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
  'NATURAL discovers local Qwen 3 8B through bounded Ollama inventory',
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
                    'qwen3:8b',
                  model:
                    'qwen3:8b'
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

    assert.equal(
      result.inferenceProfile.profileId,
      'ollama-cpu-bounded-v2'
    );

    assert.equal(
      result.inferenceProfile.acceleration,
      'OLLAMA_AUTO'
    );

    assert.equal(
      result.inferenceProfile.operationalAuthority,
      false
    );

    assert.ok(
      Object.isFrozen(
        result.inferenceProfile
      )
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
  'NATURAL verifies the qualified Gemma fast profile only when explicitly selected',
  async () => {
    const result =
      await discoverNaturalDefaultProvider({
        model:
          'gemma3:4b',
        fetchImplementation:
          async () =>
            responseFor({
              models: [
                {
                  name:
                    'gemma3:4b'
                }
              ]
            })
      });

    assert.equal(
      result.available,
      true
    );
    assert.equal(
      result.providerId,
      'ollama:gemma3:4b'
    );
    assert.equal(
      result.modelProfile,
      'FAST_BILINGUAL'
    );
    assert.equal(
      result.operationalAuthority,
      false
    );
  }
);

test(
  'NATURAL rejects Llama and arbitrary local model selection before activation',
  async () => {
    let dispatches = 0;
    const result =
      await discoverNaturalDefaultProvider({
        model:
          'llama3:latest',
        fetchImplementation:
          async () => {
            dispatches += 1;
            return responseFor({
              models: [
                { name: 'llama3:latest' }
              ]
            });
          }
      });

    assert.equal(dispatches, 0);
    assert.equal(result.available, false);
    assert.equal(result.operationalAuthority, false);
    assert.match(result.reason, /not qualified/i);
  }
);

test(
  'NATURAL does not claim provider availability when Qwen 3 8B is absent',
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
      'ollama:qwen3:8b'
    );

    assert.equal(
      result.operationalAuthority,
      false
    );

    assert.match(
      result.reason,
      /qwen 3 8b|not installed/i
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
