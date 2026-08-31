'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const crypto =
  require('node:crypto');

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

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

function fixture() {
  const root =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'sdo-production-e2e-'
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
      'Surgical DevOps E2E'
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
      'e2e fixture'
    ]
  );

  provisionLocalOfflineHumanAuthority({
    authorityRoot,
    issuer:
      'local:e2e-human',
    subjectId:
      'e2e-human'
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

function productionEnvironment(
  state,
  overrides = {}
) {
  return {
    ...process.env,

    SDO_HUMAN_AUTHORITY_ROOT:
      state.authorityRoot,

    SDO_MUTATION_JOURNAL_ROOT:
      state.journalRoot,

    SDO_TENANT_ID:
      'tenant-e2e',

    SDO_PROJECT_ID:
      'project-e2e',

    ...overrides
  };
}

function runCli(
  state,
  input,
  environment =
    productionEnvironment(state)
) {
  return spawnSync(
    process.execPath,
    [
      CLI,
      '--interaction',
      'EXPERT'
    ],
    {
      cwd:
        state.repo,

      env: {
        ...environment,

        /*
         * A real user's saved interaction preference must never
         * influence this process-level production fixture.
         */
        XDG_CONFIG_HOME:
          state.root,

        LOCALAPPDATA:
          state.root,

        APPDATA:
          state.root
      },

      input,

      encoding:
        'utf8',

      timeout:
        15_000,

      maxBuffer:
        4 * 1024 * 1024
    }
  );
}

test(
  'real EXPERT surgical process activates a deterministic human session',
  () => {
    const state =
      fixture();

    try {
      const outcome =
        runCli(
          state,
          [
            'status',
            'exit',
            ''
          ].join('\n')
        );

      assert.equal(
        outcome.status,
        0,
        outcome.stderr
      );

      assert.equal(
        outcome.signal,
        null
      );

      assert.match(
        outcome.stdout,
        /surgical>/i
      );

      assert.match(
        outcome.stdout,
        /DETERMIN/i
      );

      assert.match(
        outcome.stdout,
        /Surgical session closed/i
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'real EXPERT surgical process executes governed Level 1 read before R3 mutation',
  () => {
    const state =
      fixture();

    try {
      const outcome =
        runCli(
          state,
          [
            'read target.js',
            'exit',
            ''
          ].join('\n')
        );

      assert.equal(
        outcome.status,
        0,
        outcome.stderr
      );

      assert.match(
        outcome.stdout,
        /Governed filesystem read: COMPLETED/
      );

      assert.match(
        outcome.stdout,
        /target\.js/
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
  'real EXPERT surgical process traverses human CLI to qualified R3 production mutation boundary',
  () => {
    const state =
      fixture();

    try {
      const before =
        'const value = 1;\n';

      const after =
        'const value = 2;\n';

      const encoded =
        Buffer.from(
          after,
          'utf8'
        ).toString(
          'base64'
        );

      const outcome =
        runCli(
          state,
          [
            `patch target.js --content-base64 ${encoded}`,
            'exit',
            ''
          ].join('\n')
        );

      assert.equal(
        outcome.status,
        0,
        outcome.stderr
      );

      assert.equal(
        outcome.signal,
        null
      );

      assert.match(
        outcome.stdout,
        /Governed filesystem patch: COMPLETED/
      );

      assert.match(
        outcome.stdout,
        /Operation: cli-patch-[a-f0-9]{64}/
      );

      assert.match(
        outcome.stdout,
        new RegExp(
          `Before SHA256: ${sha256(before)}`
        )
      );

      assert.match(
        outcome.stdout,
        new RegExp(
          `Replacement SHA256: ${sha256(after)}`
        )
      );

      /*
       * ADR-010/H invariant:
       * the ordinary worktree pathname does not become
       * authoritative AFTER state.
       */
      assert.equal(
        fs.readFileSync(
          path.join(
            state.repo,
            'target.js'
          ),
          'utf8'
        ),
        before
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

      const journalEntries =
        fs.readdirSync(
          state.journalRoot
        );

      assert.ok(
        journalEntries.length > 0,
        'Expected durable mutation journal evidence.'
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'real EXPERT surgical process can perform read then governed patch in one persistent human session',
  () => {
    const state =
      fixture();

    try {
      const after =
        'const value = 42;\n';

      const encoded =
        Buffer.from(
          after,
          'utf8'
        ).toString(
          'base64'
        );

      const outcome =
        runCli(
          state,
          [
            'status',
            'git head',
            'read target.js',
            `patch target.js --content-base64 ${encoded}`,
            'status',
            'exit',
            ''
          ].join('\n')
        );

      assert.equal(
        outcome.status,
        0,
        outcome.stderr
      );

      assert.match(
        outcome.stdout,
        /Governed Git read: COMPLETED/
      );

      assert.match(
        outcome.stdout,
        /Governed filesystem read: COMPLETED/
      );

      assert.match(
        outcome.stdout,
        /Governed filesystem patch: COMPLETED/
      );

      assert.match(
        outcome.stdout,
        /Surgical session closed/
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'real CLI process fails closed when human authority configuration is absent',
  () => {
    const state =
      fixture();

    try {
      const after =
        'const value = 2;\n';

      const encoded =
        Buffer.from(
          after,
          'utf8'
        ).toString(
          'base64'
        );

      const env = {
        ...process.env,

        SDO_MUTATION_JOURNAL_ROOT:
          state.journalRoot,

        SDO_TENANT_ID:
          'tenant-e2e',

        SDO_PROJECT_ID:
          'project-e2e'
      };

      delete env.SDO_HUMAN_AUTHORITY_ROOT;

      const outcome =
        runCli(
          state,
          [
            `patch target.js --content-base64 ${encoded}`,
            'exit',
            ''
          ].join('\n'),
          env
        );

      assert.equal(
        outcome.status,
        0,
        outcome.stderr
      );

      assert.match(
        outcome.stdout,
        /Governed request denied: operation failed closed/
      );

      assert.doesNotMatch(
        outcome.stdout,
        /Governed filesystem patch: COMPLETED/
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

      assert.equal(
        fs.readdirSync(
          state.journalRoot
        ).length,
        0
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'real CLI process rejects malformed replacement encoding without mutation',
  () => {
    const state =
      fixture();

    try {
      const outcome =
        runCli(
          state,
          [
            'patch target.js --content-base64 ***invalid***',
            'exit',
            ''
          ].join('\n')
        );

      assert.equal(
        outcome.status,
        0,
        outcome.stderr
      );

      assert.match(
        outcome.stdout,
        /Governed request denied: operation failed closed/
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

      assert.equal(
        fs.readdirSync(
          state.journalRoot
        ).length,
        0
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'real CLI process ignores unrecognized private-key environment authority',
  () => {
    const state =
      fixture();

    try {
      const after =
        'const value = 7;\n';

      const encoded =
        Buffer.from(
          after,
          'utf8'
        ).toString(
          'base64'
        );

      const outcome =
        runCli(
          state,
          [
            `patch target.js --content-base64 ${encoded}`,
            'exit',
            ''
          ].join('\n'),
          productionEnvironment(
            state,
            {
              SDO_PRIVATE_KEY:
                'caller-must-not-become-authority'
            }
          )
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

      /*
       * Completion must derive from the provisioned authority root,
       * never from caller-provided private-key environment material.
       */
      assert.doesNotMatch(
        outcome.stdout,
        /caller-must-not-become-authority/
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'production CLI source does not itself acquire signing provider or generic shell authority',
  () => {
    const source =
      fs.readFileSync(
        CLI,
        'utf8'
      );

    for (const forbidden of [
      'createPrivateKey',
      'private-key.pem',
      'crypto.sign',
      'mutationProvider:',
      'providerId:',
      'compareAndReplace:',
      'child_process',
      'execSync',
      'execFileSync',
      'spawnSync'
    ]) {
      assert.equal(
        source.includes(
          forbidden
        ),
        false,
        forbidden
      );
    }
  }
);
