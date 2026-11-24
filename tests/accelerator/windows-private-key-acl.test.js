'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  createWindowsPrivateKeyAclBridge
} = require('../../accelerator/adapters/windows-private-key-acl-bridge');

test('Windows native key creation binds an actual protected DACL and verifies physical identity', (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows-only native private key ACL qualification.');
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-win-key-acl-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, 'private-key.pkcs8.pem');
  const privatePem = crypto.generateKeyPairSync('ed25519').privateKey.export({
    type: 'pkcs8', format: 'pem'
  });
  const bridge = createWindowsPrivateKeyAclBridge();
  assert.equal(bridge.available(), true);
  const created = bridge.createSecureTestPrivateKey(target, privatePem, { testOnly: true });
  const verified = bridge.verifyPrivateKey(target);
  assert.equal(created.operation, 'CREATE_PRIVATE_KEY_ACL');
  assert.equal(verified.operation, 'VERIFY_PRIVATE_KEY_ACL');
  assert.equal(created.fileIndex, verified.fileIndex);
  assert.equal(created.volumeSerialNumber, verified.volumeSerialNumber);
  assert.equal(verified.daclProtected, true);
  assert.equal(verified.noBroadAllowAces, true);
  assert.equal(verified.ownerMatchesToken, true);
  assert.equal(fs.readFileSync(target, 'utf8'), privatePem);
  assert.ok(Object.isFrozen(verified));
});

test('Windows native ACL verifier rejects an Everyone-readable private key', (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows-only native ACL attack probe.');
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-win-key-acl-negative-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, 'private-key.pkcs8.pem');
  const privatePem = crypto.generateKeyPairSync('ed25519').privateKey.export({
    type: 'pkcs8', format: 'pem'
  });
  const bridge = createWindowsPrivateKeyAclBridge();
  bridge.createSecureTestPrivateKey(target, privatePem, { testOnly: true });
  const broaden = childProcess.spawnSync('icacls.exe', [target, '/grant', '*S-1-1-0:(R)'], {
    shell: false, windowsHide: true, encoding: 'utf8'
  });
  assert.equal(broaden.status, 0, 'the negative ACL mutation itself must actually execute');
  assert.throws(() => bridge.verifyPrivateKey(target), /ACL_NOT_PROVEN/);
});

test('Windows validates the inherited descriptor rather than a substituted pathname', (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows-only descriptor identity attack probe.');
    return;
  }
  const first = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-win-key-fd-a-'));
  const second = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-win-key-fd-b-'));
  t.after(() => {
    fs.rmSync(first, { recursive: true, force: true });
    fs.rmSync(second, { recursive: true, force: true });
  });
  const a = path.join(first, 'private-key.pkcs8.pem');
  const b = path.join(second, 'private-key.pkcs8.pem');
  const bridge = createWindowsPrivateKeyAclBridge();
  const pemA = crypto.generateKeyPairSync('ed25519').privateKey.export({
    type: 'pkcs8', format: 'pem'
  });
  const pemB = crypto.generateKeyPairSync('ed25519').privateKey.export({
    type: 'pkcs8', format: 'pem'
  });
  bridge.createSecureTestPrivateKey(a, pemA, { testOnly: true });
  bridge.createSecureTestPrivateKey(b, pemB, { testOnly: true });
  const fd = fs.openSync(a, 'r');
  try {
    const evidence = bridge.verifyPrivateKeyHandle(a, fd);
    assert.equal(evidence.operation, 'VERIFY_PRIVATE_KEY_HANDLE_ACL');
    assert.equal(evidence.primitive, 'InheritedHandle+GetSecurityInfo+DaclTrusteeReview');
    assert.equal(evidence.subject, fs.realpathSync.native
      ? path.join(fs.realpathSync.native(first), 'private-key.pkcs8.pem') : a);
    // Deterministic identity substitution: the descriptor still refers to A,
    // while B has a different physical file identity and its own secure ACL.
    assert.throws(() => bridge.verifyPrivateKeyHandle(b, fd), /HANDLE_PATH_MISMATCH/);
    assert.equal(fs.readFileSync(fd, 'utf8'), pemA);
    assert.notEqual(pemA, pemB);
  } finally {
    fs.closeSync(fd);
  }
});

test('Windows descriptor-bound ACL denies a real Everyone-read ACE', (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows-only descriptor-bound negative ACL probe.');
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-win-key-fd-ace-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, 'private-key.pkcs8.pem');
  const privatePem = crypto.generateKeyPairSync('ed25519').privateKey.export({
    type: 'pkcs8', format: 'pem'
  });
  const bridge = createWindowsPrivateKeyAclBridge();
  bridge.createSecureTestPrivateKey(target, privatePem, { testOnly: true });
  const broaden = childProcess.spawnSync('icacls.exe', [target, '/grant', '*S-1-1-0:(R)'], {
    shell: false, windowsHide: true, encoding: 'utf8'
  });
  assert.equal(broaden.status, 0, 'Everyone ACL mutation must occur');
  const fd = fs.openSync(target, 'r');
  try {
    assert.throws(() => bridge.verifyPrivateKeyHandle(target, fd), /ACL_NOT_PROVEN/);
  } finally {
    fs.closeSync(fd);
  }
});

test('Windows bridge forwards the exact inherited key fd without a shell', () => {
  const calls = [];
  const fsPort = {
    lstatSync(name) {
      return String(name).endsWith('.exe')
        ? { isFile: () => true, isSymbolicLink: () => false }
        : String(name).endsWith('.pem')
          ? { isFile: () => true, isSymbolicLink: () => false }
          : { isDirectory: () => true, isSymbolicLink: () => false };
    },
    realpathSync(name) { return name; }
  };
  const subject = 'C:\\trusted\\private-key.pkcs8.pem';
  const receipt = {
    schema: 'sdo.windows_private_key_acl.v1',
    decision: 'CONFIRMED', operation: 'VERIFY_PRIVATE_KEY_HANDLE_ACL',
    primitive: 'InheritedHandle+GetSecurityInfo+DaclTrusteeReview',
    ownerMatchesToken: true, daclProtected: true, noBroadAllowAces: true,
    userReadAllowed: true, volumeSerialNumber: 12, fileIndex: '42', subject
  };
  const bridge = createWindowsPrivateKeyAclBridge({
    platform: 'win32', fsPort,
    processPort: {
      spawnSync(executable, args, opts) {
        calls.push({ executable, args, opts });
        return { status: 0, signal: null, stdout: JSON.stringify(receipt) };
      }
    }
  });
  assert.equal(bridge.verifyPrivateKeyHandle(subject, 7).decision, 'CONFIRMED');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].opts.shell, false);
  assert.equal(calls[0].opts.stdio[0], 7);
  assert.deepEqual(calls[0].args, ['verify-private-key-handle', subject]);
  assert.throws(() => bridge.verifyPrivateKeyHandle(subject, -1), /malformed/);
});

test('native ACL source cannot execute commands or silently trust POSIX permissions', () => {
  const source = fs.readFileSync(path.join(
    __dirname, '..', '..', 'accelerator', 'native', 'windows', 'sdo-private-key-acl.cpp'
  ), 'utf8');
  assert.match(source, /SE_DACL_PROTECTED/);
  assert.match(source, /CreateFileW/);
  assert.match(source, /GetSecurityInfo/);
  assert.match(source, /GetAce/);
  assert.match(source, /ConvertStringSecurityDescriptorToSecurityDescriptorW/);
  assert.doesNotMatch(source, /CreateProcess|WinExec|ShellExecute|system\s*\(/);
});

test('Windows native private key helper does not create a non-test key', () => {
  const bridge = createWindowsPrivateKeyAclBridge({ platform: 'win32' });
  assert.throws(
    () => bridge.createSecureTestPrivateKey('C:\\fake\\private-key.pkcs8.pem',
      Buffer.from('private-key-bytes'), { testOnly: false }),
    /test-only/
  );
});
