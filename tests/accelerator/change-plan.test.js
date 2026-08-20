'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildChangePlan
} = require('../../accelerator/core/change-plan');

function createDiscovery(overrides = {}) {
  return {
    repository: {
      path: '/tmp/sdo-test-fixture',
      name: 'sdo-test-fixture',
      branch: 'main',
      commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      shortCommit: 'aaaaaaa'
    },

    worktree: {
      clean: true
    },

    ...overrides
  };
}

function createTask(overrides = {}) {
  return {
    task: {
      description: 'SDO change plan contract',
      mode: 'PATCH',
      risk: 'BAIXO',
      executionAllowed: true
    },

    governance: {
      explicitExecutionAuthorizationRequired: true,
      explicitRefactorAuthorizationRequired: false
    },

    ...overrides
  };
}

function createInspection(overrides = {}) {
  return {
    inspection: {
      completed: true
    },

    governance: {
      declarativeInspectionCompleted: true,
      physicalValidationRequired: true
    },

    ...overrides
  };
}

function createClassification(overrides = {}) {
  return {
    classification: {
      mode: 'PATCH',
      risk: 'BAIXO',
      executionAllowed: true
    },

    governance: {
      explicitAuthorizationRequired: false
    },

    ...overrides
  };
}

function build(overrides = {}) {
  return buildChangePlan({
    discovery: createDiscovery(
      overrides.discovery
    ),
    task: createTask(
      overrides.task
    ),
    inspection: createInspection(
      overrides.inspection
    ),
    classification: createClassification(
      overrides.classification
    ),
    execution: overrides.execution || null
  });
}

test('change plan authorizes a clean explicitly authorized low-risk PATCH', () => {
  const result = build();

  assert.equal(
    result.decision.status,
    'AUTHORIZED'
  );

  assert.equal(
    result.decision.executionAllowed,
    true
  );

  assert.deepEqual(
    result.blockers,
    []
  );

  assert.equal(
    result.nextStep,
    'Proceed to controlled surgical execution.'
  );
});

test('change plan blocks a dirty worktree', () => {
  const result = build({
    discovery: {
      worktree: {
        clean: false
      }
    }
  });

  assert.equal(
    result.decision.status,
    'BLOCKED'
  );

  assert.equal(
    result.decision.executionAllowed,
    false
  );

  assert.ok(
    result.blockers.includes(
      'Target repository worktree is not clean.'
    )
  );
});

test('change plan blocks when declarative inspection is incomplete', () => {
  const result = build({
    inspection: {
      governance: {
        declarativeInspectionCompleted: false
      }
    }
  });

  assert.equal(
    result.decision.status,
    'BLOCKED'
  );

  assert.ok(
    result.blockers.includes(
      'Declarative inspection has not been completed.'
    )
  );
});

test('change plan blocks when physical validation is not declared', () => {
  const result = build({
    inspection: {
      governance: {
        physicalValidationRequired: false
      }
    }
  });

  assert.equal(
    result.decision.status,
    'BLOCKED'
  );

  assert.ok(
    result.blockers.includes(
      'Physical repository validation contract is missing.'
    )
  );
});

test('change plan blocks when explicit execution authorization is not declared', () => {
  const result = build({
    task: {
      governance: {
        explicitExecutionAuthorizationRequired: false
      }
    }
  });

  assert.equal(
    result.decision.status,
    'BLOCKED'
  );

  assert.ok(
    result.blockers.includes(
      'Task preparation does not declare explicit execution authorization.'
    )
  );
});

test('change plan blocks when task execution is not authorized', () => {
  const result = build({
    task: {
      task: {
        executionAllowed: false
      }
    }
  });

  assert.equal(
    result.decision.status,
    'BLOCKED'
  );

  assert.ok(
    result.blockers.includes(
      'Task preparation does not authorize execution.'
    )
  );
});

test('change plan blocks when risk classification does not authorize execution', () => {
  const result = build({
    classification: {
      classification: {
        executionAllowed: false
      }
    }
  });

  assert.equal(
    result.decision.status,
    'BLOCKED'
  );

  assert.ok(
    result.blockers.includes(
      'Risk classification does not authorize execution.'
    )
  );
});

test('change plan blocks REFRACTOR mode', () => {
  const result = build({
    task: {
      task: {
        mode: 'REFRACTOR'
      }
    },

    classification: {
      classification: {
        mode: 'REFRACTOR'
      },

      governance: {
        explicitAuthorizationRequired: true
      }
    }
  });

  assert.equal(
    result.decision.mode,
    'REFRACTOR'
  );

  assert.equal(
    result.decision.status,
    'BLOCKED'
  );

  assert.ok(
    result.blockers.includes(
      'REFRACTOR mode requires explicit architectural authorization.'
    )
  );
});

test('change plan blocks ALTO risk', () => {
  const result = build({
    task: {
      task: {
        risk: 'ALTO'
      }
    },

    classification: {
      classification: {
        risk: 'ALTO'
      }
    }
  });

  assert.equal(
    result.decision.risk,
    'ALTO'
  );

  assert.equal(
    result.decision.status,
    'BLOCKED'
  );

  assert.ok(
    result.blockers.includes(
      'HIGH risk tasks require explicit authorization before execution.'
    )
  );
});

test('change plan binds and authorizes only exact governed R3 PATCH_FILE', () => {
  const replacement = 'after\n';
  const replacementSha256 = require('node:crypto').createHash('sha256')
    .update(replacement).digest('hex');
  const execution = {
    adapter: 'FILESYSTEM_PATCH', action: 'PATCH_FILE', operationId: 'op-1',
    workspace: '/tmp/sdo-test-fixture', target: 'target.js', replacement,
    grantEvaluation: { schema: 'sdo.capability_grant_evaluation.v1', decision: 'ALLOWED',
      grant: { operationId: 'op-1', workspace: '/tmp/sdo-test-fixture', riskLevel: 'R3',
        capabilityType: 'FILESYSTEM_PATCH', policyDecision: 'ALLOWED',
        underlyingPolicyDecision: 'APPROVAL_REQUIRED', scope: { target: {
          path: 'target.js', canonicalPath: '/tmp/sdo-test-fixture/target.js',
          beforeSha256: 'a'.repeat(64), replacementSha256 } },
        approvalAuthorityFingerprint: 'b'.repeat(64),
        verifiedIdentityAssertionFingerprint: 'c'.repeat(64),
        identityVerificationEvidenceFingerprint: 'd'.repeat(64) } }
  };
  const result = build({ execution,
    task: { task: { description: 'Govern exact patch', mode: 'PATCH',
      risk: 'ALTO', executionAllowed: true } },
    classification: { classification: { mode: 'PATCH', risk: 'ALTO', executionAllowed: true },
      governance: { explicitAuthorizationRequired: true } } });
  assert.equal(result.decision.status, 'AUTHORIZED');
  assert.equal(result.mutation.replacementSha256, replacementSha256);
  assert.equal(result.mutation.target, 'target.js');
});

test('change plan rejects generic or replacement-mismatched mutation instructions', () => {
  const result = build({ execution: { adapter: 'FILESYSTEM_WRITE', action: 'WRITE_FILE' },
    task: { task: { risk: 'ALTO' } },
    classification: { classification: { risk: 'ALTO' },
      governance: { explicitAuthorizationRequired: true } } });
  assert.equal(result.decision.status, 'BLOCKED');
  assert.equal(result.mutation, null);
});

test('change plan rejects missing discovery', () => {
  assert.throws(
    () =>
      buildChangePlan({
        task: createTask(),
        inspection: createInspection(),
        classification: createClassification()
      }),
    /Repository discovery is required/
  );
});

test('change plan rejects missing task', () => {
  assert.throws(
    () =>
      buildChangePlan({
        discovery: createDiscovery(),
        inspection: createInspection(),
        classification: createClassification()
      }),
    /Prepared task is required/
  );
});

test('change plan rejects missing inspection', () => {
  assert.throws(
    () =>
      buildChangePlan({
        discovery: createDiscovery(),
        task: createTask(),
        classification: createClassification()
      }),
    /Declarative inspection is required/
  );
});

test('change plan rejects missing classification', () => {
  assert.throws(
    () =>
      buildChangePlan({
        discovery: createDiscovery(),
        task: createTask(),
        inspection: createInspection()
      }),
    /Risk classification is required/
  );
});
