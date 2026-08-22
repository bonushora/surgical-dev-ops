'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createProductionMutationRuntime
} = require(
  '../../accelerator/core/production-mutation-runtime'
);

const {
  resolveMutationProviderRuntime
} = require(
  '../../accelerator/core/mutation-provider-internal'
);

const {
  evaluateMutationProvider
} = require(
  '../../accelerator/core/mutation-provider'
);

function fixture() {
  const root =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'sdo-production-runtime-'
      )
    );

  const journal =
    path.join(root, 'journal');

  fs.mkdirSync(journal);

  const pair =
    crypto.generateKeyPairSync('ed25519');

  const publicKeyPem =
    pair.publicKey.export({
      type: 'spki',
      format: 'pem'
    });

  return {
    root,
    journal: fs.realpathSync(journal),
    publicKeyPem
  };
}

function cleanup(state) {
  fs.rmSync(
    state.root,
    {
      recursive: true,
      force: true
    }
  );
}

function runtime(state) {
  return createProductionMutationRuntime({
    journalStorageRoot: state.journal,
    humanAuthorityPublicKeyPem:
      state.publicKeyPem,
    humanAuthorityIssuer:
      'local:human-1',
    humanSubjectId:
      'human-1'
  });
}

test(
  'production runtime composes physical clock journal identity verifier and qualified mutation provider',
  () => {
    const state = fixture();

    try {
      const composed = runtime(state);

      assert.ok(Object.isFrozen(composed));

      assert.deepEqual(
        composed.trustedIdentityIssuers,
        ['local:human-1']
      );

      assert.equal(
        composed.identityAudience,
        'surgical-devops'
      );

      assert.equal(
        typeof composed.authoritativeClock.observe,
        'function'
      );

      assert.equal(
        typeof composed.identityVerifierPort.verify,
        'function'
      );

      assert.equal(
        typeof composed.mutationJournalAdapter.create,
        'function'
      );

      assert.equal(
        typeof composed.mutationJournalAdapter.append,
        'function'
      );

      assert.equal(
        typeof composed.mutationJournalAdapter.reopen,
        'function'
      );

      const provider =
        resolveMutationProviderRuntime(composed);

      const decision =
        evaluateMutationProvider(
          provider,
          {
            operationId: 'qualification-op',
            workspace: state.root,
            action: 'PATCH_FILE'
          }
        );

      assert.equal(
        decision.decision,
        'ALLOWED'
      );

      assert.equal(
        decision.providerId,
        'sdo:git-manifest-cas-v1'
      );

      assert.equal(
        decision.qualificationState,
        'QUALIFIED'
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'production runtime exposes no mutation provider selection field',
  () => {
    const state = fixture();

    try {
      const composed = runtime(state);

      for (const forbidden of [
        'provider',
        'providerId',
        'mutationProvider',
        'providerQualification',
        'qualificationState',
        'compareAndReplace'
      ]) {
        assert.equal(
          Object.prototype.hasOwnProperty.call(
            composed,
            forbidden
          ),
          false
        );
      }
    } finally {
      cleanup(state);
    }
  }
);

test(
  'production runtime contains no private-key or signing authority',
  () => {
    const state = fixture();

    try {
      const composed = runtime(state);

      assert.equal(
        'privateKey' in composed,
        false
      );

      assert.equal(
        'sign' in composed,
        false
      );

      const source =
        fs.readFileSync(
          require.resolve(
            '../../accelerator/core/production-mutation-runtime'
          ),
          'utf8'
        );

      assert.doesNotMatch(
        source,
        /generateKeyPair|createPrivateKey|privateKeyPem|crypto\.sign/
      );

      assert.doesNotMatch(
        source,
        /child_process|execSync|spawnSync|shell/
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'malformed or missing production trust configuration fails closed',
  () => {
    const state = fixture();

    try {
      assert.throws(
        () =>
          createProductionMutationRuntime({
            journalStorageRoot:
              state.journal,
            humanAuthorityPublicKeyPem:
              state.publicKeyPem,
            humanAuthorityIssuer:
              '',
            humanSubjectId:
              'human-1'
          }),
        /issuer|required/i
      );

      assert.throws(
        () =>
          createProductionMutationRuntime({
            journalStorageRoot:
              state.journal,
            humanAuthorityPublicKeyPem:
              '',
            humanAuthorityIssuer:
              'local:human-1',
            humanSubjectId:
              'human-1'
          }),
        /public.*key|required/i
      );

      assert.throws(
        () =>
          createProductionMutationRuntime({
            journalStorageRoot:
              path.join(
                state.root,
                'missing'
              ),
            humanAuthorityPublicKeyPem:
              state.publicKeyPem,
            humanAuthorityIssuer:
              'local:human-1',
            humanSubjectId:
              'human-1'
          }),
        /storage|directory|root|exist/i
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'production authoritative clock is backed by the physical system clock adapter',
  () => {
    const state = fixture();

    try {
      const composed = runtime(state);

      const observation =
        composed.authoritativeClock.observe();

      assert.equal(
        observation.decision,
        'ALLOWED'
      );

      assert.equal(
        observation.classification,
        'INITIAL'
      );

      assert.match(
        observation.reading.source,
        /^SYSTEM_CLOCK:/
      );
    } finally {
      cleanup(state);
    }
  }
);

test(
  'production runtime public module exposes only the composition factory',
  () => {
    const surface =
      require(
        '../../accelerator/core/production-mutation-runtime'
      );

    assert.deepEqual(
      Object.keys(surface),
      ['createProductionMutationRuntime']
    );
  }
);
