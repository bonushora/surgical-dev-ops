'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function createHermeticGitRepository(
  name = 'surgical-dev-ops'
) {
  const parent =
    fs.realpathSync(
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          'sdo-hermetic-repository-'
        )
      )
    );

  const repository =
    path.join(parent, name);

  fs.mkdirSync(repository);
  fs.writeFileSync(
    path.join(repository, 'package-lock.json'),
    '{}\n',
    'utf8'
  );

  execFileSync(
    'git',
    ['init', '-b', 'main'],
    { cwd: repository }
  );

  execFileSync(
    'git',
    ['config', 'user.name', 'Surgical Test'],
    { cwd: repository }
  );

  execFileSync(
    'git',
    ['config', 'user.email', 'test@surgical.invalid'],
    { cwd: repository }
  );

  execFileSync(
    'git',
    ['add', '.'],
    { cwd: repository }
  );

  execFileSync(
    'git',
    ['commit', '-m', 'fixture'],
    { cwd: repository }
  );

  return Object.freeze({
    repository,

    cleanup() {
      fs.rmSync(
        parent,
        {
          recursive: true,
          force: true
        }
      );
    }
  });
}

module.exports = Object.freeze({
  createHermeticGitRepository
});
