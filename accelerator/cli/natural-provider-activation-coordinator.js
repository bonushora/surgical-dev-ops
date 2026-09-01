'use strict';

const PROVIDER_STATES = Object.freeze({
  ACTIVE: 'ACTIVE',
  AVAILABLE: 'AVAILABLE',
  CONFIGURATION_REQUIRED: 'CONFIGURATION_REQUIRED',
  UNAVAILABLE: 'UNAVAILABLE'
});

const PROVIDER_INTENTS = Object.freeze({
  QUERY_ACTIVE_PROVIDER: 'QUERY_ACTIVE_PROVIDER',
  LIST_PROVIDERS: 'LIST_PROVIDERS',
  PROVIDER_HELP: 'PROVIDER_HELP',
  SELECT_LOCAL_PROVIDER: 'SELECT_LOCAL_PROVIDER',
  SELECT_REMOTE_PROVIDER: 'SELECT_REMOTE_PROVIDER',
  CONFIGURE_PROVIDER: 'CONFIGURE_PROVIDER',
  RETURN_TO_LOCAL: 'RETURN_TO_LOCAL',
  PROVIDER_AUTHORITY_DENIED: 'PROVIDER_AUTHORITY_DENIED',
  AMBIGUOUS_PROVIDER_REQUEST: 'AMBIGUOUS_PROVIDER_REQUEST'
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

const PROVIDER_TARGETS = Object.freeze([
  Object.freeze({
    providerId: 'ollama:qwen3:8b',
    pattern: /(?:^| )(?:qwen(?:3| 3)?(?: 8b)?)(?: |$)/
  }),
  Object.freeze({
    providerId: 'ollama:gemma3:4b',
    pattern: /(?:^| )(?:gemma(?:3| 3)?(?: 4b)?)(?: |$)/
  }),
  Object.freeze({
    providerId: 'openai:gpt-5.6',
    pattern: /(?:^| )(?:openai|gpt(?: 5(?: 6)?)?|codex)(?: |$)/
  }),
  Object.freeze({
    providerId: 'anthropic:claude',
    pattern: /(?:^| )(?:anthropic|claude)(?: |$)/
  }),
  Object.freeze({
    providerId: 'google:gemini',
    pattern: /(?:^| )(?:google|gemini)(?: |$)/
  })
]);

const SELECT_ACTION =
  /(?:^| )(?:usar|use|mude|mudar|troque|trocar|selecione|selecionar|ative|ativar|volte|voltar|retorne|return|conectar|connect|switch|change|select|activate)(?: |$)/;

const CONFIGURE_ACTION =
  /(?:^| )(?:configure|configurar)(?: |$)/;

const DIRECT_SELECTION =
  /^(?:(?:eu )?quero |i want to )?(?:usar|use|mude|mudar|troque|trocar|selecione|selecionar|ative|ativar|volte|voltar|retorne|return|conectar|connect|switch|change|select|activate)(?: para| to)? /;

const PROVIDER_SUBJECT =
  /(?:^| )(?:ia|ias|ai|provider|providers|provedor|provedores|modelo|model|models)(?: |$)/;

const PLURAL_PROVIDER_SUBJECT =
  /(?:^| )(?:ias|providers|provedores|modelos|models)(?: |$)/;

const ACTIVE_STATE_CONCEPT =
  /(?:^| )(?:ativo|ativa|active|atual|current|usando|usada|usado|using|selecionado|selected)(?: |$)/;

const QUERY_ACTION =
  /(?:^| )(?:qual|quais|que|what|which|mostre|mostrar|show|query)(?: |$)/;

const LIST_ACTION =
  /(?:^| )(?:liste|listar|list|mostre|mostrar|show)(?: |$)/;

const AVAILABLE_CONCEPT =
  /(?:^| )(?:disponivel|disponiveis|available)(?: |$)/;

const RETURN_TO_LOCAL =
  /^(?:volte|voltar|retorne|return|switch back)(?: para| to)? (?:a |the )?(?:ia local|ai local|local ai|provider local|local provider|modelo local|local model)$/;

const CREDENTIAL_CONCEPT =
  /(?:^| )(?:credencial|credenciais|credential|credentials|chave de api|chaves de api|api key|api keys)(?: |$)/;

const UNSAFE_CREDENTIAL_CONCEPT =
  /(?:^| )(?:qualquer|any|computador|computer|maquina|machine|disponivel|available|procure|procurar|search|find|reutilize|reutilizar|reuse|exponha|expor|expose|mostrar|show)(?: |$)/;

const GENERIC_PROVIDER_HELP =
  /^(?:(?:eu )?quero |i want to )?(?:(?:trocar|mudar|switch|change|usar|use|conectar|connect)(?: de| a| to)? )?(?:outra |outro |another )?(?:ia|ai|providers?|provedor|ai providers?)$/;

const CAN_USE_CONCEPT =
  /(?:^| )(?:posso|podemos|can i|can we)(?: |$)/;

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[-_:./,!?;()[\]{}'"`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function providerTargets(text) {
  return PROVIDER_TARGETS
    .filter((target) => target.pattern.test(text))
    .map((target) => target.providerId);
}

function resolvedIntent(intent, text, providerId = null) {
  return deepFreeze({
    schema: 'sdo.natural_provider_intent.v1',
    matched: true,
    intent,
    providerId,
    requested: text,
    ...ZERO_OPERATIONAL_AUTHORITY
  });
}

function resolveNaturalProviderIntent(input) {
  const text = normalize(input);

  if (!text) {
    return Object.freeze({
      schema: 'sdo.natural_provider_intent.v1',
      matched: false
    });
  }

  if (
    CREDENTIAL_CONCEPT.test(text) &&
    UNSAFE_CREDENTIAL_CONCEPT.test(text)
  ) {
    return resolvedIntent(
      PROVIDER_INTENTS.PROVIDER_AUTHORITY_DENIED,
      text
    );
  }

  if (
    text === 'providers' ||
    text === 'provedores' ||
    (
      PROVIDER_SUBJECT.test(text) &&
      ACTIVE_STATE_CONCEPT.test(text) &&
      (
        QUERY_ACTION.test(text) ||
        text.startsWith('current ')
      )
    )
  ) {
    return resolvedIntent(
      PROVIDER_INTENTS.QUERY_ACTIVE_PROVIDER,
      text
    );
  }

  if (
    text === 'ias' ||
    text === 'modelos' ||
    text === 'models' ||
    (
      LIST_ACTION.test(text) &&
      (PROVIDER_SUBJECT.test(text) || PLURAL_PROVIDER_SUBJECT.test(text))
    ) ||
    (
      QUERY_ACTION.test(text) &&
      PROVIDER_SUBJECT.test(text) &&
      AVAILABLE_CONCEPT.test(text)
    )
  ) {
    return resolvedIntent(
      PROVIDER_INTENTS.LIST_PROVIDERS,
      text
    );
  }

  if (RETURN_TO_LOCAL.test(text)) {
    return resolvedIntent(
      PROVIDER_INTENTS.RETURN_TO_LOCAL,
      text,
      'ollama:qwen3:8b'
    );
  }

  if (
    GENERIC_PROVIDER_HELP.test(text) ||
    (
      QUERY_ACTION.test(text) &&
      PROVIDER_SUBJECT.test(text) &&
      CAN_USE_CONCEPT.test(text)
    )
  ) {
    return resolvedIntent(
      PROVIDER_INTENTS.PROVIDER_HELP,
      text
    );
  }

  const configuring = CONFIGURE_ACTION.test(text);
  const selecting = SELECT_ACTION.test(text);
  const targets = providerTargets(text);

  if (
    (configuring || selecting) &&
    targets.length > 1
  ) {
    return resolvedIntent(
      PROVIDER_INTENTS.AMBIGUOUS_PROVIDER_REQUEST,
      text
    );
  }

  const providerId = targets[0] || null;

  if (configuring && providerId) {
    return resolvedIntent(
      PROVIDER_INTENTS.CONFIGURE_PROVIDER,
      text,
      providerId
    );
  }

  if (selecting && providerId) {
    const profile = requireProfile(providerId);

    if (
      profile.kind === 'LOCAL' &&
      !DIRECT_SELECTION.test(text)
    ) {
      return resolvedIntent(
        PROVIDER_INTENTS.AMBIGUOUS_PROVIDER_REQUEST,
        text
      );
    }

    return resolvedIntent(
      profile.kind === 'LOCAL'
        ? PROVIDER_INTENTS.SELECT_LOCAL_PROVIDER
        : PROVIDER_INTENTS.SELECT_REMOTE_PROVIDER,
      text,
      providerId
    );
  }

  if (
    (configuring || selecting) &&
    PROVIDER_SUBJECT.test(text)
  ) {
    return resolvedIntent(
      !providerId && GENERIC_PROVIDER_HELP.test(text)
        ? PROVIDER_INTENTS.PROVIDER_HELP
        : PROVIDER_INTENTS.AMBIGUOUS_PROVIDER_REQUEST,
      text,
      providerId
    );
  }

  return Object.freeze({
    schema: 'sdo.natural_provider_intent.v1',
    matched: false
  });
}

function normalizeProviderActivationRequest(input) {
  const resolved = resolveNaturalProviderIntent(input);
  if (!resolved.matched) {
    throw new Error(
      `Provider request '${normalize(input)}' is outside the qualified catalog.`
    );
  }

  if (resolved.intent === PROVIDER_INTENTS.PROVIDER_HELP) {
    return deepFreeze({
      schema: 'sdo.natural_provider_activation_request.v1',
      intent: 'SWITCH_PROVIDER',
      providerId: null,
      requested: resolved.requested
    });
  }

  if (resolved.intent === PROVIDER_INTENTS.RETURN_TO_LOCAL) {
    return deepFreeze({
      schema: 'sdo.natural_provider_activation_request.v1',
      intent: 'ACTIVATE_LOCAL_PROVIDER',
      providerId: null,
      requested: resolved.requested
    });
  }

  if (!resolved.providerId) {
    throw new Error(
      `Provider request '${resolved.requested}' is ambiguous or outside the qualified catalog.`
    );
  }

  return deepFreeze({
    schema: 'sdo.natural_provider_activation_request.v1',
    intent: resolved.intent === PROVIDER_INTENTS.CONFIGURE_PROVIDER
      ? 'CONFIGURE_PROVIDER'
      : 'ACTIVATE_PROVIDER',
    providerId: resolved.providerId,
    requested: resolved.requested
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
    intents: PROVIDER_INTENTS,
    resolveIntent: resolveNaturalProviderIntent,
    resolve: normalizeProviderActivationRequest,
    state: deriveProviderState,
    authority: ZERO_OPERATIONAL_AUTHORITY
  });
}

module.exports = Object.freeze({
  PROVIDER_STATES,
  PROVIDER_INTENTS,
  PROVIDER_CATALOG,
  ZERO_OPERATIONAL_AUTHORITY,
  resolveNaturalProviderIntent,
  normalizeProviderActivationRequest,
  deriveProviderState,
  createNaturalProviderActivationCoordinator
});
