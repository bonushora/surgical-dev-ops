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

test(
  'authority loader accepts a physical authority reached through a lexical ancestor alias',
  (t) => {
    /*
     * Provisioning itself continues to require a physical
     * parent directory. We first create the authority through
     * that physical path and only then expose the same
     * authority through an ancestor lexical alias.
     *
     * This models macOS /var -> /private/var semantics without
     * weakening the provisioning boundary.
     */

    const physicalParent =
      fs.mkdtempSync(
        path.join(
          fs.realpathSync(os.tmpdir()),
          'sdo-authority-physical-'
        )
      );

    const physicalAuthorityRoot =
      path.join(
        physicalParent,
        'authority'
      );

    const aliasParent =
      path.join(
        fs.realpathSync(os.tmpdir()),
        `sdo-authority-alias-${process.pid}-${Date.now()}`
      );

    t.after(() => {
      try {
        fs.rmSync(
          aliasParent,
          {
            recursive: true,
            force: true
          }
        );
      } catch {}

      fs.rmSync(
        physicalParent,
        {
          recursive: true,
          force: true
        }
      );
    });

    const provisioned =
      provisionLocalOfflineHumanAuthority({
        authorityRoot:
          physicalAuthorityRoot,

        issuer:
          'local:human-alias',

        subjectId:
          'human-alias'
      });

    assert.equal(
      provisioned.authorityRoot,
      fs.realpathSync(
        physicalAuthorityRoot
      )
    );

    try {
      fs.symlinkSync(
        physicalParent,
        aliasParent,
        'dir'
      );
    } catch (error) {
      if (
        [
          'EPERM',
          'EACCES',
          'ENOTSUP'
        ].includes(error.code)
      ) {
        return t.skip(
          'Directory symlink creation is unavailable on this platform.'
        );
      }

      throw error;
    }

    const lexicalAuthorityRoot =
      path.join(
        aliasParent,
        'authority'
      );

    /*
     * The authority directory itself is NOT a symlink.
     * Only an ancestor component is lexically aliased.
     */
    const lexicalStat =
      fs.lstatSync(
        lexicalAuthorityRoot
      );

    assert.equal(
      lexicalStat.isDirectory(),
      true
    );

    assert.equal(
      lexicalStat.isSymbolicLink(),
      false
    );

    assert.notEqual(
      lexicalAuthorityRoot,
      fs.realpathSync(
        lexicalAuthorityRoot
      )
    );

    assert.equal(
      fs.realpathSync(
        lexicalAuthorityRoot
      ),
      provisioned.authorityRoot
    );

    const signer =
      loadLocalOfflineHumanSigner({
        authorityRoot:
          lexicalAuthorityRoot
      });

    const publicAuthority =
      readLocalOfflineHumanPublicAuthority({
        authorityRoot:
          lexicalAuthorityRoot
      });

    assert.equal(
      typeof signer.signChallenge,
      'function'
    );

    assert.equal(
      publicAuthority.issuer,
      'local:human-alias'
    );

    assert.equal(
      publicAuthority.subjectId,
      'human-alias'
    );
  }
);

test('authority qualification rejects missing and corrupt state', (t) => {
  const root = fixture();
  t.after(() => cleanup(root));
  const authorityRoot = path.join(root, 'authority');
  provisionLocalOfflineHumanAuthority({
    authorityRoot,
    issuer: 'local:negative-state',
    subjectId: 'negative-human'
  });
  fs.rmSync(path.join(authorityRoot, 'public-key.pem'));
  assert.throws(
    () => readLocalOfflineHumanPublicAuthority({ authorityRoot }),
    /missing|unknown/i
  );
  fs.writeFileSync(path.join(authorityRoot, 'public-key.pem'), 'not a public key', {
    mode: 0o600
  });
  assert.throws(
    () => readLocalOfflineHumanPublicAuthority({ authorityRoot }),
    /malformed/i
  );
  fs.writeFileSync(path.join(authorityRoot, 'unknown-state'), 'unknown\n', {
    mode: 0o600
  });
  assert.throws(
    () => readLocalOfflineHumanPublicAuthority({ authorityRoot }),
    /missing|unknown/i
  );
});

test('authority qualification rejects unsafe permissions and symlink files', {
  skip: process.platform === 'win32' ? 'POSIX authority confinement.' : false
}, (t) => {
  const root = fixture();
  t.after(() => cleanup(root));
  const authorityRoot = path.join(root, 'authority');
  provisionLocalOfflineHumanAuthority({
    authorityRoot,
    issuer: 'local:negative-confinement',
    subjectId: 'negative-human'
  });
  const metadata = path.join(authorityRoot, 'authority.json');
  fs.chmodSync(metadata, 0o644);
  assert.throws(
    () => loadLocalOfflineHumanSigner({ authorityRoot }),
    /permissions|ownership/i
  );
  fs.chmodSync(metadata, 0o600);
  const privateKey = path.join(authorityRoot, 'private-key.pem');
  const outsideKey = path.join(root, 'outside-private-key.pem');
  fs.renameSync(privateKey, outsideKey);
  fs.symlinkSync(outsideKey, privateKey);
  assert.throws(
    () => loadLocalOfflineHumanSigner({ authorityRoot }),
    /unsafe/i
  );
});

test('authority qualification rejects signer and public key mismatch', (t) => {
  const root = fixture();
  t.after(() => cleanup(root));
  const authorityRoot = path.join(root, 'authority-a');
  const otherRoot = path.join(root, 'authority-b');
  provisionLocalOfflineHumanAuthority({
    authorityRoot,
    issuer: 'local:mismatch-a',
    subjectId: 'human-a'
  });
  provisionLocalOfflineHumanAuthority({
    authorityRoot: otherRoot,
    issuer: 'local:mismatch-b',
    subjectId: 'human-b'
  });
  fs.copyFileSync(
    path.join(otherRoot, 'public-key.pem'),
    path.join(authorityRoot, 'public-key.pem')
  );
  if (process.platform !== 'win32') {
    fs.chmodSync(path.join(authorityRoot, 'public-key.pem'), 0o600);
  }
  assert.throws(
    () => loadLocalOfflineHumanSigner({ authorityRoot }),
    /mismatched/i
  );
});
