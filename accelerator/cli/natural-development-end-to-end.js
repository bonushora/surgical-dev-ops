'use strict';

/*
 * Canonical G3-G10 application boundary.
 *
 * G1 and G2 produce the immutable contract and planning result. This module
 * composes the remaining already-qualified stages in their only permitted
 * order. It does not interpret human language, fabricate identity, persist a
 * provider credential, or expose a generic execution surface.
 */

const {
  materializeNaturalDevelopmentPatchProposal
} = require('./natural-development-patch-proposal');

const {
  materializeNaturalDevelopmentPatchAuthorization
} = require('./natural-development-patch-authorization');

const {
  composeAndDispatchNaturalDevelopmentPatch
} = require('./natural-development-r3-composition');

const {
  runNaturalDevelopmentValidationLoop
} = require('./natural-development-validation-loop');

const RESULT_SCHEMA =
  'sdo.natural_development_end_to_end_result.v1';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function createNaturalDevelopmentEndToEndBoundary({
  materializeProposal = materializeNaturalDevelopmentPatchProposal,
  materializeAuthorization =
    materializeNaturalDevelopmentPatchAuthorization,
  dispatchPatch = composeAndDispatchNaturalDevelopmentPatch,
  validatePatch = runNaturalDevelopmentValidationLoop
} = {}) {
  for (const [name, implementation] of Object.entries({
    materializeProposal,
    materializeAuthorization,
    dispatchPatch,
    validatePatch
  })) {
    if (typeof implementation !== 'function') {
      throw new Error(`Qualified ${name} boundary is required.`);
    }
  }

  async function execute({
    contract,
    planningResult,
    governedProposal,
    patchAttempt = 1,
    humanDecision,
    verifiedHumanIdentityAssertion,
    temporalAuthority,
    physicalWorkspaceIdentity,
    repositoryPath,
    authorityRoot,
    journalStorageRoot,
    tenantId = null,
    projectId = null
  } = {}) {
    const patchProposal = await materializeProposal({
      contract,
      planningResult,
      governedProposal,
      patchAttempt
    });

    const patchAuthorization = await materializeAuthorization({
      patchProposal,
      humanDecision,
      verifiedHumanIdentityAssertion,
      temporalAuthority
    });

    const r3Composition = await dispatchPatch({
      contract,
      patchProposal,
      patchAuthorization,
      physicalWorkspaceIdentity,
      repositoryPath,
      authorityRoot,
      journalStorageRoot,
      tenantId,
      projectId
    });

    const validation = await validatePatch({
      contract,
      patchProposal,
      r3Composition
    });

    const status =
      validation.status === 'VALIDATED'
        ? 'COMPLETED'
        : validation.status;

    return deepFreeze({
      schema: RESULT_SCHEMA,
      status,
      contractFingerprint: contract.contractFingerprint,
      planningFingerprint: planningResult.planningFingerprint,
      proposalFingerprint: patchProposal.proposalFingerprint,
      authorizationFingerprint:
        patchAuthorization.authorizationFingerprint,
      compositionFingerprint: r3Composition.compositionFingerprint,
      validationFingerprint: validation.validationFingerprint,
      target: patchProposal.target,
      beforeSha256: patchProposal.beforeSha256,
      afterSha256: patchProposal.replacementSha256,
      transactionId: r3Composition.transactionId,
      journalId: r3Composition.journalId,
      afterManifestOid: r3Composition.afterManifestOid,
      patchAttempt: patchProposal.patchAttempt,
      validation,
      reusableApproval: false,
      operationalAuthority: false,
      mutationAuthority: false,
      approvalAuthority: false,
      dispatchAuthority: false
    });
  }

  return Object.freeze({ execute });
}

module.exports = Object.freeze({
  RESULT_SCHEMA,
  createNaturalDevelopmentEndToEndBoundary
});
