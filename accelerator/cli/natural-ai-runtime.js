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
  createOpenAIResponsesTransport
} = require('../adapters/openai-responses-transport');

const {
  createOpenAIFrontierAIProviderAdapter
} = require('../adapters/openai-frontier-ai-provider-adapter');

const {
  OPENAI_FRONTIER_PROFILE
} = require('./natural-frontier-provider-registry');

const {
  requireQualifiedLocalModel
} = require(
  './natural-qualified-model-registry'
);

const {
  NATURAL_LOCAL_INFERENCE_PROFILE
} = require(
  './natural-local-inference-profile'
);

function requireDiscovery(discovery) {
  let profile = null;

  try {
    profile =
      requireQualifiedLocalModel(
        discovery &&
        discovery.model
      );
  } catch {
    // The common validation below fails closed.
  }

  if (
    !discovery ||
    typeof discovery !== 'object' ||
    discovery.schema !==
      'sdo.natural_provider_discovery.v1' ||
    !profile ||
    discovery.providerId !==
      profile.providerId ||
    discovery.modelProfile !==
      profile.profile ||
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

    inferenceProfile:
      NATURAL_LOCAL_INFERENCE_PROFILE,

    operationalAuthority:
      false,

    runtime
  });
}

function createNaturalOpenAIComposition(input = {}) {
  const transport = input.transport ||
    (typeof input.fetchImplementation === 'function' &&
      typeof input.credentialProvider === 'function'
      ? createOpenAIResponsesTransport({
          fetchImplementation: input.fetchImplementation,
          credentialProvider: input.credentialProvider
        }).invoke
      : null);

  if (typeof transport !== 'function') {
    throw new Error('Qualified OpenAI transport and credential boundary are required.');
  }

  const providerId = OPENAI_FRONTIER_PROFILE.providerId;
  const providerPort = createAIProviderPort({
    providerId,
    capabilities: AI_CAPABILITIES
  });
  const selector = createAIProviderSelector({ providers: [{ providerId }] });
  const adapter = createOpenAIFrontierAIProviderAdapter({ transport });
  const executionSeam = createAIProviderExecutionSeam({
    providerId,
    invoke: async (request) => Object.freeze({
      schema: 'sdo.ai_cognitive_result.v1',
      requestId: request.requestId,
      requestFingerprint: request.fingerprint,
      providerId: request.providerId,
      capability: request.capability,
      status: 'COMPLETED',
      output: await adapter.invoke(request)
    })
  });
  const runtime = createGovernedAIRuntime({
    selector,
    providerPorts: { [providerId]: providerPort },
    executionSeams: { [providerId]: executionSeam }
  });

  return Object.freeze({
    schema: 'sdo.natural_openai_ai_composition.v1',
    providerId,
    provider: OPENAI_FRONTIER_PROFILE.provider,
    model: OPENAI_FRONTIER_PROFILE.model,
    local: false,
    configured: true,
    operationalAuthority: false,
    mutationAuthority: false,
    runtime
  });
}

async function invokeNaturalCognitive(
  composition,
  input
) {
  if (
    !composition ||
    ![
      'sdo.natural_local_ai_composition.v1',
      'sdo.natural_openai_ai_composition.v1'
    ].includes(composition.schema) ||
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
  createNaturalOpenAIComposition,
  invokeNaturalCognitive
});
