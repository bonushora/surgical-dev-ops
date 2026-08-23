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
  createCognitiveReadOnlyAuthorityRequest
} = require(
  '../../accelerator/core/cognitive-readonly-authority-composition'
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

  for (
    const child
    of Object.values(value)
  ) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function git(
  cwd,
  args
) {
  return childProcess
    .execFileSync(
      'git',
      args,
      {
        cwd,
        encoding:
          'utf8',
        stdio:
          [
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
        'sdo-cognitive-r0-'
      )
    );

  git(
    root,
    [
      'init',
      '-q'
    ]
  );

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
    path.join(
      root,
      'README.md'
    ),
    '# fixture\n'
  );

  git(
    root,
    [
      'add',
      'README.md'
    ]
  );

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

function cognitiveResult() {
  return deepFreeze({
    schema:
      'sdo.ai_cognitive_result.v1',

    requestId:
      'req-r0-composition-1',

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
}

function admission() {
  const proposal =
    createGovernedCognitiveProposal({
      humanIntent:
        'Inspect the repository worktree state.',

      cognitiveResult:
        cognitiveResult()
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
  'composes admitted cognitive WORKTREE_STATUS into bounded R0 governed request',
  () => {
    const repo =
      fixture();

    try {
      const source =
        admission();

      const request =
        createCognitiveReadOnlyAuthorityRequest(
          {
            admission:
              source,

            repositoryPath:
              repo
          },
          {
            now: () =>
              NOW
          }
        );

      assert.equal(
        request.mode,
        'OBSERVE'
      );

      assert.equal(
        request.risk,
        'BAIXO'
      );

      assert.equal(
        request.authorizeExecution,
        true
      );

      assert.deepEqual(
        request.files,
        []
      );

      assert.equal(
        request.execution.adapter,
        'GIT_READ'
      );

      assert.equal(
        request.execution.action,
        'WORKTREE_STATUS'
      );

      assert.equal(
        request.execution
          .grantEvaluation
          .decision,
        'ALLOWED'
      );

      assert.equal(
        request.execution
          .grantEvaluation
          .grant
          .riskLevel,
        'R0'
      );

      assert.deepEqual(
        request.execution
          .grantEvaluation
          .grant
          .scope,
        {
          operations:
            [
              'status'
            ]
        }
      );

      assert.equal(
        request.execution
          .lifecycle
          .status,
        'PENDING'
      );

      assert.ok(
        Object.isFrozen(
          request
        )
      );

      assert.ok(
        Object.isFrozen(
          request.execution
        )
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

test(
  'workspace authority comes from physical repository discovery not cognitive admission',
  () => {
    const repo =
      fixture();

    try {
      const source =
        admission();

      assert.equal(
        Object.prototype
          .hasOwnProperty
          .call(
            source,
            'repositoryPath'
          ),
        false
      );

      assert.equal(
        source.authority
          .workspaceAuthority,
        false
      );

      const request =
        createCognitiveReadOnlyAuthorityRequest(
          {
            admission:
              source,

            repositoryPath:
              repo
          },
          {
            now: () =>
              NOW
          }
        );

      assert.equal(
        request.repositoryPath,
        fs.realpathSync(repo)
      );

      assert.equal(
        request.execution.workspace,
        fs.realpathSync(repo)
      );

      assert.equal(
        request.execution
          .grantEvaluation
          .grant
          .workspace,
        fs.realpathSync(repo)
      );

      assert.equal(
        request.execution
          .operationRecord
          .workspace,
        fs.realpathSync(repo)
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

test(
  'requester records cognitive provenance without asserting human authority',
  () => {
    const repo =
      fixture();

    try {
      const source =
        admission();

      const request =
        createCognitiveReadOnlyAuthorityRequest(
          {
            admission:
              source,

            repositoryPath:
              repo
          },
          {
            now: () =>
              NOW
          }
        );

      const requester =
        request.execution
          .operationRecord
          .requester;

      assert.equal(
        requester.type,
        'COGNITIVE'
      );

      assert.equal(
        requester.id,
        `cognitive-admission:${source.fingerprint}`
      );

      assert.equal(
        source.provenance
          .humanRequesterAsserted,
        false
      );

      assert.equal(
        source.provenance
          .humanAuthorityAsserted,
        false
      );

      assert.equal(
        request.execution
          .operationRecord
          .approval,
        null
      );

      assert.equal(
        request.execution
          .operationRecord
          .approvalAuthority,
        null
      );

      assert.equal(
        request.execution
          .grantEvaluation
          .grant
          .approvalAuthorityFingerprint,
        null
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

test(
  'operation id deterministically binds admission workspace action and observation time',
  () => {
    const repo =
      fixture();

    try {
      const source =
        admission();

      const first =
        createCognitiveReadOnlyAuthorityRequest(
          {
            admission:
              source,

            repositoryPath:
              repo
          },
          {
            now: () =>
              NOW
          }
        );

      const second =
        createCognitiveReadOnlyAuthorityRequest(
          {
            admission:
              source,

            repositoryPath:
              repo
          },
          {
            now: () =>
              NOW
          }
        );

      assert.equal(
        first.execution
          .operationId,
        second.execution
          .operationId
      );

      assert.match(
        first.execution
          .operationId,
        /^cognitive-r0-[a-f0-9]{64}$/
      );

      assert.equal(
        first.execution
          .operationId,
        first.execution
          .grantEvaluation
          .grant
          .operationId
      );

      assert.equal(
        first.execution
          .operationId,
        first.execution
          .operationRecord
          .operationId
      );

      assert.equal(
        first.execution
          .operationId,
        first.execution
          .lifecycle
          .operationId
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

test(
  'mutable forged or authority-broadened admission fails closed before composition',
  () => {
    const repo =
      fixture();

    try {
      const source =
        admission();

      assert.throws(
        () =>
          createCognitiveReadOnlyAuthorityRequest(
            {
              admission:
                {
                  ...source
                },

              repositoryPath:
                repo
            },
            {
              now: () =>
                NOW
            }
          ),
        /immutable|malformed/i
      );

      const forged =
        deepFreeze({
          ...source,

          fingerprint:
            'f'.repeat(64)
        });

      assert.throws(
        () =>
          createCognitiveReadOnlyAuthorityRequest(
            {
              admission:
                forged,

              repositoryPath:
                repo
            },
            {
              now: () =>
                NOW
            }
          ),
        /fingerprint binding/i
      );

      const broadened =
        deepFreeze({
          ...source,

          authority: {
            ...source.authority,

            dispatchAllowed:
              true
          }
        });

      assert.throws(
        () =>
          createCognitiveReadOnlyAuthorityRequest(
            {
              admission:
                broadened,

              repositoryPath:
                repo
            },
            {
              now: () =>
                NOW
            }
          ),
        /authority|fingerprint/i
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

test(
  'composition cannot broaden beyond GIT_READ WORKTREE_STATUS',
  () => {
    const repo =
      fixture();

    try {
      const source =
        admission();

      const broadened =
        deepFreeze({
          ...source,

          admittedIntent:
            deepFreeze({
              capabilityType:
                'GIT_READ',

              target:
                'tracked',

              canonicalAction:
                'TRACKED_FILES'
            })
        });

      assert.throws(
        () =>
          createCognitiveReadOnlyAuthorityRequest(
            {
              admission:
                broadened,

              repositoryPath:
                repo
            },
            {
              now: () =>
                NOW
            }
          ),
        /WORKTREE_STATUS|fingerprint/i
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

test(
  'composition creates authority artifacts but performs zero dispatch',
  () => {
    const source =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/core/cognitive-readonly-authority-composition'
        ),
        'utf8'
      );

    const forbidden =
      [
        'surgical-orchestrator',
        'governed-readonly-dispatch',
        'dispatchGovernedReadOnly',
        'createGovernedReadOnlyRequest',
        'invokeControlledAdapter',
        'git-read-adapter',
        'FILESYSTEM_PATCH',
        'PATCH_FILE',
        'child_process',
        'execFile',
        'spawn(',
        'fetch(',
        'process.env',
        'sdo.governed_human_cli.v1',
        'surgical-cli-local-session'
      ];

    for (
      const marker
      of forbidden
    ) {
      assert.equal(
        source.includes(marker),
        false,
        `forbidden composition dependency: ${marker}`
      );
    }

    assert.equal(
      source.includes(
        "require('./repository-discovery')"
      ),
      true
    );

    assert.equal(
      source.includes(
        "require('./capability-grant')"
      ),
      true
    );

    assert.equal(
      source.includes(
        "require('./operation-record')"
      ),
      true
    );

    assert.equal(
      source.includes(
        "require('./state-boundary')"
      ),
      true
    );
  }
);

test(
  'composition module exposes exactly one bounded function',
  () => {
    const surface =
      require(
        '../../accelerator/core/cognitive-readonly-authority-composition'
      );

    assert.deepEqual(
      Object.keys(surface).sort(),
      [
        'createCognitiveReadOnlyAuthorityRequest'
      ]
    );

    assert.ok(
      Object.isFrozen(surface)
    );
  }
);
