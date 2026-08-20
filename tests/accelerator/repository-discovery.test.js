'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { discover } = require('../../accelerator/core/repository-discovery');

function git(workspace, args) {
  return childProcess.execFileSync('git', args, {
    cwd: workspace, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-discovery-'));
  const workspace = path.join(root, 'repository');
  fs.mkdirSync(workspace);
  git(workspace, ['init', '-b', 'main']);
  git(workspace, ['config', 'user.email', 'sdo-test@example.invalid']);
  git(workspace, ['config', 'user.name', 'Surgical DevOps Test']);
  fs.writeFileSync(path.join(workspace, 'package.json'), '{}\n');
  fs.writeFileSync(path.join(workspace, 'index.js'), 'module.exports = true;\n');
  git(workspace, ['add', 'package.json', 'index.js']);
  git(workspace, ['commit', '-m', 'fixture baseline']);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, workspace: fs.realpathSync(workspace) };
}

test('discovers canonical repository identity and physical Git anchor', (t) => {
  const { workspace } = fixture(t);
  const result = discover(workspace);
  assert.equal(result.schema, 'sdo.repository_discovery.v1');
  assert.equal(result.repository.path, workspace);
  assert.equal(result.repository.branch, 'main');
  assert.equal(result.repository.commit, git(workspace, ['rev-parse', 'HEAD']));
  assert.equal(result.repository.shortCommit, git(workspace, ['rev-parse', '--short', 'HEAD']));
});

test('discovers project files languages and tracked-file count', (t) => {
  const { workspace } = fixture(t);
  const result = discover(workspace);
  assert.deepEqual(result.project.projectFiles, ['package.json']);
  assert.deepEqual(result.project.languages, ['JavaScript']);
  assert.equal(result.statistics.trackedFiles, 2);
  assert.equal(result.project.packageManager, null);
});

test('reports clean and dirty worktree state from physical Git evidence', (t) => {
  const { workspace } = fixture(t);
  assert.equal(discover(workspace).worktree.clean, true);
  fs.writeFileSync(path.join(workspace, 'untracked.txt'), 'untracked\n');
  const dirty = discover(workspace);
  assert.equal(dirty.worktree.clean, false);
  assert.ok(dirty.worktree.changedFiles.some((entry) => entry.includes('untracked.txt')));
});

test('detects package manager only from an existing lockfile', (t) => {
  const { workspace } = fixture(t);
  fs.writeFileSync(path.join(workspace, 'package-lock.json'), '{}\n');
  assert.equal(discover(workspace).project.packageManager, 'npm');
});

test('missing and non-repository paths fail closed', (t) => {
  const { root } = fixture(t);
  const plain = path.join(root, 'plain');
  fs.mkdirSync(plain);
  assert.throws(() => discover(path.join(root, 'missing')), /does not exist/);
  assert.throws(() => discover(plain), /Not a Git repository/);
});
