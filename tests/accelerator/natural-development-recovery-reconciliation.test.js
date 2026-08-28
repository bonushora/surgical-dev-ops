'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const g7 =
  require(
    '../../accelerator/cli/natural-development-authorization-consumption'
  );

const g8 =
  require(
    '../../accelerator/cli/natural-development-recovery-reconciliation'
  );

const hash = (value) =>
  crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');

const freeze = (value) =>
  Object.freeze(value);

function authorization() {
  return Object.freeze({
    authorizationFingerprint:
      hash('g4-auth'),
    singleUse: true,
    reusable: false,
    operationalAuthority: false,
    mutationAuthority: false,
    dispatchAuthority: false
  });
}

function claim() {
  return g7.createNaturalDevelopmentAuthorizationClaim({
    authorization:
      authorization(),
    operationId:
      'operation:g8:1',
    physicalWorkspaceIdentity:
      hash('workspace'),
    target:
      'accelerator/example.js',
    beforeSha256:
      hash('before'),
    replacementSha256:
      hash('after')
  });
}

function consumed(boundClaim) {
  return g7.commitNaturalDevelopmentAuthorizationConsumption({
    claim:
      boundClaim,
    transactionId:
      'transaction:g8:1',
    journalId:
      'journal:g8:1',
    effectFingerprint:
      hash('effect'),
    manifestAfterOid:
      '0123456789abcdef0123456789abcdef01234567'
  });
}

function base(authorizationState, overrides = {}) {
  return {
    authorizationState,
    operationId:
      'operation:g8:1',
    physicalWorkspaceIdentity:
      hash('workspace'),
    target:
      'accelerator/example.js',
    beforeSha256:
      hash('before'),
    replacementSha256:
      hash('after'),
    journalEvidence:
      freeze({
        transactionId:
          'transaction:g8:1',
        journalId:
          'journal:g8:1',
        terminal: true,
        finalized: true,
        applied: true,
        effectFingerprint:
          hash('effect')
      }),
    manifestEvidence:
      freeze({
        authoritative: true,
        afterOid:
          '0123456789abcdef0123456789abcdef01234567',
        effectFingerprint:
          hash('effect')
      }),
    physicalEvidence:
      freeze({
        state: 'AFTER',
        observedSha256:
          hash('after')
      }),
    ...overrides
  };
}

test(
  'G8 reconciles durable consumed authorization only from journal CAS and physical AFTER evidence',
  () => {
    const c = claim();
    const state =
      consumed(c);

    const result =
      g8.reconcileNaturalDevelopmentRecovery(
        base(state)
      );

    assert.equal(
      result.state,
      'COMPLETED'
    );
    assert.equal(
      result.sourceAuthorizationState,
      'CONSUMED'
    );
    assert.equal(
      result.remutationPermitted,
      false
    );
    assert.equal(
      result.authorizationReusable,
      false
    );
  }
);

test(
  'G8 claimed authorization may reconcile an already-applied historical effect without remutation',
  () => {
    const c = claim();

    const result =
      g8.reconcileNaturalDevelopmentRecovery(
        base(c)
      );

    assert.equal(
      result.state,
      'COMPLETED'
    );
    assert.equal(
      result.sourceAuthorizationState,
      'CLAIMED'
    );
    assert.equal(
      result.dispatchAuthority,
      false
    );
  }
);

test(
  'G8 BEFORE plus finalized not-applied journal requires new human authority',
  () => {
    const c = claim();

    const result =
      g8.reconcileNaturalDevelopmentRecovery(
        base(
          c,
          {
            journalEvidence:
              freeze({
                transactionId:
                  'transaction:g8:1',
                journalId:
                  'journal:g8:1',
                terminal: true,
                finalized: true,
                applied: false,
                effectFingerprint: null
              }),
            manifestEvidence:
              freeze({
                authoritative: false,
                afterOid: null,
                effectFingerprint: null
              }),
            physicalEvidence:
              freeze({
                state: 'BEFORE',
                observedSha256:
                  hash('before')
              })
          }
        )
      );

    assert.equal(
      result.state,
      'NOT_APPLIED_REAUTH_REQUIRED'
    );
    assert.equal(
      result.remutationPermitted,
      false
    );
    assert.equal(
      result.authorizationReusable,
      false
    );
  }
);

test(
  'G8 ambiguous physical state remains unresolved and never dispatchable',
  () => {
    const c = claim();

    const result =
      g8.reconcileNaturalDevelopmentRecovery(
        base(
          c,
          {
            physicalEvidence:
              freeze({
                state: 'OTHER',
                observedSha256:
                  hash('other')
              })
          }
        )
      );

    assert.equal(
      result.state,
      'RECOVERY_UNRESOLVED'
    );
    assert.equal(
      result.operationalAuthority,
      false
    );
    assert.equal(
      result.mutationAuthority,
      false
    );
  }
);

test(
  'G8 consumed authorization denies journal transaction substitution',
  () => {
    const c = claim();
    const state =
      consumed(c);

    assert.throws(
      () =>
        g8.reconcileNaturalDevelopmentRecovery(
          base(
            state,
            {
              journalEvidence:
                freeze({
                  transactionId:
                    'transaction:attacker',
                  journalId:
                    'journal:g8:1',
                  terminal: true,
                  finalized: true,
                  applied: true,
                  effectFingerprint:
                    hash('effect')
                })
            }
          )
        ),
      /substitution denied/i
    );
  }
);

test(
  'G8 consumed authorization denies Manifest CAS or effect substitution',
  () => {
    const c = claim();
    const state =
      consumed(c);

    for (const manifestEvidence of [
      freeze({
        authoritative: true,
        afterOid:
          'fedcba9876543210fedcba9876543210fedcba98',
        effectFingerprint:
          hash('effect')
      }),
      freeze({
        authoritative: true,
        afterOid:
          '0123456789abcdef0123456789abcdef01234567',
        effectFingerprint:
          hash('attacker-effect')
      })
    ]) {
      assert.throws(
        () =>
          g8.reconcileNaturalDevelopmentRecovery(
            base(
              state,
              {
                manifestEvidence
              }
            )
          ),
        /substitution denied/i
      );
    }
  }
);

test(
  'G8 target workspace BEFORE and replacement substitution fail closed',
  () => {
    const c = claim();

    for (const changed of [
      {
        physicalWorkspaceIdentity:
          hash('other-workspace')
      },
      {
        target:
          'accelerator/other.js'
      },
      {
        beforeSha256:
          hash('other-before')
      },
      {
        replacementSha256:
          hash('other-after')
      }
    ]) {
      assert.throws(
        () =>
          g8.reconcileNaturalDevelopmentRecovery(
            base(c, changed)
          ),
        /binding mismatch/i
      );
    }
  }
);

test(
  'G8 rejects mutable recovery evidence',
  () => {
    const c = claim();

    assert.throws(
      () =>
        g8.reconcileNaturalDevelopmentRecovery(
          base(
            c,
            {
              journalEvidence: {
                transactionId:
                  'transaction:g8:1',
                journalId:
                  'journal:g8:1',
                terminal: true,
                finalized: true,
                applied: true,
                effectFingerprint:
                  hash('effect')
              }
            }
          )
        ),
      /immutable evidence/i
    );
  }
);

test(
  'G8 exports one reconciliation function and no execution mutation reset release or authority factory',
  () => {
    const keys =
      Object.keys(g8);

    assert.deepEqual(
      keys.sort(),
      [
        'RECONCILIATION_SCHEMA',
        'STATES',
        'reconcileNaturalDevelopmentRecovery'
      ].sort()
    );

    const source =
      require('node:fs')
        .readFileSync(
          require.resolve(
            '../../accelerator/cli/natural-development-recovery-reconciliation'
          ),
          'utf8'
        );

    for (const forbidden of [
      'child_process',
      'spawn(',
      'exec(',
      'shell:',
      'unlinkSync',
      'rmSync',
      'renameSync',
      'writeFileSync',
      'fetch('
    ]) {
      assert.equal(
        source.includes(forbidden),
        false,
        `unexpected authority surface: ${forbidden}`
      );
    }
  }
);
