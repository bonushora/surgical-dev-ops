'use strict';

const crypto = require('node:crypto');
const { AUTHORIZATION_SCHEMA } = require('./natural-task-envelope-authorization');

const TASK_STATE_SCHEMA = 'sdo.natural_durable_task_state.v1';
const TRANSITION_SCHEMA = 'sdo.natural_durable_task_transition.v1';
const STATES = Object.freeze(['ACTIVE', 'STOPPED', 'COMPLETED', 'FAILED']);
const TERMINAL = new Set(['COMPLETED', 'FAILED']);
const MAX_TRANSITIONS = 256;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function text(value, label, maximum = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new Error(`${label} is invalid.`);
  }
  return value.trim();
}

function sha(value, label) {
  const result = text(value, label, 64);
  if (!/^[a-f0-9]{64}$/.test(result)) throw new Error(`${label} must be canonical SHA-256.`);
  return result;
}

function time(value, label) {
  const result = text(value, label, 64);
  if (!Number.isFinite(Date.parse(result)) || new Date(Date.parse(result)).toISOString() !== result) {
    throw new Error(`${label} must be canonical ISO-8601.`);
  }
  return result;
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function stateFingerprint(value) {
  const copy = { ...value };
  delete copy.stateFingerprint;
  return fingerprint(copy);
}

function requireAuthorization(authorization) {
  if (!authorization || authorization.schema !== AUTHORIZATION_SCHEMA || !Object.isFrozen(authorization)) {
    throw new Error('Immutable task-envelope authorization is required.');
  }
  return authorization;
}

function validateNaturalDurableTaskState(state) {
  if (!state || state.schema !== TASK_STATE_SCHEMA || !Object.isFrozen(state)) {
    throw new Error('Immutable durable task state is required.');
  }
  if (!STATES.includes(state.status) || !Array.isArray(state.transitions) ||
      !Array.isArray(state.completedEffectFingerprints) || state.transitions.length > MAX_TRANSITIONS ||
      state.stateFingerprint !== stateFingerprint(state)) {
    throw new Error('Durable task state is malformed or has lost integrity.');
  }
  return state;
}

function createNaturalDurableTaskState({ taskId, authorization, createdAt } = {}) {
  const envelope = requireAuthorization(authorization);
  const base = {
    schema: TASK_STATE_SCHEMA,
    taskId: sha(taskId, 'Durable task identity'),
    objective: envelope.proposal.objective,
    physicalWorkspaceIdentity: envelope.proposal.physicalWorkspaceIdentity,
    proposalFingerprint: envelope.proposal.proposalFingerprint,
    authorizationFingerprint: envelope.authorizationFingerprint,
    authorizationExpiresAt: envelope.proposal.expiresAt,
    status: 'ACTIVE',
    createdAt: time(createdAt, 'Task creation time'),
    updatedAt: time(createdAt, 'Task creation time'),
    resumeCount: 0,
    transitions: [],
    completedEffectFingerprints: [],
    currentBoundary: 'AUTHORIZED_TASK_ENVELOPE',
    operationalAuthority: false,
    mutationAuthority: false
  };
  return deepFreeze({ ...base, stateFingerprint: stateFingerprint(base) });
}

function appendTransition(state, input, resumeVerified = false) {
  validateNaturalDurableTaskState(state);
  if (TERMINAL.has(state.status)) throw new Error('Terminal durable task state cannot transition.');
  if (!input || typeof input !== 'object') throw new Error('Task transition is required.');
  if (state.transitions.length >= MAX_TRANSITIONS) throw new Error('Durable task transition bound exceeded.');

  const type = text(input.type, 'Task transition type', 32);
  if (!['PROGRESS', 'EFFECT_COMMITTED', 'STOPPED', 'RESUMED', 'COMPLETED', 'FAILED'].includes(type)) {
    throw new Error('Task transition type is not qualified.');
  }
  if (type === 'RESUMED' && resumeVerified !== true) {
    throw new Error('Resume transition requires verified resume authority.');
  }
  const at = time(input.at, 'Task transition time');
  if (Date.parse(at) < Date.parse(state.updatedAt)) throw new Error('Task transition time cannot move backwards.');
  const summary = text(input.summary, 'Task transition summary');
  const effectFingerprint = input.effectFingerprint == null
    ? null
    : sha(input.effectFingerprint, 'Physical effect fingerprint');
  if (type === 'EFFECT_COMMITTED' && !effectFingerprint) {
    throw new Error('Committed physical effect requires an exact fingerprint.');
  }
  if (type !== 'EFFECT_COMMITTED' && effectFingerprint) {
    throw new Error('Only a committed physical effect may carry an effect fingerprint.');
  }
  if (effectFingerprint && state.completedEffectFingerprints.includes(effectFingerprint)) {
    throw new Error('Duplicate physical effect replay was stopped.');
  }

  const sequence = state.transitions.length + 1;
  const previousTransitionFingerprint = sequence === 1
    ? null
    : state.transitions[sequence - 2].transitionFingerprint;
  const transitionBody = {
    schema: TRANSITION_SCHEMA,
    taskId: state.taskId,
    sequence,
    type,
    summary,
    at,
    effectFingerprint,
    previousTransitionFingerprint
  };
  const transition = deepFreeze({
    ...transitionBody,
    transitionFingerprint: fingerprint(transitionBody),
    operationalAuthority: false,
    mutationAuthority: false
  });
  const status = type === 'STOPPED' ? 'STOPPED'
    : type === 'COMPLETED' ? 'COMPLETED'
      : type === 'FAILED' ? 'FAILED' : 'ACTIVE';
  const next = {
    ...state,
    status,
    updatedAt: at,
    transitions: [...state.transitions, transition],
    completedEffectFingerprints: effectFingerprint
      ? [...state.completedEffectFingerprints, effectFingerprint]
      : [...state.completedEffectFingerprints],
    resumeCount: type === 'RESUMED' ? state.resumeCount + 1 : state.resumeCount,
    currentBoundary: type === 'STOPPED' ? 'HUMAN_RESUME_REQUIRED'
      : type === 'RESUMED' ? 'AUTHORIZED_TASK_ENVELOPE'
        : TERMINAL.has(status) ? 'TERMINAL' : state.currentBoundary
  };
  delete next.stateFingerprint;
  return deepFreeze({ ...next, stateFingerprint: stateFingerprint(next) });
}

function resumeNaturalDurableTaskState(state, { authorization, physicalWorkspaceIdentity, resumedAt } = {}) {
  validateNaturalDurableTaskState(state);
  const envelope = requireAuthorization(authorization);
  const observed = time(resumedAt, 'Task resume time');
  if (TERMINAL.has(state.status)) throw new Error('Terminal durable task cannot resume.');
  if (state.status !== 'STOPPED') throw new Error('Only an explicitly stopped durable task may resume.');
  if (sha(physicalWorkspaceIdentity, 'Physical workspace identity') !== state.physicalWorkspaceIdentity ||
      envelope.proposal.physicalWorkspaceIdentity !== state.physicalWorkspaceIdentity) {
    throw new Error('Durable task cannot resume in another physical workspace.');
  }
  if (envelope.authorizationFingerprint !== state.authorizationFingerprint ||
      envelope.proposal.proposalFingerprint !== state.proposalFingerprint) {
    throw new Error('Durable task resume requires its exact original authorization.');
  }
  if (Date.parse(observed) >= Date.parse(state.authorizationExpiresAt)) {
    throw new Error('Expired task authority cannot be resumed.');
  }
  return appendTransition(state, {
    type: 'RESUMED',
    summary: 'Exact durable task state resumed under verified unexpired authority.',
    at: observed
  }, true);
}

function hasCommittedNaturalTaskEffect(state, effectFingerprint) {
  validateNaturalDurableTaskState(state);
  return state.completedEffectFingerprints.includes(sha(effectFingerprint, 'Physical effect fingerprint'));
}

module.exports = Object.freeze({
  TASK_STATE_SCHEMA,
  TRANSITION_SCHEMA,
  STATES,
  MAX_TRANSITIONS,
  createNaturalDurableTaskState,
  appendNaturalDurableTaskTransition(state, input) {
    return appendTransition(state, input, false);
  },
  resumeNaturalDurableTaskState,
  hasCommittedNaturalTaskEffect,
  validateNaturalDurableTaskState
});
