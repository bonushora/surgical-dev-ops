'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createNaturalExperienceSnapshot,
  formatNaturalTerminalExperience,
  formatNaturalWebExperience
} = require('../../accelerator/cli/natural-experience-surface');
const { createNaturalSessionControl } = require('../../accelerator/cli/natural-session-control');

test('terminal and web project the same immutable zero-authority NATURAL state', () => {
  const snapshot = createNaturalExperienceSnapshot({
    project: 'surgical-dev-ops', provider: 'Ollama/qwen3:8b',
    privacyMode: 'local', workMode: 'SUPERVISED_MICROTASKS',
    conversation: Object.freeze({ turnCount: 2 }),
    history: [{ kind: 'RESPONSE', summary: 'Bounded response.' }]
  });
  const web = JSON.parse(formatNaturalWebExperience(snapshot));
  const terminal = formatNaturalTerminalExperience(snapshot, 'pt-BR');
  assert.equal(web.project, 'surgical-dev-ops');
  assert.equal(web.operationalAuthority, false);
  assert.equal(web.mutationAuthority, false);
  assert.equal(web.canonicalOrchestratorOnly, true);
  assert.match(terminal, /Projeto: surgical-dev-ops/);
  assert.match(terminal, /Autoridade operacional.*nenhuma/);
  assert.equal(Object.isFrozen(snapshot.history[0]), true);
});

test('Portuguese and English experience controls cross the same deterministic action', () => {
  const portuguese = createNaturalSessionControl().handle('estado da experiência');
  const english = createNaturalSessionControl().handle('experience status');
  assert.equal(portuguese.action, 'EXPERIENCE_STATUS');
  assert.equal(english.action, 'EXPERIENCE_STATUS');
  assert.equal(portuguese.language, 'pt-BR');
  assert.equal(english.language, 'en');
});

test('pending authorization is projected as data and never as a grant', () => {
  const control = createNaturalSessionControl({ workspace: 'example' });
  control.handle('Explique este projeto para mim.');
  const state = control.experienceState();
  assert.ok(state.pendingAuthorization);
  assert.equal(state.operationalAuthority, false);
  assert.equal(state.mutationAuthority, false);
  assert.equal(Object.prototype.hasOwnProperty.call(state.pendingAuthorization, 'grant'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(state.pendingAuthorization, 'execute'), false);
});

test('experience history remains bounded', () => {
  assert.throws(() => createNaturalExperienceSnapshot({
    project: 'x', provider: 'x', privacyMode: 'x', workMode: 'x',
    history: Array.from({ length: 33 }, () => ({ kind: 'x', summary: 'x' }))
  }), /bound/);
});
