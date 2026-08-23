'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  execFileSync
} = require('node:child_process');

const {
  createGovernedReadOnlyRequest,
  dispatchGovernedReadOnly,
  formatGovernedReadOnlyResult
} = require(
  '../../accelerator/cli/governed-readonly-dispatch'
);

const NOW =
  '2026-08-22T03:00:00.000Z';

function git(repo, args) {
  return execFileSync(
    'git',
    args,
    {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }
  ).trim();
}

function fixture() {
  const root =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'sdo-cli-governed-'
      )
    );

  const repo =
    path.join(root, 'repo');

  fs.mkdirSync(repo);

  git(repo, ['init', '-b', 'main']);

  git(repo, [
    'config',
    'user.email',
    'sdo@example.invalid'
  ]);

  git(repo, [
    'config',
    'user.name',
    'Surgical DevOps Test'
  ]);

  fs.writeFileSync(
    path.join(repo, 'target.js'),
    'const value = 1;\n'
  );

  fs.writeFileSync(
    path.join(repo, 'invalid.js'),
    'const = ;\n'
  );

  git(
    repo,
    ['add', 'target.js', 'invalid.js']
  );

  git(
    repo,
    ['commit', '-m', 'fixture']
  );

  return {
    root,
    repo: fs.realpathSync(repo)
  };
}

function cleanup(state) {
  fs.rmSync(
    state.root,
    {
      recursive: true,
      force: true
    }
  );
}

test(
  'governed CLI request materializes bounded immutable R1 authority',
  () => {
    const state = fixture();

    try {
      const request =
        createGovernedReadOnlyRequest(
          {
            repositoryPath: state.repo,
            capabilityType:
              'FILESYSTEM_READ',
            target: 'target.js'
          },
          {
            now: () => NOW
          }
        );

      assert.ok(Object.isFrozen(request));
      assert.ok(
        Object.isFrozen(request.execution)
      );

      assert.equal(
        request.execution.adapter,
        'FILESYSTEM_READ'
      );

      assert.equal(
        request.execution.action,
        'READ_FILE'
      );

      assert.equal(
        request.execution
          .grantEvaluation.decision,
        'ALLOWED'
      );

      assert.equal(
        request.execution
          .grantEvaluation.grant.riskLevel,
        'R1'
      );

      assert.equal(
        request.execution
          .operationRecord.riskLevel,
        'R1'
      );

      assert.equal(
        request.execution.lifecycle.status,
        'PENDING'
      );

      for (
        const forbidden of [
          'command',
          'args',
          'executable',
          'provider',
          'mutationProvider'
        ]
      ) {
        assert.equal(
          forbidden in request.execution,
          false
        );
      }
    } finally {
      cleanup(state);
    }
  }
);

test(
  'governed CLI filesystem read completes through canonical orchestrator',
  () => {
    const state = fixture();

    try {
      const result =
        dispatchGovernedReadOnly(
          {
            capabilityType:
              'FILESYSTEM_READ',
            target: 'target.js'
          },
          state.repo,
          {
            now: () => NOW
          }
        );

      assert.equal(
        result.orchestration.status,
        'COMPLETED'
      );

      assert.equal(
        result.execution.schema,
        'sdo.filesystem_read_result.v1'
      );

      assert.equal(
        result.execution.evidence.content,
        'const value = 1;\n'
      );

      assert.equal(
        result.governed.lifecycle.status,
        'COMPLETED'
      );

      assert.equal(
        result.governed
          .operationRecord
          .adapterEvidence.length,
        1
      );

      assert.match(
        formatGovernedReadOnlyResult(
          result
        ),
        /Governed filesystem read: COMPLETED/
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'governed CLI JavaScript validation completes through canonical orchestrator',
  () => {
    const state = fixture();

    try {
      const result =
        dispatchGovernedReadOnly(
          {
            capabilityType:
              'PROCESS_VALIDATION',
            target: 'target.js'
          },
          state.repo,
          {
            now: () => NOW
          }
        );

      assert.equal(
        result.orchestration.status,
        'COMPLETED'
      );

      assert.equal(
        result.execution.schema,
        'sdo.process_validation_result.v1'
      );

      assert.equal(
        result.execution.validation.status,
        'PASSED'
      );

      assert.equal(
        result.governed.lifecycle.status,
        'COMPLETED'
      );

      assert.match(
        formatGovernedReadOnlyResult(
          result
        ),
        /Validation: PASSED/
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'invalid JavaScript becomes governed FAILED state rather than successful completion',
  () => {
    const state = fixture();

    try {
      const result =
        dispatchGovernedReadOnly(
          {
            capabilityType:
              'PROCESS_VALIDATION',
            target: 'invalid.js'
          },
          state.repo,
          {
            now: () => NOW
          }
        );

      assert.equal(
        result.orchestration.status,
        'FAILED'
      );

      assert.equal(
        result.governed.lifecycle.status,
        'FAILED'
      );

      assert.equal(
        result.governed
          .operationRecord
          .finalization
          .successfulCompletionEligible,
        false
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'workspace traversal cannot become a governed read capability',
  () => {
    const state = fixture();

    try {
      assert.throws(
        () =>
          dispatchGovernedReadOnly(
            {
              capabilityType:
                'FILESYSTEM_READ',
              target: '../escape.txt'
            },
            state.repo,
            {
              now: () => NOW
            }
          ),
        /denied|scope|workspace|escape/i
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'governed CLI boundary exports no shell mutation or provider authority',
  () => {
    const boundary =
      require(
        '../../accelerator/cli/governed-readonly-dispatch'
      );

    for (
      const forbidden of [
        'exec',
        'spawn',
        'shell',
        'patch',
        'write',
        'provider',
        'compareAndReplace'
      ]
    ) {
      assert.equal(
        forbidden in boundary,
        false
      );
    }
  }
);

test(
  'governed CLI Git repository reads complete through canonical orchestrator',
  () => {
    const state = fixture();

    try {
      for (
        const target of [
          'root',
          'branch',
          'head',
          'status',
          'tracked'
        ]
      ) {
        const result =
          dispatchGovernedReadOnly(
            {
              capabilityType: 'GIT_READ',
              target
            },
            state.repo,
            {
              now: () => NOW
            }
          );

        assert.equal(
          result.orchestration.status,
          'COMPLETED'
        );

        assert.equal(
          result.execution.schema,
          'sdo.git_read_result.v1'
        );

        assert.equal(
          result.pipeline.inspection.inspection.scope,
          'REPOSITORY'
        );

        assert.deepEqual(
          result.pipeline.inspection.inspection.files,
          []
        );

        assert.equal(
          result.pipeline.classification.classification.level,
          'R0'
        );
      }
    } finally {
      cleanup(state);
    }
  }
);

test(
  'governed CLI Git status is permitted on a dirty workspace because it is R0 read-only',
  () => {
    const state = fixture();

    try {
      fs.writeFileSync(
        path.join(state.repo, 'dirty.txt'),
        'dirty\n'
      );

      const result =
        dispatchGovernedReadOnly(
          {
            capabilityType: 'GIT_READ',
            target: 'status'
          },
          state.repo,
          {
            now: () => NOW
          }
        );

      assert.equal(
        result.orchestration.status,
        'COMPLETED'
      );

      assert.equal(
        result.pipeline.classification.classification.level,
        'R0'
      );

      assert.equal(
        result.pipeline.classification.governance.worktreeCleanRequired,
        false
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'governed workspace-files enumerates tracked and untracked project files through fixed Git read',
  () => {
    const state =
      fixture();

    try {
      fs.writeFileSync(
        path.join(
          state.repo,
          'untracked.txt'
        ),
        'untracked\n'
      );

      const result =
        dispatchGovernedReadOnly(
          {
            capabilityType:
              'GIT_READ',

            target:
              'workspace-files'
          },

          state.repo,

          {
            now:
              () => NOW
          }
        );

      assert.equal(
        result.orchestration.status,
        'COMPLETED'
      );

      assert.equal(
        result.execution.selector,
        'WORKSPACE_FILES'
      );

      assert.ok(
        Array.isArray(
          result.execution.result.files
        )
      );

      assert.ok(
        result.execution.result.files.includes(
          'target.js'
        )
      );

      assert.ok(
        result.execution.result.files.includes(
          'untracked.txt'
        )
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'governed filesystem read remains observable on dirty worktree without mutation authority',
  () => {
    const state = fixture();

    try {
      fs.writeFileSync(
        path.join(
          state.repo,
          'untracked-residue.txt'
        ),
        'residue\n'
      );

      const result =
        dispatchGovernedReadOnly(
          {
            capabilityType:
              'FILESYSTEM_READ',
            target:
              'target.js'
          },
          state.repo,
          {
            now: () => NOW
          }
        );

      assert.equal(
        result.worktree.clean,
        false
      );

      assert.equal(
        result.orchestration.status,
        'COMPLETED'
      );

      assert.equal(
        result.execution.schema,
        'sdo.filesystem_read_result.v1'
      );

      assert.equal(
        result.execution.evidence.content,
        'const value = 1;\n'
      );

      assert.equal(
        result.governed.lifecycle.status,
        'COMPLETED'
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'governed filesystem read traversal remains fail-closed on dirty worktree',
  () => {
    const state = fixture();

    try {
      fs.writeFileSync(
        path.join(
          state.repo,
          'untracked-residue.txt'
        ),
        'residue\n'
      );

      assert.throws(
        () =>
          dispatchGovernedReadOnly(
            {
              capabilityType:
                'FILESYSTEM_READ',
              target:
                '../outside.txt'
            },
            state.repo,
            {
              now: () => NOW
            }
          )
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'filesystem read preserves R1 capability authority while operational effect remains R0',
  () => {
    const state =
      fixture();

    try {
      fs.writeFileSync(
        path.join(
          state.repo,
          'untracked-authority-proof.txt'
        ),
        'dirty\n'
      );

      const result =
        dispatchGovernedReadOnly(
          {
            capabilityType:
              'FILESYSTEM_READ',

            target:
              'target.js'
          },

          state.repo,

          {
            now:
              () => NOW
          }
        );

      assert.equal(
        result.worktree.clean,
        false
      );

      assert.equal(
        result.pipeline
          .classification
          .classification
          .level,
        'R0'
      );

      assert.equal(
        result.pipeline
          .classification
          .governance
          .worktreeCleanRequired,
        false
      );

      assert.equal(
        result.orchestration.status,
        'COMPLETED'
      );

      assert.equal(
        result.execution.schema,
        'sdo.filesystem_read_result.v1'
      );

      assert.equal(
        result.governed
          .operationRecord
          .riskLevel,
        'R1'
      );

      assert.equal(
        result.governed
          .operationRecord
          .adapterEvidence[0]
          .riskLevel,
        'R1'
      );
    } finally {
      cleanup(state);
    }
  }
);
