'use strict';

const crypto =
  require('node:crypto');

const FORBIDDEN_AUTHORITY_KEYS =
  new Set([
    'command',
    'commands',
    'args',
    'argv',
    'executable',
    'execution',
    'executionMode',
    'executionAction',
    'authorizeExecution',
    'authorization',
    'approvalAuthority',
    'rawIdentityAssertion',
    'identityVerification',
    'grant',
    'grantEvaluation',
    'capabilityGrant',
    'mutationProvider',
    'mutationProviderRuntime',
    'compareAndReplace',
    'shell',
    'spawn',
    'exec',
    'write',
    'patch',
    'privateKey',
    'sign',
    'signature',
    'credential',
    'credentials',
    'token'
  ]);

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

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (
    !value ||
    typeof value !== 'object'
  ) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(
        (key) => [
          key,
          canonicalize(value[key])
        ]
      )
  );
}

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify(
        canonicalize(value)
      )
    )
    .digest('hex');
}

function requireText(
  value,
  name
) {
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

function requireObject(
  value,
  name
) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${name} must be an object.`
    );
  }

  return value;
}

function rejectAuthorityBearingValue(
  value,
  path = 'proposal'
) {
  if (
    value === null ||
    value === undefined
  ) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach(
      (entry, index) =>
        rejectAuthorityBearingValue(
          entry,
          `${path}[${index}]`
        )
    );

    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  for (
    const [key, child]
    of Object.entries(value)
  ) {
    if (
      FORBIDDEN_AUTHORITY_KEYS.has(key)
    ) {
      throw new Error(
        `Operational authority field is forbidden in cognitive proposal: ${path}.${key}`
      );
    }

    rejectAuthorityBearingValue(
      child,
      `${path}.${key}`
    );
  }
}

function validateCognitiveResult(
  result
) {
  requireObject(
    result,
    'Cognitive result'
  );

  if (
    result.schema !==
      'sdo.ai_cognitive_result.v1' ||
    !Object.isFrozen(result)
  ) {
    throw new Error(
      'Cognitive result is malformed or mutable.'
    );
  }

  for (const field of [
    'requestId',
    'requestFingerprint',
    'providerId',
    'capability'
  ]) {
    requireText(
      result[field],
      `Cognitive result ${field}`
    );
  }

  if (
    result.status !==
      'COMPLETED'
  ) {
    throw new Error(
      'Only completed cognitive evidence can produce a proposal.'
    );
  }

  requireObject(
    result.output,
    'Cognitive result output'
  );

  rejectAuthorityBearingValue(
    result.output,
    'cognitiveResult.output'
  );

  return result;
}

function createGovernedCognitiveProposal(
  input
) {
  requireObject(
    input,
    'Governed cognitive proposal input'
  );

  const humanIntent =
    requireText(
      input.humanIntent,
      'Human intent'
    );

  const cognitiveResult =
    validateCognitiveResult(
      input.cognitiveResult
    );

  const evidence =
    {
      schema:
        'sdo.governed_cognitive_proposal.v1',

      classification:
        'COGNITIVE_EVIDENCE_ONLY',

      humanIntent,

      source: {
        requestId:
          cognitiveResult.requestId,

        requestFingerprint:
          cognitiveResult.requestFingerprint,

        providerId:
          cognitiveResult.providerId,

        capability:
          cognitiveResult.capability
      },

      proposal:
        canonicalize(
          cognitiveResult.output
        ),

      authority: {
        executable:
          false,

        dispatchAllowed:
          false,

        physicalExecution:
          false,

        mutationAuthority:
          false,

        shellAuthority:
          false,

        authorizationAuthority:
          false,

        humanAuthority:
          false,

        capabilityGrantAuthority:
          false
      },

      nextBoundary:
        'DETERMINISTIC_MATERIALIZATION_REQUIRED'
    };

  rejectAuthorityBearingValue(
    evidence.proposal,
    'proposal'
  );

  return deepFreeze({
    ...evidence,

    fingerprint:
      fingerprint(evidence)
  });
}

module.exports =
  Object.freeze({
    createGovernedCognitiveProposal
  });
