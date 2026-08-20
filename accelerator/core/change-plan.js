#!/usr/bin/env node

'use strict';

const crypto = require('crypto');

const MODES = new Set([
  'PATCH',
  'REFRACTOR'
]);

const RISKS = new Set([
  'BAIXO',
  'MÉDIO',
  'ALTO'
]);

function normalizeMode(value) {
  const mode = String(value || 'PATCH')
    .trim()
    .toUpperCase();

  if (!MODES.has(mode)) {
    throw new Error(`Invalid execution mode: ${value}`);
  }

  return mode;
}

function normalizeRisk(value) {
  const risk = String(value || 'BAIXO')
    .trim()
    .toUpperCase();

  if (!RISKS.has(risk)) {
    throw new Error(`Invalid risk level: ${value}`);
  }

  return risk;
}

function buildChangePlan({
  discovery,
  task,
  inspection,
  classification,
  execution = null
}) {
  if (!discovery || !discovery.repository) {
    throw new Error('Repository discovery is required.');
  }

  if (!task || !task.task) {
    throw new Error('Prepared task is required.');
  }

  if (!inspection || !inspection.inspection) {
    throw new Error('Declarative inspection is required.');
  }

  if (!classification || !classification.classification) {
    throw new Error('Risk classification is required.');
  }

  const mode = normalizeMode(
    classification.classification.mode
  );

  const risk = normalizeRisk(
    classification.classification.risk
  );

  const reasons = [];
  const blockers = [];

  const worktreeClean =
    discovery.worktree &&
    discovery.worktree.clean === true;

  const inspectionCompleted =
    inspection.governance &&
    inspection.governance.declarativeInspectionCompleted === true;

  const physicalValidationRequired =
    inspection.governance &&
    inspection.governance.physicalValidationRequired === true;

  const executionAllowedByTask =
    task.task.executionAllowed === true;

  const executionAllowedByRisk =
    classification.classification.executionAllowed === true;

  const explicitRefactorAuthorization =
    classification.governance &&
    classification.governance.explicitAuthorizationRequired === true;

  const explicitExecutionAuthorization =
    task.governance &&
    task.governance.explicitExecutionAuthorizationRequired === true;

  const grantEvaluation = execution && execution.grantEvaluation;
  const grant = grantEvaluation && grantEvaluation.grant;
  const target = grant && grant.scope && grant.scope.target;
  const replacementSha256 = execution &&
    (typeof execution.replacement === 'string' || Buffer.isBuffer(execution.replacement))
    ? crypto.createHash('sha256').update(execution.replacement).digest('hex') : null;
  const governedPatch = mode === 'PATCH' && risk === 'ALTO' && execution &&
    execution.adapter === 'FILESYSTEM_PATCH' && execution.action === 'PATCH_FILE' &&
    grantEvaluation &&
    grantEvaluation.schema === 'sdo.capability_grant_evaluation.v1' &&
    grantEvaluation.decision === 'ALLOWED' && grant && grant.riskLevel === 'R3' &&
    grant.capabilityType === 'FILESYSTEM_PATCH' && grant.operationId === execution.operationId &&
    grant.workspace === execution.workspace && grant.policyDecision === 'ALLOWED' &&
    grant.underlyingPolicyDecision === 'APPROVAL_REQUIRED' && target &&
    target.path === execution.target && /^[a-f0-9]{64}$/.test(target.beforeSha256 || '') &&
    target.replacementSha256 === replacementSha256 &&
    /^[a-f0-9]{64}$/.test(grant.approvalAuthorityFingerprint || '') &&
    /^[a-f0-9]{64}$/.test(grant.verifiedIdentityAssertionFingerprint || '') &&
    /^[a-f0-9]{64}$/.test(grant.identityVerificationEvidenceFingerprint || '');

  if (!worktreeClean) {
    blockers.push(
      'Target repository worktree is not clean.'
    );
  } else {
    reasons.push(
      'Target repository worktree is clean.'
    );
  }

  if (!inspectionCompleted) {
    blockers.push(
      'Declarative inspection has not been completed.'
    );
  } else {
    reasons.push(
      'Declarative inspection completed.'
    );
  }

  if (!physicalValidationRequired) {
    blockers.push(
      'Physical repository validation contract is missing.'
    );
  } else {
    reasons.push(
      'Physical repository validation is required and declared.'
    );
  }

  if (!explicitExecutionAuthorization) {
    blockers.push(
      'Task preparation does not declare explicit execution authorization.'
    );
  }

  if (!executionAllowedByTask) {
    blockers.push(
      'Task preparation does not authorize execution.'
    );
  } else {
    reasons.push(
      'Task preparation explicitly authorizes execution.'
    );
  }

  if (!executionAllowedByRisk) {
    blockers.push(
      'Risk classification does not authorize execution.'
    );
  } else {
    reasons.push(
      'Risk classification permits execution.'
    );
  }

  if (mode === 'REFRACTOR') {
    blockers.push(
      'REFRACTOR mode requires explicit architectural authorization.'
    );
  }

  if (risk === 'ALTO' && !governedPatch) {
    blockers.push(
      'HIGH risk tasks require explicit authorization before execution.'
    );
  }

  if (explicitRefactorAuthorization && mode !== 'REFRACTOR' && !governedPatch) {
    blockers.push(
      'Authorization state is inconsistent with the requested mode.'
    );
  }

  const authorized = blockers.length === 0;

  return {
    schema: 'sdo.change_plan.v1',

    decision: {
      status: authorized ? 'AUTHORIZED' : 'BLOCKED',
      executionAllowed: authorized,
      mode,
      risk
    },

    repository: {
      path: discovery.repository.path,
      name: discovery.repository.name,
      branch: discovery.repository.branch,
      commit: discovery.repository.commit,
      shortCommit: discovery.repository.shortCommit,
      worktreeClean
    },

    task: {
      description: task.task.description,
      mode: task.task.mode,
      risk: task.task.risk
    },

    mutation: governedPatch ? {
      operationId: execution.operationId,
      workspace: execution.workspace,
      adapter: 'FILESYSTEM_PATCH',
      action: 'PATCH_FILE',
      target: target.path,
      canonicalTarget: target.canonicalPath,
      beforeSha256: target.beforeSha256,
      replacementSha256: target.replacementSha256,
      approvalAuthorityFingerprint: grant.approvalAuthorityFingerprint,
      verifiedIdentityAssertionFingerprint: grant.verifiedIdentityAssertionFingerprint,
      identityVerificationEvidenceFingerprint: grant.identityVerificationEvidenceFingerprint,
      grantFingerprint: crypto.createHash('sha256')
        .update(JSON.stringify(grantEvaluation)).digest('hex')
    } : null,

    governance: {
      declarativeInspectionRequired: true,
      declarativeInspectionCompleted: inspectionCompleted,
      patchModeDefault: true,
      physicalRepositoryValidationRequired: true,
      explicitRefactorAuthorizationRequired:
        mode === 'REFRACTOR'
    },

    reasons,

    blockers,

    nextStep: authorized
      ? 'Proceed to controlled surgical execution.'
      : 'Do not execute changes. Resolve all blockers first.'
  };
}

function main() {
  console.error(
    'SDO CHANGE PLAN: library module; use buildChangePlan() from the Accelerator.'
  );
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildChangePlan
};
