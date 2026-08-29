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
   * Repository-state questions intentionally resolve to
   * WORKTREE_STATUS at this frontier.
   *
   * Broader repository summaries may later compose multiple
   * governed R0 reads, but must not silently broaden authority.
   */
  if (
    includesAny(
      text,
      [
        'estado atual deste repositorio',
        'estado atual do repositorio',
        'estado deste repositorio',
        'estado do repositorio',
        'estado atual deste projeto',
        'estado atual do projeto',
        'estado deste projeto',
        'estado do projeto',
        'qual e o estado atual deste projeto',
        'qual o estado atual deste projeto',
        'current state of this project',
        'current project state',
        'what is the current state of this project',
        'status deste repositorio',
        'status do repositorio',
        'como esta este repositorio',
        'como esta o repositorio',
        'ha alteracoes no repositorio',
        'tem alteracoes no repositorio',
        'existem alteracoes no repositorio',
        'arquivos alterados',
        'mudancas pendentes'
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
