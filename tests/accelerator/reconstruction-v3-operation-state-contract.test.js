'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const {
  createLifecycle,
  transitionLifecycle,
  assertTransition
} =
  require(
    '../../accelerator/core/state-boundary'
  );

const {
  CONTRACT_SCHEMA,
  describeOperationStateContract,
  resolveLifecycleTransition,
  classifyStateBoundary
} =
  require(
    '../../accelerator/reconstruction/v3/core/operation-state-contract'
  );

function repositoryState() {
  return {
    path:
      '/qualified/workspace',
    branch:
      'reconstruction/v3',
    commit:
      'a'.repeat(40),
    shortCommit:
      'a'.repeat(7),
    clean:
      true,
    changedFiles:
      []
  };
}

function lifecycle() {
  return createLifecycle({
    operationId:
      'operation-r1',
    initialState:
      'PENDING',
    before:
      repositoryState(),
    createdAt:
      '2026-08-27T03:00:00.000Z'
  });
}

function legacyBoundary({
  authorizationStatus,
  outcome,
  afterPresent
}) {
  return {
    schema:
      'sdo.state.v1',
    state: {
      before:
        repositoryState(),
      operation: {
        authorizationStatus,
        ...(outcome
          ? { outcome }
          : {})
      },
      after:
        afterPresent
          ? repositoryState()
          : null
    }
  };
}

test(
  'R1 exposes one deeply immutable canonical state vocabulary',
  () => {
    const contract =
      describeOperationStateContract();

    assert.equal(
      contract.schema,
      CONTRACT_SCHEMA
    );

    assert.deepEqual(
      contract.lifecycleStates,
      [
        'PENDING',
        'COMPLETED',
        'FAILED',
        'NOT_EXECUTABLE'
      ]
    );

    assert.deepEqual(
      contract.initialLifecycleStates,
      [
        'PENDING',
        'NOT_EXECUTABLE'
      ]
    );

    assert.deepEqual(
      contract.terminalLifecycleStates,
      [
        'COMPLETED',
        'FAILED',
        'NOT_EXECUTABLE'
      ]
    );

    assert.equal(
      Object.isFrozen(contract),
      true
    );

    assert.equal(
      Object.isFrozen(contract.transitionTable),
      true
    );

    assert.equal(
      Object.isFrozen(contract.transitionTable.PENDING),
      true
    );
  }
);

test(
  'R1 resolves the only two qualified lifecycle transitions',
  () => {
    assert.deepEqual(
      resolveLifecycleTransition({
        currentStatus:
          'PENDING',
        transitionType:
          'COMPLETE'
      }),
      {
        schema:
          CONTRACT_SCHEMA,
        from:
          'PENDING',
        type:
          'COMPLETE',
        to:
          'COMPLETED',
        terminal:
          true
      }
    );

    assert.equal(
      resolveLifecycleTransition({
        currentStatus:
          'pending',
        transitionType:
          'fail'
      }).to,
      'FAILED'
    );
  }
);

test(
  'R1 fails closed for unknown and terminal transitions',
  () => {
    assert.throws(
      () =>
        resolveLifecycleTransition({
          currentStatus:
            'UNKNOWN',
          transitionType:
            'COMPLETE'
        }),
      /Unknown lifecycle state/
    );

    for (
      const state of
      ['COMPLETED', 'FAILED', 'NOT_EXECUTABLE']
    ) {
      assert.throws(
        () =>
          resolveLifecycleTransition({
            currentStatus:
              state,
            transitionType:
              'FAIL'
          }),
        /is terminal/
      );
    }
  }
);

test(
  'R1 lifecycle transitions are equivalent to the green legacy baseline',
  () => {
    const complete =
      transitionLifecycle(
        lifecycle(),
        {
          transitionId:
            'transition-complete',
          operationId:
            'operation-r1',
          type:
            'COMPLETE',
          occurredAt:
            '2026-08-27T03:00:01.000Z',
          after:
            repositoryState()
        }
      );

    const failed =
      transitionLifecycle(
        lifecycle(),
        {
          transitionId:
            'transition-fail',
          operationId:
            'operation-r1',
          type:
            'FAIL',
          occurredAt:
            '2026-08-27T03:00:01.000Z',
          failure: {
            reason:
              'Qualified failure.',
            physicalEvidence:
              repositoryState()
          }
        }
      );

    assert.equal(
      complete.status,
      resolveLifecycleTransition({
        currentStatus:
          'PENDING',
        transitionType:
          'COMPLETE'
      }).to
    );

    assert.equal(
      failed.status,
      resolveLifecycleTransition({
        currentStatus:
          'PENDING',
        transitionType:
          'FAIL'
      }).to
    );
  }
);

test(
  'R1 boundary precedence is explicit and legacy-equivalent',
  () => {
    const cases = [
      {
        authorizationStatus:
          'AUTHORIZED',
        outcome:
          'FAILED',
        afterPresent:
          false,
        expected:
          'FAILED'
      },
      {
        authorizationStatus:
          'AUTHORIZED',
        outcome:
          null,
        afterPresent:
          false,
        expected:
          'PENDING_AFTER_STATE'
      },
      {
        authorizationStatus:
          'AUTHORIZED',
        outcome:
          null,
        afterPresent:
          true,
        expected:
          'COMPLETED'
      },
      {
        authorizationStatus:
          'DENIED',
        outcome:
          null,
        afterPresent:
          false,
        expected:
          'NOT_EXECUTABLE'
      }
    ];

    for (const entry of cases) {
      const reconstructed =
        classifyStateBoundary(entry);

      const legacy =
        assertTransition(
          legacyBoundary(entry)
        );

      assert.equal(
        reconstructed.status,
        entry.expected
      );

      assert.equal(
        reconstructed.status,
        legacy.status
      );
    }
  }
);

test(
  'R1 contract exposes no filesystem process network or mutation authority',
  () => {
    const source =
      require('node:fs')
        .readFileSync(
          require.resolve(
            '../../accelerator/reconstruction/v3/core/operation-state-contract'
          ),
          'utf8'
        );

    assert.doesNotMatch(
      source,
      /child_process|node:net|node:http|node:https|writeFile|unlink|rename|exec|spawn/
    );

    assert.deepEqual(
      Object.keys(
        require(
          '../../accelerator/reconstruction/v3/core/operation-state-contract'
        )
      ).sort(),
      [
        'CONTRACT_SCHEMA',
        'classifyStateBoundary',
        'describeOperationStateContract',
        'resolveLifecycleTransition'
      ]
    );
  }
);
