'use strict';

const fs = require('fs');
const path = require('path');
const { evaluateR3ApprovalAuthority } = require('./risk-classification');

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

function validateWorkspace(workspace) {
  const value = text(workspace);
  if (!value || !path.isAbsolute(value) || path.normalize(value) !== value) {
    return 'Canonical workspace must be an absolute normalized path.';
  }
  try {
    if (fs.realpathSync(value) !== value || !fs.statSync(value).isDirectory()) {
      return 'Workspace is not a canonical physical directory.';
    }
  } catch {
    return 'Workspace is not a canonical physical directory.';
  }
  return null;
}

function validateApproval(input, operationId) {
  const evaluation = evaluateR3ApprovalAuthority(input.approvalAuthority, {
    operationId, workspace: input.workspace, capabilityType: input.capabilityType,
    action: input.action, scope: input.scope, riskLevel: 'R3',
    policyDecision: 'APPROVAL_REQUIRED', observedAt: input.observedAt
  });
  return evaluation.decision === 'ALLOWED' ? null : evaluation.reason;
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
        approvalEvent.approvalAuthorityFingerprint !== input.approvalAuthority.fingerprint) {
      return 'Approval event does not match the bound approval.';
    }
  }
  if (!text(events[events.length - 1].status)) return 'State event status is missing.';
  return null;
}

function createOperationRecord(input) {
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
    const approvalError = validateApproval(input, operationId);
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
      workspace: input.workspace,
      objective: input.objective.trim(),
      policyDecision: input.policyDecision,
      riskLevel: input.riskLevel,
      idempotency: input.idempotency,
      approval: null,
      approvalAuthority: input.riskLevel === 'R3'
        ? evaluateR3ApprovalAuthority(input.approvalAuthority, {
            operationId, workspace: input.workspace, capabilityType: input.capabilityType,
            action: input.action, scope: input.scope, riskLevel: 'R3',
            policyDecision: 'APPROVAL_REQUIRED', observedAt: input.observedAt
          }).authority : null,
      capabilityType: input.riskLevel === 'R3' ? input.capabilityType : null,
      action: input.riskLevel === 'R3' ? input.action : null,
      scope: input.riskLevel === 'R3' ? input.scope : null,
      events: input.events,
      adapterEvidence: [],
      finalization: null
    }
  });
}

function requireRecord(record) {
  if (!record || record.schema !== 'sdo.operation_record.v1' ||
      !isDeepFrozen(record) || !Array.isArray(record.events) ||
      !Array.isArray(record.adapterEvidence) || !Number.isInteger(record.version) ||
      record.version < 1 || validateWorkspace(record.workspace) ||
      !POLICY_DECISIONS.has(record.policyDecision) || !RISKS.has(record.riskLevel)) {
    throw new Error('A valid immutable operation record is required.');
  }
  const eventError = validateEvents(record.events, record);
  if (eventError) throw new Error(eventError);
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
  return record;
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
      record.scope && record.scope.target &&
      record.scope.target.path === target.requested &&
      record.scope.target.beforeSha256 === item.beforeSha256;
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
        item.payload.afterSha256 !== item.replacementSha256 ||
        !['APPLIED', 'ALREADY_APPLIED', 'FAILED'].includes(item.outcome) ||
        item.payload.outcome !== item.outcome || item.payload.recovery !== item.recovery) {
      throw new Error('Filesystem-patch evidence is malformed or inconsistently bound.');
    }
    const successful = item.outcome === 'APPLIED' || item.outcome === 'ALREADY_APPLIED';
    if ((successful && (item.afterSha256 !== item.replacementSha256 ||
        item.recovery !== 'NOT_REQUIRED')) ||
        (!successful && (item.afterSha256 !== null ||
         !['RESTORED', 'NOT_ATTEMPTED_UNPROVEN_OWNERSHIP'].includes(item.recovery)))) {
      throw new Error('Filesystem-patch AFTER or recovery evidence is inconsistent.');
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
      approvalAuthorityFingerprint: item.approvalAuthorityFingerprint || null
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
  return deepFreeze({
    ...current,
    version: current.version + 1,
    finalization: {
      operationId: finalState.operationId,
      workspace: finalState.workspace,
      lifecycleState: finalState.lifecycleState,
      outcome: finalState.outcome,
      successfulCompletionEligible: finalState.successfulCompletionEligible,
      timestamp: finalState.timestamp
    }
  });
}

module.exports = {
  createOperationRecord,
  appendAdapterEvidence,
  finalizeOperationRecord
};
