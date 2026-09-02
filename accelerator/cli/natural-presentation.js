'use strict';

const NATURAL_GATEWAY_RESULT_CLASSES =
  new Set([
    'SUCCESS',
    'FAILURE',
    'DENIED',
    'AUTHORITY_REQUIRED',
    'STALE_STATE',
    'CAS_MISMATCH',
    'UNSUPPORTED',
    'ENVIRONMENT_ERROR',
    'INCOMPLETE_EVIDENCE'
  ]);

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

function formatRepositoryStatus(payload, language = 'pt-BR') {
  const status =
    parseWorktreeStatus(payload);

  if (!status) {
    return null;
  }

  if (status.total === 0) {
    if (language === 'en') {
      return (
        'The project has no pending local changes.\n' +
        'No change was made.\n'
      );
    }

    return (
      'O projeto não possui alterações locais pendentes.\n' +
      'Nenhuma alteração foi realizada.\n'
    );
  }

  const parts = [];
  const english = language === 'en';

  if (status.modified > 0) {
    parts.push(
      `${status.modified} ` +
      (
        status.modified === 1
          ? (english ? 'modified file' : 'arquivo modificado')
          : (english ? 'modified files' : 'arquivos modificados')
      )
    );
  }

  if (status.untracked > 0) {
    parts.push(
      `${status.untracked} ` +
      (
        status.untracked === 1
          ? (english ? 'new untracked file' : 'arquivo novo não rastreado')
          : (english ? 'new untracked files' : 'arquivos novos não rastreados')
      )
    );
  }

  if (status.other > 0) {
    parts.push(
      `${status.other} ` +
      (
        status.other === 1
          ? (english ? 'other change' : 'outra alteração')
          : (english ? 'other changes' : 'outras alterações')
      )
    );
  }

  if (english) {
    return (
      'The project has local changes that have not been recorded yet.\n' +
      `Found ${parts.join(' and ')}.\n` +
      'No change was made.\n'
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
  governedOutput,
  language = 'pt-BR'
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
        evidence.payload,
        language
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

    return language === 'en'
      ? (
          `You are working on branch "${branch}".\n` +
          'No change was made.\n'
        )
      : (
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

    return language === 'en'
      ? (
          'The current project commit is:\n' +
          `${commit}\n` +
          'No change was made.\n'
        )
      : (
      'O commit atual do projeto é:\n' +
      `${commit}\n` +
      'Nenhuma alteração foi realizada.\n'
        );
  }

  return governedOutput;
}

function formatNaturalGatewayEvent(
  event,
  language = 'pt-BR'
) {
  if (
    !event ||
    typeof event !== 'object' ||
    typeof event.operation !== 'string' ||
    typeof event.type !== 'string'
  ) {
    return '';
  }

  const english = language === 'en';

  if (event.type === 'OPERATION_STARTED') {
    return english
      ? `Governed operation started: ${event.operation}\n`
      : `Operação governada iniciada: ${event.operation}\n`;
  }

  const classification =
    typeof event.classification === 'string'
      ? event.classification
      : 'FAILURE';

  if (classification === 'SUCCESS') {
    return english
      ? `Governed operation completed: ${classification}\n`
      : `Operação governada concluída: ${classification}\n`;
  }

  if (classification === 'AUTHORITY_REQUIRED') {
    return english
      ? `Governed operation awaits authority: ${classification}\n`
      : `Operação governada aguarda autoridade: ${classification}\n`;
  }

  return english
    ? `Governed operation failed closed: ${classification}\n`
    : `Operação governada falhou de forma segura: ${classification}\n`;
}

function formatNaturalGatewayResult(
  dispatch,
  language = 'pt-BR'
) {
  const result =
    dispatch &&
    dispatch.result;

  if (
    !dispatch ||
    dispatch.schema !==
      'sdo.integrated_governed_agent_gateway_dispatch.v1' ||
    !result ||
    typeof result !== 'object' ||
    result.schema !==
      'sdo.integrated_governed_agent_gateway_result.v1' ||
    typeof result.classification !== 'string' ||
    !NATURAL_GATEWAY_RESULT_CLASSES.has(
      result.classification
    ) ||
    typeof result.reason !== 'string'
  ) {
    return language === 'en'
      ? (
          'Result: DENIED\n' +
          'Reason: Malformed governed result.\n' +
          'AI operational authority: none\n' +
          'Mutation, push, merge, release, publication and deploy were not authorized.\n'
        )
      : (
          'Resultado: DENIED\n' +
          'Motivo: resultado governado malformado.\n' +
          'Autoridade operacional da IA: nenhuma\n' +
          'Mutação, push, merge, release, publicação e deploy não foram autorizados.\n'
        );
  }

  const english = language === 'en';
  const lines = [
    `${english ? 'Result' : 'Resultado'}: ${result.classification}`,
    `${english ? 'Reason' : 'Motivo'}: ${result.reason}`
  ];

  const data =
    result.data &&
    typeof result.data === 'object'
      ? result.data
      : null;

  if (data && data.kind === 'WORKSPACE_STATUS') {
    const repository = data.repository || {};
    lines.push(
      `${english ? 'Repository' : 'Repositório'}: ${repository.path || 'indisponível'}`,
      `Branch: ${repository.branch || 'indisponível'}`,
      `HEAD: ${repository.commit || 'indisponível'}`,
      `${english ? 'Physical state' : 'Estado físico'}: ${data.clean ? (english ? 'clean' : 'limpo') : (english ? 'changes present' : 'com alterações')}`,
      `${english ? 'Changed entries' : 'Entradas alteradas'}: ${Array.isArray(data.changedEntries) ? data.changedEntries.length : 0}`,
      `Orchestrator: ${data.orchestratorStatus || 'indisponível'}`
    );
  } else if (data && data.kind === 'WORKSPACE_DIFF') {
    lines.push(
      `${english ? 'Governed diff bytes' : 'Bytes do diff governado'}: ${Number.isSafeInteger(data.bytes) ? data.bytes : 'indisponível'}`,
      `Patch SHA-256: ${data.patchSha256 || 'indisponível'}`,
      `${english ? 'Raw evidence reference' : 'Referência da evidência bruta'}: ${data.rawEvidenceReference || 'indisponível'}`,
      `Orchestrator: ${data.orchestratorStatus || 'indisponível'}`
    );
  }

  if (result.approvalRequest) {
    const approval = result.approvalRequest;
    lines.push(
      `${english ? 'Requested operation' : 'Operação solicitada'}: ${approval.operation}`,
      `${english ? 'Authority lifetime' : 'Validade da autoridade'}: ${approval.lifetime}`,
      `${english ? 'Authority explicitly not granted' : 'Autoridade explicitamente não concedida'}: ${Array.isArray(approval.authorityNotGranted) ? approval.authorityNotGranted.join(', ') : 'none'}`
    );
  }

  if (
    typeof result.evidenceDigest === 'string' &&
    /^[a-f0-9]{64}$/.test(result.evidenceDigest)
  ) {
    lines.push(
      `${english ? 'Evidence SHA-256' : 'Evidência SHA-256'}: ${result.evidenceDigest}`
    );
  }

  lines.push(
    english
      ? 'AI operational authority: none'
      : 'Autoridade operacional da IA: nenhuma',
    english
      ? 'Mutation, push, merge, release, publication and deploy were not authorized.'
      : 'Mutação, push, merge, release, publicação e deploy não foram autorizados.'
  );

  return `${lines.join('\n')}\n`;
}

module.exports = Object.freeze({
  extractGovernedPayload,
  parseWorktreeStatus,
  formatNaturalPresentation,
  formatNaturalGatewayEvent,
  formatNaturalGatewayResult
});
