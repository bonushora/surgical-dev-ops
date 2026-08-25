'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AI_CAPABILITIES,
  createAIProviderPort
} = require('../../accelerator/core/ai-provider');

const {
  createAICognitiveRequest
} = require('../../accelerator/core/ai-provider-invocation');

const {
  createAIProviderExecutionSeam,
  executeAICognitiveRequest
} = require('../../accelerator/core/ai-provider-execution');

const {
  createOllamaAIProviderAdapter
} = require('../../accelerator/adapters/ollama-ai-provider-adapter');

function createRequest(
  capability = 'PLAN'
) {
  const port =
    createAIProviderPort({
      providerId:
        'ollama:llama3',
      capabilities:
        AI_CAPABILITIES
    });

  return createAICognitiveRequest(
    port,
    {
      requestId:
        `req-${capability.toLowerCase()}`,

      capability,

      objective:
        'Determine the next safe engineering step.',

      context: {
        workspace:
          '/tmp/example',

        interactionMode:
          'ENGINEER'
      }
    }
  );
}

test(
  'Ollama adapter is immutable and provider-bound',
  () => {
    const adapter =
      createOllamaAIProviderAdapter({
        providerId:
          'ollama:llama3',

        model:
          'llama3:latest',

        transport:
          async () => {
            throw new Error(
              'not invoked'
            );
          }
      });

    assert.equal(
      adapter.schema,
      'sdo.ollama_ai_provider_adapter.v1'
    );

    assert.equal(
      adapter.providerId,
      'ollama:llama3'
    );

    assert.equal(
      adapter.model,
      'llama3:latest'
    );

    assert.equal(
      typeof adapter.invoke,
      'function'
    );

    assert.ok(
      Object.isFrozen(adapter)
    );
  }
);

test(
  'adapter emits bounded non-streaming Ollama chat request',
  async () => {
    const request =
      createRequest();

    let observed = null;

    const adapter =
      createOllamaAIProviderAdapter({
        providerId:
          request.providerId,

        model:
          'llama3:latest',

        transport:
          async (value) => {
            observed = value;

            return Object.freeze({
              message:
                Object.freeze({
                  role: 'assistant',
                  content: JSON.stringify({
                    summary:
                      'Inspect the implementation before proposing a patch.'
                  })
                })
            });
          }
      });

    const raw =
      await adapter.invoke(
        request
      );

    assert.ok(observed);

    assert.equal(
      observed.operation,
      'CHAT'
    );

    assert.equal(
      observed.model,
      'llama3:latest'
    );

    assert.equal(
      observed.stream,
      false
    );

    assert.equal(
      observed.temperature,
      0
    );

    assert.equal(
      observed.maxOutputTokens,
      512
    );

    assert.ok(
      Array.isArray(
        observed.messages
      )
    );

    assert.ok(
      Object.isFrozen(
        observed
      )
    );

    assert.ok(
      Object.isFrozen(
        observed.messages
      )
    );

    assert.equal(
      raw.schema,
      'sdo.ai_cognitive_result.v1'
    );

    assert.equal(
      raw.requestId,
      request.requestId
    );

    assert.equal(
      raw.requestFingerprint,
      request.fingerprint
    );

    assert.equal(
      raw.providerId,
      request.providerId
    );

    assert.equal(
      raw.capability,
      request.capability
    );

    assert.equal(
      raw.status,
      'COMPLETED'
    );

    assert.deepEqual(
      raw.output,
      {
        summary:
          'Inspect the implementation before proposing a patch.'
      }
    );

    assert.ok(Object.isFrozen(raw));
    assert.ok(Object.isFrozen(raw.output));
  }
);

test(
  'adapter composes through canonical execution seam',
  async () => {
    const request =
      createRequest();

    const adapter =
      createOllamaAIProviderAdapter({
        providerId:
          request.providerId,

        model:
          'llama3:latest',

        transport:
          async () =>
            Object.freeze({
              message:
                Object.freeze({
                  role:
                    'assistant',

                  content:
                    JSON.stringify({
                      summary:
                        'Use declarative inspection first.'
                    })
                })
            })
      });

    const seam =
      createAIProviderExecutionSeam({
        providerId:
          request.providerId,

        invoke:
          adapter.invoke
      });

    const result =
      await executeAICognitiveRequest(
        seam,
        request
      );

    assert.equal(
      result.status,
      'COMPLETED'
    );

    assert.equal(
      result.output.summary,
      'Use declarative inspection first.'
    );
  }
);

test(
  'adapter rejects provider mismatch before transport invocation',
  async () => {
    const request =
      createRequest();

    let calls = 0;

    const adapter =
      createOllamaAIProviderAdapter({
        providerId:
          'ollama:other',

        model:
          'llama3:latest',

        transport:
          async () => {
            calls += 1;
            return Object.freeze({});
          }
      });

    await assert.rejects(
      () =>
        adapter.invoke(request),
      /provider|binding|mismatch/i
    );

    assert.equal(
      calls,
      0
    );
  }
);

test(
  'adapter rejects malformed Ollama response',
  async () => {
    const request =
      createRequest();

    for (const response of [
      null,
      {},
      Object.freeze({
        message:
          Object.freeze({
            role:
              'assistant'
          })
      }),
      Object.freeze({
        message:
          Object.freeze({
            role:
              'assistant',

            content:
              'not-json'
          })
      })
    ]) {
      const adapter =
        createOllamaAIProviderAdapter({
          providerId:
            request.providerId,

          model:
            'llama3:latest',

          transport:
            async () => response
        });

      await assert.rejects(
        () =>
          adapter.invoke(request),
        /ollama|response|json|malformed/i
      );
    }
  }
);

test(
  'adapter rejects authority-bearing model output',
  async () => {
    const request =
      createRequest();

    for (const output of [
      {
        summary: 'candidate',
        command: 'rm -rf /'
      },
      {
        summary: 'candidate',
        shell: {}
      },
      {
        summary: 'candidate',
        mutationProvider: {}
      },
      {
        summary: 'candidate',
        capabilityGrant: {}
      },
      {
        summary: 'candidate',
        privateKey: 'secret'
      }
    ]) {
      const adapter =
        createOllamaAIProviderAdapter({
          providerId:
            request.providerId,

          model:
            'llama3:latest',

          transport:
            async () =>
              Object.freeze({
                message:
                  Object.freeze({
                    role:
                      'assistant',

                    content:
                      JSON.stringify(
                        output
                      )
                  })
              })
        });

      await assert.rejects(
        () =>
          adapter.invoke(request),
        /authority|forbidden|output/i
      );
    }
  }
);

test(
  'adapter configuration rejects missing model or transport',
  () => {
    assert.throws(
      () =>
        createOllamaAIProviderAdapter({
          providerId:
            'ollama:llama3',

          transport:
            async () => {}
        }),
      /model/i
    );

    assert.throws(
      () =>
        createOllamaAIProviderAdapter({
          providerId:
            'ollama:llama3',

          model:
            'llama3:latest'
        }),
      /transport/i
    );
  }
);

test(
  'protocol adapter itself has no network shell process or mutation authority',
  () => {
    const fs =
      require('node:fs');

    const source =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/adapters/ollama-ai-provider-adapter'
        ),
        'utf8'
      );

    for (const forbidden of [
      'child_process',
      'execSync',
      'spawnSync',
      'http.request',
      'https.request',
      'fetch(',
      'filesystem-patch-adapter',
      'mutation-provider-internal',
      'mutation-provider-composition',
      'content-addressed-mutation-provider'
    ]) {
      assert.equal(
        source.includes(forbidden),
        false,
        `forbidden authority dependency: ${forbidden}`
      );
    }
  }
);
