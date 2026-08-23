'use strict';

const crypto = require('crypto');

function deepFreeze(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}

function requireText(value, name) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    throw new Error(
      `${name} is required.`
    );
  }

  return value.trim();
}

function createAIProviderSelector(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error(
      'AI provider selector configuration is required.'
    );
  }

  if (
    !Array.isArray(input.providers) ||
    input.providers.length === 0
  ) {
    throw new Error(
      'AI provider selector requires at least one provider.'
    );
  }

  const providers =
    input.providers.map(
      (provider) => {
        if (
          !provider ||
          typeof provider !== 'object' ||
          Array.isArray(provider)
        ) {
          throw new Error(
            'AI provider selector entry is malformed.'
          );
        }

        const providerId =
          requireText(
            provider.providerId,
            'providerId'
          );

        return {
          providerId
        };
      }
    );

  const ids =
    providers.map(
      (provider) =>
        provider.providerId
    );

  if (
    new Set(ids).size !==
    ids.length
  ) {
    throw new Error(
      'AI provider selector providerId values must be unique.'
    );
  }

  const descriptor =
    {
      schema:
        'sdo.ai_provider_selector.v1',

      providers
    };

  const selector =
    {
      ...descriptor,

      fingerprint:
        fingerprint(descriptor),

      select(providerIdInput) {
        const providerId =
          requireText(
            providerIdInput,
            'providerId'
          );

        const selected =
          providers.find(
            (provider) =>
              provider.providerId ===
              providerId
          );

        if (!selected) {
          return deepFreeze({
            schema:
              'sdo.ai_provider_selection.v1',

            decision:
              'DENIED',

            providerId,

            zeroDispatch:
              true,

            reason:
              'Requested AI provider is not available.'
          });
        }

        const evidence =
          {
            schema:
              'sdo.ai_provider_selection.v1',

            decision:
              'SELECTED',

            providerId:
              selected.providerId,

            zeroDispatch:
              true,

            authority: {
              class:
                'COGNITIVE_SELECTION_ONLY',

              physicalExecution:
                false,

              mutationAuthority:
                false,

              shellAuthority:
                false,

              authorizationAuthority:
                false,

              humanAuthority:
                false
            }
          };

        return deepFreeze({
          ...evidence,

          fingerprint:
            fingerprint(evidence)
        });
      }
    };

  return deepFreeze(selector);
}

module.exports = Object.freeze({
  createAIProviderSelector
});
