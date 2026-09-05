'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  createNaturalSessionControl
} = require('../../accelerator/cli/natural-session-control');
const {
  detectNaturalGovernedTask
} = require('../../accelerator/cli/natural-governed-task');
const {
  createHermeticGitRepository
} = require('./helpers/hermetic-git-repository');

const CLI = require.resolve('../../accelerator/cli/surgical');

test('objective-first PT-BR and English requests compose existing repair and continuation semantics', () => {
  for (const [language, phrase] of [
    ['pt-BR', 'resolva este problema'],
    ['en', 'solve this problem']
  ]) {
    const result = createNaturalSessionControl({ language }).handle(phrase);
    assert.equal(result.action, 'REFERENCE_REQUEST', phrase);
    assert.equal(result.intent.referenceType, 'DEICTIC', phrase);
    assert.equal(result.intent.referenceAction, 'REQUEST_MUTATION', phrase);
    assert.equal(result.intent.operationalAuthority, false, phrase);
    assert.equal(result.intent.mutationAuthority, false, phrase);
  }

  for (const [language, phrase] of [
    ['pt-BR', 'corrija e teste'],
    ['en', 'fix it and test it']
  ]) {
    const result = createNaturalSessionControl({ language }).handle(phrase);
    assert.equal(result.action, 'REFERENCE_REQUEST', phrase);
    assert.equal(result.intent.referenceAction, 'REQUEST_MUTATION', phrase);
    assert.equal(result.intent.operationalAuthority, false, phrase);
    assert.equal(result.intent.mutationAuthority, false, phrase);
  }

  for (const [language, phrase] of [
    ['pt-BR', 'continue até ficar verde'],
    ['en', 'keep going until green'],
    ['pt-BR', 'faça o necessário para concluir'],
    ['en', 'do what is necessary to complete it']
  ]) {
    const result = createNaturalSessionControl({ language }).handle(phrase);
    assert.equal(result.action, 'MISSION_CONTINUE', phrase);
    assert.equal(result.operationalAuthority, false, phrase);
    assert.equal(result.mutationAuthority, false, phrase);
    assert.equal(result.authorityExpansion, false, phrase);
  }
});

test('help-prefixed broad completion text remains observational help', () => {
  for (const [language, phrase] of [
    ['pt-BR', 'ajuda faça o necessário para concluir'],
    ['en', 'help do whatever is necessary to complete it']
  ]) {
    const result = createNaturalSessionControl({ language }).handle(phrase);
    assert.equal(result.action, 'HELP_REQUEST', phrase);
    assert.equal(result.operationalAuthority, false, phrase);
    assert.equal(result.mutationAuthority, false, phrase);
    assert.equal(result.approvalAuthority, false, phrase);
  }
});

test('ADR-038 mission-bound references projections and resume remain semantic and observational', () => {
  for (const [language, phrase] of [
    ['pt-BR', 'faça o que você recomendou'],
    ['en', 'do what you recommended']
  ]) {
    const result = createNaturalSessionControl({ language }).handle(phrase);
    assert.equal(result.action, 'REFERENCE_REQUEST', phrase);
    assert.equal(result.intent.referenceType, 'LAST_RECOMMENDATION', phrase);
    assert.equal(result.intent.referenceAction, 'PROJECT_REFERENCE', phrase);
    assert.equal(result.intent.operationalAuthority, false, phrase);
  }

  for (const [phrases, projection] of [
    [['quais arquivos você modificou?', 'which files did you modify?'], 'changes'],
    [['qual é o estado dos testes?', 'what is the state of the tests?'], 'tests'],
    [['que autoridade você tem agora?', 'what authority do you have now?'], 'authority'],
    [['você pode continuar sem mim?', 'can you continue without me?'], 'authority']
  ]) {
    for (const [index, phrase] of phrases.entries()) {
      const result = createNaturalSessionControl({
        language: index === 0 ? 'pt-BR' : 'en'
      }).handle(phrase);
      assert.equal(result.action, 'MISSION_PROJECTION', phrase);
      assert.equal(result.projection, projection, phrase);
      assert.equal(result.authorityExpansion, false, phrase);
    }
  }

  for (const [language, phrase] of [
    ['pt-BR', 'retome a missão anterior'],
    ['en', 'resume the previous mission']
  ]) {
    const result = createNaturalSessionControl({ language }).handle(phrase);
    assert.equal(result.action, 'MISSION_RESUME', phrase);
    assert.equal(result.operationalAuthority, false, phrase);
    assert.equal(result.mutationAuthority, false, phrase);
    assert.equal(result.authorityExpansion, false, phrase);
  }

  const negated = createNaturalSessionControl({ language: 'en' })
    .handle("don't keep going until green");
  assert.notEqual(negated.action, 'MISSION_CONTINUE');
});

test('investigate-first negation becomes a bounded read-only governed task instead of direct cognition', () => {
  for (const [language, phrase] of [
    ['pt-BR', 'não altere nada; investigue primeiro'],
    ['en', 'do not change anything; investigate first']
  ]) {
    const task = detectNaturalGovernedTask(phrase);
    assert.equal(task.kind, 'PROJECT_ANALYSIS', phrase);
    assert.equal(task.mutating, false, phrase);
    assert.deepEqual(task.operations, [], phrase);

    const control = createNaturalSessionControl({ language });
    const proposal = control.handle(phrase);
    assert.equal(proposal.action, 'CONTINUE', phrase);
    assert.match(proposal.output, /no (?:writes|file will be changed)|nenhum arquivo será alterado/i);
    const authorized = control.handle(language === 'en' ? 'yes' : 'sim');
    assert.equal(authorized.action, 'AUTHORIZED_GOVERNED_TASK', phrase);
    assert.equal(authorized.task.mutating, false, phrase);
  }
});

test('real NATURAL process fails broad unresolved work closed and projects the same truth through HelpMe', (t) => {
  const fixture = createHermeticGitRepository();
  t.after(fixture.cleanup);
  const stateRoot = path.dirname(fixture.repository);
  const before = execFileSync('git', ['status', '--porcelain=v1'], {
    cwd: fixture.repository,
    encoding: 'utf8'
  });

  const result = spawnSync(
    process.execPath,
    [CLI, '--interaction', 'NATURAL', '--language', 'pt-BR'],
    {
      cwd: fixture.repository,
      env: {
        ...process.env,
        SDO_NATURAL_MISSION_STATE_ROOT: stateRoot,
        XDG_CONFIG_HOME: stateRoot,
        LOCALAPPDATA: stateRoot,
        APPDATA: stateRoot
      },
      input: [
        'resolva este problema',
        'ajuda',
        'faça o necessário para concluir',
        'ajuda faça o necessário para concluir',
        'exit',
        ''
      ].join('\n'),
      encoding: 'utf8',
      timeout: 15_000,
      maxBuffer: 4 * 1024 * 1024
    }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Referência: NO_REFERENT/);
  assert.match(result.stdout, /Missão governada bloqueada/);
  assert.match(result.stdout, /Continuation: NO_NEXT_STEP/);
  assert.equal((result.stdout.match(/HelpMe governado/g) || []).length, 2);
  assert.doesNotMatch(
    result.stdout,
    /Operação governada concluída: SUCCESS|Autoridade governada concedida:/
  );
  assert.equal(
    execFileSync('git', ['status', '--porcelain=v1'], {
      cwd: fixture.repository,
      encoding: 'utf8'
    }),
    before
  );
});
