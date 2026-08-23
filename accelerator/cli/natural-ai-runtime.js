'use strict';

/*
 * NATURAL governed local-AI composition.
 *
 * This module composes already-qualified cognitive boundaries.
 * It does not create operational authority.
 */

const {
  AI_CAPABILITIES,
  createAIProviderPort
} = require('../core/ai-provider');

const {
  createAIProviderSelector
} = require('../core/ai-provider-selector');

const {
  createAIProviderExecutionSeam
} = require('../core/ai-provider-execution');

const {
  createGovernedAIRuntime
} = require('../core/governed-ai-runtime');

const {
  createOllamaAIProviderAdapter
} = require('../adapters/ollama-ai-provider-adapter');

const {
  createLocalOllamaTransport
} = require('../adapters/ollama-local-transport');

const {
  DEFAULT_PROVIDER_ID,
  DEFAULT_MODEL
} = require('./natural-provider-discovery');

function requireDiscovery(discovery) {
  if (
    !discovery ||
    typeof discovery !== 'object' ||
    discovery.schema !==
      'sdo.natural_provider_discovery.v1' ||
    discovery.providerId !==
      DEFAULT_PROVIDER_ID ||
    discovery.model !==
      DEFAULT_MODEL ||
    discovery.available !== true ||
    discovery.local !== true ||
    discovery.operationalAuthority !== false
  ) {
    throw new Error(
      'Verified NATURAL local AI discovery is required.'
    );
  }

  return discovery;
}

function createNaturalLocalAIComposition(
  input = {}
) {
  const discovery =
    requireDiscovery(
      input.discovery
    );

  const fetchImplementation =
    input.fetchImplementation ||
    globalThis.fetch;

  if (
    typeof fetchImplementation !==
    'function'
  ) {
    throw new Error(
      'Local Ollama fetch implementation is required.'
    );
  }

  const providerPort =
    createAIProviderPort({
      providerId:
        discovery.providerId,

      capabilities:
        AI_CAPABILITIES
    });

  const selector =
    createAIProviderSelector({
      providers: [
        {
          providerId:
            discovery.providerId
        }
      ]
    });

  const transport =
    createLocalOllamaTransport({
      fetchImplementation
    });

  const adapter =
    createOllamaAIProviderAdapter({
      providerId:
        discovery.providerId,

      model:
        discovery.model,

      transport:
        transport.invoke
    });

  const executionSeam =
    createAIProviderExecutionSeam({
      providerId:
        discovery.providerId,

      invoke:
        adapter.invoke
    });

  const runtime =
    createGovernedAIRuntime({
      selector,

      providerPorts: {
        [discovery.providerId]:
          providerPort
      },

      executionSeams: {
        [discovery.providerId]:
          executionSeam
      }
    });

  return Object.freeze({
    schema:
      'sdo.natural_local_ai_composition.v1',

    providerId:
      discovery.providerId,

    provider:
      discovery.provider,

    model:
      discovery.model,

    local:
      true,

    operationalAuthority:
      false,

    runtime
  });
}

async function invokeNaturalCognitive(
  composition,
  input
) {
  if (
    !composition ||
    composition.schema !==
      'sdo.natural_local_ai_composition.v1' ||
    !Object.isFrozen(composition) ||
    composition.operationalAuthority !==
      false ||
    !composition.runtime ||
    composition.runtime.schema !==
      'sdo.governed_ai_runtime.v1'
  ) {
    throw new Error(
      'Trusted NATURAL AI composition is required.'
    );
  }

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error(
      'NATURAL cognitive input is required.'
    );
  }

  return composition.runtime.invoke({
    providerId:
      composition.providerId,

    requestId:
      input.requestId,

    capability:
      input.capability,

    objective:
      input.objective,

    context:
      input.context
  });
}

module.exports = Object.freeze({
  createNaturalLocalAIComposition,
  invokeNaturalCognitive
});
