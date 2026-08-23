'use strict';

/*
 * NATURAL deterministic presentation boundary.
 *
 * Receives only already-governed textual evidence.
 *
 * It does not execute commands, grant authority, invoke the
 * Orchestrator, invoke providers, invoke a shell or mutate state.
 *
 * Malformed or unsupported evidence falls back to the original
 * governed output rather than inventing a result.
 */

function extractGovernedPayload(output) {
  if (typeof output !== 'string' || !output) {
    return null;
  }

  const lines =
    output
      .split('\n')
      .filter((line) => line.length > 0);

  if (
    lines.length < 3 ||
    lines[0] !== 'Governed Git read: COMPLETED' ||
    !lines[1].startsWith('Selector: ')
  ) {
    return null;
  }

  return Object.freeze({
    selector:
      lines[1].slice(
        'Selector: '.length
      ),

    payload:
      lines.slice(2).join('\n')
  });
}

function parseWorktreeStatus(payload) {
  let entries;

  try {
    entries = JSON.parse(payload);
  } catch {
    return null;
  }

  if (!Array.isArray(entries)) {
    return null;
  }

  let modified = 0;
  let untracked = 0;
  let other = 0;

  for (const entry of entries) {
    if (typeof entry !== 'string') {
      return null;
    }

    if (entry.startsWith('?? ')) {
      untracked += 1;
      continue;
    }

    if (
      entry.length >= 2 &&
      entry.slice(0, 2) !== '  '
    ) {
      modified += 1;
      continue;
    }

    other += 1;
  }

  return Object.freeze({
    total: entries.length,
    modified,
    untracked,
    other
  });
}

function formatRepositoryStatus(payload) {
  const status =
    parseWorktreeStatus(payload);

  if (!status) {
    return null;
  }

  if (status.total === 0) {
    return (
      'O projeto não possui alterações locais pendentes.\n' +
      'Nenhuma alteração foi realizada.\n'
    );
  }

  const parts = [];

  if (status.modified > 0) {
    parts.push(
      `${status.modified} ` +
      (
        status.modified === 1
          ? 'arquivo modificado'
          : 'arquivos modificados'
      )
    );
  }

  if (status.untracked > 0) {
    parts.push(
      `${status.untracked} ` +
      (
        status.untracked === 1
          ? 'arquivo novo não rastreado'
          : 'arquivos novos não rastreados'
      )
    );
  }

  if (status.other > 0) {
    parts.push(
      `${status.other} ` +
      (
        status.other === 1
          ? 'outra alteração'
          : 'outras alterações'
      )
    );
  }

  return (
    'O projeto possui alterações locais que ainda não foram registradas.\n' +
    `Foram encontrados ${parts.join(' e ')}.\n` +
    'Nenhuma alteração foi realizada.\n'
  );
}

function formatNaturalPresentation(
  presentation,
  governedOutput
) {
  const evidence =
    extractGovernedPayload(
      governedOutput
    );

  if (!evidence) {
    return governedOutput;
  }

  if (
    presentation === 'REPOSITORY_STATUS' &&
    evidence.selector === 'WORKTREE_STATUS'
  ) {
    return (
      formatRepositoryStatus(
        evidence.payload
      ) ||
      governedOutput
    );
  }

  if (
    presentation === 'CURRENT_BRANCH' &&
    evidence.selector === 'CURRENT_BRANCH'
  ) {
    const branch =
      evidence.payload.trim();

    if (!branch) {
      return governedOutput;
    }

    return (
      `Você está trabalhando na branch "${branch}".\n` +
      'Nenhuma alteração foi realizada.\n'
    );
  }

  if (
    presentation === 'HEAD_COMMIT' &&
    evidence.selector === 'HEAD_COMMIT'
  ) {
    const commit =
      evidence.payload.trim();

    if (
      !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/
        .test(commit)
    ) {
      return governedOutput;
    }

    return (
      'O commit atual do projeto é:\n' +
      `${commit}\n` +
      'Nenhuma alteração foi realizada.\n'
    );
  }

  return governedOutput;
}

module.exports = Object.freeze({
  extractGovernedPayload,
  parseWorktreeStatus,
  formatNaturalPresentation
});
