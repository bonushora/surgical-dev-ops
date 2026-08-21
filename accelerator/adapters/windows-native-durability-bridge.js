'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const HELPER_SCHEMA = 'sdo.windows_native_durability_helper.v1';
const HELPER_NAME = 'sdo-fs-durability.exe';

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function canonicalHelperPath() {
  return path.join(__dirname, '..', 'native', 'windows', HELPER_NAME);
}

function requireAbsoluteDirectory(directory, fsPort) {
  if (typeof directory !== 'string' || !directory || !path.win32.isAbsolute(directory)) {
    throw new Error('Windows native durability directory is malformed.');
  }
  const lexical = path.win32.normalize(directory);
  let physical;
  try {
    const lexicalStat = fsPort.lstatSync(lexical);
    if (!lexicalStat.isDirectory() || lexicalStat.isSymbolicLink()) {
      throw new Error('unsafe lexical directory');
    }
    physical = fsPort.realpathSync.native
      ? fsPort.realpathSync.native(lexical)
      : fsPort.realpathSync(lexical);
  } catch {
    throw new Error('Windows native durability directory cannot be physically resolved safely.');
  }
  const stat = fsPort.lstatSync(physical);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('Windows native durability directory is unsafe or ambiguous.');
  }
  return physical;
}

function parseHelperEvidence(stdout, expectedDirectory) {
  let evidence;
  try {
    evidence = JSON.parse(String(stdout || '').trim());
  } catch {
    throw new Error('Windows native durability helper returned malformed evidence.');
  }
  if (!evidence || evidence.schema !== HELPER_SCHEMA || evidence.decision !== 'CONFIRMED' ||
      evidence.operation !== 'FLUSH_DIRECTORY' ||
      evidence.primitive !== 'CreateFileW+FlushFileBuffers' ||
      evidence.subject !== expectedDirectory ||
      !Number.isSafeInteger(evidence.volumeSerialNumber) || evidence.volumeSerialNumber < 0 ||
      typeof evidence.fileIndex !== 'string' || !/^\d+$/.test(evidence.fileIndex)) {
    throw new Error('Windows native durability helper evidence is invalid or unbound.');
  }
  return deepFreeze(evidence);
}

function createWindowsNativeDurabilityBridge({
  platform = process.platform,
  fsPort = fs,
  processPort = childProcess
} = {}) {
  const resolvedHelper = path.resolve(canonicalHelperPath());

  function available() {
    if (platform !== 'win32') return false;
    try {
      const stat = fsPort.statSync(resolvedHelper);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  function flushDirectory(directory) {
    if (platform !== 'win32') {
      throw new Error(`Windows native durability bridge is unavailable on ${platform}.`);
    }
    if (!available()) {
      throw new Error('Windows native durability helper is unavailable.');
    }
    const physicalDirectory = requireAbsoluteDirectory(directory, fsPort);
    const result = processPort.spawnSync(
      resolvedHelper,
      ['flush-directory', physicalDirectory],
      {
        shell: false,
        windowsHide: true,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 15000,
        maxBuffer: 64 * 1024
      }
    );
    if (!result || result.error || result.status !== 0 || result.signal ||
        typeof result.stdout !== 'string') {
      throw new Error('Windows native directory durability primitive failed closed.');
    }
    return parseHelperEvidence(result.stdout, physicalDirectory);
  }

  return deepFreeze({
    schema: 'sdo.windows_native_durability_bridge.v1',
    platform,
    provider: 'WIN32_CREATEFILE_FLUSHFILEBUFFERS_V1',
    helperPath: resolvedHelper,
    available,
    flushDirectory
  });
}

const defaultWindowsNativeDurabilityBridge = createWindowsNativeDurabilityBridge();

module.exports = {
  createWindowsNativeDurabilityBridge,
  defaultWindowsNativeDurabilityBridge
};
