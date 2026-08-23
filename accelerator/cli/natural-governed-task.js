'use strict';

const path =
  require('node:path');

const {
  normalizeNaturalText
} = require(
  './natural-intent'
);

const AFFIRMATIVE =
  Object.freeze([
    'sim',
    'autorizo',
    'eu autorizo',
    'pode',
    'pode prosseguir',
    'prossiga',
    'continue',
    'pode continuar',
    'confirmo'
  ]);

const NEGATIVE =
  Object.freeze([
    'nao',
    'não',
    'cancelar',
    'cancele',
    'nao autorizo',
    'não autorizo',
    'pare'
  ]);

function deepFreeze(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function normalizePathText(value) {
  return String(value || '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

function detectWorkspaceList(text) {
  const normalized =
    normalizeNaturalText(text);

  const listing =
    [
      'liste os arquivos deste diretorio',
      'liste os arquivos deste diretorio',
      'liste os aquivos deste diretorio',
      'liste os aquivos deste direorio',
      'mostre os arquivos deste diretorio',
      'mostre o conteudo deste diretorio',
      'mostre o conteudo do diretorio',
      'traga a listagem do diretorio',
      'listagem deste diretorio',
      'quais arquivos existem neste projeto',
      'quais arquivos tem neste projeto',
      'mostre a estrutura do projeto'
    ].some(
      (pattern) =>
        normalized.includes(pattern)
    );

  if (!listing) {
    return null;
  }

  return deepFreeze({
    schema:
      'sdo.natural_governed_task.v1',

    kind:
      'WORKSPACE_LIST',

    objective:
      'Listar os arquivos visíveis do projeto autorizado.',

    mutating:
      false,

    operations: [
      {
        capabilityType:
          'GIT_READ',

        target:
          'workspace-files'
      }
    ]
  });
}

function detectExplicitFileTask(text) {
  const raw =
    String(text || '').trim();

  const patterns = [
    {
      regex:
        /^(?:leia|abra|mostre)\s+(?:o\s+)?arquivo\s+(.+)$/i,

      analysis:
        false
    },
    {
      regex:
        /^(?:analise|examine|explique)\s+(?:o\s+)?arquivo\s+(.+)$/i,

      analysis:
        true
    }
  ];

  for (const entry of patterns) {
    const match =
      raw.match(entry.regex);

    if (!match) {
      continue;
    }

    const target =
      normalizePathText(
        match[1]
      );

    if (!target) {
      return null;
    }

    return deepFreeze({
      schema:
        'sdo.natural_governed_task.v1',

      kind:
        entry.analysis
          ? 'READ_AND_EXPLAIN_FILE'
          : 'READ_FILE',

      objective:
        entry.analysis
          ? `Ler e explicar o arquivo ${target}.`
          : `Ler o arquivo ${target}.`,

      mutating:
        false,

      target,

      operations: [
        {
          capabilityType:
            'FILESYSTEM_READ',

          target
        }
      ]
    });
  }

  return null;
}

function detectNaturalGovernedTask(input) {
  return (
    detectWorkspaceList(input) ||
    detectExplicitFileTask(input)
  );
}

function formatTaskProposal(
  task,
  workspace
) {
  if (
    !task ||
    task.schema !==
      'sdo.natural_governed_task.v1'
  ) {
    throw new Error(
      'Canonical NATURAL governed task is required.'
    );
  }

  if (task.kind === 'WORKSPACE_LIST') {
    return (
      'Para responder, preciso consultar a estrutura real do projeto.\n\n' +
      `Projeto autorizado: ${workspace}\n` +
      'Vou somente listar os arquivos visíveis deste repositório.\n' +
      'Não acessarei diretórios pais, irmãos ou outros projetos.\n' +
      'Nenhum arquivo será alterado.\n\n' +
      'Posso prosseguir?\n'
    );
  }

  return (
    `Para responder, preciso ler o arquivo "${task.target}".\n\n` +
    `Projeto autorizado: ${workspace}\n` +
    'A leitura ficará restrita a este projeto e passará pelo Orchestrator.\n' +
    'Nenhum arquivo será alterado.\n\n' +
    'Posso prosseguir?\n'
  );
}

function isAffirmative(input) {
  const normalized =
    normalizeNaturalText(input);

  return AFFIRMATIVE.includes(
    normalized
  );
}

function isNegative(input) {
  const normalized =
    normalizeNaturalText(input);

  return NEGATIVE.includes(
    normalized
  );
}

function formatWorkspaceFiles(
  result
) {
  const execution =
    result &&
    result.execution;

  if (
    !execution ||
    execution.schema !==
      'sdo.git_read_result.v1' ||
    execution.selector !==
      'WORKSPACE_FILES' ||
    !execution.result ||
    !Array.isArray(
      execution.result.files
    )
  ) {
    throw new Error(
      'Governed workspace-files evidence is malformed.'
    );
  }

  const files =
    execution.result.files;

  const topLevel =
    [...new Set(
      files.map((entry) => {
        const normalized =
          entry.replace(/\\/g, '/');

        const parts =
          normalized.split('/');

        return parts.length > 1
          ? `${parts[0]}/`
          : parts[0];
      })
    )].sort();

  return (
    `Encontrei ${files.length} arquivo(s) visível(is) no projeto.\n\n` +
    'Conteúdo no nível principal:\n' +
    (
      topLevel.length
        ? topLevel
            .map(
              (entry) =>
                `  ${entry}`
            )
            .join('\n')
        : '  (nenhum arquivo encontrado)'
    ) +
    '\n\nA consulta ficou restrita ao projeto autorizado. Nenhum arquivo foi alterado.\n'
  );
}

function extractFilesystemEvidence(
  result
) {
  const execution =
    result &&
    result.execution;

  if (
    !execution ||
    execution.schema !==
      'sdo.filesystem_read_result.v1' ||
    !execution.evidence ||
    typeof execution.evidence.content !==
      'string'
  ) {
    throw new Error(
      'Governed filesystem evidence is malformed.'
    );
  }

  return deepFreeze({
    target:
      execution.target.requested,

    bytes:
      execution.evidence.bytes,

    sha256:
      execution.evidence.sha256,

    content:
      execution.evidence.content
  });
}

function formatFileReadEvidence(
  evidence
) {
  return (
    `Arquivo: ${evidence.target}\n` +
    `Bytes: ${evidence.bytes}\n` +
    `SHA256: ${evidence.sha256}\n\n` +
    evidence.content +
    (
      evidence.content.endsWith('\n')
        ? ''
        : '\n'
    ) +
    '\nA leitura ficou restrita ao projeto autorizado. Nenhum arquivo foi alterado.\n'
  );
}

module.exports =
  Object.freeze({
    detectNaturalGovernedTask,
    formatTaskProposal,
    isAffirmative,
    isNegative,
    formatWorkspaceFiles,
    extractFilesystemEvidence,
    formatFileReadEvidence
  });
