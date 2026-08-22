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
