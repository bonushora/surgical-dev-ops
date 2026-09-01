'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const api = require('../../accelerator/cli/natural-provider-activation-coordinator');

test('provider coordinator exposes a closed qualified catalog', () => {
  assert.deepEqual(Object.keys(api.PROVIDER_CATALOG), [
    'ollama:qwen3:8b',
    'ollama:gemma3:4b',
    'openai:gpt-5.6',
    'anthropic:claude',
    'google:gemini'
  ]);
  assert.throws(() => api.deriveProviderState('arbitrary:provider'), /outside the qualified catalog/i);
});

test('Qwen and Gemma derive honest local states from physical evidence', () => {
  const qwen = api.deriveProviderState('ollama:qwen3:8b', { available: true, active: true });
  const gemma = api.deriveProviderState('ollama:gemma3:4b', { available: true });
  assert.equal(qwen.state, 'ACTIVE');
  assert.equal(qwen.provider, 'Ollama');
  assert.equal(qwen.model, 'qwen3:8b');
  assert.equal(gemma.state, 'AVAILABLE');
  assert.equal(gemma.model, 'gemma3:4b');
});

test('OpenAI is known but remains configuration-required until validated', () => {
  const state = api.deriveProviderState('openai:gpt-5.6');
  assert.equal(state.state, 'CONFIGURATION_REQUIRED');
  assert.equal(state.active, false);
  assert.equal(state.qualified, true);
  assert.equal(api.deriveProviderState('openai:gpt-5.6', { configured: true }).state, 'UNAVAILABLE');
  assert.equal(api.deriveProviderState('openai:gpt-5.6', { configured: true, validated: true }).state, 'AVAILABLE');
});

test('Claude and Gemini are recognized but truthfully unavailable', () => {
  for (const providerId of ['anthropic:claude', 'google:gemini']) {
    const state = api.deriveProviderState(providerId);
    assert.equal(state.state, 'UNAVAILABLE');
    assert.equal(state.active, false);
    assert.equal(state.qualified, false);
  }
});

test('activation requests normalize supported aliases and reject arbitrary providers', () => {
  assert.equal(api.normalizeProviderActivationRequest('Use GPT.').providerId, 'openai:gpt-5.6');
  assert.equal(api.normalizeProviderActivationRequest('Volte para a IA local').intent, 'ACTIVATE_LOCAL_PROVIDER');
  assert.equal(api.normalizeProviderActivationRequest('Use Claude').providerId, 'anthropic:claude');
  assert.throws(() => api.normalizeProviderActivationRequest('Use arbitrary provider'), /outside the qualified catalog/i);
});

test('provider states and coordinator expose no operational authority', () => {
  const state = api.deriveProviderState('ollama:qwen3:8b', { available: true, active: true });
  const coordinator = api.createNaturalProviderActivationCoordinator();
  for (const value of [state, coordinator.authority]) {
    assert.equal(value.operationalAuthority, false);
    assert.equal(value.mutationAuthority, false);
    assert.equal(value.shellAuthority, false);
    assert.equal(value.gitAuthority, false);
    assert.equal(value.networkAuthority, false);
  }
  assert.equal(Object.isFrozen(coordinator), true);
  assert.doesNotMatch(fs.readFileSync(require.resolve('../../accelerator/cli/natural-provider-activation-coordinator'), 'utf8'), /child_process|execSync|spawn\(|writeFileSync|readFileSync/);
});
