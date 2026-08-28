'use strict';

const crypto = require('node:crypto');

const CLAIM_SCHEMA =
  'sdo.natural_development_authorization_claim.v1';

const COMMIT_SCHEMA =
  'sdo.natural_development_authorization_consumption.v1';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
  );
}

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function text(value, label, maximum = 4096) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function sha(value, label) {
  const result = text(value, label, 64);
  if (!/^[a-f0-9]{64}$/.test(result)) {
    throw new Error(`${label} must be canonical SHA-256.`);
  }
  return result;
}

function requireImmutableAuthorization(authorization) {
  if (
    !authorization ||
    typeof authorization !== 'object' ||
    !Object.isFrozen(authorization)
  ) {
    throw new Error(
      'Immutable exact G4 authorization evidence is required.'
    );
  }

  const authorizationFingerprint =
    sha(
      authorization.authorizationFingerprint,
      'G4 authorization fingerprint'
    );

  const explicitlySingleUse =
    authorization.singleUse === true ||
    authorization.reusable === false ||
    authorization.reusableApproval === false;

  if (!explicitlySingleUse) {
    throw new Error(
      'G4 authorization must explicitly remain single-use and non-reusable.'
    );
  }

  if (
    authorization.operationalAuthority === true ||
    authorization.mutationAuthority === true ||
    authorization.dispatchAuthority === true
  ) {
    throw new Error(
      'G4 authorization cannot carry execution or mutation authority.'
    );
  }

  return authorizationFingerprint;
}

function createNaturalDevelopmentAuthorizationClaim({
  authorization,
  operationId,
  physicalWorkspaceIdentity,
  target,
  beforeSha256,
  replacementSha256
} = {}) {
  const authorizationFingerprint =
    requireImmutableAuthorization(authorization);

  const body = {
    schema: CLAIM_SCHEMA,
    authorizationFingerprint,
    operationId: text(operationId, 'Operation identity', 512),
    physicalWorkspaceIdentity:
      sha(
        physicalWorkspaceIdentity,
        'Physical workspace identity'
      ),
    target: text(target, 'Exact patch target', 4096),
    beforeSha256: sha(beforeSha256, 'BEFORE SHA-256'),
    replacementSha256:
      sha(replacementSha256, 'Replacement SHA-256'),
    state: 'CLAIMED',
    reusable: false,
    operationalAuthority: false,
    mutationAuthority: false,
    dispatchAuthority: false
  };

  return deepFreeze({
    ...body,
    claimFingerprint: fingerprint(body)
  });
}

function validateNaturalDevelopmentAuthorizationClaim(claim) {
  if (
    !claim ||
    claim.schema !== CLAIM_SCHEMA ||
    !Object.isFrozen(claim) ||
    claim.state !== 'CLAIMED' ||
    claim.reusable !== false ||
    claim.operationalAuthority !== false ||
    claim.mutationAuthority !== false ||
    claim.dispatchAuthority !== false
  ) {
    throw new Error(
      'Immutable durable G7 authorization claim is required.'
    );
  }

  const {
    claimFingerprint,
    ...body
  } = claim;

  sha(claimFingerprint, 'Claim fingerprint');
  sha(claim.authorizationFingerprint, 'Authorization fingerprint');
  sha(claim.physicalWorkspaceIdentity, 'Physical workspace identity');
  sha(claim.beforeSha256, 'BEFORE SHA-256');
  sha(claim.replacementSha256, 'Replacement SHA-256');
  text(claim.operationId, 'Operation identity', 512);
  text(claim.target, 'Exact patch target', 4096);

  if (fingerprint(body) !== claimFingerprint) {
    throw new Error(
      'Durable G7 authorization claim integrity is invalid.'
    );
  }

  return claim;
}

function commitNaturalDevelopmentAuthorizationConsumption({
  claim,
  transactionId,
  journalId,
  effectFingerprint,
  manifestAfterOid
} = {}) {
  validateNaturalDevelopmentAuthorizationClaim(claim);

  const body = {
    schema: COMMIT_SCHEMA,
    claimFingerprint: claim.claimFingerprint,
    authorizationFingerprint:
      claim.authorizationFingerprint,
    operationId: claim.operationId,
    physicalWorkspaceIdentity:
      claim.physicalWorkspaceIdentity,
    target: claim.target,
    beforeSha256: claim.beforeSha256,
    replacementSha256:
      claim.replacementSha256,
    transactionId:
      text(transactionId, 'Mutation transaction identity', 512),
    journalId:
      text(journalId, 'Mutation journal identity', 512),
    effectFingerprint:
      sha(effectFingerprint, 'Committed effect fingerprint'),
    manifestAfterOid:
      text(manifestAfterOid, 'Manifest CAS AFTER identity', 128),
    state: 'CONSUMED',
    reusable: false,
    operationalAuthority: false,
    mutationAuthority: false,
    dispatchAuthority: false
  };

  return deepFreeze({
    ...body,
    consumptionFingerprint:
      fingerprint(body)
  });
}

function validateNaturalDevelopmentAuthorizationConsumption(value) {
  if (
    !value ||
    value.schema !== COMMIT_SCHEMA ||
    !Object.isFrozen(value) ||
    value.state !== 'CONSUMED' ||
    value.reusable !== false ||
    value.operationalAuthority !== false ||
    value.mutationAuthority !== false ||
    value.dispatchAuthority !== false
  ) {
    throw new Error(
      'Immutable durable G7 authorization consumption is required.'
    );
  }

  const {
    consumptionFingerprint,
    ...body
  } = value;

  sha(consumptionFingerprint, 'Consumption fingerprint');
  sha(value.claimFingerprint, 'Claim fingerprint');
  sha(value.authorizationFingerprint, 'Authorization fingerprint');
  sha(value.physicalWorkspaceIdentity, 'Physical workspace identity');
  sha(value.beforeSha256, 'BEFORE SHA-256');
  sha(value.replacementSha256, 'Replacement SHA-256');
  sha(value.effectFingerprint, 'Committed effect fingerprint');
  text(value.operationId, 'Operation identity', 512);
  text(value.target, 'Exact patch target', 4096);
  text(value.transactionId, 'Mutation transaction identity', 512);
  text(value.journalId, 'Mutation journal identity', 512);
  text(value.manifestAfterOid, 'Manifest CAS AFTER identity', 128);

  if (fingerprint(body) !== consumptionFingerprint) {
    throw new Error(
      'Durable G7 authorization consumption integrity is invalid.'
    );
  }

  return value;
}

module.exports = Object.freeze({
  CLAIM_SCHEMA,
  COMMIT_SCHEMA,
  createNaturalDevelopmentAuthorizationClaim,
  validateNaturalDevelopmentAuthorizationClaim,
  commitNaturalDevelopmentAuthorizationConsumption,
  validateNaturalDevelopmentAuthorizationConsumption
});
