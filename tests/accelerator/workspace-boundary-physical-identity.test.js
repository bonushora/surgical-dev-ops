'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  createPathIdentityAuthority,
  canonicalizeAuthorizedRoot,
  samePhysicalWorkspaceIdentity
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


test('physical workspace identity accepts an explicit lexical alias only through filesystem evidence', (t) => {
  const { physical } = fixture(t);
  const aliasParent = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-physical-alias-parent-'));
  const alias = path.join(aliasParent, 'workspace-link');

  t.after(() => {
    fs.rmSync(aliasParent, { recursive: true, force: true });
  });

  try {
    fs.symlinkSync(physical, alias, 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      return t.skip('Symlink creation is unavailable on this platform.');
    }
    throw error;
  }

  assert.equal(samePhysicalWorkspaceIdentity(alias, physical), true);
});

test('physical workspace identity rejects distinct directories and unresolved paths', (t) => {
  const { physical } = fixture(t);
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-physical-other-'));

  t.after(() => {
    fs.rmSync(other, { recursive: true, force: true });
  });

  assert.equal(samePhysicalWorkspaceIdentity(physical, other), false);
  assert.equal(
    samePhysicalWorkspaceIdentity(physical, path.join(other, 'missing')),
    false
  );
});
