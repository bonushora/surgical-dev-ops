'use strict';

const fs = require('fs');
const path = require('path');

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
  canonicalizeAuthorizedRoot,
  resolveInspectedFile
};
