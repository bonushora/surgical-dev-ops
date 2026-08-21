'use strict';

const fs = require('fs');
const path = require('path');
const {
  canonicalizeAuthorizedRoot
} = require('./workspace-boundary');
const { evaluateR3ApprovalAuthority } = require('./risk-classification');
const { validateIdentityVerificationResult } = require('../adapters/identity-verification-adapter');
const { classifyMutationAuthority } = require('./authoritative-clock');
const {
  deriveCommitAuthorityEvidenceFingerprint
} = require('./mutation-transaction');
const { deriveMutationRecoveryFingerprint } = require('./mutation-recovery');
const {
  deriveMutationProviderDecisionFingerprint
} = require('./mutation-provider');

const RISKS = new Set(['R0', 'R1', 'R2', 'R3']);
const POLICY_DECISIONS = new Set(['ALLOWED', 'DENIED', 'APPROVAL_REQUIRED']);
const IDEMPOTENCY = new Set(['IDEMPOTENT', 'NON_IDEMPOTENT']);
const ADAPTER_ACTIONS = Object.freeze({
  FILESYSTEM_READ: new Set(['READ_FILE']),
  GIT_READ: new Set([
    'REPOSITORY_ROOT', 'CURRENT_BRANCH', 'HEAD_COMMIT',
    'WORKTREE_STATUS', 'TRACKED_FILES'
  ]),
  PROCESS_VALIDATION: new Set(['NODE_SYNTAX_CHECK']),
  FILESYSTEM_PATCH: new Set(['PATCH_FILE'])
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

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function timestamp(value) {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) return null;
  return value;
}

function denied(violations) {
  return deepFreeze({
    schema: 'sdo.operation_record_evaluation.v1',
    decision: 'DENIED',
    violations: Array.isArray(violations) ? violations : [violations],
    record: null
  });
}

function validateIdentity(identity, label) {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) {
    return `${label} identity is missing.`;
  }
  if (!text(identity.id)) return `${label} identity id is missing.`;
  if (!text(identity.type)) return `${label} identity type is missing.`;
  return null;
}

function canonicalWorkspace(workspace) {
  const value = text(workspace);
  if (!value || !path.isAbsolute(value) || path.normalize(value) !== value) {
    return null;
  }
  try {
    const canonical = canonicalizeAuthorizedRoot(value);
    return fs.statSync(canonical).isDirectory()
      ? canonical
      : null;
  } catch {
    return null;
  }
}

function validateWorkspace(workspace) {
  return canonicalWorkspace(workspace)
    ? null
    : 'Workspace is not a canonical physical directory.';
}

function validateApproval(input, operationId, temporalAuthority = {}) {
  const evaluation = evaluateR3ApprovalAuthority(input.approvalAuthority, {
    operationId, workspace: input.workspace, capabilityType: input.capabilityType,
    action: input.action, scope: input.scope, riskLevel: 'R3',
    policyDecision: 'APPROVAL_REQUIRED', tenantId: input.tenantId || null,
    projectId: input.projectId || null
  }, temporalAuthority);
  if (evaluation.decision !== 'ALLOWED') return evaluation.reason;
  const identity = validateIdentityVerificationResult(input.identityVerification, {
    subjectId: evaluation.authority.approver.id, operationId, workspace: input.workspace,
    tenantId: input.tenantId || null, projectId: input.projectId || null,
    fingerprint: evaluation.authority.verifiedIdentityAssertionFingerprint
  }, temporalAuthority);
  return identity ? null : 'Trusted identity verification evidence is missing or mismatched.';
}

function validateEvents(events, input) {
  if (!Array.isArray(events)) return 'Operation events are missing.';
  const expected = input.riskLevel === 'R3'
    ? ['intent', 'policy', 'approval', 'state']
    : ['intent', 'policy', 'state'];
  if (events.length !== expected.length) return 'Mandatory operation events are missing or duplicated.';
  for (let index = 0; index < expected.length; index += 1) {
    const event = events[index];
    if (!event || typeof event !== 'object' || event.type !== expected[index]) {
      return 'Mandatory operation events are out of order or duplicated.';
    }
    if (event.operationId !== input.operationId) return 'Event operationId does not match.';
    if (!timestamp(event.timestamp)) return 'Event timestamp is malformed or missing.';
    if (index > 0 && Date.parse(event.timestamp) < Date.parse(events[index - 1].timestamp)) {
      return 'Mandatory operation event timestamps are out of order.';
    }
  }
  if (events[0].objective !== input.objective) return 'Intent event objective does not match.';
  const policyEvent = events[1];
  if (policyEvent.policyDecision !== input.policyDecision || policyEvent.riskLevel !== input.riskLevel) {
    return 'Policy event cannot alter policy or risk.';
  }
  if (input.riskLevel === 'R3') {
    const approvalEvent = events[2];
    if (approvalEvent.approverId !== input.approvalAuthority.approver.id ||
        approvalEvent.decision !== input.approvalAuthority.decision ||
        approvalEvent.approvalTimestamp !== input.approvalAuthority.timestamp ||
        approvalEvent.approvalAuthorityId !== input.approvalAuthority.approvalAuthorityId ||
        approvalEvent.approvalAuthorityFingerprint !== input.approvalAuthority.fingerprint ||
        approvalEvent.verifiedIdentityAssertionFingerprint !==
          input.approvalAuthority.verifiedIdentityAssertionFingerprint) {
      return 'Approval event does not match the bound approval.';
    }
  }
  if (!text(events[events.length - 1].status)) return 'State event status is missing.';
  return null;
}

function createOperationRecord(input, authoritativeClock = null) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return denied('Operation record input is missing.');
  }
  const violations = [];
  const operationId = text(input.operationId);
  if (!operationId) violations.push('operationId is missing.');
  const requesterError = validateIdentity(input.requester, 'Requester');
  if (requesterError) violations.push(requesterError);
  const workspaceError = validateWorkspace(input.workspace);
  if (workspaceError) violations.push(workspaceError);
  if (!text(input.objective)) violations.push('Objective is missing.');
  if (!POLICY_DECISIONS.has(input.policyDecision)) violations.push('Policy decision is missing or invalid.');
  if (!RISKS.has(input.riskLevel)) violations.push('Risk level is missing or invalid.');
  if (!IDEMPOTENCY.has(input.idempotency)) violations.push('Idempotency classification is missing or invalid.');
  if (input.policyDecision === 'DENIED') violations.push('Policy denied the operation.');

  if (input.riskLevel === 'R3') {
    let observation = null;
    if (!authoritativeClock || typeof authoritativeClock.observe !== 'function') {
      violations.push('Authoritative clock is required for an R3 operation record.');
    } else {
      try { observation = authoritativeClock.observe(); } catch {
        violations.push('Authoritative clock is unavailable for an R3 operation record.');
      }
      if (observation && observation.decision !== 'ALLOWED') {
        violations.push('Authoritative clock anomaly denied the R3 operation record.');
      }
    }
    const approvalError = observation && validateApproval(input, operationId,
      { reading: observation.reading, requireCurrent: true });
    if (approvalError) violations.push(approvalError);
  } else if (input.approvalAuthority !== undefined || input.approval !== undefined) {
    violations.push('Approval is not permitted to alter non-R3 treatment.');
  } else if (input.policyDecision !== 'ALLOWED') {
    violations.push('Non-R3 operations require an ALLOWED policy decision.');
  }

  if (violations.length === 0) {
    const eventError = validateEvents(input.events, input);
    if (eventError) violations.push(eventError);
  }
  if (violations.length > 0) return denied(violations);

  return deepFreeze({
    schema: 'sdo.operation_record_evaluation.v1',
    decision: 'ALLOWED',
    violations: [],
    record: {
      schema: 'sdo.operation_record.v1',
      version: 1,
      operationId,
      requester: { id: input.requester.id.trim(), type: input.requester.type.trim() },
      workspace: canonicalWorkspace(input.workspace),
      objective: input.objective.trim(),
      policyDecision: input.policyDecision,
      riskLevel: input.riskLevel,
      idempotency: input.idempotency,
      approval: null,
      approvalAuthority: input.riskLevel === 'R3'
        ? evaluateR3ApprovalAuthority(input.approvalAuthority, {
            operationId, workspace: input.workspace, capabilityType: input.capabilityType,
            action: input.action, scope: input.scope, riskLevel: 'R3',
            policyDecision: 'APPROVAL_REQUIRED', tenantId: input.tenantId || null,
            projectId: input.projectId || null
          }).authority : null,
      verifiedIdentityAssertion: input.riskLevel === 'R3'
        ? input.approvalAuthority.verifiedIdentityAssertion : null,
      verifiedIdentityAssertionFingerprint: input.riskLevel === 'R3'
        ? input.approvalAuthority.verifiedIdentityAssertionFingerprint : null,
      identityVerification: input.riskLevel === 'R3' ? input.identityVerification : null,
      identityVerificationEvidenceFingerprint: input.riskLevel === 'R3'
        ? input.identityVerification.evidence.fingerprint : null,
      tenantId: input.riskLevel === 'R3' ? (input.tenantId || null) : null,
      projectId: input.riskLevel === 'R3' ? (input.projectId || null) : null,
      capabilityType: input.riskLevel === 'R3' ? input.capabilityType : null,
      action: input.riskLevel === 'R3' ? input.action : null,
      scope: input.riskLevel === 'R3' ? input.scope : null,
      events: input.events,
      adapterEvidence: [],
      mutationProviderEvidence: [],
      mutationRecoveryEvidence: [],
      finalization: null
    }
  });
}

function requireRecord(record) {
  if (!record || record.schema !== 'sdo.operation_record.v1' ||
      !isDeepFrozen(record) || !Array.isArray(record.events) ||
      !Array.isArray(record.adapterEvidence) || !Array.isArray(record.mutationProviderEvidence) ||
      !Array.isArray(record.mutationRecoveryEvidence) ||
      !Number.isInteger(record.version) ||
      record.version < 1 || validateWorkspace(record.workspace) ||
      !POLICY_DECISIONS.has(record.policyDecision) || !RISKS.has(record.riskLevel)) {
    throw new Error('A valid immutable operation record is required.');
  }
  const eventError = validateEvents(record.events, record);
  if (eventError) throw new Error(eventError);
  if (record.riskLevel === 'R3') {
    const approval = evaluateR3ApprovalAuthority(record.approvalAuthority, {
      operationId: record.operationId, workspace: record.workspace,
      capabilityType: record.capabilityType, action: record.action, scope: record.scope,
      riskLevel: 'R3', policyDecision: 'APPROVAL_REQUIRED',
      tenantId: record.tenantId, projectId: record.projectId,
    });
    if (approval.decision !== 'ALLOWED' ||
        record.verifiedIdentityAssertionFingerprint !==
          approval.authority.verifiedIdentityAssertionFingerprint ||
        JSON.stringify(record.verifiedIdentityAssertion) !==
          JSON.stringify(approval.authority.verifiedIdentityAssertion) ||
        !validateIdentityVerificationResult(record.identityVerification, {
          subjectId: approval.authority.approver.id, operationId: record.operationId,
          workspace: record.workspace, tenantId: record.tenantId, projectId: record.projectId,
          fingerprint: record.verifiedIdentityAssertionFingerprint
        }) || record.identityVerificationEvidenceFingerprint !==
          record.identityVerification.evidence.fingerprint) {
      throw new Error('Stored R3 verified identity binding is malformed or substituted.');
    }
  }
  const identities = new Set();
  let previousTimestamp = record.events[record.events.length - 1].timestamp;
  for (const entry of record.adapterEvidence) {
    const normalized = normalizeAdapterEvidence(record, entry, previousTimestamp);
    if (JSON.stringify(normalized) !== JSON.stringify(entry) ||
        identities.has(entry.evidenceId)) {
      throw new Error('Stored adapter evidence is malformed or duplicated.');
    }
    identities.add(entry.evidenceId);
    previousTimestamp = entry.timestamp;
  }
  for (const entry of record.mutationProviderEvidence) {
    if (!isDeepFrozen(entry) || entry.operationId !== record.operationId ||
        entry.workspace !== record.workspace || entry.action !== 'PATCH_FILE' ||
        deriveMutationProviderDecisionFingerprint(entry) !== entry.fingerprint) {
      throw new Error('Stored mutation provider evidence is malformed or substituted.');
    }
  }
  for (const entry of record.mutationRecoveryEvidence) {
    if (!isDeepFrozen(entry) || entry.operationId !== record.operationId ||
        entry.workspace !== record.workspace ||
        deriveMutationRecoveryFingerprint(entry) !== entry.fingerprint) {
      throw new Error('Stored mutation recovery evidence is malformed or substituted.');
    }
  }
  return record;
}

function appendMutationProviderEvidence(record, evidence) {
  const current = requireRecord(record);
  if (!evidence || evidence.schema !== 'sdo.mutation_provider_decision.v1' ||
      !isDeepFrozen(evidence) || !/^[a-f0-9]{64}$/.test(evidence.fingerprint || '') ||
      evidence.operationId !== current.operationId || evidence.workspace !== current.workspace ||
      evidence.action !== 'PATCH_FILE' ||
      deriveMutationProviderDecisionFingerprint(evidence) !== evidence.fingerprint ||
      evidence.requestedCapability !== 'COMPARE_AND_REPLACE' ||
      !['QUALIFIED', 'UNQUALIFIED', 'UNSUPPORTED', 'FAILED'].includes(
        evidence.qualificationState) ||
      (evidence.decision === 'DENIED' && evidence.zeroDispatch !== true)) {
    throw new Error('Mutation provider evidence is malformed.');
  }
  const replay = current.mutationProviderEvidence.find(
    (entry) => entry.fingerprint === evidence.fingerprint
  );
  if (replay) return current;
  if (current.finalization !== null) {
    throw new Error('Mutation provider evidence cannot be appended after finalization.');
  }
  return deepFreeze({ ...current, version: current.version + 1,
    mutationProviderEvidence: [...current.mutationProviderEvidence, evidence] });
}

function appendMutationRecoveryEvidence(record, evidence) {
  const current = requireRecord(record);
  if (!evidence || !isDeepFrozen(evidence) || evidence.operationId !== current.operationId ||
      evidence.workspace !== current.workspace ||
      deriveMutationRecoveryFingerprint(evidence) !== evidence.fingerprint ||
      !/^[a-f0-9]{64}$/.test(evidence.transactionId || '') ||
      !/^[a-f0-9]{64}$/.test(evidence.journalId || '') ||
      !['NOT_APPLIED', 'RESTORED', 'PREVIOUSLY_AUTHORIZED_APPLIED',
        'RECOVERY_UNRESOLVED'].includes(evidence.recoveryClassification)) {
    throw new Error('Mutation recovery evidence is malformed or unbound.');
  }
  const scopeTarget = current.scope && current.scope.target;
  if (current.riskLevel !== 'R3' || !current.approvalAuthority ||
      evidence.approvalAuthorityFingerprint !== current.approvalAuthority.fingerprint ||
      evidence.verifiedIdentityAssertionFingerprint !==
        current.verifiedIdentityAssertionFingerprint || !scopeTarget ||
      path.resolve(current.workspace, scopeTarget.path) !== evidence.target ||
      scopeTarget.beforeSha256 !== evidence.beforeSha256 ||
      scopeTarget.replacementSha256 !== evidence.replacementSha256) {
    throw new Error('Mutation recovery authority, target, or hash binding is mismatched.');
  }
  const replay = current.mutationRecoveryEvidence.find(
    (entry) => entry.fingerprint === evidence.fingerprint
  );
  if (replay) return current;
  if (current.mutationRecoveryEvidence.some((entry) =>
    entry.transactionId === evidence.transactionId && entry.fingerprint !== evidence.fingerprint)) {
    throw new Error('Conflicting mutation recovery evidence replay.');
  }
  return deepFreeze({ ...current, version: current.version + 1,
    mutationRecoveryEvidence: [...current.mutationRecoveryEvidence, evidence] });
}

function validatePayload(record, item) {
  if (!item.payload || typeof item.payload !== 'object' ||
      Array.isArray(item.payload) || !isDeepFrozen(item.payload)) {
    throw new Error('Adapter payload must be a deeply immutable object.');
  }
  const schemas = {
    FILESYSTEM_READ: 'sdo.filesystem_read_result.v1',
    GIT_READ: 'sdo.git_read_result.v1',
    PROCESS_VALIDATION: 'sdo.process_validation_result.v1',
    FILESYSTEM_PATCH: 'sdo.filesystem_patch_result.v1'
  };
  if (item.payload.schema !== schemas[item.adapterType] ||
      item.payload.operationId !== item.operationId ||
      item.payload.workspace !== item.workspace) {
    throw new Error('Adapter payload is structurally malformed or unbound.');
  }
  if (item.adapterType === 'FILESYSTEM_READ' &&
      (!item.payload.target || !text(item.payload.target.requested) ||
       !item.payload.evidence || !Number.isInteger(item.payload.evidence.bytes))) {
    throw new Error('Filesystem-read payload is structurally malformed.');
  }
  if (item.adapterType === 'GIT_READ' && item.payload.selector !== item.action) {
    throw new Error('Git-read payload is structurally malformed.');
  }
  if (item.adapterType === 'FILESYSTEM_PATCH') {
    const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
    const target = item.target;
    const payloadTarget = item.payload.target;
    const r3Authorized = item.riskLevel === 'R3' && record.riskLevel === 'R3' &&
      record.policyDecision === 'APPROVAL_REQUIRED' && record.approvalAuthority &&
      item.approvalAuthorityFingerprint === record.approvalAuthority.fingerprint &&
      item.verifiedIdentityAssertionFingerprint === record.verifiedIdentityAssertionFingerprint &&
      item.identityVerificationEvidenceFingerprint ===
        record.identityVerificationEvidenceFingerprint &&
      record.scope && record.scope.target &&
      record.scope.target.path === target.requested &&
      record.scope.target.beforeSha256 === item.beforeSha256;
    const temporal = item.payload.temporalAuthority;
    const commitAuthority = item.payload.commitAuthority;
    const transaction = item.payload.transaction;
    const timeEvaluation = temporal && temporal.evaluation;
    let temporalIntegrity = false;
    if (timeEvaluation) {
      try {
        const reconstructed = classifyMutationAuthority(timeEvaluation.reading,
          timeEvaluation.bounds, timeEvaluation.progression);
        temporalIntegrity = reconstructed.fingerprint === timeEvaluation.fingerprint &&
          reconstructed.decision === timeEvaluation.decision;
      } catch {}
    }
    const temporalBound = temporal && temporal.schema === 'sdo.mutation_commit_authority.v1' &&
      temporalIntegrity && timeEvaluation.schema === 'sdo.mutation_authority_time_evidence.v1' &&
      timeEvaluation.bounds &&
      timeEvaluation.bounds.identity.fingerprint === record.verifiedIdentityAssertionFingerprint &&
      record.approvalAuthority &&
      timeEvaluation.bounds.approval.fingerprint === record.approvalAuthority.fingerprint &&
      timeEvaluation.bounds.grant.fingerprint === item.grantFingerprint &&
      item.payload.observedAt === timeEvaluation.reading.wallTime;
    const transactionBound = transaction &&
      /^[a-f0-9]{64}$/.test(transaction.transactionId || '') &&
      /^[a-f0-9]{64}$/.test(transaction.journalId || '') &&
      /^[a-f0-9]{64}$/.test(transaction.lockId || '') &&
      transaction.transactionId === item.transactionId &&
      transaction.journalId === item.journalId &&
      transaction.commitAuthorityFingerprint === item.commitAuthorityFingerprint &&
      ['LOCKED', 'BEFORE_VERIFIED', 'MUTATION_STARTED', 'COMMIT_AUTHORITY_VERIFIED', 'PHYSICAL_APPLIED',
        'AFTER_VERIFIED', 'RECOVERY_REQUIRED', 'RECOVERED'].includes(transaction.stage) &&
      ['IN_PROGRESS', 'RECOVERY_REQUIRED'].includes(transaction.classification);
    const durableAuthorityBound = commitAuthority && isDeepFrozen(commitAuthority) &&
      commitAuthority.schema === 'sdo.mutation_commit_authority_evidence.v1' &&
      commitAuthority.fingerprint === item.commitAuthorityFingerprint &&
      deriveCommitAuthorityEvidenceFingerprint(commitAuthority) === commitAuthority.fingerprint &&
      commitAuthority.transactionId === item.transactionId &&
      commitAuthority.operationId === item.operationId &&
      commitAuthority.workspace === item.workspace &&
      commitAuthority.target === target.canonical &&
      commitAuthority.beforeSha256 === item.beforeSha256 &&
      commitAuthority.replacementSha256 === item.replacementSha256 &&
      commitAuthority.verifiedIdentityAssertionFingerprint ===
        item.verifiedIdentityAssertionFingerprint &&
      commitAuthority.approvalAuthorityFingerprint === item.approvalAuthorityFingerprint &&
      commitAuthority.grantFingerprint === item.grantFingerprint &&
      commitAuthority.policyDecision === 'ALLOWED' && commitAuthority.riskLevel === 'R3' &&
      commitAuthority.capabilityType === 'FILESYSTEM_PATCH' &&
      commitAuthority.action === 'PATCH_FILE' &&
      commitAuthority.authoritativeEvaluation === timeEvaluation;
    if ((!['R1', 'R2'].includes(item.riskLevel) && !r3Authorized) ||
        item.policyDecision !== 'ALLOWED' ||
        !target || !text(target.requested) || !text(target.canonical) ||
        !path.isAbsolute(target.canonical) ||
        path.resolve(record.workspace, target.requested) !== target.canonical ||
        (target.canonical !== record.workspace &&
         !target.canonical.startsWith(`${record.workspace}${path.sep}`)) ||
        !payloadTarget || payloadTarget.requested !== target.requested ||
        payloadTarget.canonical !== target.canonical ||
        !sha256(item.beforeSha256) || item.payload.beforeSha256 !== item.beforeSha256 ||
        !sha256(item.replacementSha256) ||
        (item.outcome !== 'FAILED' && item.payload.afterSha256 !== item.replacementSha256) ||
        !['APPLIED', 'ALREADY_APPLIED', 'FAILED'].includes(item.outcome) ||
        item.payload.outcome !== item.outcome || item.payload.recovery !== item.recovery ||
        (r3Authorized && (item.recovery !== 'NOT_STARTED_AUTHORITY_DENIED' &&
          (!temporalBound || !transactionBound || !durableAuthorityBound)))) {
      throw new Error('Filesystem-patch evidence is malformed or inconsistently bound.');
    }
    const successful = item.outcome === 'APPLIED' || item.outcome === 'ALREADY_APPLIED';
    if ((successful && (item.afterSha256 !== item.replacementSha256 ||
        item.recovery !== 'NOT_REQUIRED')) ||
        (!successful && (item.afterSha256 !== null ||
         !['RESTORED', 'NOT_ATTEMPTED_UNPROVEN_OWNERSHIP',
           'NOT_STARTED_AUTHORITY_DENIED',
           'RECOVERY_REQUIRED_JOURNAL_AMBIGUITY'].includes(item.recovery)))) {
      throw new Error('Filesystem-patch AFTER or recovery evidence is inconsistent.');
    }
    if (r3Authorized && ((successful && temporal.decision !== 'ALLOWED') ||
        (item.recovery === 'NOT_STARTED_AUTHORITY_DENIED' &&
         (temporal.decision !== 'DENIED' || temporal.physicalCommit !== 'NOT_STARTED')))) {
      throw new Error('Filesystem-patch commit-time authority evidence is inconsistent.');
    }
    return;
  }
  if (item.adapterType === 'PROCESS_VALIDATION') {
    const validation = item.payload.validation;
    if (item.payload.selector !== item.action ||
        !validation || !['PASSED', 'FAILED'].includes(validation.status) ||
        typeof validation.successfulCompletionEligible !== 'boolean' ||
        (validation.status === 'FAILED' && validation.successfulCompletionEligible !== false) ||
        item.outcome !== validation.status) {
      throw new Error('Process-validation outcome is malformed or inconsistent.');
    }
  } else if (item.outcome !== 'SUCCEEDED') {
    throw new Error('Read adapter outcome must be SUCCEEDED.');
  }
}

function normalizeAdapterEvidence(record, item, orderedAfter) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error('Adapter evidence is missing or malformed.');
  }
  const evidenceId = text(item.evidenceId);
  if (!evidenceId) throw new Error('Adapter evidence identity is missing.');
  if (item.operationId !== record.operationId) throw new Error('Evidence operationId mismatch.');
  if (item.workspace !== record.workspace || validateWorkspace(item.workspace)) {
    throw new Error('Evidence workspace mismatch.');
  }
  const actions = ADAPTER_ACTIONS[item.adapterType];
  if (!actions || !actions.has(item.action)) {
    throw new Error('Unknown or forbidden adapter/action.');
  }
  if (!/^[a-f0-9]{64}$/.test(item.grantFingerprint || '')) {
    throw new Error('Capability/grant binding is missing or malformed.');
  }
  const r3PatchPolicy = item.adapterType === 'FILESYSTEM_PATCH' && record.riskLevel === 'R3' &&
    record.policyDecision === 'APPROVAL_REQUIRED' && item.policyDecision === 'ALLOWED';
  if ((!r3PatchPolicy && item.policyDecision !== record.policyDecision) ||
      item.riskLevel !== record.riskLevel || item.lifecycleState !== 'PENDING') {
    throw new Error('Evidence policy, risk or lifecycle context mismatch.');
  }
  if (!timestamp(item.timestamp)) throw new Error('Evidence timestamp is missing or malformed.');
  const previousTimestamp = orderedAfter || (record.adapterEvidence.length
    ? record.adapterEvidence[record.adapterEvidence.length - 1].timestamp
    : record.events[record.events.length - 1].timestamp);
  if (Date.parse(item.timestamp) < Date.parse(previousTimestamp)) {
    throw new Error('Adapter evidence timestamps are out of order.');
  }
  validatePayload(record, item);
  return {
    evidenceId,
    operationId: item.operationId,
    workspace: item.workspace,
    adapterType: item.adapterType,
    action: item.action,
    grantFingerprint: item.grantFingerprint,
    policyDecision: item.policyDecision,
    riskLevel: item.riskLevel,
    lifecycleState: item.lifecycleState,
    outcome: item.outcome,
    timestamp: item.timestamp,
    payload: item.payload,
    ...(item.adapterType === 'FILESYSTEM_PATCH' ? {
      target: { requested: item.target.requested, canonical: item.target.canonical },
      beforeSha256: item.beforeSha256,
      replacementSha256: item.replacementSha256,
      afterSha256: item.afterSha256,
      recovery: item.recovery,
      approvalAuthorityFingerprint: item.approvalAuthorityFingerprint || null,
      verifiedIdentityAssertionFingerprint: item.verifiedIdentityAssertionFingerprint || null,
      identityVerificationEvidenceFingerprint:
        item.identityVerificationEvidenceFingerprint || null,
      transactionId: item.transactionId || null,
      journalId: item.journalId || null,
      commitAuthorityFingerprint: item.commitAuthorityFingerprint || null
    } : {})
  };
}

function appendAdapterEvidence(record, item) {
  const current = requireRecord(record);
  if (current.finalization !== null) throw new Error('Evidence append after finalization is forbidden.');
  const normalized = normalizeAdapterEvidence(current, item);
  if (normalized.adapterType === 'FILESYSTEM_PATCH') {
    const priorPatch = current.adapterEvidence.find((entry) =>
      entry.adapterType === 'FILESYSTEM_PATCH' &&
      entry.operationId === normalized.operationId &&
      entry.target.canonical === normalized.target.canonical
    );
    if (priorPatch && priorPatch.beforeSha256 !== normalized.beforeSha256) {
      throw new Error('Stale or conflicting filesystem-patch BEFORE evidence.');
    }
    if (priorPatch && priorPatch.replacementSha256 !== normalized.replacementSha256) {
      throw new Error('Conflicting filesystem-patch replacement replay.');
    }
    if (priorPatch) return current;
  }
  const replay = current.adapterEvidence.find(
    (entry) => entry.evidenceId === normalized.evidenceId
  );
  if (replay) {
    if (JSON.stringify(replay) !== JSON.stringify(normalized)) {
      throw new Error('Conflicting duplicate adapter evidence identity.');
    }
    return current;
  }
  return deepFreeze({
    ...current,
    version: current.version + 1,
    adapterEvidence: [...current.adapterEvidence, normalized]
  });
}

function finalizeOperationRecord(record, finalState) {
  const current = requireRecord(record);
  if (current.finalization !== null) {
    if (JSON.stringify(current.finalization) === JSON.stringify(finalState)) return current;
    throw new Error('Operation record is already finalized.');
  }
  if (current.adapterEvidence.length === 0) {
    throw new Error('Finalization requires controlled adapter evidence.');
  }
  if (!finalState || typeof finalState !== 'object' || Array.isArray(finalState) ||
      finalState.operationId !== current.operationId ||
      finalState.workspace !== current.workspace || !timestamp(finalState.timestamp) ||
      !['COMPLETED', 'FAILED'].includes(finalState.lifecycleState) ||
      !['SUCCESS', 'FAILED'].includes(finalState.outcome) ||
      typeof finalState.successfulCompletionEligible !== 'boolean') {
    throw new Error('Final operation state is malformed or inconsistent.');
  }
  const failedEvidence = current.adapterEvidence.some(
    (entry) => entry.outcome === 'FAILED'
  );
  const successful = finalState.lifecycleState === 'COMPLETED' &&
    finalState.outcome === 'SUCCESS' && finalState.successfulCompletionEligible === true;
  const failed = finalState.lifecycleState === 'FAILED' &&
    finalState.outcome === 'FAILED' && finalState.successfulCompletionEligible === false;
  if ((!successful && !failed) || (failedEvidence && successful)) {
    throw new Error('Final lifecycle/outcome is inconsistent with adapter evidence.');
  }
  const patchEvidence = current.adapterEvidence.find(
    (entry) => entry.adapterType === 'FILESYSTEM_PATCH' && entry.riskLevel === 'R3'
  );
  let mutationTransaction = null;
  if (patchEvidence) {
    const candidate = finalState.mutationTransaction;
    if (!candidate || candidate.transactionId !== patchEvidence.transactionId ||
        candidate.journalId !== patchEvidence.journalId ||
        !['RELEASED', 'RETAINED'].includes(candidate.lockDisposition) ||
        (successful && candidate.stage !== 'FINALIZED_SUCCESS') ||
        (failed && !['FINALIZED_FAILED', 'RECOVERY_UNRESOLVED',
          'RECOVERY_REQUIRED', 'RECOVERED', 'MUTATION_STARTED',
          'PHYSICAL_APPLIED', 'AFTER_VERIFIED', 'EVIDENCE_RECORDED',
          'FINALIZED_SUCCESS'].includes(candidate.stage)) ||
        (failed && !['FINALIZED_FAILED', 'RECOVERY_UNRESOLVED'].includes(candidate.stage) &&
          candidate.lockDisposition !== 'RETAINED')) {
      throw new Error('Final mutation transaction/journal state is malformed or inconsistent.');
    }
    mutationTransaction = {
      transactionId: candidate.transactionId,
      journalId: candidate.journalId,
      stage: candidate.stage,
      lockDisposition: candidate.lockDisposition
    };
  }
  return deepFreeze({
    ...current,
    version: current.version + 1,
    finalization: {
      operationId: finalState.operationId,
      workspace: finalState.workspace,
      lifecycleState: finalState.lifecycleState,
      outcome: finalState.outcome,
      successfulCompletionEligible: finalState.successfulCompletionEligible,
      timestamp: finalState.timestamp,
      mutationTransaction
    }
  });
}

module.exports = {
  createOperationRecord,
  appendAdapterEvidence,
  appendMutationProviderEvidence,
  appendMutationRecoveryEvidence,
  finalizeOperationRecord
};
