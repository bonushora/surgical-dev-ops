#!/usr/bin/env node

'use strict';

const fs = require('fs');
const {
  describeOperationStateContract,
  resolveLifecycleTransition,
  classifyStateBoundary
} = require('../reconstruction/v3/core/operation-state-contract');

const SCHEMA = 'sdo.state.v1';
const LIFECYCLE_SCHEMA = 'sdo.lifecycle.v1';
const OPERATION_STATE_CONTRACT =
  describeOperationStateContract();
const LIFECYCLE_STATES =
  new Set(OPERATION_STATE_CONTRACT.lifecycleStates);
const INITIAL_LIFECYCLE_STATES =
  new Set(OPERATION_STATE_CONTRACT.initialLifecycleStates);
const TERMINAL_STATES =
  new Set(OPERATION_STATE_CONTRACT.terminalLifecycleStates);
const TRANSITION_TYPES =
  new Set(OPERATION_STATE_CONTRACT.transitionTypes);

function requireObject(value, name) {
  if (!value || typeof value !== 'object') {
    throw new Error(`${name} must be an object.`);
  }
}

function requireString(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeRepositoryState(state, name) {
  requireObject(state, name);

  return {
    path: requireString(state.path, `${name}.path`),
    branch:
      state.branch === null
        ? null
        : requireString(state.branch, `${name}.branch`),
    commit: requireString(
      state.commit,
      `${name}.commit`
    ),
    shortCommit: requireString(
      state.shortCommit,
      `${name}.shortCommit`
    ),
    clean: state.clean === true,
    changedFiles: Array.isArray(state.changedFiles)
      ? [...state.changedFiles]
      : []
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireTimestamp(value, name) {
  const timestamp = requireString(value, name);
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== timestamp) {
    throw new Error(`${name} must be a canonical ISO timestamp.`);
  }
  return timestamp;
}

function normalizeLifecycleEvidence(state, name) {
  const normalized = normalizeRepositoryState(state, name);
  if (typeof state.clean !== 'boolean') {
    throw new Error(`${name}.clean must be a boolean.`);
  }
  if (!Array.isArray(state.changedFiles) ||
      state.changedFiles.some((file) => typeof file !== 'string')) {
    throw new Error(`${name}.changedFiles must be an array of strings.`);
  }
  return normalized;
}

function createLifecycle({ operationId, initialState, before, createdAt }) {
  const normalizedOperationId = requireString(operationId, 'operationId');
  const state = requireString(initialState, 'initialState').toUpperCase();
  if (!LIFECYCLE_STATES.has(state)) {
    throw new Error(`Unknown lifecycle state: ${state}`);
  }
  if (!INITIAL_LIFECYCLE_STATES.has(state)) {
    throw new Error(`Invalid initial lifecycle state: ${state}`);
  }
  return deepFreeze({
    schema: LIFECYCLE_SCHEMA,
    operationId: normalizedOperationId,
    status: state,
    evidence: {
      before: normalizeLifecycleEvidence(before, 'before'),
      after: null
    },
    transitions: [],
    temporal: {
      createdAt: requireTimestamp(createdAt, 'createdAt'),
      terminalAt: state === 'NOT_EXECUTABLE'
        ? requireTimestamp(createdAt, 'createdAt')
        : null
    }
  });
}

function normalizeLifecycleTransition(transition) {
  requireObject(transition, 'transition');
  const type = requireString(transition.type, 'transition.type').toUpperCase();
  if (!TRANSITION_TYPES.has(type)) {
    throw new Error(`Unknown lifecycle transition: ${type}`);
  }
  const normalized = {
    transitionId: requireString(transition.transitionId, 'transition.transitionId'),
    operationId: requireString(transition.operationId, 'transition.operationId'),
    type,
    occurredAt: requireTimestamp(transition.occurredAt, 'transition.occurredAt')
  };
  if (type === 'COMPLETE') {
    normalized.after = normalizeLifecycleEvidence(transition.after, 'transition.after');
  } else {
    requireObject(transition.failure, 'transition.failure');
    normalized.failure = {
      reason: requireString(transition.failure.reason, 'transition.failure.reason'),
      physicalEvidence: normalizeLifecycleEvidence(
        transition.failure.physicalEvidence,
        'transition.failure.physicalEvidence'
      )
    };
  }
  return normalized;
}

function transitionFingerprint(transition) {
  return JSON.stringify(transition);
}

function transitionLifecycle(lifecycle, transition) {
  requireObject(lifecycle, 'lifecycle');
  if (lifecycle.schema !== LIFECYCLE_SCHEMA || !LIFECYCLE_STATES.has(lifecycle.status)) {
    throw new Error('Unknown or invalid lifecycle state.');
  }
  const normalized = normalizeLifecycleTransition(transition);
  if (normalized.operationId !== lifecycle.operationId) {
    throw new Error('Cross-operation lifecycle transition is forbidden.');
  }
  if (Date.parse(normalized.occurredAt) < Date.parse(lifecycle.temporal.createdAt)) {
    throw new Error('Lifecycle transition cannot precede lifecycle creation.');
  }
  const replay = lifecycle.transitions.find(
    (entry) => entry.transitionId === normalized.transitionId
  );
  if (replay) {
    if (replay.fingerprint !== transitionFingerprint(normalized)) {
      throw new Error('Conflicting duplicate transitionId.');
    }
    return lifecycle;
  }
  if (TERMINAL_STATES.has(lifecycle.status)) {
    throw new Error(`Lifecycle state ${lifecycle.status} is terminal.`);
  }
  if (lifecycle.status !== 'PENDING') {
    throw new Error(`Transition from ${lifecycle.status} is forbidden.`);
  }
  const nextStatus = resolveLifecycleTransition({
    currentStatus: lifecycle.status,
    transitionType: normalized.type
  }).to;
  const after = normalized.type === 'COMPLETE'
    ? normalized.after
    : normalized.failure.physicalEvidence;
  return deepFreeze({
    ...lifecycle,
    status: nextStatus,
    evidence: { before: lifecycle.evidence.before, after },
    transitions: [
      ...lifecycle.transitions,
      { ...normalized, fingerprint: transitionFingerprint(normalized) }
    ],
    temporal: { ...lifecycle.temporal, terminalAt: normalized.occurredAt }
  });
}

function createStateBoundary({
  before,
  operation,
  after = null
}) {
  const normalizedBefore =
    normalizeRepositoryState(
      before,
      'before'
    );

  requireObject(operation, 'operation');

  const normalizedOperation = {
    taskId:
      operation.taskId === undefined
        ? null
        : requireString(
            operation.taskId,
            'operation.taskId'
          ),

    description: requireString(
      operation.description,
      'operation.description'
    ),

    mode: requireString(
      operation.mode,
      'operation.mode'
    ).toUpperCase(),

    risk: requireString(
      operation.risk,
      'operation.risk'
    ).toUpperCase(),

    authorizationStatus:
      requireString(
        operation.authorizationStatus,
        'operation.authorizationStatus'
      ).toUpperCase()
  };

  const normalizedAfter =
    after === null
      ? null
      : normalizeRepositoryState(
          after,
          'after'
        );

  return {
    schema: SCHEMA,

    state: {
      before: normalizedBefore,

      operation: normalizedOperation,

      after: normalizedAfter
    },

    temporal: {
      capturedBeforeAt:
        new Date().toISOString(),

      afterCaptured:
        normalizedAfter !== null
    },

    governance: {
      immutableBeforeState: true,
      afterStateRequiredForCompletion: true,
      snapshotRequiredBeforeMutation: true,
      rollbackAuthority: 'EXTERNAL'
    }
  };
}

function finalizeStateBoundary(boundary, after) {
  requireObject(boundary, 'state boundary');

  if (boundary.schema !== SCHEMA) {
    throw new Error(
      `Invalid state schema: ${boundary.schema}`
    );
  }

  if (!boundary.state || !boundary.state.before) {
    throw new Error(
      'State boundary requires a before state.'
    );
  }

  const normalizedAfter =
    normalizeRepositoryState(
      after,
      'after'
    );

  const completed = {
    ...boundary,

    state: {
      ...boundary.state,
      after: normalizedAfter
    },

    temporal: {
      ...boundary.temporal,
      afterCaptured: true,
      completedAt: new Date().toISOString()
    }
  };

  return completed;
}


function failStateBoundary(boundary, failure = {}) {
  requireObject(boundary, 'state boundary');

  if (boundary.schema !== SCHEMA) {
    throw new Error(
      `Invalid state schema: ${boundary.schema}`
    );
  }

  if (!boundary.state || !boundary.state.before) {
    throw new Error(
      'State boundary requires a before state.'
    );
  }

  const reason =
    failure.reason === undefined
      ? 'Execution failed.'
      : requireString(
          failure.reason,
          'failure.reason'
        );

  return {
    ...boundary,

    state: {
      ...boundary.state,

      operation: {
        ...boundary.state.operation,
        outcome: 'FAILED',
        failureReason: reason
      },

      after: null
    },

    temporal: {
      ...boundary.temporal,
      afterCaptured: false,
      failedAt: new Date().toISOString()
    }
  };
}


function assertTransition(boundary) {
  requireObject(boundary, 'state boundary');

  if (boundary.schema !== SCHEMA) {
    throw new Error(
      `Invalid state schema: ${boundary.schema}`
    );
  }

  if (
    !boundary.state ||
    !boundary.state.before ||
    !boundary.state.operation
  ) {
    throw new Error(
      'State boundary requires before state and operation.'
    );
  }

  /*
   * Preserve the qualified legacy input boundary:
   * every non-AUTHORIZED value remains non-executable
   * and only the exact FAILED outcome represents failure.
   *
   * Normative precedence and status resolution belong
   * exclusively to the canonical R1 contract.
   */
  const classification =
    classifyStateBoundary({
      authorizationStatus:
        boundary.state.operation.authorizationStatus ===
          'AUTHORIZED'
          ? 'AUTHORIZED'
          : 'NOT_AUTHORIZED',
      outcome:
        boundary.state.operation.outcome === 'FAILED'
          ? 'FAILED'
          : null,
      afterPresent:
        boundary.state.after !== null
    });

  return {
    valid: true,
    status: classification.status
  };
}

function main() {
  const before = {
    path: process.cwd(),
    branch: 'main',
    commit: 'example',
    shortCommit: 'example',
    clean: true,
    changedFiles: []
  };

  const boundary = createStateBoundary({
    before,

    operation: {
      description:
        'State boundary validation',
      mode: 'PATCH',
      risk: 'BAIXO',
      authorizationStatus:
        'AUTHORIZED'
    }
  });

  process.stdout.write(
    `${JSON.stringify({
      boundary,
      transition:
        assertTransition(boundary)
    }, null, 2)}\n`
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  createStateBoundary,
  finalizeStateBoundary,
  failStateBoundary,
  assertTransition,
  createLifecycle,
  transitionLifecycle
};
