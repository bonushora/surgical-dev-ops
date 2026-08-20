'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyScope } = require('../../accelerator/core/risk-classification');

function input(overrides = {}) {
  return {
    files: [{ path: 'target.js', lines: 20 }],
    mode: 'PATCH',
    estimatedDiffLines: 1,
    architecturalChange: false,
    worktreeClean: true,
    facts: {
      readOnly: false, externalEffect: false, reversible: true,
      sensitive: false, critical: false, irreversible: false
    },
    policy: { decision: 'ALLOW' },
    ...overrides
  };
}

test('classifies bounded observation as R0', () => {
  const result = classifyScope(input({
    mode: 'OBSERVE', estimatedDiffLines: 0,
    facts: { readOnly: true, externalEffect: false, reversible: false, sensitive: false, critical: false, irreversible: false }
  }));
  assert.equal(result.classification.level, 'R0');
  assert.equal(result.policy.decision, 'ALLOWED');
});

test('OBSERVE with mutating facts is denied', () => {
  const result = classifyScope(input({ mode: 'OBSERVE' }));
  assert.equal(result.policy.decision, 'DENIED');
  assert.equal(result.classification.executionAllowed, false);
});

test('caller risk cannot rescue contradictory mode and facts', () => {
  const result = classifyScope(input({ mode: 'OBSERVE', risk: 'R3' }));
  assert.equal(result.policy.decision, 'DENIED');
  assert.equal(result.classification.executionAllowed, false);
});

test('mutating mode with read-only facts is denied', () => {
  const facts = { readOnly: true, externalEffect: false, reversible: false, sensitive: false, critical: false, irreversible: false };
  assert.equal(classifyScope(input({ facts })).policy.decision, 'DENIED');
});

test('classifies reversible local patch as R1', () => {
  assert.equal(classifyScope(input()).classification.level, 'R1');
});

test('classifies sensitive operation as R2', () => {
  const facts = { ...input().facts, sensitive: true };
  assert.equal(classifyScope(input({ facts })).classification.level, 'R2');
});

test('classifies critical operation as R3', () => {
  const facts = { ...input().facts, critical: true };
  assert.equal(classifyScope(input({ facts })).classification.level, 'R3');
});

test('caller risk cannot downgrade computed risk', () => {
  const facts = { ...input().facts, sensitive: true };
  const result = classifyScope(input({ facts, risk: 'R0' }));
  assert.equal(result.classification.computedLevel, 'R2');
  assert.equal(result.classification.level, 'R2');
});

test('malformed, negative and NaN numeric inputs are denied', () => {
  for (const estimatedDiffLines of [-1, NaN, '1']) {
    assert.equal(classifyScope(input({ estimatedDiffLines })).policy.decision, 'DENIED');
  }
  assert.equal(classifyScope(input({ files: [{ path: 'x', lines: NaN }] })).policy.decision, 'DENIED');
});

test('missing, non-array and empty file scopes are denied', () => {
  for (const files of [undefined, 'target.js', []]) {
    assert.equal(classifyScope(input({ files })).policy.decision, 'DENIED');
  }
});

test('invalid mode is denied', () => {
  assert.equal(classifyScope(input({ mode: 'SHELL' })).policy.decision, 'DENIED');
});

test('missing required facts are denied', () => {
  assert.equal(classifyScope(input({ facts: undefined })).policy.decision, 'DENIED');
  const ambiguous = { ...input().facts, reversible: false };
  assert.equal(classifyScope(input({ facts: ambiguous })).policy.decision, 'DENIED');
});

test('missing or ambiguous policy is denied', () => {
  assert.equal(classifyScope(input({ policy: undefined })).policy.decision, 'DENIED');
  assert.equal(classifyScope(input({ policy: { decision: 'MAYBE' } })).policy.decision, 'DENIED');
});

test('R3 without approval requires approval and cannot execute', () => {
  const facts = { ...input().facts, critical: true };
  const result = classifyScope(input({ facts }));
  assert.equal(result.policy.decision, 'APPROVAL_REQUIRED');
  assert.equal(result.classification.executionAllowed, false);
});

test('R3 with valid explicit human approval is allowed by policy', () => {
  const facts = { ...input().facts, critical: true };
  const policy = { decision: 'ALLOW', humanApproval: { approved: true, approverId: 'human-1' } };
  const result = classifyScope(input({ facts, policy }));
  assert.equal(result.policy.decision, 'ALLOWED');
  assert.equal(result.classification.executionAllowed, true);
});
