'use strict';

const PROVIDER_LOCATION_CONTRACTS = Object.freeze({
  NONE: Object.freeze({
    providerKind: 'NONE',
    cognitionLocation: 'NONE',
    transportLocation: 'NONE',
    billing: 'NONE',
    networkRequirement: 'NONE'
  }),
  OLLAMA: Object.freeze({
    providerKind: 'OLLAMA',
    cognitionLocation: 'LOCAL_MODEL',
    transportLocation: 'LOCAL_PROCESS',
    billing: 'LOCAL_RESOURCES_AND_LICENSES_APPLY',
    networkRequirement: 'LOOPBACK_SERVICE_ONLY'
  }),
  CODEX: Object.freeze({
    providerKind: 'CODEX',
    cognitionLocation: 'EXTERNAL_SERVICE',
    transportLocation: 'LOCAL_PROCESS',
    billing: 'UNKNOWN_OR_ACCOUNT_PLAN',
    networkRequirement: 'EXTERNAL_SERVICE_REQUIRED'
  }),
  OPENAI_RESPONSES: Object.freeze({
    providerKind: 'OPENAI_RESPONSES',
    cognitionLocation: 'EXTERNAL_SERVICE',
    transportLocation: 'DIRECT_REMOTE_TRANSPORT',
    billing: 'UNKNOWN_OR_ACCOUNT_PLAN',
    networkRequirement: 'EXTERNAL_SERVICE_REQUIRED'
  })
});

function providerLocationMetadata(providerKind) {
  const contract = PROVIDER_LOCATION_CONTRACTS[providerKind];
  if (!contract) throw new Error('Provider location kind is not qualified.');
  return contract;
}

function requireProviderLocationMetadata(value, expectedKind = null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Provider location metadata is required.');
  }
  const contract = PROVIDER_LOCATION_CONTRACTS[value.providerKind];
  if (!contract || (expectedKind !== null && value.providerKind !== expectedKind)) {
    throw new Error('Provider location metadata is not qualified.');
  }
  for (const [key, expected] of Object.entries(contract)) {
    if (value[key] !== expected) {
      throw new Error('Provider location metadata is incomplete or divergent.');
    }
  }
  return value;
}

module.exports = Object.freeze({
  PROVIDER_LOCATION_CONTRACTS,
  providerLocationMetadata,
  requireProviderLocationMetadata
});
