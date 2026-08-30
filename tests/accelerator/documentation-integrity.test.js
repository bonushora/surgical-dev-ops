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
    '514cdf954fc94faeb91c1820abc3bf693fe0f4ab',
    '33284298156',
    '1139',
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
