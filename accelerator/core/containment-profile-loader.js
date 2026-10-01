'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PROFILE_ID = 'BH-SEP-v2.3+BH-SDP-v2.3+BH-CONTAINMENT-v1';
const PROFILE_SCHEMA = 'sdo.containment_profile.v1';
const REPOSITORY_ROOT = path.resolve(__dirname, '../..');
const COMPONENTS = Object.freeze({
  'protocols/v2.3/BH-SEP.md': '0360b145b4f1ba8cb211ffdb16cf5d70d47c7dc55a11395bd2afb9d5241eb4ee',
  'protocols/v2.3/BH-SDP.md': '413b3613c75ce89defae4d49ad0b21d92f56519c14f5b32c8e8e152997887f47',
  'protocols/v2.3/BH-CONTAINMENT.md': '74746a4835d4abf4c0875b17458603d7902eecdeadf7264993ecac18718fa563',
  'protocols/v2.3/BH-CONTAINMENT_EN.md': '1f96e23ce5ed3aec787d75b35dbb7ddb26b9ad27ea2b982d8c329f05cd9d2735',
  'protocols/v2.3/BH-CONTAINMENT-PROFILE.md': '5c65181797fb3b5b7c95f49b1c3e87134e234c139690be60127f2f7b19fe41c2',
  'protocols/v2.3/BH-CONTAINMENT-PROFILE_EN.md': '39441b4cb3331f5ce3ad65dd2385216113b8882b21019c1823b93db43339e661'
});

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
  const components = [];
  for (const [relativePath, expectedSha256] of Object.entries(COMPONENTS)) {
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
    trustedAnchor: 'HOST_RUNTIME_EMBEDDED_SHA256'
  });
}

module.exports = Object.freeze({
  PROFILE_ID,
  PROFILE_SCHEMA,
  COMPONENTS,
  loadContainmentProfile
});
