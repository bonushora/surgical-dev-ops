'use strict';

const crypto = require('node:crypto');

const {
  CLAIM_SCHEMA,
  COMMIT_SCHEMA,
  validateNaturalDevelopmentAuthorizationClaim,
  validateNaturalDevelopmentAuthorizationConsumption
} = require(
  './natural-development-authorization-consumption'
);

const RECONCILIATION_SCHEMA =
  'sdo.natural_development_recovery_reconciliation.v1';

const STATES = Object.freeze({
  COMPLETED: 'COMPLETED',
  NOT_APPLIED_REAUTH_REQUIRED:
    'NOT_APPLIED_REAUTH_REQUIRED',
  RECOVERY_UNRESOLVED:
    'RECOVERY_UNRESOLVED'
});

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

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function text(value, label, maximum = 4096) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function sha(value, label) {
  const result = text(value, label, 64);
  if (!/^[a-f0-9]{64}$/.test(result)) {
    throw new Error(`${label} must be canonical SHA-256.`);
  }
  return result;
}

function immutableEvidence(value, label) {
  if (!value || typeof value !== 'object' || !Object.isFrozen(value)) {
    throw new Error(`${label} must be immutable evidence.`);
  }
  return value;
}

function exactBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be explicit boolean evidence.`);
  }
  return value;
}

function validateJournalEvidence(value) {
  immutableEvidence(value, 'Journal evidence');

  const normalized = {
    transactionId:
      text(value.transactionId, 'Journal transaction identity', 512),
    journalId:
      text(value.journalId, 'Journal identity', 512),
    terminal:
      exactBoolean(value.terminal, 'Journal terminal state'),
    finalized:
      exactBoolean(value.finalized, 'Journal finalization state'),
    applied:
      exactBoolean(value.applied, 'Journal applied state'),
    effectFingerprint:
      value.effectFingerprint == null
        ? null
        : sha(value.effectFingerprint, 'Journal effect fingerprint')
  };

  if (
    normalized.applied === true &&
    normalized.effectFingerprint === null
  ) {
    throw new Error(
      'Applied journal evidence requires exact effect fingerprint.'
    );
  }

  return Object.freeze(normalized);
}

function validateManifestEvidence(value) {
  immutableEvidence(value, 'Manifest CAS evidence');

  return Object.freeze({
    authoritative:
      exactBoolean(value.authoritative, 'Manifest authority state'),
    afterOid:
      value.afterOid == null
        ? null
        : text(value.afterOid, 'Manifest AFTER identity', 128),
    effectFingerprint:
      value.effectFingerprint == null
        ? null
        : sha(value.effectFingerprint, 'Manifest effect fingerprint')
  });
}

function validatePhysicalEvidence(value) {
  immutableEvidence(value, 'Physical evidence');

  const state =
    text(value.state, 'Physical state', 64);

  if (!['BEFORE', 'AFTER', 'OTHER', 'UNAVAILABLE'].includes(state)) {
    throw new Error('Physical state is outside the G8 closed vocabulary.');
  }

  return Object.freeze({
    state,
    observedSha256:
      value.observedSha256 == null
        ? null
        : sha(value.observedSha256, 'Observed physical SHA-256')
  });
}

function bindBase({
  authorizationState,
  operationId,
  physicalWorkspaceIdentity,
  target,
  beforeSha256,
  replacementSha256
}) {
  return {
    authorizationFingerprint:
      sha(
        authorizationState.authorizationFingerprint,
        'Authorization fingerprint'
      ),
    operationId:
      text(operationId, 'Operation identity', 512),
    physicalWorkspaceIdentity:
      sha(physicalWorkspaceIdentity, 'Physical workspace identity'),
    target:
      text(target, 'Exact target', 4096),
    beforeSha256:
      sha(beforeSha256, 'BEFORE SHA-256'),
    replacementSha256:
      sha(replacementSha256, 'Replacement SHA-256')
  };
}

function assertAuthorizationBinding(base, authorizationState) {
  if (
    authorizationState.operationId !== base.operationId ||
    authorizationState.physicalWorkspaceIdentity !==
      base.physicalWorkspaceIdentity ||
    authorizationState.target !== base.target ||
    authorizationState.beforeSha256 !== base.beforeSha256 ||
    authorizationState.replacementSha256 !==
      base.replacementSha256
  ) {
    throw new Error(
      'G8 authorization recovery binding mismatch.'
    );
  }
}

function result(body) {
  const complete = {
    schema: RECONCILIATION_SCHEMA,
    ...body,
    dispatchAuthority: false,
    mutationAuthority: false,
    operationalAuthority: false,
    remutationPermitted: false,
    authorizationReusable: false
  };

  return deepFreeze({
    ...complete,
    reconciliationFingerprint:
      fingerprint(complete)
  });
}

function reconcileNaturalDevelopmentRecovery({
  authorizationState,
  operationId,
  physicalWorkspaceIdentity,
  target,
  beforeSha256,
  replacementSha256,
  journalEvidence,
  manifestEvidence,
  physicalEvidence
} = {}) {
  immutableEvidence(
    authorizationState,
    'Durable G7 authorization state'
  );

  const base =
    bindBase({
      authorizationState,
      operationId,
      physicalWorkspaceIdentity,
      target,
      beforeSha256,
      replacementSha256
    });

  const journal =
    validateJournalEvidence(journalEvidence);
  const manifest =
    validateManifestEvidence(manifestEvidence);
  const physical =
    validatePhysicalEvidence(physicalEvidence);

  if (authorizationState.schema === CLAIM_SCHEMA) {
    validateNaturalDevelopmentAuthorizationClaim(
      authorizationState
    );
    assertAuthorizationBinding(base, authorizationState);

    if (
      journal.applied === false &&
      journal.terminal === true &&
      journal.finalized === true &&
      physical.state === 'BEFORE'
    ) {
      return result({
        ...base,
        sourceAuthorizationState: 'CLAIMED',
        state: STATES.NOT_APPLIED_REAUTH_REQUIRED,
        reason:
          'Durable claim remains consumed for replay purposes; physical retry requires new human authority.',
        journalId: journal.journalId,
        transactionId: journal.transactionId,
        manifestAfterOid: null,
        effectFingerprint: null
      });
    }

    if (
      journal.applied === true &&
      journal.terminal === true &&
      journal.finalized === true &&
      journal.effectFingerprint &&
      manifest.authoritative === true &&
      manifest.afterOid &&
      manifest.effectFingerprint ===
        journal.effectFingerprint &&
      physical.state === 'AFTER' &&
      physical.observedSha256 ===
        base.replacementSha256
    ) {
      return result({
        ...base,
        sourceAuthorizationState: 'CLAIMED',
        state: STATES.COMPLETED,
        reason:
          'Historical production evidence proves the already-authorized effect without remutation.',
        journalId: journal.journalId,
        transactionId: journal.transactionId,
        manifestAfterOid: manifest.afterOid,
        effectFingerprint:
          journal.effectFingerprint
      });
    }

    return result({
      ...base,
      sourceAuthorizationState: 'CLAIMED',
      state: STATES.RECOVERY_UNRESOLVED,
      reason:
        'Durable claim cannot be converted into replay authority; evidence remains unresolved.',
      journalId: journal.journalId,
      transactionId: journal.transactionId,
      manifestAfterOid:
        manifest.afterOid,
      effectFingerprint:
        journal.effectFingerprint
    });
  }

  if (authorizationState.schema === COMMIT_SCHEMA) {
    validateNaturalDevelopmentAuthorizationConsumption(
      authorizationState
    );
    assertAuthorizationBinding(base, authorizationState);

    if (
      authorizationState.transactionId !==
        journal.transactionId ||
      authorizationState.journalId !==
        journal.journalId
    ) {
      throw new Error(
        'G8 consumed authorization journal/transaction substitution denied.'
      );
    }

    if (
      authorizationState.effectFingerprint !==
        journal.effectFingerprint ||
      authorizationState.effectFingerprint !==
        manifest.effectFingerprint ||
      authorizationState.manifestAfterOid !==
        manifest.afterOid
    ) {
      throw new Error(
        'G8 consumed authorization CAS/effect substitution denied.'
      );
    }

    if (
      journal.applied === true &&
      journal.terminal === true &&
      journal.finalized === true &&
      manifest.authoritative === true &&
      physical.state === 'AFTER' &&
      physical.observedSha256 ===
        base.replacementSha256
    ) {
      return result({
        ...base,
        sourceAuthorizationState: 'CONSUMED',
        state: STATES.COMPLETED,
        reason:
          'Durable G7 consumption matches terminal journal, authoritative Manifest CAS and physical AFTER evidence.',
        journalId: journal.journalId,
        transactionId: journal.transactionId,
        manifestAfterOid: manifest.afterOid,
        effectFingerprint:
          journal.effectFingerprint
      });
    }

    return result({
      ...base,
      sourceAuthorizationState: 'CONSUMED',
      state: STATES.RECOVERY_UNRESOLVED,
      reason:
        'Consumed authorization remains non-reusable while physical/journal/CAS evidence is unresolved.',
      journalId: journal.journalId,
      transactionId: journal.transactionId,
      manifestAfterOid:
        manifest.afterOid,
      effectFingerprint:
        journal.effectFingerprint
    });
  }

  throw new Error(
    'G8 requires canonical G7 CLAIMED or CONSUMED authorization state.'
  );
}

module.exports = Object.freeze({
  RECONCILIATION_SCHEMA,
  STATES,
  reconcileNaturalDevelopmentRecovery
});
