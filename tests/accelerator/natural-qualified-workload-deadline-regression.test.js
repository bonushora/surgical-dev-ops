'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  NATURAL_LOCAL_INFERENCE_PROFILE,
  outputTokensFor
} = require(
  '../../accelerator/cli/natural-local-inference-profile'
);

const OBSERVED_PROJECT_ANALYSIS_WORKLOAD =
  Object.freeze({
    inputTokens: 2358,
    processedInputTokens: 2048,
    processingDurationMs: 59997,
    capability: 'PLAN'
  });

function measuredExecutionLowerBoundMs(
  workload
) {
  const qualifiedOutputTokens =
    outputTokensFor(
      workload.capability
    );

  /*
   * This is an optimistic lower bound: it treats bounded output tokens as if
   * they could be processed at the observed effective input-token rate.
   * A qualified deadline below this value cannot process the measured input
   * and its already-qualified PLAN budget on the observed CPU profile.
   */
  return Math.ceil(
    (
      workload.inputTokens +
      qualifiedOutputTokens
    ) *
    workload.processingDurationMs /
    workload.processedInputTokens
  );
}

test(
  'default local profile deadline covers the measured qualified NATURAL workload',
  () => {
    const workload =
      OBSERVED_PROJECT_ANALYSIS_WORKLOAD;

    const qualifiedOutputTokens =
      outputTokensFor(
        workload.capability
      );

    const lowerBoundMs =
      measuredExecutionLowerBoundMs(
        workload
      );

    assert.equal(
      NATURAL_LOCAL_INFERENCE_PROFILE.profileId,
      'ollama-cpu-bounded-v3'
    );

    assert.ok(
      workload.inputTokens +
        qualifiedOutputTokens <=
        NATURAL_LOCAL_INFERENCE_PROFILE
          .contextTokens,
      'The measured workload must remain inside the qualified context ceiling.'
    );

    assert.equal(
      lowerBoundMs,
      84078
    );

    assert.ok(
      NATURAL_LOCAL_INFERENCE_PROFILE
        .timeoutMs >= lowerBoundMs,
      `The ${NATURAL_LOCAL_INFERENCE_PROFILE.timeoutMs}ms deadline is below the ${lowerBoundMs}ms measured workload lower bound.`
    );

    assert.equal(
      NATURAL_LOCAL_INFERENCE_PROFILE
        .operationalAuthority,
      false
    );
  }
);
