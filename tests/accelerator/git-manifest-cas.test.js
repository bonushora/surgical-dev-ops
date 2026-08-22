'use strict';

const test = require('node:test');
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

function digest(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

function git(repo, args) {
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
        'sdo-manifest-cas-'
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
      'cas@example.invalid'
    ]
  );

  git(
    repo,
    [
      'config',
      'user.name',
      'CAS Test'
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

  git(repo, ['add', 'target.txt']);
  git(repo, ['commit', '-m', 'baseline']);

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

test(
  'bootstrap binds the physical BEFORE state into an immutable authoritative manifest',
  (t) => {
    const { repo, target } =
      fixture(t);

    const before =
      fs.readFileSync(target);

    const result =
      bootstrapManifestAuthority({
        workspace: repo,
        target,
        expectedBeforeSha256:
          digest(before)
      });

    assert.equal(
      result.decision,
      'CREATED'
    );

    assert.match(
      result.ref,
      /^refs\/surgical-devops\/workspace\/[a-f0-9]{64}$/
    );

    assert.match(
      result.manifestOid,
      /^[a-f0-9]{40,64}$/
    );

    assert.equal(
      result.contentSha256,
      digest(before)
    );

    assert.ok(
      Object.isFrozen(result)
    );
  }
);

test(
  'identical bootstrap converges without creating competing authority',
  (t) => {
    const { repo, target } =
      fixture(t);

    const beforeHash =
      digest(
        fs.readFileSync(target)
      );

    const first =
      bootstrapManifestAuthority({
        workspace: repo,
        target,
        expectedBeforeSha256:
          beforeHash
      });

    const second =
      bootstrapManifestAuthority({
        workspace: repo,
        target,
        expectedBeforeSha256:
          beforeHash
      });

    assert.equal(
      second.decision,
      'EXISTING'
    );

    assert.equal(
      second.manifestOid,
      first.manifestOid
    );
  }
);

test(
  'manifest CAS advances authority without mutating the worktree projection',
  (t) => {
    const { repo, target } =
      fixture(t);

    const before =
      fs.readFileSync(target);

    const authority =
      bootstrapManifestAuthority({
        workspace: repo,
        target,
        expectedBeforeSha256:
          digest(before)
      });

    const result =
      compareAndSwapManifest({
        workspace: repo,
        target,
        expectedManifestOid:
          authority.manifestOid,
        expectedBeforeSha256:
          digest(before),
        replacement: 'after\n'
      });

    assert.equal(
      result.decision,
      'APPLIED'
    );

    assert.equal(
      result.beforeManifestOid,
      authority.manifestOid
    );

    assert.notEqual(
      result.afterManifestOid,
      authority.manifestOid
    );

    assert.equal(
      result.replacementSha256,
      digest('after\n')
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
  'two writers starting from the same authoritative state cannot both win',
  (t) => {
    const { repo, target } =
      fixture(t);

    const before =
      fs.readFileSync(target);

    const beforeHash =
      digest(before);

    const authority =
      bootstrapManifestAuthority({
        workspace: repo,
        target,
        expectedBeforeSha256:
          beforeHash
      });

    const first =
      compareAndSwapManifest({
        workspace: repo,
        target,
        expectedManifestOid:
          authority.manifestOid,
        expectedBeforeSha256:
          beforeHash,
        replacement:
          'writer-one\n'
      });

    const second =
      compareAndSwapManifest({
        workspace: repo,
        target,
        expectedManifestOid:
          authority.manifestOid,
        expectedBeforeSha256:
          beforeHash,
        replacement:
          'writer-two\n'
      });

    assert.equal(
      first.decision,
      'APPLIED'
    );

    assert.equal(
      second.decision,
      'MISMATCH'
    );

    assert.equal(
      second.observedManifestOid,
      first.afterManifestOid
    );
  }
);

test(
  'stale expected manifest fails closed and cannot overwrite current authority',
  (t) => {
    const { repo, target } =
      fixture(t);

    const beforeHash =
      digest(
        fs.readFileSync(target)
      );

    const authority =
      bootstrapManifestAuthority({
        workspace: repo,
        target,
        expectedBeforeSha256:
          beforeHash
      });

    const first =
      compareAndSwapManifest({
        workspace: repo,
        target,
        expectedManifestOid:
          authority.manifestOid,
        expectedBeforeSha256:
          beforeHash,
        replacement:
          'authorized\n'
      });

    const stale =
      compareAndSwapManifest({
        workspace: repo,
        target,
        expectedManifestOid:
          authority.manifestOid,
        expectedBeforeSha256:
          beforeHash,
        replacement:
          'stale\n'
      });

    assert.equal(
      stale.decision,
      'MISMATCH'
    );

    const refOid =
      git(
        repo,
        [
          'rev-parse',
          '--verify',
          first.ref
        ]
      );

    assert.equal(
      refOid,
      first.afterManifestOid
    );
  }
);

test(
  'conflicting physical bootstrap cannot silently redefine an existing authority',
  (t) => {
    const { repo, target } =
      fixture(t);

    const beforeHash =
      digest(
        fs.readFileSync(target)
      );

    bootstrapManifestAuthority({
      workspace: repo,
      target,
      expectedBeforeSha256:
        beforeHash
    });

    fs.writeFileSync(
      target,
      'external-change\n'
    );

    assert.throws(
      () =>
        bootstrapManifestAuthority({
          workspace: repo,
          target,
          expectedBeforeSha256:
            digest('external-change\n')
        }),
      /conflicts/
    );
  }
);

test(
  'authority surface exposes no arbitrary Git command or caller-selected ref',
  () => {
    const source =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/core/git-manifest-cas'
        ),
        'utf8'
      );

    assert.match(
      source,
      /refs\/surgical-devops\/workspace\//
    );

    assert.match(
      source,
      /update-ref/
    );

    assert.match(
      source,
      /hash-object/
    );

    assert.match(
      source,
      /shell:\s*false/
    );

    assert.doesNotMatch(
      source,
      /execSync|shell:\s*true/
    );

    const exportedSurface =
      require(
        '../../accelerator/core/git-manifest-cas'
      );

    assert.deepEqual(
      Object.keys(exportedSurface).sort(),
      [
        'MANIFEST_SCHEMA',
        'RESULT_SCHEMA',
        'bootstrapManifestAuthority',
        'compareAndSwapManifest'
      ].sort()
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        exportedSurface,
        'runGit'
      ),
      false
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        exportedSurface,
        'createRefCas'
      ),
      false
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        exportedSurface,
        'readRef'
      ),
      false
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        exportedSurface,
        'refFor'
      ),
      false
    );
  }
);
