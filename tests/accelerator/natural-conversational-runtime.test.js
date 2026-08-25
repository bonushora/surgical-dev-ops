'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_TURNS, MAX_TEXT_CHARS, MAX_CONTEXT_CHARS, MAX_CACHE_ENTRIES,
  createNaturalConversationalRuntime
} = require('../../accelerator/cli/natural-conversational-runtime');

test('conversational memory is bounded session-local and authority-free', () => {
  const runtime = createNaturalConversationalRuntime();
  for (let index = 0; index < MAX_TURNS + 3; index += 1) {
    runtime.rememberExchange(
      `pedido-${index}-` + 'u'.repeat(MAX_TEXT_CHARS * 2),
      `resposta-${index}-` + 'a'.repeat(MAX_TEXT_CHARS * 2)
    );
  }
  const context = runtime.formatContext();
  const state = runtime.snapshot();
  assert.equal(state.turnCount, MAX_TURNS);
  assert.ok(context.length <= MAX_CONTEXT_CHARS);
  assert.doesNotMatch(context, /pedido-0-/);
  assert.match(context, new RegExp(`pedido-${MAX_TURNS + 2}-`));
  assert.equal(state.persistent, false);
  assert.equal(state.contentTelemetry, false);
  assert.equal(state.operationalAuthority, false);
  assert.equal(state.mutationAuthority, false);
  assert.equal(Object.isFrozen(state), true);
});

test('decision cache reuses only an exact objective and evidence fingerprint', () => {
  const runtime = createNaturalConversationalRuntime();
  const decision = Object.freeze({ decision: 'RESPOND' });
  const exact = runtime.decisionKey('objetivo', 'evidência-a');
  const changed = runtime.decisionKey('objetivo', 'evidência-b');
  runtime.rememberDecision(exact, decision);
  assert.equal(runtime.recallDecision(exact), decision);
  assert.equal(runtime.recallDecision(changed), null);
  assert.equal(runtime.snapshot().decisionCacheHits, 1);
});

test('decision cache has a fixed entry ceiling and no execution surface', () => {
  const runtime = createNaturalConversationalRuntime();
  for (let index = 0; index < MAX_CACHE_ENTRIES + 4; index += 1) {
    runtime.rememberDecision(
      runtime.decisionKey(`objective-${index}`, ''),
      Object.freeze({ decision: 'RESPOND', index })
    );
  }
  assert.equal(runtime.snapshot().decisionCacheEntries, MAX_CACHE_ENTRIES);
  for (const surface of ['execute', 'dispatch', 'filesystem', 'shell', 'mutate']) {
    assert.equal(surface in runtime, false);
  }
});

test('reset clears only ephemeral conversation state', () => {
  const runtime = createNaturalConversationalRuntime();
  runtime.rememberExchange('pedido', 'resposta');
  const key = runtime.decisionKey('objetivo', 'evidência');
  runtime.rememberDecision(key, Object.freeze({ decision: 'RESPOND' }));
  runtime.recallDecision(key);

  const state = runtime.reset();

  assert.equal(state.turnCount, 0);
  assert.equal(state.decisionCacheEntries, 0);
  assert.equal(state.decisionCacheHits, 0);
  assert.equal(state.operationalAuthority, false);
});
