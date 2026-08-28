'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  createNaturalDevelopmentTaskContract
} = require(
  '../../accelerator/cli/natural-development-task-contract'
);

const {
  runNaturalDevelopmentPlanningLoop
} = require(
  '../../accelerator/cli/natural-development-planning-loop'
);

const {
  parseNaturalEvidenceDecision
} = require(
  '../../accelerator/cli/natural-evidence-request'
);

const identity = crypto
  .createHash('sha256')
  .update('g2-physical-workspace')
  .digest('hex');

const head =
  '114bee4e3c4117b4f76cfde7eede4c1746c6765d';

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

function contract(overrides = {}) {
  return createNaturalDevelopmentTaskContract({
    objective:
      'Analyze one exact JavaScript target using governed evidence.',
    physicalWorkspaceIdentity: identity,
    repositoryHead: head,
    allowedTargets: [
      'accelerator/example.js',
      'tests/example.test.js'
    ],
    evidenceStepCeiling: 4,
    ...overrides
  });
}

function activation() {
  return deepFreeze({
    repositoryPath:
      path.resolve('/tmp/sdo-development-planning'),
    workspace:
      'sdo-development-planning',
    interactionMode: {
      mode: 'NATURAL'
    }
  });
}

function request(kind, target = null) {
  return parseNaturalEvidenceDecision({
    schema: 'sdo.ai_cognitive_result.v1',
    status: 'COMPLETED',
    output: {
      decision: 'REQUEST_EVIDENCE',
      response: null,
      evidenceRequest: {
        kind,
        target,
        reason: 'Obtain exact governed evidence.'
      }
    }
  });
}

function respond() {
  return parseNaturalEvidenceDecision({
    schema: 'sdo.ai_cognitive_result.v1',
    status: 'COMPLETED',
    output: {
      decision: 'RESPOND',
      response:
        'The exact target was analyzed from governed evidence.',
      evidenceRequest: null
    }
  });
}

function fileEvidence(target = 'accelerator/example.js') {
  return deepFreeze({
    orchestration: {
      status: 'COMPLETED'
    },
    execution: {
      schema: 'sdo.filesystem_read_result.v1',
      target: {
        requested: target
      },
      evidence: {
        bytes: 14,
        sha256: 'a'.repeat(64),
        content: "'use strict';\n"
      }
    }
  });
}

function inventoryEvidence() {
  return deepFreeze({
    orchestration: {
      status: 'COMPLETED'
    },
    execution: {
      schema: 'sdo.git_read_result.v1',
      selector: 'WORKSPACE_FILES',
      result: {
        files: [
          'accelerator/example.js',
          'tests/example.test.js'
        ]
      }
    }
  });
}

function validationEvidence(target = 'accelerator/example.js') {
  return deepFreeze({
    orchestration: {
      status: 'COMPLETED'
    },
    execution: {
      schema: 'sdo.process_validation_result.v1',
      status: 'PASSED',
      selector: 'NODE_SYNTAX_CHECK',
      target
    }
  });
}

async function run({
  activeContract = contract(),
  decisions,
  dispatchEvidence,
  observedIdentity = identity,
  observedHead = head
}) {
  return runNaturalDevelopmentPlanningLoop({
    contract: activeContract,
    physicalWorkspaceIdentity: observedIdentity,
    repositoryHead: observedHead,
    activation: activation(),
    cognitiveSession: {
      async decideEvidence() {
        return decisions.shift();
      }
    },
    dispatchEvidence
  });
}

test(
  'G2 obtains exact allowed file evidence and returns authority-free analysis',
  async () => {
    let dispatches = 0;
    const result = await run({
      decisions: [
        request('READ_FILE', 'accelerator/example.js'),
        respond()
      ],
      dispatchEvidence(intent) {
        dispatches += 1;
        assert.equal(intent.capabilityType, 'FILESYSTEM_READ');
        return fileEvidence(intent.target);
      }
    });

    assert.equal(result.status, 'COMPLETED');
    assert.equal(dispatches, 1);
    assert.equal(result.evidence.length, 1);
    assert.equal(result.evidence[0].kind, 'READ_FILE');
    assert.equal(result.operationalAuthority, false);
    assert.equal(result.mutationAuthority, false);
    assert.equal(result.dispatchAuthority, false);
    assert.equal(Object.isFrozen(result), true);
    assert.match(
      result.planningFingerprint,
      /^[a-f0-9]{64}$/
    );
  }
);

test(
  'G2 permits bounded repository inventory without converting it into target authority',
  async () => {
    let dispatches = 0;
    const result = await run({
      decisions: [
        request('WORKSPACE_FILES'),
        request('READ_FILE', 'tests/example.test.js'),
        respond()
      ],
      dispatchEvidence(intent) {
        dispatches += 1;
        return intent.capabilityType === 'GIT_READ'
          ? inventoryEvidence()
          : fileEvidence(intent.target);
      }
    });

    assert.equal(result.status, 'COMPLETED');
    assert.equal(dispatches, 2);
    assert.deepEqual(
      result.evidence.map((item) => item.kind),
      ['WORKSPACE_FILES', 'READ_FILE']
    );
  }
);

test(
  'G2 permits only qualified validation for one exact JavaScript target',
  async () => {
    let dispatches = 0;
    const result = await run({
      decisions: [
        request('READ_FILE', 'accelerator/example.js'),
        request('VALIDATE_JS', 'accelerator/example.js'),
        respond()
      ],
      dispatchEvidence(intent) {
        dispatches += 1;
        return intent.capabilityType === 'PROCESS_VALIDATION'
          ? validationEvidence(intent.target)
          : fileEvidence(intent.target);
      }
    });

    assert.equal(result.status, 'COMPLETED');
    assert.equal(dispatches, 2);
    assert.equal(result.evidence[1].kind, 'VALIDATE_JS');
    assert.equal(result.evidence[1].validationStatus, 'PASSED');
  }
);

test(
  'target expansion stops before any governed dispatch',
  async () => {
    let dispatches = 0;
    const result = await run({
      decisions: [
        request('READ_FILE', 'package.json')
      ],
      dispatchEvidence() {
        dispatches += 1;
        throw new Error('must not dispatch');
      }
    });

    assert.equal(result.status, 'STOPPED');
    assert.equal(result.requiresNewHumanAuthority, true);
    assert.equal(dispatches, 0);
    assert.match(result.reason, /target expansion/i);
    assert.equal(
      result.pendingRequest.target,
      'package.json'
    );
  }
);

test(
  'workspace and repository-anchor substitution fail before cognition and dispatch',
  async () => {
    for (const anchors of [
      { observedIdentity: '0'.repeat(64) },
      { observedHead: '0'.repeat(40) }
    ]) {
      let decisions = 0;
      let dispatches = 0;

      await assert.rejects(
        () => run({
          decisions: [],
          ...anchors,
          dispatchEvidence() {
            dispatches += 1;
          }
        }),
        /anchor is not contained/i
      );

      assert.equal(decisions, 0);
      assert.equal(dispatches, 0);
    }
  }
);

test(
  'contract fingerprint substitution fails before evidence planning',
  async () => {
    const valid = contract();
    const forged = Object.freeze({
      ...valid,
      contractFingerprint: '0'.repeat(64)
    });

    await assert.rejects(
      () => run({
        activeContract: forged,
        decisions: [],
        dispatchEvidence() {
          throw new Error('must not dispatch');
        }
      }),
      /binding is malformed/i
    );
  }
);

test(
  'development evidence-step ceiling stops recursive planning without extra dispatch',
  async () => {
    let dispatches = 0;
    const result = await run({
      activeContract: contract({
        evidenceStepCeiling: 1
      }),
      decisions: [
        request('READ_FILE', 'accelerator/example.js'),
        request('READ_FILE', 'tests/example.test.js')
      ],
      dispatchEvidence(intent) {
        dispatches += 1;
        return fileEvidence(intent.target);
      }
    });

    assert.equal(result.status, 'STOPPED');
    assert.equal(dispatches, 1);
    assert.match(result.reason, /ceiling/i);
  }
);

test(
  'G2 exports no patch authorization grant shell or mutation surface',
  () => {
    const api = require(
      '../../accelerator/cli/natural-development-planning-loop'
    );

    assert.deepEqual(
      Object.keys(api)
        .filter((key) => typeof api[key] === 'function'),
      ['runNaturalDevelopmentPlanningLoop']
    );

    for (const forbidden of [
      'patch',
      'authorize',
      'approve',
      'grant',
      'shell',
      'mutation'
    ]) {
      assert.equal(
        Object.keys(api).some(
          (key) => key.toLowerCase().includes(forbidden)
        ),
        false
      );
    }
  }
);

test(
  'ADR-028 preserves equivalent English and Portuguese G2 boundaries',
  () => {
    const root = path.resolve(__dirname, '../..');
    const english = fs.readFileSync(
      path.join(
        root,
        'docs/adr/ADR-028-natural-governed-development-execution-loop.md'
      ),
      'utf8'
    );
    const portuguese = fs.readFileSync(
      path.join(
        root,
        'docs/adr/ADR-028-natural-governed-development-execution-loop_PT-BR.md'
      ),
      'utf8'
    );

    for (const fact of [
      'sdo.natural_development_planning_loop.v1',
      'WORKSPACE_FILES',
      'READ_FILE',
      'VALIDATE_JS',
      'STOPPED'
    ]) {
      assert.match(english, new RegExp(fact));
      assert.match(portuguese, new RegExp(fact));
    }
  }
);
