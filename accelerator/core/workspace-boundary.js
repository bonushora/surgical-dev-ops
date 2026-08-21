'use strict';

const fs = require('fs');
const path = require('path');

function createPathIdentityAuthority(platform = process.platform) {
  let pathPort;

  if (platform === 'linux' || platform === 'darwin') {
    pathPort = path.posix;
  } else if (platform === 'win32') {
    pathPort = path.win32;
  } else {
    throw new Error(`Unsupported path identity platform: ${platform}`);
  }

  function normalizeAbsoluteIdentity(value) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error('Path identity must be a non-empty string.');
    }

    if (!pathPort.isAbsolute(value)) {
      throw new Error(`Path identity must be absolute: ${value}`);
    }

    const normalized = pathPort.normalize(value);
    const root = pathPort.parse(normalized).root;

    if (
      normalized !== root &&
      normalized.endsWith(pathPort.sep)
    ) {
      return normalized.slice(0, -pathPort.sep.length);
    }

    return normalized;
  }

  function sameIdentity(left, right) {
    const normalizedLeft = normalizeAbsoluteIdentity(left);
    const normalizedRight = normalizeAbsoluteIdentity(right);

    if (platform === 'win32') {
      return normalizedLeft.toLowerCase() === normalizedRight.toLowerCase();
    }

    return normalizedLeft === normalizedRight;
  }

  function isCanonicalAbsoluteIdentity(value) {
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      !pathPort.isAbsolute(value)
    ) {
      return false;
    }

    try {
      return value === normalizeAbsoluteIdentity(value);
    } catch {
      return false;
    }
  }

  return Object.freeze({
    platform,
    separator: pathPort.sep,
    delimiter: pathPort.delimiter,
    normalizeAbsoluteIdentity,
    sameIdentity,
    isCanonicalAbsoluteIdentity
  });
}

function canonicalizeAuthorizedRoot(rootPath) {
  if (typeof rootPath !== 'string' || !rootPath.trim()) {
    throw new Error('Authorized workspace root must be a non-empty string.');
  }

  let canonicalRoot;

  try {
    canonicalRoot = fs.realpathSync(path.resolve(rootPath));
  } catch {
    throw new Error(`Authorized workspace root cannot be resolved: ${rootPath}`);
  }

  if (!fs.statSync(canonicalRoot).isDirectory()) {
    throw new Error(`Authorized workspace root is not a directory: ${rootPath}`);
  }

  return canonicalRoot;
}

function containsTraversal(targetPath) {
  return targetPath
    .split(/[\\/]+/)
    .some((segment) => segment === '..');
}

function isWithinRoot(canonicalRoot, canonicalTarget) {
  const relative = path.relative(canonicalRoot, canonicalTarget);

  return relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative);
}

function resolveInspectedFile(authorizedRoot, targetPath) {
  const canonicalRoot = canonicalizeAuthorizedRoot(authorizedRoot);

  if (typeof targetPath !== 'string' || !targetPath.trim()) {
    throw new Error('Inspected path must be a non-empty relative path.');
  }

  if (path.isAbsolute(targetPath) || containsTraversal(targetPath)) {
    throw new Error(`Inspected path escapes authorized workspace: ${targetPath}`);
  }

  let canonicalTarget;

  try {
    canonicalTarget = fs.realpathSync(
      path.resolve(canonicalRoot, targetPath)
    );
  } catch {
    throw new Error(`Inspected path cannot be resolved: ${targetPath}`);
  }

  if (!isWithinRoot(canonicalRoot, canonicalTarget)) {
    throw new Error(`Inspected path escapes authorized workspace: ${targetPath}`);
  }

  if (!fs.statSync(canonicalTarget).isFile()) {
    throw new Error(`Inspected path is not a file: ${targetPath}`);
  }

  return {
    canonicalRoot,
    canonicalTarget
  };
}

module.exports = {
  createPathIdentityAuthority,
  canonicalizeAuthorizedRoot,
  resolveInspectedFile
};
