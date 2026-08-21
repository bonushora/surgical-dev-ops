'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { openVerifiedRegularRead } =
  require('../../accelerator/adapters/filesystem-safe-read-adapter');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'sdo-safe-read-'));
  const target = path.join(root, 'target.txt');
  fs.writeFileSync(target, 'safe\n');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, target };
}

test('protected read works without O_NOFOLLOW when path and descriptor identity remain stable', (t) => {
  const { target } = fixture(t);
  const opened = openVerifiedRegularRead(target, { noFollowFlag: 0 });
  try {
    assert.equal(fs.readFileSync(opened.descriptor, 'utf8'), 'safe\n');
    assert.match(opened.identity.ino, /^\d+$/);
  } finally {
    fs.closeSync(opened.descriptor);
  }
});

test('protected read rejects an explicit final-component symlink without O_NOFOLLOW', (t) => {
  const { root, target } = fixture(t);
  const link = path.join(root, 'link.txt');
  fs.symlinkSync(target, link);
  assert.throws(
    () => openVerifiedRegularRead(link, { noFollowFlag: 0 }),
    /non-symlink regular file/
  );
});

test('protected read fails before returning an fd when open resolves to a different identity', (t) => {
  const { root, target } = fixture(t);
  const other = path.join(root, 'other.txt');
  fs.writeFileSync(other, 'other\n');
  const realFs = fs;
  const port = {
    ...realFs,
    openSync(candidate, flags) {
      if (candidate === target) return realFs.openSync(other, flags);
      return realFs.openSync(candidate, flags);
    }
  };
  assert.throws(
    () => openVerifiedRegularRead(target, { fsPort: port, noFollowFlag: 0 }),
    /identity changed before protected open/
  );
});

test('protected read enforces a byte bound from the opened descriptor identity', (t) => {
  const { target } = fixture(t);
  assert.throws(
    () => openVerifiedRegularRead(target, { maxBytes: 2, noFollowFlag: 0 }),
    /exceeds protected read size bound/
  );
});
