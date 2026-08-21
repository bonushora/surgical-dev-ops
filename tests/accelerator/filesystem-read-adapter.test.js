'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { evaluateCapabilityGrant } = require('../../accelerator/core/capability-grant');
const { readFileWithGrant } = require('../../accelerator/adapters/filesystem-read-adapter');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-fs-adapter-'));
const workspace = path.join(root, 'repo');
const sibling = path.join(root, 'repo-secret');
fs.mkdirSync(workspace);
fs.mkdirSync(sibling);
fs.writeFileSync(path.join(workspace, 'target.txt'), 'authorized\n');
fs.writeFileSync(path.join(workspace, 'other.txt'), 'other\n');
fs.writeFileSync(path.join(sibling, 'secret.txt'), 'secret\n');
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

const NOW = '2026-08-20T12:00:00.000Z';
const EXPIRY = '2026-08-20T13:00:00.000Z';

function issue(paths = ['target.txt'], overrides = {}) {
  const common = {
    operationId: 'op-1', workspace, policyDecision: 'ALLOWED', riskLevel: 'R0',
    lifecycleState: 'PENDING', capabilityType: 'FILESYSTEM_READ',
    scope: { paths }, idempotency: 'IDEMPOTENT'
  };
  return evaluateCapabilityGrant(
    { ...common, expiresAt: EXPIRY, ...overrides.request },
    { ...common, evaluatedAt: NOW, ...overrides.authority }
  );
}

function read(overrides = {}) {
  return readFileWithGrant({
    operationId: 'op-1', workspace, target: 'target.txt',
    grantEvaluation: issue(), observedAt: NOW, ...overrides
  });
}

function frozenEvaluation(grant) {
  const evaluation = {
    schema: 'sdo.capability_grant_evaluation.v1',
    decision: 'ALLOWED',
    grant
  };
  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) freeze(child);
    return Object.freeze(value);
  }
  return freeze(evaluation);
}

test('valid bounded file read returns bound evidence', () => {
  const result = read();
  assert.equal(result.operationId, 'op-1');
  assert.equal(result.workspace, fs.realpathSync(workspace));
  assert.equal(result.evidence.content, 'authorized\n');
});

test('missing grant fails closed', () => {
  assert.throws(() => read({ grantEvaluation: undefined }), /valid immutable ALLOWED/);
});

test('malformed grant fails closed', () => {
  assert.throws(() => read({ grantEvaluation: Object.freeze({}) }), /valid immutable ALLOWED/);
});

test('shallow-frozen grant with mutable nested scope fails closed', () => {
  const grant = { ...issue().grant, scope: { paths: [...issue().grant.scope.paths] } };
  const evaluation = Object.freeze({
    schema: 'sdo.capability_grant_evaluation.v1',
    decision: 'ALLOWED',
    grant: Object.freeze(grant)
  });
  assert.throws(
    () => read({ grantEvaluation: evaluation }),
    /valid immutable ALLOWED/
  );
});

test('expired grant fails closed', () => {
  assert.throws(() => read({ observedAt: EXPIRY }), /expired/);
});

test('operationId mismatch fails closed', () => {
  assert.throws(() => read({ operationId: 'op-2' }), /operationId mismatch/);
});

test('workspace mismatch fails closed', () => {
  assert.throws(() => read({ workspace: fs.realpathSync(os.tmpdir()) }), /workspace mismatch/);
});

test('out-of-scope target fails closed', () => {
  assert.throws(() => read({ target: 'other.txt' }), /outside the authorized/);
});

test('parent traversal fails closed', () => {
  assert.throws(() => read({ target: '../repo-secret/secret.txt' }), /escapes authorized workspace/);
});

test('sibling-prefix escape fails closed', () => {
  assert.throws(() => read({ target: `${workspace}-secret/secret.txt` }), /escapes authorized workspace/);
});

test('symlink escape after grant issuance fails closed', () => {
  const link = path.join(workspace, 'link.txt');
  fs.symlinkSync(path.join(workspace, 'target.txt'), link);
  const grantEvaluation = issue(['link.txt']);
  fs.unlinkSync(link);
  fs.symlinkSync(path.join(sibling, 'secret.txt'), link);
  assert.throws(
    () => read({ target: 'link.txt', grantEvaluation }),
    /escapes authorized workspace/
  );
});

test('unresolved target fails closed', () => {
  const temporary = path.join(workspace, 'temporary.txt');
  fs.writeFileSync(temporary, 'temporary\n');
  const grantEvaluation = issue(['temporary.txt']);
  fs.unlinkSync(temporary);
  assert.throws(
    () => read({ target: 'temporary.txt', grantEvaluation }),
    /cannot be resolved/
  );
});

test('directory target fails closed', () => {
  const replaceable = path.join(workspace, 'replaceable.txt');
  fs.writeFileSync(replaceable, 'file\n');
  const grantEvaluation = issue(['replaceable.txt']);
  fs.unlinkSync(replaceable);
  fs.mkdirSync(replaceable);
  assert.throws(
    () => read({ target: 'replaceable.txt', grantEvaluation }),
    /is not a file/
  );
});

test('returned read evidence is deeply immutable', () => {
  const result = read();
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.target));
  assert.ok(Object.isFrozen(result.evidence));
  assert.throws(() => { result.target.canonical = '/changed'; }, TypeError);
});

test('write capability cannot be consumed', () => {
  const grant = {
    ...issue().grant,
    capabilityType: 'FILESYSTEM_WRITE',
    scope: { paths: [...issue().grant.scope.paths] }
  };
  assert.throws(
    () => read({ grantEvaluation: frozenEvaluation(grant) }),
    /does not permit bounded filesystem read/
  );
});

test('adapter has no process, network or Git dependency', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../../accelerator/adapters/filesystem-read-adapter.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /child_process|execFile|spawn|http|https|net|\.\/git/);
});
