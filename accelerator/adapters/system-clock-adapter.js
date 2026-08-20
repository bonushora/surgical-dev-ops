'use strict';

const os = require('node:os');

const SCHEMA = 'sdo.system_clock_observation.v1';
const SOURCE = `SYSTEM_CLOCK:${process.platform}:${os.arch()}:WALL_MONOTONIC`;

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function unavailable(reason) {
  return deepFreeze({
    schema: SCHEMA,
    availability: 'UNAVAILABLE',
    source: SOURCE,
    reason
  });
}

function readSystemClock() {
  try {
    const wallMilliseconds = Date.now();
    if (!Number.isFinite(wallMilliseconds)) {
      return unavailable('System wall clock returned a malformed value.');
    }
    const wallTime = new Date(wallMilliseconds).toISOString();
    if (!process.hrtime || typeof process.hrtime.bigint !== 'function') {
      return unavailable('System monotonic clock is unavailable.');
    }
    const monotonicValue = process.hrtime.bigint();
    if (typeof monotonicValue !== 'bigint' || monotonicValue < 0n) {
      return unavailable('System monotonic clock returned a malformed value.');
    }
    return deepFreeze({
      schema: SCHEMA,
      availability: 'AVAILABLE',
      source: SOURCE,
      wallTime,
      monotonicNanoseconds: monotonicValue.toString()
    });
  } catch {
    return unavailable('System clock observation failed closed.');
  }
}

function createSystemClockAdapter() {
  return deepFreeze({ read: readSystemClock });
}

module.exports = { createSystemClockAdapter };
