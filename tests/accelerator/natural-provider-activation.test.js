'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createNaturalCognitiveSession } = require('../../accelerator/cli/natural-cognitive-session');

function localInventory() {
  const body = new TextEncoder().encode(JSON.stringify({ models: [{ name: 'qwen3:8b' }] }));
  return { status: 200, body: new ReadableStream({ start(controller) { controller.enqueue(body); controller.close(); } }) };
}

test('missing OpenAI configuration derives CONFIGURATION_REQUIRED without changing local state', async () => {
  const session = createNaturalCognitiveSession({ fetchImplementation: async () => localInventory() });
  assert.equal((await session.describe()).model, 'qwen3:8b');
  const result = await session.activateOpenAIProvider();
  assert.equal(result.state, 'CONFIGURATION_REQUIRED');
  assert.equal(result.available, false);
  assert.equal((await session.describe()).model, 'qwen3:8b');
});

test('bounded OpenAI validation activates the remote session and resets temporary cognition', async () => {
  let calls = 0;
  const session = createNaturalCognitiveSession({ fetchImplementation: async () => localInventory() });
  await session.describe();
  session.rememberExchange('pergunta', 'resposta');
  const result = await session.activateOpenAIProvider({
    credentialProvider: async () => 'secret-test-key',
    fetchImplementation: async () => { throw new Error('injected transport is required'); },
    transport: async (request) => {
      calls += 1;
      assert.equal(request.providerId, undefined);
      return { outputText: '{"response":"VALIDATION_OK"}' };
    }
  });
  assert.equal(result.state, 'ACTIVE');
  assert.equal(result.providerId, 'openai:gpt-5.6');
  assert.equal(result.local, false);
  assert.equal(session.conversationState().turnCount, 0);
  assert.equal(calls, 1);
  assert.equal(result.operationalAuthority, false);
});

test('failed OpenAI activation preserves the previous provider and fails closed', async () => {
  const session = createNaturalCognitiveSession({ fetchImplementation: async () => localInventory() });
  assert.equal((await session.describe()).model, 'qwen3:8b');
  const result = await session.activateOpenAIProvider({
    transport: async () => { throw new Error('provider unavailable'); }
  });
  assert.equal(result.state, 'UNAVAILABLE');
  assert.equal(result.active, false);
  assert.equal((await session.describe()).model, 'qwen3:8b');
  assert.equal((await session.describe()).provider, 'Ollama');
});

test('OpenAI activation never exposes credential material or operational authority', async () => {
  const session = createNaturalCognitiveSession();
  const result = await session.activateOpenAIProvider({
    credentialProvider: () => 'secret-test-key',
    fetchImplementation: async () => { throw new Error('not used'); },
    transport: async () => ({ outputText: '{"response":"VALIDATION_OK"}' })
  });
  assert.equal(result.operationalAuthority, false);
  assert.doesNotMatch(JSON.stringify(result), /secret-test-key/);
  assert.doesNotMatch(JSON.stringify(result), /credential/i);
});
