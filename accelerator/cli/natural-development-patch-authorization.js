'use strict';

/*
 * G4 binds one explicit human decision and one verified human identity to the
 * exact G3 patch proposal. The result is evidence for later R3 composition;
 * this module cannot consume, execute, mutate or dispatch the authorization.
 */

const crypto = require('node:crypto');

const {
  evaluateVerifiedHumanIdentityAssertion
} = require('../core/human-identity-assertion');

const {
  classifyExpiry
} = require('../core/authoritative-clock');

const AUTHORIZATION_SCHEMA =
  'sdo.natural_development_patch_authorization.v1';

const HUMAN_DECISION_SCHEMA =
  'sdo.natural_development_human_decision.v1';

const AUTHORIZATION_AUDIENCE =
  'surgical-devops:natural-development-r3';

const MAXIMUM_VALIDITY_MS = 10 * 60_000;

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

function canonicalTimestamp(value, label) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(Date.parse(value)).toISOString() !== value
  ) {
    throw new Error(`${label} must be canonical ISO-8601.`);
  }

  return value;
}

function validatePatchProposal(proposal) {
  if (
    !proposal ||
    proposal.schema !==
      'sdo.natural_development_patch_proposal.v1' ||
    proposal.state !== 'HUMAN_REVIEW_REQUIRED' ||
    proposal.requiresExactR3Authority !== true ||
    proposal.reusableApproval !== false ||
    proposal.operationalAuthority !== false ||
    proposal.mutationAuthority !== false ||
    proposal.approvalAuthority !== false ||
    proposal.dispatchAuthority !== false ||
    !proposal.exactDiff ||
    !Object.isFrozen(proposal) ||
    !Object.isFrozen(proposal.exactDiff)
  ) {
    throw new Error(
      'Immutable authority-free G3 patch proposal is required.'
    );
  }

  const {
    proposalFingerprint,
    ...proposalBinding
  } = proposal;

  const {
    diffFingerprint,
    ...diffBinding
  } = proposal.exactDiff;

  if (
    !/^[a-f0-9]{64}$/.test(proposalFingerprint) ||
    !/^[a-f0-9]{64}$/.test(diffFingerprint) ||
    fingerprint(proposalBinding) !== proposalFingerprint ||
    fingerprint(diffBinding) !== diffFingerprint ||
    proposal.target !== proposal.exactDiff.target ||
    proposal.beforeSha256 !== proposal.exactDiff.before.sha256 ||
    proposal.replacementSha256 !== proposal.exactDiff.after.sha256
  ) {
    throw new Error('G3 patch-proposal binding is malformed.');
  }
}

function materializeNaturalDevelopmentPatchAuthorization({
  patchProposal,
  humanDecision,
  verifiedHumanIdentityAssertion,
  temporalAuthority
} = {}) {
  validatePatchProposal(patchProposal);

  if (
    !humanDecision ||
    !Object.isFrozen(humanDecision) ||
    humanDecision.schema !== HUMAN_DECISION_SCHEMA ||
    humanDecision.decision !== 'APPROVE_EXACT_PATCH' ||
    humanDecision.approved !== true ||
    humanDecision.proposalFingerprint !==
      patchProposal.proposalFingerprint ||
    humanDecision.diffFingerprint !==
      patchProposal.exactDiff.diffFingerprint ||
    humanDecision.target !== patchProposal.target ||
    humanDecision.beforeSha256 !== patchProposal.beforeSha256 ||
    humanDecision.afterSha256 !==
      patchProposal.replacementSha256 ||
    typeof humanDecision.humanSubject !== 'string' ||
    !humanDecision.humanSubject.trim()
  ) {
    throw new Error(
      'Exact immutable human patch decision is required.'
    );
  }

  const authorizedAt = canonicalTimestamp(
    humanDecision.authorizedAt,
    'Authorization time'
  );

  const expiresAt = canonicalTimestamp(
    humanDecision.expiresAt,
    'Authorization expiry'
  );

  const validity = Date.parse(expiresAt) - Date.parse(authorizedAt);

  if (validity <= 0 || validity > MAXIMUM_VALIDITY_MS) {
    throw new Error(
      'Patch authorization validity must be positive and no longer than 10 minutes.'
    );
  }

  const operationId =
    `natural-development-patch:${patchProposal.proposalFingerprint}`;

  const identityEvaluation =
    evaluateVerifiedHumanIdentityAssertion(
      verifiedHumanIdentityAssertion,
      {
        subjectId: humanDecision.humanSubject.trim(),
        audience: AUTHORIZATION_AUDIENCE,
        operationId
      },
      temporalAuthority
    );

  if (identityEvaluation.decision !== 'VERIFIED') {
    throw new Error(
      `Verified human identity is required: ${identityEvaluation.reason}`
    );
  }

  const identity = identityEvaluation.assertion;

  if (
    authorizedAt !== identity.verifiedAt ||
    Date.parse(expiresAt) > Date.parse(identity.expiresAt)
  ) {
    throw new Error(
      'Authorization validity is not contained by verified human identity.'
    );
  }

  const binding = deepFreeze({
    schema: AUTHORIZATION_SCHEMA,
    state: 'AUTHORIZED_FOR_R3_COMPOSITION',
    proposalFingerprint:
      patchProposal.proposalFingerprint,
    contractFingerprint:
      patchProposal.contractFingerprint,
    planningFingerprint:
      patchProposal.planningFingerprint,
    diffFingerprint:
      patchProposal.exactDiff.diffFingerprint,
    target: patchProposal.target,
    beforeSha256: patchProposal.beforeSha256,
    afterSha256: patchProposal.replacementSha256,
    patchAttempt: patchProposal.patchAttempt,
    humanSubject: identity.subject.id,
    humanIdentityIssuer: identity.issuer,
    humanIdentityAuthenticationMethod:
      identity.authentication.method,
    humanIdentityFingerprint: identity.fingerprint,
    humanIdentityAssertionId: identity.assertionId,
    operationId,
    authorizedAt,
    expiresAt,
    singleUse: true,
    reusableApproval: false,
    consumed: false,
    requiresR3Composition: true,
    operationalAuthority: false,
    mutationAuthority: false,
    approvalAuthority: false,
    dispatchAuthority: false
  });

  return deepFreeze({
    ...binding,
    authorizationFingerprint: fingerprint(binding)
  });
}

function denied(reason) {
  return deepFreeze({
    schema:
      'sdo.natural_development_patch_authorization_evaluation.v1',
    decision: 'DENIED',
    reason,
    authorization: null,
    operationalAuthority: false,
    mutationAuthority: false,
    dispatchAuthority: false
  });
}

function evaluateNaturalDevelopmentPatchAuthorization(
  authorization,
  patchProposal,
  {
    temporalAuthority,
    expectedHumanSubject,
    expectedHumanIdentityIssuer
  } = {}
) {
  try {
    validatePatchProposal(patchProposal);
  } catch (error) {
    return denied(error.message);
  }

  if (
    !authorization ||
    authorization.schema !== AUTHORIZATION_SCHEMA ||
    authorization.state !== 'AUTHORIZED_FOR_R3_COMPOSITION' ||
    !Object.isFrozen(authorization) ||
    authorization.singleUse !== true ||
    authorization.reusableApproval !== false ||
    authorization.consumed !== false ||
    authorization.operationalAuthority !== false ||
    authorization.mutationAuthority !== false ||
    authorization.approvalAuthority !== false ||
    authorization.dispatchAuthority !== false
  ) {
    return denied(
      'Immutable unconsumed G4 authorization evidence is required.'
    );
  }

  const {
    authorizationFingerprint,
    ...binding
  } = authorization;

  if (
    !/^[a-f0-9]{64}$/.test(authorizationFingerprint) ||
    fingerprint(binding) !== authorizationFingerprint
  ) {
    return denied('G4 authorization binding is malformed.');
  }

  const exact = [
    ['proposalFingerprint', patchProposal.proposalFingerprint],
    ['contractFingerprint', patchProposal.contractFingerprint],
    ['planningFingerprint', patchProposal.planningFingerprint],
    ['diffFingerprint', patchProposal.exactDiff.diffFingerprint],
    ['target', patchProposal.target],
    ['beforeSha256', patchProposal.beforeSha256],
    ['afterSha256', patchProposal.replacementSha256],
    ['patchAttempt', patchProposal.patchAttempt]
  ];

  if (exact.some(([field, value]) => authorization[field] !== value)) {
    return denied('G4 authorization differs from the exact G3 proposal.');
  }

  if (
    typeof expectedHumanSubject !== 'string' ||
    authorization.humanSubject !== expectedHumanSubject ||
    typeof expectedHumanIdentityIssuer !== 'string' ||
    authorization.humanIdentityIssuer !== expectedHumanIdentityIssuer
  ) {
    return denied('G4 human identity differs from the R3 authority.');
  }

  if (
    !temporalAuthority ||
    !temporalAuthority.reading ||
    temporalAuthority.requireCurrent !== true
  ) {
    return denied(
      'Authoritative clock evidence is required for G4 validity.'
    );
  }

  let expiry;

  try {
    expiry = classifyExpiry(temporalAuthority.reading, {
      issuedAt: authorization.authorizedAt,
      expiresAt: authorization.expiresAt
    });
  } catch {
    return denied('Authoritative G4 time evidence is malformed.');
  }

  if (expiry.decision !== 'ALLOWED') {
    return denied(
      expiry.classification === 'ISSUED_IN_FUTURE'
        ? 'G4 authorization is not yet valid.'
        : 'G4 authorization is expired.'
    );
  }

  return deepFreeze({
    schema:
      'sdo.natural_development_patch_authorization_evaluation.v1',
    decision: 'ALLOWED',
    reason:
      'Exact G4 authorization is current and bound to the R3 human authority.',
    authorization,
    operationalAuthority: false,
    mutationAuthority: false,
    dispatchAuthority: false
  });
}

module.exports = Object.freeze({
  AUTHORIZATION_SCHEMA,
  HUMAN_DECISION_SCHEMA,
  AUTHORIZATION_AUDIENCE,
  materializeNaturalDevelopmentPatchAuthorization,
  evaluateNaturalDevelopmentPatchAuthorization
});
