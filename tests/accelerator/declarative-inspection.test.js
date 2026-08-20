'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  inspect
} = require('../../accelerator/core/declarative-inspection');

function runGit(repositoryPath, args) {
  return execFileSync('git', ['-C', repositoryPath, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function createFixture() {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdo-inspection-')
  );
  const repositoryPath = path.join(fixtureRoot, 'repo');
  const siblingPath = path.join(fixtureRoot, 'repo-secret');

  fs.mkdirSync(repositoryPath);
  fs.mkdirSync(siblingPath);
  fs.writeFileSync(path.join(repositoryPath, 'inside.txt'), 'inside\n');
  fs.writeFileSync(path.join(siblingPath, 'secret.txt'), 'secret\n');
  fs.mkdirSync(path.join(repositoryPath, 'directory'));
  fs.symlinkSync(
    path.join(siblingPath, 'secret.txt'),
    path.join(repositoryPath, 'escape-link.txt')
  );

  runGit(repositoryPath, ['init']);
  runGit(repositoryPath, ['config', 'user.email', 'sdo-test@example.invalid']);
  runGit(repositoryPath, ['config', 'user.name', 'Surgical DevOps Test']);
  runGit(repositoryPath, ['add', 'inside.txt']);
  runGit(repositoryPath, ['commit', '-m', 'fixture baseline']);

  return { fixtureRoot, repositoryPath };
}

function inspectionInput(file) {
  return {
    files: [file],
    hypothesis: 'Verify the physical workspace boundary.',
    objective: 'Inspect one authorized file.',
    diffEstimate: '0 lines',
    risk: 'BAIXO',
    mode: 'PATCH'
  };
}

function withFixture(run) {
  const fixture = createFixture();

  try {
    run(fixture);
  } finally {
    fs.rmSync(fixture.fixtureRoot, { recursive: true, force: true });
  }
}

test('inspection canonicalizes the authorized root and reads an internal file', () => {
  withFixture(({ repositoryPath }) => {
    const rootLink = `${repositoryPath}-link`;
    fs.symlinkSync(repositoryPath, rootLink, 'dir');

    const result = inspect(rootLink, inspectionInput('inside.txt'));

    assert.equal(result.physicalAnchor.repository, fs.realpathSync(repositoryPath));
    assert.equal(result.inspection.files[0].path, 'inside.txt');
  });
});

test('inspection rejects explicit parent traversal', () => {
  withFixture(({ repositoryPath }) => {
    assert.throws(
      () => inspect(repositoryPath, inspectionInput('../repo-secret/secret.txt')),
      /escapes authorized workspace/
    );
  });
});

test('inspection rejects sibling-prefix path confusion', () => {
  withFixture(({ fixtureRoot, repositoryPath }) => {
    const siblingPath = path.join(fixtureRoot, 'repo-secret');
    const siblingLink = path.join(repositoryPath, 'sibling-prefix-link.txt');

    assert.equal(fs.realpathSync(repositoryPath), repositoryPath);
    assert.equal(fs.realpathSync(siblingPath), siblingPath);
    fs.symlinkSync(
      path.join(siblingPath, 'secret.txt'),
      siblingLink
    );

    assert.throws(
      () => inspect(repositoryPath, inspectionInput('sibling-prefix-link.txt')),
      /escapes authorized workspace/
    );
  });
});

test('inspection rejects a symlink whose physical target escapes the root', () => {
  withFixture(({ repositoryPath }) => {
    assert.throws(
      () => inspect(repositoryPath, inspectionInput('escape-link.txt')),
      /escapes authorized workspace/
    );
  });
});

test('inspection fails closed when the target cannot be resolved', () => {
  withFixture(({ repositoryPath }) => {
    assert.throws(
      () => inspect(repositoryPath, inspectionInput('missing.txt')),
      /cannot be resolved/
    );
  });
});

test('inspection fails closed when the target is not a file', () => {
  withFixture(({ repositoryPath }) => {
    assert.throws(
      () => inspect(repositoryPath, inspectionInput('directory')),
      /is not a file/
    );
  });
});
