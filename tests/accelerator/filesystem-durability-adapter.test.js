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

test('supported adapter exposes immutable explicit capabilities without power-loss claim', () => {
  const adapter = createFilesystemDurabilityAdapter({ platform: 'linux', fsPort: fakePort([]) });
  assert.ok(Object.isFrozen(adapter));
  assert.ok(Object.isFrozen(adapter.capabilities));
  assert.equal(adapter.capabilities.supported, true);
  assert.equal(adapter.capabilities.powerLossValidated, false);
});

test('file data flush uses the platform port and returns immutable evidence', () => {
  const events = [];
  const adapter = createFilesystemDurabilityAdapter({ platform: 'linux', fsPort: fakePort(events) });
  const result = adapter.flushFile(7, 'temporary replacement');
  assert.deepEqual(events, ['fsync:7']);
  assert.ok(Object.isFrozen(result));
  assert.equal(result.operation, 'FLUSH_FILE_DATA');
});

test('directory, rename, journal, finalization and lock boundaries flush their directory', () => {
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

test('flush failures propagate and never produce a confirmation receipt', () => {
  const adapter = createFilesystemDurabilityAdapter({
    platform: 'linux', fsPort: fakePort([], 'fsync')
  });
  assert.throws(() => adapter.flushFile(3), /injected fsync failure/);
  assert.throws(() => adapter.confirmRename('/trusted'), /injected fsync failure/);
});

test('directory descriptor is closed when fsync fails', () => {
  const events = [];
  const adapter = createFilesystemDurabilityAdapter({
    platform: 'linux', fsPort: fakePort(events, 'fsync')
  });
  assert.throws(() => adapter.confirmJournal('/trusted'), /injected fsync failure/);
  assert.deepEqual(events, ['open:/trusted', 'fsync:41', 'close:41']);
});

test('unsupported platform fails closed rather than silently downgrading', () => {
  const adapter = createFilesystemDurabilityAdapter({ platform: 'win32', fsPort: fakePort([]) });
  assert.equal(adapter.capabilities.supported, false);
  assert.equal(adapter.capabilities.powerLossValidated, false);
  assert.throws(() => adapter.flushFile(3), /UNSUPPORTED/);
  assert.throws(() => adapter.confirmRename('C:\\trusted'), /UNSUPPORTED/);
});

test('malformed descriptors fail closed before platform invocation', () => {
  const events = [];
  const adapter = createFilesystemDurabilityAdapter({ platform: 'linux', fsPort: fakePort(events) });
  assert.throws(() => adapter.flushFile(-1), /malformed/);
  assert.deepEqual(events, []);
});

test('platform integration hooks are explicit and never use shell fallback', () => {
  for (const platform of ['linux', 'darwin', 'win32']) {
    const adapter = createFilesystemDurabilityAdapter({ platform, fsPort: fakePort([]) });
    assert.equal(adapter.capabilities.platform, platform);
  }
  const source = require('node:fs').readFileSync(require.resolve(
    '../../accelerator/adapters/filesystem-durability-adapter'), 'utf8');
  assert.doesNotMatch(source, /child_process|execFile|spawn|execSync/);
});
