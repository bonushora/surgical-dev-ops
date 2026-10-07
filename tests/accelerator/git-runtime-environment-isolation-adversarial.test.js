'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');

const {
  bootstrapManifestAuthority,
  compareAndSwapManifest
} = require('../../accelerator/core/git-manifest-cas');
const {
  recoverAuthoritativeMaterialization
} = require('../../accelerator/core/git-manifest-materializer');
const {
  observeCurrentAuthoritativeTarget
} = require('../../accelerator/core/authoritative-target-observation');
const {
  createGitRuntimeIsolation
} = require('../../accelerator/adapters/git-runtime-isolation');

const TARGET = 'target.txt';
const BEFORE = 'before\n';

const AMBIENT_GIT_KEYS = Object.freeze([
  'GIT_CONFIG_GLOBAL',
  'GIT_CONFIG_SYSTEM',
  'GIT_CONFIG_NOSYSTEM',
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CEILING_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_SSH',
  'GIT_SSH_COMMAND',
  'GIT_PROXY_COMMAND'
]);

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function cleanGitEnvironment() {
  const environment = { ...process.env };
  for (const key of AMBIENT_GIT_KEYS) delete environment[key];
  return environment;
}

function git(repository, args, { allowFailure = false } = {}) {
  const result = require('node:child_process').spawnSync('git', args, {
    cwd: repository,
    env: cleanGitEnvironment(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(String(result.stderr || '').trim());
  }
  return {
    status: result.status,
    stdout: String(result.stdout || '').trim()
  };
}

function createRepository(repository, content = BEFORE) {
  fs.mkdirSync(repository);
  fs.writeFileSync(path.join(repository, TARGET), content);
  git(repository, ['init', '-b', 'main']);
  git(repository, ['config', 'user.email', 'git-runtime@example.invalid']);
  git(repository, ['config', 'user.name', 'Git Runtime Isolation']);
  git(repository, ['add', TARGET]);
  git(repository, ['commit', '-m', 'fixture']);
  return fs.realpathSync(repository);
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-git-runtime-'));
  const repositoryA = createRepository(path.join(root, 'repository-a'));
  const repositoryB = createRepository(path.join(root, 'repository-b'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, repositoryA, repositoryB };
}

function containmentFromCanonicalPaths(
  canonicalParent,
  canonicalChild,
  platform = process.platform
) {
  const platformPath = platform === 'win32' ? path.win32 : path.posix;
  const comparisonPath = (value) => {
    const normalized = platformPath.normalize(value);
    return platform === 'win32' ? normalized.toLowerCase() : normalized;
  };
  const comparisonParent = comparisonPath(canonicalParent);
  const comparisonChild = comparisonPath(canonicalChild);
  const sameRoot = (
    platformPath.parse(comparisonParent).root ===
    platformPath.parse(comparisonChild).root
  );
  const relative = platformPath.relative(
    comparisonParent,
    comparisonChild
  );
  const physicallyContained = (
    sameRoot &&
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${platformPath.sep}`) &&
    !platformPath.isAbsolute(relative)
  );
  return { relative, physicallyContained };
}

function physicalContainmentEvidence(parent, child) {
  const canonicalParent = path.normalize(fs.realpathSync.native(parent));
  const canonicalChild = path.normalize(fs.realpathSync.native(child));
  const containment = containmentFromCanonicalPaths(
    canonicalParent,
    canonicalChild
  );
  return {
    canonicalParent,
    canonicalChild,
    ...containment
  };
}

function withAmbientGit(values, callback) {
  const previous = new Map();
  for (const key of AMBIENT_GIT_KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }
  try {
    return callback();
  } finally {
    for (const key of AMBIENT_GIT_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function refAt(repository, ref) {
  return git(repository, ['rev-parse', '--verify', ref], {
    allowFailure: true
  });
}

function establishAuthority(repository, replacement) {
  const target = path.join(repository, TARGET);
  const authority = bootstrapManifestAuthority({
    workspace: repository,
    target,
    expectedBeforeSha256: sha(BEFORE)
  });
  const applied = compareAndSwapManifest({
    workspace: repository,
    target,
    expectedManifestOid: authority.manifestOid,
    expectedBeforeSha256: sha(BEFORE),
    replacement
  });
  const materialization = recoverAuthoritativeMaterialization({
    workspace: repository,
    target,
    expectedManifestOid: applied.afterManifestOid,
    expectedContentSha256: applied.replacementSha256
  });
  return { authority, applied, materialization };
}

test('shared Git runtime is explicit and cross-platform with no ambient authority keys', () => {
  for (const platform of ['linux', 'darwin', 'win32']) {
    const isolation = createGitRuntimeIsolation(platform);
    const nullDevice = platform === 'win32' ? 'NUL' : '/dev/null';
    assert.equal(isolation.environment.LANG, 'C');
    assert.equal(isolation.environment.LC_ALL, 'C');
    assert.equal(isolation.environment.GIT_TERMINAL_PROMPT, '0');
    assert.equal(isolation.environment.GIT_OPTIONAL_LOCKS, '0');
    assert.equal(isolation.environment.GIT_CONFIG_NOSYSTEM, '1');
    assert.equal(isolation.environment.GIT_CONFIG_GLOBAL, nullDevice);
    assert.equal(isolation.environment.GIT_CONFIG_SYSTEM, nullDevice);
    assert.ok(isolation.fixedConfig.includes('credential.helper='));
    assert.ok(isolation.fixedConfig.includes('core.fsmonitor='));
    assert.ok(isolation.fixedConfig.includes(`core.hooksPath=${nullDevice}`));
    assert.ok(isolation.fixedConfig.includes('diff.external='));
    assert.ok(isolation.fixedConfig.includes('diff.trustExitCode=false'));
    for (const key of AMBIENT_GIT_KEYS.slice(3)) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(isolation.environment, key),
        false,
        `${platform} runtime inherited ${key}`
      );
      assert.ok(isolation.clearedEnvironmentKeys.includes(key));
    }
  }
});

test('Windows physical containment comparison normalizes case separators and drive roots', () => {
  const parent = 'C:\\Users\\runneradmin\\repository-a\\.git';
  const child = 'c:/USERS/RUNNERADMIN/repository-a/.git/materialized/value.blob';
  const contained = containmentFromCanonicalPaths(parent, child, 'win32');
  assert.equal(contained.relative, 'materialized\\value.blob');
  assert.equal(contained.physicallyContained, true);

  assert.equal(
    containmentFromCanonicalPaths(
      parent,
      'C:\\Users\\runneradmin\\repository-a\\.git-hostile\\value.blob',
      'win32'
    ).physicallyContained,
    false
  );
  assert.equal(
    containmentFromCanonicalPaths(
      parent,
      'D:\\Users\\runneradmin\\repository-a\\.git\\value.blob',
      'win32'
    ).physicallyContained,
    false
  );
});

test('Manifest CAS cannot redirect refs to an ambient GIT_DIR/GIT_WORK_TREE repository', (t) => {
  const state = fixture(t);
  const result = withAmbientGit({
    GIT_DIR: path.join(state.repositoryB, '.git'),
    GIT_WORK_TREE: state.repositoryA,
    GIT_INDEX_FILE: path.join(state.repositoryB, '.git', 'index')
  }, () => bootstrapManifestAuthority({
    workspace: state.repositoryA,
    target: path.join(state.repositoryA, TARGET),
    expectedBeforeSha256: sha(BEFORE)
  }));

  const inA = refAt(state.repositoryA, result.ref);
  const inB = refAt(state.repositoryB, result.ref);
  assert.equal(inA.status, 0, 'authorized repository A must own the CAS ref');
  assert.equal(inA.stdout, result.manifestOid);
  assert.notEqual(inB.status, 0, 'ambient repository B must not receive the CAS ref');
});

test('Manifest CAS cannot redirect written objects through ambient object directories', (t) => {
  const state = fixture(t);
  const externalObjects = path.join(state.root, 'hostile-objects');
  fs.mkdirSync(externalObjects);
  const result = withAmbientGit({
    GIT_OBJECT_DIRECTORY: externalObjects,
    GIT_ALTERNATE_OBJECT_DIRECTORIES: path.join(state.repositoryB, '.git', 'objects'),
    GIT_CEILING_DIRECTORIES: state.root,
    GIT_COMMON_DIR: path.join(state.repositoryA, '.git')
  }, () => bootstrapManifestAuthority({
    workspace: state.repositoryA,
    target: path.join(state.repositoryA, TARGET),
    expectedBeforeSha256: sha(BEFORE)
  }));

  const localObject = path.join(
    state.repositoryA,
    '.git',
    'objects',
    result.manifestOid.slice(0, 2),
    result.manifestOid.slice(2)
  );
  const externalObject = path.join(
    externalObjects,
    result.manifestOid.slice(0, 2),
    result.manifestOid.slice(2)
  );
  assert.equal(fs.existsSync(localObject), true, 'authorized object store owns manifest');
  assert.equal(fs.existsSync(externalObject), false, 'ambient object store remains untouched');
});

test('ambient Git configuration cannot trigger a reference helper during Manifest CAS', (t) => {
  const state = fixture(t);
  const hooks = path.join(state.root, 'hooks');
  const marker = path.join(state.root, 'hostile-helper-ran');
  const config = path.join(state.root, 'hostile.gitconfig');
  fs.mkdirSync(hooks);
  const hook = path.join(hooks, 'reference-transaction');
  fs.writeFileSync(hook, `#!/bin/sh\n: > "${marker}"\n`);
  fs.chmodSync(hook, 0o700);
  execFileSync('git', [
    'config', '--file', config, 'core.hooksPath', hooks
  ], { env: cleanGitEnvironment() });
  for (const [key, value] of [
    ['core.fsmonitor', hook],
    ['diff.external', hook],
    ['credential.helper', hook],
    ['core.pager', hook],
    ['alias.rev-parse', `!${hook}`]
  ]) {
    execFileSync('git', ['config', '--file', config, key, value], {
      env: cleanGitEnvironment()
    });
  }

  withAmbientGit({
    GIT_CONFIG_GLOBAL: config,
    GIT_CONFIG_SYSTEM: config,
    GIT_CONFIG_NOSYSTEM: '0',
    GIT_SSH: hook,
    GIT_SSH_COMMAND: hook,
    GIT_PROXY_COMMAND: hook
  }, () => bootstrapManifestAuthority({
    workspace: state.repositoryA,
    target: path.join(state.repositoryA, TARGET),
    expectedBeforeSha256: sha(BEFORE)
  }));

  assert.equal(fs.existsSync(marker), false, 'ambient helper execution is forbidden');
});

test('materializer and authoritative observation remain bound to the exact authorized repository', (t) => {
  const state = fixture(t);
  const authorityA = establishAuthority(state.repositoryA, 'authority-a\n');
  establishAuthority(state.repositoryB, 'authority-b\n');

  const redirected = withAmbientGit({
    GIT_DIR: path.join(state.repositoryB, '.git'),
    GIT_WORK_TREE: state.repositoryA,
    GIT_INDEX_FILE: path.join(state.repositoryB, '.git', 'index')
  }, () => ({
    observation: observeCurrentAuthoritativeTarget({
      workspace: state.repositoryA,
      target: TARGET
    }),
    materialization: recoverAuthoritativeMaterialization({
      workspace: state.repositoryA,
      target: path.join(state.repositoryA, TARGET),
      expectedManifestOid: authorityA.applied.afterManifestOid,
      expectedContentSha256: authorityA.applied.replacementSha256
    })
  }));

  assert.equal(redirected.observation.workspace, state.repositoryA);
  assert.equal(redirected.observation.currentContent, 'authority-a\n');
  assert.equal(
    redirected.observation.manifestOid,
    authorityA.applied.afterManifestOid
  );
  assert.ok(
    ['MATERIALIZED', 'ALREADY_MATERIALIZED'].includes(
      redirected.materialization.decision
    )
  );
  assert.equal(
    redirected.materialization.observedManifestOid,
    authorityA.applied.afterManifestOid
  );
  const authorizedGitDir = path.join(state.repositoryA, '.git');
  const containment = physicalContainmentEvidence(
    authorizedGitDir,
    redirected.materialization.projection
  );
  const separatorNormalizedGitDir = authorizedGitDir.replace(
    /[\\/]+/g,
    path.sep
  );
  const separatorNormalizedProjection =
    redirected.materialization.projection.replace(/[\\/]+/g, path.sep);
  const lexicalPrefix = redirected.materialization.projection.startsWith(
    `${authorizedGitDir}${path.sep}`
  );
  const separatorNormalizedPrefix = separatorNormalizedProjection.startsWith(
    `${separatorNormalizedGitDir}${path.sep}`
  );
  const caseNormalizedPrefix = separatorNormalizedProjection
    .toLowerCase()
    .startsWith(`${separatorNormalizedGitDir.toLowerCase()}${path.sep}`);

  if (process.platform === 'win32') {
    const diagnostics = {
      AUTHORIZED_REPOSITORY_PATH: state.repositoryA,
      AUTHORIZED_REPOSITORY_REALPATH: fs.realpathSync(state.repositoryA),
      AUTHORIZED_GIT_DIR: authorizedGitDir,
      AUTHORIZED_GIT_DIR_REALPATH: containment.canonicalParent,
      MATERIALIZED_PATH: redirected.materialization.projection,
      MATERIALIZED_PATH_REALPATH: containment.canonicalChild,
      PATH_RELATIVE_FROM_AUTHORIZED_GIT_DIR: containment.relative,
      PATH_SEPARATOR: path.sep,
      PLATFORM: process.platform,
      DRIVE_LETTER_AUTHORIZED: path.parse(containment.canonicalParent).root,
      DRIVE_LETTER_MATERIALIZED: path.parse(containment.canonicalChild).root,
      CASE_ONLY_DIFFERENCE: (
        !separatorNormalizedPrefix && caseNormalizedPrefix ? 'YES' : 'NO'
      ),
      SEPARATOR_ONLY_DIFFERENCE: (
        !lexicalPrefix && separatorNormalizedPrefix ? 'YES' : 'NO'
      ),
      PHYSICAL_CONTAINMENT_TRUE: (
        containment.physicallyContained ? 'YES' : 'NO'
      )
    };
    for (const [key, value] of Object.entries(diagnostics)) {
      console.log(`${key}=${value}`);
    }
  }

  assert.notEqual(containment.relative, '');
  assert.notEqual(containment.relative, '..');
  assert.equal(containment.relative.startsWith(`..${path.sep}`), false);
  assert.equal(path.isAbsolute(containment.relative), false);
  assert.equal(containment.physicallyContained, true);
});
