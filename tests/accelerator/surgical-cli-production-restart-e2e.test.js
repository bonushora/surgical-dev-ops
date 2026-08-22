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

const {
  execFileSync,
  spawnSync
} = require(
  'node:child_process'
);

const {
  provisionLocalOfflineHumanAuthority
} = require(
  '../../accelerator/core/local-offline-human-authority-store'
);

const CLI =
  path.resolve(
    __dirname,
    '../../accelerator/cli/surgical.js'
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
        'sdo-production-restart-e2e-'
      )
    );

  const repo =
    path.join(root, 'repo');

  const authorityRoot =
    path.join(
      root,
      'human-authority'
    );

  const journalRoot =
    path.join(
      root,
      'mutation-journal'
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
      'Surgical DevOps Restart E2E'
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
      'restart e2e fixture'
    ]
  );

  provisionLocalOfflineHumanAuthority({
    authorityRoot,
    issuer:
      'local:restart-e2e-human',
    subjectId:
      'restart-e2e-human'
  });

  return {
    root,

    repo:
      fs.realpathSync(repo),

    authorityRoot:
      fs.realpathSync(
        authorityRoot
      ),

    journalRoot:
      fs.realpathSync(
        journalRoot
      )
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

function environment(state) {
  return {
    ...process.env,

    SDO_HUMAN_AUTHORITY_ROOT:
      state.authorityRoot,

    SDO_MUTATION_JOURNAL_ROOT:
      state.journalRoot,

    SDO_TENANT_ID:
      'tenant-restart-e2e',

    SDO_PROJECT_ID:
      'project-restart-e2e'
  };
}

function runProcess(
  state,
  commands
) {
  return spawnSync(
    process.execPath,
    [
      CLI
    ],
    {
      cwd:
        state.repo,

      env:
        environment(state),

      input:
        [
          ...commands,
          'exit',
          ''
        ].join('\n'),

      encoding:
        'utf8',

      timeout:
        15_000,

      maxBuffer:
        4 * 1024 * 1024
    }
  );
}

function patchCommand(
  target,
  content
) {
  const encoded =
    Buffer.from(
      content,
      'utf8'
    ).toString(
      'base64'
    );

  return (
    `patch ${target} ` +
    `--content-base64 ${encoded}`
  );
}

function journalSnapshot(root) {
  function walk(directory) {
    const result = [];

    for (
      const name
      of fs.readdirSync(directory).sort()
    ) {
      const absolute =
        path.join(
          directory,
          name
        );

      const stat =
        fs.lstatSync(absolute);

      if (stat.isDirectory()) {
        result.push({
          type: 'directory',
          path:
            path.relative(
              root,
              absolute
            )
        });

        result.push(
          ...walk(absolute)
        );
      } else {
        result.push({
          type: 'file',
          path:
            path.relative(
              root,
              absolute
            ),
          content:
            fs.readFileSync(
              absolute,
              'utf8'
            )
        });
      }
    }

    return result;
  }

  return walk(root);
}

test(
  'second real surgical process reopens the same governed workspace without inheriting process-local authority',
  () => {
    const state =
      fixture();

    try {
      const first =
        runProcess(
          state,
          [
            'status',
            'git head',
            'read target.js'
          ]
        );

      assert.equal(
        first.status,
        0,
        first.stderr
      );

      assert.match(
        first.stdout,
        /Governed Git read: COMPLETED/
      );

      assert.match(
        first.stdout,
        /Governed filesystem read: COMPLETED/
      );

      const second =
        runProcess(
          state,
          [
            'status',
            'git head',
            'read target.js'
          ]
        );

      assert.equal(
        second.status,
        0,
        second.stderr
      );

      assert.match(
        second.stdout,
        /Governed Git read: COMPLETED/
      );

      assert.match(
        second.stdout,
        /Governed filesystem read: COMPLETED/
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
  'second real process can operate after first-process governed R3 completion',
  () => {
    const state =
      fixture();

    try {
      const first =
        runProcess(
          state,
          [
            patchCommand(
              'target.js',
              'const value = 2;\n'
            )
          ]
        );

      assert.equal(
        first.status,
        0,
        first.stderr
      );

      assert.match(
        first.stdout,
        /Governed filesystem patch: COMPLETED/
      );

      /*
       * The worktree remains a projection and must not
       * self-promote into AFTER authority.
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

      const durableAfterFirst =
        journalSnapshot(
          state.journalRoot
        );

      assert.ok(
        durableAfterFirst.length > 0,
        'First process must leave durable evidence.'
      );

      const second =
        runProcess(
          state,
          [
            'status',
            'git head',
            'read target.js'
          ]
        );

      assert.equal(
        second.status,
        0,
        second.stderr
      );

      assert.match(
        second.stdout,
        /Governed Git read: COMPLETED/
      );

      assert.match(
        second.stdout,
        /Governed filesystem read: COMPLETED/
      );

      /*
       * Restarting the human CLI must not silently rewrite
       * durable mutation history.
       */
      assert.deepEqual(
        journalSnapshot(
          state.journalRoot
        ),
        durableAfterFirst
      );

      assert.equal(
        git(
          state.repo,
          [
            'status',
            '--porcelain'
          ]
        ),
        ''
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'identical governed patch from a second process does not redefine authoritative state',
  () => {
    const state =
      fixture();

    try {
      const command =
        patchCommand(
          'target.js',
          'const value = 2;\n'
        );

      const first =
        runProcess(
          state,
          [
            command
          ]
        );

      assert.equal(
        first.status,
        0,
        first.stderr
      );

      assert.match(
        first.stdout,
        /Governed filesystem patch: COMPLETED/
      );

      const afterFirst =
        journalSnapshot(
          state.journalRoot
        );

      const second =
        runProcess(
          state,
          [
            command
          ]
        );

      assert.equal(
        second.status,
        0,
        second.stderr
      );

      /*
       * An identical second-process request may converge
       * deterministically, but must never turn the ordinary
       * pathname into mutation authority.
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

      const afterSecond =
        journalSnapshot(
          state.journalRoot
        );

      assert.ok(
        afterSecond.length >=
          afterFirst.length
      );

      assert.equal(
        git(
          state.repo,
          [
            'status',
            '--porcelain'
          ]
        ),
        ''
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'conflicting second-process governed patch cannot silently replace first authoritative result',
  () => {
    const state =
      fixture();

    try {
      const first =
        runProcess(
          state,
          [
            patchCommand(
              'target.js',
              'const value = 2;\n'
            )
          ]
        );

      assert.equal(
        first.status,
        0,
        first.stderr
      );

      assert.match(
        first.stdout,
        /Governed filesystem patch: COMPLETED/
      );

      const durableFirst =
        journalSnapshot(
          state.journalRoot
        );

      const second =
        runProcess(
          state,
          [
            patchCommand(
              'target.js',
              'const value = 999;\n'
            )
          ]
        );

      assert.equal(
        second.status,
        0,
        second.stderr
      );

      /*
       * Whatever terminal governed classification is selected
       * by the orchestration boundary, the ordinary worktree
       * must remain incapable of redefining authority.
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

      assert.equal(
        git(
          state.repo,
          [
            'status',
            '--porcelain'
          ]
        ),
        ''
      );

      assert.ok(
        journalSnapshot(
          state.journalRoot
        ).length >=
          durableFirst.length
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'restart continuity uses persistent human authority without exposing private material to process output',
  () => {
    const state =
      fixture();

    try {
      const first =
        runProcess(
          state,
          [
            patchCommand(
              'target.js',
              'const value = 2;\n'
            )
          ]
        );

      const second =
        runProcess(
          state,
          [
            'status'
          ]
        );

      assert.equal(
        first.status,
        0,
        first.stderr
      );

      assert.equal(
        second.status,
        0,
        second.stderr
      );

      const combined =
        [
          first.stdout,
          first.stderr,
          second.stdout,
          second.stderr
        ].join('\n');

      assert.doesNotMatch(
        combined,
        /BEGIN PRIVATE KEY/
      );

      assert.doesNotMatch(
        combined,
        /private-key\.pem/
      );

      assert.doesNotMatch(
        combined,
        /Ed25519 PRIVATE/
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'process restart cannot gain authority from caller-selected provider environment',
  () => {
    const state =
      fixture();

    try {
      const env =
        environment(state);

      env.SDO_MUTATION_PROVIDER =
        'caller-forged-provider';

      env.SDO_PROVIDER_ID =
        'caller-forged-provider';

      const outcome =
        spawnSync(
          process.execPath,
          [
            CLI
          ],
          {
            cwd:
              state.repo,

            env,

            input:
              [
                patchCommand(
                  'target.js',
                  'const value = 2;\n'
                ),
                'exit',
                ''
              ].join('\n'),

            encoding:
              'utf8',

            timeout:
              15_000,

            maxBuffer:
              4 * 1024 * 1024
          }
        );

      assert.equal(
        outcome.status,
        0,
        outcome.stderr
      );

      assert.match(
        outcome.stdout,
        /Governed filesystem patch: COMPLETED/
      );

      assert.doesNotMatch(
        outcome.stdout,
        /caller-forged-provider/
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
