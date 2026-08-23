'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const os =
  require('node:os');

const path =
  require('node:path');

const childProcess =
  require('node:child_process');

const {
  createGovernedCognitiveProposal
} = require(
  '../../accelerator/core/governed-cognitive-proposal'
);

const {
  materializeCandidateIntent
} = require(
  '../../accelerator/core/deterministic-materialization'
);

const {
  admitGovernedCandidate
} = require(
  '../../accelerator/core/governed-candidate-admission'
);

const {
  dispatchCognitiveReadOnly
} = require(
  '../../accelerator/core/cognitive-readonly-dispatch'
);

const NOW =
  '2026-08-23T12:00:00.000Z';

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

function git(cwd, args) {
  return childProcess
    .execFileSync(
      'git',
      args,
      {
        cwd,
        encoding: 'utf8',
        stdio: [
          'ignore',
          'pipe',
          'pipe'
        ]
      }
    )
    .trim();
}

function fixture() {
  const root =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'sdo-cognitive-dispatch-'
      )
    );

  git(root, ['init', '-q']);

  git(
    root,
    [
      'config',
      'user.name',
      'Surgical DevOps Test'
    ]
  );

  git(
    root,
    [
      'config',
      'user.email',
      'sdo-test@example.invalid'
    ]
  );

  fs.writeFileSync(
    path.join(root, 'README.md'),
    '# fixture\n'
  );

  git(root, ['add', 'README.md']);

  git(
    root,
    [
      'commit',
      '-q',
      '-m',
      'fixture'
    ]
  );

  return root;
}

function admission() {
  const cognitiveResult =
    deepFreeze({
      schema:
        'sdo.ai_cognitive_result.v1',

      requestId:
        'req-cognitive-dispatch-1',

      requestFingerprint:
        'a'.repeat(64),

      providerId:
        'test:cognitive',

      capability:
        'PLAN',

      status:
        'COMPLETED',

      output: {
        intent: {
          capabilityType:
            'GIT_READ',

          action:
            'WORKTREE_STATUS'
        },

        rationale:
          'Inspect repository worktree state.'
      }
    });

  const proposal =
    createGovernedCognitiveProposal({
      humanIntent:
        'Inspect the repository worktree state.',

      cognitiveResult
    });

  const candidate =
    materializeCandidateIntent(
      proposal
    );

  return admitGovernedCandidate(
    candidate
  );
}

test(
  'cognitive R0 dispatch crosses only canonical orchestrator boundary',
  () => {
    const repo =
      fixture();

    try {
      const result =
        dispatchCognitiveReadOnly(
          {
            admission:
              admission(),

            repositoryPath:
              repo
          },
          {
            now: () =>
              NOW
          }
        );

      assert.equal(
        result.orchestration.status,
        'COMPLETED'
      );

      assert.equal(
        result.orchestration
          .executionAllowed,
        true
      );

      assert.equal(
        result.orchestration
          .executionAttempted,
        true
      );

      assert.equal(
        result.governed
          .operationRecord
          .requester
          .type,
        'COGNITIVE'
      );

      assert.equal(
        result.governed
          .operationRecord
          .riskLevel,
        'R0'
      );

      assert.equal(
        result.governed
          .lifecycle
          .status,
        'COMPLETED'
      );

      /*
       * result.execution is canonical adapter evidence,
       * not the original controlled request.
       */
      assert.equal(
        result.execution
          .schema,
        'sdo.git_read_result.v1'
      );

      assert.equal(
        result.execution
          .selector,
        'WORKTREE_STATUS'
      );

      /*
       * Adapter identity and action remain recorded
       * in the canonical governed Operation Record.
       */
      const adapterEvidence =
        result.governed
          .operationRecord
          .adapterEvidence;

      assert.equal(
        adapterEvidence.length,
        1
      );

      assert.equal(
        adapterEvidence[0]
          .adapterType,
        'GIT_READ'
      );

      assert.equal(
        adapterEvidence[0]
          .action,
        'WORKTREE_STATUS'
      );

      assert.equal(
        adapterEvidence[0]
          .payload,
        result.execution
      );
    } finally {
      fs.rmSync(
        repo,
        {
          recursive: true,
          force: true
        }
      );
    }
  }
);
