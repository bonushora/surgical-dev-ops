'use strict';

const OPENAI_FRONTIER_PROFILE = Object.freeze({
  schema: 'sdo.natural_frontier_provider_profile.v1',
  providerId: 'openai:gpt-5.6',
  provider: 'OpenAI',
  model: 'gpt-5.6',
  endpoint: 'https://api.openai.com/v1/responses',
  capabilities: Object.freeze(['INTERPRET', 'REASON', 'PLAN', 'PROPOSE', 'EVALUATE', 'EXPLAIN']),
  timeoutMs: 120000,
  maxRequestBytes: 131072,
  maxResponseBytes: 262144,
  maxOutputTokens: 4096,
  streaming: true,
  local: false,
  automaticallyActivated: false,
  credentialBoundary: 'OPENAI_API_KEY',
  privacyDisclosureRequired: true,
  commercialDisclosureRequired: true,
  operationalAuthority: false,
  mutationAuthority: false
});

function requireQualifiedFrontierProvider(providerId) {
  if (providerId !== OPENAI_FRONTIER_PROFILE.providerId) {
    throw new Error('Frontier provider is not qualified.');
  }
  return OPENAI_FRONTIER_PROFILE;
}

module.exports = Object.freeze({
  OPENAI_FRONTIER_PROFILE,
  requireQualifiedFrontierProvider
});
