'use strict';

const fs = require('node:fs');

function sameFileIdentity(left, right) {
  return Boolean(left && right) &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs;
}

function ensureNonSymlinkRegularPath(target, fsPort = fs) {
  const lexical = fsPort.lstatSync(target);
  if (lexical.isSymbolicLink() || !lexical.isFile()) {
    throw new Error('Filesystem target must be an existing non-symlink regular file.');
  }
  return fsPort.statSync(target, { bigint: true });
}

function openVerifiedRegularRead(target, {
  fsPort = fs,
  maxBytes = null,
  noFollowFlag = typeof fs.constants.O_NOFOLLOW === 'number'
    ? fs.constants.O_NOFOLLOW
    : 0
} = {}) {
  const before = ensureNonSymlinkRegularPath(target, fsPort);
  let descriptor;

  try {
    descriptor = fsPort.openSync(target, fs.constants.O_RDONLY | noFollowFlag);
    const opened = fsPort.fstatSync(descriptor, { bigint: true });

    if (!opened.isFile() || !sameFileIdentity(before, opened)) {
      throw new Error('Filesystem target identity changed before protected open.');
    }

    const afterLexical = fsPort.lstatSync(target);
    if (afterLexical.isSymbolicLink() || !afterLexical.isFile()) {
      throw new Error('Filesystem target became a symlink or non-file during protected open.');
    }

    const after = fsPort.statSync(target, { bigint: true });
    if (!sameFileIdentity(opened, after)) {
      throw new Error('Filesystem target identity changed during protected open.');
    }

    if (maxBytes !== null) {
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
        throw new Error('Protected read size bound is malformed.');
      }
      if (opened.size > BigInt(maxBytes)) {
        throw new Error('Filesystem target exceeds protected read size bound.');
      }
    }

    return Object.freeze({
      descriptor,
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
      try { fsPort.closeSync(descriptor); } catch {}
    }
    throw error;
  }
}

module.exports = {
  sameFileIdentity,
  openVerifiedRegularRead
};
