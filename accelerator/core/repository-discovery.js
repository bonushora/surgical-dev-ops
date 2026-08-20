#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function runGit(repositoryPath, args) {
  return execFileSync(
    'git',
    ['-C', repositoryPath, ...args],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }
  ).trim();
}

function detectPackageManager(repositoryPath) {
  const files = fs.readdirSync(repositoryPath);

  if (files.includes('pnpm-lock.yaml')) return 'pnpm';
  if (files.includes('yarn.lock')) return 'yarn';
  if (files.includes('package-lock.json')) return 'npm';
  if (files.includes('bun.lockb') || files.includes('bun.lock')) return 'bun';

  return null;
}

function detectProjectFiles(repositoryPath) {
  const candidates = [
    'package.json',
    'Cargo.toml',
    'go.mod',
    'pyproject.toml',
    'requirements.txt',
    'composer.json',
    'pom.xml',
    'build.gradle',
    'CMakeLists.txt',
    'Makefile'
  ];

  return candidates.filter((file) =>
    fs.existsSync(path.join(repositoryPath, file))
  );
}

function getLanguages(repositoryPath) {
  const result = [];

  const extensions = {
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.py': 'Python',
    '.go': 'Go',
    '.rs': 'Rust',
    '.java': 'Java',
    '.kt': 'Kotlin',
    '.dart': 'Dart',
    '.php': 'PHP',
    '.rb': 'Ruby',
    '.c': 'C',
    '.cpp': 'C++',
    '.h': 'C/C++',
    '.cs': 'C#'
  };

  const ignored = new Set([
    '.git',
    'node_modules',
    'dist',
    'build',
    '.next',
    'coverage',
    'target',
    'vendor'
  ]);

  function walk(currentPath) {
    let entries;

    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;

      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      const extension = path.extname(entry.name);

      if (extensions[extension] && !result.includes(extensions[extension])) {
        result.push(extensions[extension]);
      }
    }
  }

  walk(repositoryPath);

  return result.sort();
}

function discover(repositoryPath) {
  const absolutePath = path.resolve(repositoryPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Repository path does not exist: ${absolutePath}`);
  }

  if (!fs.existsSync(path.join(absolutePath, '.git'))) {
    throw new Error(`Not a Git repository: ${absolutePath}`);
  }

  const status = runGit(absolutePath, ['status', '--porcelain=v1']);

  const branches = runGit(
    absolutePath,
    ['branch', '--show-current']
  );

  const commit = runGit(
    absolutePath,
    ['rev-parse', 'HEAD']
  );

  const shortCommit = runGit(
    absolutePath,
    ['rev-parse', '--short', 'HEAD']
  );

  const remote = (() => {
    try {
      return runGit(
        absolutePath,
        ['remote', 'get-url', 'origin']
      );
    } catch {
      return null;
    }
  })();

  const root = runGit(
    absolutePath,
    ['rev-parse', '--show-toplevel']
  );

  const trackedFiles = Number(
    runGit(absolutePath, ['ls-files', '-z'])
      .split('\0')
      .filter(Boolean)
      .length
  );

  const dirtyFiles = status
    ? status.split('\n').filter(Boolean)
    : [];

  return {
    schema: 'sdo.repository_discovery.v1',
    repository: {
      path: root,
      name: path.basename(root),
      branch: branches || null,
      commit,
      shortCommit,
      remote
    },
    worktree: {
      clean: dirtyFiles.length === 0,
      changedFiles: dirtyFiles
    },
    project: {
      packageManager: detectPackageManager(root),
      projectFiles: detectProjectFiles(root),
      languages: getLanguages(root)
    },
    statistics: {
      trackedFiles,
      changedFiles: dirtyFiles.length
    }
  };
}

function main() {
  const repositoryPath = process.argv[2] || process.cwd();

  try {
    const result = discover(repositoryPath);
    process.stdout.write(
      `${JSON.stringify(result, null, 2)}\n`
    );
  } catch (error) {
    console.error(`SDO DISCOVERY ERROR: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  discover
};
