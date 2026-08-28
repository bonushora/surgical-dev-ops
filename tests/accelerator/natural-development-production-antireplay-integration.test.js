'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const path =
  require('node:path');

const {
  createNaturalDevelopmentAuthorizationClaim
} = require(
  '../../accelerator/cli/natural-development-authorization-consumption'
);

const store =
  require(
    '../../accelerator/adapters/natural-development-authorization-consumption-store'
  );

const G5_PATH =
  require.resolve(
    '../../accelerator/cli/natural-development-r3-composition'
  );

test(
  'G9 places durable G7 claim immediately before the one real G5 orchestrator dispatch',
  () => {
    const source =
      fs.readFileSync(
        G5_PATH,
        'utf8'
      );

    const marker =
      source.indexOf(
        'G9_DURABLE_CLAIM_BEFORE_REAL_G5_DISPATCH'
      );

    const claim =
      source.indexOf(
        '_g9ClaimBeforeRealG5Dispatch(arguments);'
      );

    const orchestrate =
      source.indexOf(
        'orchestrate(',
        claim
      );

    assert.notEqual(marker, -1);
    assert.notEqual(claim, -1);
    assert.notEqual(orchestrate, -1);
    assert.ok(claim < orchestrate);

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
  'G9 real G5 source consumes the qualified G7 store rather than creating another mutation primitive',
  () => {
    const source =
      fs.readFileSync(
        G5_PATH,
        'utf8'
      );

    assert.equal(
      source.includes(
        'natural-development-authorization-consumption-store'
      ),
      true
    );

    assert.equal(
      source.includes(
        'createNaturalDevelopmentAuthorizationClaim'
      ),
      true
    );

    for (
      const forbidden
      of [
        'child_process',
        'spawn(',
        'exec(',
        'fetch(',
        'unlinkSync',
        'rmSync',
        'renameSync',
        'writeFileSync'
      ]
    ) {
      assert.equal(
        source.includes(forbidden),
        false,
        `G9 introduced forbidden authority: ${forbidden}`
      );
    }
  }
);

test(
  'G9 durable store itself denies a second exact claim after process-style reopen',
  (t) => {
    const os =
      require('node:os');

    const crypto =
      require('node:crypto');

    const hash =
      (value) =>
        crypto
          .createHash('sha256')
          .update(value)
          .digest('hex');

    const root =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          'sdo-g9-claim-'
        )
      );

    t.after(
      () =>
        fs.rmSync(
          root,
          {
            recursive: true,
            force: true
          }
        )
    );

    const authorization =
      Object.freeze({
        authorizationFingerprint:
          hash('g9-authorization'),
        singleUse: true,
        reusable: false,
        operationalAuthority: false,
        mutationAuthority: false,
        dispatchAuthority: false
      });

    const claim =
      createNaturalDevelopmentAuthorizationClaim({
        authorization,
        operationId:
          'operation:g9:qualification',
        physicalWorkspaceIdentity:
          hash('workspace'),
        target:
          'accelerator/example.js',
        beforeSha256:
          hash('before'),
        replacementSha256:
          hash('replacement')
      });

    const receipt =
      store
        .claimNaturalDevelopmentAuthorization({
          stateRoot:
            root,
          claim
        });

    assert.equal(
      receipt.state,
      'CLAIMED'
    );

    const reopened =
      store
        .loadNaturalDevelopmentAuthorizationConsumption({
          stateRoot:
            root,
          authorizationFingerprint:
            claim.authorizationFingerprint
        });

    assert.equal(
      reopened.claimFingerprint,
      claim.claimFingerprint
    );

    assert.throws(
      () =>
        store
          .claimNaturalDevelopmentAuthorization({
            stateRoot:
              root,
            claim
          }),
      /replay denied|durable claim/i
    );
  }
);

test(
  'G9 preserves the one fixed G5 public composition surface',
  () => {
    const surface =
      require(
        '../../accelerator/cli/natural-development-r3-composition'
      );

    const keys =
      Object.keys(surface).sort();

    assert.deepEqual(
      keys,
      [
        'RESULT_SCHEMA',
        'composeAndDispatchNaturalDevelopmentPatch'
      ]
    );

    assert.equal(
      typeof surface.composeAndDispatchNaturalDevelopmentPatch,
      'function'
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        surface,
        'RESULT_SCHEMA'
      ),
      true
    );

    assert.notEqual(
      surface.RESULT_SCHEMA,
      undefined
    );

    assert.notEqual(
      surface.RESULT_SCHEMA,
      null
    );
  }
);
