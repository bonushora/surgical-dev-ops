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

const linearizable =
  require(
    '../../accelerator/adapters/natural-development-linearizable-consumption'
  );

const G5_PATH =
  require.resolve(
    '../../accelerator/cli/natural-development-r3-composition'
  );

const hash = (value) =>
  crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');

function fixture(t) {
  const stateRoot =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'sdo-g10-'
      )
    );

  t.after(
    () =>
      fs.rmSync(
        stateRoot,
        {
          recursive: true,
          force: true
        }
      )
  );

  const authorization =
    Object.freeze({
      authorizationFingerprint:
        hash('g10-authorization'),
      singleUse: true,
      reusable: false,
      operationalAuthority: false,
      mutationAuthority: false,
      dispatchAuthority: false
    });

  const claim =
    core.createNaturalDevelopmentAuthorizationClaim({
      authorization,
      operationId:
        'operation:g10:qualification',
      physicalWorkspaceIdentity:
        hash('workspace'),
      target:
        'accelerator/example.js',
      beforeSha256:
        hash('before'),
      replacementSha256:
        hash('replacement')
    });

  store.claimNaturalDevelopmentAuthorization({
    stateRoot,
    claim
  });

  return {
    stateRoot,
    claim
  };
}

function commit(values, overrides = {}) {
  return linearizable
    .commitLinearizableNaturalDevelopmentAuthorizationConsumption({
      stateRoot:
        values.stateRoot,
      claim:
        values.claim,
      transactionId:
        hash('transaction'),
      journalId:
        hash('journal'),
      effectFingerprint:
        hash('effect'),
      manifestAfterOid:
        '0123456789abcdef0123456789abcdef01234567',
      ...overrides
    });
}

test(
  'G10 production ordering is durable claim -> real dispatch -> CAS -> durable consumption',
  () => {
    const source =
      fs.readFileSync(
        G5_PATH,
        'utf8'
      );

    const claim =
      source.indexOf(
        '_g9ClaimBeforeRealG5Dispatch(arguments);'
      );

    const dispatch =
      source.indexOf(
        'orchestrate(',
        claim
      );

    const cas =
      source.indexOf(
        'successfulCasEvidence(orchestration)',
        dispatch
      );

    const consume =
      source.indexOf(
        'commitLinearizableNaturalDevelopmentAuthorizationConsumption',
        cas
      );

    assert.ok(claim >= 0);
    assert.ok(dispatch > claim);
    assert.ok(cas > dispatch);
    assert.ok(consume > cas);

    assert.equal(
      (
        source.match(
          /\borchestrate\s*\(/g
        ) || []
      ).length,
      1
    );
  }
);

test(
  'G10 consumption persists exact transaction journal effect and Manifest CAS binding',
  (t) => {
    const values =
      fixture(t);

    const result =
      commit(values);

    assert.equal(
      result.state,
      'CONSUMED'
    );

    assert.equal(
      result.authorizationFingerprint,
      values.claim.authorizationFingerprint
    );

    assert.equal(
      result.transactionId,
      hash('transaction')
    );

    assert.equal(
      result.journalId,
      hash('journal')
    );

    assert.equal(
      result.effectFingerprint,
      hash('effect')
    );

    assert.equal(
      result.manifestAfterOid,
      '0123456789abcdef0123456789abcdef01234567'
    );

    assert.equal(
      result.dispatchAuthority,
      false
    );
  }
);

test(
  'G10 identical consumption converges without restoring authority',
  (t) => {
    const values =
      fixture(t);

    const first =
      commit(values);

    const second =
      commit(values);

    assert.equal(
      second.consumptionFingerprint,
      first.consumptionFingerprint
    );

    assert.equal(
      second.operationalAuthority,
      false
    );

    assert.equal(
      second.mutationAuthority,
      false
    );

    assert.equal(
      second.dispatchAuthority,
      false
    );
  }
);

test(
  'G10 conflicting consumption fails closed and preserves durable first result',
  (t) => {
    const values =
      fixture(t);

    const first =
      commit(values);

    assert.throws(
      () =>
        commit(
          values,
          {
            transactionId:
              hash('conflicting-transaction')
          }
        ),
      /conflict|consumption|replay|binding/i
    );

    const reopened =
      store.loadNaturalDevelopmentAuthorizationConsumption({
        stateRoot:
          values.stateRoot,
        authorizationFingerprint:
          values.claim.authorizationFingerprint
      });

    assert.equal(
      reopened.consumptionFingerprint,
      first.consumptionFingerprint
    );
  }
);

test(
  'G10 active exclusive lock denies a concurrent second transition',
  (t) => {
    const values =
      fixture(t);

    const lockRoot =
      path.join(
        values.stateRoot,
        '.g10-linearizable'
      );

    fs.mkdirSync(
      lockRoot,
      {
        mode: 0o700
      }
    );

    const lockFile =
      path.join(
        lockRoot,
        values.claim.authorizationFingerprint + '.lock'
      );

    fs.writeFileSync(
      lockFile,
      JSON.stringify({
        schema:
          'sdo.g10_linearization_lock.v1',
        authorizationFingerprint:
          values.claim.authorizationFingerprint,
        ownerProcess:
          'another-process'
      }) + '\n',
      {
        mode: 0o600
      }
    );

    assert.throws(
      () =>
        commit(values),
      /contended|reclamation is forbidden/i
    );

    const current =
      store.loadNaturalDevelopmentAuthorizationConsumption({
        stateRoot:
          values.stateRoot,
        authorizationFingerprint:
          values.claim.authorizationFingerprint
      });

    assert.equal(
      current.state,
      'CLAIMED'
    );
  }
);

test(
  'G10 adapter exposes no alternate physical mutation shell process network or provider authority',
  () => {
    const adapterSource =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/adapters/natural-development-linearizable-consumption'
        ),
        'utf8'
      );

    for (
      const forbidden
      of [
        'child_process',
        'spawn(',
        'exec(',
        'fetch(',
        'http.',
        'https.',
        'patchFileWithGrant',
        'orchestrate(',
        'FILESYSTEM_PATCH'
      ]
    ) {
      assert.equal(
        adapterSource.includes(forbidden),
        false,
        `forbidden G10 authority surface: ${forbidden}`
      );
    }

    assert.deepEqual(
      Object.keys(linearizable).sort(),
      [
        'SCHEMA',
        'commitLinearizableNaturalDevelopmentAuthorizationConsumption'
      ]
    );
  }
);

test(
  'G10 preserves the fixed G5 public composition surface',
  () => {
    const surface =
      require(
        '../../accelerator/cli/natural-development-r3-composition'
      );

    assert.deepEqual(
      Object.keys(surface).sort(),
      [
        'RESULT_SCHEMA',
        'composeAndDispatchNaturalDevelopmentPatch'
      ]
    );
  }
);
