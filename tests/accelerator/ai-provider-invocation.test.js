'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AI_CAPABILITIES,
  createAIProviderPort
} = require('../../accelerator/core/ai-provider');

const {
  createAICognitiveRequest,
  validateAICognitiveResult
} = require('../../accelerator/core/ai-provider-invocation');

function provider() {
  return createAIProviderPort({
    providerId: 'test:cognitive',
    capabilities: AI_CAPABILITIES
  });
}

function request(overrides = {}) {
  return createAICognitiveRequest(
    provider(),
    {
      requestId: 'req-001',
      capability: 'PLAN',
      objective: 'Determine the next safe engineering step.',
      context: {
        workspace: '/tmp/example',
        interactionMode: 'ENGINEER'
      },
      ...overrides
    }
  );
}

test(
  'cognitive request is immutable and exactly bound to provider and capability',
  () => {
    const value = request();

    assert.equal(
      value.schema,
      'sdo.ai_cognitive_request.v1'
    );

    assert.equal(
      value.requestId,
      'req-001'
    );

    assert.equal(
      value.providerId,
      'test:cognitive'
    );

    assert.equal(
      value.capability,
      'PLAN'
    );

    assert.equal(
      value.objective,
      'Determine the next safe engineering step.'
    );

    assert.ok(Object.isFrozen(value));
    assert.ok(Object.isFrozen(value.context));
    assert.match(value.fingerprint, /^[a-f0-9]{64}$/);
  }
);

test(
  'request creation fails closed when provider does not grant requested capability',
  () => {
    const limited =
      createAIProviderPort({
        providerId: 'test:limited',
        capabilities: [
          'INTERPRET',
          'EXPLAIN'
        ]
      });

    assert.throws(
      () =>
        createAICognitiveRequest(
          limited,
          {
            requestId: 'req-002',
            capability: 'PLAN',
            objective: 'Plan this task.',
            context: {}
          }
        ),
      /capability|denied/i
    );
  }
);

test(
  'cognitive request rejects physical-authority capabilities',
  () => {
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
      assert.throws(
        () =>
          createAICognitiveRequest(
            provider(),
            {
              requestId: `req-${capability}`,
              capability,
              objective: 'Unsafe request.',
              context: {}
            }
          ),
        /capability|unsupported|denied/i
      );
    }
  }
);

test(
  'cognitive request rejects authority-bearing context fields',
  () => {
    for (const key of [
      'grant',
      'grantEvaluation',
      'capabilityGrant',
      'mutationProvider',
      'providerQualification',
      'compareAndReplace',
      'privateKey',
      'credential',
      'shell',
      'command',
      'executable'
    ]) {
      assert.throws(
        () =>
          request({
            context: {
              workspace: '/tmp/example',
              [key]: 'forbidden'
            }
          }),
        /context|authority|forbidden/i
      );
    }
  }
);

test(
  'valid cognitive result is immutable and exactly request-bound',
  () => {
    const cognitiveRequest = request();

    const raw =
      Object.freeze({
        schema: 'sdo.ai_cognitive_result.v1',
        requestId: cognitiveRequest.requestId,
        requestFingerprint:
          cognitiveRequest.fingerprint,
        providerId:
          cognitiveRequest.providerId,
        capability:
          cognitiveRequest.capability,
        status: 'COMPLETED',
        output: Object.freeze({
          summary:
            'Inspect the relevant implementation before proposing a patch.'
        })
      });

    const result =
      validateAICognitiveResult(
        raw,
        cognitiveRequest
      );

    assert.strictEqual(result, raw);
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.output));
  }
);

test(
  'mutable cognitive result fails closed',
  () => {
    const cognitiveRequest = request();

    const mutable = {
      schema: 'sdo.ai_cognitive_result.v1',
      requestId: cognitiveRequest.requestId,
      requestFingerprint:
        cognitiveRequest.fingerprint,
      providerId:
        cognitiveRequest.providerId,
      capability:
        cognitiveRequest.capability,
      status: 'COMPLETED',
      output: {
        summary: 'mutable'
      }
    };

    assert.throws(
      () =>
        validateAICognitiveResult(
          mutable,
          cognitiveRequest
        ),
      /immutable|frozen|malformed/i
    );
  }
);

test(
  'provider request capability and fingerprint substitution fail closed',
  () => {
    const cognitiveRequest = request();

    const baseline = {
      schema: 'sdo.ai_cognitive_result.v1',
      requestId: cognitiveRequest.requestId,
      requestFingerprint:
        cognitiveRequest.fingerprint,
      providerId:
        cognitiveRequest.providerId,
      capability:
        cognitiveRequest.capability,
      status: 'COMPLETED',
      output: Object.freeze({
        summary: 'safe'
      })
    };

    for (const forged of [
      {
        ...baseline,
        providerId: 'forged:provider'
      },
      {
        ...baseline,
        capability: 'EXPLAIN'
      },
      {
        ...baseline,
        requestId: 'req-forged'
      },
      {
        ...baseline,
        requestFingerprint:
          '0'.repeat(64)
      }
    ]) {
      assert.throws(
        () =>
          validateAICognitiveResult(
            Object.freeze(forged),
            cognitiveRequest
          ),
        /bound|mismatch|malformed/i
      );
    }
  }
);

test(
  'cognitive result cannot smuggle operational authority',
  () => {
    const cognitiveRequest = request();

    for (const key of [
      'execution',
      'command',
      'shell',
      'patch',
      'write',
      'grant',
      'capabilityGrant',
      'mutationProvider',
      'compareAndReplace',
      'authorization',
      'approval',
      'privateKey',
      'credential'
    ]) {
      const raw =
        Object.freeze({
          schema: 'sdo.ai_cognitive_result.v1',
          requestId:
            cognitiveRequest.requestId,
          requestFingerprint:
            cognitiveRequest.fingerprint,
          providerId:
            cognitiveRequest.providerId,
          capability:
            cognitiveRequest.capability,
          status: 'COMPLETED',
          output: Object.freeze({
            summary: 'candidate'
          }),
          [key]: Object.freeze({})
        });

      assert.throws(
        () =>
          validateAICognitiveResult(
            raw,
            cognitiveRequest
          ),
        /authority|forbidden|malformed/i
      );
    }
  }
);

test(
  'provider-reported failure is valid cognitive evidence but never success',
  () => {
    const cognitiveRequest = request();

    const raw =
      Object.freeze({
        schema: 'sdo.ai_cognitive_result.v1',
        requestId:
          cognitiveRequest.requestId,
        requestFingerprint:
          cognitiveRequest.fingerprint,
        providerId:
          cognitiveRequest.providerId,
        capability:
          cognitiveRequest.capability,
        status: 'FAILED',
        output: null,
        reason:
          'Cognitive provider unavailable.'
      });

    const result =
      validateAICognitiveResult(
        raw,
        cognitiveRequest
      );

    assert.equal(result.status, 'FAILED');
    assert.equal(result.output, null);
    assert.match(result.reason, /unavailable/i);
  }
);

test(
  'invocation contract introduces no process network or mutation authority',
  () => {
    const fs = require('node:fs');

    const source =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/core/ai-provider-invocation'
        ),
        'utf8'
      );

    for (const forbidden of [
      'child_process',
      'execSync',
      'spawnSync',
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
