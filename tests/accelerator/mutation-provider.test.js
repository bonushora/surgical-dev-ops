'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  defaultMutationProviderBoundary,
  evaluateMutationProvider,
  requireQualifiedMutationProvider,
  validateMutationProviderResult
} = require('../../accelerator/core/mutation-provider');
const { createInternalMutationProviderBoundary } =
  require('../../accelerator/core/mutation-provider-composition');
const { createTestBoundary } = require('./helpers/qualified-mutation-provider');

function boundary(state, compareAndReplace) {
  return createTestBoundary(state, compareAndReplace);
}

test('production mutation provider defaults to immutable UNQUALIFIED denial', () => {
  const result = evaluateMutationProvider(defaultMutationProviderBoundary);
  assert.equal(result.decision, 'DENIED');
  assert.equal(result.qualificationState, 'UNQUALIFIED');
  assert.equal(result.zeroDispatch, true);
  assert.ok(Object.isFrozen(result));
});

test('untrusted forged provider objects fail closed', () => {
  const forged = Object.freeze({ qualification: Object.freeze({ state: 'QUALIFIED' }),
    compareAndReplace() { throw new Error('must not run'); } });
  assert.equal(evaluateMutationProvider(forged).qualificationState, 'FAILED');
  assert.throws(() => requireQualifiedMutationProvider(forged), /untrusted/);
});

test('non-qualified trusted states all deny with zero dispatch', () => {
  for (const state of ['UNQUALIFIED', 'UNSUPPORTED', 'FAILED']) {
    const result = evaluateMutationProvider(boundary(state));
    assert.equal(result.decision, 'DENIED');
    assert.equal(result.zeroDispatch, true);
  }
});

test('only explicitly constructed trusted QUALIFIED provider is eligible', () => {
  const provider = boundary('QUALIFIED', () => {});
  assert.equal(evaluateMutationProvider(provider).decision, 'ALLOWED');
  assert.strictEqual(requireQualifiedMutationProvider(provider).boundary, provider);
});

test('qualified provider result must remain immutable and exactly bound', () => {
  const provider = boundary('QUALIFIED', () => {});
  const decision = evaluateMutationProvider(provider);
  const request = Object.freeze({ transactionId: 'a'.repeat(64), target: '/tmp/target',
    beforeSha256: 'b'.repeat(64), replacementSha256: 'c'.repeat(64) });
  const valid = Object.freeze({ schema: 'sdo.compare_and_replace_result.v1',
    providerId: decision.providerId,
    qualificationFingerprint: decision.qualificationFingerprint,
    transactionId: request.transactionId, target: request.target,
    beforeSha256: request.beforeSha256, replacementSha256: request.replacementSha256,
    outcome: 'MISMATCH' });
  assert.strictEqual(validateMutationProviderResult(valid, request, decision), valid);
  assert.throws(() => validateMutationProviderResult({ ...valid }, request, decision), /malformed/);
  assert.throws(() => validateMutationProviderResult(Object.freeze({ ...valid,
    providerId: 'forged' }), request, decision), /malformed/);
});

test('QUALIFIED cannot be declared without executable compare-and-replace capability', () => {
  assert.throws(() => boundary('QUALIFIED'), /lacks compare-and-replace/);
});

test('production provider module exposes no authority-minting factory', () => {
  assert.equal(require('../../accelerator/core/mutation-provider').createMutationProviderBoundary,
    undefined);
});

test('exported internal composition factory rejects ordinary callers', () => {
  assert.throws(() => createInternalMutationProviderBoundary({ providerId: 'forged',
    qualificationState: 'QUALIFIED', operation: 'COMPARE_AND_REPLACE', platform: 'x',
    compareAndReplaceCapability: true, compareAndReplace() {} }), /restricted/);
});

test('cloned or mutated provider objects never gain trusted authority', () => {
  const legitimate = boundary('UNQUALIFIED');
  const clone = { qualification: { ...legitimate.qualification }, compareAndReplace() {} };
  assert.equal(evaluateMutationProvider(clone).zeroDispatch, true);
  assert.throws(() => { legitimate.qualification.state = 'QUALIFIED'; }, TypeError);
  assert.equal(evaluateMutationProvider(legitimate).zeroDispatch, true);
});
