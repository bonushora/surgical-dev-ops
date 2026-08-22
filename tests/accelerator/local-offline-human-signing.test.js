'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  provisionLocalOfflineHumanAuthority,
  loadLocalOfflineHumanSigner,
  readLocalOfflineHumanPublicAuthority
} = require(
  '../../accelerator/core/local-offline-human-authority-store'
);

const {
  createLocalOfflineHumanVerifier
} = require(
  '../../accelerator/adapters/local-offline-human-authority'
);

const {
  verifyHumanIdentityAssertion
} = require(
  '../../accelerator/adapters/identity-verification-adapter'
);

const {
  createAuthoritativeClock
} = require(
  '../../accelerator/core/authoritative-clock'
);

function fixture() {
  return fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'sdo-local-signing-'
    )
  );
}

function cleanup(root) {
  fs.rmSync(
    root,
    {
      recursive: true,
      force: true
    }
  );
}

function clock(now) {
  return createAuthoritativeClock({
    port: {
      read() {
        return {
          schema:
            'sdo.system_clock_observation.v1',
          availability:
            'AVAILABLE',
          source:
            'TEST',
          wallTime:
            now,
          monotonicNanoseconds:
            '1000000000'
        };
      }
    }
  });
}

test(
  'provisioning creates an Ed25519 authority without returning private key material',
  () => {
    const root = fixture();

    try {
      const authorityRoot =
        path.join(
          root,
          'authority'
        );

      const result =
        provisionLocalOfflineHumanAuthority({
          authorityRoot,
          issuer:
            'local:human-1',
          subjectId:
            'human-1'
        });

      assert.equal(
        result.algorithm,
        'Ed25519'
      );

      assert.equal(
        'privateKeyPem' in result,
        false
      );

      assert.equal(
        'privateKeyPath' in result,
        false
      );

      assert.equal(
        fs.existsSync(
          path.join(
            authorityRoot,
            'private-key.pem'
          )
        ),
        true
      );
    } finally {
      cleanup(root);
    }
  }
);

test(
  'provisioned signer and public verifier complete an operation-bound signature round trip',
  () => {
    const root = fixture();

    try {
      const authorityRoot =
        path.join(
          root,
          'authority'
        );

      provisionLocalOfflineHumanAuthority({
        authorityRoot,
        issuer:
          'local:human-1',
        subjectId:
          'human-1'
      });

      const signer =
        loadLocalOfflineHumanSigner({
          authorityRoot
        });

      const publicAuthority =
        readLocalOfflineHumanPublicAuthority({
          authorityRoot
        });

      const verifier =
        createLocalOfflineHumanVerifier({
          publicKeyPem:
            publicAuthority.publicKeyPem,
          issuer:
            publicAuthority.issuer,
          subjectId:
            publicAuthority.subjectId
        });

      const issuedAt =
        '2026-08-22T12:00:00.000Z';

      const expiresAt =
        '2026-08-22T12:05:00.000Z';

      const workspace =
        fs.realpathSync(root);

      const challenge = {
        schema:
          'sdo.local_offline_human_challenge.v1',
        challengeId:
          'challenge-1',
        issuer:
          'local:human-1',
        subjectId:
          'human-1',
        audience:
          ['surgical-devops'],
        operationId:
          'op-1',
        workspace,
        tenantId:
          'tenant-1',
        projectId:
          'project-1',
        issuedAt,
        expiresAt
      };

      const signed =
        signer.signChallenge(
          challenge
        );

      const result =
        verifyHumanIdentityAssertion(
          {
            rawAssertion:
              signed,

            trustedIssuers:
              ['local:human-1'],

            expected: {
              subjectId:
                'human-1',
              audience:
                'surgical-devops',
              operationId:
                'op-1',
              workspace,
              tenantId:
                'tenant-1',
              projectId:
                'project-1'
            }
          },

          verifier,

          {
            reading:
              clock(
                '2026-08-22T12:00:01.000Z'
              ).read(),

            requireCurrent:
              true
          }
        );

      assert.equal(
        result.decision,
        'VERIFIED'
      );
    } finally {
      cleanup(root);
    }
  }
);

test(
  'authority provisioning refuses overwrite',
  () => {
    const root = fixture();

    try {
      const authorityRoot =
        path.join(
          root,
          'authority'
        );

      provisionLocalOfflineHumanAuthority({
        authorityRoot,
        issuer:
          'local:human-1',
        subjectId:
          'human-1'
      });

      assert.throws(
        () =>
          provisionLocalOfflineHumanAuthority({
            authorityRoot,
            issuer:
              'local:human-1',
            subjectId:
              'human-1'
          }),
        /already exists|overwrite/i
      );
    } finally {
      cleanup(root);
    }
  }
);

test(
  'authority loader rejects symlink authority roots',
  () => {
    const root = fixture();

    try {
      const authorityRoot =
        path.join(
          root,
          'authority'
        );

      provisionLocalOfflineHumanAuthority({
        authorityRoot,
        issuer:
          'local:human-1',
        subjectId:
          'human-1'
      });

      const alias =
        path.join(
          root,
          'alias'
        );

      fs.symlinkSync(
        authorityRoot,
        alias
      );

      assert.throws(
        () =>
          loadLocalOfflineHumanSigner({
            authorityRoot: alias
          }),
        /physical|canonical|unsafe/i
      );
    } finally {
      cleanup(root);
    }
  }
);

test(
  'private signing key is owner-only on POSIX platforms',
  {
    skip:
      process.platform === 'win32'
        ? 'POSIX permission qualification.'
        : false
  },
  () => {
    const root = fixture();

    try {
      const authorityRoot =
        path.join(
          root,
          'authority'
        );

      provisionLocalOfflineHumanAuthority({
        authorityRoot,
        issuer:
          'local:human-1',
        subjectId:
          'human-1'
      });

      const privateMode =
        fs.statSync(
          path.join(
            authorityRoot,
            'private-key.pem'
          )
        ).mode & 0o777;

      assert.equal(
        privateMode,
        0o600
      );
    } finally {
      cleanup(root);
    }
  }
);

test(
  'production runtime has no dependency on signer or provisioning authority',
  () => {
    const runtimeSource =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/core/production-mutation-runtime'
        ),
        'utf8'
      );

    assert.doesNotMatch(
      runtimeSource,
      /local-offline-human-signer/
    );

    assert.doesNotMatch(
      runtimeSource,
      /local-offline-human-authority-store/
    );

    assert.doesNotMatch(
      runtimeSource,
      /private-key\.pem/
    );

    assert.doesNotMatch(
      runtimeSource,
      /crypto\.sign/
    );
  }
);

test(
  'signing and provisioning modules expose no shell or generic process authority',
  () => {
    for (const target of [
      '../../accelerator/adapters/local-offline-human-signer',
      '../../accelerator/core/local-offline-human-authority-store'
    ]) {
      const source =
        fs.readFileSync(
          require.resolve(target),
          'utf8'
        );

      assert.doesNotMatch(
        source,
        /child_process|execSync|spawnSync|shell/
      );
    }
  }
);
