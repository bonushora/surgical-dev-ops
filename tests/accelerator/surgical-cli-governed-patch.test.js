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
  provisionLocalOfflineHumanAuthority
} = require(
  '../../accelerator/core/local-offline-human-authority-store'
);

const {
  createGovernedPatchRequest,
  dispatchGovernedPatch,
  formatGovernedPatchResult
} = require(
  '../../accelerator/cli/governed-patch-dispatch'
);

function git(repo, args) {
  return execFileSync(
    'git',
    args,
    {
      cwd: repo,
      encoding: 'utf8',
      stdio: [
        'ignore',
        'pipe',
        'pipe'
      ]
    }
  ).trim();
}

function fixture() {
  const root =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'sdo-governed-patch-'
      )
    );

  const repo =
    path.join(
      root,
      'repo'
    );

  const authorityRoot =
    path.join(
      root,
      'authority'
    );

  const journalRoot =
    path.join(
      root,
      'journal'
    );

  fs.mkdirSync(repo);
  fs.mkdirSync(journalRoot);

  git(
    repo,
    [
      'init',
      '-b',
      'main'
    ]
  );

  git(
    repo,
    [
      'config',
      'user.email',
      'sdo@example.invalid'
    ]
  );

  git(
    repo,
    [
      'config',
      'user.name',
      'Surgical DevOps Test'
    ]
  );

  fs.writeFileSync(
    path.join(
      repo,
      'target.js'
    ),
    'const value = 1;\n'
  );

  git(
    repo,
    [
      'add',
      'target.js'
    ]
  );

  git(
    repo,
    [
      'commit',
      '-m',
      'fixture'
    ]
  );

  provisionLocalOfflineHumanAuthority({
    authorityRoot,
    issuer:
      'local:test-human',
    subjectId:
      'human-test'
  });

  return {
    root,
    repo:
      fs.realpathSync(repo),
    authorityRoot:
      fs.realpathSync(authorityRoot),
    journalRoot:
      fs.realpathSync(journalRoot)
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

function options(state) {
  return {
    authorityRoot:
      state.authorityRoot,

    journalStorageRoot:
      state.journalRoot,

    tenantId:
      'tenant-1',

    projectId:
      'project-1'
  };
}

test(
  'governed patch preparation creates exact bounded R3 authority',
  () => {
    const state =
      fixture();

    try {
      const prepared =
        createGovernedPatchRequest({
          repositoryPath:
            state.repo,

          target:
            'target.js',

          replacement:
            'const value = 2;\n',

          ...options(state)
        });

      assert.ok(
        Object.isFrozen(prepared)
      );

      assert.equal(
        prepared.request.execution.adapter,
        'FILESYSTEM_PATCH'
      );

      assert.equal(
        prepared.request.execution.action,
        'PATCH_FILE'
      );

      assert.equal(
        prepared.request.execution
          .grantEvaluation.decision,
        'ALLOWED'
      );

      assert.equal(
        prepared.request.execution
          .grantEvaluation.grant.riskLevel,
        'R3'
      );

      assert.equal(
        prepared.request.execution
          .operationRecord.riskLevel,
        'R3'
      );

      assert.equal(
        prepared.request.policy.decision,
        'APPROVAL_REQUIRED'
      );

      for (const forbidden of [
        'provider',
        'providerId',
        'mutationProvider',
        'compareAndReplace',
        'command',
        'args',
        'executable'
      ]) {
        assert.equal(
          Object.prototype.hasOwnProperty.call(
            prepared.request.execution,
            forbidden
          ),
          false
        );
      }
    } finally {
      cleanup(state);
    }
  }
);

test(
  'governed patch applies one exact physical replacement through production runtime',
  () => {
    const state =
      fixture();

    try {
      const result =
        dispatchGovernedPatch(
          {
            target:
              'target.js',

            replacement:
              'const value = 2;\n'
          },

          state.repo,

          options(state)
        );

      assert.equal(
        result.orchestration
          .orchestration.status,
        'COMPLETED',
        JSON.stringify(
          result.orchestration.execution
        )
      );

      assert.equal(
        result.orchestration
          .execution.outcome,
        'APPLIED'
      );

      /*
       * Content-addressed R3 authority intentionally does not rewrite
       * the ordinary worktree pathname. The authoritative AFTER state
       * lives in the immutable managed projection selected by manifest CAS.
       */
      assert.equal(
        fs.readFileSync(
          path.join(
            state.repo,
            'target.js'
          ),
          'utf8'
        ),
        'const value = 1;\n'
      );

      const mutationProvider =
        result.orchestration
          .execution
          .mutationProvider;

      assert.ok(
        mutationProvider
      );

      assert.equal(
        mutationProvider
          .durability
          .ordinaryWorktreeAuthoritative,
        false
      );

      const projection =
        mutationProvider
          .durability
          .materialization
          .projection;

      assert.equal(
        fs.readFileSync(
          projection,
          'utf8'
        ),
        'const value = 2;\n'
      );

      assert.equal(
        mutationProvider
          .durability
          .materialization
          .expectedManifestOid,
        mutationProvider
          .durability
          .authority
          .afterManifestOid
      );

      assert.equal(
        mutationProvider
          .durability
          .materialization
          .observedManifestOid,
        mutationProvider
          .durability
          .authority
          .afterManifestOid
      );

      assert.match(
        formatGovernedPatchResult(
          result
        ),
        /Governed filesystem patch: COMPLETED/
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'path traversal fails closed before mutation',
  () => {
    const state =
      fixture();

    try {
      assert.throws(
        () =>
          dispatchGovernedPatch(
            {
              target:
                '../escape.js',

              replacement:
                'owned\n'
            },

            state.repo,

            options(state)
          ),
        /outside|scope|target|workspace|resolved/i
      );

      assert.equal(
        fs.readFileSync(
          path.join(
            state.repo,
            'target.js'
          ),
          'utf8'
        ),
        'const value = 1;\n'
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'dirty worktree fails closed before authority is minted',
  () => {
    const state =
      fixture();

    try {
      fs.writeFileSync(
        path.join(
          state.repo,
          'dirty.txt'
        ),
        'dirty\n'
      );

      assert.throws(
        () =>
          dispatchGovernedPatch(
            {
              target:
                'target.js',

              replacement:
                'const value = 2;\n'
            },

            state.repo,

            options(state)
          ),
        /clean worktree/i
      );

      assert.equal(
        fs.readFileSync(
          path.join(
            state.repo,
            'target.js'
          ),
          'utf8'
        ),
        'const value = 1;\n'
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'missing human authority fails closed without mutation',
  () => {
    const state =
      fixture();

    try {
      assert.throws(
        () =>
          dispatchGovernedPatch(
            {
              target:
                'target.js',

              replacement:
                'const value = 2;\n'
            },

            state.repo,

            {
              ...options(state),
              authorityRoot:
                path.join(
                  state.root,
                  'missing-authority'
                )
            }
          )
      );

      assert.equal(
        fs.readFileSync(
          path.join(
            state.repo,
            'target.js'
          ),
          'utf8'
        ),
        'const value = 1;\n'
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'governed patch boundary exposes no provider shell or generic command authority',
  () => {
    const boundary =
      require(
        '../../accelerator/cli/governed-patch-dispatch'
      );

    for (const forbidden of [
      'exec',
      'spawn',
      'shell',
      'provider',
      'compareAndReplace',
      'writeFile',
      'command'
    ]) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          boundary,
          forbidden
        ),
        false
      );
    }

    const source =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/cli/governed-patch-dispatch'
        ),
        'utf8'
      );

    assert.doesNotMatch(
      source,
      /child_process|execSync|spawnSync|execFileSync/
    );

    assert.doesNotMatch(
      source,
      /mutationProvider\s*:|providerId\s*:|compareAndReplace\s*:/
    );
  }
);

test(
  'read-only dispatcher remains mutation-authority-free',
  () => {
    const boundary =
      require(
        '../../accelerator/cli/governed-readonly-dispatch'
      );

    for (const forbidden of [
      'patch',
      'write',
      'provider',
      'compareAndReplace'
    ]) {
      assert.equal(
        forbidden in boundary,
        false
      );
    }
  }
);
