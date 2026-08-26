'use strict';

const { OPENAI_FRONTIER_PROFILE } = require('../cli/natural-frontier-provider-registry');

const FORBIDDEN = new Set(['command', 'shell', 'mutationProvider', 'capabilityGrant', 'grant',
  'authorization', 'approval', 'privateKey', 'credential', 'write', 'patch', 'execution']);

function rejectAuthority(value, depth = 0) {
  if (depth > 6) throw new Error('OpenAI cognitive output nesting bound exceeded.');
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN.has(key)) throw new Error(`OpenAI cognitive output contains forbidden authority field: ${key}.`);
    rejectAuthority(child, depth + 1);
  }
}

function createOpenAIFrontierAIProviderAdapter({ transport, onPresentationEvent } = {}) {
  if (typeof transport !== 'function') throw new Error('OpenAI frontier transport is required.');
  async function invoke(request) {
    if (!request || request.schema !== 'sdo.ai_cognitive_request.v1' ||
        request.providerId !== OPENAI_FRONTIER_PROFILE.providerId ||
        !OPENAI_FRONTIER_PROFILE.capabilities.includes(request.capability)) {
      throw new Error('OpenAI frontier cognitive request is malformed or unqualified.');
    }
    const input = [
      { role: 'system', content: [{ type: 'input_text', text:
        'Return only JSON cognitive evidence. Never claim operational, mutation, shell, credential, approval or authorization authority.' }] },
      { role: 'user', content: [{ type: 'input_text', text: JSON.stringify({
        capability: request.capability, objective: request.objective, context: request.context
      }) }] }
    ];
    const result = await transport(Object.freeze({
      operation: 'RESPONSES', model: OPENAI_FRONTIER_PROFILE.model,
      stream: true, input, maxOutputTokens: OPENAI_FRONTIER_PROFILE.maxOutputTokens
    }), { onEvent: onPresentationEvent });
    let output;
    try { output = JSON.parse(result.outputText); } catch { throw new Error('OpenAI cognitive output is not valid JSON.'); }
    rejectAuthority(output);
    return Object.freeze({ ...output });
  }
  return Object.freeze({
    schema: 'sdo.openai_frontier_ai_provider_adapter.v1',
    providerId: OPENAI_FRONTIER_PROFILE.providerId,
    model: OPENAI_FRONTIER_PROFILE.model,
    operationalAuthority: false,
    mutationAuthority: false,
    invoke
  });
}

module.exports = Object.freeze({ createOpenAIFrontierAIProviderAdapter });
