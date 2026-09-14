'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  OBSERVATION_SCHEMA,
  observeCurrentAuthoritativeTarget
} = require('../../accelerator/core/authoritative-target-observation');
const {
  providerBoundary
} = require('../../accelerator/core/content-addressed-mutation-provider');
const {
  bootstrapManifestAuthority
} = require('../../accelerator/core/git-manifest-cas');

const BEFORE = 'const value = 1;\n';
const AFTER = 'const value = 2;\n';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function git(repository, args, input = null) {
  return childProcess.execFileSync('git', args, {
    cwd: repository,
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  }).trim();
}

function fixture(t) {
  const repository = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdo-authoritative-observation-')
  );
  t.after(() => fs.rmSync(repository, { recursive: true, force: true }));
  git(repository, ['init', '-q']);
  git(repository, ['config', 'user.email', 'observation@example.invalid']);
  git(repository, ['config', 'user.name', 'Observation Test']);
  fs.writeFileSync(path.join(repository, 'target.js'), BEFORE);
  git(repository, ['add', 'target.js']);
  git(repository, ['commit', '-qm', 'fixture']);
  return fs.realpathSync(repository);
}

function applyAuthoritative(repository, replacement = AFTER) {
  const request = Object.freeze({
    schema: 'sdo.compare_and_replace_request.v1',
    operation: 'COMPARE_AND_REPLACE',
    phase: 'AUTHORIZED_PATCH',
    transactionId: sha256(`transaction:${replacement}`),
    operationId: `observation:${sha256(replacement)}`,
    workspace: repository,
    target: path.join(repository, 'target.js'),
    beforeSha256: sha256(BEFORE),
    replacementSha256: sha256(replacement),
    replacementBase64: Buffer.from(replacement).toString('base64'),
    commitAuthorityFingerprint: sha256(`authority:${replacement}`)
  });
  const result = providerBoundary.compareAndReplace(request);
  assert.equal(result.outcome, 'APPLIED');
  return result;
}

function refPath(repository) {
  return path.join(
    git(repository, ['rev-parse', '--absolute-git-dir']),
    'refs',
    'surgical-devops',
    'workspace',
    sha256('target.js')
  );
}

test('authoritative observation preserves ordinary bootstrap evidence when no ref exists', (t) => {
  const repository = fixture(t);
  const beforeRefs = git(repository, ['for-each-ref']);
  const observed = observeCurrentAuthoritativeTarget({
    workspace: repository,
    target: 'target.js'
  });
  assert.equal(observed.schema, OBSERVATION_SCHEMA);
  assert.equal(observed.source, 'ORDINARY_BOOTSTRAP');
  assert.equal(observed.logicalTarget, 'target.js');
  assert.equal(observed.currentContent, BEFORE);
  assert.equal(observed.currentBytes, Buffer.byteLength(BEFORE));
  assert.equal(observed.currentSha256, sha256(BEFORE));
  assert.equal(observed.operationalAuthority, false);
  assert.equal(observed.mutationAuthority, false);
  assert.equal(observed.dispatchAuthority, false);
  assert.equal(Object.isFrozen(observed), true);
  assert.equal(git(repository, ['for-each-ref']), beforeRefs);
  assert.equal(fs.existsSync(refPath(repository)), false);
});

test('authoritative observation verifies the current manifest, blob and managed projection', (t) => {
  const repository = fixture(t);
  const applied = applyAuthoritative(repository);
  const authority = applied.durability.authority;
  const materialization = applied.durability.materialization;
  const projectionBefore = fs.readFileSync(materialization.projection);
  const refBefore = fs.readFileSync(refPath(repository));

  const observed = observeCurrentAuthoritativeTarget({
    workspace: repository,
    target: 'target.js'
  });
  const providerBootstrap = bootstrapManifestAuthority({
    workspace: repository,
    target: 'target.js',
    expectedBeforeSha256: sha256(AFTER),
    inspectOnly: true
  });

  assert.equal(observed.source, 'MANIFEST_CAS');
  assert.equal(observed.currentContent, AFTER);
  assert.equal(observed.currentSha256, sha256(AFTER));
  assert.equal(observed.manifestOid, authority.afterManifestOid);
  assert.equal(observed.blobOid, authority.replacementBlobOid);
  assert.equal(observed.managedProjection, materialization.projection);
  assert.equal(observed.ordinaryWorktreeAuthoritative, false);
  assert.equal(providerBootstrap.decision, 'EXISTING');
  assert.equal(providerBootstrap.contentSha256, sha256(AFTER));
  assert.equal(providerBootstrap.manifestOid, authority.afterManifestOid);
  assert.equal(fs.readFileSync(path.join(repository, 'target.js'), 'utf8'), BEFORE);
  assert.deepEqual(fs.readFileSync(materialization.projection), projectionBefore);
  assert.deepEqual(fs.readFileSync(refPath(repository)), refBefore);
});

test('authoritative observation never falls back when an existing ref is malformed', (t) => {
  const repository = fixture(t);
  const targetRef = refPath(repository);
  fs.mkdirSync(path.dirname(targetRef), { recursive: true });
  fs.writeFileSync(targetRef, 'not-an-object-id\n');

  assert.throws(
    () => observeCurrentAuthoritativeTarget({
      workspace: repository,
      target: 'target.js'
    }),
    /ref identity is malformed/i
  );
  assert.equal(fs.readFileSync(path.join(repository, 'target.js'), 'utf8'), BEFORE);
});

test('authoritative observation rejects missing objects and path-mismatched manifests', (t) => {
  const missingRepository = fixture(t);
  const missingRef = refPath(missingRepository);
  fs.mkdirSync(path.dirname(missingRef), { recursive: true });
  fs.writeFileSync(missingRef, `${'a'.repeat(40)}\n`);
  assert.throws(
    () => observeCurrentAuthoritativeTarget({
      workspace: missingRepository,
      target: 'target.js'
    }),
    /Git observation failed safely/i
  );

  const mismatchedRepository = fixture(t);
  const blobOid = git(
    mismatchedRepository,
    ['hash-object', '-w', '--stdin'],
    AFTER
  );
  const manifest = JSON.stringify({
    schema: 'sdo.content_addressed_manifest.v1',
    version: 1,
    path: 'other.js',
    blobOid,
    contentSha256: sha256(AFTER)
  }) + '\n';
  const manifestOid = git(
    mismatchedRepository,
    ['hash-object', '-w', '--stdin'],
    manifest
  );
  git(mismatchedRepository, [
    'update-ref',
    `refs/surgical-devops/workspace/${sha256('target.js')}`,
    manifestOid
  ]);
  assert.throws(
    () => observeCurrentAuthoritativeTarget({
      workspace: mismatchedRepository,
      target: 'target.js'
    }),
    /manifest is malformed or unbound/i
  );
});

test('authoritative observation rejects content and projection SHA mismatches', (t) => {
  const contentRepository = fixture(t);
  const blobOid = git(
    contentRepository,
    ['hash-object', '-w', '--stdin'],
    AFTER
  );
  const manifest = JSON.stringify({
    schema: 'sdo.content_addressed_manifest.v1',
    version: 1,
    path: 'target.js',
    blobOid,
    contentSha256: sha256('different\n')
  }) + '\n';
  const manifestOid = git(
    contentRepository,
    ['hash-object', '-w', '--stdin'],
    manifest
  );
  git(contentRepository, [
    'update-ref',
    `refs/surgical-devops/workspace/${sha256('target.js')}`,
    manifestOid
  ]);
  assert.throws(
    () => observeCurrentAuthoritativeTarget({
      workspace: contentRepository,
      target: 'target.js'
    }),
    /content SHA-256 mismatch/i
  );

  const projectionRepository = fixture(t);
  const applied = applyAuthoritative(projectionRepository);
  fs.writeFileSync(
    applied.durability.materialization.projection,
    'corrupt\n'
  );
  assert.throws(
    () => observeCurrentAuthoritativeTarget({
      workspace: projectionRepository,
      target: 'target.js'
    }),
    /projection identity mismatch/i
  );
  assert.equal(
    fs.readFileSync(path.join(projectionRepository, 'target.js'), 'utf8'),
    BEFORE
  );

  const missingProjectionRepository = fixture(t);
  const missingProjection = applyAuthoritative(missingProjectionRepository);
  fs.unlinkSync(missingProjection.durability.materialization.projection);
  assert.throws(
    () => observeCurrentAuthoritativeTarget({
      workspace: missingProjectionRepository,
      target: 'target.js'
    }),
    /projection is unavailable or unsafe/i
  );
  assert.equal(
    fs.readFileSync(path.join(missingProjectionRepository, 'target.js'), 'utf8'),
    BEFORE
  );
});

test('authoritative observation exports no writable or authority-minting surface', () => {
  const api = require('../../accelerator/core/authoritative-target-observation');
  assert.deepEqual(Object.keys(api).sort(), [
    'MAX_CONTENT_BYTES',
    'OBSERVATION_SCHEMA',
    'observeCurrentAuthoritativeTarget'
  ]);
  const source = fs.readFileSync(
    require.resolve('../../accelerator/core/authoritative-target-observation'),
    'utf8'
  );
  assert.doesNotMatch(source, /update-ref|hash-object|-w\b|shell:\s*true/);
});
