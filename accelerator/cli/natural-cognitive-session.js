'use strict';

const crypto =
  require('node:crypto');

const {
  discoverNaturalDefaultProvider
} = require(
  './natural-provider-discovery'
);

const {
  createNaturalLocalAIComposition,
  invokeNaturalCognitive
} = require(
  './natural-ai-runtime'
);

const MAX_PRESENTED_TEXT =
  6000;

function extractText(value, depth = 0) {
  if (depth > 5) {
    return null;
  }

  if (typeof value === 'string') {
    const text =
      value.trim();

    return text || null;
  }

  if (
    !value ||
    typeof value !== 'object'
  ) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      const text =
        extractText(
          child,
          depth + 1
        );

      if (text) {
        return text;
      }
    }

    return null;
  }

  /*
   * Prefer ordinary human-facing fields.
   * This is presentation only; no field from the model
   * becomes executable authority.
   */
  for (const key of [
    'message',
    'answer',
    'response',
    'summary',
    'explanation',
    'text',
    'content'
  ]) {
    if (
      Object.prototype.hasOwnProperty.call(
        value,
        key
      )
    ) {
      const text =
        extractText(
          value[key],
          depth + 1
        );

      if (text) {
        return text;
      }
    }
  }

  for (const child of Object.values(value)) {
    const text =
      extractText(
        child,
        depth + 1
      );

    if (text) {
      return text;
    }
  }

  return null;
}

function formatCognitiveResult(result) {
  if (
    !result ||
    result.schema !==
      'sdo.ai_cognitive_result.v1'
  ) {
    return (
      'A IA local respondeu de forma inválida. ' +
      'Nenhuma alteração foi realizada.\n'
    );
  }

  if (result.status !== 'COMPLETED') {
    return (
      'A IA local não conseguiu concluir esta resposta. ' +
      'Nenhuma alteração foi realizada.\n'
    );
  }

  const extracted =
    extractText(
      result.output
    );

  if (!extracted) {
    return (
      'A IA local respondeu, mas não produziu uma explicação ' +
      'que eu possa apresentar com segurança. ' +
      'Nenhuma alteração foi realizada.\n'
    );
  }

  const bounded =
    extracted.length >
      MAX_PRESENTED_TEXT
      ? (
          extracted.slice(
            0,
            MAX_PRESENTED_TEXT
          ) +
          '\n[resposta limitada pelo Surgical DevOps]'
        )
      : extracted;

  return (
    `${bounded}\n\n` +
    'Resposta cognitiva do Llama 3 via Ollama. ' +
    'Nenhuma alteração foi realizada.\n'
  );
}

function fallbackMessage(discovery) {
  const reason =
    discovery &&
    typeof discovery.reason === 'string'
      ? discovery.reason
      : 'Provider cognitivo local indisponível.';

  return (
    'O assistente cognitivo local não está disponível agora.\n' +
    `${reason}\n` +
    'O modo determinístico continua ativo.\n' +
    'Nenhuma alteração foi realizada.\n'
  );
}

function createNaturalCognitiveSession(
  input = {}
) {
  const fetchImplementation =
    input.fetchImplementation ||
    globalThis.fetch;

  let statePromise = null;

  async function initialize() {
    const discovery =
      await discoverNaturalDefaultProvider({
        fetchImplementation
      });

    if (!discovery.available) {
      return Object.freeze({
        discovery,
        composition:
          null
      });
    }

    const composition =
      createNaturalLocalAIComposition({
        discovery,
        fetchImplementation
      });

    return Object.freeze({
      discovery,
      composition
    });
  }

  function state() {
    if (!statePromise) {
      statePromise =
        initialize();
    }

    return statePromise;
  }

  async function ask(
    userInput,
    activation
  ) {
    if (
      typeof userInput !== 'string' ||
      !userInput.trim()
    ) {
      throw new Error(
        'NATURAL cognitive user input is required.'
      );
    }

    if (
      !activation ||
      typeof activation !== 'object' ||
      !activation.interactionMode ||
      activation.interactionMode.mode !==
        'NATURAL'
    ) {
      throw new Error(
        'NATURAL interaction activation is required.'
      );
    }

    const current =
      await state();

    if (!current.composition) {
      return fallbackMessage(
        current.discovery
      );
    }

    try {
      const result =
        await invokeNaturalCognitive(
          current.composition,
          {
            requestId:
              'natural-' +
              crypto.randomUUID(),

            capability:
              'EXPLAIN',

            objective:
              (
                'Responda em português claro para um usuário leigo. ' +
                'A resposta é somente cognitiva: não afirme que executou, ' +
                'alterou arquivos, aprovou operações ou ganhou autoridade. ' +
                'Pedido do usuário: ' +
                userInput.trim()
              ),

            context: {
              interactionMode:
                'NATURAL',

              workspace:
                activation.workspace
            }
          }
        );

      return formatCognitiveResult(
        result
      );
    } catch {
      return (
        'A IA local não conseguiu responder com segurança.\n' +
        'O modo determinístico continua ativo.\n' +
        'Nenhuma alteração foi realizada.\n'
      );
    }
  }

  async function describe() {
    const current =
      await state();

    return current.discovery;
  }

  return Object.freeze({
    schema:
      'sdo.natural_cognitive_session.v1',

    ask,
    describe
  });
}

module.exports = Object.freeze({
  extractText,
  formatCognitiveResult,
  createNaturalCognitiveSession
});
