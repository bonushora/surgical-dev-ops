'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const sha = (relative) => crypto.createHash('sha256').update(read(relative), 'utf8').digest('hex');

test('ADR-025 manifest binds the public green baseline and immutable protocol bytes', () => {
  const manifest = JSON.parse(read('docs/review/QUALIFICATION_MANIFEST.json'));
  assert.equal(manifest.schema, 'sdo.external_review_qualification_manifest.v1');
  assert.equal(manifest.sourceBaseline.commit, 'b82a845a3f30d44c8073cdda8a1354a286ce1ae4');
  assert.equal(manifest.sourceBaseline.runId, '33034046356');
  assert.equal(manifest.sourceBaseline.conclusion, 'success');
  assert.deepEqual(manifest.sourceBaseline.platforms, [
    'ubuntu-latest', 'macos-latest', 'windows-latest'
  ]);
  assert.equal(manifest.protocols['BH-SEP-v2.2-sha256'], sha('protocols/BH-SEP.md'));
  assert.equal(manifest.protocols['BH-SDP-v2.2-sha256'], sha('protocols/BH-SDP.md'));
});

test('review package contains exact reproduction adversarial targets and honest non-claims', () => {
  const challenge = read('docs/review/TRY_TO_BREAK_IT.md');
  const adr = read('docs/adr/ADR-025-external-adversarial-review-reproducible-release.md');
  const evidence = read('docs/ENGINEERING_EVIDENCE.md');
  for (const required of [
    'npm ci', 'npm test', 'workspace', 'credential', 'stale evidence',
    'interrupted', 'PT-BR', 'Windows', 'not mathematical proof'
  ]) assert.match(challenge, new RegExp(required.replace(/\s+/g, '\\s+'), 'i'));
  assert.match(adr, /not an independent audit/i);
  assert.match(evidence, /has not yet been\s+completed independently/i);
  assert.doesNotMatch(challenge, /guaranteed secure|unbreakable|100% secure/i);
});

test('deep adversarial release requires attacks beyond adjacent layers', () => {
  const adr = read(
    'docs/adr/ADR-025-external-adversarial-review-reproducible-release.md'
  );
  const challenge = read(
    'docs/review/TRY_TO_BREAK_IT.md'
  );

  assert.match(
    adr,
    /SHALL NOT be limited to adjacent layers/i
  );
  assert.match(
    adr,
    /internal\s+deterministic core directly/i
  );
  assert.match(
    challenge,
    /Black-box and boundary-only testing are insufficient/i
  );

  for (const required of [
    'white-box',
    'fault injection',
    'mutation testing',
    'structured fuzzing',
    'property-based',
    'concurrency',
    'multiprocess',
    'crash/restart',
    'direct artifact tampering',
    'lifecycle',
    'fingerprint',
    'Manifest CAS',
    'journal',
    'durability',
    'recovery',
    'authoritative time',
    'finalized replay',
    'false success',
    'unauthorized mutation',
    'atomicity loss',
    'logical/physical divergence'
  ]) {
    assert.match(
      challenge,
      new RegExp(
        required.replace(/\s+/g, '\\s+'),
        'i'
      )
    );
  }

  assert.match(
    challenge,
    /Linux, macOS and Windows/i
  );
  assert.match(
    challenge,
    /provider-reported `APPLIED` become success without canonical evidence/i
  );
  assert.doesNotMatch(
    challenge,
    /black-box review is sufficient|adjacent layers are sufficient/i
  );
});

test('public adversarial report form requires reproducibility impact and secret hygiene', () => {
  const form = read('.github/ISSUE_TEMPLATE/adversarial-report.yml');
  for (const required of [
    'Baseline commit', 'Platform', 'Runtime', 'Minimal reproduction',
    'Expected deterministic boundary', 'Observed result', 'Impact class',
    'private keys', 'production secrets'
  ]) assert.match(form, new RegExp(required.replace(/\s+/g, '\\s+'), 'i'));
  assert.doesNotMatch(form, /password:|token:|api[_-]?key:/i);
});

test('review manifest reproduction commands are fixed and non-destructive', () => {
  const manifest = JSON.parse(read('docs/review/QUALIFICATION_MANIFEST.json'));
  assert.deepEqual(manifest.reproduction, [
    'npm ci',
    'npm test',
    'node examples/governed-engineering-loop-demo.js',
    'npm pack --dry-run'
  ]);
  assert.deepEqual(manifest.claims, {
    absoluteSecurity: false,
    independentAuditCompleted: false,
    powerLossValidated: false,
    modelDeterministic: false,
    externalReviewInvited: true
  });
});
