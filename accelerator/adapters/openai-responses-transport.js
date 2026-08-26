'use strict';

const { OPENAI_FRONTIER_PROFILE } = require('../cli/natural-frontier-provider-registry');

const ALLOWED_REQUEST_KEYS = new Set(['operation', 'model', 'stream', 'input', 'maxOutputTokens']);

function plain(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} is malformed.`);
  return value;
}

function validateRequest(request) {
  plain(request, 'OpenAI Responses request');
  for (const key of Object.keys(request)) {
    if (!ALLOWED_REQUEST_KEYS.has(key)) throw new Error(`OpenAI Responses request contains forbidden field: ${key}.`);
  }
  if (request.operation !== 'RESPONSES' || request.model !== OPENAI_FRONTIER_PROFILE.model || request.stream !== true) {
    throw new Error('OpenAI Responses request is outside the qualified profile.');
  }
  if (!Array.isArray(request.input) || request.input.length < 1 ||
      !Number.isSafeInteger(request.maxOutputTokens) || request.maxOutputTokens < 1 ||
      request.maxOutputTokens > OPENAI_FRONTIER_PROFILE.maxOutputTokens) {
    throw new Error('OpenAI Responses request bounds are invalid.');
  }
  const bytes = Buffer.byteLength(JSON.stringify(request));
  if (bytes > OPENAI_FRONTIER_PROFILE.maxRequestBytes) throw new Error('OpenAI Responses request size bound exceeded.');
}

function credential(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 8192 || /[\r\n]/.test(value)) {
    throw new Error('OpenAI credential is unavailable or malformed.');
  }
  return value.trim();
}

async function readQualifiedStream(response, onEvent) {
  if (!response || typeof response.status !== 'number' || response.status < 200 || response.status >= 300 ||
      !response.body || typeof response.body.getReader !== 'function') {
    throw new Error('OpenAI Responses request failed safely.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let total = 0;
  let outputText = '';
  let completed = false;

  function consume(block) {
    const data = block.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('');
    if (!data || data === '[DONE]') return;
    let event;
    try { event = JSON.parse(data); } catch { throw new Error('OpenAI Responses stream event is malformed.'); }
    if (!event || typeof event.type !== 'string') throw new Error('OpenAI Responses stream event is malformed.');
    if (event.type === 'response.output_text.delta') {
      if (typeof event.delta !== 'string') throw new Error('OpenAI Responses text delta is malformed.');
      outputText += event.delta;
      if (Buffer.byteLength(outputText) > OPENAI_FRONTIER_PROFILE.maxResponseBytes) {
        throw new Error('OpenAI Responses output size bound exceeded.');
      }
      if (typeof onEvent === 'function') onEvent(Object.freeze({ type: 'CONTENT_DELTA', text: event.delta }));
    } else if (event.type === 'response.completed') {
      completed = true;
    } else if (event.type === 'response.failed' || event.type === 'error') {
      throw new Error('OpenAI Responses stream failed safely.');
    } else if (!['response.created', 'response.in_progress', 'response.output_item.added',
      'response.output_item.done', 'response.content_part.added', 'response.content_part.done',
      'response.output_text.done'].includes(event.type)) {
      throw new Error('OpenAI Responses stream event type is not qualified.');
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new Error('OpenAI Responses stream bytes are malformed.');
      total += value.byteLength;
      if (total > OPENAI_FRONTIER_PROFILE.maxResponseBytes) throw new Error('OpenAI Responses stream size bound exceeded.');
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.match(/\r?\n\r?\n/);
      while (boundary) {
        consume(buffer.slice(0, boundary.index));
        buffer = buffer.slice(boundary.index + boundary[0].length);
        boundary = buffer.match(/\r?\n\r?\n/);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) consume(buffer);
  } finally {
    try { reader.releaseLock(); } catch {}
  }
  if (!completed || !outputText.trim()) throw new Error('OpenAI Responses stream ended without canonical completion.');
  return Object.freeze({ outputText, operationalAuthority: false, mutationAuthority: false });
}

function createOpenAIResponsesTransport({ fetchImplementation, credentialProvider } = {}) {
  if (typeof fetchImplementation !== 'function' || typeof credentialProvider !== 'function') {
    throw new Error('OpenAI Responses transport requires fetch and credential boundaries.');
  }
  async function invoke(request, { onEvent } = {}) {
    validateRequest(request);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OPENAI_FRONTIER_PROFILE.timeoutMs);
    let response;
    try {
      const apiKey = credential(await credentialProvider());
      response = await fetchImplementation(OPENAI_FRONTIER_PROFILE.endpoint, {
        method: 'POST',
        headers: Object.freeze({
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          model: request.model,
          input: request.input,
          max_output_tokens: request.maxOutputTokens,
          stream: true,
          store: false,
          tools: []
        }),
        signal: controller.signal
      });
    } catch {
      clearTimeout(timer);
      throw new Error('OpenAI Responses transport failed safely.');
    }
    try {
      return await readQualifiedStream(response, onEvent);
    } finally {
      clearTimeout(timer);
    }
  }
  return Object.freeze({
    schema: 'sdo.openai_responses_transport.v1',
    endpoint: OPENAI_FRONTIER_PROFILE.endpoint,
    providerId: OPENAI_FRONTIER_PROFILE.providerId,
    operationalAuthority: false,
    mutationAuthority: false,
    invoke
  });
}

module.exports = Object.freeze({ createOpenAIResponsesTransport });
