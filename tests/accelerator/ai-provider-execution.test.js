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

function createPort() {
  return createAIProviderPort({
    providerId: 'test:cognitive',
    capabilities: AI_CAPABILITIES
  });
}

function createRequest() {
  const port = createPort();

  return createAICognitiveRequest(
    port,
    {
      requestId: 'req-execution-001',
      capability: 'PLAN',
      objective: 'Determine the next safe engineering step.',
      context: {
        workspace: '/tmp/example',
        interactionMode: 'ENGINEER'
      }
    }
  );
}

test(
  'execution seam is immutable and exposes only one cognitive invocation function',
  () => {
    const seam =
      createAIProviderExecutionSeam({
        providerId: 'test:cognitive',

        invoke: async () => {
          throw new Error('not invoked');
        }
      });

    assert.equal(
      seam.schema,
      'sdo.ai_provider_execution_seam.v1'
    );

    assert.equal(
      seam.providerId,
      'test:cognitive'
    );

    assert.equal(
      typeof seam.invoke,
      'function'
    );

    assert.ok(Object.isFrozen(seam));

    for (const forbidden of [
      'exec',
      'spawn',
      'shell',
      'command',
      'write',
      'patch',
      'compareAndReplace',
      'mutationProvider',
      'grant',
      'authorize',
      'sign'
    ]) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          seam,
          forbidden
        ),
        false
      );
    }
  }
);

test(
  'valid seam invocation returns only validated cognitive evidence',
  async () => {
    const request =
      createRequest();

    const seam =
      createAIProviderExecutionSeam({
        providerId:
          request.providerId,

        invoke: async (received) => {
          assert.strictEqual(
            received,
            request
          );

          return Object.freeze({
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
                  'Inspect before proposing a patch.'
              })
          });
        }
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
      result.providerId,
      request.providerId
    );

    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.output));
  }
);

test(
  'seam provider identity must match the request provider',
  async () => {
    const request =
      createRequest();

    const seam =
      createAIProviderExecutionSeam({
        providerId:
          'other:provider',

        invoke:
          async () =>
            Object.freeze({})
      });

    await assert.rejects(
      () =>
        executeAICognitiveRequest(
          seam,
          request
        ),
      /provider|bound|mismatch/i
    );
  }
);

test(
  'mutable or malformed seam fails closed before invocation',
  async () => {
    const request =
      createRequest();

    for (const seam of [
      null,
      undefined,
      {},
      {
        schema:
          'sdo.ai_provider_execution_seam.v1',

        providerId:
          request.providerId,

        invoke:
          async () => Object.freeze({})
      }
    ]) {
      await assert.rejects(
        () =>
          executeAICognitiveRequest(
            seam,
            request
          ),
        /seam|trusted|immutable|malformed/i
      );
    }
  }
);

test(
  'executor exception becomes explicit failed cognitive evidence',
  async () => {
    const request =
      createRequest();

    const seam =
      createAIProviderExecutionSeam({
        providerId:
          request.providerId,

        invoke: async () => {
          throw new Error(
            'provider offline'
          );
        }
      });

    const result =
      await executeAICognitiveRequest(
        seam,
        request
      );

    assert.equal(
      result.status,
      'FAILED'
    );

    assert.equal(
      result.output,
      null
    );

    assert.match(
      result.reason,
      /provider invocation failed/i
    );

    assert.ok(Object.isFrozen(result));
  }
);

test(
  'executor cannot return forged provider capability or request binding',
  async () => {
    const request =
      createRequest();

    const forgedResults = [
      {
        providerId:
          'forged:provider'
      },
      {
        capability:
          'EXPLAIN'
      },
      {
        requestId:
          'forged-request'
      },
      {
        requestFingerprint:
          '0'.repeat(64)
      }
    ];

    for (const mutation of forgedResults) {
      const seam =
        createAIProviderExecutionSeam({
          providerId:
            request.providerId,

          invoke:
            async () =>
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
                    summary: 'candidate'
                  }),

                ...mutation
              })
        });

      await assert.rejects(
        () =>
          executeAICognitiveRequest(
            seam,
            request
          ),
        /bound|mismatch|malformed/i
      );
    }
  }
);

test(
  'execution seam cannot smuggle operational authority through result',
  async () => {
    const request =
      createRequest();

    const seam =
      createAIProviderExecutionSeam({
        providerId:
          request.providerId,

        invoke:
          async () =>
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
                  summary: 'candidate'
                }),

              mutationProvider:
                Object.freeze({})
            })
      });

    await assert.rejects(
      () =>
        executeAICognitiveRequest(
          seam,
          request
        ),
      /authority|forbidden|malformed/i
    );
  }
);

test(
  'execution seam source introduces no shell process network or mutation authority',
  () => {
    const fs =
      require('node:fs');

    const source =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/core/ai-provider-execution'
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
        `forbidden dependency: ${forbidden}`
      );
    }
  }
);
