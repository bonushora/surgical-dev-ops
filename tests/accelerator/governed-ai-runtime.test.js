'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const {
  AI_CAPABILITIES,
  createAIProviderPort
} = require('../../accelerator/core/ai-provider');

const {
  createAIProviderSelector
} = require('../../accelerator/core/ai-provider-selector');

const {
  createAIProviderExecutionSeam
} = require('../../accelerator/core/ai-provider-execution');

const {
  createGovernedAIRuntime
} = require('../../accelerator/core/governed-ai-runtime');

function createFixture({
  providerId =
    'test:cognitive',

  capabilities =
    AI_CAPABILITIES,

  invoke
} = {}) {
  const providerPort =
    createAIProviderPort({
      providerId,
      capabilities
    });

  const selector =
    createAIProviderSelector({
      providers: [
        {
          providerId
        }
      ]
    });

  const executionSeam =
    createAIProviderExecutionSeam({
      providerId,

      invoke:
        invoke ||
        (async (request) =>
          Object.freeze({
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

            output:
              Object.freeze({
                summary:
                  'Cognitive evidence only.'
              })
          }))
    });

  return {
    providerId,
    providerPort,
    selector,
    executionSeam
  };
}

test(
  'governed AI runtime composes provider-neutral cognitive execution',
  async () => {
    const fixture =
      createFixture();

    const runtime =
      createGovernedAIRuntime({
        selector:
          fixture.selector,

        providerPorts: {
          [fixture.providerId]:
            fixture.providerPort
        },

        executionSeams: {
          [fixture.providerId]:
            fixture.executionSeam
        }
      });

    const result =
      await runtime.invoke({
        providerId:
          fixture.providerId,

        requestId:
          'req-runtime-1',

        capability:
          'PLAN',

        objective:
          'Determine the next safe engineering step.',

        context: {
          interactionMode:
            'ENGINEER'
        }
      });

    assert.equal(
      runtime.schema,
      'sdo.governed_ai_runtime.v1'
    );

    assert.ok(
      Object.isFrozen(runtime)
    );

    assert.equal(
      result.status,
      'COMPLETED'
    );

    assert.equal(
      result.providerId,
      fixture.providerId
    );

    assert.equal(
      result.capability,
      'PLAN'
    );

    assert.deepEqual(
      result.output,
      {
        summary:
          'Cognitive evidence only.'
      }
    );
  }
);

test(
  'unknown provider fails closed before cognitive dispatch',
  async () => {
    let calls = 0;

    const fixture =
      createFixture({
        invoke:
          async () => {
            calls += 1;
            throw new Error(
              'must not dispatch'
            );
          }
      });

    const runtime =
      createGovernedAIRuntime({
        selector:
          fixture.selector,

        providerPorts: {
          [fixture.providerId]:
            fixture.providerPort
        },

        executionSeams: {
          [fixture.providerId]:
            fixture.executionSeam
        }
      });

    await assert.rejects(
      () =>
        runtime.invoke({
          providerId:
            'unknown:provider',

          requestId:
            'req-runtime-denied',

          capability:
            'PLAN',

          objective:
            'Do not dispatch.',

          context: {}
        }),
      /not available|selection|denied/i
    );

    assert.equal(
      calls,
      0
    );
  }
);

test(
  'runtime fails closed when selected provider port is absent',
  async () => {
    const fixture =
      createFixture();

    const runtime =
      createGovernedAIRuntime({
        selector:
          fixture.selector,

        providerPorts: {},

        executionSeams: {
          [fixture.providerId]:
            fixture.executionSeam
        }
      });

    await assert.rejects(
      () =>
        runtime.invoke({
          providerId:
            fixture.providerId,

          requestId:
            'req-no-port',

          capability:
            'PLAN',

          objective:
            'Fail closed.',

          context: {}
        }),
      /provider port|unavailable/i
    );
  }
);

test(
  'runtime fails closed when selected execution seam is absent',
  async () => {
    const fixture =
      createFixture();

    const runtime =
      createGovernedAIRuntime({
        selector:
          fixture.selector,

        providerPorts: {
          [fixture.providerId]:
            fixture.providerPort
        },

        executionSeams: {}
      });

    await assert.rejects(
      () =>
        runtime.invoke({
          providerId:
            fixture.providerId,

          requestId:
            'req-no-seam',

          capability:
            'PLAN',

          objective:
            'Fail closed.',

          context: {}
        }),
      /execution seam|unavailable/i
    );
  }
);

test(
  'runtime preserves provider capability governance',
  async () => {
    let calls = 0;

    const fixture =
      createFixture({
        capabilities: [
          'EXPLAIN'
        ],

        invoke:
          async () => {
            calls += 1;
            throw new Error(
              'must not dispatch'
            );
          }
      });

    const runtime =
      createGovernedAIRuntime({
        selector:
          fixture.selector,

        providerPorts: {
          [fixture.providerId]:
            fixture.providerPort
        },

        executionSeams: {
          [fixture.providerId]:
            fixture.executionSeam
        }
      });

    await assert.rejects(
      () =>
        runtime.invoke({
          providerId:
            fixture.providerId,

          requestId:
            'req-capability-denied',

          capability:
            'PLAN',

          objective:
            'Do not dispatch.',

          context: {}
        }),
      /capability|denied/i
    );

    assert.equal(
      calls,
      0
    );
  }
);

test(
  'runtime exposes no operational authority',
  () => {
    const fixture =
      createFixture();

    const runtime =
      createGovernedAIRuntime({
        selector:
          fixture.selector,

        providerPorts: {
          [fixture.providerId]:
            fixture.providerPort
        },

        executionSeams: {
          [fixture.providerId]:
            fixture.executionSeam
        }
      });

    for (const forbidden of [
      'execute',
      'exec',
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
        Object.prototype.hasOwnProperty.call(
          runtime,
          forbidden
        ),
        false,
        `${forbidden} must not cross governed AI runtime boundary`
      );
    }
  }
);

test(
  'runtime configuration rejects malformed composition',
  () => {
    const fixture =
      createFixture();

    for (const configuration of [
      null,
      {},
      {
        selector:
          fixture.selector
      },
      {
        selector:
          fixture.selector,
        providerPorts: {}
      }
    ]) {
      assert.throws(
        () =>
          createGovernedAIRuntime(
            configuration
          ),
        /runtime|selector|provider|execution|object/i
      );
    }
  }
);
