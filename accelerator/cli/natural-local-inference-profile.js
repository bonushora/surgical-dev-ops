'use strict';

/*
 * Qualified local inference performance profile.
 *
 * This profile controls bounded Ollama resource use only. It grants no
 * filesystem, network, process, mutation, approval or operational authority.
 * Hardware acceleration remains selected by the local Ollama runtime so the
 * same contract works on Linux, macOS and Windows without driver mutation.
 */

const OUTPUT_TOKENS =
  Object.freeze({
    EXPLAIN:
      512,

    PLAN:
      512,

    PROPOSE:
      2048
  });

const NATURAL_LOCAL_INFERENCE_PROFILE =
  Object.freeze({
    schema:
      'sdo.natural_local_inference_profile.v1',

    profileId:
      'ollama-cpu-bounded-v3',

    acceleration:
      'OLLAMA_AUTO',

    keepAlive:
      '10m',

    contextTokens:
      4096,

    outputTokens:
      OUTPUT_TOKENS,

    timeoutMs:
      180000,

    contentTelemetry:
      false,

    operationalAuthority:
      false
  });

function outputTokensFor(
  capability
) {
  const value =
    OUTPUT_TOKENS[
      capability
    ];

  if (!value) {
    throw new Error(
      'Local inference capability has no qualified output budget.'
    );
  }

  return value;
}

module.exports =
  Object.freeze({
    NATURAL_LOCAL_INFERENCE_PROFILE,
    outputTokensFor
  });
