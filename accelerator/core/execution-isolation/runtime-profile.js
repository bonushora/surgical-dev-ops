'use strict';

const crypto = require('node:crypto');

const RUNTIME_PROFILE_VERSION = 'sdo.execution-isolation/v1';
const MAX_WALL_CLOCK_MS = 5 * 60 * 1000;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const issuedProfiles = new WeakSet();

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
  );
}

function digest(label, value) {
  return crypto.createHash('sha256')
    .update(`${label}\0${JSON.stringify(canonicalize(value))}`, 'utf8')
    .digest('hex');
}

function exactObject(value, keys, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join('\0') !== [...keys].sort().join('\0')) {
    throw new Error(`${name} shape is invalid.`);
  }
}

function boundedInteger(value, name, maximum) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`${name} must be a positive bounded integer.`);
  }
  return value;
}

function createRuntimeProfile(input) {
  exactObject(input, [
    'version', 'backend', 'network', 'filesystem', 'environment', 'process', 'limits'
  ], 'Runtime profile');
  exactObject(input.filesystem, ['workspace', 'hostRoot', 'temporary', 'extraMounts'],
    'Runtime filesystem policy');
  exactObject(input.environment, ['inherit'], 'Runtime environment policy');
  exactObject(input.process, ['shell'], 'Runtime process policy');
  exactObject(input.limits, ['wallClockMs', 'maxStdoutBytes', 'maxStderrBytes'],
    'Runtime limits');

  if (input.version !== RUNTIME_PROFILE_VERSION) throw new Error('Runtime profile version is unsupported.');
  if (input.backend !== 'linux-bwrap') throw new Error('Runtime isolation backend is unsupported.');
  if (input.network !== 'deny') throw new Error('Runtime network access is denied in v1.');
  if (input.filesystem.workspace !== 'rw' || input.filesystem.hostRoot !== 'absent' ||
      input.filesystem.temporary !== 'ephemeral' || !Array.isArray(input.filesystem.extraMounts) ||
      input.filesystem.extraMounts.length !== 0) {
    throw new Error('Runtime filesystem policy is unsupported.');
  }
  if (!Array.isArray(input.environment.inherit) || input.environment.inherit.length !== 0) {
    throw new Error('Ambient environment inheritance is denied.');
  }
  if (input.process.shell !== false) throw new Error('Shell execution is denied.');

  const fields = canonicalize({
    version: input.version,
    backend: input.backend,
    network: input.network,
    filesystem: input.filesystem,
    environment: input.environment,
    process: input.process,
    limits: {
      wallClockMs: boundedInteger(input.limits.wallClockMs, 'wallClockMs', MAX_WALL_CLOCK_MS),
      maxStdoutBytes: boundedInteger(input.limits.maxStdoutBytes, 'maxStdoutBytes', MAX_OUTPUT_BYTES),
      maxStderrBytes: boundedInteger(input.limits.maxStderrBytes, 'maxStderrBytes', MAX_OUTPUT_BYTES)
    }
  });
  const profile = deepFreeze({ ...fields, digest: digest(RUNTIME_PROFILE_VERSION, fields) });
  issuedProfiles.add(profile);
  return profile;
}

function isRuntimeProfile(value) {
  return Boolean(value && issuedProfiles.has(value));
}

module.exports = deepFreeze({
  RUNTIME_PROFILE_VERSION,
  createRuntimeProfile,
  isRuntimeProfile,
  canonicalize,
  digest
});
