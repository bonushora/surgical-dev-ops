'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { createNaturalCognitiveSession } = require('../../accelerator/cli/natural-cognitive-session');
const { createNaturalSessionControl, formatProviderStatus } = require('../../accelerator/cli/natural-session-control');
const {
  createNaturalAgenticMission,
  projectMissionAuthority
} = require('../../accelerator/core/natural-agentic-mission');

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

test('remote cognition receives only sensitive-boundary-mediated evidence', async () => {
  const requests = [];
  const session = createNaturalCognitiveSession();
  await session.activateOpenAIProvider({
    transport: async (request) => {
      requests.push(JSON.stringify(request));
      return { outputText: '{"response":"ok"}' };
    }
  });
  const activation = { interactionMode: { mode: 'NATURAL' }, workspace: 'example' };
  const response = await session.ask('Explique.', activation, 'api_key=secret-test-key');
  assert.match(response, /ok/);
  assert.equal(requests.length, 2);
  assert.doesNotMatch(requests[1], /secret-test-key/);
  assert.match(requests[1], /REDACTED_BY_SURGICAL_DEVOPS:ASSIGNMENT_SECRET/);
});

test('blocked remote evidence is not dispatched and cannot alter the session', async () => {
  let calls = 0;
  const session = createNaturalCognitiveSession();
  await session.activateOpenAIProvider({
    transport: async () => {
      calls += 1;
      return { outputText: '{"response":"ok"}' };
    }
  });
  const activation = { interactionMode: { mode: 'NATURAL' }, workspace: 'example' };
  const response = await session.ask(
    'Explique.',
    activation,
    '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----'
  );
  assert.match(response, /bloqueada|blocked/i);
  assert.equal(calls, 1);
});

test('remote-to-local substitution preserves the governed mission authority envelope', async () => {
  const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
  const sessionBinding = Object.freeze({
    schema: 'sdo.deterministic_workspace_session.v1',
    physical: { root: '/project' },
    physicalWorkspaceIdentity: sha('workspace'),
    repositoryHead: sha('head'),
    worktreeFingerprint: sha('worktree'),
    sessionFingerprint: sha('session'),
    operationalAuthority: false,
    mutationAuthority: false
  });
  const mission = createNaturalAgenticMission({
    missionId: 'provider-switch-mission',
    objective: 'Preserve governed continuity.',
    session: sessionBinding,
    createdAt: '2026-09-01T12:00:00.000Z',
    plan: [{ stepId: 'inspect', summary: 'Inspect.', status: 'ACTIVE' }]
  });
  const session = createNaturalCognitiveSession({ fetchImplementation: async () => localInventory() });
  const remote = await session.activateOpenAIProvider({
    transport: async () => ({ outputText: '{"response":"VALIDATION_OK"}' }),
    mission,
    at: '2026-09-01T12:01:00.000Z'
  });
  const local = await session.selectLocalModel('qwen3:8b', {
    mission: remote.mission,
    at: '2026-09-01T12:02:00.000Z'
  });
  assert.equal(remote.mission.provider.providerKind, 'REMOTE');
  assert.equal(local.mission.provider.providerKind, 'LOCAL');
  const before = projectMissionAuthority(mission);
  const after = projectMissionAuthority(local.mission);
  assert.equal(after.missionId, before.missionId);
  assert.deepEqual(after.allowedCapabilities, before.allowedCapabilities);
  assert.deepEqual(after.deniedCapabilities, before.deniedCapabilities);
  assert.equal(after.operationalAuthority, false);
  assert.equal(after.mutationAuthority, false);
  assert.deepEqual(local.mission.binding, mission.binding);
});

test('NATURAL provider intents are bilingual and truthful for qualified and unqualified providers', () => {
  const pt = createNaturalSessionControl({ language: 'pt-BR' });
  const en = createNaturalSessionControl({ language: 'en' });
  assert.equal(pt.handle('Quais IAs estão disponíveis?').action, 'PROVIDER_LIST');
  assert.equal(en.handle('Which AI providers are available?').action, 'PROVIDER_LIST');
  assert.equal(pt.handle('Use GPT.').action, 'FRONTIER_PROVIDER_SETUP');
  assert.equal(en.handle('Use OpenAI.').action, 'FRONTIER_PROVIDER_SETUP');
  const claude = pt.handle('Use Claude.');
  const gemini = en.handle('Use Gemini.');
  assert.equal(claude.action, 'UNAVAILABLE_PROVIDER');
  assert.equal(gemini.action, 'UNAVAILABLE_PROVIDER');
  assert.match(claude.output, /UNAVAILABLE|não.*qualificado/i);
  assert.match(gemini.output, /UNAVAILABLE|not qualified/i);
  assert.equal(pt.handle('Volte para a IA local.').model, 'qwen3:8b');
});

test('manual-acceptance provider phrases never escape deterministic session routing', () => {
  const control = createNaturalSessionControl({ language: 'pt-BR' });
  const expectedActions = new Map([
    ['Qual provider estou usando?', 'PROVIDER_STATUS'],
    ['Qual modelo está ativo?', 'PROVIDER_STATUS'],
    ['Que IA estou usando?', 'PROVIDER_STATUS'],
    ['Mostre o provider ativo.', 'PROVIDER_STATUS'],
    ['Mostre os providers.', 'PROVIDER_LIST'],
    ['Liste as IAs disponíveis.', 'PROVIDER_LIST'],
    ['Quero configurar a OpenAI.', 'FRONTIER_PROVIDER_SETUP'],
    ['Quero configurar a OpenAI via API.', 'FRONTIER_PROVIDER_SETUP'],
    ['Configure OpenAI.', 'FRONTIER_PROVIDER_SETUP'],
    ['Configure OpenAI API.', 'FRONTIER_PROVIDER_SETUP'],
    ['Mude para GPT.', 'FRONTIER_PROVIDER_SETUP'],
    ['Troque para OpenAI.', 'FRONTIER_PROVIDER_SETUP'],
    ['Quero configurar GPT.', 'FRONTIER_PROVIDER_SETUP'],
    ['Configurar GPT.', 'FRONTIER_PROVIDER_SETUP'],
    ['Ativar OpenAI.', 'FRONTIER_PROVIDER_SETUP'],
    ['Ative GPT.', 'FRONTIER_PROVIDER_SETUP'],
    ['I want to configure OpenAI.', 'FRONTIER_PROVIDER_SETUP'],
    ['Activate OpenAI.', 'FRONTIER_PROVIDER_SETUP'],
    ['Volte para Qwen.', 'LOCAL_MODEL_SELECTION'],
    ['Mude para Qwen.', 'LOCAL_MODEL_SELECTION'],
    ['Troque para Qwen.', 'LOCAL_MODEL_SELECTION'],
    ['Quero usar Qwen.', 'LOCAL_MODEL_SELECTION'],
    ['Use qwen3:8b.', 'LOCAL_MODEL_SELECTION'],
    ['Troque para Gemma.', 'LOCAL_MODEL_SELECTION'],
    ['Use Gemma.', 'LOCAL_MODEL_SELECTION'],
    ['Mude para Gemma.', 'LOCAL_MODEL_SELECTION'],
    ['Troque para gemma3:4b.', 'LOCAL_MODEL_SELECTION'],
    ['Quero usar Gemma.', 'LOCAL_MODEL_SELECTION'],
    ['Use gemma3:4b.', 'LOCAL_MODEL_SELECTION'],
    ['Switch to Qwen.', 'LOCAL_MODEL_SELECTION'],
    ['Switch to Gemma.', 'LOCAL_MODEL_SELECTION'],
    ['Ativar Claude.', 'UNAVAILABLE_PROVIDER'],
    ['Quero configurar Claude.', 'UNAVAILABLE_PROVIDER'],
    ['Ativar Gemini.', 'UNAVAILABLE_PROVIDER'],
    ['Quero configurar Gemini.', 'UNAVAILABLE_PROVIDER']
  ]);

  for (const [input, expectedAction] of expectedActions) {
    const result = control.handle(input);
    assert.equal(result.matched, true, input);
    assert.equal(result.action, expectedAction, input);
  }
});

test('provider status presents remote ACTIVE without falsely calling it local', () => {
  const output = formatProviderStatus(Object.freeze({
    provider: 'OpenAI', model: 'gpt-5.6', local: false, available: true,
    active: true, state: 'ACTIVE', operationalAuthority: false
  }), 'en');
  assert.match(output, /Execution: remote/);
  assert.match(output, /State: ACTIVE/);
  assert.doesNotMatch(output, /Execution: local/);
});
