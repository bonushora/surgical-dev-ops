'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('rc3 incremental adversarial challenge is bilingual and preserves rc2', () => {
  const english = read('docs/review/TRY_TO_BREAK_G1_G10.md');
  const portuguese = read('docs/review/TRY_TO_BREAK_G1_G10_PT-BR.md');

  assert.match(english, /TRY_TO_BREAK_G1_G10_PT-BR\.md/);
  assert.match(portuguese, /TRY_TO_BREAK_G1_G10\.md/);

  for (const document of [english, portuguese]) {
    assert.match(document, /v2\.6\.0-rc\.2/);
    assert.match(document, /G1-G10/);
    assert.match(document, /fingerprint/i);
    assert.match(document, /BEFORE/);
    assert.match(document, /replay/i);
    assert.match(document, /concorr|concurrent/i);
    assert.match(document, /workspace/i);
    assert.match(document, /Manifest CAS/);
    assert.match(document, /provider/i);
    assert.match(document, /Unicode/i);
    assert.match(document, /npm test/);
    assert.match(document, /npm pack --dry-run/);
  }
});

test('rc3 public manifest binds incremental campaign without stronger claims', () => {
  const manifest = JSON.parse(
    read('docs/review/QUALIFICATION_MANIFEST.json')
  );

  assert.equal(manifest.releaseCandidate, 'v2.6.0-rc.4');
  assert.equal(
    manifest.releaseCandidateBaseline.commit,
    'ded6eaf'
  );
  assert.equal(
    manifest.incrementalAdversarialCampaign.preservesRc2Baseline,
    true
  );
  assert.equal(manifest.claims.absoluteSecurity, false);
  assert.equal(manifest.claims.independentAuditCompleted, false);
});

test('rc3 release notes expose equivalent bounded G1-G10 claims', () => {
  const english = read('docs/releases/v2.6.0-rc.3.md');
  const portuguese = read('docs/releases/v2.6.0-rc.3_PT-BR.md');

  for (const document of [english, portuguese]) {
    assert.match(document, /3a938dc42ae449a8280f48cdddff39e7a74c04d8/);
    assert.match(document, /33269040867/);
    assert.match(document, /G1-G10/);
    assert.match(document, /replay/i);
    assert.match(document, /JavaScript/i);
  }

  assert.match(english, /not proof of absolute security/i);
  assert.match(portuguese, /não é prova de segurança absoluta/i);
});
