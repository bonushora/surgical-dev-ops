'use strict';

const {
  validateNaturalAgenticMission,
  validateNaturalAgenticMissionEvent
} = require('../core/natural-agentic-mission');

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
  language = 'pt-BR',
  context = {}
) {
  let canonicalEvent;
  try {
    canonicalEvent =
      validateNaturalAgenticMissionEvent(
        event
      );
  } catch {
    return '';
  }

  const english = language === 'en';
  let mission = null;
  try {
    mission = context.mission
      ? validateNaturalAgenticMission(context.mission)
      : null;
  } catch {
    return '';
  }
  if (mission && mission.missionId !== canonicalEvent.missionId) {
    return '';
  }
  const contextualOperation =
    typeof context.operation === 'string' &&
    /^[A-Za-z0-9._-]{1,128}$/.test(context.operation)
      ? context.operation
      : null;
  const contextualStep = mission && context.stepId
    ? mission.plan.find((step) => step.stepId === context.stepId) || null
    : mission
      ? mission.plan.find((step) => step.status === 'ACTIVE') ||
        [...mission.plan].reverse().find((step) => step.status === 'BLOCKED') ||
        [...mission.plan].reverse().find((step) => step.resultClass) ||
        null
      : null;
  const operation = contextualOperation || contextualStep?.operation || null;
  const operationText = operation || (english ? 'not established' : 'não estabelecida');
  const resultClass = canonicalEvent.resultClass ||
    (english ? 'not established' : 'não estabelecido');

  if (canonicalEvent.type === 'MISSION_STARTED') {
    return english
      ? `Governed mission started: ${mission ? mission.objective : canonicalEvent.missionId}\n`
      : `Missão governada iniciada: ${mission ? mission.objective : canonicalEvent.missionId}\n`;
  }
  if (canonicalEvent.type === 'PLAN_UPDATED') {
    const isCurrentEvent = mission?.events.at(-1)?.eventHash === canonicalEvent.eventHash;
    const status = isCurrentEvent ? contextualStep?.status : null;
    return english
      ? `Governed plan updated: ${status || canonicalEvent.summary}${status && operation ? ` [${operation}]` : ''}\n`
      : `Plano governado atualizado: ${status || canonicalEvent.summary}${status && operation ? ` [${operation}]` : ''}\n`;
  }
  if (['OPERATION_STARTED', 'TEST_STARTED'].includes(canonicalEvent.type)) {
    return english
      ? `Governed operation started: ${operationText}\n`
      : `Operação governada iniciada: ${operationText}\n`;
  }
  if (canonicalEvent.type === 'EVIDENCE_DISCOVERED') {
    return english
      ? `Governed evidence discovered: ${operationText} — ${resultClass}\n`
      : `Evidência governada descoberta: ${operationText} — ${resultClass}\n`;
  }
  if (['OPERATION_COMPLETED', 'TEST_PASSED'].includes(canonicalEvent.type)) {
    return english
      ? `Governed operation completed: ${resultClass} [${operationText}]\n`
      : `Operação governada concluída: ${resultClass} [${operationText}]\n`;
  }
  if (['OPERATION_DENIED', 'TEST_FAILED', 'AUTHORITY_DENIED'].includes(canonicalEvent.type)) {
    return english
      ? `Governed operation failed closed: ${operationText} — ${resultClass}\nReason: ${canonicalEvent.summary}\n`
      : `Operação governada falhou de forma segura: ${operationText} — ${resultClass}\nMotivo: ${canonicalEvent.summary}\n`;
  }
  if (canonicalEvent.type === 'AUTHORITY_REQUIRED') {
    return english
      ? `Governed operation requires authority: ${operationText} — ${resultClass} (not granted)\nReason: ${canonicalEvent.summary}\n`
      : `Autoridade governada requerida: ${operationText} — ${resultClass} (ainda não concedida)\nMotivo: ${canonicalEvent.summary}\n`;
  }
  if (canonicalEvent.type === 'AUTHORITY_GRANTED') {
    return english
      ? `Bounded governed authority reference consumed: ${operationText}\n`
      : `Referência de autoridade governada limitada consumida: ${operationText}\n`;
  }
  if (canonicalEvent.type === 'STATE_INVALIDATED') {
    return english
      ? `Governed state invalidated: ${resultClass}\nReason: ${canonicalEvent.summary}\n`
      : `Estado governado invalidado: ${resultClass}\nMotivo: ${canonicalEvent.summary}\n`;
  }
  if (canonicalEvent.type === 'MISSION_BLOCKED') {
    return english
      ? `Governed mission blocked: ${canonicalEvent.summary}\n`
      : `Missão governada bloqueada: ${canonicalEvent.summary}\n`;
  }
  if (canonicalEvent.type === 'WORKSPACE_VALIDATED') {
    return english
      ? `Governed workspace validated: ${resultClass}\n`
      : `Workspace governado validado: ${resultClass}\n`;
  }
  if (canonicalEvent.type === 'MISSION_GREEN') {
    return english
      ? 'Governed mission GREEN: canonical qualification passed.\n'
      : 'Missão governada GREEN: qualificação canônica aprovada.\n';
  }
  if (canonicalEvent.type === 'MISSION_CANCELLED') {
    return english
      ? `Governed mission cancelled: ${canonicalEvent.summary}\n`
      : `Missão governada cancelada: ${canonicalEvent.summary}\n`;
  }

  return '';
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

function formatNaturalReferenceResolution(
  resolution,
  language = 'pt-BR',
  requestedAction = 'INSPECT_EVIDENCE'
) {
  const english = language === 'en';

  if (
    !resolution ||
    resolution.schema !==
      'sdo.natural_engineering_reference_resolution.v1' ||
    typeof resolution.classification !== 'string'
  ) {
    return english
      ? (
          'Reference: UNSUPPORTED_REFERENT\n' +
          'The bounded reference result is malformed. No operation ran and no authority was granted.\n'
        )
      : (
          'Referência: UNSUPPORTED_REFERENT\n' +
          'O resultado da referência delimitada está malformado. Nenhuma operação foi executada e nenhuma autoridade foi concedida.\n'
        );
  }

  if (
    resolution.classification === 'RESOLVED' &&
    resolution.reference
  ) {
    const lines = [
      `${english ? 'Governed reference resolved' : 'Referência governada resolvida'}: ${resolution.reference.type}`,
      `${english ? 'Physical revalidation' : 'Revalidação física'}: ${resolution.physicalState}`,
      english
        ? 'Reference authority: none'
        : 'Autoridade da referência: nenhuma'
    ];

    if (requestedAction === 'REQUEST_MUTATION') {
      lines.push(
        'State: HUMAN_AUTHORITY_REQUIRED',
        english
          ? 'Resolving the reference did not authorize mutation. No mutation was dispatched.'
          : 'Resolver a referência não autorizou mutação. Nenhuma mutação foi despachada.'
      );
    } else if (requestedAction === 'REQUEST_PUBLICATION') {
      lines.push(
        'State: HUMAN_AUTHORITY_REQUIRED',
        english
          ? 'Resolving the reference did not authorize publication. Nothing was published.'
          : 'Resolver a referência não autorizou publicação. Nada foi publicado.'
      );
    }

    return `${lines.join('\n')}\n`;
  }

  const messages = {
    NO_REFERENT: english
      ? 'No previous governed referent of this type exists in the current mission.'
      : 'Não há um referente governado anterior desse tipo na missão atual.',
    AMBIGUOUS_REFERENT: english
      ? 'More than one governed result can satisfy this weak reference. Clarification is required.'
      : 'Há mais de um resultado governado ao qual essa referência fraca pode se referir. É necessário esclarecer.',
    STALE_REFERENT: english
      ? 'The physical state changed after this result. The stale reference was not used.'
      : 'O estado físico mudou depois desse resultado. A referência obsoleta não foi usada.',
    UNSUPPORTED_REFERENT: english
      ? 'This engineering reference is not represented by the current bounded runtime.'
      : 'Essa referência de engenharia não é representada pelo runtime delimitado atual.'
  };
  const lines = [
    `${english ? 'Reference' : 'Referência'}: ${resolution.classification}`,
    `${english ? 'Requested type' : 'Tipo solicitado'}: ${resolution.requestedType}`,
    messages[resolution.classification] ||
      (english
        ? 'The reference failed closed.'
        : 'A referência falhou de forma segura.')
  ];

  if (
    Array.isArray(resolution.candidateTypes) &&
    resolution.candidateTypes.length > 0
  ) {
    lines.push(
      `${english ? 'Candidates' : 'Candidatos'}: ${resolution.candidateTypes.join(', ')}`
    );
  }

  lines.push(
    english
      ? 'No governed operation ran and no authority was granted.'
      : 'Nenhuma operação governada foi executada e nenhuma autoridade foi concedida.'
  );

  return `${lines.join('\n')}\n`;
}

function formatNaturalReferenceContextProjection(
  projection,
  language = 'pt-BR'
) {
  if (
    !projection ||
    projection.schema !==
      'sdo.natural_engineering_reference_projection.v1' ||
    !Array.isArray(projection.types)
  ) {
    return '';
  }

  const english = language === 'en';
  const types =
    projection.types.length > 0
      ? projection.types.join(', ')
      : 'none';

  return english
    ? (
        `Bounded references: ${types}\n` +
        'Reference persistence: current process only\n' +
        'Reference authority: none\n'
      )
    : (
        `Referências delimitadas: ${types}\n` +
        'Persistência de referência: somente o processo atual\n' +
        'Autoridade da referência: nenhuma\n'
      );
}

function formatNaturalMissionContinuation(
  continuation,
  language = 'pt-BR'
) {
  if (
    !continuation ||
    continuation.schema !== 'sdo.natural_agentic_mission_continuation.v1' ||
    typeof continuation.classification !== 'string' ||
    typeof continuation.reason !== 'string' ||
    continuation.authorityExpansion !== false ||
    continuation.operationalAuthority !== false ||
    continuation.mutationAuthority !== false
  ) {
    return language === 'en'
      ? 'Continuation: DENIED\nReason: Malformed continuation decision.\nContinuation authority: none\n'
      : 'Continuação: DENIED\nMotivo: decisão de continuação malformada.\nAutoridade da continuação: nenhuma\n';
  }

  const english = language === 'en';
  const lines = [
    `Continuation: ${continuation.classification}`,
    `${english ? 'Reason' : 'Motivo'}: ${continuation.reason}`
  ];

  if (continuation.step) {
    lines.push(
      `${english ? 'Step' : 'Etapa'}: ${continuation.step.stepId}`,
      `${english ? 'Operation' : 'Operação'}: ${continuation.step.operation || 'not established'}`
    );
  }

  lines.push(
    english
      ? 'Continuation authority: none'
      : 'Autoridade da continuação: nenhuma'
  );
  return `${lines.join('\n')}\n`;
}

module.exports = Object.freeze({
  extractGovernedPayload,
  parseWorktreeStatus,
  formatNaturalPresentation,
  formatNaturalGatewayEvent,
  formatNaturalGatewayResult,
  formatNaturalReferenceResolution,
  formatNaturalReferenceContextProjection,
  formatNaturalMissionContinuation
});
