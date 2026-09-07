'use strict';

const crypto = require('node:crypto');
const path = require('node:path');

const SCHEMA = 'sdo.mission_runner_policy.v1';
const ENVELOPE_SCHEMA = 'sdo.mission_execution_envelope.v1';
const RISKS = Object.freeze(['BAIXO', 'MÉDIO', 'ALTO']);
const RISK_ORDER = Object.freeze({ BAIXO: 0, MÉDIO: 1, ALTO: 2 });
const ENVIRONMENTS = Object.freeze(['localhost', 'Preview', 'Production']);
const STOP_SIGNALS = Object.freeze([
  'authorityExpansion',
  'credentialRequired',
  'destructive',
  'production',
  'publication',
  'scopeExpansion'
]);

const DEFAULT_FRICTION_BUDGET = Object.freeze({
  BAIXO: Object.freeze({ gates: 1, interruptions: 1, manualActions: 1 }),
  MÉDIO: Object.freeze({ gates: 2, interruptions: 2, manualActions: 2 }),
  ALTO: Object.freeze({ gates: 3, interruptions: 3, manualActions: 3 })
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
  );
}

function fingerprint(label, value) {
  return crypto
    .createHash('sha256')
    .update(`${label}\0${JSON.stringify(canonicalize(value))}`, 'utf8')
    .digest('hex');
}

function requireText(value, label, maximum = 4096) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value !== value.trim() ||
    value.length > maximum ||
    value.includes('\0')
  ) {
    throw new Error(`${label} is malformed.`);
  }
  return value;
}

function requireStringList(value, label, maximum = 32) {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximum) {
    throw new Error(`${label} is malformed.`);
  }
  const normalized = [...new Set(value.map((item) => requireText(item, label, 1024)))];
  if (normalized.length !== value.length) throw new Error(`${label} contains duplicates.`);
  return normalized.sort();
}

function requireCount(value, label) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} is malformed.`);
  return value;
}

function createMissionExecutionEnvelope({
  objective,
  workspace,
  environment = 'localhost',
  risk = 'BAIXO',
  allowedOperations,
  allowedTargets,
  completionCriterion,
  frictionBudget = null,
  equivalentAttemptCeiling = 2
} = {}) {
  const normalizedRisk = requireText(risk, 'Mission risk', 16).toUpperCase();
  if (!RISKS.includes(normalizedRisk)) throw new Error('Mission risk is unsupported.');
  if (!ENVIRONMENTS.includes(environment)) throw new Error('Mission environment is unsupported.');
  if (equivalentAttemptCeiling !== 2) {
    throw new Error('Mission equivalent-attempt ceiling must be exactly two.');
  }
  const budget = frictionBudget || DEFAULT_FRICTION_BUDGET[normalizedRisk];
  const normalizedBudget = {
    gates: requireCount(budget.gates, 'Friction gate budget'),
    interruptions: requireCount(budget.interruptions, 'Friction interruption budget'),
    manualActions: requireCount(budget.manualActions, 'Friction manual-action budget')
  };
  const fields = {
    schema: ENVELOPE_SCHEMA,
    objective: requireText(objective, 'Mission objective'),
    workspace: requireText(workspace, 'Mission workspace', 1024),
    environment,
    risk: normalizedRisk,
    allowedOperations: requireStringList(allowedOperations, 'Allowed operation'),
    allowedTargets: requireStringList(allowedTargets, 'Allowed target'),
    completionCriterion: requireText(completionCriterion, 'Completion criterion'),
    frictionBudget: normalizedBudget,
    equivalentAttemptCeiling,
    operationalAuthority: false,
    mutationAuthority: false,
    publicationAuthority: false
  };
  return deepFreeze({
    ...fields,
    envelopeFingerprint: fingerprint(ENVELOPE_SCHEMA, fields)
  });
}

function validateMissionExecutionEnvelope(value) {
  if (
    !value ||
    value.schema !== ENVELOPE_SCHEMA ||
    !Object.isFrozen(value) ||
    !/^[a-f0-9]{64}$/.test(value.envelopeFingerprint || '') ||
    value.operationalAuthority !== false ||
    value.mutationAuthority !== false ||
    value.publicationAuthority !== false
  ) {
    throw new Error('Immutable mission execution envelope is required.');
  }
  const recreated = createMissionExecutionEnvelope(value);
  if (recreated.envelopeFingerprint !== value.envelopeFingerprint) {
    throw new Error('Mission execution envelope fingerprint mismatch.');
  }
  return value;
}

function evidenceIdentity({ workspace, target, sha256, environment } = {}) {
  const lexicalTarget = requireText(target, 'Evidence target', 1024).replace(/\\/g, '/');
  if (lexicalTarget.startsWith('/') || lexicalTarget.split('/').includes('..')) {
    throw new Error('Evidence target is malformed.');
  }
  const canonicalTarget = path.posix.normalize(lexicalTarget).replace(/^\.\//, '');
  if (!canonicalTarget || canonicalTarget === '.') throw new Error('Evidence target is malformed.');
  const identity = {
    workspace: requireText(workspace, 'Evidence workspace', 1024),
    target: canonicalTarget,
    sha256: requireText(sha256, 'Evidence SHA-256', 64),
    environment: requireText(environment, 'Evidence environment', 64)
  };
  if (!/^[a-f0-9]{64}$/.test(identity.sha256)) {
    throw new Error('Evidence SHA-256 is malformed.');
  }
  return deepFreeze({
    ...identity,
    evidenceFingerprint: fingerprint('sdo.reusable_evidence_identity.v1', identity)
  });
}

function canReuseEvidence(previous, current) {
  try {
    const left = evidenceIdentity(previous);
    const right = evidenceIdentity(current);
    return left.evidenceFingerprint === right.evidenceFingerprint;
  } catch {
    return false;
  }
}

function decision(classification, reason, details = {}) {
  return deepFreeze({
    schema: SCHEMA,
    classification,
    reason,
    ...details,
    operationalAuthority: false,
    mutationAuthority: false,
    publicationAuthority: false,
    authorityExpansion: false
  });
}

function evaluateMissionRunnerStep({
  envelope,
  operation,
  target,
  risk,
  signals = {},
  frictionSpent = {},
  equivalentAttempts = 0,
  previousEvidence = null,
  currentEvidence = null
} = {}) {
  const mission = validateMissionExecutionEnvelope(envelope);
  const requestedOperation = requireText(operation, 'Requested operation', 256);
  const requestedTarget = requireText(target, 'Requested target', 1024);
  const requestedRisk = requireText(risk || mission.risk, 'Requested risk', 16).toUpperCase();
  if (!RISKS.includes(requestedRisk)) return decision('BLOCKED', 'Requested risk is unsupported.');
  if (!mission.allowedOperations.includes(requestedOperation) ||
      !mission.allowedTargets.includes(requestedTarget)) {
    return decision('BLOCKED', 'Requested step expands the authorized mission scope.');
  }
  if (RISK_ORDER[requestedRisk] > RISK_ORDER[mission.risk]) {
    return decision('HUMAN_AUTHORITY_REQUIRED', 'Requested step increases mission risk.');
  }
  if (equivalentAttempts >= mission.equivalentAttemptCeiling) {
    return decision('BLOCKED', 'Two equivalent attempts ended without verified progress.');
  }
  for (const signal of STOP_SIGNALS) {
    if (signals[signal] === true) {
      return decision(
        'HUMAN_AUTHORITY_REQUIRED',
        `Requested step reached the ${signal} boundary.`
      );
    }
  }
  const spent = {
    gates: requireCount(frictionSpent.gates || 0, 'Spent gates'),
    interruptions: requireCount(frictionSpent.interruptions || 0, 'Spent interruptions'),
    manualActions: requireCount(frictionSpent.manualActions || 0, 'Spent manual actions')
  };
  for (const name of Object.keys(spent)) {
    if (spent[name] > mission.frictionBudget[name]) {
      return decision('BLOCKED', `Mission friction budget exceeded for ${name}.`);
    }
  }
  if (previousEvidence && currentEvidence && canReuseEvidence(previousEvidence, currentEvidence)) {
    return decision('REUSE_EVIDENCE', 'Physical evidence identity is unchanged.', {
      evidenceFingerprint: evidenceIdentity(currentEvidence).evidenceFingerprint
    });
  }
  return decision('CONTINUE', 'Step remains inside the authorized mission envelope.');
}

module.exports = Object.freeze({
  SCHEMA,
  ENVELOPE_SCHEMA,
  RISKS,
  ENVIRONMENTS,
  DEFAULT_FRICTION_BUDGET,
  createMissionExecutionEnvelope,
  validateMissionExecutionEnvelope,
  evidenceIdentity,
  canReuseEvidence,
  evaluateMissionRunnerStep
});
