'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  createAuthoritativeClock,
  classifyClockProgression,
  classifyExpiry
} = require('../../accelerator/core/authoritative-clock');

function observation(wallTime, monotonicNanoseconds = '1000000000', overrides = {}) {
  return Object.freeze({
    schema: 'sdo.system_clock_observation.v1',
    availability: 'AVAILABLE',
    source: 'TEST_CLOCK:DETERMINISTIC',
    wallTime,
    monotonicNanoseconds,
    ...overrides
  });
}

function fakeClock(start = '2026-08-20T12:00:00.000Z', monotonicStart = 1000000000n) {
  let wallMilliseconds = Date.parse(start);
  let monotonicValue = monotonicStart;
  return {
    port: Object.freeze({
      read() {
        return observation(new Date(wallMilliseconds).toISOString(), monotonicValue.toString());
      }
    }),
    advance({ wallMilliseconds: wall = 0, monotonicNanoseconds: monotonic = 0n }) {
      wallMilliseconds += wall;
      monotonicValue += monotonic;
    }
  };
}

test('authoritative reading is canonical, fingerprinted and deeply immutable', () => {
  const fake = fakeClock();
  const reading = createAuthoritativeClock({ port: fake.port }).read();
  assert.equal(reading.wallTime, '2026-08-20T12:00:00.000Z');
  assert.match(reading.fingerprint, /^[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(reading));
});

test('missing or unavailable clock port fails closed', () => {
  assert.throws(() => createAuthoritativeClock(), /required/);
  const clock = createAuthoritativeClock({ port: () => Object.freeze({
    schema: 'sdo.system_clock_observation.v1', availability: 'UNAVAILABLE',
    source: 'TEST_CLOCK', reason: 'unavailable'
  }) });
  assert.throws(() => clock.read(), /unavailable/);
  assert.throws(() => createAuthoritativeClock({ port: () => { throw new Error('down'); } }).read(),
    /unavailable/);
});

test('malformed wall time fails closed', () => {
  const clock = createAuthoritativeClock({ port: () => observation('not-a-time') });
  assert.throws(() => clock.read(), /wall time/);
});

test('malformed monotonic observation fails closed', () => {
  for (const value of ['-1', '1.5', '01', 1, null]) {
    const clock = createAuthoritativeClock({ port: () => observation(
      '2026-08-20T12:00:00.000Z', value
    ) });
    assert.throws(() => clock.read(), /monotonic/);
  }
});

test('normal wall and monotonic progression is allowed', () => {
  const fake = fakeClock();
  const clock = createAuthoritativeClock({ port: fake.port });
  const first = clock.observe();
  fake.advance({ wallMilliseconds: 1000, monotonicNanoseconds: 1000000000n });
  const next = clock.observe(first.reading);
  assert.equal(first.classification, 'INITIAL');
  assert.equal(next.decision, 'ALLOWED');
  assert.equal(next.classification, 'NORMAL_FORWARD');
  assert.ok(Object.isFrozen(next));
});

test('wall-clock rollback is deterministically denied', () => {
  const fake = fakeClock();
  const clock = createAuthoritativeClock({ port: fake.port });
  const first = clock.read();
  fake.advance({ wallMilliseconds: -1, monotonicNanoseconds: 1000000n });
  const result = clock.observe(first);
  assert.equal(result.decision, 'DENIED');
  assert.equal(result.classification, 'WALL_CLOCK_ROLLBACK');
});

test('suspicious forward jump is deterministically denied', () => {
  const fake = fakeClock();
  const clock = createAuthoritativeClock({
    port: fake.port,
    maximumForwardDriftMilliseconds: 1000
  });
  const first = clock.read();
  fake.advance({ wallMilliseconds: 10000, monotonicNanoseconds: 1000000000n });
  const result = clock.observe(first);
  assert.equal(result.decision, 'DENIED');
  assert.equal(result.classification, 'SUSPICIOUS_FORWARD_JUMP');
});

test('non-monotonic and source-changing observations fail closed', () => {
  const firstClock = createAuthoritativeClock({ port: () => observation(
    '2026-08-20T12:00:00.000Z', '1000000000'
  ) });
  const first = firstClock.read();
  const same = firstClock.read();
  assert.equal(classifyClockProgression(first, same).classification, 'NON_MONOTONIC');
  const changed = createAuthoritativeClock({ port: () => observation(
    '2026-08-20T12:00:01.000Z', '2000000000', { source: 'OTHER_CLOCK' }
  ) }).read();
  assert.equal(classifyClockProgression(first, changed).classification, 'AMBIGUOUS_SOURCE');
});

test('before-expiry authoritative time is valid', () => {
  const fake = fakeClock('2026-08-20T12:30:00.000Z');
  const result = createAuthoritativeClock({ port: fake.port }).evaluateExpiry({
    issuedAt: '2026-08-20T12:00:00.000Z', expiresAt: '2026-08-20T13:00:00.000Z'
  });
  assert.equal(result.decision, 'ALLOWED');
  assert.equal(result.classification, 'VALID');
  assert.ok(Object.isFrozen(result));
});

test('exact-expiry authoritative time is expired', () => {
  const fake = fakeClock('2026-08-20T13:00:00.000Z');
  const result = createAuthoritativeClock({ port: fake.port }).evaluateExpiry({
    issuedAt: '2026-08-20T12:00:00.000Z', expiresAt: '2026-08-20T13:00:00.000Z'
  });
  assert.equal(result.decision, 'DENIED');
  assert.equal(result.classification, 'EXPIRED');
});

test('post-expiry authoritative time is expired', () => {
  const fake = fakeClock('2026-08-20T13:00:00.001Z');
  assert.equal(createAuthoritativeClock({ port: fake.port }).evaluateExpiry({
    issuedAt: '2026-08-20T12:00:00.000Z', expiresAt: '2026-08-20T13:00:00.000Z'
  }).classification, 'EXPIRED');
});

test('issued-in-future validity is denied', () => {
  const fake = fakeClock('2026-08-20T11:59:59.999Z');
  assert.equal(createAuthoritativeClock({ port: fake.port }).evaluateExpiry({
    issuedAt: '2026-08-20T12:00:00.000Z', expiresAt: '2026-08-20T13:00:00.000Z'
  }).classification, 'ISSUED_IN_FUTURE');
});

test('invalid expiry bounds fail closed', () => {
  const reading = createAuthoritativeClock({ port: fakeClock().port }).read();
  assert.throws(() => classifyExpiry(reading, {
    issuedAt: 'bad', expiresAt: '2026-08-20T13:00:00.000Z'
  }));
  assert.throws(() => classifyExpiry(reading, {
    issuedAt: '2026-08-20T13:00:00.000Z', expiresAt: '2026-08-20T13:00:00.000Z'
  }), /empty/);
});

test('caller-supplied now cannot become production authority', () => {
  const fake = fakeClock('2026-08-20T12:30:00.000Z');
  const clock = createAuthoritativeClock({ port: fake.port });
  assert.throws(() => clock.evaluateExpiry({
    issuedAt: '2026-08-20T12:00:00.000Z', expiresAt: '2026-08-20T13:00:00.000Z',
    now: '2020-01-01T00:00:00.000Z'
  }), /only issuedAt and expiresAt/);
});

test('deterministic fake clock injection advances wall and monotonic values separately', () => {
  const fake = fakeClock();
  const clock = createAuthoritativeClock({ port: fake.port });
  const first = clock.read();
  fake.advance({ wallMilliseconds: 2500, monotonicNanoseconds: 2000000000n });
  const second = clock.read();
  assert.equal(Date.parse(second.wallTime) - Date.parse(first.wallTime), 2500);
  assert.equal(BigInt(second.monotonicNanoseconds) - BigInt(first.monotonicNanoseconds),
    2000000000n);
});

test('clock integration remains disconnected from lock journal and recovery paths', () => {
  for (const relative of [
    '../../accelerator/adapters/mutation-lock-adapter.js',
    '../../accelerator/adapters/mutation-journal-adapter.js'
  ]) {
    assert.doesNotMatch(fs.readFileSync(path.join(__dirname, relative), 'utf8'),
      /authoritative-clock|system-clock-adapter/);
  }
});
