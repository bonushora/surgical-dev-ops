'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAIProviderSelector
} = require('../../accelerator/core/ai-provider-selector');

test(
  'AI provider selector is immutable and deterministic',
  () => {
    const first =
      createAIProviderSelector({
        providers: [
          {
            providerId:
              'ollama:llama3'
          },
          {
            providerId:
              'codex:default'
          }
        ]
      });

    const second =
      createAIProviderSelector({
        providers: [
          {
            providerId:
              'ollama:llama3'
          },
          {
            providerId:
              'codex:default'
          }
        ]
      });

    assert.equal(
      first.schema,
      'sdo.ai_provider_selector.v1'
    );

    assert.equal(
      first.fingerprint,
      second.fingerprint
    );

    assert.ok(
      Object.isFrozen(first)
    );

    assert.ok(
      Object.isFrozen(
        first.providers
      )
    );
  }
);

test(
  'selector explicitly selects an available provider without dispatch',
  () => {
    const selector =
      createAIProviderSelector({
        providers: [
          {
            providerId:
              'ollama:llama3'
          }
        ]
      });

    const result =
      selector.select(
        'ollama:llama3'
      );

    assert.equal(
      result.schema,
      'sdo.ai_provider_selection.v1'
    );

    assert.equal(
      result.decision,
      'SELECTED'
    );

    assert.equal(
      result.providerId,
      'ollama:llama3'
    );

    assert.equal(
      result.zeroDispatch,
      true
    );

    assert.equal(
      result.authority.class,
      'COGNITIVE_SELECTION_ONLY'
    );

    assert.equal(
      result.authority.physicalExecution,
      false
    );

    assert.equal(
      result.authority.mutationAuthority,
      false
    );

    assert.equal(
      result.authority.shellAuthority,
      false
    );

    assert.equal(
      result.authority.authorizationAuthority,
      false
    );

    assert.equal(
      result.authority.humanAuthority,
      false
    );

    assert.ok(
      Object.isFrozen(result)
    );

    assert.ok(
      Object.isFrozen(
        result.authority
      )
    );
  }
);

test(
  'unknown provider fails closed with zero dispatch',
  () => {
    const selector =
      createAIProviderSelector({
        providers: [
          {
            providerId:
              'ollama:llama3'
          }
        ]
      });

    const result =
      selector.select(
        'unknown:provider'
      );

    assert.equal(
      result.decision,
      'DENIED'
    );

    assert.equal(
      result.providerId,
      'unknown:provider'
    );

    assert.equal(
      result.zeroDispatch,
      true
    );

    assert.match(
      result.reason,
      /not available/i
    );

    assert.ok(
      Object.isFrozen(result)
    );
  }
);

test(
  'selector rejects duplicate provider identities',
  () => {
    assert.throws(
      () =>
        createAIProviderSelector({
          providers: [
            {
              providerId:
                'ollama:llama3'
            },
            {
              providerId:
                'ollama:llama3'
            }
          ]
        }),
      /unique/i
    );
  }
);

test(
  'selector rejects malformed or empty provider configuration',
  () => {
    for (const configuration of [
      null,
      {},
      {
        providers: []
      }
    ]) {
      assert.throws(
        () =>
          createAIProviderSelector(
            configuration
          ),
        /selector|provider/i
      );
    }
  }
);

test(
  'provider selection exposes no execution or mutation authority',
  () => {
    const selector =
      createAIProviderSelector({
        providers: [
          {
            providerId:
              'ollama:llama3'
          }
        ]
      });

    const selection =
      selector.select(
        'ollama:llama3'
      );

    for (const value of [
      selector,
      selection
    ]) {
      for (const forbidden of [
        'invoke',
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
            value,
            forbidden
          ),
          false,
          `${forbidden} must not cross provider selection boundary`
        );
      }
    }
  }
);
