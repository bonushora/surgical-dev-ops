'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const { createMachineAccessRequest, createMachineAccessAuthority } =
  require('../../accelerator/core/machine-access-contract');
const { executeMachineAccessReadOnly } =
  require('../../accelerator/core/machine-access-readonly-broker');
const { canonicalizeAuthorizedRoot } = require('../../accelerator/core/workspace-boundary');

const ISSUED = '2099-01-01T00:00:00.000Z';
const OBSERVED = '2099-01-01T00:01:00.000Z';
const EXPIRES = '2099-01-01T00:05:00.000Z';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function git(cwd, args) {
  const result = childProcess.spawnSync('git', args, { cwd, shell: false, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-broker-'));
  fs.writeFileSync(path.join(root, 'valid.js'), 'const value = 1;\n');
  git(root, ['init']);
  git(root, ['config', 'user.email', 'tests@example.invalid']);
  git(root, ['config', 'user.name', 'Surgical Tests']);
  git(root, ['add', 'valid.js']);
  git(root, ['commit', '-m', 'fixture']);
  return canonicalizeAuthorizedRoot(root);
}

function context(workspace, operationType, target, index) {
  const operationId = `broker-operation-${index}`;
  const request = createMachineAccessRequest({
    requestId: `broker-request-${index}`, operationId, workspace, operationType, target,
    purpose: 'Collect bounded evidence.', requestedAt: ISSUED
  });
  const grant = freeze({
    operationId, workspace, capabilityType: request.capabilityType, action: request.action,
    riskLevel: request.riskLevel, policyDecision: 'ALLOWED', lifecycleState: 'PENDING',
    idempotency: 'IDEMPOTENT', expiresAt: EXPIRES,
    scope: {
      operations: ['ls-files', 'status', 'diff'], selectors: ['NODE_SYNTAX_CHECK'],
      paths: target ? [{ path: target, canonicalPath: path.join(workspace, target) }] : []
    },
    fingerprint: index.toString(16).padStart(64, 'a')
  });
  const grantEvaluation = freeze({
    schema: 'sdo.capability_grant_evaluation.v1', decision: 'ALLOWED', grant
  });
  const authority = createMachineAccessAuthority({
    authorityId: `broker-authority-${index}`, request, grantEvaluation,
    issuedAt: ISSUED, expiresAt: EXPIRES
  });
  return { request, authority, grantEvaluation, observedAt: OBSERVED };
}

test('broker executes the complete closed read-only vocabulary', () => {
  const workspace = fixture();
  try {
    fs.appendFileSync(path.join(workspace, 'valid.js'), 'const changed = true;\n');
    const cases = [
      ['LIST_DIRECTORY', null], ['READ_FILE', 'valid.js'], ['GIT_STATUS', null],
      ['GIT_DIFF', null], ['RUN_FIXED_VALIDATION', 'valid.js']
    ];
    cases.forEach(([type, target], offset) => {
      const result = executeMachineAccessReadOnly(context(workspace, type, target, offset + 1));
      assert.equal(result.status, 'COMPLETED', result.reason);
      assert.equal(result.operationType, type);
      assert.equal(result.evidence.operationFingerprint, result.operationFingerprint);
      assert.equal(Object.isFrozen(result), true);
    });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('adapter rejection becomes an explicit failed result', () => {
  const workspace = fixture();
  try {
    const result = executeMachineAccessReadOnly(context(workspace, 'READ_FILE', 'missing.js', 9));
    assert.equal(result.status, 'FAILED');
    assert.equal(result.evidence, null);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('grant substitution fails before dispatch', () => {
  const workspace = fixture();
  try {
    const first = context(workspace, 'READ_FILE', 'valid.js', 7);
    const second = context(workspace, 'READ_FILE', 'valid.js', 8);
    assert.throws(() => executeMachineAccessReadOnly({
      ...first, grantEvaluation: second.grantEvaluation
    }), /binding mismatch/);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('broker source exposes no direct shell network or mutation authority', () => {
  const source = fs.readFileSync(
    require.resolve('../../accelerator/core/machine-access-readonly-broker'), 'utf8'
  );
  assert.doesNotMatch(source, /spawn|execSync|shell\s*:|https?|node:net|writeFile|unlink|rename/);
});
