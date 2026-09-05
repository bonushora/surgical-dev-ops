'use strict';

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

function createCodexSDKAIProviderAdapter({
  workingDirectory,
  model,
  threadId = null,
  sdkLoader = defaultSDKLoader,
  onPresentationEvent = null,
  onMetric = null,
  monotonicNow = () => Number(process.hrtime.bigint()) / 1e6
} = {}) {
  const workspace = requireText(workingDirectory, 'Codex working directory', 1024);
  const selectedModel = model === undefined || model === null
    ? null
    : requireText(model, 'Codex model', 128);
  const resumeId = threadId === null ? null : requireText(threadId, 'Codex thread ID', 256);
  if (typeof sdkLoader !== 'function') throw new Error('Codex SDK loader is required.');
  if (onPresentationEvent !== null && typeof onPresentationEvent !== 'function') {
    throw new Error('Codex presentation event sink is malformed.');
  }
  if (onMetric !== null && typeof onMetric !== 'function') {
    throw new Error('Codex metric sink is malformed.');
  }
  if (typeof monotonicNow !== 'function') throw new Error('Monotonic clock is required.');

  let activeThreadId = resumeId;

  async function invoke(request) {
    if (
      !request || request.schema !== 'sdo.ai_cognitive_request.v1' ||
      request.providerId !== CODEX_SDK_PROVIDER_ID ||
      !ALLOWED_CAPABILITIES.includes(request.capability)
    ) {
      throw new Error('Codex SDK cognitive request is malformed or unqualified.');
    }
    const startedAt = monotonicNow();
    const sdk = await sdkLoader();
    if (!sdk || typeof sdk.Codex !== 'function') {
      throw new Error('Codex SDK is unavailable.');
    }
    const codex = new sdk.Codex();
    const threadOptions = {
      workingDirectory: workspace,
      sandboxMode: 'read-only',
      approvalPolicy: 'never',
      networkAccessEnabled: false,
      ...(selectedModel ? { model: selectedModel } : {})
    };
    const thread = activeThreadId
      ? codex.resumeThread(activeThreadId, threadOptions)
      : codex.startThread(threadOptions);
    const dispatchedAt = monotonicNow();
    const streamed = await thread.runStreamed(cognitivePrompt(request), {
      outputSchema: {
        type: 'object',
        additionalProperties: true
      }
    });
    if (!streamed || !streamed.events ||
        typeof streamed.events[Symbol.asyncIterator] !== 'function') {
      throw new Error('Codex SDK event stream is malformed.');
    }
    let outputText = null;
    let completed = false;
    for await (const event of streamed.events) {
      if (event && event.type === 'thread.started') activeThreadId = event.thread_id;
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
    const completedAt = monotonicNow();
    if (onMetric) {
      onMetric(deepFreeze({
        schema: 'sdo.codex_sdk_latency_metric.v1',
        setupOverheadMs: Math.max(0, dispatchedAt - startedAt),
        totalElapsedMs: Math.max(0, completedAt - startedAt),
        modelLatencyIncluded: true,
        operationalAuthority: false
      }));
    }
    return deepFreeze({ ...output });
  }

  return Object.freeze({
    schema: CODEX_SDK_SCHEMA,
    providerId: CODEX_SDK_PROVIDER_ID,
    model: selectedModel,
    sandboxMode: 'read-only',
    approvalPolicy: 'never',
    workingDirectory: workspace,
    operationalAuthority: false,
    mutationAuthority: false,
    publicationAuthority: false,
    invoke,
    currentThreadId: () => activeThreadId
  });
}

module.exports = Object.freeze({
  CODEX_SDK_PROVIDER_ID,
  CODEX_SDK_SCHEMA,
  createCodexSDKAIProviderAdapter
});
