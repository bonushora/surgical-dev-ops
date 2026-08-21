'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  createPathIdentityAuthority,
  canonicalizeAuthorizedRoot
} = require('../../accelerator/core/workspace-boundary');

function fixture(t) {
  const lexical = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdo-physical-identity-')
  );

  const physical = fs.realpathSync(lexical);

  t.after(() => {
    fs.rmSync(physical, { recursive: true, force: true });
  });

  return { lexical, physical };
}

test('authorized root materializes the physical filesystem identity', (t) => {
  const { lexical, physical } = fixture(t);

  assert.equal(
    canonicalizeAuthorizedRoot(lexical),
    physical
  );
});

test('physical materialization is idempotent', (t) => {
  const { physical } = fixture(t);

  assert.equal(
    canonicalizeAuthorizedRoot(physical),
    physical
  );
});

test('lexical and physical representations converge only through filesystem evidence', (t) => {
  const { lexical, physical } = fixture(t);

  const lexicalMaterialized = canonicalizeAuthorizedRoot(lexical);
  const physicalMaterialized = canonicalizeAuthorizedRoot(physical);

  assert.equal(
    lexicalMaterialized,
    physicalMaterialized
  );
});

test('unresolved physical identity fails closed', (t) => {
  const { physical } = fixture(t);
  const missing = path.join(physical, 'does-not-exist');

  assert.throws(
    () => canonicalizeAuthorizedRoot(missing),
    /cannot be resolved/
  );
});

test('lexical path identity authority remains distinct from physical filesystem identity', (t) => {
  const { lexical, physical } = fixture(t);
  const authority = createPathIdentityAuthority(process.platform);

  const lexicalIdentity = authority.normalizeAbsoluteIdentity(lexical);
  const physicalIdentity = authority.normalizeAbsoluteIdentity(physical);

  if (lexicalIdentity !== physicalIdentity) {
    assert.equal(
      authority.sameIdentity(lexicalIdentity, physicalIdentity),
      false
    );
  } else {
    assert.equal(
      authority.sameIdentity(lexicalIdentity, physicalIdentity),
      true
    );
  }

  assert.equal(
    canonicalizeAuthorizedRoot(lexical),
    canonicalizeAuthorizedRoot(physical)
  );
});
