'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const core =
  require(
    '../../accelerator/cli/natural-development-authorization-consumption'
  );

const store =
  require(
    '../../accelerator/adapters/natural-development-authorization-consumption-store'
  );

const hash = (value) =>
  crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');

function authorization(overrides = {}) {
  return Object.freeze({
    schema:
      'qualification.g4.exact_patch_authorization',
    authorizationFingerprint:
      hash('g4-authorization'),
    singleUse: true,
    reusable: false,
    operationalAuthority: false,
    mutationAuthority: false,
    ...overrides
  });
}

function claim(overrides = {}) {
  return core
    .createNaturalDevelopmentAuthorizationClaim({
      authorization:
        authorization(),
      operationId:
        'operation:g7:1',
      physicalWorkspaceIdentity:
        hash('physical-workspace'),
      target:
        'accelerator/example.js',
      beforeSha256:
        hash('before'),
      replacementSha256:
        hash('replacement'),
      ...overrides
    });
}

function consumption(boundClaim, overrides = {}) {
  return core
    .commitNaturalDevelopmentAuthorizationConsumption({
      claim:
        boundClaim,
      transactionId:
        'mutation-transaction:g7:1',
      journalId:
        'mutation-journal:g7:1',
      effectFingerprint:
        hash('manifest-authoritative-effect'),
      manifestAfterOid:
        '0123456789abcdef0123456789abcdef01234567',
      ...overrides
    });
}

function root(t) {
  const value =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'sdo-g7-authorization-'
      )
    );

  t.after(
    () =>
      fs.rmSync(
        value,
        {
          recursive: true,
          force: true
        }
      )
  );

  return value;
}

test(
  'G7 durably claims one exact G4 authorization before any replay',
  (t) => {
    const stateRoot =
      root(t);

    const exactClaim =
      claim();

    const receipt =
      store
        .claimNaturalDevelopmentAuthorization({
          stateRoot,
          claim:
            exactClaim
        });

    assert.equal(
      receipt.state,
      'CLAIMED'
    );

    assert.equal(
      receipt.authorizationFingerprint,
      exactClaim.authorizationFingerprint
    );

    const reopened =
      store
        .loadNaturalDevelopmentAuthorizationConsumption({
          stateRoot,
          authorizationFingerprint:
            exactClaim.authorizationFingerprint
        });

    assert.equal(
      reopened.claimFingerprint,
      exactClaim.claimFingerprint
    );

    assert.equal(
      reopened.state,
      'CLAIMED'
    );
  }
);

test(
  'G7 denies the same authorization after process-style reopen',
  (t) => {
    const stateRoot =
      root(t);

    const exactClaim =
      claim();

    store
      .claimNaturalDevelopmentAuthorization({
        stateRoot,
        claim:
          exactClaim
      });

    assert.throws(
      () =>
        store
          .claimNaturalDevelopmentAuthorization({
            stateRoot,
            claim:
              exactClaim
          }),
      /already has a durable claim|replay denied/i
    );
  }
);

test(
  'G7 commits journal and Manifest CAS evidence without restoring reusable authority',
  (t) => {
    const stateRoot =
      root(t);

    const exactClaim =
      claim();

    store
      .claimNaturalDevelopmentAuthorization({
        stateRoot,
        claim:
          exactClaim
      });

    const committed =
      consumption(
        exactClaim
      );

    const receipt =
      store
        .commitNaturalDevelopmentAuthorization({
          stateRoot,
          consumption:
            committed
        });

    assert.equal(
      receipt.state,
      'CONSUMED'
    );

    const reopened =
      store
        .loadNaturalDevelopmentAuthorizationConsumption({
          stateRoot,
          authorizationFingerprint:
            exactClaim.authorizationFingerprint
        });

    assert.equal(
      reopened.state,
      'CONSUMED'
    );

    assert.equal(
      reopened.journalId,
      'mutation-journal:g7:1'
    );

    assert.equal(
      reopened.manifestAfterOid,
      '0123456789abcdef0123456789abcdef01234567'
    );

    assert.equal(
      reopened.reusable,
      false
    );

    assert.equal(
      reopened.mutationAuthority,
      false
    );
  }
);

test(
  'G7 denies authorization replay after durable consumption and restart',
  (t) => {
    const stateRoot =
      root(t);

    const exactClaim =
      claim();

    store
      .claimNaturalDevelopmentAuthorization({
        stateRoot,
        claim:
          exactClaim
      });

    store
      .commitNaturalDevelopmentAuthorization({
        stateRoot,
        consumption:
          consumption(
            exactClaim
          )
      });

    assert.throws(
      () =>
        store
          .claimNaturalDevelopmentAuthorization({
            stateRoot,
            claim:
              exactClaim
          }),
      /already durably consumed|replay denied/i
    );
  }
);

test(
  'G7 identical consumption replay is read-only and never a second dispatch grant',
  (t) => {
    const stateRoot =
      root(t);

    const exactClaim =
      claim();

    store
      .claimNaturalDevelopmentAuthorization({
        stateRoot,
        claim:
          exactClaim
      });

    const committed =
      consumption(
        exactClaim
      );

    store
      .commitNaturalDevelopmentAuthorization({
        stateRoot,
        consumption:
          committed
      });

    const replay =
      store
        .commitNaturalDevelopmentAuthorization({
          stateRoot,
          consumption:
            committed
        });

    assert.equal(
      replay.replay,
      'IDEMPOTENT_READ_ONLY'
    );

    assert.equal(
      replay.dispatchAuthority,
      false
    );

    assert.equal(
      replay.mutationAuthority,
      false
    );
  }
);

test(
  'G7 conflicting consumption replay fails closed',
  (t) => {
    const stateRoot =
      root(t);

    const exactClaim =
      claim();

    store
      .claimNaturalDevelopmentAuthorization({
        stateRoot,
        claim:
          exactClaim
      });

    store
      .commitNaturalDevelopmentAuthorization({
        stateRoot,
        consumption:
          consumption(
            exactClaim
          )
      });

    assert.throws(
      () =>
        store
          .commitNaturalDevelopmentAuthorization({
            stateRoot,
            consumption:
              consumption(
                exactClaim,
                {
                  effectFingerprint:
                    hash('conflicting-effect')
                }
              )
          }),
      /conflicting.*replay/i
    );
  }
);

test(
  'G7 claim is exactly bound to workspace target BEFORE and replacement',
  () => {
    const base =
      claim();

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
          hash('other-replacement')
      }
    ]) {
      const substituted =
        claim(changed);

      assert.notEqual(
        substituted.claimFingerprint,
        base.claimFingerprint
      );
    }
  }
);

test(
  'G7 rejects reusable mutable and authority-bearing G4 evidence',
  () => {
    assert.throws(
      () =>
        core
          .createNaturalDevelopmentAuthorizationClaim({
            authorization: {
              ...authorization()
            },
            operationId:
              'operation:g7:1',
            physicalWorkspaceIdentity:
              hash('physical-workspace'),
            target:
              'accelerator/example.js',
            beforeSha256:
              hash('before'),
            replacementSha256:
              hash('replacement')
          }),
      /immutable/i
    );

    for (const invalid of [
      {
        singleUse: false,
        reusable: true
      },
      {
        operationalAuthority: true
      },
      {
        mutationAuthority: true
      },
      {
        dispatchAuthority: true
      }
    ]) {
      assert.throws(
        () =>
          core
            .createNaturalDevelopmentAuthorizationClaim({
              authorization:
                authorization(invalid),
              operationId:
                'operation:g7:1',
              physicalWorkspaceIdentity:
                hash('physical-workspace'),
              target:
                'accelerator/example.js',
              beforeSha256:
                hash('before'),
              replacementSha256:
                hash('replacement')
            }),
        /single-use|execution|mutation authority/i
      );
    }
  }
);

test(
  'G7 persisted record tampering is detected after reopen',
  (t) => {
    const stateRoot =
      root(t);

    const exactClaim =
      claim();

    store
      .claimNaturalDevelopmentAuthorization({
        stateRoot,
        claim:
          exactClaim
      });

    const file =
      path.join(
        stateRoot,
        `${exactClaim.authorizationFingerprint}.json`
      );

    const tampered =
      JSON.parse(
        fs.readFileSync(
          file,
          'utf8'
        )
      );

    tampered.target =
      'accelerator/attacker.js';

    fs.writeFileSync(
      file,
      JSON.stringify(
        tampered,
        null,
        2
      ) + '\n'
    );

    assert.throws(
      () =>
        store
          .loadNaturalDevelopmentAuthorizationConsumption({
            stateRoot,
            authorizationFingerprint:
              exactClaim.authorizationFingerprint
          }),
      /integrity/i
    );
  }
);

test(
  'G7 exposes no delete release reset dispatch or generic execution surface',
  () => {
    const coreKeys =
      Object.keys(core);

    const storeKeys =
      Object.keys(store);

    for (const forbidden of [
      'delete',
      'release',
      'reset',
      'dispatch',
      'execute',
      'spawn',
      'shell',
      'grant',
      'authorize'
    ]) {
      assert.equal(
        coreKeys.some(
          (key) =>
            key.toLowerCase() === forbidden
        ),
        false
      );

      assert.equal(
        storeKeys.some(
          (key) =>
            key.toLowerCase() === forbidden
        ),
        false
      );
    }
  }
);
