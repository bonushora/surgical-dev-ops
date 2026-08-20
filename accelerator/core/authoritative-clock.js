'use strict';

const crypto = require('node:crypto');

const READING_SCHEMA = 'sdo.authoritative_clock_reading.v1';
const OBSERVATION_SCHEMA = 'sdo.system_clock_observation.v1';
const DECIMAL = /^(0|[1-9][0-9]*)$/;

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(fields) {
  return crypto.createHash('sha256')
    .update(`sdo.authoritative_clock_reading.v1\0${canonicalJson(fields)}`).digest('hex');
}

function canonicalTimestamp(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} is malformed.`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO timestamp.`);
  }
  return value;
}

function monotonic(value) {
  if (typeof value !== 'string' || !DECIMAL.test(value)) {
    throw new Error('Authoritative monotonic observation is malformed.');
  }
  return value;
}

function sourceIdentity(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:+/-]{0,255}$/.test(value)) {
    throw new Error('Authoritative clock source identity is malformed.');
  }
  return value;
}

function normalizeReading(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      raw.schema !== OBSERVATION_SCHEMA || raw.availability !== 'AVAILABLE') {
    throw new Error('Authoritative clock is unavailable or returned malformed evidence.');
  }
  const fields = {
    schema: READING_SCHEMA,
    source: sourceIdentity(raw.source),
    wallTime: canonicalTimestamp(raw.wallTime, 'Authoritative wall time'),
    monotonicNanoseconds: monotonic(raw.monotonicNanoseconds)
  };
  return deepFreeze({ ...fields, fingerprint: fingerprint(fields) });
}

function validateReading(reading) {
  if (!reading || typeof reading !== 'object' || Array.isArray(reading) ||
      reading.schema !== READING_SCHEMA || !Object.isFrozen(reading)) {
    throw new Error('Authoritative clock reading is missing or mutable.');
  }
  const fields = {
    schema: READING_SCHEMA,
    source: sourceIdentity(reading.source),
    wallTime: canonicalTimestamp(reading.wallTime, 'Authoritative wall time'),
    monotonicNanoseconds: monotonic(reading.monotonicNanoseconds)
  };
  if (reading.fingerprint !== fingerprint(fields) || Object.keys(reading).length !== 5) {
    throw new Error('Authoritative clock reading integrity is invalid.');
  }
  return reading;
}

function denied(classification, reason, reading) {
  return deepFreeze({
    schema: 'sdo.authoritative_clock_progression.v1',
    decision: 'DENIED', classification, reason, reading
  });
}

function classifyClockProgression(previous, current, {
  maximumForwardDriftMilliseconds = 1000,
  maximumBackwardDriftMilliseconds = 0
} = {}) {
  const before = validateReading(previous);
  const after = validateReading(current);
  if (!Number.isFinite(maximumForwardDriftMilliseconds) ||
      maximumForwardDriftMilliseconds < 0 ||
      !Number.isFinite(maximumBackwardDriftMilliseconds) ||
      maximumBackwardDriftMilliseconds < 0) {
    throw new Error('Clock anomaly thresholds are malformed.');
  }
  if (before.source !== after.source) {
    return denied('AMBIGUOUS_SOURCE', 'Authoritative clock source changed.', after);
  }
  const monotonicDelta = BigInt(after.monotonicNanoseconds) -
    BigInt(before.monotonicNanoseconds);
  if (monotonicDelta <= 0n) {
    return denied('NON_MONOTONIC', 'Monotonic clock did not progress.', after);
  }
  const wallDelta = Date.parse(after.wallTime) - Date.parse(before.wallTime);
  const monotonicMilliseconds = Number(monotonicDelta / 1000000n);
  const drift = wallDelta - monotonicMilliseconds;
  if (wallDelta < 0 || drift < -maximumBackwardDriftMilliseconds) {
    return denied('WALL_CLOCK_ROLLBACK', 'Authoritative wall clock moved backward.', after);
  }
  if (drift > maximumForwardDriftMilliseconds) {
    return denied('SUSPICIOUS_FORWARD_JUMP',
      'Authoritative wall clock advanced beyond permitted monotonic drift.', after);
  }
  return deepFreeze({
    schema: 'sdo.authoritative_clock_progression.v1',
    decision: 'ALLOWED', classification: 'NORMAL_FORWARD',
    reason: 'Wall and monotonic clocks progressed consistently.', reading: after
  });
}

function classifyExpiry(reading, { issuedAt, expiresAt } = {}) {
  const now = validateReading(reading);
  const issued = canonicalTimestamp(issuedAt, 'issuedAt');
  const expires = canonicalTimestamp(expiresAt, 'expiresAt');
  const issuedMilliseconds = Date.parse(issued);
  const expiresMilliseconds = Date.parse(expires);
  if (issuedMilliseconds >= expiresMilliseconds) {
    throw new Error('Expiry interval is malformed or empty.');
  }
  const nowMilliseconds = Date.parse(now.wallTime);
  let classification;
  let decision;
  if (nowMilliseconds < issuedMilliseconds) {
    classification = 'ISSUED_IN_FUTURE';
    decision = 'DENIED';
  } else if (nowMilliseconds >= expiresMilliseconds) {
    classification = 'EXPIRED';
    decision = 'DENIED';
  } else {
    classification = 'VALID';
    decision = 'ALLOWED';
  }
  return deepFreeze({
    schema: 'sdo.authoritative_expiry_evaluation.v1',
    decision,
    classification,
    valid: decision === 'ALLOWED',
    authoritativeNow: now.wallTime,
    issuedAt: issued,
    expiresAt: expires,
    clockFingerprint: now.fingerprint
  });
}

function authorityBound(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== 3 ||
      !/^[a-f0-9]{64}$/.test(value.fingerprint || '')) {
    throw new Error(`${label} authority validity bound is malformed.`);
  }
  return deepFreeze({
    issuedAt: canonicalTimestamp(value.issuedAt, `${label}.issuedAt`),
    expiresAt: canonicalTimestamp(value.expiresAt, `${label}.expiresAt`),
    fingerprint: value.fingerprint
  });
}

function classifyMutationAuthority(reading, bounds, progression = null) {
  const now = validateReading(reading);
  if (!bounds || typeof bounds !== 'object' || Array.isArray(bounds) ||
      Object.keys(bounds).length !== 3) {
    throw new Error('Mutation authority validity bounds are malformed.');
  }
  const normalizedBounds = deepFreeze({
    identity: authorityBound(bounds.identity, 'identity'),
    approval: authorityBound(bounds.approval, 'approval'),
    grant: authorityBound(bounds.grant, 'grant')
  });
  const normalizedProgression = progression === null ? deepFreeze({
    schema: 'sdo.authoritative_clock_progression.v1',
    decision: 'ALLOWED', classification: 'INITIAL',
    reason: 'Initial authoritative clock observation.', reading: now
  }) : progression;
  if (!normalizedProgression || !Object.isFrozen(normalizedProgression) ||
      normalizedProgression.reading !== now ||
      !['ALLOWED', 'DENIED'].includes(normalizedProgression.decision)) {
    throw new Error('Authoritative clock progression evidence is malformed.');
  }
  const evaluations = deepFreeze({
    identity: classifyExpiry(now, normalizedBounds.identity),
    approval: classifyExpiry(now, normalizedBounds.approval),
    grant: classifyExpiry(now, normalizedBounds.grant)
  });
  const allowed = normalizedProgression.decision === 'ALLOWED' &&
    Object.values(evaluations).every((evaluation) => evaluation.decision === 'ALLOWED');
  const fields = {
    schema: 'sdo.mutation_authority_time_evidence.v1',
    decision: allowed ? 'ALLOWED' : 'DENIED',
    reading: now,
    progression: normalizedProgression,
    bounds: normalizedBounds,
    evaluations
  };
  return deepFreeze({ ...fields, fingerprint: crypto.createHash('sha256')
    .update(`sdo.mutation_authority_time_evidence.v1\0${canonicalJson(fields)}`).digest('hex') });
}

function evaluateMutationAuthority(authoritativeClock, bounds, previousReading = null) {
  if (!authoritativeClock || typeof authoritativeClock.observe !== 'function') {
    throw new Error('Authoritative clock is required for mutation authority evaluation.');
  }
  const progression = authoritativeClock.observe(previousReading);
  return classifyMutationAuthority(progression.reading, bounds, progression);
}

function createAuthoritativeClock({
  port,
  maximumForwardDriftMilliseconds = 1000,
  maximumBackwardDriftMilliseconds = 0
} = {}) {
  const readPort = typeof port === 'function' ? port
    : port && typeof port.read === 'function' ? port.read.bind(port) : null;
  if (!readPort) throw new Error('An authoritative clock port is required.');

  function read() {
    let raw;
    try { raw = readPort(); } catch {
      throw new Error('Authoritative clock is unavailable.');
    }
    return normalizeReading(raw);
  }

  function observe(previous = null) {
    const reading = read();
    if (previous === null) {
      return deepFreeze({
        schema: 'sdo.authoritative_clock_progression.v1',
        decision: 'ALLOWED', classification: 'INITIAL',
        reason: 'Initial authoritative clock observation.', reading
      });
    }
    return classifyClockProgression(previous, reading, {
      maximumForwardDriftMilliseconds,
      maximumBackwardDriftMilliseconds
    });
  }

  function evaluateExpiry(validity) {
    if (!validity || typeof validity !== 'object' || Array.isArray(validity) ||
        Object.keys(validity).length !== 2 ||
        !Object.prototype.hasOwnProperty.call(validity, 'issuedAt') ||
        !Object.prototype.hasOwnProperty.call(validity, 'expiresAt')) {
      throw new Error('Expiry evaluation accepts only issuedAt and expiresAt bounds.');
    }
    return classifyExpiry(read(), validity);
  }

  return deepFreeze({ read, observe, evaluateExpiry });
}

module.exports = {
  createAuthoritativeClock,
  classifyClockProgression,
  classifyExpiry,
  classifyMutationAuthority,
  evaluateMutationAuthority
};
