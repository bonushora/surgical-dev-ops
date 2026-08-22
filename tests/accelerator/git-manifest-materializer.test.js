'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const crypto =
  require('node:crypto');

const fs =
  require('node:fs');

const os =
  require('node:os');

const path =
  require('node:path');

const childProcess =
  require('node:child_process');

const {
  bootstrapManifestAuthority,
  compareAndSwapManifest
} = require(
  '../../accelerator/core/git-manifest-cas'
);

const {
  recoverAuthoritativeMaterialization
} = require(
  '../../accelerator/core/git-manifest-materializer'
);

function digest(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

function git(
  repo,
  args
) {
  return childProcess.execFileSync(
    'git',
    [
      '-C',
      repo,
      ...args
    ],
    {
      encoding: 'utf8',
      stdio: [
        'ignore',
        'pipe',
        'pipe'
      ]
    }
  ).trim();
}

function fixture(t) {
  const repo =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'sdo-materialization-'
      )
    );

  git(
    repo,
    [
      'init',
      '-b',
      'main'
    ]
  );

  git(
    repo,
    [
      'config',
      'user.email',
      'materialization@example.invalid'
    ]
  );

  git(
    repo,
    [
      'config',
      'user.name',
      'Materialization Test'
    ]
  );

  const target =
    path.join(
      repo,
      'target.txt'
    );

  fs.writeFileSync(
    target,
    'before\n'
  );

  git(
    repo,
    [
      'add',
      'target.txt'
    ]
  );

  git(
    repo,
    [
      'commit',
      '-m',
      'baseline'
    ]
  );

  t.after(() => {
    fs.rmSync(
      repo,
      {
        recursive: true,
        force: true
      }
    );
  });

  return {
    repo:
      fs.realpathSync(repo),
    target:
      fs.realpathSync(target)
  };
}

function authoritativeAfter(
  repo,
  target,
  replacement
) {
  const before =
    fs.readFileSync(target);

  const authority =
    bootstrapManifestAuthority({
      workspace: repo,
      target,
      expectedBeforeSha256:
        digest(before)
    });

  const applied =
    compareAndSwapManifest({
      workspace: repo,
      target,
      expectedManifestOid:
        authority.manifestOid,
      expectedBeforeSha256:
        digest(before),
      replacement
    });

  assert.equal(
    applied.decision,
    'APPLIED'
  );

  return {
    authority,
    applied
  };
}

test(
  'restart after authoritative CAS materializes the missing immutable generation',
  (t) => {
    const {
      repo,
      target
    } = fixture(t);

    const {
      applied
    } =
      authoritativeAfter(
        repo,
        target,
        'after\n'
      );

    /*
     * Simulated crash boundary:
     * CAS is already committed, but no projection exists yet.
     */

    const recovered =
      recoverAuthoritativeMaterialization({
        workspace: repo,
        target,
        expectedManifestOid:
          applied.afterManifestOid
      });

    assert.equal(
      recovered.decision,
      'MATERIALIZED'
    );

    assert.ok(
      path.isAbsolute(
        recovered.projection
      )
    );

    assert.equal(
      fs.readFileSync(
        recovered.projection,
        'utf8'
      ),
      'after\n'
    );

    assert.equal(
      digest(
        fs.readFileSync(
          recovered.projection
        )
      ),
      applied.replacementSha256
    );

    assert.equal(
      fs.readFileSync(
        target,
        'utf8'
      ),
      'before\n'
    );
  }
);

test(
  'restart recovery is idempotent and does not create duplicate authority',
  (t) => {
    const {
      repo,
      target
    } = fixture(t);

    const {
      applied
    } =
      authoritativeAfter(
        repo,
        target,
        'after\n'
      );

    const first =
      recoverAuthoritativeMaterialization({
        workspace: repo,
        target,
        expectedManifestOid:
          applied.afterManifestOid
      });

    const second =
      recoverAuthoritativeMaterialization({
        workspace: repo,
        target,
        expectedManifestOid:
          applied.afterManifestOid
      });

    assert.equal(
      first.decision,
      'MATERIALIZED'
    );

    assert.equal(
      second.decision,
      'ALREADY_MATERIALIZED'
    );

    assert.equal(
      second.projection,
      first.projection
    );

    assert.equal(
      fs.readFileSync(
        second.projection,
        'utf8'
      ),
      'after\n'
    );
  }
);

test(
  'stale recovery request cannot materialize a superseded authority',
  (t) => {
    const {
      repo,
      target
    } = fixture(t);

    const before =
      fs.readFileSync(target);

    const authority =
      bootstrapManifestAuthority({
        workspace: repo,
        target,
        expectedBeforeSha256:
          digest(before)
      });

    const first =
      compareAndSwapManifest({
        workspace: repo,
        target,
        expectedManifestOid:
          authority.manifestOid,
        expectedBeforeSha256:
          digest(before),
        replacement:
          'first\n'
      });

    const second =
      compareAndSwapManifest({
        workspace: repo,
        target,
        expectedManifestOid:
          first.afterManifestOid,
        expectedBeforeSha256:
          first.replacementSha256,
        replacement:
          'second\n'
      });

    assert.equal(
      second.decision,
      'APPLIED'
    );

    const stale =
      recoverAuthoritativeMaterialization({
        workspace: repo,
        target,
        expectedManifestOid:
          first.afterManifestOid
      });

    assert.equal(
      stale.decision,
      'AUTHORITY_MISMATCH'
    );

    assert.equal(
      stale.observedManifestOid,
      second.afterManifestOid
    );

    assert.equal(
      stale.projection,
      null
    );
  }
);

test(
  'external worktree writer cannot redefine manifest authority during recovery',
  (t) => {
    const {
      repo,
      target
    } = fixture(t);

    const {
      applied
    } =
      authoritativeAfter(
        repo,
        target,
        'authoritative\n'
      );

    fs.writeFileSync(
      target,
      'external-writer\n'
    );

    const result =
      recoverAuthoritativeMaterialization({
        workspace: repo,
        target,
        expectedManifestOid:
          applied.afterManifestOid
      });

    assert.equal(
      result.decision,
      'MATERIALIZED'
    );

    assert.equal(
      fs.readFileSync(
        result.projection,
        'utf8'
      ),
      'authoritative\n'
    );

    assert.equal(
      fs.readFileSync(
        target,
        'utf8'
      ),
      'external-writer\n'
    );
  }
);

test(
  'corrupt managed projection is never overwritten silently',
  (t) => {
    const {
      repo,
      target
    } = fixture(t);

    const {
      applied
    } =
      authoritativeAfter(
        repo,
        target,
        'after\n'
      );

    const first =
      recoverAuthoritativeMaterialization({
        workspace: repo,
        target,
        expectedManifestOid:
          applied.afterManifestOid
      });

    assert.equal(
      first.decision,
      'MATERIALIZED'
    );

    fs.writeFileSync(
      first.projection,
      'corrupt\n'
    );

    const second =
      recoverAuthoritativeMaterialization({
        workspace: repo,
        target,
        expectedManifestOid:
          applied.afterManifestOid
      });

    assert.equal(
      second.decision,
      'RECOVERY_REQUIRED'
    );

    assert.match(
      second.reason,
      /corrupt|conflicting/
    );

    assert.equal(
      fs.readFileSync(
        first.projection,
        'utf8'
      ),
      'corrupt\n'
    );
  }
);

test(
  'managed generation identity is content-addressed by authoritative manifest',
  (t) => {
    const {
      repo,
      target
    } = fixture(t);

    const {
      applied
    } =
      authoritativeAfter(
        repo,
        target,
        'after\n'
      );

    const result =
      recoverAuthoritativeMaterialization({
        workspace: repo,
        target,
        expectedManifestOid:
          applied.afterManifestOid
      });

    assert.match(
      result.projection,
      new RegExp(
        `${applied.afterManifestOid}\\.blob$`
      )
    );

    assert.equal(
      result.contentSha256,
      applied.replacementSha256
    );
  }
);

test(
  'materializer exports no Git write authority and no arbitrary command surface',
  () => {
    const surface =
      require(
        '../../accelerator/core/git-manifest-materializer'
      );

    assert.deepEqual(
      Object.keys(
        surface
      ).sort(),
      [
        'MATERIALIZATION_SCHEMA',
        'recoverAuthoritativeMaterialization'
      ].sort()
    );

    const source =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/core/git-manifest-materializer'
        ),
        'utf8'
      );

    assert.match(
      source,
      /shell:\s*false/
    );

    assert.doesNotMatch(
      source,
      /update-ref/
    );

    assert.doesNotMatch(
      source,
      /hash-object/
    );

    assert.doesNotMatch(
      source,
      /execSync|shell:\s*true/
    );
  }
);
