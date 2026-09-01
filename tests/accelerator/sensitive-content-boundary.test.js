'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { createSensitiveContentPolicy, inspectSensitiveContent } = require('../../accelerator/core/sensitive-content-boundary');

test('content inspection allows ordinary governed evidence', () => {
  const result = inspectSensitiveContent(createSensitiveContentPolicy(), { target: 'src/app.js', content: 'module.exports = true;\n' });
  assert.equal(result.decision, 'ALLOWED');
  assert.equal(result.providerSafe, true);
  assert.match(result.contentSha256, /^[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(result));
});

test('secret content is detected even under an innocent filename', () => {
  const result = inspectSensitiveContent(createSensitiveContentPolicy(), { target: 'docs/example.txt', content: 'client_secret=not-for-a-provider-123456789\n' });
  assert.equal(result.decision, 'REDACTED');
  assert.equal(result.providerSafe, true);
  assert.doesNotMatch(result.content, /not-for-a-provider/);
  assert.match(result.content, /REDACTED_BY_SURGICAL_DEVOPS/);
});

test('private keys and npm authentication material are blocked without returning content', () => {
  for (const content of ['-----BEGIN PRIVATE KEY-----\nabc\n', '//registry.npmjs.org/:_authToken=npm_abcdefghijklmnopqrstuvwxyz\n']) {
    const result = inspectSensitiveContent(createSensitiveContentPolicy(), { target: 'ordinary.txt', content });
    assert.equal(result.decision, 'BLOCKED');
    assert.equal(result.providerSafe, false);
    assert.equal(result.content, null);
  }
});

test('excluded paths are blocked independently from filename suffix', () => {
  const result = inspectSensitiveContent(createSensitiveContentPolicy(), { target: '.ssh/config.txt', content: 'harmless-looking text' });
  assert.equal(result.decision, 'BLOCKED');
  assert.equal(result.reason, 'EXCLUDED_PATH');
});

test('sensitive boundary rejects traversal and oversized evidence', () => {
  const policy = createSensitiveContentPolicy();
  assert.throws(() => inspectSensitiveContent(policy, { target: '../secret', content: 'x' }), /workspace-relative/);
  assert.throws(() => inspectSensitiveContent(policy, { target: 'large.txt', content: 'x'.repeat(policy.maxInspectionBytes + 1) }), /byte bound/);
});

test('sensitive boundary is pure and exposes no physical authority', () => {
  const api = require('../../accelerator/core/sensitive-content-boundary');
  assert.deepEqual(Object.keys(api).filter((key) => typeof api[key] === 'function').sort(), ['createSensitiveContentPolicy', 'inspectSensitiveContent']);
  const source = fs.readFileSync(require.resolve('../../accelerator/core/sensitive-content-boundary'), 'utf8');
  assert.doesNotMatch(source, /child_process|node:http|node:https|fetch\(/);
});
