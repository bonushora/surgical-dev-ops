'use strict';

const CONTRACT_SCHEMA =
  'sdo.reconstruction.operation_state_contract.v1';

const LIFECYCLE_STATES =
  Object.freeze([
    'PENDING',
    'COMPLETED',
    'FAILED',
    'NOT_EXECUTABLE'
  ]);

const INITIAL_LIFECYCLE_STATES =
  Object.freeze([
    'PENDING',
    'NOT_EXECUTABLE'
  ]);

const TERMINAL_LIFECYCLE_STATES =
  Object.freeze([
    'COMPLETED',
    'FAILED',
    'NOT_EXECUTABLE'
  ]);

const TRANSITION_TYPES =
  Object.freeze([
    'COMPLETE',
    'FAIL'
  ]);

const BOUNDARY_STATUSES =
  Object.freeze([
    'PENDING_AFTER_STATE',
    'COMPLETED',
    'FAILED',
    'NOT_EXECUTABLE'
  ]);

const TRANSITION_TABLE =
  Object.freeze({
    PENDING:
      Object.freeze({
        COMPLETE:
          'COMPLETED',
        FAIL:
          'FAILED'
      }),
    COMPLETED:
      Object.freeze({}),
    FAILED:
      Object.freeze({}),
    NOT_EXECUTABLE:
      Object.freeze({})
  });

function deepFreeze(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function canonicalSymbol(value, allowed, name) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    throw new Error(
      name + ' must be a non-empty string.'
    );
  }

  const symbol =
    value.trim().toUpperCase();

  if (!allowed.includes(symbol)) {
    throw new Error(
      'Unknown ' + name + ': ' + symbol
    );
  }

  return symbol;
}

function resolveLifecycleTransition(input) {
  if (
    !input ||
    typeof input !== 'object'
  ) {
    throw new Error(
      'Lifecycle transition input must be an object.'
    );
  }

  const from =
    canonicalSymbol(
      input.currentStatus,
      LIFECYCLE_STATES,
      'lifecycle state'
    );

  const type =
    canonicalSymbol(
      input.transitionType,
      TRANSITION_TYPES,
      'lifecycle transition'
    );

  if (
    TERMINAL_LIFECYCLE_STATES.includes(from)
  ) {
    throw new Error(
      'Lifecycle state ' + from + ' is terminal.'
    );
  }

  const to =
    TRANSITION_TABLE[from][type];

  if (!to) {
    throw new Error(
      'Transition ' + type + ' from ' + from +
      ' is forbidden.'
    );
  }

  return deepFreeze({
    schema:
      CONTRACT_SCHEMA,
    from,
    type,
    to,
    terminal:
      TERMINAL_LIFECYCLE_STATES.includes(to)
  });
}

function classifyStateBoundary(input) {
  if (
    !input ||
    typeof input !== 'object'
  ) {
    throw new Error(
      'State-boundary classification input must be an object.'
    );
  }

  if (
    typeof input.authorizationStatus !== 'string' ||
    !input.authorizationStatus.trim()
  ) {
    throw new Error(
      'authorizationStatus must be a non-empty string.'
    );
  }

  if (typeof input.afterPresent !== 'boolean') {
    throw new Error(
      'afterPresent must be a boolean.'
    );
  }

  const authorizationStatus =
    input.authorizationStatus
      .trim()
      .toUpperCase();

  const outcome =
    input.outcome === undefined ||
    input.outcome === null
      ? null
      : canonicalSymbol(
          input.outcome,
          ['FAILED'],
          'operation outcome'
        );

  let status;

  if (authorizationStatus !== 'AUTHORIZED') {
    status =
      'NOT_EXECUTABLE';
  } else if (outcome === 'FAILED') {
    status =
      'FAILED';
  } else if (input.afterPresent) {
    status =
      'COMPLETED';
  } else {
    status =
      'PENDING_AFTER_STATE';
  }

  return deepFreeze({
    schema:
      CONTRACT_SCHEMA,
    status,
    terminal:
      status !== 'PENDING_AFTER_STATE'
  });
}

function describeOperationStateContract() {
  return deepFreeze({
    schema:
      CONTRACT_SCHEMA,
    lifecycleStates:
      [...LIFECYCLE_STATES],
    initialLifecycleStates:
      [...INITIAL_LIFECYCLE_STATES],
    terminalLifecycleStates:
      [...TERMINAL_LIFECYCLE_STATES],
    transitionTypes:
      [...TRANSITION_TYPES],
    boundaryStatuses:
      [...BOUNDARY_STATUSES],
    transitionTable:
      TRANSITION_TABLE
  });
}

module.exports =
  Object.freeze({
    CONTRACT_SCHEMA,
    describeOperationStateContract,
    resolveLifecycleTransition,
    classifyStateBoundary
  });
