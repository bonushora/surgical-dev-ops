'use strict';

/*
 * Local G4 materialization after one exact interactive human decision.
 * The caller decides only whether the reviewed proposal fingerprint is the
 * proposal being approved. This adapter creates and verifies the existing
 * Ed25519 local-offline challenge; it cannot dispatch the patch.
 */

const {
  readLocalOfflineHumanPublicAuthority,
  loadLocalOfflineHumanSigner
} = require('../core/local-offline-human-authority-store');

const {
  createProductionMutationRuntime
} = require('../core/production-mutation-runtime');

const {
  verifyHumanIdentityAssertion
} = require('../adapters/identity-verification-adapter');

const {
  HUMAN_DECISION_SCHEMA,
  AUTHORIZATION_AUDIENCE,
  materializeNaturalDevelopmentPatchAuthorization
} = require('./natural-development-patch-authorization');

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function required(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function materializeLocalNaturalDevelopmentAuthorization({
  patchProposal,
  approvedProposalFingerprint,
  physicalWorkspaceIdentity,
  repositoryPath,
  authorityRoot,
  journalStorageRoot,
  tenantId = null,
  projectId = null
} = {}) {
  if (
    !patchProposal ||
    approvedProposalFingerprint !== patchProposal.proposalFingerprint
  ) {
    throw new Error('Exact reviewed proposal fingerprint is required.');
  }

  required(
    physicalWorkspaceIdentity,
    'Physical workspace identity'
  );
  const workspace = required(repositoryPath, 'Repository path');
  const authorityPath = required(authorityRoot, 'Human authority root');
  const journalPath = required(journalStorageRoot, 'Mutation journal root');
  const publicAuthority = readLocalOfflineHumanPublicAuthority({
    authorityRoot: authorityPath
  });
  const signer = loadLocalOfflineHumanSigner({ authorityRoot: authorityPath });
  const runtime = createProductionMutationRuntime({
    journalStorageRoot: journalPath,
    humanAuthorityPublicKeyPem: publicAuthority.publicKeyPem,
    humanAuthorityIssuer: publicAuthority.issuer,
    humanSubjectId: publicAuthority.subjectId,
    identityAudience: AUTHORIZATION_AUDIENCE
  });
  const observation = runtime.authoritativeClock.observe();

  if (!observation || observation.decision !== 'ALLOWED') {
    throw new Error('Authoritative clock denied local G4 materialization.');
  }

  const issuedAt = observation.reading.wallTime;
  const expiresAt = new Date(Date.parse(issuedAt) + 5 * 60_000).toISOString();
  const operationId =
    `natural-development-patch:${patchProposal.proposalFingerprint}`;
  const challenge = deepFreeze({
    schema: 'sdo.local_offline_human_challenge.v1',
    challengeId: `natural-development-${patchProposal.proposalFingerprint}`,
    issuer: publicAuthority.issuer,
    subjectId: publicAuthority.subjectId,
    audience: Object.freeze([AUTHORIZATION_AUDIENCE]),
    operationId,
    workspace,
    tenantId,
    projectId,
    issuedAt,
    expiresAt
  });
  const signedAssertion = signer.signChallenge(challenge);
  const verification = verifyHumanIdentityAssertion(
    {
      rawAssertion: signedAssertion,
      trustedIssuers: runtime.trustedIdentityIssuers,
      expected: {
        subjectId: publicAuthority.subjectId,
        audience: AUTHORIZATION_AUDIENCE,
        operationId,
        workspace,
        tenantId,
        projectId
      }
    },
    runtime.identityVerifierPort,
    {
      reading: observation.reading,
      requireCurrent: true
    }
  );

  if (verification.decision !== 'VERIFIED') {
    throw new Error('Local human identity verification failed closed.');
  }

  const humanDecision = deepFreeze({
    schema: HUMAN_DECISION_SCHEMA,
    decision: 'APPROVE_EXACT_PATCH',
    approved: true,
    proposalFingerprint: patchProposal.proposalFingerprint,
    diffFingerprint: patchProposal.exactDiff.diffFingerprint,
    target: patchProposal.target,
    beforeSha256: patchProposal.beforeSha256,
    afterSha256: patchProposal.replacementSha256,
    humanSubject: publicAuthority.subjectId,
    authorizedAt: issuedAt,
    expiresAt
  });

  return materializeNaturalDevelopmentPatchAuthorization({
    patchProposal,
    humanDecision,
    verifiedHumanIdentityAssertion: verification.assertion,
    temporalAuthority: {
      reading: observation.reading,
      requireCurrent: true
    }
  });
}

module.exports = Object.freeze({
  materializeLocalNaturalDevelopmentAuthorization
});
