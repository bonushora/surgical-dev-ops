'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createStateBoundary,
  finalizeStateBoundary,
  failStateBoundary,
  assertTransition,
  createLifecycle,
  transitionLifecycle
} = require('../../accelerator/core/state-boundary');

const CREATED_AT = '2026-08-20T12:00:00.000Z';
const TRANSITION_AT = '2026-08-20T12:01:00.000Z';

function createBeforeState(overrides = {}) {
  return {
    path: '/tmp/sdo-test-fixture',
    branch: 'main',
    commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    shortCommit: 'aaaaaaa',
    clean: true,
    changedFiles: [],
    ...overrides
  };
}

function createAuthorizedBoundary(overrides = {}) {
  return createStateBoundary({
    before: createBeforeState(),
    operation: {
      description: 'State boundary contract',
      mode: 'PATCH',
      risk: 'BAIXO',
      authorizationStatus: 'AUTHORIZED',
      ...overrides
    }
  });
}

function createAfterState(overrides = {}) {
  return {
    path: '/tmp/sdo-test-fixture',
    branch: 'main',
    commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    shortCommit: 'bbbbbbb',
    clean: true,
    changedFiles: [],
    ...overrides
  };
}

test('new authorized state boundary is PENDING_AFTER_STATE', () => {
  const boundary = createAuthorizedBoundary();

  const transition = assertTransition(boundary);

  assert.equal(
    transition.valid,
    true
  );

  assert.equal(
    transition.status,
    'PENDING_AFTER_STATE'
  );

  assert.equal(
    boundary.state.after,
    null
  );
});

test('finalized authorized state boundary is COMPLETED', () => {
  const boundary = createAuthorizedBoundary();

  const finalized =
    finalizeStateBoundary(
      boundary,
      createAfterState()
    );

  const transition =
    assertTransition(finalized);

  assert.equal(
    transition.valid,
    true
  );

  assert.equal(
    transition.status,
    'COMPLETED'
  );

  assert.notEqual(
    finalized.state.after,
    null
  );

  assert.equal(
    finalized.temporal.afterCaptured,
    true
  );

  assert.equal(
    finalized.state.operation.outcome,
    undefined
  );
});

test('failed authorized state boundary is FAILED and not PENDING_AFTER_STATE', () => {
  const boundary = createAuthorizedBoundary();

  const failed =
    failStateBoundary(
      boundary,
      {
        reason: 'Controlled execution failed.'
      }
    );

  const transition =
    assertTransition(failed);

  assert.equal(
    transition.valid,
    true
  );

  assert.equal(
    transition.status,
    'FAILED'
  );

  assert.equal(
    failed.state.operation.outcome,
    'FAILED'
  );

  assert.equal(
    failed.state.operation.failureReason,
    'Controlled execution failed.'
  );

  assert.equal(
    failed.state.after,
    null
  );

  assert.equal(
    failed.temporal.afterCaptured,
    false
  );

  assert.ok(
    failed.temporal.failedAt
  );
});

test('failed state preserves immutable BEFORE snapshot', () => {
  const boundary = createAuthorizedBoundary();

  const failed =
    failStateBoundary(
      boundary,
      {
        reason: 'Execution failed.'
      }
    );

  assert.deepEqual(
    failed.state.before,
    boundary.state.before
  );
});

test('failed state uses default failure reason when omitted', () => {
  const boundary = createAuthorizedBoundary();

  const failed =
    failStateBoundary(boundary);

  assert.equal(
    failed.state.operation.outcome,
    'FAILED'
  );

  assert.equal(
    failed.state.operation.failureReason,
    'Execution failed.'
  );

  assert.equal(
    assertTransition(failed).status,
    'FAILED'
  );
});

test('non-authorized state remains NOT_EXECUTABLE', () => {
  const boundary =
    createStateBoundary({
      before: createBeforeState(),
      operation: {
        description: 'Non executable state',
        mode: 'PATCH',
        risk: 'BAIXO',
        authorizationStatus: 'BLOCKED'
      }
    });

  const transition =
    assertTransition(boundary);

  assert.equal(
    transition.valid,
    true
  );

  assert.equal(
    transition.status,
    'NOT_EXECUTABLE'
  );
});

test('finalization captures the physical AFTER state exactly', () => {
  const boundary = createAuthorizedBoundary();

  const after =
    createAfterState({
      clean: false,
      changedFiles: [
        'src/example.js'
      ]
    });

  const finalized =
    finalizeStateBoundary(
      boundary,
      after
    );

  assert.deepEqual(
    finalized.state.after,
    after
  );

  assert.equal(
    assertTransition(finalized).status,
    'COMPLETED'
  );
});

test('failure requires a non-empty failure reason when explicitly provided', () => {
  const boundary = createAuthorizedBoundary();

  assert.throws(
    () =>
      failStateBoundary(
        boundary,
        {
          reason: ''
        }
      ),
    /failure\.reason must be a non-empty string/
  );
});

function createPendingLifecycle(overrides = {}) {
  return createLifecycle({
    operationId: 'op-1', initialState: 'PENDING',
    before: createBeforeState(), createdAt: CREATED_AT, ...overrides
  });
}

function completeTransition(overrides = {}) {
  return {
    transitionId: 'transition-1', operationId: 'op-1',
    type: 'COMPLETE', occurredAt: TRANSITION_AT,
    after: createAfterState(), ...overrides
  };
}

function failTransition(overrides = {}) {
  return {
    transitionId: 'transition-1', operationId: 'op-1',
    type: 'FAIL', occurredAt: TRANSITION_AT,
    failure: {
      reason: 'Controlled failure.',
      physicalEvidence: createAfterState({ clean: false })
    },
    ...overrides
  };
}

test('lifecycle transitions only from PENDING to COMPLETED', () => {
  assert.equal(
    transitionLifecycle(createPendingLifecycle(), completeTransition()).status,
    'COMPLETED'
  );
});

test('lifecycle transitions only from PENDING to FAILED', () => {
  assert.equal(
    transitionLifecycle(createPendingLifecycle(), failTransition()).status,
    'FAILED'
  );
});

test('PENDING cannot transition to NOT_EXECUTABLE', () => {
  assert.throws(
    () => transitionLifecycle(
      createPendingLifecycle(),
      { ...completeTransition(), type: 'NOT_EXECUTABLE' }
    ),
    /Unknown lifecycle transition/
  );
});

test('COMPLETED is terminal', () => {
  const completed = transitionLifecycle(createPendingLifecycle(), completeTransition());
  assert.throws(
    () => transitionLifecycle(completed, completeTransition({ transitionId: 'transition-2' })),
    /is terminal/
  );
});

test('FAILED is terminal', () => {
  const failed = transitionLifecycle(createPendingLifecycle(), failTransition());
  assert.throws(
    () => transitionLifecycle(failed, failTransition({ transitionId: 'transition-2' })),
    /is terminal/
  );
});

test('NOT_EXECUTABLE is terminal', () => {
  const blocked = createLifecycle({
    operationId: 'op-1', initialState: 'NOT_EXECUTABLE',
    before: createBeforeState(), createdAt: CREATED_AT
  });
  assert.throws(() => transitionLifecycle(blocked, completeTransition()), /is terminal/);
});

test('unknown lifecycle state fails closed', () => {
  const lifecycle = { ...createPendingLifecycle(), status: 'UNKNOWN' };
  assert.throws(() => transitionLifecycle(lifecycle, completeTransition()), /Unknown or invalid/);
});

test('unknown lifecycle transition fails closed', () => {
  assert.throws(
    () => transitionLifecycle(
      createPendingLifecycle(),
      { ...completeTransition(), type: 'RETRY' }
    ),
    /Unknown lifecycle transition/
  );
});

test('cross-operation transition fails closed', () => {
  assert.throws(
    () => transitionLifecycle(
      createPendingLifecycle(),
      completeTransition({ operationId: 'op-2' })
    ),
    /Cross-operation/
  );
});

test('missing transitionId fails closed', () => {
  assert.throws(
    () => transitionLifecycle(
      createPendingLifecycle(),
      completeTransition({ transitionId: undefined })
    ),
    /transition\.transitionId/
  );
});

test('transition timestamp before lifecycle creation fails closed', () => {
  assert.throws(
    () => transitionLifecycle(
      createPendingLifecycle(),
      completeTransition({ occurredAt: '2026-08-20T11:59:59.000Z' })
    ),
    /cannot precede lifecycle creation/
  );
});

test('identical transition replay returns the same deterministic result', () => {
  const transition = completeTransition();
  const completed = transitionLifecycle(createPendingLifecycle(), transition);
  assert.strictEqual(transitionLifecycle(completed, transition), completed);
});

test('conflicting duplicate transitionId fails closed', () => {
  const completed = transitionLifecycle(createPendingLifecycle(), completeTransition());
  assert.throws(
    () => transitionLifecycle(
      completed,
      completeTransition({ after: createAfterState({ clean: false }) })
    ),
    /Conflicting duplicate/
  );
});

test('BEFORE and AFTER transition evidence is deeply immutable', () => {
  const completed = transitionLifecycle(createPendingLifecycle(), completeTransition());
  assert.ok(Object.isFrozen(completed));
  assert.ok(Object.isFrozen(completed.evidence.before));
  assert.ok(Object.isFrozen(completed.evidence.after));
  assert.ok(Object.isFrozen(completed.evidence.after.changedFiles));
  assert.throws(() => { completed.evidence.after.clean = false; }, TypeError);
});

test('operationId is preserved across transitions', () => {
  const completed = transitionLifecycle(createPendingLifecycle(), completeTransition());
  assert.equal(completed.operationId, 'op-1');
  assert.equal(completed.transitions[0].operationId, 'op-1');
});

test('malformed failure physical evidence fails closed', () => {
  const transition = failTransition({
    failure: {
      reason: 'Failure.',
      physicalEvidence: { ...createAfterState(), clean: 'false' }
    }
  });
  assert.throws(
    () => transitionLifecycle(createPendingLifecycle(), transition),
    /physicalEvidence\.clean must be a boolean/
  );
});
