'use strict';

/*
 * G3 materializes one exact full-file replacement proposal from a completed G2
 * planning result. It creates review data only and owns no approval, grant,
 * filesystem, process, mutation or dispatch authority.
 */

const crypto = require('node:crypto');

const {
  evaluateNaturalDevelopmentTaskBoundary
} = require('./natural-development-task-contract');

const PROPOSAL_SCHEMA =
  'sdo.natural_development_patch_proposal.v1';

const DIFF_SCHEMA =
  'sdo.natural_development_exact_diff.v1';

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

function validatePlanningResult(contract, planningResult) {
  if (
    !planningResult ||
    planningResult.schema !==
      'sdo.natural_development_planning_loop.v1' ||
    planningResult.status !== 'COMPLETED' ||
    planningResult.contractFingerprint !==
      contract.contractFingerprint ||
    !Object.isFrozen(planningResult) ||
    !Array.isArray(planningResult.evidence) ||
    !Object.isFrozen(planningResult.evidence)
  ) {
    throw new Error(
      'Completed immutable G2 planning result is required.'
    );
  }

  const {
    planningFingerprint,
    ...binding
  } = planningResult;

  if (
    !/^[a-f0-9]{64}$/.test(planningFingerprint) ||
    fingerprint(binding) !== planningFingerprint
  ) {
    throw new Error(
      'G2 planning-result binding is malformed.'
    );
  }
}

function validateGovernedProposal(proposal) {
  if (
    !proposal ||
    proposal.schema !==
      'sdo.governed_engineering_proposal.v1' ||
    !Object.isFrozen(proposal) ||
    proposal.operationalAuthority !== false ||
    proposal.mutationAuthority !== false ||
    proposal.approvalAuthority !== false ||
    typeof proposal.replacementBase64 !== 'string' ||
    typeof proposal.replacementBytes !== 'number' ||
    !/^[a-f0-9]{64}$/.test(proposal.replacementSha256)
  ) {
    throw new Error(
      'Immutable authority-free governed engineering proposal is required.'
    );
  }

  const replacement = Buffer.from(
    proposal.replacementBase64,
    'base64'
  );

  if (
    replacement.length === 0 ||
    replacement.toString('base64') !==
      proposal.replacementBase64 ||
    replacement.length !== proposal.replacementBytes ||
    crypto
      .createHash('sha256')
      .update(replacement)
      .digest('hex') !== proposal.replacementSha256
  ) {
    throw new Error(
      'Governed engineering replacement binding is malformed.'
    );
  }
}

function materializeNaturalDevelopmentPatchProposal({
  contract,
  planningResult,
  governedProposal,
  patchAttempt = 1
} = {}) {
  validatePlanningResult(contract, planningResult);
  validateGovernedProposal(governedProposal);

  if (governedProposal.objective !== contract.objective) {
    throw new Error(
      'Patch objective differs from the development contract.'
    );
  }

  const beforeEvidence = planningResult.evidence.find(
    (item) =>
      item &&
      item.kind === 'READ_FILE' &&
      item.target === governedProposal.target &&
      item.sha256 === governedProposal.beforeSha256 &&
      Number.isInteger(item.bytes) &&
      item.bytes >= 0
  );

  if (!beforeEvidence) {
    throw new Error(
      'Patch proposal is not bound to exact governed BEFORE evidence.'
    );
  }

  if (
    governedProposal.beforeSha256 ===
      governedProposal.replacementSha256
  ) {
    throw new Error(
      'No-op replacement cannot become a development patch proposal.'
    );
  }

  const boundary = evaluateNaturalDevelopmentTaskBoundary(
    contract,
    Object.freeze({
      physicalWorkspaceIdentity:
        contract.physicalWorkspaceIdentity,
      repositoryHead:
        contract.repositoryHead,
      target:
        governedProposal.target,
      risk: 'R3',
      validationKind:
        governedProposal.validationKind === 'NONE'
          ? null
          : governedProposal.validationKind,
      evidenceStep: 1,
      patchAttempt,
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
      `Patch proposal exceeds the development contract: ${boundary.stopCondition}.`
    );
  }

  const exactDiffBinding = deepFreeze({
    schema: DIFF_SCHEMA,
    representation: 'FULL_FILE_REPLACEMENT',
    target: governedProposal.target,
    before: {
      sha256: governedProposal.beforeSha256,
      bytes: beforeEvidence.bytes
    },
    after: {
      sha256: governedProposal.replacementSha256,
      bytes: governedProposal.replacementBytes
    },
    contentChanged: true
  });

  const exactDiff = deepFreeze({
    ...exactDiffBinding,
    diffFingerprint: fingerprint(exactDiffBinding)
  });

  const binding = deepFreeze({
    schema: PROPOSAL_SCHEMA,
    contractFingerprint:
      contract.contractFingerprint,
    planningFingerprint:
      planningResult.planningFingerprint,
    objective: governedProposal.objective,
    target: governedProposal.target,
    beforeSha256: governedProposal.beforeSha256,
    replacementBase64: governedProposal.replacementBase64,
    replacementBytes: governedProposal.replacementBytes,
    replacementSha256: governedProposal.replacementSha256,
    reason: governedProposal.reason,
    validationKind: governedProposal.validationKind,
    patchAttempt,
    exactDiff,
    state: 'HUMAN_REVIEW_REQUIRED',
    requiresExactR3Authority: true,
    reusableApproval: false,
    operationalAuthority: false,
    mutationAuthority: false,
    approvalAuthority: false,
    dispatchAuthority: false
  });

  return deepFreeze({
    ...binding,
    proposalFingerprint: fingerprint(binding)
  });
}

module.exports = Object.freeze({
  PROPOSAL_SCHEMA,
  DIFF_SCHEMA,
  materializeNaturalDevelopmentPatchProposal
});
