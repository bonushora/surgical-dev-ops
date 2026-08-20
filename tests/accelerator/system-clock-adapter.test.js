'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createSystemClockAdapter
} = require('../../accelerator/adapters/system-clock-adapter');
const {
  createAuthoritativeClock
} = require('../../accelerator/core/authoritative-clock');

test('system adapter returns canonical wall and monotonic observations', () => {
  const output = createSystemClockAdapter().read();
  assert.equal(output.schema, 'sdo.system_clock_observation.v1');
  assert.equal(output.availability, 'AVAILABLE');
  assert.equal(new Date(Date.parse(output.wallTime)).toISOString(), output.wallTime);
  assert.match(output.monotonicNanoseconds, /^(0|[1-9][0-9]*)$/);
  assert.match(output.source, /^SYSTEM_CLOCK:/);
});

test('system adapter output and adapter are deeply immutable', () => {
  const adapter = createSystemClockAdapter();
  const output = adapter.read();
  assert.ok(Object.isFrozen(adapter));
  assert.ok(Object.isFrozen(output));
});

test('system adapter observations are consumable only through authoritative core', () => {
  const clock = createAuthoritativeClock({ port: createSystemClockAdapter() });
  const reading = clock.read();
  assert.equal(reading.schema, 'sdo.authoritative_clock_reading.v1');
  assert.match(reading.fingerprint, /^[a-f0-9]{64}$/);
});

test('system wall-clock failure returns explicit immutable unavailability', (t) => {
  t.mock.method(Date, 'now', () => Number.NaN);
  const output = createSystemClockAdapter().read();
  assert.equal(output.availability, 'UNAVAILABLE');
  assert.ok(Object.isFrozen(output));
  assert.match(output.reason, /wall clock/);
});

test('system monotonic-clock failure returns explicit immutable unavailability', (t) => {
  t.mock.method(process.hrtime, 'bigint', () => 'malformed');
  const output = createSystemClockAdapter().read();
  assert.equal(output.availability, 'UNAVAILABLE');
  assert.ok(Object.isFrozen(output));
  assert.match(output.reason, /monotonic clock/);
});
