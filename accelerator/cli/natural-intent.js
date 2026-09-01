'use strict';

/*
 * NATURAL Level 1 deterministic interpretation.
 *
 * This module does not execute commands, grant authority,
 * select providers, invoke a shell, or mutate repository state.
 *
 * It only maps a deliberately bounded natural-language vocabulary
 * to already-qualified canonical read-only intents.
 */

function normalizeNaturalText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[?!.,;:()[\]{}"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text, expressions) {
  return expressions.some(
    (expression) => text.includes(expression)
  );
}

function interpretNaturalIntent(input) {
  const text = normalizeNaturalText(input);

  if (!text) {
    return Object.freeze({
      matched: false
    });
  }

  /*
   * Only questions whose semantic objective is repository
   * cleanliness resolve to WORKTREE_STATUS here. Project state,
   * health, readiness, architecture, and next-work analysis need
   * broader governed evidence and must continue through the
   * governed-task path instead of terminating on a clean worktree.
   */
  if (
    includesAny(
      text,
      [
        'status deste repositorio',
        'status do repositorio',
        'ha alteracoes no repositorio',
        'tem alteracoes no repositorio',
        'existem alteracoes no repositorio',
        'ha alteracoes locais',
        'tem alteracoes locais',
        'existem alteracoes locais',
        'arquivos alterados',
        'alteracoes pendentes',
        'mudancas pendentes',
        'alteracoes nao commitadas',
        'mudancas nao commitadas',
        'worktree limpo',
        'repositorio limpo',
        'repository status',
        'are there changes in the repository',
        'are there local changes',
        'are there uncommitted local changes',
        'any local changes',
        'any uncommitted changes',
        'modified files',
        'pending changes',
        'is the worktree clean',
        'is the repository clean'
      ]
    )
  ) {
    return Object.freeze({
      matched: true,
      intent: Object.freeze({
        capabilityType: 'GIT_READ',
        target: 'status'
      }),
      presentation: 'REPOSITORY_STATUS'
    });
  }

  if (
    includesAny(
      text,
      [
        'qual e a branch',
        'qual branch',
        'branch atual',
        'em qual branch',
        'ramo atual',
        'what is the current branch',
        'which branch am i on',
        'what branch am i on',
        'current branch'
      ]
    )
  ) {
    return Object.freeze({
      matched: true,
      intent: Object.freeze({
        capabilityType: 'GIT_READ',
        target: 'branch'
      }),
      presentation: 'CURRENT_BRANCH'
    });
  }

  if (
    includesAny(
      text,
      [
        'qual e o commit atual',
        'qual o commit atual',
        'commit atual',
        'ultimo commit',
        'head atual',
        'qual e o head',
        'qual o head',
        'what is the current commit',
        'what is the current head',
        'current commit',
        'current head'
      ]
    )
  ) {
    return Object.freeze({
      matched: true,
      intent: Object.freeze({
        capabilityType: 'GIT_READ',
        target: 'head'
      }),
      presentation: 'HEAD_COMMIT'
    });
  }

  return Object.freeze({
    matched: false
  });
}

function naturalUnknownMessage(language = 'pt-BR') {
  if (language === 'en') {
    return (
      'I cannot safely execute this natural-language request yet.\n' +
      'For example, you can ask:\n' +
      '  "What is the current state of this repository?"\n' +
      '  "What is the current branch?"\n' +
      '  "What is the current commit?"\n' +
      'No change was made.\n'
    );
  }

  return (
    'Ainda não consigo executar esse pedido em linguagem natural com segurança.\n' +
    'Você pode perguntar, por exemplo:\n' +
    '  "Qual é o estado atual deste repositório?"\n' +
    '  "Qual é a branch atual?"\n' +
    '  "Qual é o commit atual?"\n' +
    'Nenhuma alteração foi realizada.\n'
  );
}

module.exports = Object.freeze({
  normalizeNaturalText,
  interpretNaturalIntent,
  naturalUnknownMessage
});
