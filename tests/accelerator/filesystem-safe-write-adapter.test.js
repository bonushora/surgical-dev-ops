'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  openExclusiveRegularWrite
} = require('../../accelerator/adapters/filesystem-safe-write-adapter');

function fixture(t) {
  const root = fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), 'sdo-safe-write-')
  );

  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  return {
    root,
    target: path.join(root, 'temporary.pending')
  };
}

test('exclusive protected creation returns the identity of the created regular file', (t) => {
  const { target } = fixture(t);

  const opened = openExclusiveRegularWrite(target);

  try {
    fs.writeFileSync(opened.descriptor, 'replacement\n');

    assert.equal(fs.readFileSync(target, 'utf8'), 'replacement\n');
    assert.match(opened.identity.dev, /^\d+$/);
    assert.match(opened.identity.ino, /^\d+$/);
  } finally {
    fs.closeSync(opened.descriptor);
  }
});

test('exclusive protected creation refuses an existing pathname', (t) => {
  const { target } = fixture(t);

  fs.writeFileSync(target, 'existing\n');

  assert.throws(
    () => openExclusiveRegularWrite(target),
    /EEXIST|file already exists/i
  );

  assert.equal(fs.readFileSync(target, 'utf8'), 'existing\n');
});

test('exclusive protected creation rejects a non-physical parent alias', (t) => {
  const { root } = fixture(t);

  const real = path.join(root, 'real');
  const alias = path.join(root, 'alias');

  fs.mkdirSync(real);

  try {
    fs.symlinkSync(real, alias, 'dir');
  } catch (error) {
    if (process.platform === 'win32' &&
        (error.code === 'EPERM' || error.code === 'EACCES')) {
      t.skip('Directory symlink creation is unavailable in this Windows environment.');
      return;
    }
    throw error;
  }

  assert.throws(
    () => openExclusiveRegularWrite(path.join(alias, 'temporary.pending')),
    /physically resolved safely|physical canonical directory/
  );
});

test('failed post-create qualification performs no pathname-based destructive cleanup', (t) => {
  const { target } = fixture(t);

  const realLstatSync = fs.lstatSync;
  let targetObservations = 0;
  let unlinks = 0;

  const fsPort = Object.create(fs);

  fsPort.lstatSync = function lstatSync(candidate, ...args) {
    if (candidate === target) {
      targetObservations += 1;

      if (targetObservations === 1) {
        const stat = realLstatSync.call(fs, candidate, ...args);

        return {
          isFile: () => false,
          isSymbolicLink: () => true,
          isDirectory: () => stat.isDirectory()
        };
      }
    }

    return realLstatSync.call(fs, candidate, ...args);
  };

  fsPort.unlinkSync = function unlinkSync() {
    unlinks += 1;
    throw new Error('pathname-based destructive cleanup must not be attempted');
  };

  assert.throws(
    () => openExclusiveRegularWrite(target, { fsPort }),
    /became a symlink or non-file/
  );

  assert.equal(unlinks, 0);
  assert.equal(fs.existsSync(target), true);
  assert.equal(fs.lstatSync(target).isFile(), true);
});

test('post-create identity mismatch performs no pathname-based destructive cleanup', (t) => {
  const { target } = fixture(t);

  const realStatSync = fs.statSync;
  let targetStats = 0;
  let unlinks = 0;

  const fsPort = Object.create(fs);

  fsPort.statSync = function statSync(candidate, options) {
    const stat = realStatSync.call(fs, candidate, options);

    if (candidate === target) {
      targetStats += 1;

      if (targetStats === 1) {
        return new Proxy(stat, {
          get(value, property) {
            if (property === 'ino') {
              return typeof value.ino === 'bigint'
                ? value.ino + 1n
                : value.ino + 1;
            }

            const member = value[property];
            return typeof member === 'function'
              ? member.bind(value)
              : member;
          }
        });
      }
    }

    return stat;
  };

  fsPort.unlinkSync = function unlinkSync() {
    unlinks += 1;
    throw new Error('pathname-based destructive cleanup must not be attempted');
  };

  assert.throws(
    () => openExclusiveRegularWrite(target, { fsPort }),
    /identity changed after protected creation/
  );

  assert.equal(unlinks, 0);
  assert.equal(fs.existsSync(target), true);
});

console.log('');
console.log('SAFE WRITE OWNERSHIP PATCH APPLIED');
