'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const {
  createInteractionPreferenceStore
} = require(
  '../../accelerator/cli/interaction-preference-store'
);

const ROOT = path.resolve(__dirname, '../..');
const CLI = path.join(
  ROOT,
  'accelerator',
  'cli',
  'surgical.js'
);

function temporaryDirectory() {
  return fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdo-onboarding-')
  );
}

test('one preference store persists interface only and never authority', () => {
  const directory = temporaryDirectory();
  const store =
    createInteractionPreferenceStore({
      configurationDirectory: directory
    });

  assert.equal(store.load(), null);

  const saved = store.save({
    language: 'PT-BR',
    interactionMode: 'NATURAL'
  });

  assert.deepEqual(store.load(), saved);
  assert.equal(saved.authority, false);
  assert.equal(saved.operationalAuthority, false);
  assert.equal(saved.mutationAuthority, false);
  assert.ok(Object.isFrozen(saved));
});

test('corrupt or authority-bearing preference fails closed', () => {
  const directory = temporaryDirectory();
  const file = path.join(
    directory,
    'interaction-preference.json'
  );
  const store =
    createInteractionPreferenceStore({
      configurationDirectory: directory
    });

  fs.writeFileSync(file, '{broken', 'utf8');
  assert.throws(() => store.load());

  fs.writeFileSync(
    file,
    JSON.stringify({
      schema: 'sdo.interaction_preference.v1',
      language: 'EN',
      interactionMode: 'EXPERT',
      authority: true,
      operationalAuthority: false,
      mutationAuthority: false
    }),
    'utf8'
  );

  assert.throws(
    () => store.load(),
    /authority-bearing/i
  );
});

test('bilingual onboarding persists NATURAL and subsequent launch reuses it', () => {
  const configurationBase = temporaryDirectory();
  const environment = {
    ...process.env,
    XDG_CONFIG_HOME: configurationBase
  };

  const configured = spawnSync(
    process.execPath,
    [CLI, '--configure'],
    {
      cwd: ROOT,
      env: environment,
      input: '1\n1\n',
      encoding: 'utf8'
    }
  );

  assert.equal(configured.status, 0, configured.stderr);
  assert.match(configured.stdout, /Português/);
  assert.match(configured.stdout, /NATURAL selecionado/);

  const relaunched = spawnSync(
    process.execPath,
    [CLI],
    {
      cwd: ROOT,
      env: environment,
      input: '',
      encoding: 'utf8'
    }
  );

  assert.equal(relaunched.status, 0, relaunched.stderr);
  assert.match(
    relaunched.stdout,
    /Você pode conversar comigo normalmente/
  );
});

test('explicit interaction override wins without rewriting saved preference', () => {
  const configurationBase = temporaryDirectory();
  const directory = path.join(
    configurationBase,
    'surgical-dev-ops'
  );
  fs.mkdirSync(directory);

  const store =
    createInteractionPreferenceStore({
      configurationDirectory: directory
    });
  store.save({
    language: 'EN',
    interactionMode: 'NATURAL'
  });

  const result = spawnSync(
    process.execPath,
    [CLI, '--interaction', 'EXPERT'],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        XDG_CONFIG_HOME: configurationBase
      },
      input: '',
      encoding: 'utf8'
    }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Interaction: EXPERT/);
  assert.equal(
    store.load().interactionMode,
    'NATURAL'
  );
});

test('non-interactive launch without preference preserves EXPERT compatibility', () => {
  const configurationBase = temporaryDirectory();
  const result = spawnSync(
    process.execPath,
    [CLI],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        XDG_CONFIG_HOME: configurationBase
      },
      input: '',
      encoding: 'utf8'
    }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Interaction: EXPERT/);
  assert.equal(
    fs.existsSync(
      path.join(
        configurationBase,
        'surgical-dev-ops'
      )
    ),
    false
  );
});

test('onboarding modules export no shell process or orchestration authority', () => {
  for (const relative of [
    'accelerator/cli/interaction-preference-store.js',
    'accelerator/cli/unified-interaction-onboarding.js'
  ]) {
    const source =
      fs.readFileSync(
        path.join(ROOT, relative),
        'utf8'
      );

    assert.doesNotMatch(
      source,
      /child_process|execSync|spawnSync|orchestrate|dispatchGovernedPatch/
    );
  }
});

test('npm publication is gated by the complete native matrix and exact tag', () => {
  const workflow = fs.readFileSync(
    path.join(
      ROOT,
      '.github',
      'workflows',
      'accelerator-conformance.yml'
    ),
    'utf8'
  );

  assert.match(workflow, /tags:\s*\n\s*- 'v\*'/);
  assert.match(workflow, /publish-npm:[\s\S]+needs:[\s\S]+accelerator-conformance/);
  assert.match(workflow, /startsWith\(github\.ref, 'refs\/tags\/v'\)/);
  assert.match(workflow, /GITHUB_REF_NAME/);
  assert.match(workflow, /npm publish --access public --provenance/);
  assert.match(workflow, /id-token: write/);
});
