'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createNaturalCognitiveSession } = require('../../accelerator/cli/natural-cognitive-session');

function activation() {
  return Object.freeze({ workspace: 'surgical-dev-ops', interactionMode: Object.freeze({ mode: 'NATURAL' }) });
}

function response(content) {
  return new Response(JSON.stringify({ message: { role: 'assistant', content: JSON.stringify(content) } }), {
    status: 200, headers: { 'content-type': 'application/json' }
  });
}

test('identical governed evidence planning is reused without another inference', async () => {
  let chats = 0;
  const session = createNaturalCognitiveSession({
    async fetchImplementation(url) {
      if (url.endsWith('/api/tags')) {
        return new Response(JSON.stringify({ models: [{ name: 'llama3:latest' }] }), {
          status: 200, headers: { 'content-type': 'application/json' }
        });
      }
      chats += 1;
      return response({
        decision: 'REQUEST_EVIDENCE', response: null,
        evidenceRequest: { kind: 'WORKSPACE_FILES', target: null, reason: 'Inventariar o workspace autorizado.' }
      });
    }
  });
  const first = await session.decideEvidence('Explique o projeto.', activation(), []);
  const second = await session.decideEvidence('Explique o projeto.', activation(), []);
  assert.equal(first, second);
  assert.equal(chats, 1);
  assert.equal(session.conversationState().decisionCacheHits, 1);
});

test('bounded prior exchange is carried to the next cognitive explanation', async () => {
  const objectives = [];
  const session = createNaturalCognitiveSession({
    async fetchImplementation(url, options) {
      if (url.endsWith('/api/tags')) {
        return new Response(JSON.stringify({ models: [{ name: 'llama3:latest' }] }), {
          status: 200, headers: { 'content-type': 'application/json' }
        });
      }
      objectives.push(
        JSON.parse(
          JSON.parse(options.body).messages[1].content
        ).objective
      );
      return response({ response: objectives.length === 1 ? 'Primeira resposta.' : 'Segunda resposta.' });
    }
  });
  await session.ask('Qual é o projeto?', activation());
  await session.ask('E por que ele é seguro?', activation());
  assert.equal(objectives.length, 2);
  assert.doesNotMatch(objectives[0], /TURN_1_USER/);
  assert.match(objectives[1], /TURN_1_USER: Qual é o projeto\?/);
  assert.match(objectives[1], /TURN_1_ASSISTANT: Primeira resposta\./);
  assert.equal(session.conversationState().turnCount, 2);

  const reset = session.resetConversation();
  assert.equal(reset.turnCount, 0);
  assert.equal(session.conversationState().decisionCacheEntries, 0);
});
