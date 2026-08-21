#!/usr/bin/env node

'use strict';

const crypto = require('crypto');
const path = require('path');
const {
  canonicalizeAuthorizedRoot
} = require('./workspace-boundary');
const { evaluateVerifiedHumanIdentityAssertion } = require('./human-identity-assertion');
const { classifyExpiry } = require('./authoritative-clock');

const LEVEL_ORDER = Object.freeze({ R0: 0, R1: 1, R2: 2, R3: 3 });
const LEGACY_RISK = Object.freeze({ BAIXO: 'R1', MÉDIO: 'R2', ALTO: 'R3' });
const LEGACY_LABEL = Object.freeze({ R0: 'BAIXO', R1: 'BAIXO', R2: 'MÉDIO', R3: 'ALTO' });
const MODES = new Set(['OBSERVE', 'PATCH', 'REFRACTOR']);
const REQUIRED_FACTS = ['readOnly', 'externalEffect', 'reversible', 'sensitive', 'critical', 'irreversible'];

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function authorityFingerprint(fields) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(fields))).digest('hex');
}

function evaluateR3ApprovalAuthority(candidate, expected = {}, temporalAuthority = {}) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return deepFreeze({ decision: 'DENIED', reason: 'R3 approval authority is missing.', authority: null });
  }
  const workspaceInput = typeof candidate.workspace === 'string' ? candidate.workspace.trim() : '';
  let canonicalWorkspace = null;
  try {
    canonicalWorkspace = path.isAbsolute(workspaceInput) &&
      path.normalize(workspaceInput) === workspaceInput
      ? canonicalizeAuthorizedRoot(workspaceInput)
      : null;
  } catch {}
  const workspace = canonicalWorkspace;
  const timestamp = Date.parse(candidate.timestamp);
  const expiresAt = Date.parse(candidate.expiresAt);
  const approver = candidate.approver;
  const identityEvaluation = evaluateVerifiedHumanIdentityAssertion(
    candidate.verifiedIdentityAssertion,
    {
      subjectId: approver && approver.id,
      operationId: candidate.operationId,
      workspace,
      tenantId: candidate.tenantId === undefined ? null : candidate.tenantId,
      projectId: candidate.projectId === undefined ? null : candidate.projectId
    },
    temporalAuthority
  );
  const verifiedIdentityAssertion = identityEvaluation.assertion;
  const fields = {
    approvalAuthorityId: candidate.approvalAuthorityId,
    operationId: candidate.operationId,
    approver: approver && { id: approver.id, type: approver.type },
    decision: candidate.decision,
    riskLevel: candidate.riskLevel,
    capabilityType: candidate.capabilityType,
    action: candidate.action,
    workspace,
    tenantId: candidate.tenantId === undefined ? null : candidate.tenantId,
    projectId: candidate.projectId === undefined ? null : candidate.projectId,
    scope: canonicalize(candidate.scope),
    policyDecision: candidate.policyDecision,
    timestamp: candidate.timestamp,
    expiresAt: candidate.expiresAt,
    verifiedIdentityAssertionFingerprint: verifiedIdentityAssertion
      ? verifiedIdentityAssertion.fingerprint : null
  };
  const computed = authorityFingerprint(fields);
  const valid = typeof fields.approvalAuthorityId === 'string' && fields.approvalAuthorityId.trim() &&
    typeof fields.operationId === 'string' && fields.operationId.trim() &&
    approver && typeof approver.id === 'string' && approver.id.trim() && approver.type === 'HUMAN' &&
    fields.decision === 'APPROVED' && fields.riskLevel === 'R3' &&
    fields.capabilityType === 'FILESYSTEM_PATCH' && fields.action === 'PATCH_FILE' &&
    canonicalWorkspace && fields.scope && typeof fields.scope === 'object' &&
    fields.policyDecision === 'APPROVAL_REQUIRED' && Number.isFinite(timestamp) &&
    Number.isFinite(expiresAt) && expiresAt > timestamp &&
    identityEvaluation.decision === 'VERIFIED' &&
    Date.parse(fields.timestamp) >= Date.parse(verifiedIdentityAssertion.issuedAt) &&
    Date.parse(fields.expiresAt) <= Date.parse(verifiedIdentityAssertion.expiresAt) &&
    (!candidate.verifiedIdentityAssertionFingerprint ||
      candidate.verifiedIdentityAssertionFingerprint === verifiedIdentityAssertion.fingerprint) &&
    (!candidate.fingerprint || candidate.fingerprint === computed);
  if (!valid) {
    return deepFreeze({ decision: 'DENIED', reason: 'R3 approval authority is malformed.', authority: null });
  }
  for (const callerTime of ['now', 'currentTime', 'validationTime', 'observedAt']) {
    if (Object.prototype.hasOwnProperty.call(expected, callerTime)) {
      return deepFreeze({ decision: 'DENIED',
        reason: 'Caller-supplied current time cannot authorize R3 approval.', authority: null });
    }
  }
  const expectedFields = { ...expected };
  if (Object.prototype.hasOwnProperty.call(expectedFields, 'workspace')) {
    const expectedWorkspaceInput = typeof expectedFields.workspace === 'string'
      ? expectedFields.workspace.trim() : '';
    try {
      expectedFields.workspace = path.isAbsolute(expectedWorkspaceInput) &&
        path.normalize(expectedWorkspaceInput) === expectedWorkspaceInput
        ? canonicalizeAuthorizedRoot(expectedWorkspaceInput)
        : null;
    } catch {
      expectedFields.workspace = null;
    }
    if (!expectedFields.workspace) {
      return deepFreeze({ decision: 'DENIED', reason: 'R3 approval authority workspace mismatch.', authority: null });
    }
  }
  for (const [key, value] of Object.entries(expectedFields)) {
    if (value !== undefined && JSON.stringify(canonicalize(fields[key])) !==
        JSON.stringify(canonicalize(value))) {
      return deepFreeze({ decision: 'DENIED', reason: `R3 approval authority ${key} mismatch.`, authority: null });
    }
  }
  if (temporalAuthority.requireCurrent === true && !temporalAuthority.reading) {
    return deepFreeze({ decision: 'DENIED',
      reason: 'Authoritative clock evidence is required for R3 approval.', authority: null });
  }
  if (temporalAuthority.reading) {
    let expiry;
    try {
      expiry = classifyExpiry(temporalAuthority.reading, {
        issuedAt: fields.timestamp,
        expiresAt: fields.expiresAt
      });
    } catch {
      return deepFreeze({ decision: 'DENIED',
        reason: 'Authoritative R3 approval time evidence is malformed.', authority: null });
    }
    if (expiry.decision !== 'ALLOWED') {
      return deepFreeze({ decision: 'DENIED', reason: 'R3 approval authority is expired or not yet valid.', authority: null });
    }
  }
  return deepFreeze({
    decision: 'ALLOWED', reason: 'Bound R3 human approval authority is valid.',
    authority: { ...fields, verifiedIdentityAssertion, fingerprint: computed }
  });
}

function denied(reason, details = {}) {
  return {
    schema: 'sdo.risk_policy.v1',
    classification: {
      level: details.level || null,
      risk: details.level ? LEGACY_LABEL[details.level] : null,
      mode: details.mode || null,
      executionAllowed: false
    },
    policy: { decision: 'DENIED', reason },
    signals: details.signals || [],
    reasons: [reason],
    governance: {
      explicitAuthorizationRequired: details.level === 'R3',
      humanApprovalRequired: details.level === 'R3',
      denyByDefault: true,
      declarativeInspectionRequired: true
    }
  };
}

function normalizeMode(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const mode = value.trim().toUpperCase();
  return MODES.has(mode) ? mode : null;
}

function normalizeCallerRisk(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const risk = value.trim().toUpperCase();
  if (Object.prototype.hasOwnProperty.call(LEVEL_ORDER, risk)) return risk;
  if (Object.prototype.hasOwnProperty.call(LEGACY_RISK, risk)) return LEGACY_RISK[risk];
  return undefined;
}

function highestLevel(...levels) {
  return levels.filter(Boolean).sort(
    (left, right) => LEVEL_ORDER[right] - LEVEL_ORDER[left]
  )[0];
}

function validateFacts(facts) {
  if (!facts || typeof facts !== 'object' || Array.isArray(facts)) {
    return 'Required operation facts are missing.';
  }
  for (const name of REQUIRED_FACTS) {
    if (typeof facts[name] !== 'boolean') {
      return `Required operation fact is missing or ambiguous: ${name}.`;
    }
  }
  if (facts.readOnly && facts.reversible) {
    return 'Operation facts are ambiguous: read-only operations are not reversible mutations.';
  }
  if (facts.readOnly && (facts.externalEffect || facts.sensitive || facts.critical || facts.irreversible)) {
    return 'Operation facts are contradictory for a read-only operation.';
  }
  if (facts.irreversible && !facts.critical) {
    return 'Operation facts are ambiguous: irreversible operations must be critical.';
  }
  if (!facts.readOnly && !facts.reversible && !facts.irreversible) {
    return 'Operation facts are ambiguous: mutations must declare reversibility.';
  }
  return null;
}

function validateNumericFacts(input) {
  if (!Number.isFinite(input.estimatedDiffLines) || input.estimatedDiffLines < 0) {
    return 'estimatedDiffLines must be a finite non-negative number.';
  }
  if (!Array.isArray(input.files) || input.files.length === 0) {
    return 'A non-empty file scope is required.';
  }
  for (const file of input.files) {
    if (!file || !Number.isFinite(file.lines) || file.lines < 0) {
      return 'Every file line count must be a finite non-negative number.';
    }
  }
  return null;
}

function validateModeFacts(mode, facts) {
  if (mode === 'OBSERVE' && !facts.readOnly) {
    return 'Operation mode and facts are contradictory: OBSERVE must be read-only.';
  }
  if (mode !== 'OBSERVE' && facts.readOnly) {
    return `Operation mode and facts are contradictory: ${mode} is mutating.`;
  }
  return null;
}

function computedLevel(input, mode, signals, reasons) {
  const facts = input.facts;
  let level = facts.readOnly ? 'R0' : 'R1';
  function raise(next, signal, reason) {
    level = highestLevel(level, next);
    signals.push(signal);
    reasons.push(reason);
  }
  if (facts.sensitive || facts.externalEffect || input.files.length > 1 ||
      input.files.some((file) => file.lines > 300) || input.estimatedDiffLines > 30) {
    raise('R2', 'SENSITIVE_OPERATION', 'Sensitive or expanded operational scope requires R2 treatment.');
  }
  if (facts.critical || facts.irreversible || mode === 'REFRACTOR' ||
      input.architecturalChange === true || input.estimatedDiffLines > 100) {
    raise('R3', 'CRITICAL_OPERATION', 'Critical, irreversible, architectural or broad scope requires R3 treatment.');
  }
  return level;
}

function evaluatePolicy(policy, level, input, temporalAuthority) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    return { decision: 'DENIED', reason: 'Policy is missing.' };
  }
  if (!['ALLOW', 'DENY', 'APPROVAL_REQUIRED'].includes(policy.decision)) {
    return { decision: 'DENIED', reason: 'Policy decision is missing or ambiguous.' };
  }
  if (policy.decision === 'DENY') {
    return { decision: 'DENIED', reason: 'Policy explicitly denied the operation.' };
  }
  if (level !== 'R3' && policy.decision !== 'ALLOW') {
    return { decision: 'DENIED', reason: 'Approval-required policy is invalid for non-R3 risk.' };
  }
  if (level === 'R3') {
    if (policy.decision !== 'APPROVAL_REQUIRED') {
      return { decision: 'DENIED', underlyingDecision: 'APPROVAL_REQUIRED',
        reason: 'R3 policy must remain APPROVAL_REQUIRED until bound approval.' };
    }
    const evaluation = evaluateR3ApprovalAuthority(policy.approvalAuthority, {
      operationId: input.operationId, workspace: input.workspace,
      capabilityType: input.capabilityType, action: input.action,
      scope: input.scope, riskLevel: 'R3', policyDecision: 'APPROVAL_REQUIRED',
      tenantId: input.tenantId === undefined ? null : input.tenantId,
      projectId: input.projectId === undefined ? null : input.projectId
    }, temporalAuthority);
    if (evaluation.decision !== 'ALLOWED') {
      return { decision: 'DENIED', underlyingDecision: 'APPROVAL_REQUIRED',
        reason: evaluation.reason, approvalAuthority: null };
    }
    return { decision: 'ALLOWED', underlyingDecision: 'APPROVAL_REQUIRED',
      reason: 'Explicit R3 approval authority satisfies policy.',
      approvalAuthority: evaluation.authority };
  }
  return { decision: 'ALLOWED', reason: 'Explicit policy requirements are satisfied.' };
}

function classifyScope(input, temporalAuthority = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return denied('Classification input is missing or invalid.');
  }
  const mode = normalizeMode(input.mode);
  if (!mode) return denied('Execution mode is missing or unsupported.');
  const factError = validateFacts(input.facts);
  if (factError) return denied(factError, { mode });
  const modeFactError = validateModeFacts(mode, input.facts);
  if (modeFactError) return denied(modeFactError, { mode });
  const numericError = validateNumericFacts(input);
  if (numericError) return denied(numericError, { mode });
  if (typeof input.architecturalChange !== 'boolean' || typeof input.worktreeClean !== 'boolean') {
    return denied('Required classification facts are missing or ambiguous.', { mode });
  }
  const callerRisk = normalizeCallerRisk(input.risk);
  if (callerRisk === undefined) return denied('Caller-supplied risk is malformed or ambiguous.', { mode });

  const signals = [];
  const reasons = [];
  const calculatedLevel = computedLevel(input, mode, signals, reasons);
  const level = highestLevel(calculatedLevel, callerRisk);
  if (callerRisk && LEVEL_ORDER[callerRisk] > LEVEL_ORDER[calculatedLevel]) {
    signals.push('CALLER_RISK_ELEVATION');
    reasons.push('Caller-supplied risk elevated the computed risk.');
  }
  if (!input.worktreeClean && level !== 'R0') {
    return denied('Mutating operations require a clean worktree.', { level, mode, signals });
  }

  const policy = evaluatePolicy(input.policy, level, input, temporalAuthority);
  const allowed = policy.decision === 'ALLOWED';
  return {
    schema: 'sdo.risk_policy.v1',
    classification: {
      level,
      computedLevel: calculatedLevel,
      callerRisk,
      risk: LEGACY_LABEL[level],
      mode,
      executionAllowed: allowed
    },
    policy,
    signals,
    reasons,
    governance: {
      explicitAuthorizationRequired: level === 'R3',
      humanApprovalRequired: level === 'R3',
      denyByDefault: true,
      patchModeDefault: mode === 'PATCH',
      worktreeCleanRequired: level !== 'R0',
      declarativeInspectionRequired: true,
      focusWindowThresholdLines: 300
    }
  };
}

module.exports = { classifyScope, evaluateR3ApprovalAuthority, authorityFingerprint };
