'use strict';

const LANGUAGES = Object.freeze({
  ENGLISH: 'en',
  PORTUGUESE: 'pt-BR'
});

function normalizeHumanLanguage(value, fallback = LANGUAGES.PORTUGUESE) {
  const normalized = String(value || '').trim().toLowerCase();

  if (['en', 'en-us', 'english'].includes(normalized)) {
    return LANGUAGES.ENGLISH;
  }

  if (['pt', 'pt-br', 'portuguese', 'português', 'portugues'].includes(normalized)) {
    return LANGUAGES.PORTUGUESE;
  }

  return fallback;
}

function isEnglish(value) {
  return normalizeHumanLanguage(value) === LANGUAGES.ENGLISH;
}

function selectHumanText(language, portuguese, english) {
  return isEnglish(language) ? english : portuguese;
}

module.exports = Object.freeze({
  LANGUAGES,
  normalizeHumanLanguage,
  isEnglish,
  selectHumanText
});
