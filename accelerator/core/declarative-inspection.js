#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { runTrustedGitRead } = require('../adapters/git-read-adapter');
const {
  canonicalizeAuthorizedRoot,
  resolveInspectedFile
} = require('./workspace-boundary');

function inspectFile(repositoryPath, relativePath) {
  const { canonicalTarget } = resolveInspectedFile(
    repositoryPath,
    relativePath
  );
  const content = fs.readFileSync(canonicalTarget, 'utf8');
  const lines = content === '' ? 0 : content.split(/\r?\n/).length;

  return {
    path: relativePath,
    lines,
    focusWindowRequired: lines > 300
  };
}

function inspect(repositoryPath, input) {
  const absolutePath = canonicalizeAuthorizedRoot(repositoryPath);

  if (!fs.existsSync(path.join(absolutePath, '.git'))) {
    throw new Error(`Not a Git repository: ${absolutePath}`);
  }

  if (!input || typeof input !== 'object') {
    throw new Error('Inspection input must be an object.');
  }

  const inspectionScope =
    input.scope === 'REPOSITORY'
      ? 'REPOSITORY'
      : 'FILES';

  if (
    inspectionScope === 'FILES' &&
    (!Array.isArray(input.files) || input.files.length === 0)
  ) {
    throw new Error('At least one file must be inspected.');
  }

  if (
    inspectionScope === 'REPOSITORY' &&
    Array.isArray(input.files) &&
    input.files.length !== 0
  ) {
    throw new Error(
      'Repository-scoped inspection cannot declare target files.'
    );
  }

  if (!input.hypothesis || !String(input.hypothesis).trim()) {
    throw new Error('Inspection hypothesis is required.');
  }

  if (!input.objective || !String(input.objective).trim()) {
    throw new Error('Inspection objective is required.');
  }

  const branch = runTrustedGitRead(absolutePath, 'CURRENT_BRANCH').result;
  const commit = runTrustedGitRead(absolutePath, 'HEAD_COMMIT').result;
  const status = runTrustedGitRead(absolutePath, 'WORKTREE_STATUS').result;

  const inspectedFiles =
    inspectionScope === 'FILES'
      ? input.files.map((file) =>
          inspectFile(absolutePath, file)
        )
      : [];

  return {
    schema: 'sdo.declarative_inspection.v1',
    physicalAnchor: {
      repository: absolutePath,
      branch: branch || null,
      commit,
      worktreeClean: status.length === 0
    },
    inspection: {
      scope: inspectionScope,
      files: inspectedFiles,
      hypothesis: String(input.hypothesis).trim(),
      objective: String(input.objective).trim(),
      diffEstimate: String(input.diffEstimate || 'Não estimado').trim(),
      risk: String(input.risk || 'BAIXO').trim().toUpperCase(),
      mode: String(input.mode || 'PATCH').trim().toUpperCase()
    },
    governance: {
      patchModeDefault: true,
      declarativeInspectionCompleted: true,
      physicalValidationRequired: true,
      focusWindowRule: 'FILES_OVER_300_LINES_REQUIRE_FOCUSED_RANGE'
    }
  };
}

function main() {
  const repositoryPath = process.argv[2] || process.cwd();

  const input = {
    files: process.argv.slice(3),
    hypothesis: 'Inspeção física necessária antes de qualquer alteração.',
    objective: 'Validar o estado do arquivo antes da execução.',
    diffEstimate: '0 linhas — inspeção somente leitura',
    risk: 'BAIXO',
    mode: 'PATCH'
  };

  try {
    const result = inspect(repositoryPath, input);

    process.stdout.write(
      `${JSON.stringify(result, null, 2)}\n`
    );
  } catch (error) {
    console.error(
      `SDO DECLARATIVE INSPECTION ERROR: ${error.message}`
    );
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  inspect
};
