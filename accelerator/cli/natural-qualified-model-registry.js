'use strict';

/*
 * Closed registry of locally qualified NATURAL cognitive models.
 *
 * This module is data only. It cannot discover, install, download or invoke
 * a model and it creates no operational authority.
 */

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

const QUALIFIED_LOCAL_MODELS =
  deepFreeze([
    {
      providerId:
        'ollama:qwen3:8b',
      provider:
        'Ollama',
      model:
        'qwen3:8b',
      label:
        'Qwen 3 8B',
      profile:
        'QUALITY_BILINGUAL',
      languages: [
        'pt-BR',
        'en'
      ],
      local:
        true,
      paid:
        false,
      operationalAuthority:
        false
    },
    {
      providerId:
        'ollama:gemma3:4b',
      provider:
        'Ollama',
      model:
        'gemma3:4b',
      label:
        'Gemma 3 4B',
      profile:
        'FAST_BILINGUAL',
      languages: [
        'pt-BR',
        'en'
      ],
      local:
        true,
      paid:
        false,
      operationalAuthority:
        false
    }
  ]);

const DEFAULT_MODEL_PROFILE =
  QUALIFIED_LOCAL_MODELS[0];

const ALIASES =
  Object.freeze({
    'qwen3:8b':
      'qwen3:8b',
    qwen3:
      'qwen3:8b',
    qwen:
      'qwen3:8b',
    'gemma3:4b':
      'gemma3:4b',
    gemma3:
      'gemma3:4b',
    gemma:
      'gemma3:4b'
  });

function normalizeModelName(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function findQualifiedLocalModel(value) {
  const normalized =
    normalizeModelName(value);

  const canonical =
    ALIASES[normalized] ||
    normalized;

  return (
    QUALIFIED_LOCAL_MODELS.find(
      (profile) =>
        profile.model === canonical
    ) || null
  );
}

function requireQualifiedLocalModel(value) {
  const profile =
    findQualifiedLocalModel(value);

  if (!profile) {
    throw new Error(
      'Requested local model is not in the closed qualified registry.'
    );
  }

  return profile;
}

module.exports = Object.freeze({
  QUALIFIED_LOCAL_MODELS,
  DEFAULT_MODEL_PROFILE,
  findQualifiedLocalModel,
  requireQualifiedLocalModel
});
