'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  createWindowsNativeDurabilityBridge
} = require('../../accelerator/adapters/windows-native-durability-bridge');

function fakeFs() {
  return {
    statSync() { return { isFile: () => true }; },
    realpathSync(value) { return path.win32.normalize(value); },
    lstatSync() {
      return { isDirectory: () => true, isSymbolicLink: () => false };
    }
  };
}

fakeFs.prototype = null;

function evidence(subject) {
  return JSON.stringify({
    schema: 'sdo.windows_native_durability_helper.v1',
    decision: 'CONFIRMED',
    operation: 'FLUSH_DIRECTORY',
    primitive: 'CreateFileW+FlushFileBuffers',
    volumeSerialNumber: 123,
    fileIndex: '456',
    subject
  });
}

test('Windows bridge exposes only fixed helper-backed directory durability', () => {
  const calls = [];
  const fsPort = fakeFs();
  const processPort = {
    spawnSync(executable, args, options) {
      calls.push({ executable, args, options });
      return { status: 0, signal: null, stdout: evidence('C:\\trusted'), stderr: '' };
    }
  };
  const bridge = createWindowsNativeDurabilityBridge({
    platform: 'win32', fsPort, processPort
  });
  assert.equal(bridge.available(), true);
  const result = bridge.flushDirectory('C:\\trusted');
  assert.equal(result.decision, 'CONFIRMED');
  assert.ok(Object.isFrozen(result));
  assert.equal(calls.length, 1);
  assert.match(calls[0].executable, /sdo-fs-durability\.exe$/);
  assert.deepEqual(calls[0].args, ['flush-directory', 'C:\\trusted']);
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].options.stdio[0], 'ignore');
});

test('Windows bridge fails closed on malformed or unbound helper evidence', () => {
  const fsPort = fakeFs();
  const bridge = createWindowsNativeDurabilityBridge({
    platform: 'win32',
    fsPort,
    processPort: {
      spawnSync() {
        return { status: 0, signal: null, stdout: '{"decision":"CONFIRMED"}', stderr: '' };
      }
    }
  });
  assert.throws(() => bridge.flushDirectory('C:\\trusted'), /evidence/);
});

test('Windows bridge fails closed when helper is absent or platform is not Windows', () => {
  const absentFs = {
    statSync() { throw new Error('missing'); },
    realpathSync(value) { return value; },
    lstatSync() { return { isDirectory: () => true, isSymbolicLink: () => false }; }
  };
  const win = createWindowsNativeDurabilityBridge({
    platform: 'win32', fsPort: absentFs,
    helperPath: 'C:\\sdo\\sdo-fs-durability.exe'
  });
  assert.equal(win.available(), false);
  assert.throws(() => win.flushDirectory('C:\\trusted'), /unavailable/);

  const linux = createWindowsNativeDurabilityBridge({ platform: 'linux' });
  assert.equal(linux.available(), false);
  assert.throws(() => linux.flushDirectory('C:\\trusted'), /unavailable on linux/);
});

test('bridge source fixes executable identity and never enables shell execution', () => {
  const source = require('node:fs').readFileSync(require.resolve(
    '../../accelerator/adapters/windows-native-durability-bridge'), 'utf8');
  assert.match(source, /sdo-fs-durability\.exe/);
  assert.match(source, /\['flush-directory', physicalDirectory\]/);
  assert.match(source, /shell: false/);
  assert.doesNotMatch(source, /execSync|execFileSync|shell:\s*true/);
});
