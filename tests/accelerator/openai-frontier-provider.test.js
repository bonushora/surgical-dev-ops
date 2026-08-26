'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { OPENAI_FRONTIER_PROFILE, requireQualifiedFrontierProvider } = require('../../accelerator/cli/natural-frontier-provider-registry');
const { createOpenAIResponsesTransport } = require('../../accelerator/adapters/openai-responses-transport');
const { createOpenAIFrontierAIProviderAdapter } = require('../../accelerator/adapters/openai-frontier-ai-provider-adapter');
const setupApi = require('../../accelerator/cli/natural-frontier-provider-setup');

function responseFor(events, status = 200) {
  const bytes = new TextEncoder().encode(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''));
  return { status, body: new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }) };
}

function request() {
  return Object.freeze({
    operation: 'RESPONSES', model: 'gpt-5.6', stream: true,
    input: [{ role: 'user', content: [{ type: 'input_text', text: 'Return JSON.' }] }],
    maxOutputTokens: 512
  });
}

test('frontier registry fixes provider endpoint model bounds and zero authority', () => {
  assert.equal(requireQualifiedFrontierProvider('openai:gpt-5.6'), OPENAI_FRONTIER_PROFILE);
  assert.equal(OPENAI_FRONTIER_PROFILE.endpoint, 'https://api.openai.com/v1/responses');
  assert.equal(OPENAI_FRONTIER_PROFILE.automaticallyActivated, false);
  assert.equal(OPENAI_FRONTIER_PROFILE.operationalAuthority, false);
  assert.throws(() => requireQualifiedFrontierProvider('arbitrary:model'), /not qualified/i);
});

test('Responses transport confines bearer credential and emits bounded text deltas', async () => {
  let observed;
  const deltas = [];
  const transport = createOpenAIResponsesTransport({
    credentialProvider: async () => 'secret-test-key',
    async fetchImplementation(url, options) {
      observed = { url, options };
      return responseFor([
        { type: 'response.created' },
        { type: 'response.output_text.delta', delta: '{"response":"hello"}' },
        { type: 'response.completed' }
      ]);
    }
  });
  const result = await transport.invoke(request(), { onEvent: (event) => deltas.push(event) });
  assert.equal(observed.url, OPENAI_FRONTIER_PROFILE.endpoint);
  assert.equal(observed.options.headers.Authorization, 'Bearer secret-test-key');
  assert.deepEqual(JSON.parse(observed.options.body).tools, []);
  assert.equal(JSON.parse(observed.options.body).store, false);
  assert.equal(result.outputText, '{"response":"hello"}');
  assert.deepEqual(deltas, [{ type: 'CONTENT_DELTA', text: '{"response":"hello"}' }]);
  assert.doesNotMatch(JSON.stringify(result), /secret-test-key/);
});

test('interrupted failed malformed oversized and broadened Responses requests fail closed', async () => {
  const make = (events, status = 200) => createOpenAIResponsesTransport({
    credentialProvider: () => 'secret-test-key',
    fetchImplementation: async () => responseFor(events, status)
  });
  await assert.rejects(() => make([{ type: 'response.output_text.delta', delta: 'partial' }]).invoke(request()), /without canonical completion/i);
  await assert.rejects(() => make([{ type: 'response.failed' }]).invoke(request()), /failed safely/i);
  await assert.rejects(() => make([], 401).invoke(request()), /failed safely/i);
  await assert.rejects(() => make([{ type: 'unqualified.event' }]).invoke(request()), /not qualified/i);
  await assert.rejects(() => make([]).invoke(Object.freeze({ ...request(), endpoint: 'https://attacker.invalid' })), /forbidden field/i);
  await assert.rejects(() => make([]).invoke(Object.freeze({ ...request(), model: 'arbitrary' })), /outside the qualified profile/i);
});

test('frontier adapter returns complete validated cognitive JSON only after stream completion', async () => {
  const presentation = [];
  const adapter = createOpenAIFrontierAIProviderAdapter({
    onPresentationEvent: (event) => presentation.push(event),
    transport: async (_request, { onEvent }) => {
      onEvent(Object.freeze({ type: 'CONTENT_DELTA', text: '{"decision":"RESPOND"}' }));
      return Object.freeze({ outputText: '{"decision":"RESPOND"}' });
    }
  });
  const result = await adapter.invoke(Object.freeze({
    schema: 'sdo.ai_cognitive_request.v1', providerId: 'openai:gpt-5.6',
    capability: 'EXPLAIN', objective: 'Explain.', context: Object.freeze({})
  }));
  assert.deepEqual(result, { decision: 'RESPOND' });
  assert.equal(presentation.length, 1);
  const unsafe = createOpenAIFrontierAIProviderAdapter({ transport: async () => ({ outputText: '{"command":"rm"}' }) });
  await assert.rejects(() => unsafe.invoke(Object.freeze({
    schema: 'sdo.ai_cognitive_request.v1', providerId: 'openai:gpt-5.6',
    capability: 'EXPLAIN', objective: 'Explain.', context: Object.freeze({})
  })), /forbidden authority field/i);
});

test('guided setup records explicit choice but never credential or activation authority', () => {
  const setup = setupApi.createNaturalFrontierProviderSetup({ providerId: 'openai:gpt-5.6', language: 'pt-BR' });
  assert.equal(setup.automaticActivation, false);
  assert.match(setup.pricing, /OFFICIAL_SOURCE/);
  assert.throws(() => setupApi.recordNaturalFrontierProviderChoice(setup, Object.freeze({ approved: false })), /exact explicit/i);
  const choice = setupApi.recordNaturalFrontierProviderChoice(setup, Object.freeze({
    approved: true, setupFingerprint: setup.setupFingerprint,
    humanSubject: 'local-human', chosenAt: '2026-08-26T02:00:00.000Z'
  }));
  assert.equal(choice.activationAuthorized, false);
  assert.equal(choice.credentialPresent, false);
  assert.equal(choice.operationalAuthority, false);
});

test('frontier provider surfaces contain no shell filesystem mutation or embedded secret', () => {
  for (const target of [
    '../../accelerator/cli/natural-frontier-provider-registry',
    '../../accelerator/cli/natural-frontier-provider-setup',
    '../../accelerator/adapters/openai-responses-transport',
    '../../accelerator/adapters/openai-frontier-ai-provider-adapter'
  ]) {
    const source = fs.readFileSync(require.resolve(target), 'utf8');
    assert.doesNotMatch(source, /child_process|execSync|spawn\(|writeFileSync|FILESYSTEM_PATCH|sk-[A-Za-z0-9]/);
  }
});
