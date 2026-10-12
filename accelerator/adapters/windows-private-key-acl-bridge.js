'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const HELPER_NAME = 'sdo-fs-durability.exe';
const HELPER_SCHEMA = 'sdo.windows_private_key_acl_helper.v1';
const AUTHORIZED_PRINCIPALS = Object.freeze([
  'BUILTIN_ADMINISTRATORS',
  'CURRENT_PROCESS_USER',
  'LOCAL_SYSTEM'
]);

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

function requireAbsoluteRegularFile(target, fsPort) {
  if (typeof target !== 'string' || !target || !path.win32.isAbsolute(target)) {
    throw new Error('Windows private-key ACL target is malformed.');
  }
  const lexical = path.win32.normalize(target);
  let stat;
  try {
    stat = fsPort.lstatSync(lexical);
  } catch {
    throw new Error('Windows private-key ACL target is unavailable.');
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error('Windows private-key ACL target is not a physical regular file.');
  }
  return lexical;
}

function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function parseEvidence(stdout, expectedOperation, expectedSubject) {
  let evidence;
  try {
    evidence = JSON.parse(String(stdout || '').trim());
  } catch {
    throw new Error('Windows private-key ACL helper returned malformed evidence.');
  }
  const expectedKeys = [
    'aceCount', 'authorizedPrincipalClasses', 'daclPolicy', 'decision',
    'fileIndex', 'operation', 'ownerPolicy', 'primitive', 'schema',
    'subject', 'volumeSerialNumber'
  ];
  if (!exactKeys(evidence, expectedKeys) ||
      evidence.schema !== HELPER_SCHEMA || evidence.decision !== 'CONFIRMED' ||
      evidence.operation !== expectedOperation ||
      evidence.primitive !== (expectedOperation === 'PROTECT_PRIVATE_KEY_ACL'
        ? 'CreateFileW+SetSecurityInfo+GetSecurityInfo'
        : 'CreateFileW+GetSecurityInfo') ||
      evidence.subject !== expectedSubject ||
      evidence.ownerPolicy !== 'CURRENT_PROCESS_USER' ||
      evidence.daclPolicy !== 'PROTECTED_AUTHORIZED_PRINCIPALS_ONLY' ||
      !Array.isArray(evidence.authorizedPrincipalClasses) ||
      JSON.stringify(evidence.authorizedPrincipalClasses) !== JSON.stringify(AUTHORIZED_PRINCIPALS) ||
      !Number.isSafeInteger(evidence.aceCount) || evidence.aceCount < 1 ||
      !Number.isSafeInteger(evidence.volumeSerialNumber) || evidence.volumeSerialNumber < 0 ||
      typeof evidence.fileIndex !== 'string' || !/^\d+$/.test(evidence.fileIndex)) {
    throw new Error('Windows private-key ACL helper evidence is invalid or unbound.');
  }
  return deepFreeze(evidence);
}

function createWindowsPrivateKeyAclBridge({
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

  function invoke(operation, target) {
    if (platform !== 'win32') {
      throw new Error(`Windows private-key ACL bridge is unavailable on ${platform}.`);
    }
    if (!available()) {
      throw new Error('Windows private-key ACL helper is unavailable.');
    }
    const subject = requireAbsoluteRegularFile(target, fsPort);
    const result = processPort.spawnSync(
      resolvedHelper,
      [operation, subject],
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
      throw new Error('Windows private-key ACL proof failed closed.');
    }
    return parseEvidence(
      result.stdout,
      operation === 'protect-private-key-acl'
        ? 'PROTECT_PRIVATE_KEY_ACL'
        : 'VERIFY_PRIVATE_KEY_ACL',
      subject
    );
  }

  return deepFreeze({
    schema: 'sdo.windows_private_key_acl_bridge.v1',
    platform,
    provider: 'WIN32_HANDLE_SECURITY_DESCRIPTOR_V1',
    helperPath: resolvedHelper,
    available,
    protectPrivateKey: (target) => invoke('protect-private-key-acl', target),
    verifyPrivateKey: (target) => invoke('verify-private-key-acl', target)
  });
}

const defaultWindowsPrivateKeyAclBridge = createWindowsPrivateKeyAclBridge();

module.exports = {
  AUTHORIZED_PRINCIPALS,
  createWindowsPrivateKeyAclBridge,
  defaultWindowsPrivateKeyAclBridge
};
