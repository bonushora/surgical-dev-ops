'use strict';

const EXPERIENCE_SCHEMA = 'sdo.natural_experience_surface.v1';
const MAX_HISTORY_ITEMS = 32;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function boundedText(value, label, maximum = 256) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new Error(`${label} is invalid.`);
  }
  return value.trim();
}

function normalizeHistory(history) {
  if (!Array.isArray(history) || history.length > MAX_HISTORY_ITEMS) {
    throw new Error('Experience history exceeds its canonical bound.');
  }
  return history.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Experience history item is invalid.');
    return deepFreeze({
      kind: boundedText(item.kind, 'History kind', 64),
      summary: boundedText(item.summary, 'History summary', 500)
    });
  });
}

function createNaturalExperienceSnapshot({
  project, provider, privacyMode, workMode,
  pendingAuthorization = null, conversation = null,
  task = null, history = []
} = {}) {
  if (pendingAuthorization !== null && typeof pendingAuthorization !== 'object') {
    throw new Error('Pending authorization projection is invalid.');
  }
  if (conversation !== null && typeof conversation !== 'object') {
    throw new Error('Conversation projection is invalid.');
  }
  if (task !== null && typeof task !== 'object') {
    throw new Error('Task projection is invalid.');
  }
  return deepFreeze({
    schema: EXPERIENCE_SCHEMA,
    project: boundedText(project, 'Active project'),
    provider: boundedText(provider, 'Active provider'),
    privacyMode: boundedText(privacyMode, 'Privacy mode', 64),
    workMode: boundedText(workMode, 'Work mode', 64),
    pendingAuthorization,
    conversation,
    task,
    history: normalizeHistory(history),
    controls: ['STOP', 'RESUME', 'CLEAR_MEMORY', 'SWITCH_PROVIDER'],
    presentationOnly: true,
    canonicalOrchestratorOnly: true,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.schema !== EXPERIENCE_SCHEMA || !Object.isFrozen(snapshot)) {
    throw new Error('Immutable NATURAL experience snapshot is required.');
  }
}

function formatNaturalTerminalExperience(snapshot, language = 'pt-BR') {
  validateSnapshot(snapshot);
  const english = language === 'en';
  const pending = snapshot.pendingAuthorization
    ? (english ? 'yes — human decision required' : 'sim — decisão humana necessária')
    : (english ? 'none' : 'nenhuma');
  return (
    `${english ? 'Experience state' : 'Estado da experiência'}:\n` +
    `  ${english ? 'Project' : 'Projeto'}: ${snapshot.project}\n` +
    `  Provider: ${snapshot.provider}\n` +
    `  ${english ? 'Privacy' : 'Privacidade'}: ${snapshot.privacyMode}\n` +
    `  ${english ? 'Work mode' : 'Modo de trabalho'}: ${snapshot.workMode}\n` +
    `  ${english ? 'Pending authorization' : 'Autorização pendente'}: ${pending}\n` +
    `  ${english ? 'Operational authority of presentation' : 'Autoridade operacional da apresentação'}: ${english ? 'none' : 'nenhuma'}\n`
  );
}

function formatNaturalWebExperience(snapshot) {
  validateSnapshot(snapshot);
  return JSON.stringify(snapshot);
}

module.exports = Object.freeze({
  EXPERIENCE_SCHEMA,
  MAX_HISTORY_ITEMS,
  createNaturalExperienceSnapshot,
  formatNaturalTerminalExperience,
  formatNaturalWebExperience
});
