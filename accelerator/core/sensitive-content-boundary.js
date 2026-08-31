'use strict';

const crypto = require('node:crypto');

const POLICY_SCHEMA = 'sdo.sensitive_content_policy.v1';
const RESULT_SCHEMA = 'sdo.sensitive_content_result.v1';
const MAX_INSPECTION_BYTES = 64 * 1024;

const DEFAULT_EXCLUDED_SEGMENTS = Object.freeze([
  '.git', '.npm', '.ssh', 'node_modules', '.surgical-secrets'
]);

const CONTENT_RULES = Object.freeze([
  Object.freeze({ id: 'PRIVATE_KEY', action: 'BLOCK', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i }),
  Object.freeze({ id: 'NPM_AUTH', action: 'BLOCK', pattern: /(?:^|\n)\s*\/\/[^\s:]+\/:_authToken\s*=\s*\S+/i }),
  Object.freeze({ id: 'CLOUD_CREDENTIAL', action: 'BLOCK', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ }),
  Object.freeze({ id: 'BEARER_TOKEN', action: 'REDACT', pattern: /\bBearer\s+[A-Za-z0-9._~+\/-]{12,}/gi }),
  Object.freeze({ id: 'ASSIGNMENT_SECRET', action: 'REDACT', pattern: /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd)\s*[:=]\s*([^\s,;]+)/gi }),
  Object.freeze({ id: 'KNOWN_TOKEN', action: 'REDACT', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9]{20,})\b/g })
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalTarget(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Canonical evidence target is required.');
  const target = value.trim().replace(/\\/g, '/');
  if (target.startsWith('/') || target.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Sensitive-content target must remain workspace-relative.');
  }
  return target;
}

function createSensitiveContentPolicy({ excludedSegments = DEFAULT_EXCLUDED_SEGMENTS } = {}) {
  if (!Array.isArray(excludedSegments) || excludedSegments.some((item) => typeof item !== 'string' || !item.trim() || item.includes('/'))) {
    throw new Error('Sensitive-content exclusions must be canonical path segments.');
  }
  const normalized = [...new Set(excludedSegments.map((item) => item.trim()))].sort();
  return deepFreeze({
    schema: POLICY_SCHEMA,
    excludedSegments: normalized,
    maxInspectionBytes: MAX_INSPECTION_BYTES,
    filenamePatternsSufficient: false,
    contentInspectionRequired: true,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function inspectSensitiveContent(policy, { target, content } = {}) {
  if (!policy || policy.schema !== POLICY_SCHEMA || !Object.isFrozen(policy)) {
    throw new Error('Immutable sensitive-content policy is required.');
  }
  const canonical = canonicalTarget(target);
  if (typeof content !== 'string') throw new Error('Textual governed evidence is required.');
  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes > policy.maxInspectionBytes) throw new Error('Sensitive-content inspection byte bound exceeded.');

  const contentSha256 = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  const segments = canonical.split('/');
  const excluded = segments.find((segment) => policy.excludedSegments.includes(segment));
  if (excluded) {
    return deepFreeze({ schema: RESULT_SCHEMA, decision: 'BLOCKED', reason: 'EXCLUDED_PATH', rules: [`PATH:${excluded}`], target: canonical, content: null, contentSha256, bytes, redacted: false, providerSafe: false, operationalAuthority: false, mutationAuthority: false });
  }

  const matched = CONTENT_RULES.filter((rule) => {
    rule.pattern.lastIndex = 0;
    return rule.pattern.test(content);
  });
  if (matched.some((rule) => rule.action === 'BLOCK')) {
    return deepFreeze({ schema: RESULT_SCHEMA, decision: 'BLOCKED', reason: 'SENSITIVE_CONTENT', rules: matched.map((rule) => rule.id).sort(), target: canonical, content: null, contentSha256, bytes, redacted: false, providerSafe: false, operationalAuthority: false, mutationAuthority: false });
  }

  let safe = content;
  for (const rule of matched.filter((item) => item.action === 'REDACT')) {
    rule.pattern.lastIndex = 0;
    safe = safe.replace(rule.pattern, `[REDACTED_BY_SURGICAL_DEVOPS:${rule.id}]`);
  }
  return deepFreeze({
    schema: RESULT_SCHEMA,
    decision: matched.length ? 'REDACTED' : 'ALLOWED',
    reason: matched.length ? 'DETERMINISTIC_REDACTION' : null,
    rules: matched.map((rule) => rule.id).sort(),
    target: canonical,
    content: safe,
    contentSha256,
    bytes,
    redacted: matched.length > 0,
    providerSafe: true,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

module.exports = Object.freeze({
  POLICY_SCHEMA,
  RESULT_SCHEMA,
  MAX_INSPECTION_BYTES,
  DEFAULT_EXCLUDED_SEGMENTS,
  createSensitiveContentPolicy,
  inspectSensitiveContent
});
