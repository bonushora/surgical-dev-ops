'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createFilesystemDurabilityAdapter
} = require('../../accelerator/adapters/filesystem-durability-adapter');

function fakePort(events, failure = null) {
  return {
    fsyncSync(fd) {
      events.push(`fsync:${fd}`);
      if (failure === 'fsync') throw new Error('injected fsync failure');
    },
    openSync(directory) {
      events.push(`open:${directory}`);
      if (failure === 'open') throw new Error('injected open failure');
      return 41;
    },
    closeSync(fd) { events.push(`close:${fd}`); }
  };
}

function fakeWindowsBridge(events, available = true, failure = false) {
  return Object.freeze({
    available() { return available; },
    flushDirectory(directory) {
      events.push(`winflush:${directory}`);
      if (failure) throw new Error('injected native directory flush failure');
      return Object.freeze({
        schema: 'sdo.windows_native_durability_helper.v1',
        decision: 'CONFIRMED',
        operation: 'FLUSH_DIRECTORY',
        primitive: 'CreateFileW+FlushFileBuffers',
        volumeSerialNumber: 1,
        fileIndex: '2',
        subject: directory
      });
    }
  });
}

test('supported adapter exposes immutable explicit capabilities without power-loss claim', () => {
  const adapter = createFilesystemDurabilityAdapter({ platform: 'linux', fsPort: fakePort([]) });
  assert.ok(Object.isFrozen(adapter));
  assert.ok(Object.isFrozen(adapter.capabilities));
  assert.equal(adapter.capabilities.supported, true);
  assert.equal(adapter.capabilities.powerLossValidated, false);
});

test('file data flush uses the platform file descriptor and returns immutable evidence', () => {
  const events = [];
  const adapter = createFilesystemDurabilityAdapter({ platform: 'linux', fsPort: fakePort(events) });
  const result = adapter.flushFile(7, 'temporary replacement');
  assert.deepEqual(events, ['fsync:7']);
  assert.ok(Object.isFrozen(result));
  assert.equal(result.operation, 'FLUSH_FILE_DATA');
});

test('POSIX directory, rename, journal, finalization and lock boundaries fsync their directory', () => {
  const events = [];
  const adapter = createFilesystemDurabilityAdapter({ platform: 'darwin', fsPort: fakePort(events) });
  assert.equal(adapter.flushDirectory('/trusted').operation, 'FLUSH_DIRECTORY');
  assert.equal(adapter.confirmRename('/trusted').operation, 'DURABLE_RENAME_BOUNDARY');
  assert.equal(adapter.confirmJournal('/trusted', false).operation, 'DURABLE_JOURNAL_APPEND');
  assert.equal(adapter.confirmJournal('/trusted', true).operation, 'DURABLE_FINALIZATION');
  assert.equal(adapter.confirmLock('/trusted').operation, 'DURABLE_LOCK_BOUNDARY');
  assert.equal(events.filter((event) => event.startsWith('fsync:')).length, 5);
  assert.equal(events.filter((event) => event.startsWith('close:')).length, 5);
});

test('Windows uses Node file fsync plus qualified native directory flush evidence', () => {
  const events = [];
  const adapter = createFilesystemDurabilityAdapter({
    platform: 'win32',
    fsPort: fakePort(events),
    windowsBridge: fakeWindowsBridge(events)
  });
  assert.equal(adapter.capabilities.supported, true);
  assert.equal(adapter.capabilities.provider, 'NODE_FSYNC_PLUS_WIN32_DIRECTORY_FLUSH_V1');
  assert.equal(adapter.flushFile(9, 'lock-record').operation, 'FLUSH_FILE_DATA');
  const directory = adapter.confirmJournal('C:\\trusted', false);
  assert.equal(directory.operation, 'DURABLE_JOURNAL_APPEND');
  assert.equal(directory.nativeEvidence.primitive, 'CreateFileW+FlushFileBuffers');
  assert.ok(Object.isFrozen(directory.nativeEvidence));
  assert.deepEqual(events, ['fsync:9', 'winflush:C:\\trusted']);
});

test('flush failures propagate and never produce a confirmation receipt', () => {
  const adapter = createFilesystemDurabilityAdapter({
    platform: 'linux', fsPort: fakePort([], 'fsync')
  });
  assert.throws(() => adapter.flushFile(3), /injected fsync failure/);
  assert.throws(() => adapter.confirmRename('/trusted'), /injected fsync failure/);
});

test('POSIX directory descriptor is closed when fsync fails', () => {
  const events = [];
  const adapter = createFilesystemDurabilityAdapter({
    platform: 'linux', fsPort: fakePort(events, 'fsync')
  });
  assert.throws(() => adapter.confirmJournal('/trusted'), /injected fsync failure/);
  assert.deepEqual(events, ['open:/trusted', 'fsync:41', 'close:41']);
});

test('Windows native directory failure propagates and never becomes success', () => {
  const events = [];
  const adapter = createFilesystemDurabilityAdapter({
    platform: 'win32',
    fsPort: fakePort(events),
    windowsBridge: fakeWindowsBridge(events, true, true)
  });
  assert.throws(() => adapter.confirmLock('C:\\trusted'), /native directory flush failure/);
});

test('unsupported platform and missing Windows helper fail closed rather than downgrade', () => {
  const unknown = createFilesystemDurabilityAdapter({ platform: 'aix', fsPort: fakePort([]) });
  assert.equal(unknown.capabilities.supported, false);
  assert.throws(() => unknown.flushFile(3), /UNSUPPORTED/);

  const windows = createFilesystemDurabilityAdapter({
    platform: 'win32', fsPort: fakePort([]), windowsBridge: fakeWindowsBridge([], false)
  });
  assert.equal(windows.capabilities.supported, false);
  assert.throws(() => windows.flushFile(3), /UNSUPPORTED/);
  assert.throws(() => windows.confirmRename('C:\\trusted'), /UNSUPPORTED/);
});

test('malformed descriptors fail closed before platform invocation', () => {
  const events = [];
  const adapter = createFilesystemDurabilityAdapter({ platform: 'linux', fsPort: fakePort(events) });
  assert.throws(() => adapter.flushFile(-1), /malformed/);
  assert.deepEqual(events, []);
});

test('durability adapter itself introduces no generic process or shell authority', () => {
  const source = require('node:fs').readFileSync(require.resolve(
    '../../accelerator/adapters/filesystem-durability-adapter'), 'utf8');
  assert.doesNotMatch(source, /child_process|execFile|spawn|execSync/);
});
