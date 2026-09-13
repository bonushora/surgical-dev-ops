'use strict';

const {
  createCodexCognitiveContainment
} = require('./codex-cognitive-containment-adapter');
const {
  NATURAL_LOCAL_INFERENCE_PROFILE
} = require('../cli/natural-local-inference-profile');
const {
  providerLocationMetadata
} = require('../cli/natural-provider-location-contract');

const CODEX_SDK_PROVIDER_ID = 'openai:codex-sdk';
const CODEX_SDK_SCHEMA = 'sdo.codex_sdk_ai_provider_adapter.v1';
const ALLOWED_CAPABILITIES = Object.freeze([
  'INTERPRET', 'REASON', 'PLAN', 'PROPOSE', 'EVALUATE', 'EXPLAIN'
]);
const FORBIDDEN_OUTPUT_KEYS = new Set([
  'approval', 'authorization', 'capabilityGrant', 'command', 'credential',
  'execution', 'grant', 'mutationProvider', 'privateKey', 'shell', 'write'
]);
const MAX_OUTPUT_BYTES = 262144;
const CODEX_COGNITIVE_DEADLINE_MS = NATURAL_LOCAL_INFERENCE_PROFILE.timeoutMs;
const CODEX_COGNITIVE_TIMEOUT = 'CODEX_COGNITIVE_TIMEOUT';
const CODEX_COGNITIVE_CANCELLED = 'CODEX_COGNITIVE_CANCELLED';
const CODEX_LOCATION = providerLocationMetadata('CODEX');
const CODEX_SDK_CONTINUITY = Object.freeze({
  sdkInstance: 'REUSED_WITHIN_ADAPTER_SESSION',
  thread: 'RESUMED_BY_ID',
  processPersistence: 'DEFERRED'
});
const CODEX_ENVIRONMENT = Object.freeze({
  linux: Object.freeze({ PATH: '/runtime', LANG: 'C.UTF-8', HOME: '/cognitive/home', TMPDIR: '/cognitive/tmp' }),
  darwin: Object.freeze({ PATH: '/runtime', LANG: 'C.UTF-8', HOME: '/cognitive/home', TMPDIR: '/cognitive/tmp' }),
  win32: Object.freeze({ Path: 'C:\\cognitive\\runtime', SystemRoot: 'C:\\Windows', TEMP: 'C:\\cognitive\\tmp', TMP: 'C:\\cognitive\\tmp', HOME: 'C:\\cognitive\\home' })
});

function createCodexEnvironment(platform = process.platform) {
  const environment = CODEX_ENVIRONMENT[platform];
  if (!environment) throw new Error('Codex platform environment is not qualified.');
  return Object.freeze({ ...environment });
}

async function readCodexCredential(credentialProvider) {
  let credential;
  try {
    credential = await credentialProvider();
  } catch {
    throw new Error('Codex credential is unavailable or malformed.');
  }
  if (typeof credential !== 'string' || !credential.trim() || credential !== credential.trim() ||
      credential.length > 8192 || credential.includes('\0') || credential.includes('\r') || credential.includes('\n')) {
    throw new Error('Codex credential is unavailable or malformed.');
  }
  return credential;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireText(value, label, maximum = 4096) {
  if (
    typeof value !== 'string' || !value.trim() || value !== value.trim() ||
    value.length > maximum || value.includes('\0')
  ) {
    throw new Error(`${label} is malformed.`);
  }
  return value;
}

function rejectAuthority(value, depth = 0) {
  if (depth > 8) throw new Error('Codex cognitive output nesting bound exceeded.');
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_OUTPUT_KEYS.has(key)) {
      throw new Error(`Codex cognitive output contains forbidden authority field: ${key}.`);
    }
    rejectAuthority(child, depth + 1);
  }
}

function cognitivePrompt(request) {
  return JSON.stringify({
    instruction:
      'Return only one JSON object containing cognitive evidence. Never claim or request operational, mutation, shell, credential, approval, publication, or authorization authority.',
    capability: request.capability,
    objective: request.objective,
    context: request.context
  });
}

function presentationEvent(event) {
  if (!event || typeof event !== 'object') return null;
  if (event.type === 'thread.started') {
    return deepFreeze({ type: 'THREAD_STARTED', threadId: event.thread_id });
  }
  if (event.type === 'turn.started') return deepFreeze({ type: 'TURN_STARTED' });
  if (event.type === 'turn.completed') return deepFreeze({ type: 'TURN_COMPLETED' });
  if (
    event.type === 'item.completed' && event.item &&
    event.item.type === 'agent_message' && typeof event.item.text === 'string'
  ) {
    return deepFreeze({ type: 'CONTENT_COMPLETED', text: event.item.text });
  }
  return null;
}

async function defaultSDKLoader() {
  return import('@openai/codex-sdk');
}

function cognitiveFailure(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  return error;
}

function timeoutFailure() {
  return cognitiveFailure(
    CODEX_COGNITIVE_TIMEOUT,
    'Codex cognitive turn exceeded its canonical deadline.'
  );
}

function cancellationFailure() {
  return cognitiveFailure(
    CODEX_COGNITIVE_CANCELLED,
    'Codex cognitive turn was cancelled.'
  );
}

function cleanupFailure() {
  return cognitiveFailure(
    'CODEX_CONTAINMENT_CLEANUP_FAILED',
    'cognitive containment cleanup failed closed.'
  );
}

function createCodexSDKAIProviderAdapter({
  model,
  threadId = null,
  credentialProvider,
  authenticationMode = 'API_KEY',
  codexAuthPath = null,
  sdkLoader = defaultSDKLoader,
  containmentFactory = createCodexCognitiveContainment,
  onPresentationEvent = null,
  onMetric = null,
  monotonicNow = () => Number(process.hrtime.bigint()) / 1e6,
  scheduleTimeout = setTimeout,
  clearScheduledTimeout = clearTimeout
} = {}) {
  const selectedModel = model === undefined || model === null
    ? null
    : requireText(model, 'Codex model', 128);
  const resumeId = threadId === null ? null : requireText(threadId, 'Codex thread ID', 256);
  if (typeof sdkLoader !== 'function') throw new Error('Codex SDK loader is required.');
  if (typeof containmentFactory !== 'function') {
    throw new Error('Codex cognitive containment factory is required.');
  }
  if (!['API_KEY', 'CODEX_LOGIN'].includes(authenticationMode)) {
    throw new Error('Codex authentication mode is not qualified.');
  }
  if (authenticationMode === 'API_KEY' && typeof credentialProvider !== 'function') {
    throw new Error('Codex credential boundary is required.');
  }
  if (authenticationMode === 'CODEX_LOGIN' && typeof codexAuthPath !== 'string') {
    throw new Error('Existing Codex login boundary is required.');
  }
  if (onPresentationEvent !== null && typeof onPresentationEvent !== 'function') {
    throw new Error('Codex presentation event sink is malformed.');
  }
  if (onMetric !== null && typeof onMetric !== 'function') {
    throw new Error('Codex metric sink is malformed.');
  }
  if (typeof monotonicNow !== 'function') throw new Error('Monotonic clock is required.');
  if (typeof scheduleTimeout !== 'function' || typeof clearScheduledTimeout !== 'function') {
    throw new Error('Codex cognitive deadline scheduler is required.');
  }

  const containment = containmentFactory({ authenticationMode, codexAuthPath });
  if (!containment || containment.schema !== 'sdo.codex_cognitive_containment.v1' ||
      containment.state !== 'ENFORCED' || typeof containment.launcherPath !== 'string' ||
      typeof containment.sdkWorkingDirectory !== 'string' ||
      containment.providerBaseUrl !== 'http://127.0.0.1:43127' ||
      typeof containment.dispose !== 'function' || typeof containment.isDisposed !== 'function' ||
      !containment.attestation || containment.attestation.decision !== 'ENFORCED') {
    const error = new Error(
      'CODEX_CONTAINMENT_UNAVAILABLE: cognitive containment is not qualified.'
    );
    error.code = 'CODEX_CONTAINMENT_UNAVAILABLE';
    throw error;
  }

  let logicalThreadId = resumeId;
  let sdkPromise = null;
  let logicalCodexInstance = null;
  let credentialPromise = null;
  let activeTurn = null;
  let containmentClosed = false;

  function disposeContainment() {
    if (containmentClosed) return;
    containmentClosed = true;
    containment.dispose();
    logicalCodexInstance = null;
    sdkPromise = null;
    credentialPromise = null;
  }

  function dispose() {
    let terminationError = null;
    if (activeTurn) {
      terminationError = activeTurn.terminate('CANCELLED');
    } else {
      try {
        disposeContainment();
      } catch {
        throw cleanupFailure();
      }
    }
    if (terminationError && terminationError.code === 'CODEX_CONTAINMENT_CLEANUP_FAILED') {
      throw terminationError;
    }
  }

  async function invokeContained(request, turn) {
    const { signal } = turn.abortController;
    if (
      !request || request.schema !== 'sdo.ai_cognitive_request.v1' ||
      request.providerId !== CODEX_SDK_PROVIDER_ID ||
      !ALLOWED_CAPABILITIES.includes(request.capability)
    ) {
      throw new Error('Codex SDK cognitive request is malformed or unqualified.');
    }
    turn.assertBeforeDeadline();
    if (authenticationMode === 'API_KEY' && !credentialPromise) {
      credentialPromise = readCodexCredential(credentialProvider);
    }
    const credential = authenticationMode === 'API_KEY' ? await credentialPromise : null;
    turn.assertBeforeDeadline();
    if (!sdkPromise) {
      sdkPromise = Promise.resolve().then(() => sdkLoader()).catch(() => {
        throw new Error('Codex SDK is unavailable.');
      });
    }
    const sdk = await sdkPromise;
    turn.assertBeforeDeadline();
    if (!sdk || typeof sdk.Codex !== 'function') {
      throw new Error('Codex SDK is unavailable.');
    }
    if (!logicalCodexInstance) {
      try {
        logicalCodexInstance = new sdk.Codex({
          codexPathOverride: containment.launcherPath,
          env: createCodexEnvironment(containment.platform),
          baseUrl: containment.providerBaseUrl,
          config: {
            features: {
              apps: false,
              browser_use: false,
              browser_use_external: false,
              code_mode: false,
              code_mode_host: false,
              enable_mcp_apps: false,
              multi_agent: false,
              plugins: false
            },
            web_search: 'disabled'
          },
          ...(credential ? { apiKey: credential } : {})
        });
      } catch {
        throw new Error('Codex SDK initialization failed safely.');
      }
    }
    turn.assertBeforeDeadline();
    const threadOptions = {
      workingDirectory: containment.sdkWorkingDirectory,
      sandboxMode: 'read-only',
      approvalPolicy: 'never',
      networkAccessEnabled: false,
      skipGitRepoCheck: true,
      ...(selectedModel ? { model: selectedModel } : {})
    };
    let turnThread;
    try {
      turnThread = logicalThreadId
        ? logicalCodexInstance.resumeThread(logicalThreadId, threadOptions)
        : logicalCodexInstance.startThread(threadOptions);
    } catch {
      throw new Error('Codex SDK thread initialization failed safely.');
    }
    turn.assertBeforeDeadline();
    const dispatchedAt = monotonicNow();
    let streamed;
    try {
      streamed = await turnThread.runStreamed(cognitivePrompt(request), { signal });
    } catch {
      throw new Error('Codex SDK stream failed safely.');
    }
    if (!streamed || !streamed.events ||
        typeof streamed.events[Symbol.asyncIterator] !== 'function') {
      turn.assertBeforeDeadline();
      throw new Error('Codex SDK event stream is malformed.');
    }
    const iterator = streamed.events[Symbol.asyncIterator]();
    if (!iterator || typeof iterator.next !== 'function') {
      turn.assertBeforeDeadline();
      throw new Error('Codex SDK event stream is malformed.');
    }
    turn.setIterator(iterator);
    turn.assertBeforeDeadline();
    let outputText = null;
    let completed = false;
    let candidateThreadId = logicalThreadId;
    while (true) {
      turn.assertBeforeDeadline();
      const step = await iterator.next();
      turn.assertBeforeDeadline();
      if (!step || typeof step !== 'object') {
        throw new Error('Codex SDK event stream is malformed.');
      }
      if (step.done) break;
      const event = step.value;
      if (event && event.type === 'thread.started') {
        candidateThreadId = requireText(event.thread_id, 'Codex thread ID', 256);
      }
      if (event && event.type === 'turn.failed') throw new Error('Codex SDK turn failed safely.');
      if (event && event.type === 'error') throw new Error('Codex SDK stream failed safely.');
      if (event && event.type === 'turn.completed') completed = true;
      if (
        event && event.type === 'item.completed' && event.item &&
        event.item.type === 'agent_message'
      ) {
        outputText = event.item.text;
      }
      const projected = presentationEvent(event);
      if (projected && onPresentationEvent) onPresentationEvent(projected);
    }
    turn.setIterator(null);
    turn.assertBeforeDeadline();
    if (!completed || typeof outputText !== 'string' || !outputText.trim()) {
      throw new Error('Codex SDK stream ended without canonical completion.');
    }
    if (Buffer.byteLength(outputText, 'utf8') > MAX_OUTPUT_BYTES) {
      throw new Error('Codex SDK cognitive output size bound exceeded.');
    }
    let output;
    try {
      output = JSON.parse(outputText);
    } catch {
      throw new Error('Codex SDK cognitive output is not valid JSON.');
    }
    rejectAuthority(output);
    turn.assertBeforeDeadline();
    const completedAt = monotonicNow();
    if (onMetric) {
      onMetric(deepFreeze({
        schema: 'sdo.codex_sdk_latency_metric.v1',
        setupOverheadMs: Math.max(0, dispatchedAt - turn.startedAt),
        totalElapsedMs: Math.max(0, completedAt - turn.startedAt),
        modelLatencyIncluded: true,
        operationalAuthority: false
      }));
    }
    logicalThreadId = candidateThreadId;
    return deepFreeze({ ...output });
  }

  async function invoke(request) {
    if (containmentClosed || containment.isDisposed()) {
      const error = new Error(
        'CODEX_CONTAINMENT_UNAVAILABLE: cognitive containment session is closed.'
      );
      error.code = 'CODEX_CONTAINMENT_UNAVAILABLE';
      throw error;
    }
    if (activeTurn) {
      throw new Error('Codex SDK cognitive turn is already active.');
    }
    const abortController = new AbortController();
    const startedAt = monotonicNow();
    const deadlineAt = startedAt + CODEX_COGNITIVE_DEADLINE_MS;
    let rejectTermination;
    const terminationPromise = new Promise((resolve, reject) => {
      void resolve;
      rejectTermination = reject;
    });
    const turn = {
      abortController,
      startedAt,
      deadlineAt,
      iterator: null,
      iteratorReturnCalled: false,
      terminationError: null,
      timer: null,
      timerCleared: false,
      clearDeadline() {
        if (this.timerCleared) return;
        this.timerCleared = true;
        if (this.timer !== null) clearScheduledTimeout(this.timer);
      },
      setIterator(iterator) {
        this.iterator = iterator;
        if (iterator && this.terminationError) this.closeIterator();
      },
      closeIterator() {
        if (this.iteratorReturnCalled || !this.iterator ||
            typeof this.iterator.return !== 'function') return;
        this.iteratorReturnCalled = true;
        try {
          Promise.resolve(this.iterator.return()).catch(() => {});
        } catch {
          // Iterator cleanup cannot broaden or replace the sanitized failure.
        }
      },
      terminate(reason) {
        if (this.terminationError) return this.terminationError;
        this.terminationError = reason === 'TIMEOUT'
          ? timeoutFailure()
          : cancellationFailure();
        this.clearDeadline();
        if (!this.abortController.signal.aborted) this.abortController.abort();
        this.closeIterator();
        try {
          disposeContainment();
        } catch {
          this.terminationError = cleanupFailure();
        }
        rejectTermination(this.terminationError);
        return this.terminationError;
      },
      assertBeforeDeadline() {
        if (this.terminationError) throw this.terminationError;
        if (monotonicNow() >= this.deadlineAt) {
          throw this.terminate('TIMEOUT');
        }
        if (this.abortController.signal.aborted) {
          throw this.terminate('CANCELLED');
        }
      }
    };
    activeTurn = turn;
    try {
      turn.timer = scheduleTimeout(
        () => turn.terminate('TIMEOUT'),
        CODEX_COGNITIVE_DEADLINE_MS
      );
      return await Promise.race([
        invokeContained(request, turn),
        terminationPromise
      ]);
    } catch (error) {
      const failure = turn.terminationError || error;
      if (!turn.terminationError) turn.terminate('CANCELLED');
      if (turn.terminationError &&
          turn.terminationError.code === 'CODEX_CONTAINMENT_CLEANUP_FAILED') {
        throw turn.terminationError;
      }
      if (failure && [CODEX_COGNITIVE_TIMEOUT, CODEX_COGNITIVE_CANCELLED].includes(failure.code)) {
        throw failure;
      }
      if (error && typeof error.message === 'string' &&
          /^(?:Codex SDK|Codex cognitive|Codex credential|CODEX_)/.test(error.message)) {
        throw error;
      }
      throw new Error('Codex SDK cognitive execution failed safely.');
    } finally {
      turn.clearDeadline();
      if (activeTurn === turn) activeTurn = null;
    }
  }

  return Object.freeze({
    schema: CODEX_SDK_SCHEMA,
    providerId: CODEX_SDK_PROVIDER_ID,
    model: selectedModel,
    sandboxMode: 'read-only',
    approvalPolicy: 'never',
    cognitiveWorkingDirectory: containment.sdkWorkingDirectory,
    containment: containment.attestation,
    ...CODEX_LOCATION,
    continuity: CODEX_SDK_CONTINUITY,
    operationalAuthority: false,
    mutationAuthority: false,
    publicationAuthority: false,
    invoke,
    currentThreadId: () => logicalThreadId,
    dispose,
    isDisposed: () => containmentClosed || containment.isDisposed()
  });
}

module.exports = Object.freeze({
  CODEX_SDK_PROVIDER_ID,
  CODEX_SDK_SCHEMA,
  CODEX_COGNITIVE_DEADLINE_MS,
  CODEX_COGNITIVE_TIMEOUT,
  CODEX_COGNITIVE_CANCELLED,
  createCodexEnvironment,
  createCodexSDKAIProviderAdapter
});
