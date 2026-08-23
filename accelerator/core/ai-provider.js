'use strict';

const crypto = require('crypto');

const AI_CAPABILITIES = Object.freeze([
  'INTERPRET',
  'REASON',
  'PLAN',
  'PROPOSE',
  'EVALUATE',
  'EXPLAIN'
]);

const AI_CAPABILITY_SET =
  new Set(AI_CAPABILITIES);

const trustedPorts =
  new WeakSet();

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

function normalizeCapability(value) {
  if (typeof value !== 'string') {
    throw new Error(
      'AI capability must be a string.'
    );
  }

  const normalized =
    value.trim().toUpperCase();

  if (!AI_CAPABILITY_SET.has(normalized)) {
    throw new Error(
      `Unsupported AI capability: ${String(value)}.`
    );
  }

  return normalized;
}

function normalizeCapabilities(values) {
  if (
    !Array.isArray(values) ||
    values.length === 0
  ) {
    throw new Error(
      'AI provider capabilities are required.'
    );
  }

  const normalized =
    values.map(normalizeCapability);

  const unique =
    [...new Set(normalized)];

  if (unique.length !== normalized.length) {
    throw new Error(
      'AI provider capabilities must be unique.'
    );
  }

  return Object.freeze(unique);
}

function createAIProviderPort(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error(
      'AI provider configuration is required.'
    );
  }

  const providerId =
    requireText(
      input.providerId,
      'providerId'
    );

  const capabilities =
    normalizeCapabilities(
      input.capabilities
    );

  const descriptor =
    {
      schema: 'sdo.ai_provider_port.v1',
      providerId,
      capabilities,
      authority: {
        class: 'COGNITIVE_ONLY',
        physicalExecution: false,
        mutationAuthority: false,
        shellAuthority: false,
        authorizationAuthority: false,
        humanAuthority: false
      }
    };

  const port =
    deepFreeze({
      ...descriptor,

      fingerprint:
        fingerprint(descriptor)
    });

  trustedPorts.add(port);

  return port;
}

function denied(
  capability,
  reason
) {
  const evidence =
    {
      schema:
        'sdo.ai_provider_evaluation.v1',

      decision:
        'DENIED',

      providerId:
        null,

      capability:
        capability || null,

      zeroDispatch:
        true,

      reason
    };

  return deepFreeze({
    ...evidence,
    fingerprint:
      fingerprint(evidence)
  });
}

function evaluateAIProviderPort(
  port,
  request = {}
) {
  let capability;

  try {
    capability =
      normalizeCapability(
        request &&
        request.capability
      );
  } catch {
    return denied(
      typeof request?.capability === 'string'
        ? request.capability.trim().toUpperCase() || null
        : null,
      'Requested AI capability is unsupported.'
    );
  }

  if (
    !port ||
    !trustedPorts.has(port) ||
    port.schema !==
      'sdo.ai_provider_port.v1'
  ) {
    return denied(
      capability,
      'AI provider port is missing, malformed, or untrusted.'
    );
  }

  if (
    !port.capabilities.includes(
      capability
    )
  ) {
    const evidence =
      {
        schema:
          'sdo.ai_provider_evaluation.v1',

        decision:
          'DENIED',

        providerId:
          port.providerId,

        capability,

        zeroDispatch:
          true,

        reason:
          'Requested cognitive capability is not granted by this AI provider.'
      };

    return deepFreeze({
      ...evidence,
      fingerprint:
        fingerprint(evidence)
    });
  }

  const evidence =
    {
      schema:
        'sdo.ai_provider_evaluation.v1',

      decision:
        'ALLOWED',

      providerId:
        port.providerId,

      capability,

      zeroDispatch:
        false,

      reason:
        'Requested cognitive capability is available through the trusted AI provider port.'
    };

  return deepFreeze({
    ...evidence,
    fingerprint:
      fingerprint(evidence)
  });
}

module.exports = Object.freeze({
  AI_CAPABILITIES,
  createAIProviderPort,
  evaluateAIProviderPort
});
