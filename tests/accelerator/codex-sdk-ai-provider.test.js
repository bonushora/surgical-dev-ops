'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const {
  CODEX_SDK_PROVIDER_ID,
  createCodexSDKAIProviderAdapter
} = require('../../accelerator/adapters/codex-sdk-ai-provider-adapter');
const {
  createNaturalCodexComposition,
  invokeNaturalCognitive
} = require('../../accelerator/cli/natural-ai-runtime');
const {
  createNaturalCognitiveSession
} = require('../../accelerator/cli/natural-cognitive-session');

function cognitiveRequest() {
  return Object.freeze({
    schema: 'sdo.ai_cognitive_request.v1',
    providerId: CODEX_SDK_PROVIDER_ID,
    capability: 'EXPLAIN',
    objective: 'Explain the bounded next step.',
    context: Object.freeze({ workspace: 'fixture' })
  });
}

function fakeSDK(output = { response: 'Bounded cognitive answer.' }, observations = {}) {
  class Codex {
    startThread(options) {
      observations.started = options;
      return this.thread();
    }
    resumeThread(id, options) {
      observations.resumed = { id, options };
      return this.thread();
    }
    thread() {
      return {
        async runStreamed(prompt, options) {
          observations.prompt = JSON.parse(prompt);
          observations.turnOptions = options;
          return {
            events: (async function* () {
              yield { type: 'thread.started', thread_id: 'thread-physical-1' };
              yield { type: 'turn.started' };
              yield {
                type: 'item.completed',
                item: { id: 'message-1', type: 'agent_message', text: JSON.stringify(output) }
              };
              yield { type: 'turn.completed', usage: null };
            })()
          };
        }
      };
    }
  }
  return { Codex };
}

test('Codex SDK adapter fixes read-only sandbox and emits bounded streaming events', async () => {
  const observations = {};
  const events = [];
  const metrics = [];
  let tick = 0;
  const adapter = createCodexSDKAIProviderAdapter({
    workingDirectory: '/workspace/fixture',
    sdkLoader: async () => fakeSDK(undefined, observations),
    onPresentationEvent: (event) => events.push(event),
    onMetric: (metric) => metrics.push(metric),
    monotonicNow: () => (tick += 5)
  });
  const output = await adapter.invoke(cognitiveRequest());
  assert.deepEqual(output, { response: 'Bounded cognitive answer.' });
  assert.equal(observations.started.sandboxMode, 'read-only');
  assert.equal(observations.started.approvalPolicy, 'never');
  assert.equal(observations.started.networkAccessEnabled, false);
  assert.equal(observations.prompt.capability, 'EXPLAIN');
  assert.deepEqual(events.map((event) => event.type), [
    'THREAD_STARTED', 'TURN_STARTED', 'CONTENT_COMPLETED', 'TURN_COMPLETED'
  ]);
  assert.equal(metrics[0].setupOverheadMs, 5);
  assert.equal(metrics[0].operationalAuthority, false);
  assert.equal(adapter.currentThreadId(), 'thread-physical-1');
  assert.equal(adapter.mutationAuthority, false);
});

test('Codex SDK adapter resumes the exact prior thread', async () => {
  const observations = {};
  const adapter = createCodexSDKAIProviderAdapter({
    workingDirectory: '/workspace/fixture',
    threadId: 'thread-prior-1',
    sdkLoader: async () => fakeSDK(undefined, observations)
  });
  await adapter.invoke(cognitiveRequest());
  assert.equal(observations.resumed.id, 'thread-prior-1');
  assert.equal(observations.resumed.options.workingDirectory, '/workspace/fixture');
  assert.equal(observations.started, undefined);
});

test('Codex SDK adapter rejects authority-bearing and incomplete output', async () => {
  const unsafe = createCodexSDKAIProviderAdapter({
    workingDirectory: '/workspace/fixture',
    sdkLoader: async () => fakeSDK({ command: 'rm -rf .' })
  });
  await assert.rejects(() => unsafe.invoke(cognitiveRequest()), /forbidden authority field/i);

  class IncompleteCodex {
    startThread() {
      return {
        async runStreamed() {
          return { events: (async function* () {
            yield { type: 'turn.started' };
          })() };
        }
      };
    }
  }
  const incomplete = createCodexSDKAIProviderAdapter({
    workingDirectory: '/workspace/fixture',
    sdkLoader: async () => ({ Codex: IncompleteCodex })
  });
  await assert.rejects(() => incomplete.invoke(cognitiveRequest()), /without canonical completion/i);
});

test('NATURAL runtime invokes Codex through the existing cognitive boundary', async () => {
  const composition = createNaturalCodexComposition({
    workingDirectory: '/workspace/fixture',
    sdkLoader: async () => fakeSDK({ summary: 'Continue inside the mission envelope.' })
  });
  const result = await invokeNaturalCognitive(composition, {
    requestId: 'codex-runtime-1',
    capability: 'EXPLAIN',
    objective: 'Explain the next step.',
    context: { mission: 'bounded' }
  });
  assert.equal(composition.schema, 'sdo.natural_codex_ai_composition.v1');
  assert.equal(result.status, 'COMPLETED');
  assert.deepEqual(result.output, { summary: 'Continue inside the mission envelope.' });
  assert.equal(composition.operationalAuthority, false);
});

test('NATURAL session selects Codex with one configuration and preserves the same thread', async () => {
  const session = createNaturalCognitiveSession({
    codex: {
      enabled: true,
      workingDirectory: '/workspace/fixture',
      sdkLoader: async () => fakeSDK({ response: 'Resposta cognitiva governada.' })
    }
  });
  const discovery = await session.describe();
  assert.equal(discovery.providerId, CODEX_SDK_PROVIDER_ID);
  assert.equal(discovery.active, true);
  const response = await session.ask(
    'Explique o próximo passo.',
    { workspace: 'fixture', interactionMode: { mode: 'NATURAL' } }
  );
  assert.equal(response, 'Resposta cognitiva governada.\n');
  assert.equal(discovery.operationalAuthority, false);
});

test('canonical CLI exposes a single explicit Codex selector', () => {
  const source = fs.readFileSync(
    require.resolve('../../accelerator/cli/surgical'),
    'utf8'
  );
  assert.match(source, /--codex\s+Use Codex SDK cognition/);
  assert.match(source, /codex:\s*options\.codex === true/);
  assert.doesNotMatch(source, /CODEX_API_KEY|OPENAI_API_KEY/);
});

test('Codex SDK adapter source exposes no direct filesystem or publication authority', () => {
  const source = fs.readFileSync(
    require.resolve('../../accelerator/adapters/codex-sdk-ai-provider-adapter'),
    'utf8'
  );
  assert.doesNotMatch(source, /child_process|execSync|spawn\(|writeFileSync|git push|npm publish/);
  assert.match(source, /sandboxMode:\s*'read-only'/);
  assert.match(source, /approvalPolicy:\s*'never'/);
});
