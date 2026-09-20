'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('review manifest separates historical baseline policy runtime binding and review status', () => {
  const manifest = JSON.parse(read('docs/review/QUALIFICATION_MANIFEST.json'));
  assert.equal(manifest.schema, 'sdo.external_review_qualification_manifest.v2');
  assert.equal(manifest.historicalBaseline.classification, 'HISTORICAL_BASELINE');
  assert.equal(manifest.historicalBaseline.commit, '24f0f1946eb795b3464b2846953e191755b9c8c3');
  assert.equal(manifest.historicalBaseline.exactRefRun.runId, '34860826996');
  assert.equal(manifest.historicalBaseline.mainPushRun.runId, '34862373028');
  assert.equal(manifest.currentReviewPolicy.bindingMode, 'RUNTIME_EXACT_SHA_EVIDENCE');
  assert.equal(manifest.runtimeQualificationBinding.candidateShaStoredInGit, false);
  assert.equal(manifest.runtimeQualificationBinding.evidenceSchema, 'sdo.qualification_evidence.v1');
  assert.equal(manifest.externalReviewStatus.completed, false);
  assert.equal(manifest.externalReviewStatus.releaseAuthorized, false);
  assert.equal(manifest.claims.absoluteSecurity, false);
  assert.equal(manifest.claims.powerLossValidated, false);
  assert.equal(manifest.claims.pathnamePhysicalIdentityCasQualified, false);
});

test('current review surfaces define non-self-referential exact-SHA evidence truthfully', () => {
  const surfaces = [
    read('docs/EXTERNAL_ENGINEERING_REVIEW.md'),
    read('docs/ENGINEERING_EVIDENCE.md'),
    read('docs/review/TRY_TO_BREAK_IT.md'),
    read('docs/review/TRY_TO_BREAK_IT_PT-BR.md'),
    read('docs/review/ADVERSARIAL_PLAYBOOK.md'),
    read('docs/review/ADVERSARIAL_PLAYBOOK_PT-BR.md')
  ];
  for (const source of surfaces) {
    assert.match(source, /RUNTIME_EXACT_SHA_EVIDENCE/);
    assert.match(source, /external\s+review[\s\S]{0,80}(?:not completed|has not occurred)|revisão\s+externa[\s\S]{0,80}(?:não foi concluída|não ocorreu)/i);
  }
  const current = surfaces.join('\n');
  assert.match(current, /GITHUB_SHA/);
  assert.match(current, /machine-readable|legível por máquina/i);
  assert.doesNotMatch(current, /candidate is immutable and frozen for review/i);
  assert.doesNotMatch(current, /candidato[^\n]+congelado para revisão/i);
});

test('review package preserves explicit qualification non-claims', () => {
  const review = `${read('docs/EXTERNAL_ENGINEERING_REVIEW.md')}\n${read('docs/ENGINEERING_EVIDENCE.md')}`;
  for (const required of [
    /not (?:proof of )?absolute security/i,
    /physical power-loss[\s\S]{0,100}not claimed/i,
    /pathname[\s\S]{0,100}(?:unqualified|not qualified)/i,
    /not identical[\s\S]{0,100}(?:isolation|sandbox)|different native mechanisms/i,
    /release[\s\S]{0,100}not authorized/i
  ]) assert.match(review, required);
});

test('review evidence index connects claims through limitations and CI evidence', () => {
  const review = read('docs/EXTERNAL_ENGINEERING_REVIEW.md');
  for (const heading of [
    'Claim', 'Normative source', 'Implementation', 'Test', 'CI evidence', 'Limitation / non-claim'
  ]) assert.match(review, new RegExp(heading, 'i'));
  for (const claim of [
    'human sovereignty', 'intelligence', 'mediated mutation', 'fail-closed',
    'Manifest CAS', 'journal', 'workspace confinement', 'provider containment',
    'no silent fallback', 'exact-ref', 'non-transitive'
  ]) assert.match(review, new RegExp(claim, 'i'));
});

test('README mirrors point at the current historical baseline without stale totals', () => {
  const english = read('README.md');
  const portuguese = read('README_PT-BR.md');
  for (const source of [english, portuguese]) {
    assert.match(source, /24f0f1946eb795b3464b2846953e191755b9c8c3/);
    assert.match(source, /34860826996/);
    assert.match(source, /RUNTIME_EXACT_SHA_EVIDENCE/);
    assert.doesNotMatch(source, /1212[^\n]+1207/);
  }
});
