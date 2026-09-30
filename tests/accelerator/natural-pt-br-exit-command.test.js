'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { PassThrough } = require('node:stream');
const test = require('node:test');

const {
  createInteractiveSession,
  handleInteractiveCommand
} = require('../../accelerator/cli/surgical');

const {
  createNaturalSessionControl
} = require('../../accelerator/cli/natural-session-control');

function activation(language) {
  return Object.freeze({
    repositoryPath: '/tmp/surgical-dev-ops',
    workspace: 'surgical-dev-ops',
    branch: 'main',
    commit: 'f8e319a',
    worktreeClean: true,
    packageManager: 'npm',
    mode: 'DETERMINISTIC',
    interactionMode: Object.freeze({ mode: 'NATURAL' }),
    language,
    strategy: 'PATCH',
    orchestrator: 'ACTIVE',
    providers: 'none',
    protocols: Object.freeze({ bhSep: '2.3', bhSdp: '2.3' })
  });
}

async function requireClose(rl) {
  let timeout;

  try {
    await Promise.race([
      once(rl, 'close'),
      new Promise((resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('NATURAL pt-BR session did not close for "sair".')),
          500
        );
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

test('NATURAL_PT_BR_EXIT_COMMAND recognizes only the required bilingual aliases', () => {
  for (const command of ['sair', 'exit', 'quit']) {
    assert.deepEqual(
      handleInteractiveCommand(command, activation('pt-BR')),
      {
        action: 'EXIT',
        output: 'Sessão Surgical encerrada.\n'
      }
    );
  }

  for (const command of ['exit', 'quit']) {
    assert.deepEqual(
      handleInteractiveCommand(command, activation('en')),
      {
        action: 'EXIT',
        output: 'Surgical session closed.\n'
      }
    );
  }

  assert.notEqual(
    handleInteractiveCommand('sair', activation('en')).action,
    'EXIT'
  );
});

test('NATURAL pt-BR sair performs ordinary cleanup without authority or mutation', async (t) => {
  const input = new PassThrough();
  const output = new PassThrough();
  const control = createNaturalSessionControl({
    workspace: 'surgical-dev-ops',
    workspaceRoot: '/tmp/surgical-dev-ops',
    language: 'pt-BR'
  });
  let cognitionCalls = 0;
  let dispatchCalls = 0;
  let cleanupCalls = 0;
  let observed = '';

  control.handle('Explique este projeto para mim.');
  assert.equal(control.hasPendingAuthorization(), true);

  output.on('data', (chunk) => {
    observed += chunk.toString();
  });

  const rl = createInteractiveSession(
    activation('pt-BR'),
    {
      input,
      output,
      terminal: false,
      sessionControl: control,
      dispatchEvidence() {
        dispatchCalls += 1;
        throw new Error('Exit must not dispatch governed evidence.');
      },
      cognitiveSession: Object.freeze({
        async ask() {
          cognitionCalls += 1;
          throw new Error('Exit must not invoke cognition.');
        },
        close() {
          cleanupCalls += 1;
        }
      })
    }
  );

  t.after(() => {
    rl.close();
    input.destroy();
    output.destroy();
  });

  const closed = requireClose(rl);
  input.write('sair\n');
  await closed;

  assert.equal(cognitionCalls, 0);
  assert.equal(dispatchCalls, 0);
  assert.equal(cleanupCalls, 1);
  assert.equal(control.hasPendingAuthorization(), false);
  assert.match(observed, /Sessão Surgical encerrada\./);
});
