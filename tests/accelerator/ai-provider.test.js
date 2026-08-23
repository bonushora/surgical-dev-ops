'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AI_CAPABILITIES,
  createAIProviderPort,
  evaluateAIProviderPort
} = require('../../accelerator/core/ai-provider');

test(
  'AI provider exposes only bounded cognitive capabilities',
  () => {
    assert.deepEqual(
      AI_CAPABILITIES,
      [
        'INTERPRET',
        'REASON',
        'PLAN',
        'PROPOSE',
        'EVALUATE',
        'EXPLAIN'
      ]
    );

    assert.ok(Object.isFrozen(AI_CAPABILITIES));
  }
);

test(
  'AI provider port is immutable and carries no physical authority',
  () => {
    const provider =
      createAIProviderPort({
        providerId: 'test:cognitive',
        capabilities: AI_CAPABILITIES
      });

    assert.equal(
      provider.schema,
      'sdo.ai_provider_port.v1'
    );

    assert.equal(
      provider.providerId,
      'test:cognitive'
    );

    assert.ok(Object.isFrozen(provider));
    assert.ok(Object.isFrozen(provider.capabilities));

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
      'privateKey'
    ]) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          provider,
          forbidden
        ),
        false,
        `AI provider must not expose ${forbidden}`
      );
    }
  }
);

test(
  'AI provider cannot declare unknown cognitive capabilities',
  () => {
    assert.throws(
      () =>
        createAIProviderPort({
          providerId: 'test:unsafe',
          capabilities: [
            ...AI_CAPABILITIES,
            'EXECUTE'
          ]
        }),
      /capability/i
    );
  }
);

test(
  'AI provider evaluation is bound to one requested cognitive capability',
  () => {
    const provider =
      createAIProviderPort({
        providerId: 'test:cognitive',
        capabilities: AI_CAPABILITIES
      });

    const result =
      evaluateAIProviderPort(
        provider,
        {
          capability: 'PLAN'
        }
      );

    assert.equal(
      result.schema,
      'sdo.ai_provider_evaluation.v1'
    );

    assert.equal(result.decision, 'ALLOWED');
    assert.equal(result.providerId, 'test:cognitive');
    assert.equal(result.capability, 'PLAN');

    assert.ok(Object.isFrozen(result));
  }
);

test(
  'unsupported cognitive capability fails closed',
  () => {
    const provider =
      createAIProviderPort({
        providerId: 'test:limited',
        capabilities: [
          'INTERPRET',
          'EXPLAIN'
        ]
      });

    const result =
      evaluateAIProviderPort(
        provider,
        {
          capability: 'PLAN'
        }
      );

    assert.equal(result.decision, 'DENIED');
    assert.equal(result.capability, 'PLAN');
    assert.match(result.reason, /capability/i);
  }
);

test(
  'malformed or absent AI provider fails closed',
  () => {
    for (const provider of [
      null,
      undefined,
      {},
      Object.freeze({
        providerId: 'forged'
      })
    ]) {
      const result =
        evaluateAIProviderPort(
          provider,
          {
            capability: 'PLAN'
          }
        );

      assert.equal(result.decision, 'DENIED');
      assert.equal(result.zeroDispatch, true);
    }
  }
);

test(
  'AI provider request cannot request physical authority',
  () => {
    const provider =
      createAIProviderPort({
        providerId: 'test:cognitive',
        capabilities: AI_CAPABILITIES
      });

    for (const capability of [
      'EXECUTE',
      'PATCH',
      'WRITE',
      'SHELL',
      'COMPARE_AND_REPLACE',
      'AUTHORIZE',
      'APPROVE',
      'SIGN'
    ]) {
      const result =
        evaluateAIProviderPort(
          provider,
          { capability }
        );

      assert.equal(result.decision, 'DENIED');
      assert.equal(result.zeroDispatch, true);
    }
  }
);

test(
  'AI provider contract exposes no mutation-provider authority',
  () => {
    const ai =
      require('../../accelerator/core/ai-provider');

    for (const forbidden of [
      'createInternalMutationProviderBoundary',
      'bindMutationProviderRuntime',
      'resolveMutationProviderRuntime',
      'requireQualifiedMutationProvider',
      'validateMutationProviderResult',
      'compareAndReplace'
    ]) {
      assert.equal(
        ai[forbidden],
        undefined,
        `${forbidden} must not cross the cognitive boundary`
      );
    }
  }
);
