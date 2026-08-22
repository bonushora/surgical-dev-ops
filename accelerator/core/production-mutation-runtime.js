'use strict';

const {
  createSystemClockAdapter
} = require('../adapters/system-clock-adapter');

const {
  createMutationJournalAdapter
} = require('../adapters/mutation-journal-adapter');

const {
  createLocalOfflineHumanVerifier
} = require('../adapters/local-offline-human-authority');

const {
  createAuthoritativeClock
} = require('./authoritative-clock');

const {
  bindMutationProviderRuntime
} = require('./mutation-provider-internal');

const {
  providerBoundary: contentAddressedProviderBoundary
} = require('./content-addressed-mutation-provider');

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function freeze(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (const child of Object.values(value)) {
    freeze(child);
  }

  return Object.freeze(value);
}

function createProductionMutationRuntime({
  journalStorageRoot,
  humanAuthorityPublicKeyPem,
  humanAuthorityIssuer,
  humanSubjectId,
  identityAudience = 'surgical-devops'
} = {}) {
  const storageRoot =
    requireText(
      journalStorageRoot,
      'journalStorageRoot'
    );

  const issuer =
    requireText(
      humanAuthorityIssuer,
      'humanAuthorityIssuer'
    );

  const subjectId =
    requireText(
      humanSubjectId,
      'humanSubjectId'
    );

  const audience =
    requireText(
      identityAudience,
      'identityAudience'
    );

  if (
    typeof humanAuthorityPublicKeyPem !== 'string' ||
    !humanAuthorityPublicKeyPem.trim()
  ) {
    throw new Error(
      'humanAuthorityPublicKeyPem is required.'
    );
  }

  const systemClock =
    createSystemClockAdapter();

  const authoritativeClock =
    createAuthoritativeClock({
      port: systemClock
    });

  const identityVerifierPort =
    createLocalOfflineHumanVerifier({
      publicKeyPem:
        humanAuthorityPublicKeyPem,
      issuer,
      subjectId
    });

  const mutationJournalAdapter =
    createMutationJournalAdapter({
      storageRoot
    });

  const runtime = {
    trustedIdentityIssuers:
      Object.freeze([issuer]),

    identityAudience: audience,

    authoritativeClock,

    identityVerifierPort,

    mutationJournalAdapter
  };

  /*
   * Mutation authority is attached through the internal WeakMap
   * composition seam.
   *
   * No provider field is exposed on runtime and callers cannot select,
   * replace, clone or forge the trusted provider through request data.
   */
  bindMutationProviderRuntime(
    runtime,
    contentAddressedProviderBoundary
  );

  return freeze(runtime);
}

module.exports = Object.freeze({
  createProductionMutationRuntime
});
