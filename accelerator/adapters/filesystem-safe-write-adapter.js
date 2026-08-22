'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  sameFileIdentity
} = require('./filesystem-safe-read-adapter');
const {
  createPathIdentityAuthority
} = require('../core/workspace-boundary');

function requireSafeParent(target, fsPort) {
  if (typeof target !== 'string' || !target || !path.isAbsolute(target)) {
    throw new Error('Exclusive write target must be an absolute path.');
  }

  const normalized = path.normalize(target);
  if (normalized !== target) {
    throw new Error('Exclusive write target must be canonical.');
  }

  const parent = path.dirname(target);

  let lexicalParent;
  let physicalParent;

  try {
    lexicalParent = fsPort.lstatSync(parent);

    if (!lexicalParent.isDirectory() || lexicalParent.isSymbolicLink()) {
      throw new Error('unsafe parent');
    }

    physicalParent = fsPort.realpathSync(parent);
  } catch {
    throw new Error(
      'Exclusive write parent cannot be physically resolved safely.'
    );
  }

  const pathIdentity = createPathIdentityAuthority(process.platform);

  if (!pathIdentity.sameIdentity(physicalParent, parent)) {
    throw new Error(
      'Exclusive write parent must already be a physical canonical directory.'
    );
  }

  const physicalStat = fsPort.lstatSync(physicalParent);

  if (!physicalStat.isDirectory() || physicalStat.isSymbolicLink()) {
    throw new Error('Exclusive write parent is unsafe or ambiguous.');
  }

  return physicalParent;
}

function openExclusiveRegularWrite(target, {
  fsPort = fs,
  mode = 0o600
} = {}) {
  requireSafeParent(target, fsPort);

  if (!Number.isInteger(mode) || mode < 0 || mode > 0o777) {
    throw new Error('Exclusive write mode is malformed.');
  }

  let descriptor;

  try {
    descriptor = fsPort.openSync(
      target,
      fs.constants.O_WRONLY |
        fs.constants.O_CREAT |
        fs.constants.O_EXCL,
      mode
    );

    const opened = fsPort.fstatSync(descriptor, { bigint: true });

    if (!opened.isFile()) {
      throw new Error('Exclusive write did not create a regular file.');
    }

    const lexical = fsPort.lstatSync(target);

    if (lexical.isSymbolicLink() || !lexical.isFile()) {
      throw new Error(
        'Exclusive write target became a symlink or non-file after creation.'
      );
    }

    const observed = fsPort.statSync(target, { bigint: true });

    if (!sameFileIdentity(opened, observed)) {
      throw new Error(
        'Exclusive write target identity changed after protected creation.'
      );
    }

    return Object.freeze({
      descriptor,
      path: target,
      stat: opened,
      identity: Object.freeze({
        dev: String(opened.dev),
        ino: String(opened.ino),
        size: String(opened.size),
        mtimeNs: String(opened.mtimeNs),
        ctimeNs: String(opened.ctimeNs)
      })
    });
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        fsPort.closeSync(descriptor);
      } catch {}
    }

    /*
     * Do not unlink target here.
     *
     * Once post-create qualification has failed, a pathname-based observation
     * cannot prove that target still names the regular file created by this
     * operation at the instant of unlink. Cleanup therefore has no destructive
     * authority and must fail closed. A qualified higher-level provider may
     * reconcile an orphan only through a primitive that can prove ownership at
     * its destructive boundary.
     */

    throw error;
  }
}

module.exports = {
  openExclusiveRegularWrite
};
