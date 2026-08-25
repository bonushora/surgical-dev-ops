'use strict';

const crypto = require('node:crypto');

const MAX_TURNS = 6;
const MAX_TEXT_CHARS = 1200;
const MAX_CONTEXT_CHARS = 6000;
const MAX_CACHE_ENTRIES = 16;

function boundedText(value) {
  return String(value || '').trim().slice(0, MAX_TEXT_CHARS);
}

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value), 'utf8')
    .digest('hex');
}

function createNaturalConversationalRuntime() {
  const turns = [];
  const decisions = new Map();
  let cacheHits = 0;

  function rememberExchange(user, assistant) {
    const boundedUser = boundedText(user);
    const boundedAssistant = boundedText(assistant);

    if (!boundedUser || !boundedAssistant) {
      throw new Error('Bounded conversational exchange is required.');
    }

    turns.push(Object.freeze({
      user: boundedUser,
      assistant: boundedAssistant
    }));

    while (turns.length > MAX_TURNS) {
      turns.shift();
    }
  }

  function formatContext() {
    return turns.map(
      (turn, index) =>
        `TURN_${index + 1}_USER: ${turn.user}\n` +
        `TURN_${index + 1}_ASSISTANT: ${turn.assistant}`
    ).join('\n\n').slice(-MAX_CONTEXT_CHARS);
  }

  function decisionKey(objective, evidenceHistory) {
    return fingerprint({
      objective: String(objective || '').trim(),
      evidenceHistory
    });
  }

  function recallDecision(key) {
    if (!decisions.has(key)) {
      return null;
    }

    cacheHits += 1;
    return decisions.get(key);
  }

  function rememberDecision(key, decision) {
    if (typeof key !== 'string' || !key || !Object.isFrozen(decision)) {
      throw new Error('Immutable cognitive decision cache entry is required.');
    }

    decisions.set(key, decision);

    while (decisions.size > MAX_CACHE_ENTRIES) {
      decisions.delete(decisions.keys().next().value);
    }
  }

  function snapshot() {
    return Object.freeze({
      schema: 'sdo.natural_conversational_runtime_state.v1',
      turnCount: turns.length,
      decisionCacheEntries: decisions.size,
      decisionCacheHits: cacheHits,
      persistent: false,
      contentTelemetry: false,
      operationalAuthority: false,
      mutationAuthority: false
    });
  }

  function reset() {
    turns.length = 0;
    decisions.clear();
    cacheHits = 0;

    return snapshot();
  }

  return Object.freeze({
    schema: 'sdo.natural_conversational_runtime.v1',
    rememberExchange,
    formatContext,
    decisionKey,
    recallDecision,
    rememberDecision,
    snapshot,
    reset
  });
}

module.exports = Object.freeze({
  MAX_TURNS,
  MAX_TEXT_CHARS,
  MAX_CONTEXT_CHARS,
  MAX_CACHE_ENTRIES,
  createNaturalConversationalRuntime
});
