#!/usr/bin/env node

'use strict';

const crypto = require('crypto');
const path = require('path');

const repositoryDiscovery = require('./repository-discovery');

const {
  prepareTask
} = require('./task-preparation');

const declarativeInspection = require('./declarative-inspection');

const {
  classifyScope,
  evaluateR3ApprovalAuthority
} = require('./risk-classification');

const {
  buildChangePlan
} = require('./change-plan');

const {
  createStateBoundary,
  assertTransition,
  transitionLifecycle
} = require('./state-boundary');
const {
  appendAdapterEvidence,
  finalizeOperationRecord
} = require('./operation-record');
const filesystemReadAdapter = require('../adapters/filesystem-read-adapter');
const gitReadAdapter = require('../adapters/git-read-adapter');
const processValidationAdapter = require('../adapters/process-validation-adapter');
const filesystemPatchAdapter = require('../adapters/filesystem-patch-adapter');
const identityVerificationAdapter = require('../adapters/identity-verification-adapter');

const CONTROLLED_ACTIONS = Object.freeze({
  FILESYSTEM_READ: Object.freeze({
    actions: new Set(['READ_FILE']), capabilityType: 'FILESYSTEM_READ'
  }),
  GIT_READ: Object.freeze({
    actions: new Set([
      'REPOSITORY_ROOT', 'CURRENT_BRANCH', 'HEAD_COMMIT',
      'WORKTREE_STATUS', 'TRACKED_FILES'
    ]),
    capabilityType: 'GIT_READ'
  }),
  PROCESS_VALIDATION: Object.freeze({
    actions: new Set(['NODE_SYNTAX_CHECK']), capabilityType: 'PROCESS_VALIDATION'
  }),
  FILESYSTEM_PATCH: Object.freeze({
    actions: new Set(['PATCH_FILE']), capabilityType: 'FILESYSTEM_PATCH'
  })
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isDeepFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  seen.add(value);
  return Object.values(value).every((child) => isDeepFrozen(child, seen));
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function replacementDigest(request) {
  if (!request || request.adapter !== 'FILESYSTEM_PATCH') return null;
  if (!(typeof request.replacement === 'string' || Buffer.isBuffer(request.replacement))) {
    throw new Error('Filesystem-patch replacement must be structured bytes.');
  }
  return crypto.createHash('sha256').update(request.replacement).digest('hex');
}

function executionDenial(reason) {
  return Object.freeze({
    schema: 'sdo.execution_denial.v1', decision: 'DENIED', reason
  });
}

function deniedAtBoundary(reason) {
  const execution = executionDenial(reason);
  return Object.freeze({
    schema: 'sdo.orchestration.v1',
    orchestration: Object.freeze({
      status: 'DENIED', executionAttempted: false, executionAllowed: false
    }),
    execution,
    state: Object.freeze({ status: 'NOT_EXECUTABLE' }),
    nextStep: reason
  });
}

function rejectUnsafeRequestShape(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const forbidden = ['command', 'args', 'executable'];
  if (forbidden.some((key) => Object.prototype.hasOwnProperty.call(input, key))) {
    return deniedAtBoundary('Legacy generic executable, command and arguments are denied.');
  }
  if (Object.prototype.hasOwnProperty.call(input, 'executionMode') ||
      Object.prototype.hasOwnProperty.call(input, 'executionAction')) {
    return deniedAtBoundary('Legacy execution mode or action is denied.');
  }
  if (!Object.prototype.hasOwnProperty.call(input, 'execution')) return null;
  const request = input.execution;
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return deniedAtBoundary('Unknown or malformed controlled adapter/action.');
  }
  const contract = CONTROLLED_ACTIONS[request.adapter];
  if (!contract || !contract.actions.has(request.action)) {
    return deniedAtBoundary('Unknown controlled adapter or action.');
  }
  if (['command', 'args', 'executable'].some(
    (key) => Object.prototype.hasOwnProperty.call(request, key)
  )) {
    return deniedAtBoundary('Generic execution fields are forbidden in controlled requests.');
  }
  if (Object.prototype.hasOwnProperty.call(request, 'grantFingerprint')) {
    return deniedAtBoundary('Caller-supplied grant fingerprints are forbidden.');
  }
  return null;
}

function validateControlledRequest(request, repositoryPath, expectedRisk, runtime = {}) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return executionDenial('Missing or malformed capability context.');
  }
  const contract = CONTROLLED_ACTIONS[request.adapter];
  if (!contract || !contract.actions.has(request.action)) {
    return executionDenial('Unknown controlled adapter or action.');
  }
  const evaluation = request.grantEvaluation;
  const grant = evaluation && evaluation.grant;
  if (!evaluation || evaluation.schema !== 'sdo.capability_grant_evaluation.v1' ||
      evaluation.decision !== 'ALLOWED' || !grant ||
      !isDeepFrozen(evaluation)) {
    return executionDenial('Missing or malformed capability context.');
  }
  if (request.operationId !== grant.operationId) {
    return executionDenial('Capability operationId mismatch.');
  }
  if (request.workspace !== repositoryPath || grant.workspace !== repositoryPath) {
    return executionDenial('Capability workspace mismatch.');
  }
  const observed = Date.parse(request.observedAt);
  const expires = Date.parse(grant.expiresAt);
  if (!Number.isFinite(observed) || !Number.isFinite(expires) || observed >= expires) {
    return executionDenial('Capability grant is stale or expired.');
  }
  if (grant.policyDecision !== 'ALLOWED' || !/^R[0-3]$/.test(grant.riskLevel) ||
      grant.lifecycleState !== 'PENDING' || grant.idempotency !== 'IDEMPOTENT') {
    return executionDenial('Capability policy, risk or lifecycle state is invalid.');
  }
  if (expectedRisk && grant.riskLevel !== expectedRisk) {
    return executionDenial('Capability risk does not match authorized orchestration risk.');
  }
  if (request.adapter === 'FILESYSTEM_PATCH' && grant.riskLevel !== 'R3') {
    return executionDenial('FILESYSTEM_PATCH requires R3 authenticated human authority.');
  }
  if (grant.capabilityType !== contract.capabilityType) {
    return executionDenial('Capability scope or type mismatch.');
  }
  if (request.adapter === 'FILESYSTEM_READ') {
    const paths = grant.scope && grant.scope.paths;
    if (!Array.isArray(paths) || !paths.some((entry) => entry.path === request.target)) {
      return executionDenial('Capability scope mismatch.');
    }
  } else if (request.adapter === 'GIT_READ') {
    const operations = grant.scope && grant.scope.operations;
    const operation = {
      REPOSITORY_ROOT: 'rev-parse', CURRENT_BRANCH: 'rev-parse',
      HEAD_COMMIT: 'rev-parse', WORKTREE_STATUS: 'status', TRACKED_FILES: 'ls-files'
    }[request.action];
    if (!Array.isArray(operations) || !operations.includes(operation)) {
      return executionDenial('Capability scope mismatch.');
    }
  } else if (request.adapter === 'PROCESS_VALIDATION') {
    const paths = grant.scope && grant.scope.paths;
    const selectors = grant.scope && grant.scope.selectors;
    if (!Array.isArray(paths) || !paths.some((entry) => entry.path === request.target) ||
        !Array.isArray(selectors) || !selectors.includes(request.action)) {
      return executionDenial('Capability scope mismatch.');
    }
  } else if (request.adapter === 'FILESYSTEM_PATCH') {
    const target = grant.scope && grant.scope.target;
    if (!target || target.path !== request.target || !target.beforeSha256 ||
        target.replacementSha256 !== replacementDigest(request)) {
      return executionDenial('Capability scope mismatch.');
    }
  }
  const operationRecord = request.operationRecord;
  const r3Patch = request.adapter === 'FILESYSTEM_PATCH' && grant.riskLevel === 'R3';
  const recordPolicyMatches = r3Patch
    ? operationRecord && operationRecord.policyDecision === 'APPROVAL_REQUIRED'
    : operationRecord && operationRecord.policyDecision === grant.policyDecision;
  if (!operationRecord || operationRecord.schema !== 'sdo.operation_record.v1' ||
      !isDeepFrozen(operationRecord) || operationRecord.operationId !== request.operationId ||
      operationRecord.workspace !== repositoryPath ||
      !recordPolicyMatches ||
      operationRecord.riskLevel !== grant.riskLevel) {
    return executionDenial('Operation record binding is missing or mismatched.');
  }
  if (r3Patch) {
    const approval = evaluateR3ApprovalAuthority(operationRecord.approvalAuthority, {
      operationId: request.operationId, workspace: repositoryPath,
      capabilityType: 'FILESYSTEM_PATCH', action: 'PATCH_FILE',
      scope: operationRecord.scope,
      riskLevel: 'R3', policyDecision: 'APPROVAL_REQUIRED',
      tenantId: operationRecord.tenantId, projectId: operationRecord.projectId,
      observedAt: request.observedAt
    });
    const identityVerification = identityVerificationAdapter.verifyHumanIdentityAssertion({
      rawAssertion: request.rawIdentityAssertion,
      trustedIssuers: runtime.trustedIdentityIssuers,
      expected: {
        subjectId: operationRecord.approvalAuthority.approver.id,
        audience: runtime.identityAudience,
        operationId: request.operationId,
        workspace: repositoryPath,
        tenantId: operationRecord.tenantId,
        projectId: operationRecord.projectId,
        fingerprint: operationRecord.verifiedIdentityAssertionFingerprint,
        observedAt: request.observedAt
      }
    }, runtime.identityVerifierPort);
    if (approval.decision !== 'ALLOWED' || identityVerification.decision !== 'VERIFIED' ||
        approval.authority.fingerprint !== grant.approvalAuthorityFingerprint ||
        approval.authority.approvalAuthorityId !== grant.approvalAuthorityId ||
        approval.authority.verifiedIdentityAssertionFingerprint !==
          grant.verifiedIdentityAssertionFingerprint ||
        operationRecord.verifiedIdentityAssertionFingerprint !==
          grant.verifiedIdentityAssertionFingerprint ||
        identityVerification.evidence.fingerprint !==
          grant.identityVerificationEvidenceFingerprint ||
        operationRecord.identityVerificationEvidenceFingerprint !==
          grant.identityVerificationEvidenceFingerprint ||
        request.tenantId !== operationRecord.tenantId ||
        request.projectId !== operationRecord.projectId) {
      return executionDenial('R3 approval authority is missing or mismatched.');
    }
  }
  const lifecycle = request.lifecycle;
  if (!lifecycle || lifecycle.schema !== 'sdo.lifecycle.v1' ||
      !isDeepFrozen(lifecycle) || lifecycle.operationId !== request.operationId ||
      !['PENDING', 'COMPLETED', 'FAILED'].includes(lifecycle.status) ||
      !lifecycle.evidence || !lifecycle.evidence.before ||
      lifecycle.evidence.before.path !== repositoryPath ||
      !lifecycle.temporal || Date.parse(request.observedAt) < Date.parse(lifecycle.temporal.createdAt)) {
    return executionDenial('Lifecycle binding is missing or invalid.');
  }
  if (operationRecord.finalization === null && lifecycle.status !== 'PENDING') {
    return executionDenial('Lifecycle state does not permit dispatch.');
  }
  return {
    contract,
    grantFingerprint: fingerprint(evaluation),
    operationRecord,
    lifecycle
  };
}

function physicalEvidence(discovery) {
  return {
    path: discovery.repository.path,
    branch: discovery.repository.branch,
    commit: discovery.repository.commit,
    shortCommit: discovery.repository.shortCommit,
    clean: discovery.worktree.clean,
    changedFiles: discovery.worktree.changedFiles
  };
}

function evidenceIdentity(request, grantFingerprint) {
  return fingerprint({
    operationId: request.operationId,
    adapter: request.adapter,
    action: request.action,
    target: request.target || null,
    ...(request.adapter === 'FILESYSTEM_PATCH' ? {
      beforeSha256: request.grantEvaluation && request.grantEvaluation.grant &&
        request.grantEvaluation.grant.scope && request.grantEvaluation.grant.scope.target
        ? request.grantEvaluation.grant.scope.target.beforeSha256 : null,
      replacementSha256: replacementDigest(request),
      approvalAuthorityFingerprint:
        request.grantEvaluation.grant.approvalAuthorityFingerprint || null,
      verifiedIdentityAssertionFingerprint:
        request.grantEvaluation.grant.verifiedIdentityAssertionFingerprint || null
    } : {}),
    grantFingerprint
  });
}

function preserveControlledErrorEvidence(error, request) {
  if (!error || !error.evidence) return null;
  const evidence = error.evidence;
  if (!isDeepFrozen(evidence) || evidence.operationId !== request.operationId ||
      evidence.workspace !== request.workspace) {
    throw new Error('Controlled adapter error evidence is mutable or unbound.');
  }
  return deepFreeze({
    operationId: request.operationId,
    workspace: request.workspace,
    adapterType: request.adapter,
    action: request.action,
    outcome: 'FAILED',
    timestamp: request.observedAt,
    payload: evidence
  });
}

function invokeControlledAdapter(request) {
  const common = {
    operationId: request.operationId,
    workspace: request.workspace,
    grantEvaluation: request.grantEvaluation,
    observedAt: request.observedAt
  };
  if (request.adapter === 'FILESYSTEM_READ') {
    return filesystemReadAdapter.readFileWithGrant({ ...common, target: request.target });
  }
  if (request.adapter === 'GIT_READ') {
    return gitReadAdapter.readGitWithGrant({ ...common, selector: request.action });
  }
  if (request.adapter === 'FILESYSTEM_PATCH') {
    return filesystemPatchAdapter.patchFileWithGrant({
      ...common, target: request.target, replacement: request.replacement
    });
  }
  return processValidationAdapter.validateJavaScriptWithGrant({
    ...common, selector: request.action, target: request.target
  });
}

function validateAdapterResult(request, result) {
  const schemas = {
    FILESYSTEM_READ: 'sdo.filesystem_read_result.v1',
    GIT_READ: 'sdo.git_read_result.v1',
    PROCESS_VALIDATION: 'sdo.process_validation_result.v1',
    FILESYSTEM_PATCH: 'sdo.filesystem_patch_result.v1'
  };
  if (!result || result.schema !== schemas[request.adapter] || !isDeepFrozen(result) ||
      result.operationId !== request.operationId || result.workspace !== request.workspace ||
      result.observedAt !== request.observedAt) {
    throw new Error('Controlled adapter returned malformed or unbound evidence.');
  }
  if (request.adapter === 'GIT_READ' && result.selector !== request.action) {
    throw new Error('Controlled Git evidence action mismatch.');
  }
  if (request.adapter === 'FILESYSTEM_PATCH' &&
      (!result.target || result.target.requested !== request.target ||
       result.target.canonical !== request.grantEvaluation.grant.scope.target.canonicalPath ||
       result.beforeSha256 !== request.grantEvaluation.grant.scope.target.beforeSha256 ||
       result.afterSha256 !== request.grantEvaluation.grant.scope.target.replacementSha256 ||
       !['APPLIED', 'ALREADY_APPLIED'].includes(result.outcome) ||
       result.recovery !== 'NOT_REQUIRED')) {
    throw new Error('Controlled filesystem-patch evidence is inconsistent.');
  }
  if (request.adapter === 'PROCESS_VALIDATION' &&
      (result.selector !== request.action || !result.validation ||
       !['PASSED', 'FAILED'].includes(result.validation.status) ||
       (result.validation.status === 'FAILED' &&
        result.validation.successfulCompletionEligible !== false))) {
    throw new Error('Controlled validation evidence is inconsistent.');
  }
  return result;
}

function validateInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Orchestrator input must be an object.');
  }

  if (
    typeof input.repositoryPath !== 'string' ||
    !input.repositoryPath.trim()
  ) {
    throw new Error('repositoryPath is required.');
  }

  if (
    typeof input.description !== 'string' ||
    !input.description.trim()
  ) {
    throw new Error('Task description is required.');
  }

  if (!Array.isArray(input.files) || input.files.length === 0) {
    throw new Error('At least one target file is required.');
  }
}

function orchestrate(input, runtime = {}) {
  const boundaryDenial = rejectUnsafeRequestShape(input);
  if (boundaryDenial) return boundaryDenial;

  validateInput(input);

  const repositoryPath = path.resolve(
    input.repositoryPath
  );

  /*
   * PHASE 1
   * Physical repository discovery.
   */
  const discovery = repositoryDiscovery.discover(
    repositoryPath
  );

  /*
   * PHASE 2
   * Deterministic task preparation.
   */
  const task = prepareTask(
    input.description,
    {
      mode: input.mode || 'PATCH',
      risk: input.risk || 'BAIXO',
      authorizeExecution:
        input.authorizeExecution === true
    }
  );

  /*
   * PHASE 3
   * Declarative inspection.
   */
  const inspection = declarativeInspection.inspect(
    repositoryPath,
    {
      files: input.files,
      hypothesis:
        input.hypothesis ||
        'Inspecionar fisicamente o escopo antes de qualquer alteração.',
      objective:
        input.objective ||
        'Validar o estado real dos arquivos envolvidos antes da execução.',
      diffEstimate:
        input.diffEstimate ||
        'Não estimado',
      risk:
        task.task.risk,
      mode:
        task.task.mode
    }
  );

  const preAuthorizationPreflight = Object.freeze({
    classification: 'PRE_AUTHORIZATION_PREFLIGHT',
    governedAdapterEvidence: false,
    capabilityAuthorization: false,
    proofOfGovernedExecution: false
  });

  if (input.execution && input.execution.adapter === 'FILESYSTEM_PATCH' &&
      input.execution.operationRecord &&
      input.execution.operationRecord.finalization !== null) {
    const replayValidation = validateControlledRequest(
      input.execution, discovery.repository.path, 'R3', runtime
    );
    if (replayValidation.decision === 'DENIED') {
      return {
        schema: 'sdo.orchestration.v1',
        orchestration: { status: 'DENIED', executionAttempted: false, executionAllowed: false },
        repository: discovery.repository, worktree: discovery.worktree,
        pipeline: { preAuthorizationPreflight, discovery, task, inspection },
        execution: replayValidation, nextStep: replayValidation.reason
      };
    }
    const replayId = evidenceIdentity(input.execution, replayValidation.grantFingerprint);
    const prior = replayValidation.operationRecord.adapterEvidence.find(
      (entry) => entry.adapterType === 'FILESYSTEM_PATCH' && entry.action === 'PATCH_FILE'
    );
    const completed = prior && prior.evidenceId === replayId &&
      prior.grantFingerprint === replayValidation.grantFingerprint &&
      replayValidation.operationRecord.finalization.lifecycleState === 'COMPLETED' &&
      replayValidation.lifecycle.status === 'COMPLETED';
    if (!completed) {
      const denial = executionDenial('Conflicting finalized filesystem-patch replay.');
      return {
        schema: 'sdo.orchestration.v1',
        orchestration: { status: 'DENIED', executionAttempted: false, executionAllowed: false },
        repository: discovery.repository, worktree: discovery.worktree,
        pipeline: { preAuthorizationPreflight, discovery, task, inspection },
        execution: denial, nextStep: denial.reason
      };
    }
    return {
      schema: 'sdo.orchestration.v1',
      orchestration: { status: 'COMPLETED', executionAttempted: false, executionAllowed: true },
      repository: discovery.repository, worktree: discovery.worktree,
      pipeline: { preAuthorizationPreflight, discovery, task, inspection },
      execution: prior.payload,
      governed: { operationRecord: replayValidation.operationRecord,
        lifecycle: replayValidation.lifecycle, replay: true },
      nextStep: 'Identical governed filesystem-patch evidence replayed without physical mutation.'
    };
  }

  /*
   * PHASE 4
   * Risk classification.
   */
  const classification = classifyScope({
    files: inspection.inspection.files,
    mode: task.task.mode,
    risk: task.task.risk,
    estimatedDiffLines:
      Number(input.estimatedDiffLines || 0),
    architecturalChange:
      input.architecturalChange === true,
    worktreeClean:
      discovery.worktree.clean,
    facts: input.facts || {
      readOnly: false,
      externalEffect: false,
      reversible: true,
      sensitive: false,
      critical: false,
      irreversible: false
    },
    policy: input.policy || {
      decision: input.authorizeExecution === true ? 'ALLOW' : 'DENY'
    },
    operationId: input.execution && input.execution.operationId,
    workspace: discovery.repository.path,
    capabilityType: input.execution && input.execution.adapter,
    action: input.execution && input.execution.action,
    scope: input.execution && input.execution.operationRecord &&
      input.execution.operationRecord.scope,
    tenantId: input.execution && input.execution.tenantId,
    projectId: input.execution && input.execution.projectId,
    observedAt: input.execution && input.execution.observedAt
  });

  /*
   * PHASE 5
   * Change authorization.
   */
  const changePlan = buildChangePlan({
    discovery,
    task,
    inspection,
    classification,
    execution: input.execution || null
  });

  /*
   * Deterministic gate.
   *
   * Nothing may reach the executor unless the
   * change plan is explicitly AUTHORIZED.
   */
  if (!changePlan.decision.executionAllowed) {
    const patchDenied = input.execution && input.execution.adapter === 'FILESYSTEM_PATCH';
    return {
      schema: 'sdo.orchestration.v1',

      orchestration: {
        status: patchDenied ? 'DENIED' : 'BLOCKED',
        executionAttempted: false,
        executionAllowed: false
      },

      repository: discovery.repository,

      worktree: discovery.worktree,

      pipeline: {
        preAuthorizationPreflight,
        discovery,
        task,
        inspection,
        classification,
        changePlan
      },

      execution: patchDenied
        ? executionDenial('FILESYSTEM_PATCH authority or exact mutation plan is invalid.')
        : null,

      nextStep:
        changePlan.nextStep
    };
  }

  /*
   * PHASE 6
   * Immutable state boundary before mutation.
   *
   * No execution may occur without a physical
   * before-state snapshot.
   */
  const stateBoundary = createStateBoundary({
    before: {
      path: discovery.repository.path,
      branch: discovery.repository.branch,
      commit: discovery.repository.commit,
      shortCommit: discovery.repository.shortCommit,
      clean: discovery.worktree.clean,
      changedFiles: discovery.worktree.changedFiles
    },

    operation: {
      description: task.task.description,
      mode: changePlan.decision.mode,
      risk: changePlan.decision.risk,
      authorizationStatus:
        changePlan.decision.status
    }
  });

  const pendingTransition =
    assertTransition(stateBoundary);

  const controlledRequested =
    Object.prototype.hasOwnProperty.call(input, 'execution');

  if (!controlledRequested) {
    return {
      schema: 'sdo.orchestration.v1',

      orchestration: {
        status: 'AUTHORIZED',
        executionAttempted: false,
        executionAllowed: true
      },

      repository: discovery.repository,

      worktree: discovery.worktree,

      pipeline: {
        preAuthorizationPreflight,
        discovery,
        task,
        inspection,
        classification,
        changePlan
      },

      execution: null,

      state: {
        boundary: stateBoundary,
        transition: pendingTransition
      },

      nextStep:
        'Provide an explicit controlled-adapter capability request.'
    };
  }

  const request = input.execution;
  const validation = validateControlledRequest(
    request, discovery.repository.path, classification.classification.level, runtime
  );

  if (validation.decision === 'DENIED') {
    return {
      schema: 'sdo.orchestration.v1',
      orchestration: { status: 'DENIED', executionAttempted: false, executionAllowed: false },
      repository: discovery.repository,
      worktree: discovery.worktree,
      pipeline: { preAuthorizationPreflight, discovery, task, inspection, classification, changePlan },
      execution: validation,
      state: { boundary: stateBoundary, transition: pendingTransition },
      nextStep: validation.reason
    };
  }

  const evidenceId = evidenceIdentity(request, validation.grantFingerprint);
  const priorForAction = validation.operationRecord.adapterEvidence.find(
    (entry) => entry.adapterType === request.adapter && entry.action === request.action
  );
  if (priorForAction && (priorForAction.evidenceId !== evidenceId ||
      priorForAction.grantFingerprint !== validation.grantFingerprint)) {
    const denial = executionDenial('Conflicting governed adapter replay.');
    return {
      schema: 'sdo.orchestration.v1',
      orchestration: { status: 'DENIED', executionAttempted: false, executionAllowed: false },
      repository: discovery.repository, worktree: discovery.worktree,
      pipeline: { preAuthorizationPreflight, discovery, task, inspection, classification, changePlan },
      execution: denial,
      state: { boundary: stateBoundary, transition: pendingTransition },
      nextStep: denial.reason
    };
  }
  if (!priorForAction && validation.operationRecord.finalization !== null) {
    const denial = executionDenial('Finalized operation record has no matching replay evidence.');
    return {
      schema: 'sdo.orchestration.v1',
      orchestration: { status: 'DENIED', executionAttempted: false, executionAllowed: false },
      repository: discovery.repository, worktree: discovery.worktree,
      pipeline: { preAuthorizationPreflight, discovery, task, inspection, classification, changePlan },
      execution: denial,
      governed: { operationRecord: validation.operationRecord, lifecycle: validation.lifecycle },
      nextStep: denial.reason
    };
  }

  let adapterResult = priorForAction ? priorForAction.payload : null;
  let executionAttempted = false;
  let refreshedPhysical = null;
  if (!adapterResult) {
    try {
      adapterResult = validateAdapterResult(request, invokeControlledAdapter(request));
      executionAttempted = true;
      if (request.adapter === 'FILESYSTEM_PATCH') {
        refreshedPhysical = physicalEvidence(repositoryDiscovery.discover(request.workspace));
      }
    } catch (error) {
      let errorEvidence = null;
      let failureReason = error.message;
      try {
        errorEvidence = preserveControlledErrorEvidence(error, request);
      } catch (evidenceError) {
        failureReason = evidenceError.message;
      }
      let failurePhysical = physicalEvidence(discovery);
      if (request.adapter === 'FILESYSTEM_PATCH') {
        try { failurePhysical = physicalEvidence(repositoryDiscovery.discover(request.workspace)); } catch {}
      }
      const failedLifecycle = transitionLifecycle(validation.lifecycle, {
        transitionId: evidenceId,
        operationId: request.operationId,
        type: 'FAIL',
        occurredAt: request.observedAt,
        failure: { reason: failureReason, physicalEvidence: failurePhysical }
      });
      let failedRecord = validation.operationRecord;
      if (request.adapter === 'FILESYSTEM_PATCH' && errorEvidence) {
        const payload = errorEvidence.payload;
        failedRecord = appendAdapterEvidence(failedRecord, {
          evidenceId, operationId: request.operationId, workspace: request.workspace,
          adapterType: 'FILESYSTEM_PATCH', action: 'PATCH_FILE',
          grantFingerprint: validation.grantFingerprint,
          policyDecision: request.grantEvaluation.grant.policyDecision,
          riskLevel: 'R3', lifecycleState: 'PENDING', outcome: 'FAILED',
          timestamp: request.observedAt, payload,
          target: payload.target, beforeSha256: payload.beforeSha256,
          replacementSha256: request.grantEvaluation.grant.scope.target.replacementSha256,
          afterSha256: null, recovery: payload.recovery,
          approvalAuthorityFingerprint:
            request.grantEvaluation.grant.approvalAuthorityFingerprint,
          verifiedIdentityAssertionFingerprint:
            request.grantEvaluation.grant.verifiedIdentityAssertionFingerprint,
          identityVerificationEvidenceFingerprint:
            request.grantEvaluation.grant.identityVerificationEvidenceFingerprint
        });
        failedRecord = finalizeOperationRecord(failedRecord, {
          operationId: request.operationId, workspace: request.workspace,
          lifecycleState: 'FAILED', outcome: 'FAILED',
          successfulCompletionEligible: false, timestamp: request.observedAt
        });
      }
      const execution = deepFreeze({
        ...executionDenial(`Controlled adapter failed closed: ${failureReason}`),
        errorEvidence
      });
      return {
        schema: 'sdo.orchestration.v1',
        orchestration: { status: 'FAILED', executionAttempted: true, executionAllowed: true },
        repository: discovery.repository, worktree: discovery.worktree,
        pipeline: { preAuthorizationPreflight, discovery, task, inspection, classification, changePlan },
        execution,
        governed: { operationRecord: failedRecord, lifecycle: failedLifecycle },
        nextStep: 'Inspect controlled adapter failure evidence; successful completion is forbidden.'
      };
    }
  }

  const outcome = request.adapter === 'PROCESS_VALIDATION'
    ? adapterResult.validation.status
    : request.adapter === 'FILESYSTEM_PATCH' ? adapterResult.outcome : 'SUCCEEDED';
  let operationRecord = validation.operationRecord;
  if (!priorForAction) {
    operationRecord = appendAdapterEvidence(operationRecord, {
      evidenceId,
      operationId: request.operationId,
      workspace: request.workspace,
      adapterType: request.adapter,
      action: request.action,
      grantFingerprint: validation.grantFingerprint,
      policyDecision: request.grantEvaluation.grant.policyDecision,
      riskLevel: request.grantEvaluation.grant.riskLevel,
      lifecycleState: 'PENDING',
      outcome,
      timestamp: adapterResult.observedAt,
      payload: adapterResult,
      ...(request.adapter === 'FILESYSTEM_PATCH' ? {
        target: adapterResult.target,
        beforeSha256: adapterResult.beforeSha256,
        replacementSha256: request.grantEvaluation.grant.scope.target.replacementSha256,
        afterSha256: adapterResult.afterSha256,
        recovery: adapterResult.recovery,
        approvalAuthorityFingerprint:
          request.grantEvaluation.grant.approvalAuthorityFingerprint,
        verifiedIdentityAssertionFingerprint:
          request.grantEvaluation.grant.verifiedIdentityAssertionFingerprint,
        identityVerificationEvidenceFingerprint:
          request.grantEvaluation.grant.identityVerificationEvidenceFingerprint
      } : {})
    });
  }

  if (operationRecord.finalization !== null) {
    const expectedStatus = outcome === 'FAILED' ? 'FAILED' : 'COMPLETED';
    if (operationRecord.finalization.lifecycleState !== expectedStatus ||
        validation.lifecycle.status !== expectedStatus) {
      const denial = executionDenial('Conflicting finalized governed replay.');
      return {
        schema: 'sdo.orchestration.v1',
        orchestration: { status: 'DENIED', executionAttempted: false, executionAllowed: false },
        repository: discovery.repository, worktree: discovery.worktree,
        pipeline: { preAuthorizationPreflight, discovery, task, inspection, classification, changePlan },
        execution: denial, governed: { operationRecord, lifecycle: validation.lifecycle },
        nextStep: denial.reason
      };
    }
    return {
      schema: 'sdo.orchestration.v1',
      orchestration: { status: expectedStatus, executionAttempted: false, executionAllowed: true },
      repository: discovery.repository, worktree: discovery.worktree,
      pipeline: { preAuthorizationPreflight, discovery, task, inspection, classification, changePlan },
      execution: adapterResult,
      governed: { operationRecord, lifecycle: validation.lifecycle, replay: true },
      nextStep: 'Identical governed evidence replayed without physical execution.'
    };
  }

  const failed = outcome === 'FAILED';
  const lifecycle = transitionLifecycle(validation.lifecycle, failed ? {
    transitionId: evidenceId,
    operationId: request.operationId,
    type: 'FAIL',
    occurredAt: adapterResult.observedAt,
    failure: {
      reason: 'Controlled process validation failed.',
      physicalEvidence: physicalEvidence(discovery)
    }
  } : {
    transitionId: evidenceId,
    operationId: request.operationId,
    type: 'COMPLETE',
    occurredAt: adapterResult.observedAt,
    after: refreshedPhysical || physicalEvidence(discovery)
  });
  operationRecord = finalizeOperationRecord(operationRecord, {
    operationId: request.operationId,
    workspace: request.workspace,
    lifecycleState: failed ? 'FAILED' : 'COMPLETED',
    outcome: failed ? 'FAILED' : 'SUCCESS',
    successfulCompletionEligible: !failed,
    timestamp: adapterResult.observedAt
  });

  return {
    schema: 'sdo.orchestration.v1',

    orchestration: {
      status: failed ? 'FAILED' : 'COMPLETED',
      executionAttempted,
      executionAllowed: true
    },

    repository: discovery.repository,

    worktree: discovery.worktree,

    pipeline: {
      preAuthorizationPreflight,
      discovery,
      task,
      inspection,
      classification,
      changePlan
    },

    execution: adapterResult,

    state: {
      boundary: stateBoundary,
      transition: pendingTransition
    },

    governed: { operationRecord, lifecycle, replay: false },

    nextStep: failed
      ? 'Validation failed; successful completion is forbidden.'
      : 'Governed adapter evidence recorded and finalized.'
  };
}

function main() {
  const repositoryPath =
    process.argv[2] || process.cwd();

  const description =
    process.argv[3] ||
    'Orchestrator validation';

  const files =
    process.argv.slice(4);

  if (files.length === 0) {
    console.error(
      'SDO ORCHESTRATOR ERROR: At least one target file is required.'
    );

    process.exit(1);
  }

  try {
    const result = orchestrate({
      repositoryPath,
      description,
      files,
      mode: 'PATCH',
      risk: 'BAIXO',
      estimatedDiffLines: 0,
      architecturalChange: false
    });

    process.stdout.write(
      `${JSON.stringify(result, null, 2)}\n`
    );
  } catch (error) {
    console.error(
      `SDO ORCHESTRATOR ERROR: ${error.message}`
    );

    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  orchestrate,
  validateInput,
  validateControlledRequest,
  rejectUnsafeRequestShape,
  evidenceIdentity,
  preserveControlledErrorEvidence
};
