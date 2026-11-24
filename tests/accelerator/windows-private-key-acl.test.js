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
  assert.deepEqual(fs.readFileSync(target), privatePem);
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
  assert.throws(() => bridge.verifyPrivateKey(target), /failed closed|ACL/);
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
