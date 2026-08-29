'use strict';

const path =
  require('node:path');

const {
  normalizeNaturalText
} = require(
  './natural-intent'
);

const {
  detectNaturalResponseLanguage
} = require(
  './natural-response-language'
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
    'confirmo',
    'yes',
    'authorize',
    'i authorize',
    'proceed',
    'go ahead'
  ]);

const NEGATIVE =
  Object.freeze([
    'nao',
    'não',
    'cancelar',
    'cancele',
    'nao autorizo',
    'não autorizo',
    'pare',
    'no',
    'cancel',
    'stop'
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
  let normalized =
    String(value || '')
      .trim()
      .replace(/^["']|["']$/g, '');

  let previous;

  do {
    previous = normalized;

    normalized =
      normalized.replace(
        /([A-Za-z0-9_-])\s+\.\s+([A-Za-z0-9_-])/g,
        '$1.$2'
      );
  } while (normalized !== previous);

  return normalized;
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
      'mostre a estrutura do projeto',
      'list the files in this directory',
      'list files in this directory',
      'show the files in this directory',
      'show the project structure',
      'which files are in this project'
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
        /^(?:leia|abra|mostre)\s+(?:o\s+)?(?:arquivo\s+)?([A-Za-z0-9_-]+(?:\s+\.\s+|\.)[A-Za-z0-9_.-]+?)(?:\s+e\s+.+)?$/i,

      analysis:
        false
    },
    {
      regex:
        /^(?:read|open|show)\s+(?:the\s+)?(?:file\s+)?([A-Za-z0-9_-]+(?:\s+\.\s+|\.)[A-Za-z0-9_.-]+?)(?:\s+and\s+.+)?$/i,

      analysis:
        false
    },
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
    },
    {
      regex:
        /^(?:read|open|show)\s+(?:the\s+)?file\s+(.+)$/i,

      analysis:
        false
    },
    {
      regex:
        /^(?:analy[sz]e|examine|explain)\s+(?:the\s+)?file\s+(.+)$/i,

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

function detectProjectAnalysis(text) {
  const normalized =
    normalizeNaturalText(text);

  const analysis =
    [
      'explique este projeto',
      'analise este projeto',
      'examine este projeto',
      'em que ponto estamos',
      'o que voce sugere fazer agora',
      'avalie este projeto',
      'explain this project',
      'analyze this project',
      'analyse this project',
      'examine this project',
      'evaluate this project',
      'what do you suggest doing next'
    ].some(
      (pattern) =>
        normalized.includes(pattern)
    );

  if (!analysis) {
    return null;
  }

  return deepFreeze({
    schema:
      'sdo.natural_governed_task.v1',

    kind:
      'PROJECT_ANALYSIS',

    objective:
      String(text || '').trim(),

    mutating:
      false,

    operations:
      []
  });
}

function detectNaturalGovernedTask(input) {
  return (
    detectWorkspaceList(input) ||
    detectExplicitFileTask(input) ||
    detectProjectAnalysis(input)
  );
}

function formatTaskProposal(
  task,
  workspace,
  preferredLanguage = null
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

  const language =
    preferredLanguage ||
    detectNaturalResponseLanguage(
      task.objective
    );

  if (task.kind === 'PROJECT_ANALYSIS') {
    if (language === 'en') {
      return (
        'To answer from the real project, I need to consult governed workspace evidence.\n\n' +
        `Authorized project: ${workspace}\n` +
        'The Orchestrator may list files, read only necessary descendant files, and validate specific JavaScript files.\n' +
        'The consultation is restricted to this project, limited to 8 steps, and permits no writes, generic shell, or authority expansion.\n' +
        'No file will be changed.\n\n' +
        'May I proceed?\n'
      );
    }

    return (
      'Para responder com base no projeto real, preciso consultar evidências do workspace.\n\n' +
      `Projeto autorizado: ${workspace}\n` +
      'O Orchestrator poderá listar arquivos, ler somente arquivos descendentes necessários e validar arquivos JavaScript específicos.\n' +
      'A consulta ficará restrita a este projeto, terá no máximo 8 etapas e não permitirá escrita, shell genérico ou ampliação de autoridade.\n' +
      'Nenhum arquivo será alterado.\n\n' +
      'Posso prosseguir?\n'
    );
  }

  if (task.kind === 'WORKSPACE_LIST') {
    if (language === 'en') {
      return (
        'To answer, I need to inspect the real project structure.\n\n' +
        `Authorized project: ${workspace}\n` +
        'I will only list files visible in this repository.\n' +
        'I will not access parent directories, sibling directories, or other projects.\n' +
        'No file will be changed.\n\n' +
        'May I proceed?\n'
      );
    }

    return (
      'Para responder, preciso consultar a estrutura real do projeto.\n\n' +
      `Projeto autorizado: ${workspace}\n` +
      'Vou somente listar os arquivos visíveis deste repositório.\n' +
      'Não acessarei diretórios pais, irmãos ou outros projetos.\n' +
      'Nenhum arquivo será alterado.\n\n' +
      'Posso prosseguir?\n'
    );
  }

  if (language === 'en') {
    return (
      `To answer, I need to read the file "${task.target}".\n\n` +
      `Authorized project: ${workspace}\n` +
      'The read will remain confined to this project and pass through the Orchestrator.\n' +
      'No file will be changed.\n\n' +
      'May I proceed?\n'
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
  result,
  language = 'pt-BR'
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

  if (language === 'en') {
    return (
      `I found ${files.length} visible file(s) in the project.\n\n` +
      'Top-level content:\n' +
      (
        topLevel.length
          ? topLevel.map((entry) => `  ${entry}`).join('\n')
          : '  (no files found)'
      ) +
      '\n\nThe query remained confined to the authorized project. No file was changed.\n'
    );
  }

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
  evidence,
  language = 'pt-BR'
) {
  const english = language === 'en';

  return (
    `${english ? 'File' : 'Arquivo'}: ${evidence.target}\n` +
    `Bytes: ${evidence.bytes}\n` +
    `SHA256: ${evidence.sha256}\n\n` +
    evidence.content +
    (
      evidence.content.endsWith('\n')
        ? ''
        : '\n'
    ) +
    (
      english
        ? '\nThe read remained confined to the authorized project. No file was changed.\n'
        : '\nA leitura ficou restrita ao projeto autorizado. Nenhum arquivo foi alterado.\n'
    )
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
