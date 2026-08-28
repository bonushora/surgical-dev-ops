'use strict';

/*
 * G2 composes the authority-free development-task contract with the existing
 * governed read-only evidence loop. This module cannot authorize, mutate or
 * dispatch an operational effect outside that already-qualified read boundary.
 */

const {
  evaluateNaturalDevelopmentTaskBoundary
} = require('./natural-development-task-contract');

const {
  runNaturalRecursiveEvidenceLoop
} = require('./natural-recursive-evidence-loop');

const RESULT_SCHEMA =
  'sdo.natural_development_planning_loop.v1';

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

function result(contract, analysis) {
  return deepFreeze({
    schema: RESULT_SCHEMA,
    status:
      analysis.status === 'HUMAN_AUTHORITY_REQUIRED'
        ? 'STOPPED'
        : analysis.status,
    contractFingerprint:
      contract.contractFingerprint,
    analysis,
    evidence:
      analysis.evidence,
    response:
      analysis.response,
    reason:
      analysis.reason,
    pendingRequest:
      analysis.pendingRequest,
    requiresNewHumanAuthority:
      analysis.status === 'HUMAN_AUTHORITY_REQUIRED',
    reusableApproval: false,
    operationalAuthority: false,
    mutationAuthority: false,
    approvalAuthority: false,
    dispatchAuthority: false
  });
}

function immutableTask(contract) {
  return deepFreeze({
    schema: 'sdo.natural_governed_task.v1',
    kind: 'PROJECT_ANALYSIS',
    objective: contract.objective,
    mutating: false,
    operations: []
  });
}

function policyDecision(decision, reason) {
  return Object.freeze({
    decision,
    reason,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function validateContractAndAnchors(
  contract,
  physicalWorkspaceIdentity,
  repositoryHead
) {
  if (
    !contract ||
    !Array.isArray(contract.allowedTargets) ||
    contract.allowedTargets.length === 0
  ) {
    throw new Error(
      'Canonical natural development task contract is required.'
    );
  }

  const validation =
    evaluateNaturalDevelopmentTaskBoundary(
      contract,
      Object.freeze({
        physicalWorkspaceIdentity,
        repositoryHead,
        target: contract.allowedTargets[0],
        risk: 'R0',
        validationKind: null,
        evidenceStep: 1,
        patchAttempt: 0,
        mutating: false,
        credentialUse: false,
        externalSideEffect: false,
        architecturalDecision: false,
        genericShell: false,
        conflictOrRecoveryRequired: false
      })
    );

  if (validation.decision !== 'CONTAINED') {
    throw new Error(
      `Development planning anchor is not contained: ${validation.stopCondition}.`
    );
  }
}

function createEvidencePolicy(
  contract,
  physicalWorkspaceIdentity,
  repositoryHead
) {
  return function evaluateEvidenceIntent(
    intent,
    request,
    evidenceStep
  ) {
    if (
      !intent ||
      !request ||
      request.kind === 'WORKSPACE_FILES'
    ) {
      if (
        intent &&
        request &&
        request.kind === 'WORKSPACE_FILES' &&
        intent.capabilityType === 'GIT_READ' &&
        intent.target === 'workspace-files' &&
        evidenceStep <= contract.evidenceStepCeiling
      ) {
        return policyDecision(
          'CONTAINED',
          'Repository inventory remains read-only and workspace-bound.'
        );
      }

      return policyDecision(
        'STOPPED',
        'Malformed or out-of-bound development evidence request.'
      );
    }

    const validationKind =
      intent.capabilityType === 'PROCESS_VALIDATION'
        ? 'VALIDATE_JS'
        : null;

    const boundary =
      evaluateNaturalDevelopmentTaskBoundary(
        contract,
        Object.freeze({
          physicalWorkspaceIdentity,
          repositoryHead,
          target: intent.target,
          risk:
            validationKind === 'VALIDATE_JS'
              ? 'R1'
              : 'R0',
          validationKind,
          evidenceStep,
          patchAttempt: 0,
          mutating: false,
          credentialUse: false,
          externalSideEffect: false,
          architecturalDecision: false,
          genericShell: false,
          conflictOrRecoveryRequired: false
        })
      );

    return policyDecision(
      boundary.decision,
      boundary.reason
    );
  };
}

async function runNaturalDevelopmentPlanningLoop({
  contract,
  physicalWorkspaceIdentity,
  repositoryHead,
  activation,
  cognitiveSession,
  dispatchEvidence,
  onProgress = null
} = {}) {
  validateContractAndAnchors(
    contract,
    physicalWorkspaceIdentity,
    repositoryHead
  );

  if (
    !activation ||
    typeof activation !== 'object' ||
    typeof activation.repositoryPath !== 'string' ||
    !activation.repositoryPath
  ) {
    throw new Error(
      'Canonical development repository activation is required.'
    );
  }

  const analysis =
    await runNaturalRecursiveEvidenceLoop({
      task: immutableTask(contract),
      activation,
      cognitiveSession,
      ...(dispatchEvidence
        ? { dispatchEvidence }
        : {}),
      ...(onProgress
        ? { onProgress }
        : {}),
      evaluateEvidenceIntent:
        createEvidencePolicy(
          contract,
          physicalWorkspaceIdentity,
          repositoryHead
        ),
      deterministicProjectGrounding: false
    });

  return result(contract, analysis);
}

module.exports = Object.freeze({
  RESULT_SCHEMA,
  runNaturalDevelopmentPlanningLoop
});
