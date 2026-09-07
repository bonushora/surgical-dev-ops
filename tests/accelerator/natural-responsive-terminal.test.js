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
        'explique esta arquitetura',
        'pt-BR',
        Object.freeze({
          providerKind: 'OLLAMA', cognitionLocation: 'LOCAL_MODEL',
          transportLocation: 'LOCAL_PROCESS', billing: 'LOCAL_RESOURCES_AND_LICENSES_APPLY',
          networkRequirement: 'LOOPBACK_SERVICE_ONLY', state: 'ACTIVE', active: true
        })
      );

    const english =
      formatCognitiveProgressMessage(
        'explain this architecture in English',
        'en',
        Object.freeze({
          providerKind: 'OLLAMA', cognitionLocation: 'LOCAL_MODEL',
          transportLocation: 'LOCAL_PROCESS', billing: 'LOCAL_RESOURCES_AND_LICENSES_APPLY',
          networkRequirement: 'LOOPBACK_SERVICE_ONLY', state: 'ACTIVE', active: true
        })
      );

    assert.match(
      portuguese,
      /Processando com o modelo cognitivo local via Ollama/
    );
    assert.match(
      portuguese,
      /limitada a 180 segundos/i
    );
    assert.match(
      portuguese,
      /governança determinística permanece ativa/i
    );

    assert.match(
      english,
      /Processing with the local Ollama cognitive model/
    );
    assert.match(
      english,
      /limited to 180 seconds/i
    );
    assert.match(
      english,
      /deterministic governance remains active/i
    );
  }
);

test('Codex progress states external cognition and current network block equivalently', () => {
  const discovery = Object.freeze({
    providerKind: 'CODEX', cognitionLocation: 'EXTERNAL_SERVICE',
    transportLocation: 'LOCAL_PROCESS', billing: 'UNKNOWN_OR_ACCOUNT_PLAN',
    networkRequirement: 'EXTERNAL_SERVICE_REQUIRED', state: 'BLOCKED', active: false
  });
  const portuguese = formatCognitiveProgressMessage('explique', 'pt-BR', discovery);
  const english = formatCognitiveProgressMessage('explain', 'en', discovery);
  for (const output of [portuguese, english]) {
    assert.match(output, /extern|external/i);
    assert.match(output, /subprocess/i);
    assert.match(output, /rede|network/i);
    assert.doesNotMatch(output, /Ollama|4096|10 minutos|10 minutes|sem cobrança|no charge/i);
  }
  assert.match(portuguese, /nenhuma solicitação Codex foi enviada/i);
  assert.match(english, /no Codex request was sent/i);
});
