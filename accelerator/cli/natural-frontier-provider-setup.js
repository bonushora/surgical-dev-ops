'use strict';

const crypto = require('node:crypto');
const { requireQualifiedFrontierProvider } = require('./natural-frontier-provider-registry');

const SETUP_SCHEMA = 'sdo.natural_frontier_provider_setup.v1';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function text(value, label, maximum = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error(`${label} is required.`);
  return value.trim();
}

function time(value) {
  const result = text(value, 'Choice timestamp', 64);
  if (!Number.isFinite(Date.parse(result)) || new Date(Date.parse(result)).toISOString() !== result) {
    throw new Error('Choice timestamp must be canonical ISO-8601.');
  }
  return result;
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function createNaturalFrontierProviderSetup({ providerId, language = 'pt-BR' } = {}) {
  const profile = requireQualifiedFrontierProvider(providerId);
  if (!['pt-BR', 'en'].includes(language)) throw new Error('Qualified setup language is required.');
  const body = {
    schema: SETUP_SCHEMA,
    providerId: profile.providerId,
    provider: profile.provider,
    model: profile.model,
    language,
    steps: ['VERIFY_OFFICIAL_TERMS', 'DISCLOSE_CURRENT_COSTS', 'DISCLOSE_DATA_BOUNDARY',
      'OBTAIN_EXPLICIT_HUMAN_CHOICE', 'RECEIVE_CREDENTIAL_IN_ADAPTER_BOUNDARY',
      'TEST_AUTHENTICATION_AND_COMPATIBILITY', 'ACTIVATE_SESSION_ONLY'],
    pricing: 'MUST_BE_OBSERVED_FROM_CURRENT_OFFICIAL_SOURCE',
    privacy: 'AUTHORIZED_MINIMUM_COGNITIVE_CONTEXT_LEAVES_LOCAL_MACHINE',
    credentialStorage: 'FORBIDDEN_OUTSIDE_PROVIDER_BOUNDARY',
    automaticActivation: false,
    reversible: true,
    operationalAuthority: false,
    mutationAuthority: false
  };
  return deepFreeze({ ...body, setupFingerprint: fingerprint(body) });
}

function recordNaturalFrontierProviderChoice(setup, decision) {
  if (!setup || setup.schema !== SETUP_SCHEMA || !Object.isFrozen(setup) ||
      setup.setupFingerprint !== fingerprint(Object.fromEntries(
        Object.entries(setup).filter(([key]) => key !== 'setupFingerprint')
      )) ||
      !decision || !Object.isFrozen(decision) || decision.approved !== true ||
      decision.setupFingerprint !== setup.setupFingerprint) {
    throw new Error('Exact explicit frontier provider choice is required.');
  }
  return deepFreeze({
    schema: 'sdo.natural_frontier_provider_choice.v1',
    providerId: setup.providerId,
    humanSubject: text(decision.humanSubject, 'Human subject'),
    chosenAt: time(decision.chosenAt),
    setupFingerprint: setup.setupFingerprint,
    activationAuthorized: false,
    credentialPresent: false,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

module.exports = Object.freeze({
  SETUP_SCHEMA,
  createNaturalFrontierProviderSetup,
  recordNaturalFrontierProviderChoice
});
