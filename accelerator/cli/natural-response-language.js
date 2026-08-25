'use strict';

const ENGLISH_INTENT =
  /\b(?:explain|analy[sz]e|examine|evaluate|read|show|list|project|file|files|directory|workspace|in english)\b/i;

function detectNaturalResponseLanguage(
  value
) {
  return ENGLISH_INTENT.test(
    String(value || '')
  )
    ? 'en'
    : 'pt-BR';
}

module.exports =
  Object.freeze({
    detectNaturalResponseLanguage
  });
