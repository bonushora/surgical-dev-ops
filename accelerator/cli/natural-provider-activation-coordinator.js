'use strict';

const PROVIDER_STATES = Object.freeze({
  ACTIVE: 'ACTIVE',
  AVAILABLE: 'AVAILABLE',
  CONFIGURATION_REQUIRED: 'CONFIGURATION_REQUIRED',
  UNAVAILABLE: 'UNAVAILABLE'
});

const ZERO_OPERATIONAL_AUTHORITY = Object.freeze({
  operationalAuthority: false,
  mutationAuthority: false,
  filesystemAuthority: false,
  shellAuthority: false,
  gitAuthority: false,
  pushAuthority: false,
  mergeAuthority: false,
  tagAuthority: false,
  releaseAuthority: false,
  publicationAuthority: false,
  deploymentAuthority: false,
  networkAuthority: false,
  secretAuthority: false
});

const PROVIDER_CATALOG = Object.freeze({
  'ollama:qwen3:8b': Object.freeze({
    providerId: 'ollama:qwen3:8b',
    provider: 'Ollama',
    model: 'qwen3:8b',
    kind: 'LOCAL',
    qualified: true,
    aliases: Object.freeze(['qwen', 'qwen3', 'qwen3:8b'])
  }),
  'ollama:gemma3:4b': Object.freeze({
    providerId: 'ollama:gemma3:4b',
    provider: 'Ollama',
    model: 'gemma3:4b',
    kind: 'LOCAL',
    qualified: true,
    aliases: Object.freeze(['gemma', 'gemma3', 'gemma3:4b'])
  }),
  'openai:gpt-5.6': Object.freeze({
    providerId: 'openai:gpt-5.6',
    provider: 'OpenAI',
    model: 'gpt-5.6',
    kind: 'REMOTE',
    qualified: true,
    aliases: Object.freeze(['openai', 'gpt', 'codex', 'gpt-5.6'])
  }),
  'anthropic:claude': Object.freeze({
    providerId: 'anthropic:claude',
    provider: 'Anthropic',
    model: 'claude',
    kind: 'REMOTE',
    qualified: false,
    aliases: Object.freeze(['anthropic', 'claude'])
  }),
  'google:gemini': Object.freeze({
    providerId: 'google:gemini',
    provider: 'Google',
    model: 'gemini',
    kind: 'REMOTE',
    qualified: false,
    aliases: Object.freeze(['google', 'gemini'])
  })
});

const GENERIC_SWITCH_ALIASES = Object.freeze([
  'quero trocar de ia',
  'quero trocar a ia',
  'trocar de ia',
  'trocar a ia',
  'quero outra ia',
  'i want to switch ai',
  'i want to change ai',
  'switch ai provider',
  'switch provider'
]);

const LOCAL_SWITCH_ALIASES = Object.freeze([
  'volte para a ia local',
  'voltar para a ia local',
  'switch back to local ai',
  'switch back to local'
]);

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireProfile(providerId) {
  const profile = PROVIDER_CATALOG[providerId];
  if (!profile) throw new Error(`Provider '${providerId}' is outside the qualified catalog.`);
  return profile;
}

function aliasProfile(text) {
  for (const profile of Object.values(PROVIDER_CATALOG)) {
    if (profile.aliases.includes(text)) return profile;
  }
  return null;
}

function normalizeProviderActivationRequest(input) {
  const text = normalize(input);
  if (!text) throw new Error('Provider activation request is required.');

  if (GENERIC_SWITCH_ALIASES.includes(text)) {
    return deepFreeze({
      schema: 'sdo.natural_provider_activation_request.v1',
      intent: 'SWITCH_PROVIDER',
      providerId: null,
      requested: text
    });
  }

  if (LOCAL_SWITCH_ALIASES.includes(text)) {
    return deepFreeze({
      schema: 'sdo.natural_provider_activation_request.v1',
      intent: 'ACTIVATE_LOCAL_PROVIDER',
      providerId: null,
      requested: text
    });
  }

  const stripped = text
    .replace(/^(?:usar|use|ativar|ative|selecionar|selecione|switch to|use) /, '')
    .replace(/^(?:quero usar|i want to use) /, '')
    .replace(/^the /, '')
    .trim();
  const profile = aliasProfile(stripped) || aliasProfile(text);
  if (!profile) throw new Error(`Provider request '${text}' is outside the qualified catalog.`);

  return deepFreeze({
    schema: 'sdo.natural_provider_activation_request.v1',
    intent: 'ACTIVATE_PROVIDER',
    providerId: profile.providerId,
    requested: text
  });
}

function deriveProviderState(providerId, evidence = {}) {
  const profile = requireProfile(providerId);
  const input = evidence && typeof evidence === 'object' ? evidence : {};
  let state;
  let reason = input.reason || null;

  if (!profile.qualified) {
    state = PROVIDER_STATES.UNAVAILABLE;
    reason = reason || 'Provider is recognized but has no qualified adapter.';
  } else if (profile.kind === 'LOCAL') {
    if (input.active === true && input.available === true) state = PROVIDER_STATES.ACTIVE;
    else if (input.available === true) state = PROVIDER_STATES.AVAILABLE;
    else {
      state = PROVIDER_STATES.UNAVAILABLE;
      reason = reason || 'Physical local provider discovery did not verify availability.';
    }
  } else if (input.active === true && input.validated === true) {
    state = PROVIDER_STATES.ACTIVE;
  } else if (input.validated === true) {
    state = PROVIDER_STATES.AVAILABLE;
  } else if (input.configured !== true) {
    state = PROVIDER_STATES.CONFIGURATION_REQUIRED;
    reason = reason || 'Minimum provider configuration is not available.';
  } else {
    state = PROVIDER_STATES.UNAVAILABLE;
    reason = reason || 'Provider configuration exists but physical validation failed.';
  }

  return deepFreeze({
    schema: 'sdo.natural_provider_state.v1',
    providerId: profile.providerId,
    provider: profile.provider,
    model: profile.model,
    kind: profile.kind,
    qualified: profile.qualified,
    state,
    available: state === PROVIDER_STATES.ACTIVE || state === PROVIDER_STATES.AVAILABLE,
    active: state === PROVIDER_STATES.ACTIVE,
    reason,
    ...ZERO_OPERATIONAL_AUTHORITY
  });
}

function createNaturalProviderActivationCoordinator() {
  return Object.freeze({
    schema: 'sdo.natural_provider_activation_coordinator.v1',
    catalog: PROVIDER_CATALOG,
    states: PROVIDER_STATES,
    resolve: normalizeProviderActivationRequest,
    state: deriveProviderState,
    authority: ZERO_OPERATIONAL_AUTHORITY
  });
}

module.exports = Object.freeze({
  PROVIDER_STATES,
  PROVIDER_CATALOG,
  ZERO_OPERATIONAL_AUTHORITY,
  normalizeProviderActivationRequest,
  deriveProviderState,
  createNaturalProviderActivationCoordinator
});
