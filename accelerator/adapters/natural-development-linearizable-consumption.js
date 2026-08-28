'use strict';

const fs = require('node:fs');
const path = require('node:path');

const core =
  require('../cli/natural-development-authorization-consumption');

const store =
  require('./natural-development-authorization-consumption-store');

const SCHEMA =
  'sdo.natural_development_linearizable_consumption_receipt.v1';

function canonicalRoot(value) {
  if (
    typeof value !== 'string' ||
    !path.isAbsolute(value) ||
    path.normalize(value) !== value
  ) {
    throw new Error(
      'G10 requires a canonical absolute authorization-consumption state root.'
    );
  }

  const stat = fs.lstatSync(value);

  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    fs.realpathSync(value) !== value
  ) {
    throw new Error(
      'G10 authorization-consumption state root is unsafe or ambiguous.'
    );
  }

  return value;
}

function fingerprint(value) {
  if (
    typeof value !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value)
  ) {
    throw new Error('G10 authorization fingerprint is malformed.');
  }

  return value;
}

function lockPath(stateRoot, authorizationFingerprint) {
  const root = canonicalRoot(stateRoot);
  const id = fingerprint(authorizationFingerprint);
  const lockRoot = path.join(root, '.g10-linearizable');

  try {
    fs.mkdirSync(lockRoot, { mode: 0o700 });

    const parent =
      fs.openSync(root, fs.constants.O_RDONLY);

    try {
      fs.fsyncSync(parent);
    } finally {
      fs.closeSync(parent);
    }
  } catch (error) {
    if (!error || error.code !== 'EEXIST') throw error;
  }

  const stat = fs.lstatSync(lockRoot);

  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    fs.realpathSync(lockRoot) !== lockRoot ||
    path.dirname(lockRoot) !== root
  ) {
    throw new Error('G10 linearization lock root is unsafe.');
  }

  return path.join(
    lockRoot,
    id + '.lock'
  );
}

function acquire(stateRoot, authorizationFingerprint) {
  const file =
    lockPath(
      stateRoot,
      authorizationFingerprint
    );

  let descriptor;

  try {
    descriptor =
      fs.openSync(
        file,
        'wx',
        0o600
      );

    fs.writeFileSync(
      descriptor,
      JSON.stringify({
        schema: 'sdo.g10_linearization_lock.v1',
        authorizationFingerprint,
        ownerProcess: String(process.pid)
      }) + '\n',
      'utf8'
    );

    fs.fsyncSync(descriptor);
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch {}
    }

    if (error && error.code === 'EEXIST') {
      throw new Error(
        'G10 linearizable consumption is contended; automatic stale-lock reclamation is forbidden.'
      );
    }

    throw error;
  }

  fs.closeSync(descriptor);

  const parent =
    fs.openSync(
      path.dirname(file),
      fs.constants.O_RDONLY
    );

  try {
    fs.fsyncSync(parent);
  } finally {
    fs.closeSync(parent);
  }

  return Object.freeze({
    file,
    authorizationFingerprint
  });
}

function release(lock) {
  if (
    !lock ||
    typeof lock.file !== 'string' ||
    typeof lock.authorizationFingerprint !== 'string'
  ) {
    throw new Error(
      'G10 linearization lock ownership is malformed.'
    );
  }

  const raw =
    JSON.parse(
      fs.readFileSync(
        lock.file,
        'utf8'
      )
    );

  if (
    raw.schema !== 'sdo.g10_linearization_lock.v1' ||
    raw.authorizationFingerprint !==
      lock.authorizationFingerprint ||
    raw.ownerProcess !== String(process.pid)
  ) {
    throw new Error(
      'G10 linearization lock ownership mismatch.'
    );
  }

  fs.unlinkSync(lock.file);

  const parent =
    fs.openSync(
      path.dirname(lock.file),
      fs.constants.O_RDONLY
    );

  try {
    fs.fsyncSync(parent);
  } finally {
    fs.closeSync(parent);
  }
}

function commitLinearizableNaturalDevelopmentAuthorizationConsumption({
  stateRoot,
  claim,
  transactionId,
  journalId,
  effectFingerprint,
  manifestAfterOid
} = {}) {
  core.validateNaturalDevelopmentAuthorizationClaim(
    claim
  );

  const lock =
    acquire(
      stateRoot,
      claim.authorizationFingerprint
    );

  try {
    const current =
      store.loadNaturalDevelopmentAuthorizationConsumption({
        stateRoot,
        authorizationFingerprint:
          claim.authorizationFingerprint
      });

    if (
      !current ||
      current.authorizationFingerprint !==
        claim.authorizationFingerprint
    ) {
      throw new Error(
        'G10 requires the exact durable G9 CLAIMED authorization state.'
      );
    }

    const consumption =
      core.commitNaturalDevelopmentAuthorizationConsumption({
        claim,
        transactionId,
        journalId,
        effectFingerprint,
        manifestAfterOid
      });

    core.validateNaturalDevelopmentAuthorizationConsumption(
      consumption
    );

    const persisted =
      store.commitNaturalDevelopmentAuthorization({
        stateRoot,
        consumption
      });

    const reopened =
      store.loadNaturalDevelopmentAuthorizationConsumption({
        stateRoot,
        authorizationFingerprint:
          claim.authorizationFingerprint
      });

    core.validateNaturalDevelopmentAuthorizationConsumption(
      reopened
    );

    if (
      reopened.authorizationFingerprint !==
        claim.authorizationFingerprint ||
      reopened.transactionId !== transactionId ||
      reopened.journalId !== journalId ||
      reopened.effectFingerprint !== effectFingerprint ||
      reopened.manifestAfterOid !== manifestAfterOid
    ) {
      throw new Error(
        'G10 durable consumption reopen binding mismatch.'
      );
    }

    return Object.freeze({
      schema: SCHEMA,
      state: 'CONSUMED',
      authorizationFingerprint:
        reopened.authorizationFingerprint,
      consumptionFingerprint:
        reopened.consumptionFingerprint,
      transactionId:
        reopened.transactionId,
      journalId:
        reopened.journalId,
      effectFingerprint:
        reopened.effectFingerprint,
      manifestAfterOid:
        reopened.manifestAfterOid,
      persistedReceipt:
        persisted || null,
      operationalAuthority: false,
      mutationAuthority: false,
      dispatchAuthority: false
    });
  } finally {
    release(lock);
  }
}

module.exports = Object.freeze({
  SCHEMA,
  commitLinearizableNaturalDevelopmentAuthorizationConsumption
});
