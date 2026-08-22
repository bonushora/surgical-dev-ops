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
  execFileSync
} = require(
  'node:child_process'
);

const cli =
  require(
    '../../accelerator/cli/surgical'
  );

const {
  provisionLocalOfflineHumanAuthority
} = require(
  '../../accelerator/core/local-offline-human-authority-store'
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
        'sdo-cli-patch-session-'
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

test(
  'surgical patch intent executes through the qualified governed production boundary',
  () => {
    const state =
      fixture();

    try {
      const activation =
        cli.createInteractiveActivation(
          state.repo
        );

      const replacement =
        Buffer.from(
          'const value = 2;\n',
          'utf8'
        ).toString(
          'base64'
        );

      const parsed =
        cli.handleInteractiveCommand(
          `patch target.js --content-base64 ${replacement}`,
          activation
        );

      assert.equal(
        parsed.action,
        'DISPATCH'
      );

      const output =
        cli.dispatchInteractiveIntent(
          parsed.intent,
          activation,
          {
            patchOptions: {
              authorityRoot:
                state.authorityRoot,

              journalStorageRoot:
                state.journalRoot,

              tenantId:
                'tenant-1',

              projectId:
                'project-1'
            }
          }
        );

      assert.match(
        output,
        /Governed filesystem patch: COMPLETED/
      );

      /*
       * ADR-010/H contract:
       * ordinary pathname remains non-authoritative.
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
    } finally {
      cleanup(state);
    }
  }
);

test(
  'malformed Base64 fails closed before governed patch dispatch',
  () => {
    const state =
      fixture();

    try {
      const activation =
        cli.createInteractiveActivation(
          state.repo
        );

      assert.throws(
        () =>
          cli.dispatchInteractiveIntent(
            {
              capabilityType:
                'FILESYSTEM_PATCH',

              target:
                'target.js',

              replacementBase64:
                '***not-base64***'
            },

            activation,

            {
              patchOptions: {
                authorityRoot:
                  state.authorityRoot,

                journalStorageRoot:
                  state.journalRoot
              }
            }
          ),
        /Base64|malformed|canonical/i
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
  'missing production human authority configuration fails closed',
  () => {
    const state =
      fixture();

    try {
      const activation =
        cli.createInteractiveActivation(
          state.repo
        );

      const replacement =
        Buffer.from(
          'const value = 2;\n'
        ).toString(
          'base64'
        );

      assert.throws(
        () =>
          cli.dispatchInteractiveIntent(
            {
              capabilityType:
                'FILESYSTEM_PATCH',

              target:
                'target.js',

              replacementBase64:
                replacement
            },

            activation,

            {
              patchOptions: {
                authorityRoot:
                  undefined,

                journalStorageRoot:
                  state.journalRoot
              }
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
  'CLI patch wiring exposes no provider private key shell or generic process authority',
  () => {
    const source =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/cli/surgical'
        ),
        'utf8'
      );

    for (const forbidden of [
      'private-key.pem',
      'createPrivateKey',
      'crypto.sign',
      'mutationProvider:',
      'providerId:',
      'compareAndReplace:',
      'child_process',
      'execSync',
      'spawnSync',
      'execFileSync'
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

test(
  'production environment configuration contains paths and tenancy only',
  () => {
    const options =
      cli.patchOptionsFromEnvironment({
        SDO_HUMAN_AUTHORITY_ROOT:
          '/tmp/human-authority',

        SDO_MUTATION_JOURNAL_ROOT:
          '/tmp/mutation-journal',

        SDO_TENANT_ID:
          'tenant-1',

        SDO_PROJECT_ID:
          'project-1',

        SDO_PRIVATE_KEY:
          'must-not-be-consumed'
      });

    assert.deepEqual(
      options,
      {
        authorityRoot:
          '/tmp/human-authority',

        journalStorageRoot:
          '/tmp/mutation-journal',

        tenantId:
          'tenant-1',

        projectId:
          'project-1'
      }
    );

    assert.equal(
      'privateKey' in options,
      false
    );
  }
);
