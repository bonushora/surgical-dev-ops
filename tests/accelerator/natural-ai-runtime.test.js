'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const {
  createNaturalLocalAIComposition,
  invokeNaturalCognitive
} = require(
  '../../accelerator/cli/natural-ai-runtime'
);

function discovery(
  overrides = {}
) {
  return Object.freeze({
    schema:
      'sdo.natural_provider_discovery.v1',

    providerId:
      'ollama:qwen3:8b',

    provider:
      'Ollama',

    model:
      'qwen3:8b',

    modelProfile:
      'QUALITY_BILINGUAL',

    local:
      true,

    available:
      true,

    cognitiveAuthority:
      true,

    operationalAuthority:
      false,

    reason:
      'verified',

    ...overrides
  });
}

function ollamaResponse(output) {
  return new Response(
    JSON.stringify({
      message: {
        role:
          'assistant',

        content:
          JSON.stringify(output)
      }
    }),
    {
      status: 200,

      headers: {
        'content-type':
          'application/json'
      }
    }
  );
}

test(
  'NATURAL composes verified local Qwen 3 8B only through governed AI runtime',
  () => {
    const composition =
      createNaturalLocalAIComposition({
        discovery:
          discovery(),

        fetchImplementation:
          async () => {
            throw new Error(
              'not invoked'
            );
          }
      });

    assert.equal(
      composition.schema,
      'sdo.natural_local_ai_composition.v1'
    );

    assert.equal(
      composition.providerId,
      'ollama:qwen3:8b'
    );

    assert.equal(
      composition.model,
      'qwen3:8b'
    );

    assert.equal(
      composition.runtime.schema,
      'sdo.governed_ai_runtime.v1'
    );

    assert.equal(
      composition.operationalAuthority,
      false
    );

    assert.equal(
      composition.inferenceProfile.profileId,
      'ollama-cpu-bounded-v2'
    );

    assert.ok(
      Object.isFrozen(composition)
    );
  }
);

test(
  'NATURAL refuses composition when local provider discovery is unavailable',
  () => {
    assert.throws(
      () =>
        createNaturalLocalAIComposition({
          discovery:
            discovery({
              available: false
            }),

          fetchImplementation:
            async () => {}
        }),
      /discovery|required|verified/i
    );
  }
);

test(
  'NATURAL governed invocation reaches Ollama adapter as cognitive evidence only',
  async () => {
    let observedBody = null;

    const composition =
      createNaturalLocalAIComposition({
        discovery:
          discovery(),

        fetchImplementation:
          async (
            url,
            options
          ) => {
            assert.equal(
              url,
              'http://127.0.0.1:11434/api/chat'
            );

            observedBody =
              JSON.parse(
                options.body
              );

            return ollamaResponse({
              summary:
                'O projeto deve ser inspecionado antes de qualquer alteração.'
            });
          }
      });

    const result =
      await invokeNaturalCognitive(
        composition,
        {
          requestId:
            'natural-test-001',

          capability:
            'EXPLAIN',

          objective:
            'Explique de forma simples o próximo passo seguro.',

          context: {
            interactionMode:
              'NATURAL',

            workspace:
              'example'
          }
        }
      );

    assert.equal(
      result.schema,
      'sdo.ai_cognitive_result.v1'
    );

    assert.equal(
      result.providerId,
      'ollama:qwen3:8b'
    );

    assert.equal(
      result.capability,
      'EXPLAIN'
    );

    assert.equal(
      result.status,
      'COMPLETED'
    );

    assert.deepEqual(
      result.output,
      {
        summary:
          'O projeto deve ser inspecionado antes de qualquer alteração.'
      }
    );

    assert.equal(
      observedBody.model,
      'qwen3:8b'
    );

    assert.equal(
      observedBody.stream,
      false
    );

    assert.equal(
      observedBody.format,
      'json'
    );
  }
);

test(
  'NATURAL AI composition exposes no operational authority',
  () => {
    const boundary =
      require(
        '../../accelerator/cli/natural-ai-runtime'
      );

    for (const forbidden of [
      'exec',
      'execute',
      'spawn',
      'shell',
      'command',
      'patch',
      'write',
      'compareAndReplace',
      'mutationProvider',
      'approve',
      'authorize',
      'sign',
      'privateKey',
      'grant',
      'capabilityGrant'
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
