'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const VERSION = '2.6.0-rc.6';

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('release candidate identity is consistent across public and executable surfaces', () => {
  const packageJson = JSON.parse(read('package.json'));
  const packageLock = JSON.parse(read('package-lock.json'));
  const manifest = JSON.parse(read('docs/review/QUALIFICATION_MANIFEST.json'));

  assert.equal(packageJson.version, VERSION);
  assert.equal(packageLock.version, VERSION);
  assert.equal(packageLock.packages[''].version, VERSION);
  assert.equal(manifest.releaseCandidate, `v${VERSION}`);
  assert.match(read('accelerator/cli/surgical.js'), /const VERSION = '2\.6\.0-rc\.6';/);
  assert.match(read('README.md'), /Surgical DevOps v2\.6\.0-rc\.6/);
  assert.match(read('README_PT-BR.md'), /Surgical DevOps v2\.6\.0-rc\.6/);
  assert.doesNotMatch(
    read('tests/accelerator/surgical-cli-interactive.test.js'),
    /Surgical DevOps v2\\\.5\\\.1/
  );
});


test('release candidate publishes equivalent English and Portuguese notes', () => {
  const english = read(
    'docs/releases/v2.6.0-rc.6.md'
  );
  const portuguese = read(
    'docs/releases/v2.6.0-rc.6_PT-BR.md'
  );

  assert.match(
    english,
    /\[v2\.6\.0-rc\.6_PT-BR\.md\]\(\.\/v2\.6\.0-rc\.6_PT-BR\.md\)/
  );
  assert.match(
    portuguese,
    /\[v2\.6\.0-rc\.6\.md\]\(\.\/v2\.6\.0-rc\.6\.md\)/
  );

  for (const document of [english, portuguese]) {
    assert.match(document, /56da715284704f227675961d476e19acce6e9fa3/);
    assert.match(document, /33286652480/);
    assert.match(document, /npm ci/);
    assert.match(document, /npm test/);
    assert.match(document, /npm pack --dry-run/);
    assert.match(document, /Ubuntu[\s\S]+macOS[\s\S]+Windows/i);
    assert.match(document, /Manifest CAS/);
  }

  assert.match(english, /not proof of absolute security/i);
  assert.match(portuguese, /não é prova de segurança absoluta/i);
  assert.match(english, /not a completed independent audit/i);
  assert.match(portuguese, /não é uma auditoria independente concluída/i);
});

test('release candidate keeps external-review non-claims explicit', () => {
  const manifest = JSON.parse(read('docs/review/QUALIFICATION_MANIFEST.json'));

  assert.equal(manifest.claims.absoluteSecurity, false);
  assert.equal(manifest.claims.independentAuditCompleted, false);
  assert.equal(manifest.claims.powerLossValidated, false);
  assert.equal(manifest.claims.modelDeterministic, false);
  assert.equal(manifest.claims.externalReviewInvited, true);
});
