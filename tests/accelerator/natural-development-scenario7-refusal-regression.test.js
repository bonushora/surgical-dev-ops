'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PassThrough } = require('node:stream');
const test = require('node:test');

const {
  createInteractiveActivation,
  createInteractiveSession
} = require('../../accelerator/cli/surgical');

const BEFORE = "// Manual acceptance fixture\nconst version = 'before';\n";
const ENGLISH_REFUSAL =
  'The requested target is outside the authorized project workspace. No change was made.';
const PORTUGUESE_REFUSAL =
  'O alvo solicitado está fora do espaço de trabalho autorizado do projeto. Nenhuma alteração foi realizada.';
const GENERIC_REFUSAL =
  'An exact proposal could not be prepared from qualified evidence. No change was made.';

function git(repository, args) {
  return childProcess.execFileSync('git', args, {
    cwd: repository,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-scenario7-refusal-'));
  const repository = path.join(root, 'repository');
  const journalStorageRoot = path.join(root, 'journal');
  const authorityRoot = path.join(root, 'authority');
  fs.mkdirSync(repository);
  fs.mkdirSync(journalStorageRoot);
  fs.writeFileSync(path.join(repository, 'demo.js'), BEFORE);
  git(repository, ['init', '-q']);
  git(repository, ['config', 'user.email', 'scenario7@example.invalid']);
  git(repository, ['config', 'user.name', 'Scenario 7 Regression']);
  git(repository, ['add', 'demo.js']);
  git(repository, ['commit', '-qm', 'scenario 7 fixture']);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {
    root,
    repository: fs.realpathSync(repository),
    journalStorageRoot: fs.realpathSync(journalStorageRoot),
    authorityRoot
  };
}

function startSession(state, language = 'en') {
  const input = new PassThrough();
  const output = new PassThrough();
  const calls = { evidence: 0, cognition: 0 };
  let observed = '';
  let failure = null;
  output.on('data', (chunk) => { observed += chunk.toString(); });

  createInteractiveSession(
    createInteractiveActivation(state.repository, 'NATURAL', language),
    {
      input,
      output,
      terminal: false,
      cognitiveSession: Object.freeze({
        async decideEvidence() {
          calls.cognition += 1;
          throw new Error('Cognition must not run for Scenario 7.');
        },
        async proposePatch() {
          calls.cognition += 1;
          throw new Error('Cognition must not run for Scenario 7.');
        }
      }),
      dispatchEvidence() {
        calls.evidence += 1;
        throw new Error('Evidence dispatch must not run for Scenario 7.');
      },
      patchOptions: {
        authorityRoot: state.authorityRoot,
        journalStorageRoot: state.journalStorageRoot,
        tenantId: 'local-acceptance',
        projectId: 'scenario-7-regression'
      },
      onDevelopmentFailure(value) { failure = value; }
    }
  );

  return {
    input,
    calls,
    observed: () => observed,
    failure: () => failure
  };
}

async function waitForFailure(session) {
  const deadline = Date.now() + 10_000;
  while (session.failure() === null) {
    if (Date.now() >= deadline) {
      assert.fail(`Timed out waiting for bounded refusal.\n${session.observed()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  await new Promise((resolve) => setTimeout(resolve, 20));
}

test('Scenario 7 presents one actionable traversal refusal with zero authority or mutation', async (t) => {
  const state = fixture(t);
  const session = startSession(state, 'en');
  const refsBefore = git(state.repository, [
    'for-each-ref',
    '--format=%(refname)%00%(objectname)',
    'refs/surgical-devops'
  ]);

  session.input.write('Change ../outside.js to version denied\n');
  await waitForFailure(session);
  session.input.write('exit\n');
  session.input.end();

  assert.equal(session.failure().code, 'TARGET_SCOPE_REJECTED');
  assert.match(session.observed(), new RegExp(ENGLISH_REFUSAL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(session.observed(), /Development target is non-canonical|traverses scope/);
  assert.doesNotMatch(session.observed(), /Proposal: [a-f0-9]{64}/);
  assert.deepEqual(session.calls, { evidence: 0, cognition: 0 });
  assert.equal(fs.existsSync(state.authorityRoot), false);
  assert.deepEqual(fs.readdirSync(state.journalStorageRoot), []);
  assert.equal(git(state.repository, [
    'for-each-ref',
    '--format=%(refname)%00%(objectname)',
    'refs/surgical-devops'
  ]), refsBefore);
  assert.equal(fs.readFileSync(path.join(state.repository, 'demo.js'), 'utf8'), BEFORE);
  assert.equal(fs.existsSync(path.join(state.root, 'outside.js')), false);
  assert.equal(git(state.repository, ['status', '--porcelain']), '');
});

test('Scenario 7 refusal is bilingual and unknown preparation failures remain generic', async (t) => {
  const portugueseState = fixture(t);
  const portuguese = startSession(portugueseState, 'pt-BR');
  portuguese.input.write('Altere ../outside.js para a versão denied\n');
  await waitForFailure(portuguese);
  portuguese.input.write('sair\n');
  portuguese.input.end();
  assert.equal(portuguese.failure().code, 'TARGET_SCOPE_REJECTED');
  assert.match(portuguese.observed(), new RegExp(PORTUGUESE_REFUSAL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.deepEqual(portuguese.calls, { evidence: 0, cognition: 0 });

  const unknownState = fixture(t);
  fs.writeFileSync(path.join(unknownState.repository, 'dirty.txt'), 'dirty\n');
  const unknown = startSession(unknownState, 'en');
  unknown.input.write('Change demo.js to version denied\n');
  await waitForFailure(unknown);
  unknown.input.write('exit\n');
  unknown.input.end();
  assert.equal(unknown.failure().code, 'DEVELOPMENT_PREPARATION_FAILED');
  assert.match(unknown.observed(), new RegExp(GENERIC_REFUSAL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(unknown.observed(), new RegExp(ENGLISH_REFUSAL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.deepEqual(unknown.calls, { evidence: 0, cognition: 0 });
});
