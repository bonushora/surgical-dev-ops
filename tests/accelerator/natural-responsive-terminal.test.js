'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const path =
  require('node:path');

const childProcess =
  require('node:child_process');

const ROOT =
  path.resolve(__dirname, '../..');

const CLI_FILE =
  path.join(
    ROOT,
    'accelerator',
    'cli',
    'surgical.js'
  );

const {
  formatCognitiveProgressMessage
} = require(CLI_FILE);

const {
  createHermeticGitRepository
} = require('./helpers/hermetic-git-repository');

const FIXTURE = createHermeticGitRepository();
const REPOSITORY = FIXTURE.repository;

test.after(() => FIXTURE.cleanup());

test(
  'NATURAL terminal separates completed responses and prompts with a blank line',
  () => {
    const execution =
      childProcess.spawnSync(
        process.execPath,
        [
          CLI_FILE,
          '--interaction',
          'NATURAL'
        ],
        {
          cwd: REPOSITORY,
          input:
            'qual é a branch atual?\n' +
            'qual é o commit atual?\n' +
            'exit\n',
          encoding: 'utf8',
          timeout: 10000
        }
      );

    assert.equal(
      execution.status,
      0,
      execution.stderr
    );

    assert.match(
      execution.stdout,
      /Nenhuma alteração foi realizada\.\n\nsurgical> O commit atual do projeto é:/
    );

    assert.match(
      execution.stdout,
      /Nenhuma alteração foi realizada\.\n\nsurgical> Sessão Surgical encerrada\./
    );

    assert.doesNotMatch(
      execution.stdout,
      /Nenhuma alteração foi realizada\.\nsurgical>/
    );
  }
);


test(
  'cognitive wait is immediately visible in Portuguese and English',
  () => {
    const portuguese =
      formatCognitiveProgressMessage(
        'explique esta arquitetura'
      );

    const english =
      formatCognitiveProgressMessage(
        'explain this architecture in English'
      );

    assert.match(
      portuguese,
      /Processando com o provider cognitivo local/
    );
    assert.match(
      portuguese,
      /limitada a 60 segundos/i
    );
    assert.match(
      portuguese,
      /governança determinística permanece ativa/i
    );

    assert.match(
      english,
      /Processing with the local cognitive provider/
    );
    assert.match(
      english,
      /limited to 60 seconds/i
    );
    assert.match(
      english,
      /deterministic governance remains active/i
    );
  }
);
