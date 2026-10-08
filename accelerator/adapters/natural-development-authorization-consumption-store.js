'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  CLAIM_SCHEMA,
  COMMIT_SCHEMA,
  validateNaturalDevelopmentAuthorizationClaim,
  validateNaturalDevelopmentAuthorizationConsumption
} = require(
  '../cli/natural-development-authorization-consumption'
);

const MAX_RECORD_BYTES = 256 * 1024;

const READ_PURPOSE = Object.freeze({
  CURRENT_AUTHORITY: 'CURRENT_AUTHORITY',
  HISTORICAL_RECONCILIATION: 'HISTORICAL_RECONCILIATION'
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalRoot(root) {
  if (
    typeof root !== 'string' ||
    !path.isAbsolute(root) ||
    path.normalize(root) !== root
  ) {
    throw new Error(
      'Canonical absolute G7 authorization store root is required.'
    );
  }

  fs.mkdirSync(root, { recursive: true, mode: 0o700 });

  const stat = fs.lstatSync(root);

  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(
      'G7 authorization store root is unsafe.'
    );
  }

  return fs.realpathSync(root);
}

function recordPath(root, authorizationFingerprint) {
  if (!/^[a-f0-9]{64}$/.test(authorizationFingerprint || '')) {
    throw new Error(
      'Canonical authorization fingerprint is required.'
    );
  }

  return path.join(
    canonicalRoot(root),
    `${authorizationFingerprint}.json`
  );
}

function hydrate(raw) {
  if (
    !raw ||
    (
      raw.schema !== CLAIM_SCHEMA &&
      raw.schema !== COMMIT_SCHEMA
    )
  ) {
    throw new Error(
      'Persisted G7 authorization record is malformed.'
    );
  }

  const value = deepFreeze(raw);

  if (value.schema === CLAIM_SCHEMA) {
    return validateNaturalDevelopmentAuthorizationClaim(value);
  }

  return validateNaturalDevelopmentAuthorizationConsumption(value);
}

function readRecord(target, authorizationFingerprint) {
  const stat = fs.lstatSync(target);

  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size > MAX_RECORD_BYTES
  ) {
    throw new Error(
      'Persisted G7 authorization record is unsafe.'
    );
  }

  const record = hydrate(
    JSON.parse(
      fs.readFileSync(target, 'utf8')
    )
  );

  if (
    record.authorizationFingerprint !==
      authorizationFingerprint
  ) {
    throw new Error(
      'Persisted G7 authorization record does not match its requested storage position.'
    );
  }

  return record;
}

function requireReadContext({
  readPurpose,
  expectedPhysicalWorkspaceIdentity
}) {
  if (
    readPurpose !== READ_PURPOSE.CURRENT_AUTHORITY &&
    readPurpose !== READ_PURPOSE.HISTORICAL_RECONCILIATION
  ) {
    throw new Error(
      'Explicit G7 authorization record read purpose is required.'
    );
  }

  if (
    readPurpose === READ_PURPOSE.CURRENT_AUTHORITY &&
    !/^[a-f0-9]{64}$/.test(
      expectedPhysicalWorkspaceIdentity || ''
    )
  ) {
    throw new Error(
      'Current-authority G7 read requires the expected physical workspace identity.'
    );
  }
}

function serialize(value) {
  const data =
    JSON.stringify(value, null, 2) + '\n';

  if (Buffer.byteLength(data) > MAX_RECORD_BYTES) {
    throw new Error(
      'G7 authorization record size bound exceeded.'
    );
  }

  return data;
}

function fsyncFile(descriptor) {
  fs.fsyncSync(descriptor);
}

function writeExclusive(target, value) {
  const descriptor =
    fs.openSync(target, 'wx', 0o600);

  try {
    fs.writeFileSync(
      descriptor,
      serialize(value),
      'utf8'
    );
    fsyncFile(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function replaceAtomically(target, value) {
  const directory = path.dirname(target);
  const temporary =
    path.join(
      directory,
      `.g7-${process.pid}-${crypto.randomUUID()}.tmp`
    );

  const descriptor =
    fs.openSync(temporary, 'wx', 0o600);

  try {
    fs.writeFileSync(
      descriptor,
      serialize(value),
      'utf8'
    );
    fsyncFile(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }

  try {
    fs.renameSync(temporary, target);
  } catch (error) {
    try {
      fs.unlinkSync(temporary);
    } catch {}
    throw error;
  }
}

function claimNaturalDevelopmentAuthorization({
  stateRoot,
  claim
} = {}) {
  validateNaturalDevelopmentAuthorizationClaim(claim);

  const target =
    recordPath(
      stateRoot,
      claim.authorizationFingerprint
    );

  if (fs.existsSync(target)) {
    const existing = readRecord(
      target,
      claim.authorizationFingerprint
    );

    throw new Error(
      existing.schema === COMMIT_SCHEMA
        ? 'G4 authorization was already durably consumed; replay denied.'
        : 'G4 authorization already has a durable claim; replay denied.'
    );
  }

  try {
    writeExclusive(target, claim);
  } catch (error) {
    if (
      error &&
      error.code === 'EEXIST'
    ) {
      throw new Error(
        'Concurrent G4 authorization replay was denied.'
      );
    }
    throw error;
  }

  const persisted =
    readRecord(
      target,
      claim.authorizationFingerprint
    );

  if (
    persisted.schema !== CLAIM_SCHEMA ||
    persisted.claimFingerprint !==
      claim.claimFingerprint
  ) {
    throw new Error(
      'Durable G7 claim could not be confirmed.'
    );
  }

  return Object.freeze({
    schema:
      'sdo.natural_development_authorization_claim_receipt.v1',
    authorizationFingerprint:
      claim.authorizationFingerprint,
    claimFingerprint:
      claim.claimFingerprint,
    state: 'CLAIMED',
    reusable: false,
    operationalAuthority: false,
    mutationAuthority: false,
    dispatchAuthority: false
  });
}

function commitNaturalDevelopmentAuthorization({
  stateRoot,
  consumption
} = {}) {
  validateNaturalDevelopmentAuthorizationConsumption(
    consumption
  );

  const target =
    recordPath(
      stateRoot,
      consumption.authorizationFingerprint
    );

  if (!fs.existsSync(target)) {
    throw new Error(
      'Durable G7 claim is required before consumption commit.'
    );
  }

  const current =
    readRecord(
      target,
      consumption.authorizationFingerprint
    );

  if (current.schema === COMMIT_SCHEMA) {
    if (
      current.consumptionFingerprint ===
        consumption.consumptionFingerprint
    ) {
      return Object.freeze({
        schema:
          'sdo.natural_development_authorization_consumption_receipt.v1',
        authorizationFingerprint:
          current.authorizationFingerprint,
        consumptionFingerprint:
          current.consumptionFingerprint,
        state: 'CONSUMED',
        replay: 'IDEMPOTENT_READ_ONLY',
        operationalAuthority: false,
        mutationAuthority: false,
        dispatchAuthority: false
      });
    }

    throw new Error(
      'Conflicting G7 authorization consumption replay was denied.'
    );
  }

  if (
    current.claimFingerprint !==
      consumption.claimFingerprint ||
    current.authorizationFingerprint !==
      consumption.authorizationFingerprint ||
    current.operationId !==
      consumption.operationId ||
    current.physicalWorkspaceIdentity !==
      consumption.physicalWorkspaceIdentity ||
    current.target !== consumption.target ||
    current.beforeSha256 !==
      consumption.beforeSha256 ||
    current.replacementSha256 !==
      consumption.replacementSha256
  ) {
    throw new Error(
      'G7 consumption does not match its exact durable claim.'
    );
  }

  replaceAtomically(
    target,
    consumption
  );

  const persisted =
    readRecord(
      target,
      consumption.authorizationFingerprint
    );

  if (
    persisted.schema !== COMMIT_SCHEMA ||
    persisted.consumptionFingerprint !==
      consumption.consumptionFingerprint
  ) {
    throw new Error(
      'Durable G7 consumption could not be confirmed.'
    );
  }

  return Object.freeze({
    schema:
      'sdo.natural_development_authorization_consumption_receipt.v1',
    authorizationFingerprint:
      persisted.authorizationFingerprint,
    consumptionFingerprint:
      persisted.consumptionFingerprint,
    state: 'CONSUMED',
    replay: 'DENIED',
    operationalAuthority: false,
    mutationAuthority: false,
    dispatchAuthority: false
  });
}

function loadNaturalDevelopmentAuthorizationConsumption({
  stateRoot,
  authorizationFingerprint,
  readPurpose,
  expectedPhysicalWorkspaceIdentity
} = {}) {
  requireReadContext({
    readPurpose,
    expectedPhysicalWorkspaceIdentity
  });

  const target =
    recordPath(
      stateRoot,
      authorizationFingerprint
    );

  if (!fs.existsSync(target)) return null;

  const record = readRecord(
    target,
    authorizationFingerprint
  );

  if (
    readPurpose === READ_PURPOSE.CURRENT_AUTHORITY &&
    record.physicalWorkspaceIdentity !==
      expectedPhysicalWorkspaceIdentity
  ) {
    throw new Error(
      'Persisted G7 authorization record does not match the expected physical workspace context.'
    );
  }

  return record;
}

module.exports = Object.freeze({
  MAX_RECORD_BYTES,
  READ_PURPOSE,
  claimNaturalDevelopmentAuthorization,
  commitNaturalDevelopmentAuthorization,
  loadNaturalDevelopmentAuthorizationConsumption
});
