'use strict';

const fs = require('node:fs');
const { CLAIMS } = require('../core/mutation-durability');
const {
  defaultWindowsNativeDurabilityBridge
} = require('./windows-native-durability-bridge');

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function createFilesystemDurabilityAdapter({
  platform = process.platform,
  fsPort = fs,
  windowsBridge = defaultWindowsNativeDurabilityBridge
} = {}) {
  const posixSupported = platform === 'linux' || platform === 'darwin';
  const windowsSupported = platform === 'win32' && windowsBridge &&
    typeof windowsBridge.available === 'function' && windowsBridge.available() === true;
  const supported = posixSupported || windowsSupported;
  const provider = posixSupported
    ? 'NODE_FS_FSYNC_V1'
    : windowsSupported
      ? 'NODE_FSYNC_PLUS_WIN32_DIRECTORY_FLUSH_V1'
      : 'UNSUPPORTED';

  const capabilities = deepFreeze({
    schema: 'sdo.filesystem_durability_capabilities.v1',
    platform,
    provider,
    supported,
    fileDataFlush: supported,
    directoryFlush: supported,
    durableRenameBoundary: supported,
    claimLevel: supported
      ? CLAIMS.FILESYSTEM_DURABILITY_PRIMITIVES_ENFORCED
      : CLAIMS.PROCESS_CRASH_RECONCILIATION,
    powerLossValidated: false,
    reason: posixSupported
      ? 'Node fsync primitives are available for explicit filesystem ordering.'
      : windowsSupported
        ? 'Node file fsync and a qualified Win32 directory FlushFileBuffers bridge are available.'
        : 'Required platform durability primitives are not qualified on this platform.'
  });

  function receipt(operation, subject, nativeEvidence = null) {
    const value = {
      schema: 'sdo.filesystem_durability_receipt.v1',
      operation,
      decision: 'CONFIRMED',
      platform,
      provider: capabilities.provider,
      claimLevel: CLAIMS.FILESYSTEM_DURABILITY_PRIMITIVES_ENFORCED,
      powerLossValidated: false,
      subject
    };
    if (nativeEvidence) value.nativeEvidence = nativeEvidence;
    return deepFreeze(value);
  }

  function requireSupported() {
    if (!capabilities.supported) {
      throw new Error(`Filesystem durability is UNSUPPORTED on ${platform}.`);
    }
  }

  function flushFile(descriptor, subject = 'file') {
    requireSupported();
    if (!Number.isInteger(descriptor) || descriptor < 0) {
      throw new Error('Durability file descriptor is malformed.');
    }
    fsPort.fsyncSync(descriptor);
    return receipt('FLUSH_FILE_DATA', subject);
  }

  function flushDirectory(directory, operation = 'FLUSH_DIRECTORY') {
    requireSupported();
    if (platform === 'win32') {
      const nativeEvidence = windowsBridge.flushDirectory(directory);
      return receipt(operation, directory, nativeEvidence);
    }
    let descriptor;
    try {
      descriptor = fsPort.openSync(directory, fs.constants.O_RDONLY);
      fsPort.fsyncSync(descriptor);
    } finally {
      if (descriptor !== undefined) fsPort.closeSync(descriptor);
    }
    return receipt(operation, directory);
  }

  function confirmRename(directory) {
    return flushDirectory(directory, 'DURABLE_RENAME_BOUNDARY');
  }

  function confirmJournal(directory, terminal = false) {
    return flushDirectory(
      directory,
      terminal ? 'DURABLE_FINALIZATION' : 'DURABLE_JOURNAL_APPEND'
    );
  }

  function confirmLock(directory) {
    return flushDirectory(directory, 'DURABLE_LOCK_BOUNDARY');
  }

  return deepFreeze({
    capabilities,
    flushFile,
    flushDirectory,
    confirmRename,
    confirmJournal,
    confirmLock
  });
}

const defaultFilesystemDurabilityAdapter = createFilesystemDurabilityAdapter();
module.exports = { createFilesystemDurabilityAdapter, defaultFilesystemDurabilityAdapter };
