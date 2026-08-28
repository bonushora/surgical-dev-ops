'use strict';

/*
 * G5 is the narrow operational bridge from exact G1-G4 evidence to the
 * already-qualified R3 patch path. It creates no alternative mutation,
 * journal, signer, clock or Manifest CAS implementation.
 */

const crypto = require('node:crypto');

const {
  discover
} = require('../core/repository-discovery');

const {
  orchestrate
} = require('../core/surgical-orchestrator');

const {
  evaluateNaturalDevelopmentTaskBoundary
} = require('./natural-development-task-contract');

const {
  evaluateNaturalDevelopmentPatchAuthorization
} = require('./natural-development-patch-authorization');

const {
  createGovernedPatchRequest
} = require('./governed-patch-dispatch');

const RESULT_SCHEMA =
  'sdo.natural_development_r3_composition_result.v1';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}

function replacementFromProposal(proposal) {
  if (
    !proposal ||
    proposal.schema !== 'sdo.natural_development_patch_proposal.v1' ||
    !Object.isFrozen(proposal) ||
    typeof proposal.replacementBase64 !== 'string'
  ) {
    throw new Error('Immutable exact G3 patch proposal is required.');
  }

  const replacement = Buffer.from(proposal.replacementBase64, 'base64');

  if (
    replacement.length === 0 ||
    replacement.toString('base64') !== proposal.replacementBase64 ||
    replacement.length !== proposal.replacementBytes ||
    crypto.createHash('sha256').update(replacement).digest('hex') !==
      proposal.replacementSha256
  ) {
    throw new Error('Exact G3 replacement content is malformed.');
  }

  return replacement.toString('utf8');
}

function validateTaskAnchors(
  contract,
  proposal,
  physicalWorkspaceIdentity,
  repository
) {
  if (
    !contract ||
    !Object.isFrozen(contract) ||
    proposal.contractFingerprint !== contract.contractFingerprint ||
    repository.repository.commit !== contract.repositoryHead
  ) {
    throw new Error('G1 contract or repository HEAD is stale.');
  }

  const boundary = evaluateNaturalDevelopmentTaskBoundary(
    contract,
    Object.freeze({
      physicalWorkspaceIdentity,
      repositoryHead: repository.repository.commit,
      target: proposal.target,
      risk: 'R3',
      validationKind: proposal.validationKind,
      evidenceStep: 1,
      patchAttempt: proposal.patchAttempt,
      mutating: true,
      credentialUse: false,
      externalSideEffect: false,
      architecturalDecision: false,
      genericShell: false,
      conflictOrRecoveryRequired: false
    })
  );

  if (
    boundary.decision !== 'CONTAINED' ||
    boundary.requiresExactR3Authority !== true
  ) {
    throw new Error(
      `G5 task boundary denied composition: ${boundary.stopCondition}.`
    );
  }
}

function successfulCasEvidence(orchestration) {
  const execution = orchestration && orchestration.execution;
  const mutationProvider = execution && execution.mutationProvider;
  const durability = mutationProvider && mutationProvider.durability;
  const materialization = durability && durability.materialization;
  const authority = durability && durability.authority;
  const transaction = execution && execution.transaction;

  if (
    !orchestration ||
    orchestration.orchestration.status !== 'COMPLETED' ||
    execution.outcome !== 'APPLIED' ||
    !transaction ||
    !/^[a-f0-9]{64}$/.test(transaction.transactionId || '') ||
    !/^[a-f0-9]{64}$/.test(transaction.journalId || '') ||
    !authority ||
    !/^[a-f0-9]{40,64}$/.test(authority.afterManifestOid || '') ||
    !materialization ||
    materialization.expectedManifestOid !== authority.afterManifestOid ||
    materialization.observedManifestOid !== authority.afterManifestOid ||
    typeof materialization.projection !== 'string' ||
    !materialization.projection
  ) {
    throw new Error(
      'G5 requires completed R3 journal and Manifest CAS evidence.'
    );
  }

  return {
    transactionId: transaction.transactionId,
    journalId: transaction.journalId,
    afterManifestOid: authority.afterManifestOid,
    managedProjection: materialization.projection,
    ordinaryWorktreeAuthoritative:
      durability.ordinaryWorktreeAuthoritative
  };
}

function composeAndDispatchNaturalDevelopmentPatch({
  contract,
  patchProposal,
  patchAuthorization,
  physicalWorkspaceIdentity,
  repositoryPath,
  authorityRoot,
  journalStorageRoot,
  tenantId = null,
  projectId = null
} = {}) {
  const repository = discover(repositoryPath);

  validateTaskAnchors(
    contract,
    patchProposal,
    physicalWorkspaceIdentity,
    repository
  );

  const replacement = replacementFromProposal(patchProposal);

  const prepared = createGovernedPatchRequest({
    repositoryPath: repository.repository.path,
    target: patchProposal.target,
    replacement,
    authorityRoot,
    journalStorageRoot,
    tenantId,
    projectId
  });

  if (
    prepared.authority.target !== patchProposal.target ||
    prepared.authority.beforeSha256 !== patchProposal.beforeSha256 ||
    prepared.authority.replacementSha256 !==
      patchProposal.replacementSha256
  ) {
    throw new Error(
      'Prepared R3 authority differs from exact G3 content.'
    );
  }

  const authorizationObservation =
    prepared.runtime.authoritativeClock.observe();

  if (
    !authorizationObservation ||
    authorizationObservation.decision !== 'ALLOWED'
  ) {
    throw new Error(
      'Authoritative system clock denied G4 consumption.'
    );
  }

  const authorizationEvaluation =
    evaluateNaturalDevelopmentPatchAuthorization(
      patchAuthorization,
      patchProposal,
      {
        temporalAuthority: {
          reading: authorizationObservation.reading,
          requireCurrent: true
        },
        expectedHumanSubject: prepared.authority.subjectId,
        expectedHumanIdentityIssuer: prepared.authority.issuer
      }
    );

  if (authorizationEvaluation.decision !== 'ALLOWED') {
    throw new Error(
      `G4 authorization denied R3 composition: ${authorizationEvaluation.reason}`
    );
  }

  const orchestration = orchestrate(
    prepared.request,
    prepared.runtime
  );

  const cas = successfulCasEvidence(orchestration);

  const binding = deepFreeze({
    schema: RESULT_SCHEMA,
    status: 'COMPLETED',
    contractFingerprint: contract.contractFingerprint,
    planningFingerprint: patchProposal.planningFingerprint,
    proposalFingerprint: patchProposal.proposalFingerprint,
    authorizationFingerprint:
      patchAuthorization.authorizationFingerprint,
    diffFingerprint: patchProposal.exactDiff.diffFingerprint,
    workspace: repository.repository.path,
    physicalWorkspaceIdentity,
    repositoryHead: repository.repository.commit,
    r3OperationId: prepared.authority.operationId,
    target: patchProposal.target,
    beforeSha256: patchProposal.beforeSha256,
    afterSha256: patchProposal.replacementSha256,
    transactionId: cas.transactionId,
    journalId: cas.journalId,
    afterManifestOid: cas.afterManifestOid,
    managedProjection: cas.managedProjection,
    ordinaryWorktreeAuthoritative:
      cas.ordinaryWorktreeAuthoritative,
    authorizationUseRecorded: true,
    durableAntiReplayQualified: false,
    nextRequiredStage: 'G6_VALIDATION_THEN_G7_ANTI_REPLAY',
    genericShellAuthority: false,
    credentialAuthority: false,
    externalSideEffectAuthority: false
  });

  return deepFreeze({
    ...binding,
    compositionFingerprint: fingerprint(binding)
  });
}

module.exports = Object.freeze({
  RESULT_SCHEMA,
  composeAndDispatchNaturalDevelopmentPatch
});
