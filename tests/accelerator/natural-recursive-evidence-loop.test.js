'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const path =
  require('node:path');

const {
  parseNaturalEvidenceDecision
} = require(
  '../../accelerator/cli/natural-evidence-request'
);

const {
  runNaturalRecursiveEvidenceLoop
} = require(
  '../../accelerator/cli/natural-recursive-evidence-loop'
);

const WORKSPACE =
  path.resolve(
    '/tmp/surgical-recursive-loop-project'
  );

function deepFreeze(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (
    const child
    of Object.values(value)
  ) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function projectTask() {
  return deepFreeze({
    schema:
      'sdo.natural_governed_task.v1',

    kind:
      'PROJECT_ANALYSIS',

    objective:
      'Analise o projeto autorizado.',

    mutating:
      false,

    operations:
      []
  });
}

function activation() {
  return deepFreeze({
    repositoryPath:
      WORKSPACE,

    workspace:
      'surgical-recursive-loop-project',

    interactionMode: {
      mode:
        'NATURAL'
    }
  });
}

function requestDecision(
  kind,
  target,
  reason = 'Preciso desta evidência.'
) {
  return parseNaturalEvidenceDecision({
    schema:
      'sdo.ai_cognitive_result.v1',

    status:
      'COMPLETED',

    output: {
      decision:
        'REQUEST_EVIDENCE',

      response:
        null,

      evidenceRequest: {
        kind,
        target,
        reason
      }
    }
  });
}

function respondDecision(
  response
) {
  return parseNaturalEvidenceDecision({
    schema:
      'sdo.ai_cognitive_result.v1',

    status:
      'COMPLETED',

    output: {
      decision:
        'RESPOND',

      response,

      evidenceRequest:
        null
    }
  });
}

function gitEvidence(files) {
  return deepFreeze({
    orchestration: {
      status:
        'COMPLETED'
    },

    execution: {
      schema:
        'sdo.git_read_result.v1',

      selector:
        'WORKSPACE_FILES',

      result: {
        files
      }
    }
  });
}

function fileEvidence(
  target,
  content
) {
  return deepFreeze({
    orchestration: {
      status:
        'COMPLETED'
    },

    execution: {
      schema:
        'sdo.filesystem_read_result.v1',

      target: {
        requested:
          target
      },

      evidence: {
        bytes:
          Buffer.byteLength(
            content,
            'utf8'
          ),

        sha256:
          'a'.repeat(64),

        content
      }
    }
  });
}

test(
  'recursive loop performs request containment dispatch evidence feedback and final response',
  async () => {
    const decisions = [
      requestDecision(
        'READ_FILE',
        'package.json'
      ),

      respondDecision(
        'O projeto possui um package.json e scripts configurados.'
      )
    ];

    const observedHistory = [];
    const dispatched = [];

    const result =
      await runNaturalRecursiveEvidenceLoop({
        task:
          projectTask(),

        activation:
          activation(),

        cognitiveSession: {
          async decideEvidence(
            _objective,
            _activation,
            history
          ) {
            observedHistory.push(
              [...history]
            );

            return decisions.shift();
          }
        },

        dispatchEvidence(
          intent,
          workspace
        ) {
          dispatched.push({
            intent,
            workspace
          });

          if (
            intent.capabilityType ===
              'GIT_READ'
          ) {
            return gitEvidence([
              'package.json',
              'accelerator/cli/surgical.js'
            ]);
          }

          return fileEvidence(
            'package.json',
            '{"name":"surgical-dev-ops"}\n'
          );
        }
      });

    assert.equal(
      result.status,
      'COMPLETED'
    );

    assert.equal(
      result.steps,
      2
    );

    assert.equal(
      result.evidence.length,
      2
    );

    assert.match(
      result.response,
      /package\.json/
    );

    assert.equal(
      dispatched.length,
      2
    );

    assert.deepEqual(
      dispatched[0].intent,
      {
        capabilityType:
          'GIT_READ',

        target:
          'workspace-files'
      }
    );

    assert.deepEqual(
      dispatched[1].intent,
      {
        capabilityType:
          'FILESYSTEM_READ',

        target:
          'package.json'
      }
    );

    assert.equal(
      dispatched[0].workspace,
      WORKSPACE
    );

    assert.equal(
      observedHistory[0].length,
      1
    );

    assert.match(
      observedHistory[0][0],
      /WORKSPACE_FILES/
    );

    assert.equal(
      observedHistory[1].length,
      2
    );

    assert.match(
      observedHistory[1][1],
      /surgical-dev-ops/
    );

    assert.equal(
      result.operationalAuthority,
      false
    );

    assert.equal(
      result.mutationAuthority,
      false
    );

    assert.equal(
      Object.isFrozen(result),
      true
    );
  }
);

test(
  'project analysis deterministically grounds one canonical file before final cognition',
  async () => {
    let cognitiveCalls =
      0;

    const dispatched = [];

    const result =
      await runNaturalRecursiveEvidenceLoop({
        task:
          projectTask(),

        activation:
          activation(),

        cognitiveSession: {
          async decideEvidence(
            _objective,
            _activation,
            history
          ) {
            cognitiveCalls += 1;

            assert.equal(
              history.length,
              2
            );

            assert.match(
              history[1],
              /TARGET: README\.md/
            );

            return respondDecision(
              'O README descreve o projeto com evidência governada.'
            );
          }
        },

        dispatchEvidence(
          intent
        ) {
          dispatched.push(
            intent
          );

          if (
            intent.capabilityType ===
              'GIT_READ'
          ) {
            return gitEvidence([
              'README.md',
              'package.json'
            ]);
          }

          return fileEvidence(
            'README.md',
            '# Surgical DevOps\n'
          );
        }
      });

    assert.equal(
      result.status,
      'COMPLETED'
    );

    assert.equal(
      cognitiveCalls,
      1
    );

    assert.equal(
      dispatched.length,
      2
    );

    assert.deepEqual(
      dispatched[1],
      {
        capabilityType:
          'FILESYSTEM_READ',

        target:
          'README.md'
      }
    );

    assert.equal(
      result.evidence[1].kind,
      'READ_FILE'
    );
  }
);

test(
  'English project analysis deterministically grounds the English README',
  async () => {
    const dispatched = [];
    const task = deepFreeze({
      ...projectTask(),
      objective:
        'Explain this project to me in English.'
    });

    const result =
      await runNaturalRecursiveEvidenceLoop({
        task,
        activation:
          activation(),
        cognitiveSession: {
          async decideEvidence(
            _objective,
            _activation,
            history
          ) {
            assert.match(
              history[1],
              /TARGET: README_EN\.md/
            );
            return respondDecision(
              'The project is grounded in governed evidence.'
            );
          }
        },
        dispatchEvidence(intent) {
          dispatched.push(intent);
          if (
            intent.capabilityType ===
              'GIT_READ'
          ) {
            return gitEvidence([
              'README.md',
              'README_EN.md'
            ]);
          }

          return fileEvidence(
            'README_EN.md',
            '# Surgical DevOps\n' +
              'x'.repeat(5000)
          );
        }
      });

    assert.equal(
      result.status,
      'COMPLETED'
    );
    assert.equal(
      dispatched[1].target,
      'README_EN.md'
    );
    assert.ok(
      result.evidence[1].summary.length <
        2850
    );
    assert.match(
      result.evidence[1].summary,
      /TRUNCATED_BY_SURGICAL_DEVOPS/
    );
  }
);

test(
  'out-of-envelope cognitive request returns to human before dispatch',
  async () => {
    let dispatches = 0;

    const result =
      await runNaturalRecursiveEvidenceLoop({
        task:
          deepFreeze({
            schema:
              'sdo.natural_governed_task.v1',

            kind:
              'READ_AND_EXPLAIN_FILE',

            objective:
              'Explique package.json.',

            mutating:
              false,

            target:
              'package.json',

            operations: [
              {
                capabilityType:
                  'FILESYSTEM_READ',

                target:
                  'package.json'
              }
            ]
          }),

        activation:
          activation(),

        cognitiveSession: {
          async decideEvidence() {
            return requestDecision(
              'READ_FILE',
              'README.md'
            );
          }
        },

        dispatchEvidence() {
          dispatches += 1;

          throw new Error(
            'must not dispatch'
          );
        }
      });

    assert.equal(
      result.status,
      'HUMAN_AUTHORITY_REQUIRED'
    );

    assert.equal(
      dispatches,
      0
    );

    assert.equal(
      result.pendingRequest.target,
      'README.md'
    );
  }
);

test(
  'workspace traversal request returns to human with zero dispatch',
  async () => {
    let dispatches = 0;

    const result =
      await runNaturalRecursiveEvidenceLoop({
        task:
          projectTask(),

        activation:
          activation(),

        cognitiveSession: {
          async decideEvidence() {
            return requestDecision(
              'READ_FILE',
              '../outside.txt'
            );
          }
        },

        dispatchEvidence(
          intent
        ) {
          dispatches += 1;

          if (
            intent.capabilityType ===
              'GIT_READ'
          ) {
            return gitEvidence([
              'package.json'
            ]);
          }

          return null;
        }
      });

    assert.equal(
      result.status,
      'HUMAN_AUTHORITY_REQUIRED'
    );

    assert.equal(
      dispatches,
      1
    );
  }
);

test(
  'identical repeated cognitive request is stopped without duplicate dispatch',
  async () => {
    const repeated =
      requestDecision(
        'READ_FILE',
        'package.json'
      );

    let calls = 0;
    let dispatches = 0;

    const result =
      await runNaturalRecursiveEvidenceLoop({
        task:
          projectTask(),

        activation:
          activation(),

        cognitiveSession: {
          async decideEvidence() {
            calls += 1;

            return repeated;
          }
        },

        dispatchEvidence(
          intent
        ) {
          dispatches += 1;

          if (
            intent.capabilityType ===
              'GIT_READ'
          ) {
            return gitEvidence([
              'package.json'
            ]);
          }

          return fileEvidence(
            'package.json',
            '{}\n'
          );
        }
      });

    assert.equal(
      calls,
      2
    );

    assert.equal(
      dispatches,
      2
    );

    assert.equal(
      result.status,
      'FAILED'
    );

    assert.match(
      result.reason,
      /Repeated identical/i
    );
  }
);

test(
  'governed dispatch failure remains failure-only and never becomes cognitive success',
  async () => {
    const result =
      await runNaturalRecursiveEvidenceLoop({
        task:
          projectTask(),

        activation:
          activation(),

        cognitiveSession: {
          async decideEvidence() {
            return requestDecision(
              'READ_FILE',
              'package.json'
            );
          }
        },

        dispatchEvidence() {
          throw new Error(
            'adapter failed'
          );
        }
      });

    assert.equal(
      result.status,
      'FAILED'
    );

    assert.equal(
      result.response,
      null
    );

    assert.equal(
      result.evidence.length,
      0
    );
  }
);

test(
  'malformed governed evidence fails closed before returning data to cognition',
  async () => {
    const result =
      await runNaturalRecursiveEvidenceLoop({
        task:
          projectTask(),

        activation:
          activation(),

        cognitiveSession: {
          async decideEvidence() {
            return requestDecision(
              'READ_FILE',
              'package.json'
            );
          }
        },

        dispatchEvidence() {
          return deepFreeze({
            orchestration: {
              status:
                'COMPLETED'
            },

            execution: {
              schema:
                'forged.evidence'
            }
          });
        }
      });

    assert.equal(
      result.status,
      'FAILED'
    );

    assert.equal(
      result.response,
      null
    );
  }
);

test(
  'cognitive planner exception fails closed with zero operational continuation',
  async () => {
    let dispatches = 0;

    const result =
      await runNaturalRecursiveEvidenceLoop({
        task:
          projectTask(),

        activation:
          activation(),

        cognitiveSession: {
          async decideEvidence() {
            throw new Error(
              'provider unavailable'
            );
          }
        },

        dispatchEvidence() {
          dispatches += 1;

          return gitEvidence([
            'package.json'
          ]);
        }
      });

    assert.equal(
      result.status,
      'FAILED'
    );

    assert.equal(
      dispatches,
      1
    );
  }
);

test(
  'recursive loop has fixed evidence-step ceiling',
  async () => {
    let counter = 0;

    const targets = [
      'a.js',
      'b.js',
      'c.js',
      'd.js',
      'e.js',
      'f.js',
      'g.js',
      'h.js'
    ];

    const result =
      await runNaturalRecursiveEvidenceLoop({
        task:
          projectTask(),

        activation:
          activation(),

        cognitiveSession: {
          async decideEvidence() {
            const target =
              targets[counter];

            counter += 1;

            return requestDecision(
              'READ_FILE',
              target
            );
          }
        },

        dispatchEvidence(
          intent
        ) {
          if (
            intent.capabilityType ===
              'GIT_READ'
          ) {
            return gitEvidence([
              ...targets
            ]);
          }

          return fileEvidence(
            intent.target,
            'const value = 1;\n'
          );
        }
      });

    assert.equal(
      result.status,
      'HUMAN_AUTHORITY_REQUIRED'
    );

    assert.equal(
      result.steps,
      8
    );

    assert.equal(
      result.evidence.length,
      8
    );

    assert.match(
      result.reason,
      /bound/i
    );
  }
);

test(
  'recursive evidence history is bounded before reaching cognitive provider',
  async () => {
    const huge =
      'x'.repeat(
        30000
      );

    let secondHistory =
      null;

    let call = 0;

    const result =
      await runNaturalRecursiveEvidenceLoop({
        task:
          projectTask(),

        activation:
          activation(),

        cognitiveSession: {
          async decideEvidence(
            _objective,
            _activation,
            history
          ) {
            call += 1;

            if (call === 1) {
              return requestDecision(
                'READ_FILE',
                'large.js'
              );
            }

            secondHistory =
              history;

            return respondDecision(
              'Concluído.'
            );
          }
        },

        dispatchEvidence(
          intent
        ) {
          if (
            intent.capabilityType ===
              'GIT_READ'
          ) {
            return gitEvidence([
              'large.js'
            ]);
          }

          return fileEvidence(
            'large.js',
            huge
          );
        }
      });

    assert.equal(
      result.status,
      'COMPLETED'
    );

    assert.equal(
      secondHistory.length,
      2
    );

    assert.ok(
      secondHistory[1].length <
        13000
    );

    assert.match(
      secondHistory[1],
      /TRUNCATED_BY_SURGICAL_DEVOPS/
    );
  }
);

test(
  'loop module exposes one bounded function and no mutation surface',
  () => {
    const surface =
      require(
        '../../accelerator/cli/natural-recursive-evidence-loop'
      );

    assert.deepEqual(
      Object.keys(surface),
      [
        'runNaturalRecursiveEvidenceLoop'
      ]
    );

    for (const forbidden of [
      'patch',
      'write',
      'shell',
      'spawn',
      'exec',
      'grant',
      'approve',
      'mutate'
    ]) {
      assert.equal(
        forbidden in surface,
        false
      );
    }
  }
);

test(
  'progress observations are immutable presentation-only evidence boundaries',
  async () => {
    const decisions = [
      respondDecision('Análise fundamentada concluída.')
    ];
    const progress = [];

    const result = await runNaturalRecursiveEvidenceLoop({
      task: projectTask(),
      activation: activation(),
      cognitiveSession: {
        async decideEvidence() {
          return decisions.shift();
        }
      },
      dispatchEvidence(intent) {
        if (intent.capabilityType === 'GIT_READ') {
          return gitEvidence(['README.md']);
        }
        return fileEvidence('README.md', '# Surgical DevOps\n');
      },
      onProgress(observation) {
        progress.push(observation);
      }
    });

    assert.equal(result.status, 'COMPLETED');
    assert.deepEqual(
      progress.map((item) => item.stage),
      [
        'PLANNING_EVIDENCE',
        'EVIDENCE_OBTAINED',
        'PLANNING_EVIDENCE',
        'EVIDENCE_OBTAINED',
        'PLANNING_EVIDENCE',
        'COMPLETED'
      ]
    );
    assert.equal(progress.every(Object.isFrozen), true);
    assert.equal(
      progress.every((item) => item.operationalAuthority === false),
      true
    );
  }
);
