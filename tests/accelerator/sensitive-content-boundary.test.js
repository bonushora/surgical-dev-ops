'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { createSensitiveContentPolicy, inspectSensitiveContent } = require('../../accelerator/core/sensitive-content-boundary');

const SOURCE = 'GOVERNED_WORKSPACE_READ';
function authorizedPolicy() {
  return createSensitiveContentPolicy({ authorizedEgressSources: [SOURCE] });
}
function inspect(target, content) {
  return inspectSensitiveContent(authorizedPolicy(), { target, content, source: SOURCE });
}

test('content inspection allows ordinary governed evidence', () => {
  const result = inspect('src/app.js', 'module.exports = true;\n');
  assert.equal(result.decision, 'ALLOWED');
  assert.equal(result.providerSafe, true);
  assert.equal(result.egressAuthorized, true);
  assert.equal(result.classificationComplete, false);
  assert.match(result.contentSha256, /^[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(result));
});

test('secret content is detected even under an innocent filename', () => {
  const result = inspect('docs/example.txt', 'client_secret=not-for-a-provider-123456789\n');
  assert.equal(result.decision, 'REDACTED');
  assert.equal(result.providerSafe, true);
  assert.doesNotMatch(result.content, /not-for-a-provider/);
  assert.match(result.content, /REDACTED_BY_SURGICAL_DEVOPS/);
});

test('known Portuguese operational-secret fixture is redacted without universal classification claims', () => {
  const result = inspect('docs/fixture.txt', 'segredo_operacional=VALOR_FICTICIO\n');
  assert.equal(result.decision, 'REDACTED');
  assert.deepEqual(result.rules, ['OPERATIONAL_SECRET']);
  assert.doesNotMatch(result.content, /VALOR_FICTICIO/);
  assert.equal(result.classificationComplete, false);
  assert.match(result.classificationScope, /NOT_UNIVERSAL/);
});

test('no-match content from an unknown or unauthorized source is blocked for egress', () => {
  const policy = authorizedPolicy();
  for (const source of [undefined, 'GOVERNED_PROCESS_OUTPUT']) {
    const result = inspectSensitiveContent(policy, {
      target: 'src/plain.txt',
      content: 'no known pattern here',
      ...(source ? { source } : {})
    });
    assert.equal(result.decision, 'BLOCKED');
    assert.equal(result.reason, 'EGRESS_SOURCE_UNAUTHORIZED');
    assert.equal(result.providerSafe, false);
    assert.equal(result.egressAuthorized, false);
    assert.equal(result.content, null);
  }
});

test('private keys and npm authentication material are blocked without returning content', () => {
  for (const content of ['-----BEGIN PRIVATE KEY-----\nabc\n', '//registry.npmjs.org/:_authToken=npm_abcdefghijklmnopqrstuvwxyz\n']) {
    const result = inspect('ordinary.txt', content);
    assert.equal(result.decision, 'BLOCKED');
    assert.equal(result.providerSafe, false);
    assert.equal(result.content, null);
  }
});

test('excluded paths are blocked independently from filename suffix', () => {
  const result = inspect('.ssh/config.txt', 'harmless-looking text');
  assert.equal(result.decision, 'BLOCKED');
  assert.equal(result.reason, 'EXCLUDED_PATH');
});

test('sensitive boundary rejects traversal and oversized evidence', () => {
  const policy = authorizedPolicy();
  assert.throws(() => inspectSensitiveContent(policy, { target: '../secret', content: 'x', source: SOURCE }), /workspace-relative/);
  assert.throws(() => inspectSensitiveContent(policy, { target: 'large.txt', content: 'x'.repeat(policy.maxInspectionBytes + 1), source: SOURCE }), /byte bound/);
});

test('sensitive boundary is pure and exposes no physical authority', () => {
  const api = require('../../accelerator/core/sensitive-content-boundary');
  assert.deepEqual(Object.keys(api).filter((key) => typeof api[key] === 'function').sort(), ['createSensitiveContentPolicy', 'inspectSensitiveContent']);
  const source = fs.readFileSync(require.resolve('../../accelerator/core/sensitive-content-boundary'), 'utf8');
  assert.doesNotMatch(source, /child_process|node:http|node:https|fetch\(/);
});
