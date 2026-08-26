'use strict';

const crypto = require('node:crypto');
const {
  createNaturalTaskAuthorityEnvelope,
  evaluateNaturalEvidenceRequest
} = require('./natural-task-authority');

const PROPOSAL_SCHEMA = 'sdo.natural_task_envelope_proposal.v1';
const AUTHORIZATION_SCHEMA = 'sdo.natural_task_envelope_authorization.v1';
const EVALUATION_SCHEMA = 'sdo.natural_task_envelope_operation_evaluation.v1';
const RISK = Object.freeze({ R0: 0, R1: 1, R2: 2, R3: 3 });

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function sha(value, label) {
  const result = text(value, label);
  if (!/^[a-f0-9]{64}$/.test(result)) throw new Error(`${label} must be canonical SHA-256.`);
  return result;
}

function time(value, label) {
  const result = text(value, label);
  if (!Number.isFinite(Date.parse(result)) || new Date(Date.parse(result)).toISOString() !== result) {
    throw new Error(`${label} must be canonical ISO-8601.`);
  }
  return result;
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function createNaturalTaskEnvelopeProposal({
  task,
  workspaceRoot,
  physicalWorkspaceIdentity,
  riskCeiling = 'R0',
  validFrom,
  expiresAt
} = {}) {
  if (!(riskCeiling in RISK)) throw new Error('Qualified task risk ceiling is required.');
  const issued = time(validFrom, 'Task validity start');
  const expiry = time(expiresAt, 'Task expiry');
  if (Date.parse(expiry) <= Date.parse(issued) || Date.parse(expiry) - Date.parse(issued) > 30 * 60_000) {
    throw new Error('Task validity must be positive and no longer than 30 minutes.');
  }
  const containment = createNaturalTaskAuthorityEnvelope({ task, workspaceRoot });
  const binding = deepFreeze({
    schema: PROPOSAL_SCHEMA,
    objective: containment.objective,
    taskKind: containment.taskKind,
    workspaceRoot: containment.workspaceRoot,
    physicalWorkspaceIdentity: sha(physicalWorkspaceIdentity, 'Physical workspace identity'),
    allowedCapabilityVocabulary: [...containment.authority.evidenceKinds],
    riskCeiling,
    evidenceStepCeiling: containment.authority.maxEvidenceSteps,
    mutationPolicy: 'FORBIDDEN',
    credentialUse: 'FORBIDDEN',
    externalSideEffects: 'FORBIDDEN',
    architecturalDecision: 'STOP_FOR_HUMAN',
    validFrom: issued,
    expiresAt: expiry,
    containmentEnvelope: containment,
    operationalAuthority: false,
    mutationAuthority: false
  });
  return deepFreeze({ ...binding, proposalFingerprint: fingerprint(binding) });
}

function authorizeNaturalTaskEnvelope(proposal, humanDecision) {
  if (!proposal || proposal.schema !== PROPOSAL_SCHEMA || !Object.isFrozen(proposal)) {
    throw new Error('Immutable task-envelope proposal is required.');
  }
  if (
    !humanDecision || !Object.isFrozen(humanDecision) || humanDecision.approved !== true ||
    humanDecision.proposalFingerprint !== proposal.proposalFingerprint ||
    typeof humanDecision.humanSubject !== 'string' || !humanDecision.humanSubject.trim()
  ) throw new Error('Exact explicit human authorization is required.');

  return deepFreeze({
    schema: AUTHORIZATION_SCHEMA,
    proposal,
    humanSubject: humanDecision.humanSubject.trim(),
    authorizedAt: time(humanDecision.authorizedAt, 'Authorization time'),
    authorizationFingerprint: fingerprint({
      proposalFingerprint: proposal.proposalFingerprint,
      humanSubject: humanDecision.humanSubject.trim(),
      authorizedAt: humanDecision.authorizedAt
    }),
    active: true,
    reusableApproval: false,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function decision(envelope, status, reason, governedIntent = null) {
  return deepFreeze({
    schema: EVALUATION_SCHEMA,
    decision: status,
    reason,
    authorizationFingerprint: envelope.authorizationFingerprint,
    governedIntent,
    requiresNewHumanAuthority: status !== 'CONTAINED',
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function evaluateNaturalTaskEnvelopeOperation(envelope, request, { now } = {}) {
  if (!envelope || envelope.schema !== AUTHORIZATION_SCHEMA || !Object.isFrozen(envelope)) {
    throw new Error('Immutable authorized task envelope is required.');
  }
  if (!request || !Object.isFrozen(request)) throw new Error('Immutable task microoperation is required.');
  const observed = time(now, 'Authoritative evaluation time');
  const proposal = envelope.proposal;
  if (Date.parse(observed) < Date.parse(proposal.validFrom) || Date.parse(observed) >= Date.parse(proposal.expiresAt)) {
    return decision(envelope, 'STOPPED', 'Task-envelope authority is not currently valid.');
  }
  if (request.physicalWorkspaceIdentity !== proposal.physicalWorkspaceIdentity) {
    return decision(envelope, 'STOPPED', 'Physical workspace expansion requires new human authority.');
  }
  if (request.mutating === true || request.mutationRequested === true) {
    return decision(envelope, 'STOPPED', 'Mutation requires new human authority.');
  }
  if (request.credentialUse === true || request.externalSideEffect === true) {
    return decision(envelope, 'STOPPED', 'Credential use or external side effect requires new human authority.');
  }
  if (request.architecturalDecision === true) {
    return decision(envelope, 'STOPPED', 'Architectural decision remains human-sovereign.');
  }
  if (!(request.risk in RISK) || RISK[request.risk] > RISK[proposal.riskCeiling]) {
    return decision(envelope, 'STOPPED', 'Risk expansion requires new human authority.');
  }
  if (!proposal.allowedCapabilityVocabulary.includes(request.evidenceRequest?.kind)) {
    return decision(envelope, 'STOPPED', 'Capability expansion requires new human authority.');
  }

  const containment = evaluateNaturalEvidenceRequest(
    proposal.containmentEnvelope,
    request.evidenceRequest,
    { evidenceStep: request.evidenceStep }
  );
  if (containment.decision !== 'CONTAINED') {
    return decision(envelope, 'STOPPED', containment.reason);
  }
  return decision(
    envelope,
    'CONTAINED',
    'Microoperation remains inside the exact human-authorized task envelope.',
    containment.governedIntent
  );
}

module.exports = Object.freeze({
  PROPOSAL_SCHEMA,
  AUTHORIZATION_SCHEMA,
  EVALUATION_SCHEMA,
  createNaturalTaskEnvelopeProposal,
  authorizeNaturalTaskEnvelope,
  evaluateNaturalTaskEnvelopeOperation
});
