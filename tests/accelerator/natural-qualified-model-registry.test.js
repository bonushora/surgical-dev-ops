'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  QUALIFIED_LOCAL_MODELS,
  DEFAULT_MODEL_PROFILE,
  findQualifiedLocalModel,
  requireQualifiedLocalModel
} = require(
  '../../accelerator/cli/natural-qualified-model-registry'
);

test(
  'qualified local registry exposes exactly Qwen quality and Gemma fast profiles',
  () => {
    assert.deepEqual(
      QUALIFIED_LOCAL_MODELS.map(
        (profile) => profile.model
      ),
      [
        'qwen3:8b',
        'gemma3:4b'
      ]
    );

    assert.equal(
      DEFAULT_MODEL_PROFILE.model,
      'qwen3:8b'
    );

    assert.equal(
      findQualifiedLocalModel('gemma'),
      QUALIFIED_LOCAL_MODELS[1]
    );

    assert.ok(
      Object.isFrozen(
        QUALIFIED_LOCAL_MODELS
      )
    );

    assert.ok(
      QUALIFIED_LOCAL_MODELS.every(
        (profile) =>
          profile.operationalAuthority === false &&
          Object.isFrozen(profile)
      )
    );
  }
);

test(
  'Llama and arbitrary model names are outside the qualified registry',
  () => {
    assert.equal(
      findQualifiedLocalModel(
        'llama3:latest'
      ),
      null
    );

    assert.throws(
      () =>
        requireQualifiedLocalModel(
          'remote-or-arbitrary:model'
        ),
      /closed qualified registry/i
    );
  }
);

test(
  'qualified model registry exposes no installation invocation credential or mutation surface',
  () => {
    const boundary =
      require(
        '../../accelerator/cli/natural-qualified-model-registry'
      );

    for (const forbidden of [
      'install',
      'pull',
      'download',
      'invoke',
      'execute',
      'credential',
      'write',
      'grant',
      'authorize'
    ]) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          boundary,
          forbidden
        ),
        false
      );
    }
  }
);
