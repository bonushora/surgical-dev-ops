'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = 'sdo.windows_private_key_acl.v1';
const KEY_FILENAME = 'private-key.pkcs8.pem';
const HELPER_FILENAME = 'sdo-private-key-acl.exe';
const HELPER = path.resolve(__dirname, '..', 'native', 'windows', HELPER_FILENAME);
const FIELDS = Object.freeze([
  'schema', 'decision', 'operation', 'primitive', 'ownerMatchesToken',
  'daclProtected', 'noBroadAllowAces', 'userReadAllowed',
  'volumeSerialNumber', 'fileIndex', 'subject'
].sort());

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function createWindowsPrivateKeyAclBridge({
  platform = process.platform,
  fsPort = fs,
  processPort = childProcess
} = {}) {
  function available() {
    if (platform !== 'win32') return false;
    try {
      const stat = fsPort.lstatSync(HELPER);
      return stat.isFile() && !stat.isSymbolicLink();
    } catch {
      return false;
    }
  }

  function targetPath(target, creating) {
    if (typeof target !== 'string' || !path.win32.isAbsolute(target) ||
        path.win32.normalize(target) !== target ||
        path.win32.basename(target) !== KEY_FILENAME) {
      throw new Error('Windows private-key ACL target is malformed.');
    }
    const dir = path.win32.dirname(target);
    const parentStat = fsPort.lstatSync(dir);
    if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
      throw new Error('Windows private-key ACL parent is unsafe.');
    }
    const physical = fsPort.realpathSync.native
      ? fsPort.realpathSync.native(dir) : fsPort.realpathSync(dir);
    const physicalStat = fsPort.lstatSync(physical);
    if (!physicalStat.isDirectory() || physicalStat.isSymbolicLink()) {
      throw new Error('Windows private-key ACL physical parent is unsafe.');
    }
    const checked = path.win32.join(physical, KEY_FILENAME);
    if (creating) {
      if (fsPort.existsSync(checked)) {
        throw new Error('Windows private-key ACL target already exists.');
      }
    } else {
      const stat = fsPort.lstatSync(checked);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error('Windows private-key ACL target is unsafe.');
      }
    }
    return checked;
  }

  function run(operation, target, bytes = null) {
    if (platform !== 'win32' || !available()) {
      throw new Error('Windows native private-key ACL qualification is unavailable.');
    }
    const subject = targetPath(target, operation === 'create-private-key');
    const args = [operation, subject];
    const options = {
      shell: false,
      windowsHide: true,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
      maxBuffer: 64 * 1024
    };
    if (bytes !== null) options.input = bytes;
    const result = processPort.spawnSync(HELPER, args, options);
    if (!result || result.error || result.status !== 0 || result.signal ||
        typeof result.stdout !== 'string') {
      throw new Error('Windows private-key ACL native attestation failed closed.');
    }
    let value;
    try { value = JSON.parse(result.stdout.trim()); }
    catch { throw new Error('Windows private-key ACL native evidence is malformed.'); }
    const actual = value && typeof value === 'object' && !Array.isArray(value)
      ? Reflect.ownKeys(value).sort() : [];
    const expectedOp = operation === 'create-private-key'
      ? 'CREATE_PRIVATE_KEY_ACL' : 'VERIFY_PRIVATE_KEY_ACL';
    if (actual.length !== FIELDS.length || actual.some((v, i) => v !== FIELDS[i]) ||
        value.schema !== SCHEMA || value.decision !== 'CONFIRMED' ||
        value.operation !== expectedOp ||
        value.primitive !== 'CreateFileW+GetSecurityInfo+DaclTrusteeReview' ||
        value.subject !== subject ||
        value.ownerMatchesToken !== true || value.daclProtected !== true ||
        value.noBroadAllowAces !== true || value.userReadAllowed !== true ||
        !Number.isSafeInteger(value.volumeSerialNumber) || value.volumeSerialNumber < 0 ||
        typeof value.fileIndex !== 'string' || !/^[0-9]+$/.test(value.fileIndex)) {
      throw new Error('Windows private-key ACL native evidence is invalid or unbound.');
    }
    return deepFreeze(value);
  }

  function createSecureTestPrivateKey(target, privateBytes, { testOnly = false } = {}) {
    const main = process.argv[1] || '';
    if (!testOnly || (!process.env.NODE_TEST_CONTEXT && !/\.test\.js$/.test(main))) {
      throw new Error('Windows private-key native creation is test-only.');
    }
    // PKCS8 PEM from node:crypto is a UTF-8 string; DER exports are Buffers.
    // Accept these two defined encodings only, preserving the 16 KiB limit.
    const bytes = typeof privateBytes === 'string'
      ? Buffer.from(privateBytes, 'utf8') : privateBytes;
    if (!Buffer.isBuffer(bytes) || bytes.length < 32 ||
        bytes.length > 16384) {
      throw new Error('Windows private-key source bytes are malformed.');
    }
    return run('create-private-key', target, bytes);
  }

  function verifyPrivateKey(target) {
    return run('verify-private-key', target);
  }

  return deepFreeze({
    schema: 'sdo.windows_private_key_acl_bridge.v1',
    available, createSecureTestPrivateKey, verifyPrivateKey
  });
}

const defaultWindowsPrivateKeyAclBridge = createWindowsPrivateKeyAclBridge();

module.exports = {
  createWindowsPrivateKeyAclBridge,
  defaultWindowsPrivateKeyAclBridge
};
