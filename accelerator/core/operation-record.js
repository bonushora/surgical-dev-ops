'use strict';

const fs = require('fs');
const path = require('path');

const RISKS = new Set(['R0', 'R1', 'R2', 'R3']);
const POLICY_DECISIONS = new Set(['ALLOWED', 'DENIED', 'APPROVAL_REQUIRED']);
const IDEMPOTENCY = new Set(['IDEMPOTENT', 'NON_IDEMPOTENT']);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
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

function validateApproval(approval, operationId, policyDecision, riskLevel) {
  if (!approval || typeof approval !== 'object' || Array.isArray(approval)) {
    return 'R3 requires explicit human approval.';
  }
  if (approval.operationId !== operationId) return 'Approval operationId does not match.';
  const identityError = validateIdentity(approval.approver, 'Approver');
  if (identityError) return identityError;
  if (approval.approver.type !== 'HUMAN') return 'Approver identity must be HUMAN.';
  if (approval.decision !== 'APPROVED') return 'Approval decision must be APPROVED.';
  if (!timestamp(approval.timestamp)) return 'Approval timestamp is malformed or missing.';
  if ('policyDecision' in approval || 'riskLevel' in approval) {
    return 'Approval cannot alter policy or risk.';
  }
  if (policyDecision !== 'APPROVAL_REQUIRED' || riskLevel !== 'R3') {
    return 'Approval is inconsistent with policy or risk.';
  }
  return null;
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
    if (approvalEvent.approverId !== input.approval.approver.id ||
        approvalEvent.decision !== input.approval.decision ||
        approvalEvent.approvalTimestamp !== input.approval.timestamp) {
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
    const approvalError = validateApproval(
      input.approval, operationId, input.policyDecision, input.riskLevel
    );
    if (approvalError) violations.push(approvalError);
  } else if (input.approval !== undefined) {
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
      operationId,
      requester: { id: input.requester.id.trim(), type: input.requester.type.trim() },
      workspace: input.workspace,
      objective: input.objective.trim(),
      policyDecision: input.policyDecision,
      riskLevel: input.riskLevel,
      idempotency: input.idempotency,
      approval: input.riskLevel === 'R3' ? input.approval : null,
      events: input.events
    }
  });
}

module.exports = { createOperationRecord };
