'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  createWindowsNativeDurabilityBridge
} = require('../../accelerator/adapters/windows-native-durability-bridge');

test('qualified Windows helper flushes an actual directory through a fixed Win32 primitive', (t) => {
  if (process.platform !== 'win32') {
    return t.skip('Windows-only native durability qualification.');
  }
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-win-durability-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));

  const bridge = createWindowsNativeDurabilityBridge();
  assert.equal(bridge.available(), true);
  const evidence = bridge.flushDirectory(base);
  assert.equal(evidence.schema, 'sdo.windows_native_durability_helper.v1');
  assert.equal(evidence.decision, 'CONFIRMED');
  assert.equal(evidence.operation, 'FLUSH_DIRECTORY');
  assert.equal(evidence.primitive, 'CreateFileW+FlushFileBuffers');
  assert.ok(Object.isFrozen(evidence));
});

test('native helper source is bounded to fixed filesystem primitives and has no process authority', () => {
  const source = fs.readFileSync(path.join(
    __dirname, '..', '..', 'accelerator', 'native', 'windows', 'sdo-fs-durability.cpp'
  ), 'utf8');
  assert.match(source, /CreateFileW/);
  assert.match(source, /FlushFileBuffers/);
  assert.match(source, /FILE_FLAG_BACKUP_SEMANTICS/);
  assert.match(source, /FILE_FLAG_OPEN_REPARSE_POINT/);
  assert.doesNotMatch(source, /CreateProcess|WinExec|ShellExecute|system\s*\(/);
  assert.equal((source.match(/flush-directory/g) || []).length, 1);
});
