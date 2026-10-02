'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PROFILE_ID = 'BH-SEP-v2.3+BH-SDP-v2.3+BH-CONTAINMENT-v1';
const PROFILE_SCHEMA = 'sdo.containment_profile.v1';
const REPOSITORY_ROOT = path.resolve(__dirname, '../..');
const MANIFEST_PATH = 'protocols/v2.3/BH-CONTAINMENT-MANIFEST.json';
const MANIFEST_SHA256 = 'c3df0eab9b3f2a43372b77be9674b2eeaf9ce4079640350d824072af030ad53b';
const MINIMUM_GENERATION = 2;

function loadTrustedManifest(root) {
  const candidate = path.join(root, MANIFEST_PATH);
  let status;
  let bytes;
  try {
    status = fs.lstatSync(candidate);
    if (!status.isFile() || status.isSymbolicLink()) {
      throw profileFailure(`${MANIFEST_PATH} is not a regular trusted manifest.`);
    }
    bytes = fs.readFileSync(candidate);
  } catch (error) {
    if (error && error.code === 'CONTAINMENT_PROFILE_INVALID') throw error;
    throw profileFailure(`${MANIFEST_PATH} is missing or unreadable.`);
  }
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  if (digest !== MANIFEST_SHA256) {
    throw profileFailure(`${MANIFEST_PATH} does not match its trusted runtime anchor.`);
  }
  let manifest;
  try { manifest = JSON.parse(bytes.toString('utf8')); }
  catch { throw profileFailure(`${MANIFEST_PATH} is not valid JSON.`); }
  if (!manifest || manifest.schema !== 'sdo.containment_profile_manifest.v2' ||
      manifest.profileId !== PROFILE_ID ||
      !Number.isInteger(manifest.generation) ||
      manifest.generation < MINIMUM_GENERATION ||
      manifest.webSocketPolicy !== 'BLOCKED_BEFORE_UPGRADE' ||
      !manifest.components || typeof manifest.components !== 'object') {
    throw profileFailure(`${MANIFEST_PATH} declares an incompatible or rolled-back profile.`);
  }
  return manifest;
}

const COMPONENTS = Object.freeze(loadTrustedManifest(REPOSITORY_ROOT).components);

function profileFailure(reason) {
  const error = new Error(`CONTAINMENT_PROFILE_INVALID: ${reason}`);
  error.code = 'CONTAINMENT_PROFILE_INVALID';
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function loadContainmentProfile({ repositoryRoot = REPOSITORY_ROOT } = {}) {
  const root = fs.realpathSync(repositoryRoot);
  const manifest = loadTrustedManifest(root);
  const components = [];
  for (const [relativePath, expectedSha256] of Object.entries(manifest.components)) {
    const candidate = path.join(root, relativePath);
    let status;
    let bytes;
    try {
      status = fs.lstatSync(candidate);
      if (!status.isFile() || status.isSymbolicLink()) {
        throw profileFailure(`${relativePath} is not a regular trusted component.`);
      }
      bytes = fs.readFileSync(candidate);
    } catch (error) {
      if (error && error.code === 'CONTAINMENT_PROFILE_INVALID') throw error;
      throw profileFailure(`${relativePath} is missing or unreadable.`);
    }
    const observedSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    if (observedSha256 !== expectedSha256) {
      throw profileFailure(`${relativePath} does not match its trusted runtime anchor.`);
    }
    const text = bytes.toString('utf8');
    if (!text.includes(PROFILE_ID) && relativePath.includes('CONTAINMENT')) {
      throw profileFailure(`${relativePath} declares an incompatible profile version.`);
    }
    components.push(deepFreeze({ path: relativePath, sha256: observedSha256 }));
  }
  return deepFreeze({
    schema: PROFILE_SCHEMA,
    profileId: PROFILE_ID,
    state: 'VERIFIED',
    components,
    legacyRawIncludesContainment: false,
    createsAuthority: false,
    trustedAnchor: 'HOST_RUNTIME_EMBEDDED_MANIFEST_SHA256',
    manifest: deepFreeze({
      path: MANIFEST_PATH,
      sha256: MANIFEST_SHA256,
      generation: manifest.generation,
      minimumRuntime: manifest.minimumRuntime,
      webSocketPolicy: manifest.webSocketPolicy,
      qualificationClaims: manifest.qualificationClaims
    })
  });
}

module.exports = Object.freeze({
  PROFILE_ID,
  PROFILE_SCHEMA,
  MANIFEST_PATH,
  MANIFEST_SHA256,
  MINIMUM_GENERATION,
  COMPONENTS,
  loadContainmentProfile
});
