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

function sha256(relative) {
  return crypto.createHash('sha256').update(read(relative), 'utf8').digest('hex');
}

test('original BH-SEP and BH-SDP v2.2 RAW artifacts remain immutable', () => {
  assert.equal(
    sha256('protocols/BH-SEP.md'),
    'f4e8639163b0321fff86133a69ec59c2822ccdebcd24d2ccb459b5bc1c3b35cb'
  );
  assert.equal(
    sha256('protocols/BH-SDP.md'),
    '04ea782ada1abf7fb959329054c57f87a0e86fca99a31d2e37751d3bdf7d47bc'
  );

  const attributes = read('.gitattributes');
  assert.match(attributes, /^protocols\/BH-SEP\.md text eol=lf$/m);
  assert.match(attributes, /^protocols\/BH-SDP\.md text eol=lf$/m);
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
    '1206',
    '1201',
    'POWER_LOSS_VALIDATED',
    'protocols/BH-SEP.md',
    'protocols/BH-SDP.md'
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
    'README_EN.md',
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
  assert.ok(packageDefinition.files.includes('README_EN.md'));
  assert.ok(packageDefinition.files.includes('README_PT-BR.md'));
  assert.ok(packageDefinition.files.includes('SECURITY.md'));
  assert.ok(packageDefinition.files.includes('docs/'));
  assert.ok(packageDefinition.files.includes('examples/'));
  assert.equal(fs.existsSync(path.join(ROOT, '[Reconstrução')), false);
});
