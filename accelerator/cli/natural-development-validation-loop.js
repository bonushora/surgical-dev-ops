'use strict';

/*
 * G6 validates the authoritative AFTER projection produced by G5. A failure
 * may request one new bounded proposal attempt, but never authorizes or applies
 * that correction automatically.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  orchestrate
} = require('../core/surgical-orchestrator');

const {
  recoverAuthoritativeMaterialization
} = require('../core/git-manifest-materializer');

const {
  createGovernedReadOnlyRequest
} = require('./governed-readonly-dispatch');

const RESULT_SCHEMA =
  'sdo.natural_development_validation_loop.v1';

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

function sha256Bytes(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

function verifyExistingProjection(expectedProjection, expectedSha256) {
  let metadata;

  try {
    metadata = fs.lstatSync(expectedProjection);
  } catch {
    throw new Error(
      'Current independently verified Manifest CAS projection is required.'
    );
  }

  if (
    metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    fs.realpathSync(expectedProjection) !== expectedProjection ||
    sha256Bytes(fs.readFileSync(expectedProjection)) !== expectedSha256
  ) {
    throw new Error(
      'Current independently verified Manifest CAS projection is required.'
    );
  }

  return expectedProjection;
}

function validateInputs(contract, proposal, composition) {
  if (
    !contract ||
    !proposal ||
    !composition ||
    !Object.isFrozen(contract) ||
    !Object.isFrozen(proposal) ||
    !Object.isFrozen(composition) ||
    proposal.contractFingerprint !== contract.contractFingerprint ||
    composition.contractFingerprint !== contract.contractFingerprint ||
    composition.proposalFingerprint !== proposal.proposalFingerprint ||
    composition.diffFingerprint !== proposal.exactDiff.diffFingerprint ||
    composition.authorizationFingerprint === undefined ||
    composition.target !== proposal.target ||
    composition.afterSha256 !== proposal.replacementSha256 ||
    composition.repositoryHead !== contract.repositoryHead ||
    composition.physicalWorkspaceIdentity !==
      contract.physicalWorkspaceIdentity ||
    proposal.validationKind !== 'VALIDATE_JS'
  ) {
    throw new Error('Exact immutable G1 G3 and G5 validation chain is required.');
  }

  const {
    compositionFingerprint,
    ...binding
  } = composition;

  if (
    composition.schema !==
      'sdo.natural_development_r3_composition_result.v1' ||
    composition.status !== 'COMPLETED' ||
    !/^[a-f0-9]{64}$/.test(compositionFingerprint || '') ||
    fingerprint(binding) !== compositionFingerprint
  ) {
    throw new Error('G5 composition binding is malformed.');
  }
}

function runNaturalDevelopmentValidationLoop({
  contract,
  patchProposal,
  r3Composition
} = {}) {
  validateInputs(contract, patchProposal, r3Composition);

  verifyExistingProjection(
    r3Composition.managedProjection,
    r3Composition.afterSha256
  );

  const authoritativeProjection =
    recoverAuthoritativeMaterialization({
      workspace: r3Composition.workspace,
      target: path.join(
        r3Composition.workspace,
        patchProposal.target
      ),
      expectedManifestOid: r3Composition.afterManifestOid
    });

  if (
    authoritativeProjection.decision !== 'ALREADY_MATERIALIZED' ||
    authoritativeProjection.observedManifestOid !==
      r3Composition.afterManifestOid ||
    authoritativeProjection.contentSha256 !==
      r3Composition.afterSha256 ||
    authoritativeProjection.projection !==
      r3Composition.managedProjection
  ) {
    throw new Error(
      'Current independently verified Manifest CAS projection is required.'
    );
  }

  const request = createGovernedReadOnlyRequest({
    repositoryPath: r3Composition.workspace,
    capabilityType: 'PROCESS_VALIDATION',
    target: patchProposal.target
  });

  const governedRequest = deepFreeze({
    ...request,
    execution: {
      ...request.execution,
      projectionEvidence: r3Composition
    }
  });

  const orchestration = orchestrate(governedRequest);
  const validation = orchestration && orchestration.execution;

  if (
    !validation ||
    validation.schema !== 'sdo.process_validation_result.v1' ||
    validation.target.authoritativeProjection !==
      r3Composition.managedProjection ||
    !['PASSED', 'FAILED'].includes(validation.validation.status)
  ) {
    throw new Error(
      'Qualified authoritative-projection validation evidence is required.'
    );
  }

  const passed = validation.validation.status === 'PASSED';
  const correctionAvailable =
    !passed &&
    patchProposal.patchAttempt < contract.patchAttemptCeiling;
  const status = passed
    ? 'VALIDATED'
    : correctionAvailable
      ? 'CORRECTION_REQUIRED'
      : 'STOPPED';

  const binding = deepFreeze({
    schema: RESULT_SCHEMA,
    status,
    contractFingerprint: contract.contractFingerprint,
    proposalFingerprint: patchProposal.proposalFingerprint,
    authorizationFingerprint:
      r3Composition.authorizationFingerprint,
    compositionFingerprint:
      r3Composition.compositionFingerprint,
    validationKind: 'VALIDATE_JS',
    validationSelector: 'NODE_SYNTAX_CHECK',
    target: patchProposal.target,
    authoritativeProjection: r3Composition.managedProjection,
    validatedSha256: r3Composition.afterSha256,
    validationStatus: validation.validation.status,
    validationExitCode: validation.validation.exitCode,
    patchAttempt: patchProposal.patchAttempt,
    patchAttemptCeiling: contract.patchAttemptCeiling,
    nextPatchAttempt:
      correctionAvailable
        ? patchProposal.patchAttempt + 1
        : null,
    nextState: passed
      ? 'READY_FOR_G7_ANTI_REPLAY_QUALIFICATION'
      : correctionAvailable
        ? 'HUMAN_REVIEW_REQUIRED'
        : 'PATCH_ATTEMPT_BOUND_REACHED',
    automaticCorrection: false,
    reusableApproval: false,
    operationalAuthority: false,
    mutationAuthority: false,
    approvalAuthority: false,
    dispatchAuthority: false
  });

  return deepFreeze({
    ...binding,
    validationFingerprint: fingerprint(binding)
  });
}

module.exports = Object.freeze({
  RESULT_SCHEMA,
  runNaturalDevelopmentValidationLoop
});
