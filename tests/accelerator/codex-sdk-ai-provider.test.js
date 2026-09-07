'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  CODEX_COGNITIVE_CANCELLED,
  CODEX_COGNITIVE_DEADLINE_MS,
  CODEX_COGNITIVE_TIMEOUT,
  CODEX_SDK_PROVIDER_ID,
  createCodexEnvironment,
  createCodexSDKAIProviderAdapter: createPhysicalCodexSDKAIProviderAdapter
} = require('../../accelerator/adapters/codex-sdk-ai-provider-adapter');
const {
  createNaturalCodexComposition: createPhysicalNaturalCodexComposition,
  invokeNaturalCognitive
} = require('../../accelerator/cli/natural-ai-runtime');
const {
  createNaturalCognitiveSession
} = require('../../accelerator/cli/natural-cognitive-session');
const {
  createCodexCredentialProvider
} = require('../../accelerator/cli/surgical');

function cognitiveRequest() {
  return Object.freeze({
    schema: 'sdo.ai_cognitive_request.v1',
    providerId: CODEX_SDK_PROVIDER_ID,
    capability: 'EXPLAIN',
    objective: 'Explain the bounded next step.',
    context: Object.freeze({ workspace: 'fixture' })
  });
}

const credentialProvider = async () => 'test-only-credential';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function manualDeadlineScheduler() {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  const observations = { scheduledDelays: [], clearCalls: 0 };
  return {
    observations,
    monotonicNow: () => now,
    setNow: (value) => { now = value; },
    scheduleTimeout(callback, delay) {
      const timer = { id: ++nextId, callback, dueAt: now + delay };
      timers.set(timer.id, timer);
      observations.scheduledDelays.push(delay);
      return timer;
    },
    clearScheduledTimeout(timer) {
      observations.clearCalls += 1;
      if (timer) timers.delete(timer.id);
    },
    expireNext() {
      const timer = timers.values().next().value;
      assert.ok(timer, 'one deadline timer must be pending');
      now = timer.dueAt;
      timers.delete(timer.id);
      timer.callback();
    },
    pendingCount: () => timers.size
  };
}

function deadlineOptions(scheduler) {
  return {
    monotonicNow: scheduler.monotonicNow,
    scheduleTimeout: scheduler.scheduleTimeout,
    clearScheduledTimeout: scheduler.clearScheduledTimeout
  };
}

function blockingIterator(initialEvents = [], observations = {}, returnImplementation = null) {
  const blocked = deferred();
  const waiting = deferred();
  let index = 0;
  return {
    iterator: {
      next() {
        observations.nextCalls = (observations.nextCalls || 0) + 1;
        if (index < initialEvents.length) {
          return Promise.resolve({ done: false, value: initialEvents[index++] });
        }
        waiting.resolve();
        return blocked.promise;
      },
      return() {
        observations.returnCalls = (observations.returnCalls || 0) + 1;
        return returnImplementation
          ? returnImplementation()
          : Promise.resolve({ done: true });
      },
      [Symbol.asyncIterator]() { return this; }
    },
    waiting: waiting.promise,
    release: blocked.resolve,
    reject: blocked.reject
  };
}

function sdkWithRunStreamed(runStreamed) {
  return {
    Codex: class {
      startThread() { return { runStreamed }; }
      resumeThread() { return { runStreamed }; }
    }
  };
}

function fakeContainment(observations = {}, controls = {
  originalWorkspaceDenied: true,
  networkDenied: true
}) {
  let disposed = false;
  return Object.freeze({
    schema: 'sdo.codex_cognitive_containment.v1',
    state: 'ENFORCED',
    platform: 'linux',
    launcherPath: '/isolated/control/codex-contained-launcher',
    sdkWorkingDirectory: '/cognitive/workspace',
    attestation: Object.freeze({
      schema: 'sdo.codex_cognitive_containment_attestation.v1',
      decision: 'ENFORCED',
      controls: Object.freeze({ ...controls })
    }),
    dispose() {
      if (disposed) return;
      observations.disposeCalls = (observations.disposeCalls || 0) + 1;
      disposed = true;
    },
    isDisposed: () => disposed
  });
}

function fakeContainmentFactory() {
  return fakeContainment();
}

function fakeServiceQualifiedContainmentFactory() {
  return fakeContainment({}, {
    originalWorkspaceDenied: true,
    networkDenied: false,
    cognitiveServiceNetworkQualified: true
  });
}

function createCodexSDKAIProviderAdapter(input) {
  return createPhysicalCodexSDKAIProviderAdapter({
    ...input,
    containmentFactory: input.containmentFactory || fakeContainmentFactory
  });
}

function createNaturalCodexComposition(input) {
  return createPhysicalNaturalCodexComposition({
    ...input,
    containmentFactory: input.containmentFactory || fakeContainmentFactory
  });
}

function fakeSDK(output = { response: 'Bounded cognitive answer.' }, observations = {}) {
  class Codex {
    constructor(options) {
      observations.codexOptions = options;
    }
    startThread(options) {
      observations.started = options;
      observations.startCalls = (observations.startCalls || 0) + 1;
      return this.thread();
    }
    resumeThread(id, options) {
      observations.resumed = { id, options };
      observations.resumeCalls = (observations.resumeCalls || 0) + 1;
      return this.thread();
    }
    thread() {
      return {
        async runStreamed(prompt, options) {
          observations.runStreamedCalls =
            (observations.runStreamedCalls || 0) + 1;
          observations.prompt = JSON.parse(prompt);
          observations.turnOptions = options;
          return {
            events: (async function* () {
              yield { type: 'thread.started', thread_id: 'thread-session-1' };
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
    credentialProvider,
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
  assert.equal(observations.started.workingDirectory, '/cognitive/workspace');
  assert.equal(observations.started.skipGitRepoCheck, true);
  assert.equal(observations.turnOptions.signal instanceof AbortSignal, true);
  assert.equal(
    observations.codexOptions.codexPathOverride,
    '/isolated/control/codex-contained-launcher'
  );
  assert.equal(JSON.stringify(observations).includes('/workspace/fixture'), false);
  assert.equal(observations.prompt.capability, 'EXPLAIN');
  assert.deepEqual(events.map((event) => event.type), [
    'THREAD_STARTED', 'TURN_STARTED', 'CONTENT_COMPLETED', 'TURN_COMPLETED'
  ]);
  assert.equal(metrics[0].setupOverheadMs, 30);
  assert.equal(metrics[0].operationalAuthority, false);
  assert.equal(adapter.currentThreadId(), 'thread-session-1');
  assert.equal(adapter.mutationAuthority, false);
  assert.equal(adapter.providerKind, 'CODEX');
  assert.equal(adapter.cognitionLocation, 'EXTERNAL_SERVICE');
  assert.equal(adapter.transportLocation, 'LOCAL_PROCESS');
  assert.equal(adapter.billing, 'UNKNOWN_OR_ACCOUNT_PLAN');
  assert.equal(adapter.networkRequirement, 'EXTERNAL_SERVICE_REQUIRED');
});

test('Codex SDK adapter resumes the exact prior thread', async () => {
  const observations = {};
  const adapter = createCodexSDKAIProviderAdapter({
    workingDirectory: '/workspace/fixture',
    credentialProvider,
    threadId: 'thread-prior-1',
    sdkLoader: async () => fakeSDK(undefined, observations)
  });
  await adapter.invoke(cognitiveRequest());
  assert.equal(observations.resumed.id, 'thread-prior-1');
  assert.equal(observations.resumed.options.workingDirectory, '/cognitive/workspace');
  assert.equal(observations.started, undefined);
});

test('Codex SDK adapter reuses one logical instance and resumes the thread for two streamed turns', async () => {
  let constructions = 0;
  const observations = {};
  const sdk = fakeSDK(undefined, observations);
  const OriginalCodex = sdk.Codex;
  sdk.Codex = class extends OriginalCodex {
    constructor(...args) {
      super(...args);
      constructions += 1;
    }
  };
  const adapter = createCodexSDKAIProviderAdapter({
    workingDirectory: '/workspace/fixture',
    credentialProvider,
    sdkLoader: async () => sdk
  });

  await adapter.invoke(cognitiveRequest());
  await adapter.invoke(cognitiveRequest());

  assert.equal(constructions, 1);
  assert.equal(observations.startCalls, 1);
  assert.equal(observations.resumeCalls, 1);
  assert.equal(observations.resumed.id, 'thread-session-1');
  assert.equal(observations.runStreamedCalls, 2);
  assert.equal(adapter.currentThreadId(), 'thread-session-1');
  assert.deepEqual(adapter.continuity, {
    sdkInstance: 'REUSED_WITHIN_ADAPTER_SESSION',
    thread: 'RESUMED_BY_ID',
    processPersistence: 'DEFERRED'
  });
  assert.equal(Object.hasOwn(adapter.continuity, 'pid'), false);
});

test(
  'installed Codex SDK launches the local wrapper once for each runStreamed turn',
  { skip: process.platform === 'win32' },
  async (t) => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-codex-sdk-spawn-'));
    t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
    const invocationLog = path.join(fixture, 'invocations.jsonl');
    const wrapper = path.join(fixture, 'codex-wrapper.js');
    fs.writeFileSync(
      wrapper,
      [
        '#!/usr/bin/env node',
        "'use strict';",
        "const fs = require('node:fs');",
        "process.stdin.resume();",
        "process.stdin.on('end', () => {",
        "  fs.appendFileSync(process.env.SDO_CODEX_WRAPPER_LOG, JSON.stringify({ args: process.argv.slice(2) }) + '\\n');",
        "  process.stdout.write(JSON.stringify({ type: 'thread.started', thread_id: 'thread-wrapper-1' }) + '\\n');",
        "  process.stdout.write(JSON.stringify({ type: 'turn.started' }) + '\\n');",
        "  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { id: 'message-1', type: 'agent_message', text: '{}' } }) + '\\n');",
        "  process.stdout.write(JSON.stringify({ type: 'turn.completed', usage: {} }) + '\\n');",
        '});',
        ''
      ].join('\n')
    );
    fs.chmodSync(wrapper, 0o700);

    const { Codex } = await import('@openai/codex-sdk');
    const codex = new Codex({
      codexPathOverride: wrapper,
      env: {
        PATH: process.env.PATH || '/usr/bin:/bin',
        SDO_CODEX_WRAPPER_LOG: invocationLog
      }
    });
    const thread = codex.startThread({
      workingDirectory: fixture,
      sandboxMode: 'read-only',
      approvalPolicy: 'never',
      networkAccessEnabled: false,
      skipGitRepoCheck: true
    });

    for (let turn = 0; turn < 2; turn += 1) {
      const streamed = await thread.runStreamed('turn-' + (turn + 1));
      for await (const _event of streamed.events) {
        /* Consume the installed SDK stream without invoking the real Codex binary. */
      }
    }

    const invocations = fs.readFileSync(invocationLog, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(invocations.length, 2);
    assert.equal(invocations[0].args.includes('resume'), false);
    const resumeIndex = invocations[1].args.indexOf('resume');
    assert.notEqual(resumeIndex, -1);
    assert.equal(invocations[1].args[resumeIndex + 1], 'thread-wrapper-1');
  }
);

test('Codex SDK adapter rejects authority-bearing and incomplete output', async () => {
  const unsafe = createCodexSDKAIProviderAdapter({
    workingDirectory: '/workspace/fixture',
    credentialProvider,
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
    credentialProvider,
    sdkLoader: async () => ({ Codex: IncompleteCodex })
  });
  await assert.rejects(() => incomplete.invoke(cognitiveRequest()), /without canonical completion/i);
});

test('NATURAL runtime invokes Codex through the existing cognitive boundary', async () => {
  const composition = createNaturalCodexComposition({
    workingDirectory: '/workspace/fixture',
    credentialProvider,
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
  assert.equal(composition.cognitionLocation, 'EXTERNAL_SERVICE');
  assert.equal(composition.networkCompatibility, 'BLOCKED_BY_CONTAINMENT_NETWORK');
});

test('NATURAL session records Codex as blocked when containment denies service network', async () => {
  const observations = {};
  const session = createNaturalCognitiveSession({
    fetchImplementation: async () => {
      observations.ollamaDiscoveryCalls =
        (observations.ollamaDiscoveryCalls || 0) + 1;
      throw new Error('explicit Codex must never fall back to Ollama');
    },
    codex: {
      enabled: true,
      workingDirectory: '/workspace/fixture',
      credentialProvider,
      containmentFactory: fakeContainmentFactory,
      sdkLoader: async () => {
        observations.loads = (observations.loads || 0) + 1;
        return fakeSDK({ response: 'must-not-run' });
      }
    }
  });
  const discovery = await session.describe();
  assert.equal(discovery.providerId, CODEX_SDK_PROVIDER_ID);
  assert.equal(discovery.active, false);
  assert.equal(discovery.available, false);
  assert.equal(discovery.state, 'BLOCKED');
  assert.equal(discovery.providerKind, 'CODEX');
  assert.equal(discovery.cognitionLocation, 'EXTERNAL_SERVICE');
  assert.equal(discovery.transportLocation, 'LOCAL_PROCESS');
  assert.equal(discovery.billing, 'UNKNOWN_OR_ACCOUNT_PLAN');
  assert.equal(discovery.networkRequirement, 'EXTERNAL_SERVICE_REQUIRED');
  assert.equal(discovery.networkCompatibility, 'BLOCKED_BY_CONTAINMENT_NETWORK');
  assert.equal(discovery.selectionMode, 'EXPLICIT_EXTERNAL');
  assert.match(discovery.reason, /external cognitive service.*network/i);
  const response = await session.ask(
    'Explique o próximo passo.',
    { workspace: 'fixture', interactionMode: { mode: 'NATURAL' } }
  );
  assert.match(response, /serviço cognitivo externo Codex/i);
  assert.doesNotMatch(response, /Ollama|provider cognitivo local/i);
  assert.equal(observations.loads, undefined);
  assert.equal(observations.ollamaDiscoveryCalls, undefined);
  assert.equal(discovery.operationalAuthority, false);
});

test('canonical CLI exposes a single explicit Codex selector', () => {
  const source = fs.readFileSync(
    require.resolve('../../accelerator/cli/surgical'),
    'utf8'
  );
  assert.match(source, /--codex\s+Use Codex SDK cognition/);
  assert.match(source, /codex:\s*options\.codex === true/);
  assert.match(source, /OPENAI_API_KEY/);
  const packageDefinition = require('../../package.json');
  assert.equal(
    packageDefinition.scripts['start:codex'],
    'node accelerator/cli/surgical.js --interaction NATURAL --codex'
  );
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

test('Codex SDK receives only the platform allowlist and no inherited marker', async () => {
  const observations = {};
  process.env.SDO_CODEX_SECRET_MARKER = 'must-not-cross-boundary';
  try {
    const adapter = createCodexSDKAIProviderAdapter({
      workingDirectory: '/workspace/fixture', credentialProvider,
      sdkLoader: async () => fakeSDK(undefined, observations)
    });
    await adapter.invoke(cognitiveRequest());
    assert.deepEqual(Object.keys(observations.codexOptions.env).sort(), ['HOME', 'LANG', 'PATH', 'TMPDIR']);
    assert.equal(observations.codexOptions.env.SDO_CODEX_SECRET_MARKER, undefined);
  } finally {
    delete process.env.SDO_CODEX_SECRET_MARKER;
  }
});

test('Codex environment allowlists are explicit per platform', () => {
  assert.deepEqual(Object.keys(createCodexEnvironment('linux')).sort(), ['HOME', 'LANG', 'PATH', 'TMPDIR']);
  assert.deepEqual(Object.keys(createCodexEnvironment('darwin')).sort(), ['HOME', 'LANG', 'PATH', 'TMPDIR']);
  assert.deepEqual(Object.keys(createCodexEnvironment('win32')).sort(), ['HOME', 'Path', 'SystemRoot', 'TEMP', 'TMP']);
});

test('missing or malformed Codex credential blocks before SDK execution without leaking it', async () => {
  let loaded = false;
  const adapter = createCodexSDKAIProviderAdapter({
    workingDirectory: '/workspace/fixture',
    credentialProvider: async () => 'bad\nsecret-marker',
    sdkLoader: async () => { loaded = true; return fakeSDK(); }
  });
  await assert.rejects(() => adapter.invoke(cognitiveRequest()), /unavailable or malformed/i);
  assert.equal(loaded, false);
});

test('SDK failures remain sanitized', async () => {
  const marker = 'secret-marker-not-in-error';
  const containmentObservations = {};
  const adapter = createCodexSDKAIProviderAdapter({
    workingDirectory: '/workspace/fixture', credentialProvider,
    containmentFactory: () => fakeContainment(containmentObservations),
    sdkLoader: async () => { throw new Error(marker); }
  });
  await assert.rejects(
    () => adapter.invoke(cognitiveRequest()),
    (error) => error.message === 'Codex SDK is unavailable.' && !error.message.includes(marker)
  );
  assert.equal(containmentObservations.disposeCalls, 1);
  await assert.rejects(() => adapter.invoke(cognitiveRequest()), /containment session is closed/i);
});

test('successful containment cleanup is explicit idempotent and closes further cognition', async () => {
  const observations = {};
  const adapter = createCodexSDKAIProviderAdapter({
    credentialProvider,
    containmentFactory: () => fakeContainment(observations),
    sdkLoader: async () => fakeSDK()
  });
  await adapter.invoke(cognitiveRequest());
  assert.equal(observations.disposeCalls, undefined);
  adapter.dispose();
  adapter.dispose();
  assert.equal(observations.disposeCalls, 1);
  await assert.rejects(() => adapter.invoke(cognitiveRequest()), /containment session is closed/i);
});

test('containment cleanup failure overrides provider failure and remains fail-closed', async () => {
  const containment = fakeContainment();
  const brokenContainment = Object.freeze({
    ...containment,
    dispose() {
      throw new Error('host path must not escape');
    }
  });
  const adapter = createCodexSDKAIProviderAdapter({
    credentialProvider,
    containmentFactory: () => brokenContainment,
    sdkLoader: async () => { throw new Error('provider detail must not escape'); }
  });
  await assert.rejects(
    () => adapter.invoke(cognitiveRequest()),
    (error) => error.code === 'CODEX_CONTAINMENT_CLEANUP_FAILED' &&
      !error.message.includes('host path') && !error.message.includes('provider detail')
  );
});

test('disposing an active turn aborts the SDK child before containment cleanup', async () => {
  const lifecycle = {};
  let observedSignal = null;
  class BlockingCodex {
    startThread() {
      return {
        async runStreamed(_prompt, options) {
          observedSignal = options.signal;
          return {
            events: (async function* () {
              yield { type: 'thread.started', thread_id: 'thread-blocked-1' };
              await new Promise((resolve) => {
                if (options.signal.aborted) resolve();
                else options.signal.addEventListener('abort', resolve, { once: true });
              });
              throw new Error('child abort detail must not escape');
            })()
          };
        }
      };
    }
  }
  const adapter = createCodexSDKAIProviderAdapter({
    credentialProvider,
    containmentFactory: () => fakeContainment(lifecycle),
    sdkLoader: async () => ({ Codex: BlockingCodex })
  });
  const invocation = adapter.invoke(cognitiveRequest());
  await new Promise((resolve) => setImmediate(resolve));
  adapter.dispose();
  await assert.rejects(
    () => invocation,
    (error) => error.code === CODEX_COGNITIVE_CANCELLED
  );
  assert.equal(observedSignal.aborted, true);
  assert.equal(lifecycle.disposeCalls, 1);
});

test('Codex session reset and close dispose each contained logical session', async () => {
  const lifecycle = {};
  const session = createNaturalCognitiveSession({
    codex: {
      enabled: true,
      credentialProvider,
      containmentFactory: () => fakeContainment(lifecycle, {
        originalWorkspaceDenied: true,
        networkDenied: false,
        cognitiveServiceNetworkQualified: true
      }),
      sdkLoader: async () => fakeSDK()
    }
  });
  assert.equal((await session.describe()).active, true);
  session.resetConversation();
  assert.equal(lifecycle.disposeCalls, 1);
  assert.equal((await session.describe()).active, true);
  session.close();
  session.close();
  assert.equal(lifecycle.disposeCalls, 2);
  await assert.rejects(
    () => session.ask('Explique.', { workspace: 'fixture', interactionMode: { mode: 'NATURAL' } }),
    /session is closed/i
  );
});

test('containment unavailability is explicit and never falls back to workspace read-only', async () => {
  const unavailable = new Error('native mechanism absent');
  unavailable.code = 'CODEX_CONTAINMENT_UNAVAILABLE';
  const session = createNaturalCognitiveSession({
    codex: {
      enabled: true,
      credentialProvider,
      containmentFactory: () => { throw unavailable; },
      sdkLoader: async () => { throw new Error('must not load'); }
    }
  });
  const discovery = await session.describe();
  assert.equal(discovery.state, 'CODEX_CONTAINMENT_UNAVAILABLE');
  assert.equal(discovery.available, false);
  assert.match(discovery.reason, /containment is unavailable/i);
});

test('Codex receives authorized evidence only after deterministic sanitization', async () => {
  const observations = {};
  const session = createNaturalCognitiveSession({
    codex: {
      enabled: true,
      credentialProvider,
      containmentFactory: fakeServiceQualifiedContainmentFactory,
      sdkLoader: async () => fakeSDK({ response: 'Evidência sanitizada recebida.' }, observations)
    }
  });
  const secret = 'SDO_AUD_006_RAW_SECRET';
  const response = await session.ask(
    'Explique a evidência.',
    { workspace: '/host/original/fixture', interactionMode: { mode: 'NATURAL' } },
    `API_KEY=${secret}`
  );
  assert.equal(response, 'Evidência sanitizada recebida.\n');
  assert.match(
    observations.prompt.objective,
    /\[REDACTED_BY_SURGICAL_DEVOPS:ASSIGNMENT_SECRET\]/
  );
  assert.equal(JSON.stringify(observations.prompt).includes(secret), false);
  assert.equal(JSON.stringify(observations.prompt).includes('/host/original'), false);
  assert.equal(observations.prompt.context.workspace, 'fixture');
});

test('CLI Codex credential boundary reaches the full composition only as apiKey', async () => {
  const observations = {};
  const marker = 'cli-boundary-secret';
  const environment = {
    OPENAI_API_KEY: marker,
    SDO_UNRELATED_SECRET: 'must-not-cross'
  };
  const session = createNaturalCognitiveSession({
    codex: {
      enabled: true,
      workingDirectory: '/workspace/fixture',
      credentialProvider: createCodexCredentialProvider(environment),
      containmentFactory: fakeServiceQualifiedContainmentFactory,
      sdkLoader: async () => fakeSDK({ answer: 'bounded' }, observations)
    }
  });
  assert.equal((await session.describe()).active, true);
  const response = await session.ask('Explique.', { workspace: 'fixture', interactionMode: { mode: 'NATURAL' } });
  assert.equal(response, 'bounded\n');
  assert.equal(observations.codexOptions.apiKey, marker);
  assert.deepEqual(Object.keys(observations.codexOptions.env).sort(), ['HOME', 'LANG', 'PATH', 'TMPDIR']);
  assert.equal(JSON.stringify(response).includes(marker), false);
  assert.equal(JSON.stringify(observations.started).includes(marker), false);
});

test('Codex canonical deadline covers SDK loading without waiting in real time', async () => {
  const scheduler = manualDeadlineScheduler();
  const loaderStarted = deferred();
  const neverLoaded = deferred();
  const lifecycle = {};
  const adapter = createCodexSDKAIProviderAdapter({
    credentialProvider,
    containmentFactory: () => fakeContainment(lifecycle),
    sdkLoader: async () => {
      loaderStarted.resolve();
      return neverLoaded.promise;
    },
    ...deadlineOptions(scheduler)
  });
  const invocation = adapter.invoke(cognitiveRequest());
  await loaderStarted.promise;

  assert.deepEqual(scheduler.observations.scheduledDelays, [CODEX_COGNITIVE_DEADLINE_MS]);
  assert.equal(CODEX_COGNITIVE_DEADLINE_MS, 180000);
  scheduler.expireNext();

  await assert.rejects(invocation, (error) => error.code === CODEX_COGNITIVE_TIMEOUT);
  assert.equal(lifecycle.disposeCalls, 1);
  assert.equal(scheduler.observations.clearCalls, 1);
  assert.equal(scheduler.pendingCount(), 0);
});

test('runStreamed that never resolves times out and physically aborts once', async () => {
  const scheduler = manualDeadlineScheduler();
  const runStarted = deferred();
  const neverStreamed = deferred();
  const lifecycle = {};
  const observations = { abortEvents: 0 };
  const adapter = createCodexSDKAIProviderAdapter({
    credentialProvider,
    containmentFactory: () => fakeContainment(lifecycle),
    sdkLoader: async () => sdkWithRunStreamed(async (_prompt, options) => {
      observations.signal = options.signal;
      options.signal.addEventListener('abort', () => { observations.abortEvents += 1; });
      runStarted.resolve();
      return neverStreamed.promise;
    }),
    ...deadlineOptions(scheduler)
  });
  const invocation = adapter.invoke(cognitiveRequest());
  await runStarted.promise;
  scheduler.expireNext();

  await assert.rejects(invocation, (error) => error.code === CODEX_COGNITIVE_TIMEOUT);
  adapter.dispose();
  assert.equal(observations.signal.aborted, true);
  assert.equal(observations.abortEvents, 1);
  assert.equal(lifecycle.disposeCalls, 1);
  assert.equal(scheduler.observations.clearCalls, 1);
  assert.equal(scheduler.pendingCount(), 0);
});

test('stream that never finishes times out and closes its iterator once', async () => {
  const scheduler = manualDeadlineScheduler();
  const lifecycle = {};
  const observations = { abortEvents: 0 };
  const controlled = blockingIterator([], observations);
  const adapter = createCodexSDKAIProviderAdapter({
    credentialProvider,
    containmentFactory: () => fakeContainment(lifecycle),
    sdkLoader: async () => sdkWithRunStreamed(async (_prompt, options) => {
      options.signal.addEventListener('abort', () => { observations.abortEvents += 1; });
      return { events: controlled.iterator };
    }),
    ...deadlineOptions(scheduler)
  });
  const invocation = adapter.invoke(cognitiveRequest());
  await controlled.waiting;
  scheduler.expireNext();

  await assert.rejects(invocation, (error) => error.code === CODEX_COGNITIVE_TIMEOUT);
  assert.equal(observations.returnCalls, 1);
  assert.equal(observations.abortEvents, 1);
  assert.equal(lifecycle.disposeCalls, 1);
  assert.equal(scheduler.pendingCount(), 0);
});

test('partial stream timeout never promotes its unqualified thread ID', async () => {
  const scheduler = manualDeadlineScheduler();
  const observations = {};
  const controlled = blockingIterator([
    { type: 'thread.started', thread_id: 'thread-incomplete' },
    { type: 'turn.started' },
    {
      type: 'item.completed',
      item: { id: 'partial', type: 'agent_message', text: '{"response":"partial"}' }
    }
  ], observations);
  const adapter = createCodexSDKAIProviderAdapter({
    threadId: 'thread-qualified-prior',
    credentialProvider,
    sdkLoader: async () => sdkWithRunStreamed(async () => ({ events: controlled.iterator })),
    ...deadlineOptions(scheduler)
  });
  const invocation = adapter.invoke(cognitiveRequest());
  await controlled.waiting;
  scheduler.expireNext();

  await assert.rejects(invocation, (error) => error.code === CODEX_COGNITIVE_TIMEOUT);
  assert.equal(adapter.currentThreadId(), 'thread-qualified-prior');
  assert.equal(observations.returnCalls, 1);
});

test('qualified completion before the deadline succeeds and removes its timer', async () => {
  const scheduler = manualDeadlineScheduler();
  const adapter = createCodexSDKAIProviderAdapter({
    credentialProvider,
    sdkLoader: async () => fakeSDK({ response: 'before-limit' }),
    ...deadlineOptions(scheduler)
  });

  const output = await adapter.invoke(cognitiveRequest());

  assert.deepEqual(output, { response: 'before-limit' });
  assert.equal(adapter.currentThreadId(), 'thread-session-1');
  assert.equal(scheduler.observations.clearCalls, 1);
  assert.equal(scheduler.pendingCount(), 0);
  adapter.dispose();
});

test('completion at the exact deadline is a timeout', async () => {
  const scheduler = manualDeadlineScheduler();
  const observations = {};
  const events = [
    { type: 'thread.started', thread_id: 'thread-at-limit' },
    {
      type: 'item.completed',
      item: { id: 'answer', type: 'agent_message', text: '{"response":"too-late"}' }
    },
    { type: 'turn.completed', usage: null }
  ];
  const iterator = {
    async next() {
      if (events.length > 0) return { done: false, value: events.shift() };
      scheduler.setNow(CODEX_COGNITIVE_DEADLINE_MS);
      return { done: true };
    },
    async return() {
      observations.returnCalls = (observations.returnCalls || 0) + 1;
      return { done: true };
    },
    [Symbol.asyncIterator]() { return this; }
  };
  const adapter = createCodexSDKAIProviderAdapter({
    threadId: 'thread-qualified-prior',
    credentialProvider,
    sdkLoader: async () => sdkWithRunStreamed(async () => ({ events: iterator })),
    ...deadlineOptions(scheduler)
  });

  await assert.rejects(
    adapter.invoke(cognitiveRequest()),
    (error) => error.code === CODEX_COGNITIVE_TIMEOUT
  );
  assert.equal(adapter.currentThreadId(), 'thread-qualified-prior');
  assert.equal(observations.returnCalls, 1);
  assert.equal(scheduler.pendingCount(), 0);
});

test('late iterator settlement after abort cannot become success or leak a rejection', async () => {
  const scheduler = manualDeadlineScheduler();
  const observations = {};
  const projected = [];
  const controlled = blockingIterator([
    { type: 'thread.started', thread_id: 'thread-late' },
    {
      type: 'item.completed',
      item: { id: 'answer', type: 'agent_message', text: '{"response":"late"}' }
    },
    { type: 'turn.completed', usage: null }
  ], observations, () => Promise.reject(new Error('late return detail')));
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    const adapter = createCodexSDKAIProviderAdapter({
      threadId: 'thread-qualified-prior',
      credentialProvider,
      onPresentationEvent: (event) => projected.push(event),
      sdkLoader: async () => sdkWithRunStreamed(async () => ({ events: controlled.iterator })),
      ...deadlineOptions(scheduler)
    });
    const invocation = adapter.invoke(cognitiveRequest());
    await controlled.waiting;
    scheduler.expireNext();
    await assert.rejects(invocation, (error) => error.code === CODEX_COGNITIVE_TIMEOUT);

    const projectedBeforeLateSettlement = projected.length;
    controlled.release({ done: true });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(projected.length, projectedBeforeLateSettlement);
    assert.equal(adapter.currentThreadId(), 'thread-qualified-prior');
    assert.equal(observations.returnCalls, 1);
    assert.deepEqual(unhandled, []);
  } finally {
    process.removeListener('unhandledRejection', onUnhandled);
  }
});

test('explicit adapter disposal cancels an active turn distinctly from timeout', async () => {
  const scheduler = manualDeadlineScheduler();
  const lifecycle = {};
  const observations = { abortEvents: 0 };
  const controlled = blockingIterator([], observations);
  const adapter = createCodexSDKAIProviderAdapter({
    credentialProvider,
    containmentFactory: () => fakeContainment(lifecycle),
    sdkLoader: async () => sdkWithRunStreamed(async (_prompt, options) => {
      options.signal.addEventListener('abort', () => { observations.abortEvents += 1; });
      return { events: controlled.iterator };
    }),
    ...deadlineOptions(scheduler)
  });
  const invocation = adapter.invoke(cognitiveRequest());
  await controlled.waiting;
  adapter.dispose();
  adapter.dispose();

  await assert.rejects(invocation, (error) =>
    error.code === CODEX_COGNITIVE_CANCELLED && error.code !== CODEX_COGNITIVE_TIMEOUT
  );
  assert.equal(observations.abortEvents, 1);
  assert.equal(observations.returnCalls, 1);
  assert.equal(lifecycle.disposeCalls, 1);
  assert.equal(scheduler.observations.clearCalls, 1);
  assert.equal(scheduler.pendingCount(), 0);
});

test('NATURAL session reset cancels its active Codex turn through the same lifecycle', async () => {
  const scheduler = manualDeadlineScheduler();
  const lifecycle = {};
  const observations = {};
  const controlled = blockingIterator([], observations);
  const session = createNaturalCognitiveSession({
    codex: {
      enabled: true,
      credentialProvider,
      containmentFactory: () => fakeContainment(lifecycle, {
        originalWorkspaceDenied: true,
        networkDenied: false,
        cognitiveServiceNetworkQualified: true
      }),
      sdkLoader: async () => sdkWithRunStreamed(async () => ({ events: controlled.iterator })),
      ...deadlineOptions(scheduler)
    }
  });
  const responsePromise = session.ask(
    'Explique.',
    { workspace: 'fixture', interactionMode: { mode: 'NATURAL' } }
  );
  await controlled.waiting;
  session.resetConversation();
  const response = await responsePromise;

  assert.match(response, /não conseguiu concluir esta resposta/i);
  assert.equal(observations.returnCalls, 1);
  assert.equal(lifecycle.disposeCalls, 1);
  assert.equal(scheduler.observations.clearCalls, 1);
  assert.equal(scheduler.pendingCount(), 0);
  session.close();
});

test('original SDK failure remains sanitized and distinct and clears the timer', async () => {
  const scheduler = manualDeadlineScheduler();
  const lifecycle = {};
  const adapter = createCodexSDKAIProviderAdapter({
    credentialProvider,
    containmentFactory: () => fakeContainment(lifecycle),
    sdkLoader: async () => { throw new Error('raw SDK failure must not escape'); },
    ...deadlineOptions(scheduler)
  });

  await assert.rejects(
    adapter.invoke(cognitiveRequest()),
    (error) => error.message === 'Codex SDK is unavailable.' &&
      error.code !== CODEX_COGNITIVE_TIMEOUT &&
      error.code !== CODEX_COGNITIVE_CANCELLED
  );
  assert.equal(lifecycle.disposeCalls, 1);
  assert.equal(scheduler.observations.clearCalls, 1);
  assert.equal(scheduler.pendingCount(), 0);
});
