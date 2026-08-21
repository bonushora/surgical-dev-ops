'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPathIdentityAuthority
} = require('../../accelerator/core/workspace-boundary');

test('POSIX path authority is explicit and immutable on Linux', () => {
  const authority = createPathIdentityAuthority('linux');

  assert.equal(authority.platform, 'linux');
  assert.equal(authority.separator, '/');
  assert.equal(authority.delimiter, ':');
  assert.ok(Object.isFrozen(authority));
});

test('POSIX path authority is explicit and immutable on macOS', () => {
  const authority = createPathIdentityAuthority('darwin');

  assert.equal(authority.platform, 'darwin');
  assert.equal(authority.separator, '/');
  assert.equal(authority.delimiter, ':');
  assert.ok(Object.isFrozen(authority));
});

test('Windows path authority uses native win32 semantics', () => {
  const authority = createPathIdentityAuthority('win32');

  assert.equal(authority.platform, 'win32');
  assert.equal(authority.separator, '\\');
  assert.equal(authority.delimiter, ';');

  assert.equal(
    authority.normalizeAbsoluteIdentity(
      'C:\\workspace\\project\\..\\project\\file.js'
    ),
    'C:\\workspace\\project\\file.js'
  );
});

test('POSIX identity comparison remains case-sensitive', () => {
  const authority = createPathIdentityAuthority('linux');

  assert.equal(
    authority.sameIdentity(
      '/workspace/Project',
      '/workspace/project'
    ),
    false
  );
});

test('Windows identity comparison follows case-insensitive filesystem identity semantics', () => {
  const authority = createPathIdentityAuthority('win32');

  assert.equal(
    authority.sameIdentity(
      'C:\\Workspace\\Project',
      'c:\\workspace\\project'
    ),
    true
  );
});

test('Windows identity comparison normalizes separators and dot segments', () => {
  const authority = createPathIdentityAuthority('win32');

  assert.equal(
    authority.sameIdentity(
      'C:\\workspace\\project\\src\\..\\file.js',
      'C:/workspace/project/file.js'
    ),
    true
  );
});

test('POSIX identity comparison normalizes dot segments without weakening root identity', () => {
  const authority = createPathIdentityAuthority('linux');

  assert.equal(
    authority.sameIdentity(
      '/workspace/project/src/../file.js',
      '/workspace/project/file.js'
    ),
    true
  );
});

test('relative identities fail closed', () => {
  for (const platform of ['linux', 'darwin', 'win32']) {
    const authority = createPathIdentityAuthority(platform);

    assert.throws(
      () => authority.normalizeAbsoluteIdentity('workspace/project'),
      /must be absolute/
    );
  }
});

test('empty identities fail closed', () => {
  const authority = createPathIdentityAuthority('linux');

  assert.throws(
    () => authority.normalizeAbsoluteIdentity(''),
    /non-empty string/
  );
});

test('unknown platform fails closed', () => {
  assert.throws(
    () => createPathIdentityAuthority('unknown'),
    /Unsupported path identity platform/
  );
});

test('path authority exposes no filesystem mutation or shell authority', () => {
  const authority = createPathIdentityAuthority('win32');

  const exposed = Object.keys(authority).sort();

  assert.deepEqual(
    exposed,
    [
      'delimiter',
      'isCanonicalAbsoluteIdentity',
      'normalizeAbsoluteIdentity',
      'platform',
      'sameIdentity',
      'separator'
    ]
  );

  assert.equal('writeFile' in authority, false);
  assert.equal('exec' in authority, false);
  assert.equal('spawn' in authority, false);
  assert.equal('shell' in authority, false);
});

test('existing production workspace boundary contract remains exported', () => {
  const boundary =
    require('../../accelerator/core/workspace-boundary');

  assert.equal(
    typeof boundary.canonicalizeAuthorizedRoot,
    'function'
  );

  assert.equal(
    typeof boundary.resolveInspectedFile,
    'function'
  );
});

test('canonical predicate rejects reducible dot-segment representations', () => {
  const cases = [
    ['linux', '/workspace/a/../project'],
    ['darwin', '/workspace/a/../project'],
    ['win32', 'C:\\workspace\\a\\..\\project']
  ];

  for (const [platform, value] of cases) {
    const authority = createPathIdentityAuthority(platform);

    assert.equal(
      authority.isCanonicalAbsoluteIdentity(value),
      false
    );
  }
});

test('canonical predicate accepts normalized absolute identities', () => {
  const cases = [
    ['linux', '/workspace/project'],
    ['darwin', '/workspace/project'],
    ['win32', 'C:\\workspace\\project']
  ];

  for (const [platform, value] of cases) {
    const authority = createPathIdentityAuthority(platform);

    assert.equal(
      authority.isCanonicalAbsoluteIdentity(value),
      true
    );
  }
});

test('directory trailing separators converge to one non-root identity', () => {
  const cases = [
    [
      'linux',
      '/workspace/project/',
      '/workspace/project'
    ],
    [
      'darwin',
      '/workspace/project/',
      '/workspace/project'
    ],
    [
      'win32',
      'C:\\workspace\\project\\',
      'C:\\workspace\\project'
    ]
  ];

  for (const [platform, left, right] of cases) {
    const authority = createPathIdentityAuthority(platform);

    assert.equal(
      authority.sameIdentity(left, right),
      true
    );

    assert.equal(
      authority.normalizeAbsoluteIdentity(left),
      authority.normalizeAbsoluteIdentity(right)
    );
  }
});

test('filesystem roots remain roots during identity normalization', () => {
  const cases = [
    ['linux', '/', '/'],
    ['darwin', '/', '/'],
    ['win32', 'C:\\', 'C:\\']
  ];

  for (const [platform, value, expected] of cases) {
    const authority = createPathIdentityAuthority(platform);

    assert.equal(
      authority.normalizeAbsoluteIdentity(value),
      expected
    );

    assert.equal(
      authority.isCanonicalAbsoluteIdentity(value),
      true
    );
  }
});
