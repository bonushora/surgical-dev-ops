'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const {
  createNaturalSessionControl
} = require('../../accelerator/cli/natural-session-control');
const {
  formatNaturalGatewayResult
} = require('../../accelerator/cli/natural-presentation');
const {
  createHermeticGitRepository
} = require('./helpers/hermetic-git-repository');

const CLI = require.resolve('../../accelerator/cli/surgical');

function control(language = 'pt-BR') {
  return createNaturalSessionControl({
    workspace: 'surgical-dev-ops',
    language
  });
}

function runNatural(repository, input, language = 'pt-BR') {
  const stateRoot = path.dirname(repository);
  return spawnSync(
    process.execPath,
    [CLI, '--interaction', 'NATURAL', '--language', language],
    {
      cwd: repository,
      env: {
        ...process.env,
        XDG_CONFIG_HOME: stateRoot,
        LOCALAPPDATA: stateRoot,
        APPDATA: stateRoot
      },
      input,
      encoding: 'utf8',
      timeout: 15_000,
      maxBuffer: 4 * 1024 * 1024
    }
  );
}

test('professional PT-BR and English formulations resolve to bounded read-only gateway intents', () => {
  for (const phrase of [
    'qual é o estado deste projeto?',
    'mostre o estado do projeto',
    'show project status'
  ]) {
    const result = control(phrase.startsWith('show') ? 'en' : 'pt-BR').handle(phrase);
    assert.equal(result.action, 'GATEWAY_REQUEST', phrase);
    assert.equal(result.intent.operation, 'workspace.status', phrase);
    assert.equal(result.intent.readOnly, true, phrase);
    assert.equal(result.intent.authorityExpansion, false, phrase);
  }

  for (const phrase of [
    'quais arquivos mudaram?',
    'what changed?'
  ]) {
    const result = control(phrase.startsWith('what') ? 'en' : 'pt-BR').handle(phrase);
    assert.equal(result.action, 'GATEWAY_REQUEST', phrase);
    assert.equal(result.intent.operation, 'workspace.diff', phrase);
  }

  for (const phrase of [
    'mostre a evidência',
    'show me the evidence'
  ]) {
    const result = control(phrase.startsWith('show') ? 'en' : 'pt-BR').handle(phrase);
    assert.equal(result.action, 'GATEWAY_REQUEST', phrase);
    assert.equal(result.intent.operation, 'evidence.inspect', phrase);
    assert.equal(result.intent.requiresMissionContext, true, phrase);
  }

  const mutation = control().handle('corrija isso');
  assert.notEqual(mutation.action, 'GATEWAY_REQUEST');
});

test('structured gateway failures remain distinguishable and cannot render as success', () => {
  for (const classification of [
    'DENIED',
    'AUTHORITY_REQUIRED',
    'UNSUPPORTED',
    'STALE_STATE',
    'CAS_MISMATCH',
    'ENVIRONMENT_ERROR',
    'INCOMPLETE_EVIDENCE'
  ]) {
    const output = formatNaturalGatewayResult(Object.freeze({
      schema: 'sdo.integrated_governed_agent_gateway_dispatch.v1',
      result: Object.freeze({
        schema: 'sdo.integrated_governed_agent_gateway_result.v1',
        operation: 'workspace.status',
        classification,
        reason: `Physical ${classification} evidence.`,
        data: null,
        approvalRequest: null,
        evidenceDigest: 'a'.repeat(64),
        operationalAuthority: false,
        mutationAuthority: false
      })
    }), 'en');

    assert.match(output, new RegExp(`Result: ${classification}`));
    assert.match(output, new RegExp(`Physical ${classification} evidence\\.`));
    assert.doesNotMatch(output, /Result: SUCCESS/);
    assert.match(output, /AI operational authority: none/);
  }

  const malformed = formatNaturalGatewayResult(Object.freeze({
    schema: 'sdo.integrated_governed_agent_gateway_dispatch.v1',
    result: Object.freeze({
      schema: 'sdo.integrated_governed_agent_gateway_result.v1',
      classification: 'IMAGINED_SUCCESS',
      reason: 'This classification is not governed.'
    })
  }), 'en');

  assert.match(malformed, /Result: DENIED/);
  assert.doesNotMatch(malformed, /IMAGINED_SUCCESS/);
});

test('real NATURAL process reaches mission-owned gateway and returns governed evidence', () => {
  const fixture = createHermeticGitRepository();
  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: fixture.repository,
      encoding: 'utf8'
    }).trim();
    const outcome = runNatural(
      fixture.repository,
      [
        'qual é o estado deste projeto?',
        'mostre a evidência',
        '/status',
        '/authority',
        'exit',
        ''
      ].join('\n')
    );

    assert.equal(outcome.status, 0, outcome.stderr);
    assert.match(outcome.stdout, /Operação governada iniciada: workspace\.status/);
    assert.match(outcome.stdout, /Operação governada concluída: SUCCESS/);
    assert.match(outcome.stdout, /Resultado: SUCCESS/);
    assert.match(outcome.stdout, new RegExp(head));
    assert.match(outcome.stdout, /Estado físico: limpo/);
    assert.match(outcome.stdout, /Evidência SHA-256: [a-f0-9]{64}/);
    assert.match(outcome.stdout, /Operação governada iniciada: evidence\.inspect/);
    assert.match(outcome.stdout, /Objective: qual é o estado deste projeto\?/);
    assert.match(outcome.stdout, /Allowed: .*workspace\.status/);
    assert.match(outcome.stdout, /Denied: .*mutation\.applyConditional/);
    assert.doesNotMatch(outcome.stdout, /Processando com o provider cognitivo local/);
  } finally {
    fixture.cleanup();
  }
});

test('production CLI physically imports the Integrated Governed Agent Gateway', () => {
  const source = fs.readFileSync(CLI, 'utf8');
  assert.match(
    source,
    /require\([\s\S]{0,80}\.\.\/core\/integrated-governed-agent-gateway[\s\S]{0,80}\)/
  );
  assert.match(source, /streamGatewayRequest/);
  assert.match(source, /createGatewayRequest/);
});
