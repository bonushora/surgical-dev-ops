'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const {
  createInteractionPreferenceStore
} = require('../../accelerator/cli/interaction-preference-store');

const {
  createInteractiveActivation,
  formatInteractiveActivation,
  handleInteractiveCommand
} = require('../../accelerator/cli/surgical');

const {
  createNaturalSessionControl,
  naturalHelpMessage,
  providerSetupOverview,
  codexSetupGuide
} = require('../../accelerator/cli/natural-session-control');

const {
  formatNaturalPresentation
} = require('../../accelerator/cli/natural-presentation');

const {
  formatWorkspaceFiles,
  formatFileReadEvidence
} = require('../../accelerator/cli/natural-governed-task');

const {
  formatNaturalTerminalBoundary
} = require('../../accelerator/cli/natural-terminal-boundary');

const {
  naturalUnknownMessage
} = require('../../accelerator/cli/natural-intent');

const ROOT = path.resolve(__dirname, '../..');
const CLI = path.join(ROOT, 'accelerator', 'cli', 'surgical.js');

const {
  createHermeticGitRepository
} = require('./helpers/hermetic-git-repository');

const FIXTURE = createHermeticGitRepository();
const REPOSITORY = FIXTURE.repository;

test.after(() => FIXTURE.cleanup());

function temporaryDirectory() {
  return fs.realpathSync(fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdo-complete-bilingual-')
  ));
}

function environment(configurationBase) {
  return {
    ...process.env,
    XDG_CONFIG_HOME: configurationBase,
    LOCALAPPDATA: configurationBase,
    APPDATA: configurationBase
  };
}

test('persisted human language controls the complete relaunched experience', () => {
  for (const scenario of [
    {
      language: 'EN',
      greeting: /Hello\. I am connected/,
      helpInput: 'help\nexit\n',
      help: /You can talk to me normally/,
      closed: /Surgical session closed/
    },
    {
      language: 'PT-BR',
      greeting: /Olá\. Estou conectado/,
      helpInput: 'ajuda\nexit\n',
      help: /Você pode conversar comigo normalmente/,
      closed: /Sessão Surgical encerrada/
    }
  ]) {
    const configurationBase = temporaryDirectory();
    const directory = path.join(configurationBase, 'surgical-dev-ops');
    fs.mkdirSync(directory);

    createInteractionPreferenceStore({
      configurationDirectory: directory
    }).save({
      language: scenario.language,
      interactionMode: 'NATURAL'
    });

    const result = spawnSync(
      process.execPath,
      [CLI],
      {
        cwd: REPOSITORY,
        env: environment(configurationBase),
        input: scenario.helpInput,
        encoding: 'utf8'
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, scenario.greeting);
    assert.match(result.stdout, scenario.help);
    assert.match(result.stdout, scenario.closed);
  }
});

test('explicit language selects equivalent EXPERT human surfaces', () => {
  const portuguese = createInteractiveActivation(REPOSITORY, 'EXPERT', 'pt-BR');
  const english = createInteractiveActivation(REPOSITORY, 'EXPERT', 'en');

  assert.match(formatInteractiveActivation(portuguese), /ATIVADOS/);
  assert.match(formatInteractiveActivation(english), /ACTIVATED/);
  assert.match(handleInteractiveCommand('help', portuguese).output, /Comandos disponíveis/);
  assert.match(handleInteractiveCommand('help', english).output, /Available commands/);
  assert.match(handleInteractiveCommand('unknown', portuguese).output, /Comando desconhecido/);
  assert.match(handleInteractiveCommand('unknown', english).output, /Unknown command/);

  const launched = spawnSync(
    process.execPath,
    [CLI, '--interaction', 'NATURAL', '--language', 'en'],
    {
      cwd: REPOSITORY,
      env: environment(temporaryDirectory()),
      input: 'exit\n',
      encoding: 'utf8'
    }
  );
  assert.equal(launched.status, 0, launched.stderr);
  assert.match(launched.stdout, /Hello\. I am connected/);
  assert.match(launched.stdout, /Surgical session closed/);
});

test('NATURAL control guidance preserves PT-BR and English semantic parity', () => {
  const portuguese = createNaturalSessionControl({
    workspace: 'project',
    language: 'pt-BR'
  });
  const english = createNaturalSessionControl({
    workspace: 'project',
    language: 'en'
  });

  assert.match(naturalHelpMessage('pt-BR'), /nova autorização/);
  assert.match(naturalHelpMessage('en'), /new authorization/);
  assert.match(providerSetupOverview('pt-BR'), /Nenhuma alteração/);
  assert.match(providerSetupOverview('en'), /No change/);
  assert.match(codexSetupGuide('pt-BR'), /FRONTEIRA ATUAL/);
  assert.match(codexSetupGuide('en'), /CURRENT BOUNDARY/);

  assert.match(
    portuguese.handle('quais arquivos existem neste projeto').output,
    /Projeto autorizado/
  );
  assert.match(
    english.handle('show the project structure').output,
    /Authorized project/
  );
  assert.match(portuguese.handle('não').output, /cancelada/);
  assert.match(english.handle('no').output, /cancelled/);
});

test('governed evidence presentation is bilingual without changing evidence', () => {
  const governed =
    'Governed Git read: COMPLETED\n' +
    'Selector: CURRENT_BRANCH\n' +
    'feature/example\n';

  assert.match(
    formatNaturalPresentation('CURRENT_BRANCH', governed, 'pt-BR'),
    /Você está trabalhando/
  );
  assert.match(
    formatNaturalPresentation('CURRENT_BRANCH', governed, 'en'),
    /You are working/
  );

  const workspaceResult = {
    execution: {
      schema: 'sdo.git_read_result.v1',
      selector: 'WORKSPACE_FILES',
      result: { files: ['README.md', 'accelerator/cli/surgical.js'] }
    }
  };
  assert.match(formatWorkspaceFiles(workspaceResult, 'pt-BR'), /Encontrei 2/);
  assert.match(formatWorkspaceFiles(workspaceResult, 'en'), /I found 2/);

  const evidence = {
    target: 'README.md',
    bytes: 4,
    sha256: 'a'.repeat(64),
    content: 'test\n'
  };
  assert.match(formatFileReadEvidence(evidence, 'pt-BR'), /^Arquivo:/);
  assert.match(formatFileReadEvidence(evidence, 'en'), /^File:/);
});

test('terminal safety and unknown-request boundaries follow the selected language', () => {
  const boundary = { boundary: 'SYSTEM_TERMINAL', command: 'cat' };

  assert.match(
    formatNaturalTerminalBoundary(boundary, 'pt-BR'),
    /comando do terminal do sistema/
  );
  assert.match(
    formatNaturalTerminalBoundary(boundary, 'en'),
    /system terminal command/
  );
  assert.match(naturalUnknownMessage('pt-BR'), /Ainda não consigo/);
  assert.match(naturalUnknownMessage('en'), /I cannot safely execute/);
});

test('bilingual presentation layer exposes no authority or generic execution', () => {
  for (const relative of [
    'accelerator/cli/human-language.js',
    'accelerator/cli/natural-presentation.js'
  ]) {
    const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    assert.doesNotMatch(
      source,
      /child_process|execSync|spawnSync|orchestrate|dispatchGovernedPatch/
    );
  }
});

test('ADR-031 freezes equivalent complete bilingual product boundaries', () => {
  const english = fs.readFileSync(
    path.join(ROOT, 'docs/adr/ADR-031-complete-bilingual-human-experience.md'),
    'utf8'
  );
  const portuguese = fs.readFileSync(
    path.join(ROOT, 'docs/adr/ADR-031-complete-bilingual-human-experience_PT-BR.md'),
    'utf8'
  );

  for (const source of [english, portuguese]) {
    assert.match(source, /PT-BR/);
    assert.match(source, /EN/);
    assert.match(source, /NATURAL/);
    assert.match(source, /ENGINEER/);
    assert.match(source, /EXPERT/);
    assert.match(source, /anti-replay/);
    assert.match(source, /Linux/);
    assert.match(source, /macOS/);
    assert.match(source, /Windows/);
  }

  assert.match(english, /ADR-031-complete-bilingual-human-experience_PT-BR\.md/);
  assert.match(portuguese, /ADR-031-complete-bilingual-human-experience\.md/);
});
