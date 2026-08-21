'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  discover
} = require('../../accelerator/core/repository-discovery');

const {
  canonicalizeAuthorizedRoot
} = require('../../accelerator/core/workspace-boundary');

function git(workspace, args) {
  return childProcess.execFileSync('git', args, {
    cwd: workspace,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function repositoryFixture(parent) {
  const workspace = path.join(parent, 'repository');

  fs.mkdirSync(workspace);

  git(workspace, ['init', '-b', 'main']);
  git(workspace, ['config', 'user.email', 'sdo-test@example.invalid']);
  git(workspace, ['config', 'user.name', 'Surgical DevOps Test']);

  fs.writeFileSync(
    path.join(workspace, 'package.json'),
    '{}\n'
  );

  fs.writeFileSync(
    path.join(workspace, 'index.js'),
    'module.exports = true;\n'
  );

  git(workspace, ['add', 'package.json', 'index.js']);
  git(workspace, ['commit', '-m', 'fixture baseline']);

  return workspace;
}

test(
  'repository discovery materializes physical workspace authority across an ancestor alias',
  (t) => {
    const lexicalTemporaryRoot = path.normalize(os.tmpdir());
    const physicalTemporaryRoot = fs.realpathSync(lexicalTemporaryRoot);

    if (lexicalTemporaryRoot === physicalTemporaryRoot) {
      return t.skip(
        'This platform exposes no lexical/physical tmpdir divergence.'
      );
    }

    const lexicalBase = fs.mkdtempSync(
      path.join(
        lexicalTemporaryRoot,
        'sdo-discovery-ancestor-alias-'
      )
    );

    const physicalBase = fs.realpathSync(lexicalBase);

    t.after(() => {
      fs.rmSync(physicalBase, {
        recursive: true,
        force: true
      });
    });

    const lexicalRepository =
      repositoryFixture(lexicalBase);

    const physicalRepository =
      canonicalizeAuthorizedRoot(
        lexicalRepository
      );

    assert.notEqual(
      lexicalRepository,
      physicalRepository
    );

    const discovery =
      discover(lexicalRepository);

    assert.equal(
      discovery.repository.path,
      physicalRepository
    );
  }
);
