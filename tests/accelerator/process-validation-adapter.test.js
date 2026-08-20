'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { evaluateCapabilityGrant } = require('../../accelerator/core/capability-grant');
const {
  validateJavaScriptWithGrant
} = require('../../accelerator/adapters/process-validation-adapter');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-validation-'));
const workspace = path.join(root, 'workspace');
const sibling = path.join(root, 'workspace-secret');
fs.mkdirSync(workspace);
fs.mkdirSync(sibling);
fs.writeFileSync(path.join(workspace, 'valid.js'), 'const value = 1;\n');
fs.writeFileSync(path.join(workspace, 'invalid.js'), 'const = ;\n');
fs.writeFileSync(path.join(workspace, 'other.js'), 'const other = true;\n');
fs.writeFileSync(path.join(sibling, 'secret.js'), 'const secret = true;\n');
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

const NOW = '2026-08-20T12:00:00.000Z';
const EXPIRY = '2026-08-20T13:00:00.000Z';

function issue(paths = ['valid.js'], overrides = {}) {
  const common = {
    operationId: 'op-1', workspace, policyDecision: 'ALLOWED', riskLevel: 'R0',
    lifecycleState: 'PENDING', capabilityType: 'PROCESS_VALIDATION',
    scope: { selectors: ['NODE_SYNTAX_CHECK'], paths }, idempotency: 'IDEMPOTENT'
  };
  return evaluateCapabilityGrant(
    { ...common, expiresAt: EXPIRY, ...overrides.request },
    { ...common, evaluatedAt: NOW, ...overrides.authority }
  );
}

function validate(overrides = {}) {
  return validateJavaScriptWithGrant({
    operationId: 'op-1', workspace, selector: 'NODE_SYNTAX_CHECK',
    target: 'valid.js', grantEvaluation: issue(), observedAt: NOW, ...overrides
  });
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function grantWith(overrides) {
  const issued = issue();
  return freeze({
    schema: issued.schema,
    decision: issued.decision,
    reason: issued.reason,
    grant: { ...issued.grant, ...overrides }
  });
}

test('valid syntax check returns PASSED evidence', () => {
  const result = validate();
  assert.equal(result.validation.status, 'PASSED');
  assert.equal(result.validation.successfulCompletionEligible, true);
});

test('syntax error returns FAILED evidence', () => {
  const result = validate({ target: 'invalid.js', grantEvaluation: issue(['invalid.js']) });
  assert.equal(result.validation.status, 'FAILED');
  assert.equal(result.validation.successfulCompletionEligible, false);
  assert.notEqual(result.validation.exitCode, 0);
});

test('missing grant fails closed', () => {
  assert.throws(() => validate({ grantEvaluation: undefined }), /valid immutable ALLOWED/);
});

test('expired grant fails closed', () => {
  assert.throws(() => validate({ observedAt: EXPIRY }), /expired/);
});

test('operationId mismatch fails closed', () => {
  assert.throws(() => validate({ operationId: 'op-2' }), /operationId mismatch/);
});

test('workspace mismatch fails closed', () => {
  assert.throws(() => validate({ workspace: fs.realpathSync(os.tmpdir()) }), /workspace mismatch/);
});

test('invalid lifecycle state fails closed', () => {
  assert.throws(
    () => validate({ grantEvaluation: grantWith({ lifecycleState: 'COMPLETED' }) }),
    /does not permit bounded process validation/
  );
});

test('target outside granted scope fails closed', () => {
  assert.throws(() => validate({ target: 'other.js' }), /outside the authorized/);
});

test('parent traversal fails closed', () => {
  assert.throws(
    () => validate({ target: '../workspace-secret/secret.js' }),
    /escapes authorized workspace/
  );
});

test('symlink escape after grant issuance fails closed', () => {
  const link = path.join(workspace, 'link.js');
  fs.symlinkSync(path.join(workspace, 'valid.js'), link);
  const grantEvaluation = issue(['link.js']);
  fs.unlinkSync(link);
  fs.symlinkSync(path.join(sibling, 'secret.js'), link);
  assert.throws(
    () => validate({ target: 'link.js', grantEvaluation }),
    /escapes authorized workspace/
  );
});

test('unknown selector fails closed', () => {
  assert.throws(() => validate({ selector: 'PACKAGE_TEST' }), /Unknown or unauthorized/);
});

test('arbitrary executable injection attempt fails closed', () => {
  assert.throws(
    () => validateJavaScriptWithGrant({
      operationId: 'op-1', workspace, selector: 'NODE_SYNTAX_CHECK', target: 'valid.js',
      grantEvaluation: issue(), observedAt: NOW, executable: '/bin/sh'
    }),
    /executable, arguments or environment are forbidden/
  );
});

test('arbitrary argument injection attempt fails closed', () => {
  assert.throws(
    () => validateJavaScriptWithGrant({
      operationId: 'op-1', workspace, selector: 'NODE_SYNTAX_CHECK', target: 'valid.js',
      grantEvaluation: issue(), observedAt: NOW, args: ['-e', 'process.exit()']
    }),
    /executable, arguments or environment are forbidden/
  );
});

test('shell metacharacter target attempt fails closed', () => {
  assert.throws(() => validate({ target: 'valid.js; rm -rf x' }), /requires a \.js target/);
});

test('general process and shell capabilities remain denied', () => {
  for (const capabilityType of ['PROCESS_EXECUTE', 'SHELL_EXECUTE']) {
    assert.equal(issue(['valid.js'], {
      request: { capabilityType }, authority: { capabilityType }
    }).decision, 'DENIED');
  }
});

test('network credentials and package installation remain denied', () => {
  for (const capabilityType of ['NETWORK_ACCESS', 'CREDENTIAL_ACCESS', 'PACKAGE_INSTALL']) {
    assert.equal(issue(['valid.js'], {
      request: { capabilityType }, authority: { capabilityType }
    }).decision, 'DENIED');
  }
});

test('timeout fails closed', (context) => {
  context.mock.method(childProcess, 'spawnSync', () => ({
    error: Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
  }));
  assert.throws(() => validate(), /timed out/);
});

test('output overflow fails closed', (context) => {
  context.mock.method(childProcess, 'spawnSync', () => ({
    error: Object.assign(new Error('overflow'), { code: 'ENOBUFS' })
  }));
  assert.throws(() => validate(), /exceeded limit/);
});

test('validation evidence is deeply immutable', () => {
  const result = validate();
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.validation));
  assert.ok(Object.isFrozen(result.execution));
  assert.throws(() => { result.validation.status = 'PASSED'; }, TypeError);
});

test('FAILED result cannot become successful completion', () => {
  const result = validate({ target: 'invalid.js', grantEvaluation: issue(['invalid.js']) });
  assert.equal(result.validation.status, 'FAILED');
  assert.equal(result.validation.successfulCompletionEligible, false);
  assert.throws(() => { result.validation.successfulCompletionEligible = true; }, TypeError);
});
