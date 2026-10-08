'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  canonicalizeAuthorizedRoot
} = require('../workspace-boundary');
const { canonicalize, digest, isRuntimeProfile } = require('./runtime-profile');

const ENVIRONMENT_ALLOWLIST = new Set(['LANG', 'LC_ALL', 'TZ', 'NODE_NO_WARNINGS']);
const FINGERPRINT = /^[a-f0-9]{64}$/;
const issuedEnvelopes = new WeakSet();

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactObject(value, keys, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join('\0') !== [...keys].sort().join('\0')) {
    throw new Error(`${name} shape is invalid.`);
  }
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

function fingerprint(value, name) {
  const result = text(value, name);
  if (!FINGERPRINT.test(result)) throw new Error(`${name} is malformed.`);
  return result;
}

function normalizeEnvironment(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('explicitEnvironment must be an object.');
  }
  const output = {};
  for (const key of Object.keys(input).sort()) {
    if (!ENVIRONMENT_ALLOWLIST.has(key) || typeof input[key] !== 'string' ||
        input[key].length > 4096 || input[key].includes('\0')) {
      throw new Error(`Explicit environment key is not allowed: ${key}`);
    }
    output[key] = input[key];
  }
  return output;
}

function resolveWorkspace(input) {
  const lexical = path.resolve(text(input, 'authorizedWorkspacePhysicalRoot'));
  const physical = canonicalizeAuthorizedRoot(lexical);
  if (lexical !== physical || fs.lstatSync(lexical).isSymbolicLink()) {
    throw new Error('Authorized workspace must be an exact physical directory.');
  }
  return physical;
}

function resolveCwd(workspace, input) {
  const requested = text(input, 'cwd');
  const lexical = path.resolve(workspace, requested);
  let physical;
  try { physical = fs.realpathSync(lexical); } catch {
    throw new Error('cwd cannot be physically resolved.');
  }
  const relative = path.relative(workspace, physical);
  if (lexical !== physical || (relative !== '' &&
      (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))) ||
      !fs.statSync(physical).isDirectory()) {
    throw new Error('cwd must resolve physically within the authorized workspace.');
  }
  return relative || '.';
}

function normalizeArgv(input) {
  if (!Array.isArray(input) || input.length === 0 || input.some((item) =>
    typeof item !== 'string' || item.length === 0 || item.includes('\0'))) {
    throw new Error('argv must be a non-empty array of strings.');
  }
  if (!path.isAbsolute(input[0])) throw new Error('argv executable must be an absolute path.');
  return [...input];
}

function createExecutionEnvelope(input) {
  exactObject(input, [
    'runtimeProfile', 'authorizedWorkspacePhysicalRoot', 'repositoryIdentity',
    'authorityFingerprint', 'operationFingerprint', 'argv', 'cwd', 'explicitEnvironment'
  ], 'Execution envelope');
  const profile = input.runtimeProfile;
  if (!isRuntimeProfile(profile)) {
    throw new Error('A normalized immutable runtime profile is required.');
  }
  const workspace = resolveWorkspace(input.authorizedWorkspacePhysicalRoot);
  const fields = canonicalize({
    schema: 'sdo.execution-envelope/v1',
    runtimeProfile: profile,
    authorizedWorkspacePhysicalRoot: workspace,
    repositoryIdentity: text(input.repositoryIdentity, 'repositoryIdentity'),
    authorityFingerprint: fingerprint(input.authorityFingerprint, 'authorityFingerprint'),
    operationFingerprint: fingerprint(input.operationFingerprint, 'operationFingerprint'),
    argv: normalizeArgv(input.argv),
    cwd: resolveCwd(workspace, input.cwd),
    explicitEnvironment: normalizeEnvironment(input.explicitEnvironment)
  });
  const envelope = deepFreeze({ ...fields, digest: digest('sdo.execution-envelope/v1', fields) });
  issuedEnvelopes.add(envelope);
  return envelope;
}

function isExecutionEnvelope(value) {
  return Boolean(value && issuedEnvelopes.has(value));
}

module.exports = deepFreeze({
  createExecutionEnvelope,
  isExecutionEnvelope,
  ENVIRONMENT_ALLOWLIST
});
