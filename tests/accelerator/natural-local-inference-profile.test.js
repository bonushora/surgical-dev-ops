'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  NATURAL_LOCAL_INFERENCE_PROFILE,
  outputTokensFor
} = require(
  '../../accelerator/cli/natural-local-inference-profile'
);

test(
  'local inference profile is immutable bounded and authority-free',
  () => {
    assert.equal(
      NATURAL_LOCAL_INFERENCE_PROFILE.profileId,
      'ollama-cpu-bounded-v3'
    );
    assert.equal(
      NATURAL_LOCAL_INFERENCE_PROFILE.keepAlive,
      '10m'
    );
    assert.equal(
      NATURAL_LOCAL_INFERENCE_PROFILE.contextTokens,
      4096
    );
    assert.equal(
      NATURAL_LOCAL_INFERENCE_PROFILE.timeoutMs,
      60000
    );
    assert.equal(
      NATURAL_LOCAL_INFERENCE_PROFILE.acceleration,
      'OLLAMA_AUTO'
    );
    assert.equal(
      NATURAL_LOCAL_INFERENCE_PROFILE.contentTelemetry,
      false
    );
    assert.equal(
      NATURAL_LOCAL_INFERENCE_PROFILE.operationalAuthority,
      false
    );
    assert.equal(outputTokensFor('PLAN'), 512);
    assert.equal(outputTokensFor('EXPLAIN'), 512);
    assert.equal(outputTokensFor('PROPOSE'), 2048);
    assert.ok(Object.isFrozen(NATURAL_LOCAL_INFERENCE_PROFILE));
    assert.ok(Object.isFrozen(NATURAL_LOCAL_INFERENCE_PROFILE.outputTokens));
  }
);

test(
  'unknown capability cannot mint an inference budget',
  () => {
    assert.throws(
      () => outputTokensFor('SHELL'),
      /qualified output budget/i
    );
  }
);

test(
  'performance profile exposes no hardware mutation or execution surface',
  () => {
    const surface =
      require(
        '../../accelerator/cli/natural-local-inference-profile'
      );

    for (const forbidden of [
      'exec',
      'spawn',
      'shell',
      'install',
      'driver',
      'write',
      'patch',
      'grant',
      'authorize'
    ]) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          surface,
          forbidden
        ),
        false
      );
    }
  }
);
