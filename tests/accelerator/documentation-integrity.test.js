'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function readBytes(relative) {
  return fs.readFileSync(path.join(ROOT, relative));
}

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

const HISTORICAL_RAW = Object.freeze({
  'protocols/BH-SEP.md':
    'f4e8639163b0321fff86133a69ec59c2822ccdebcd24d2ccb459b5bc1c3b35cb',
  'protocols/BH-SDP.md':
    '04ea782ada1abf7fb959329054c57f87a0e86fca99a31d2e37751d3bdf7d47bc'
});

const ACTIVE_RAW = Object.freeze({
  'protocols/v2.3/BH-SEP.md':
    '0360b145b4f1ba8cb211ffdb16cf5d70d47c7dc55a11395bd2afb9d5241eb4ee',
  'protocols/v2.3/BH-SDP.md':
    '413b3613c75ce89defae4d49ad0b21d92f56519c14f5b32c8e8e152997887f47'
});

const DERIVED_V23 = Object.freeze({
  'protocols/v2.3/BH-SEP_EN.md':
    '64bc602ea0556eb1819daf5ebd6aa07ff36c00f8a3443205f9035a93b02fdc13',
  'protocols/v2.3/BH-SDP_EN.md':
    '49f5ba8a8be6d075f41b299b69ebffa1cf6a3018f1d93bf373c4c2d0ec9ae222',
  'protocols/v2.3/BH-PROTOCOLS.md':
    'd877a7bd876ee37df2378476150827e20a7e2437b8e8ee313f06b7992396f1bb',
  'protocols/v2.3/BH-PROTOCOLS_EN.md':
    'fdfa13cc39eb36a7f07129398d8600887babf6535d0292bc561e960d0792055e'
});

function assertArtifactIntegrity(relative, expected, bytes = readBytes(relative)) {
  assert.equal(digest(bytes), expected, `${relative} changed at byte level`);
}

function assertLfArtifact(relative, attributes) {
  const bytes = readBytes(relative);
  assert.equal(bytes.at(-1), 0x0a, `${relative} must terminate with LF`);
  assert.equal(bytes.includes(0x0d), false, `${relative} must not contain CRLF`);
  assert.ok(
    attributes.split(/\r?\n/).includes(`${relative} text eol=lf`),
    `${relative} must have a stable LF path rule`
  );
}

test('original BH-SEP and BH-SDP v2.2 RAW artifacts remain immutable', () => {
  const attributes = read('.gitattributes');
  for (const [relative, expected] of Object.entries(HISTORICAL_RAW)) {
    assertArtifactIntegrity(relative, expected);
    assertLfArtifact(relative, attributes);
  }
});

test('active v2.3 RAW and derived artifacts match fixed hashes paths LF and composition', () => {
  const attributes = read('.gitattributes');
  for (const [relative, expected] of Object.entries({
    ...ACTIVE_RAW,
    ...DERIVED_V23
  })) {
    assertArtifactIntegrity(relative, expected);
    assertLfArtifact(relative, attributes);
  }

  assert.equal(
    read('protocols/v2.3/BH-PROTOCOLS.md'),
    `${read('protocols/v2.3/BH-SEP.md')}\n---\n\n${read('protocols/v2.3/BH-SDP.md')}`
  );
  assert.equal(
    read('protocols/v2.3/BH-PROTOCOLS_EN.md'),
    `${read('protocols/v2.3/BH-SEP_EN.md')}\n---\n\n${read('protocols/v2.3/BH-SDP_EN.md')}`
  );
});

test('one-byte v2.3 RAW mutation fails the fixed SHA-256 gate', () => {
  const relative = 'protocols/v2.3/BH-SEP.md';
  const changed = Buffer.from(readBytes(relative));
  changed[0] ^= 0x01;
  assert.throws(
    () => assertArtifactIntegrity(relative, ACTIVE_RAW[relative], changed),
    /changed at byte level/
  );
});

test('LF policy parsing tolerates the native checkout spelling of metadata', () => {
  assert.doesNotThrow(() => assertLfArtifact(
    'protocols/BH-SEP.md',
    'protocols/BH-SEP.md text eol=lf\r\n'
  ));
});

test('English and Portuguese entry points agree on protocol and software versions', () => {
  const english = read('README.md');
  const portuguese = read('README_PT-BR.md');
  for (const source of [english, portuguese]) {
    assert.match(source, /BH-SEP v2\.3 \+ BH-SDP v2\.3/);
    assert.match(source, /v2\.2[^\n]*(?:historical|histórica)/i);
    assert.match(source, /v2\.6\.0-rc\.6/);
    for (const relative of [
      ...Object.keys(HISTORICAL_RAW),
      ...Object.keys(ACTIVE_RAW),
      ...Object.keys(DERIVED_V23)
    ]) {
      assert.ok(source.includes(relative), `${relative} must be linked from both READMEs`);
    }
  }
  assert.doesNotMatch(english, /v2\.6\.0-rc\.6[^\n]*(?:BH-SEP|BH-SDP) v2\.6/i);
  assert.doesNotMatch(portuguese, /v2\.6\.0-rc\.6[^\n]*(?:BH-SEP|BH-SDP) v2\.6/i);
});

test('English and Portuguese entry points expose equivalent qualified baseline facts', () => {
  const english = read('README.md');
  const portuguese = read('README_PT-BR.md');
  const facts = [
    'f56750eba3aa07b0426f56021c072a280468ea98',
    '2f8d9e1aa40d0d7a127e966a28e475e0f89c4bb0',
    '9ed86a443da18f923b60692d7446f1fd57d0a2da',
    '56da715284704f227675961d476e19acce6e9fa3',
    '33286652480',
    '1212',
    '1207',
    'POWER_LOSS_VALIDATED',
    'protocols/BH-SEP.md',
    'protocols/BH-SDP.md',
    'protocols/v2.3/BH-SEP.md',
    'protocols/v2.3/BH-SDP.md',
    'protocols/v2.3/BH-PROTOCOLS.md',
    'protocols/v2.3/BH-PROTOCOLS_EN.md'
  ];
  for (const fact of facts) {
    assert.match(english, new RegExp(fact));
    assert.match(portuguese, new RegExp(fact));
  }
  assert.doesNotMatch(english, /508 tests|595 tests|v2\.4\.1 Installation/);
  assert.doesNotMatch(portuguese, /508 testes|595 testes|Instalação da CLI v2\.4\.1/);
  assert.doesNotMatch(english, /1139 tests discovered; 1134 passed/);
  assert.doesNotMatch(portuguese, /1139 testes descobertos; 1134 aprovados/);
});

test('international documentation has no unresolved local Markdown targets', () => {
  const files = [
    'README.md',
    'README_PT-BR.md',
    'docs/AI_PROVIDER_SELECTION.md',
    'docs/AI_PROVIDER_SELECTION_PT-BR.md',
    'docs/ENGINEERING_EVIDENCE.md',
    'docs/EXTERNAL_ENGINEERING_REVIEW.md',
    'docs/review/TRY_TO_BREAK_IT.md',
    'docs/evaluation/NATURAL-MANUAL-ACCEPTANCE-BILINGUAL.md',
    'docs/DOCUMENTATION.md',
    'docs/DOCUMENTATION.md',
    'protocols/README.md',
    'docs/adr/ADR-018-immutable-protocol-raw-and-international-documentation.md'
  ];
  const unresolved = [];
  for (const relative of files) {
    const content = read(relative);
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
      const resolved = path.resolve(ROOT, path.dirname(relative), target);
      if (!fs.existsSync(resolved)) unresolved.push(`${relative}: ${target}`);
    }
  }
  assert.deepEqual(unresolved, []);

  const map = read('docs/DOCUMENTATION.md');
  for (const adr of [
    'ADR-028',
    'ADR-029',
    'ADR-030',
    'ADR-031',
    'ADR-032',
    'ADR-033',
    'ADR-034',
    'ADR-035',
    'ADR-036',
    'ADR-037'
  ]) {
    assert.match(map, new RegExp(adr));
  }
});

test('public AI provider recommendation is bilingual bounded and honest', () => {
  const english = read('docs/AI_PROVIDER_SELECTION.md');
  const portuguese = read('docs/AI_PROVIDER_SELECTION_PT-BR.md');

  for (const source of [english, portuguese]) {
    for (const required of [
      'OpenAI Codex',
      'OpenAI Responses',
      'Qwen 3 8B',
      'Gemma 3 4B',
      'Claude Code',
      'Gemini',
      'G1–G6',
      'G7',
      'G8',
      'Manifest CAS'
    ]) assert.match(source, new RegExp(required));
  }

  assert.match(english, /recommended advanced engineering-agent option/i);
  assert.match(portuguese, /opção recomendada de agente avançado de engenharia/i);
  assert.match(english, /not a claim that Codex is\s+universally superior/i);
  assert.match(portuguese, /não uma alegação de que o\s+Codex é universalmente superior/i);
  assert.match(english, /does not grant it shell, filesystem, Git, mutation or approval/i);
  assert.match(portuguese, /não lhe concede autoridade de shell, filesystem, Git, mutação\s+ou aprovação/i);
  assert.match(english, /Automatic discovery and default activation are permitted only for a qualified\s+local Ollama model/i);
  assert.match(portuguese, /Descoberta e ativação padrão automáticas são permitidas somente para um modelo\s+Ollama local qualificado/i);
  assert.match(english, /No model is downloaded automatically/i);
  assert.match(portuguese, /Nenhum modelo é baixado automaticamente/i);
  assert.match(english, /External providers, including Codex, are explicit opt-in only/i);
  assert.match(portuguese, /Providers externos, inclusive Codex, são somente opt-in explícito/i);
  assert.match(english, /No provider selection grants operational authority/i);
  assert.match(portuguese, /Nenhuma seleção de provider concede autoridade operacional/i);
  assert.match(english, /real Codex\s+remains `BLOCKED` even when explicitly selected/i);
  assert.match(portuguese, /Codex\s+real permanece `BLOCKED` mesmo quando selecionado explicitamente/i);
  assert.match(english, /`@openai\/codex-sdk` is an optional npm dependency/i);
  assert.match(portuguese, /`@openai\/codex-sdk` é uma dependência npm opcional/i);
  assert.match(english, /basic offline installation\s+uses `--omit=optional`/i);
  assert.match(portuguese, /instalação básica\s+offline usa `--omit=optional`/i);
  assert.match(english, /external\s+cognitive service subject to the configured account\/plan/i);
  assert.match(portuguese, /serviço cognitivo externo sujeito à conta\/plano configurado/i);
  assert.match(english, /If the SDK is absent,[\s\S]+fails closed/i);
  assert.match(portuguese, /Se o SDK estiver\s+ausente,[\s\S]+falha fechado/i);
  assert.match(english, /nothing is downloaded\s+automatically/i);
  assert.match(portuguese, /nada é baixado automaticamente/i);
  assert.doesNotMatch(english, /No provider is selected automatically/i);
  assert.doesNotMatch(portuguese, /Nenhum provider é selecionado automaticamente/i);
});

test('manual NATURAL acceptance preserves equivalent English and Portuguese records', () => {
  const record = read(
    'docs/evaluation/NATURAL-MANUAL-ACCEPTANCE-BILINGUAL.md'
  );
  const required = [
    '## English',
    '## Português',
    '**PARTIALLY ACCEPTED**',
    '**PARCIALMENTE ACEITO**',
    '`Explique este projeto para mim.`',
    '`Explain this project in English.`',
    '`sim`',
    '`yes`',
    '`exit`'
  ];

  for (const fact of required) assert.ok(record.includes(fact));
});

test('npm package preserves both public languages and no reconstruction artifact', () => {
  const packageDefinition = JSON.parse(read('package.json'));
  assert.ok(packageDefinition.files.includes('README.md'));
  assert.equal(packageDefinition.files.includes('README_EN.md'), false);
  assert.ok(packageDefinition.files.includes('README_PT-BR.md'));
  assert.ok(packageDefinition.files.includes('SECURITY.md'));
  assert.ok(packageDefinition.files.includes('docs/'));
  assert.ok(packageDefinition.files.includes('examples/'));
  assert.equal(fs.existsSync(path.join(ROOT, '[Reconstrução')), false);
});
