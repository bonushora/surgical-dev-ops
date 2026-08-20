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
  appendMutationRecoveryEvidence,
  finalizeOperationRecord
} = require('./operation-record');
const filesystemReadAdapter = require('../adapters/filesystem-read-adapter');
const gitReadAdapter = require('../adapters/git-read-adapter');
const processValidationAdapter = require('../adapters/process-validation-adapter');
const filesystemPatchAdapter = require('../adapters/filesystem-patch-adapter');
const identityVerificationAdapter = require('../adapters/identity-verification-adapter');
const { deriveCapabilityGrantFingerprint } = require('./capability-grant');
const { classifyMutationAuthority } = require('./authoritative-clock');
const { requireDurabilityReceipt } = require('./mutation-durability');
const {
  createMutationTransaction,
  createCommitAuthorityEvidence,
  bindCommitAuthorityEvidence,
  transitionMutationTransaction
} = require('./mutation-transaction');
const mutationLockAdapter = require('../adapters/mutation-lock-adapter');
const { createMutationRecoveryAdapter } = require('../adapters/mutation-recovery-adapter');

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
  if (request.adapter === 'FILESYSTEM_PATCH' && ['now', 'currentTime', 'validationTime'].some(
    (key) => Object.prototype.hasOwnProperty.call(request, key)
  )) return deniedAtBoundary('Caller-supplied current time cannot authorize mutation.');
  return null;
}

function validateControlledRequest(request, repositoryPath, expectedRisk, runtime = {}, options = {}) {
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
  if (!Number.isFinite(observed) || !Number.isFinite(expires) ||
      (request.adapter !== 'FILESYSTEM_PATCH' && observed >= expires)) {
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
    if (deriveCapabilityGrantFingerprint(grant) !== grant.fingerprint) {
      return executionDenial('Capability grant fingerprint is invalid.');
    }
    let observation = null;
    if (!options.historicalReplay) {
      if (!runtime.authoritativeClock || typeof runtime.authoritativeClock.observe !== 'function') {
        return executionDenial('Authoritative clock is required for mutation dispatch.');
      }
      try { observation = runtime.authoritativeClock.observe(options.previousReading || null); } catch {
        return executionDenial('Authoritative clock is unavailable.');
      }
      if (!observation || observation.decision !== 'ALLOWED') {
        return executionDenial('Authoritative clock anomaly denied mutation dispatch.');
      }
    }
    const temporal = observation
      ? { reading: observation.reading, requireCurrent: true } : {};
    const approval = evaluateR3ApprovalAuthority(operationRecord.approvalAuthority, {
      operationId: request.operationId, workspace: repositoryPath,
      capabilityType: 'FILESYSTEM_PATCH', action: 'PATCH_FILE',
      scope: operationRecord.scope,
      riskLevel: 'R3', policyDecision: 'APPROVAL_REQUIRED',
      tenantId: operationRecord.tenantId, projectId: operationRecord.projectId
    }, temporal);
    const identityVerification = options.historicalReplay
      ? operationRecord.identityVerification
      : identityVerificationAdapter.verifyHumanIdentityAssertion({
      rawAssertion: request.rawIdentityAssertion,
      trustedIssuers: runtime.trustedIdentityIssuers,
      expected: {
        subjectId: operationRecord.approvalAuthority.approver.id,
        audience: runtime.identityAudience,
        operationId: request.operationId,
        workspace: repositoryPath,
        tenantId: operationRecord.tenantId,
        projectId: operationRecord.projectId,
        fingerprint: operationRecord.verifiedIdentityAssertionFingerprint
      }
    }, runtime.identityVerifierPort, temporal);
    let authorityTimeEvidence = null;
    if (observation) {
      try {
        authorityTimeEvidence = classifyMutationAuthority(observation.reading, {
          identity: grant.temporalAuthority.identity,
          approval: grant.temporalAuthority.approval,
          grant: { ...grant.temporalAuthority.grant, fingerprint: grant.fingerprint }
        }, observation);
      } catch {
        return executionDenial('Mutation temporal authority binding is malformed.');
      }
      if (authorityTimeEvidence.decision !== 'ALLOWED') {
        return executionDenial('Mutation identity, approval or grant is expired.');
      }
    }
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
    runtime = { ...runtime, authorityTimeEvidence };
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
    grantFingerprint: r3Patch ? grant.fingerprint : fingerprint(evaluation),
    operationRecord,
    lifecycle,
    authorityTimeEvidence: runtime.authorityTimeEvidence || null
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

function createMutationCoordinator(request, validation, runtime, idempotencyKey) {
  const journalPort = runtime.mutationJournalAdapter;
  const lockPort = runtime.mutationLockAdapter || mutationLockAdapter;
  if (!journalPort || typeof journalPort.create !== 'function' ||
      typeof journalPort.append !== 'function' || typeof journalPort.reopen !== 'function') {
    throw new Error('Trusted mutation journal adapter is required.');
  }
  if (!lockPort || typeof lockPort.acquireMutationLock !== 'function' ||
      typeof lockPort.releaseMutationLock !== 'function') {
    throw new Error('Exact-target mutation lock adapter is required.');
  }
  const grant = request.grantEvaluation.grant;
  function requireJournalDurability(state, stage) {
    const operation = ['FINALIZED_SUCCESS', 'FINALIZED_FAILED', 'RECOVERY_UNRESOLVED']
      .includes(stage) ? 'DURABLE_FINALIZATION' : 'DURABLE_JOURNAL_APPEND';
    requireDurabilityReceipt(state && state.durability, operation);
    return state;
  }
  let transaction = createMutationTransaction({
    operationId: request.operationId,
    workspace: request.workspace,
    target: grant.scope.target.canonicalPath,
    beforeSha256: grant.scope.target.beforeSha256,
    replacementSha256: grant.scope.target.replacementSha256,
    grantFingerprint: validation.grantFingerprint,
    approvalAuthorityFingerprint: grant.approvalAuthorityFingerprint,
    verifiedIdentityAssertionFingerprint: grant.verifiedIdentityAssertionFingerprint,
    idempotencyKey
  });
  let journal;
  try {
    journal = journalPort.reopen(transaction);
    if (journal.transaction.stage !== 'PREPARED') {
      throw new Error(`Existing mutation journal is ${journal.transaction.stage}; recovery or replay proof is required.`);
    }
  } catch (error) {
    if (!/does not exist/.test(error.message)) throw error;
    journal = requireJournalDurability(journalPort.create(transaction), 'PREPARED');
  }
  const acquired = lockPort.acquireMutationLock({
    transaction, workspace: request.workspace, target: request.target,
    durabilityAdapter: runtime.durabilityAdapter
  });
  if (!acquired || acquired.decision !== 'ACQUIRED') {
    throw new Error('Exact-target mutation lock is contended; mutation is denied.');
  }
  transaction = acquired.transaction;
  let lockRetained = true;
  try {
    journal = requireJournalDurability(journalPort.append(transaction), 'LOCKED');
  } catch (error) {
    error.lockRetained = true;
    throw error;
  }

  function advance(stage) {
    const candidate = transitionMutationTransaction(transaction, stage);
    const accepted = requireJournalDurability(journalPort.append(candidate), stage);
    transaction = candidate;
    journal = accepted;
    return transaction;
  }

  function verifyCommitAuthority(input) {
    const evidence = createCommitAuthorityEvidence(transaction, input);
    const candidate = bindCommitAuthorityEvidence(transaction, evidence);
    const accepted = requireJournalDurability(journalPort.append(candidate),
      'COMMIT_AUTHORITY_VERIFIED');
    if (!accepted || accepted.journalId !== journal.journalId ||
        !accepted.transaction || accepted.transaction.transactionId !== candidate.transactionId ||
        accepted.transaction.stage !== 'COMMIT_AUTHORITY_VERIFIED' ||
        !accepted.transaction.commitAuthority ||
        accepted.transaction.commitAuthority.fingerprint !== evidence.fingerprint) {
      throw new Error('Mutation journal did not durably accept exact commit-authority evidence.');
    }
    transaction = candidate;
    journal = accepted;
    return evidence;
  }

  function requireRecovery() {
    if (transaction.stage === 'RECOVERY_REQUIRED' ||
        transaction.stage === 'RECOVERED' || transaction.stage === 'RECOVERY_UNRESOLVED') {
      return transaction;
    }
    return advance('RECOVERY_REQUIRED');
  }

  function failBeforeCommit() {
    if (!['PREPARED', 'LOCKED', 'BEFORE_VERIFIED', 'MUTATION_STARTED'].includes(transaction.stage)) {
      return false;
    }
    try {
      advance('FINALIZED_FAILED');
      const released = lockPort.releaseMutationLock({ transaction, lock: transaction.lock,
        durabilityAdapter: runtime.durabilityAdapter });
      lockRetained = released.decision !== 'RELEASED';
      return !lockRetained;
    } catch {
      lockRetained = Boolean(transaction.lock);
      return false;
    }
  }

  function releaseFinalized() {
    if (!['FINALIZED_SUCCESS', 'FINALIZED_FAILED', 'RECOVERY_UNRESOLVED'].includes(transaction.stage)) {
      throw new Error('Mutation lock release requires a durable terminal journal state.');
    }
    const released = lockPort.releaseMutationLock({ transaction, lock: transaction.lock,
      durabilityAdapter: runtime.durabilityAdapter });
    if (released.decision !== 'RELEASED') throw new Error('Mutation lock release is ambiguous.');
    lockRetained = false;
    return released;
  }

  return {
    current: () => deepFreeze({ transaction, journal, lockRetained }),
    advance,
    verifyCommitAuthority,
    requireRecovery,
    failBeforeCommit,
    releaseFinalized
  };
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
    timestamp: evidence.observedAt || request.observedAt,
    payload: evidence
  });
}

function patchEvidenceItem(request, validation, evidenceId, payload, outcome = payload.outcome) {
  return {
    evidenceId, operationId: request.operationId, workspace: request.workspace,
    adapterType: 'FILESYSTEM_PATCH', action: 'PATCH_FILE',
    grantFingerprint: validation.grantFingerprint,
    policyDecision: request.grantEvaluation.grant.policyDecision,
    riskLevel: 'R3', lifecycleState: 'PENDING', outcome,
    timestamp: payload.observedAt, payload,
    target: payload.target, beforeSha256: payload.beforeSha256,
    replacementSha256: request.grantEvaluation.grant.scope.target.replacementSha256,
    afterSha256: outcome === 'FAILED' ? null : payload.afterSha256,
    recovery: payload.recovery,
    approvalAuthorityFingerprint: request.grantEvaluation.grant.approvalAuthorityFingerprint,
    verifiedIdentityAssertionFingerprint:
      request.grantEvaluation.grant.verifiedIdentityAssertionFingerprint,
    identityVerificationEvidenceFingerprint:
      request.grantEvaluation.grant.identityVerificationEvidenceFingerprint,
    transactionId: payload.transaction && payload.transaction.transactionId,
    journalId: payload.transaction && payload.transaction.journalId,
    commitAuthorityFingerprint: payload.commitAuthority && payload.commitAuthority.fingerprint
  };
}

function mutationFinalization(coordinator) {
  if (!coordinator) return null;
  const state = coordinator.current();
  return {
    transactionId: state.transaction.transactionId,
    journalId: state.journal.journalId,
    stage: state.transaction.stage,
    lockDisposition: state.lockRetained ? 'RETAINED' : 'RELEASED'
  };
}

function invokeControlledAdapter(request, runtime, validation, mutationCoordinator = null) {
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
    }, { authoritativeClock: runtime.authoritativeClock,
      previousReading: validation.authorityTimeEvidence.reading,
      durabilityAdapter: runtime.durabilityAdapter,
      mutationTransaction: mutationCoordinator });
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
      (request.adapter !== 'FILESYSTEM_PATCH' && result.observedAt !== request.observedAt)) {
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
      input.execution, discovery.repository.path, 'R3', runtime, { historicalReplay: true }
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
    let journalProven = false;
    if (completed && runtime.mutationJournalAdapter &&
        typeof runtime.mutationJournalAdapter.reopen === 'function') {
      try {
        const grant = input.execution.grantEvaluation.grant;
        const transaction = createMutationTransaction({
          operationId: input.execution.operationId,
          workspace: input.execution.workspace,
          target: grant.scope.target.canonicalPath,
          beforeSha256: grant.scope.target.beforeSha256,
          replacementSha256: grant.scope.target.replacementSha256,
          grantFingerprint: replayValidation.grantFingerprint,
          approvalAuthorityFingerprint: grant.approvalAuthorityFingerprint,
          verifiedIdentityAssertionFingerprint: grant.verifiedIdentityAssertionFingerprint,
          idempotencyKey: replayId
        });
        const journal = runtime.mutationJournalAdapter.reopen(transaction);
        const physical = filesystemPatchAdapter.verifyAppliedFile({
          workspace: input.execution.workspace, target: input.execution.target,
          expectedSha256: grant.scope.target.replacementSha256
        });
        journalProven = journal.transaction.stage === 'FINALIZED_SUCCESS' &&
          prior.transactionId === journal.transaction.transactionId &&
          prior.journalId === journal.journalId && physical.decision === 'PROVEN_APPLIED';
      } catch {}
    }
    if (!completed || !journalProven) {
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
  let authorityObservation = null;
  const patchRequested = input.execution && input.execution.adapter === 'FILESYSTEM_PATCH';
  if (patchRequested && runtime.authoritativeClock &&
      typeof runtime.authoritativeClock.observe === 'function') {
    try { authorityObservation = runtime.authoritativeClock.observe(); } catch {}
  }
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
    projectId: input.execution && input.execution.projectId
  }, patchRequested ? {
    reading: authorityObservation && authorityObservation.decision === 'ALLOWED'
      ? authorityObservation.reading : null,
    requireCurrent: true
  } : {});

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
    request, discovery.repository.path, classification.classification.level, runtime,
    { previousReading: authorityObservation && authorityObservation.reading }
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
  let mutationCoordinator = null;
  let coordinatedRecord = null;
  if (!adapterResult) {
    try {
      if (request.adapter === 'FILESYSTEM_PATCH') {
        mutationCoordinator = createMutationCoordinator(
          request, validation, runtime, evidenceId
        );
      }
      executionAttempted = true;
      adapterResult = validateAdapterResult(request,
        invokeControlledAdapter(request, runtime, validation, mutationCoordinator));
      if (request.adapter === 'FILESYSTEM_PATCH') {
        refreshedPhysical = physicalEvidence(repositoryDiscovery.discover(request.workspace));
        coordinatedRecord = appendAdapterEvidence(validation.operationRecord,
          patchEvidenceItem(request, validation, evidenceId, adapterResult));
        mutationCoordinator.advance('EVIDENCE_RECORDED');
        mutationCoordinator.advance('FINALIZED_SUCCESS');
        mutationCoordinator.releaseFinalized();
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
        occurredAt: (errorEvidence && errorEvidence.timestamp) || request.observedAt,
        failure: { reason: failureReason, physicalEvidence: failurePhysical }
      });
      let failedRecord = coordinatedRecord || validation.operationRecord;
      if (request.adapter === 'FILESYSTEM_PATCH' && errorEvidence) {
        const payload = errorEvidence.payload;
        failedRecord = appendAdapterEvidence(coordinatedRecord || failedRecord,
          patchEvidenceItem(request, validation, evidenceId, payload, 'FAILED'));
      }
      if (request.adapter === 'FILESYSTEM_PATCH' && mutationCoordinator) {
        const currentStage = mutationCoordinator.current().transaction.stage;
        if (['LOCKED', 'BEFORE_VERIFIED'].includes(currentStage) ||
            (currentStage === 'MUTATION_STARTED' && errorEvidence &&
             errorEvidence.payload.recovery === 'NOT_STARTED_AUTHORITY_DENIED')) {
          mutationCoordinator.failBeforeCommit();
        } else if (currentStage === 'RECOVERED' && errorEvidence) {
          try {
            mutationCoordinator.advance('EVIDENCE_RECORDED');
            mutationCoordinator.advance('FINALIZED_FAILED');
            mutationCoordinator.releaseFinalized();
          } catch {}
        } else if (!['FINALIZED_FAILED', 'FINALIZED_SUCCESS',
          'RECOVERY_REQUIRED', 'RECOVERY_UNRESOLVED'].includes(currentStage)) {
          try { mutationCoordinator.requireRecovery(); } catch {}
        }
      }
      if (request.adapter === 'FILESYSTEM_PATCH' &&
          failedRecord.adapterEvidence.length > 0 && failedRecord.finalization === null) {
        const failureTimestamp = (errorEvidence && errorEvidence.timestamp) ||
          (adapterResult && adapterResult.observedAt) || request.observedAt;
        failedRecord = finalizeOperationRecord(failedRecord, {
          operationId: request.operationId, workspace: request.workspace,
          lifecycleState: 'FAILED', outcome: 'FAILED',
          successfulCompletionEligible: false, timestamp: failureTimestamp,
          mutationTransaction: mutationFinalization(mutationCoordinator)
        });
      }
      const execution = deepFreeze({
        ...executionDenial(`Controlled adapter failed closed: ${failureReason}`),
        errorEvidence
      });
      return {
        schema: 'sdo.orchestration.v1',
        orchestration: { status: 'FAILED', executionAttempted, executionAllowed: true },
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
    operationRecord = coordinatedRecord || appendAdapterEvidence(operationRecord, {
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
          request.grantEvaluation.grant.identityVerificationEvidenceFingerprint,
        transactionId: adapterResult.transaction && adapterResult.transaction.transactionId,
        journalId: adapterResult.transaction && adapterResult.transaction.journalId
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
    timestamp: adapterResult.observedAt,
    ...(request.adapter === 'FILESYSTEM_PATCH' ? {
      mutationTransaction: mutationFinalization(mutationCoordinator)
    } : {})
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

function recoverGovernedMutation(input, runtime = {}) {
  if (!input || !input.transaction || !runtime.mutationJournalAdapter ||
      !runtime.authoritativeClock) {
    throw new Error('Explicit immutable mutation recovery context is required.');
  }
  const adapter = runtime.mutationRecoveryAdapter || createMutationRecoveryAdapter({
    journalAdapter: runtime.mutationJournalAdapter,
    lockAdapter: runtime.mutationLockAdapter || mutationLockAdapter,
    authoritativeClock: runtime.authoritativeClock,
    ownerTerminationPort: runtime.ownerTerminationPort,
    durabilityAdapter: runtime.durabilityAdapter
  });
  const recovery = adapter.recover({ transaction: input.transaction });
  const operationRecord = input.operationRecord && recovery.fingerprint
    ? appendMutationRecoveryEvidence(input.operationRecord, recovery) : input.operationRecord || null;
  return deepFreeze({ schema: 'sdo.mutation_recovery_result.v1', recovery, operationRecord,
    physicalMutationAttempted: false });
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
  preserveControlledErrorEvidence,
  recoverGovernedMutation
};
