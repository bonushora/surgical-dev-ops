'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  parseNaturalEvidenceDecision
} = require(
  '../../accelerator/cli/natural-evidence-request'
);

const {
  materializeGovernedEngineeringProposal
} = require(
  '../../accelerator/core/governed-engineering-proposal'
);

const {
  runGovernedEngineeringAgentLoop
} = require(
  '../../accelerator/cli/governed-engineering-agent-loop'
);

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

const objective =
  'Corrigir accelerator/example.js.';

function task() {
  return deepFreeze({
    schema: 'sdo.natural_governed_task.v1',
    kind: 'PROJECT_ANALYSIS',
    objective,
    mutating: false,
    operations: []
  });
}

function activation() {
  return deepFreeze({
    repositoryPath:
      path.resolve('/tmp/sdo-engineering-loop'),
    workspace: 'sdo-engineering-loop',
    interactionMode: {
      mode: 'NATURAL'
    }
  });
}

function requestRead() {
  return parseNaturalEvidenceDecision({
    schema: 'sdo.ai_cognitive_result.v1',
    status: 'COMPLETED',
    output: {
      decision: 'REQUEST_EVIDENCE',
      response: null,
      evidenceRequest: {
        kind: 'READ_FILE',
        target: 'accelerator/example.js',
        reason: 'Observar o estado BEFORE.'
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
      response: 'A correção pode ser proposta.',
      evidenceRequest: null
    }
  });
}

function fileEvidence() {
  return deepFreeze({
    orchestration: {
      status: 'COMPLETED'
    },
    execution: {
      schema: 'sdo.filesystem_read_result.v1',
      target: {
        requested: 'accelerator/example.js'
      },
      evidence: {
        bytes: 14,
        sha256: 'a'.repeat(64),
        content: "'use strict';\n"
      }
    }
  });
}

function proposal(overrides = {}) {
  return materializeGovernedEngineeringProposal({
    schema:
      'sdo.ai_engineering_patch_proposal.v1',
    objective,
    target:
      'accelerator/example.js',
    beforeSha256:
      'a'.repeat(64),
    replacementBase64:
      Buffer.from(
        "'use strict';\nmodule.exports = {};\n"
      ).toString('base64'),
    reason:
      'Mudança limitada ao arquivo observado.',
    validationKind:
      'VALIDATE_JS',
    ...overrides
  });
}

test(
  'single engineering agent stops at human authority with an evidence-bound proposal',
  async () => {
    const decisions = [
      requestRead(),
      respond()
    ];
    let proposedEvidence = null;
    let dispatches = 0;

    const result =
      await runGovernedEngineeringAgentLoop({
        task: task(),
        activation: activation(),
        cognitiveSession: {
          async decideEvidence() {
            return decisions.shift();
          },
          async proposePatch(
            observedObjective,
            _activation,
            evidence
          ) {
            assert.equal(
              observedObjective,
              objective
            );
            proposedEvidence = evidence;
            return proposal();
          }
        },
        dispatchEvidence() {
          dispatches += 1;
          return fileEvidence();
        }
      });

    assert.equal(
      result.status,
      'HUMAN_AUTHORITY_REQUIRED'
    );
    assert.equal(dispatches, 1);
    assert.match(
      proposedEvidence,
      /accelerator\/example\.js/
    );
    assert.equal(
      result.mutationAuthority,
      false
    );
    assert.equal(
      result.proposal.beforeSha256,
      'a'.repeat(64)
    );
    assert.equal(
      Object.isFrozen(result),
      true
    );
  }
);

test(
  'single engineering agent rejects proposal not bound to observed BEFORE evidence',
  async () => {
    const decisions = [
      requestRead(),
      respond()
    ];

    const result =
      await runGovernedEngineeringAgentLoop({
        task: task(),
        activation: activation(),
        cognitiveSession: {
          async decideEvidence() {
            return decisions.shift();
          },
          async proposePatch() {
            return proposal({
              beforeSha256:
                'b'.repeat(64)
            });
          }
        },
        dispatchEvidence() {
          return fileEvidence();
        }
      });

    assert.equal(result.status, 'FAILED');
    assert.equal(result.proposal, null);
    assert.match(result.reason, /BEFORE state/);
  }
);

test(
  'single engineering agent never asks for a proposal after evidence failure',
  async () => {
    let proposalCalls = 0;

    const result =
      await runGovernedEngineeringAgentLoop({
        task: task(),
        activation: activation(),
        cognitiveSession: {
          async decideEvidence() {
            throw new Error('planner failure');
          },
          async proposePatch() {
            proposalCalls += 1;
            return proposal();
          }
        },
        dispatchEvidence() {
          throw new Error('must not dispatch');
        }
      });

    assert.equal(result.status, 'FAILED');
    assert.equal(proposalCalls, 0);
    assert.equal(result.operationalAuthority, false);
  }
);
