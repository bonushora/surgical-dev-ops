'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const {
  STAGES,
  createMutationTransaction,
  transitionMutationTransaction,
  assertSameMutationTransaction
} = require('../../accelerator/core/mutation-transaction');

const WORKSPACE = path.resolve('/tmp/sdo-mutation-workspace');
const TARGET = path.join(WORKSPACE, 'src', 'target.js');

function definition(overrides = {}) {
  return {
    operationId: 'operation-1',
    workspace: WORKSPACE,
    target: TARGET,
    beforeSha256: 'a'.repeat(64),
    replacementSha256: 'b'.repeat(64),
    grantFingerprint: 'c'.repeat(64),
    approvalAuthorityFingerprint: 'd'.repeat(64),
    verifiedIdentityAssertionFingerprint: 'e'.repeat(64),
    idempotencyKey: 'mutation-operation-1',
    ...overrides
  };
}

function advance(transaction, stages) {
  return stages.reduce(transitionMutationTransaction, transaction);
}

test('equivalent canonical definitions derive deterministic identities', () => {
  const first = createMutationTransaction(definition());
  const second = createMutationTransaction(definition());
  assert.equal(first.transactionId, second.transactionId);
  assert.equal(first.replayIdentity, second.replayIdentity);
  assert.equal(assertSameMutationTransaction(first, second), true);
});

test('identity binds every required canonical transaction field', () => {
  const base = createMutationTransaction(definition());
  const variants = [
    { operationId: 'operation-2' },
    { workspace: path.resolve('/tmp/sdo-other-workspace'),
      target: path.resolve('/tmp/sdo-other-workspace/src/target.js') },
    { target: path.join(WORKSPACE, 'src', 'other.js') },
    { beforeSha256: 'f'.repeat(64) },
    { replacementSha256: '1'.repeat(64) },
    { grantFingerprint: '2'.repeat(64) },
    { approvalAuthorityFingerprint: '3'.repeat(64) },
    { verifiedIdentityAssertionFingerprint: '4'.repeat(64) },
    { idempotencyKey: 'mutation-operation-2' }
  ];
  for (const variant of variants) {
    const changed = createMutationTransaction(definition(variant));
    assert.notEqual(changed.transactionId, base.transactionId);
    assert.notEqual(changed.replayIdentity, base.replayIdentity);
    assert.throws(() => assertSameMutationTransaction(base, changed), /Conflicting/);
  }
});

test('canonical fields and exact shape fail closed', () => {
  const invalid = [
    { operationId: '' },
    { workspace: 'relative' },
    { workspace: `${WORKSPACE}${path.sep}` },
    { target: 'relative.js' },
    { target: WORKSPACE },
    { target: path.resolve(WORKSPACE, '..', 'outside.js') },
    { grantFingerprint: null },
    { approvalAuthorityFingerprint: null },
    { verifiedIdentityAssertionFingerprint: null },
    { idempotencyKey: '' }
  ];
  for (const override of invalid) {
    assert.throws(() => createMutationTransaction(definition(override)));
  }
  assert.throws(() => createMutationTransaction({ ...definition(), nested: {} }), /unknown/);
  assert.throws(() => createMutationTransaction(Object.assign([], definition())), /plain object/);
});

test('malformed hashes and caller identity fields are rejected', () => {
  for (const field of [
    'beforeSha256', 'replacementSha256', 'grantFingerprint',
    'approvalAuthorityFingerprint', 'verifiedIdentityAssertionFingerprint'
  ]) {
    assert.throws(() => createMutationTransaction(definition({ [field]: 'BAD' })), /SHA-256/);
  }
  assert.throws(() => createMutationTransaction({ ...definition(), transactionId: 'f'.repeat(64) }),
    /unknown/);
  assert.throws(() => createMutationTransaction({ ...definition(), replayIdentity: 'f'.repeat(64) }),
    /unknown/);
});

test('different target, BEFORE and replacement definitions conflict', () => {
  const base = createMutationTransaction(definition());
  for (const override of [
    { target: path.join(WORKSPACE, 'other.js') },
    { beforeSha256: '1'.repeat(64) },
    { replacementSha256: '2'.repeat(64) }
  ]) {
    assert.throws(() => assertSameMutationTransaction(
      base,
      createMutationTransaction(definition(override))
    ), /Conflicting/);
  }
});

test('different human, approval and grant authority definitions conflict', () => {
  const base = createMutationTransaction(definition());
  for (const override of [
    { verifiedIdentityAssertionFingerprint: '1'.repeat(64) },
    { approvalAuthorityFingerprint: '2'.repeat(64) },
    { grantFingerprint: '3'.repeat(64) }
  ]) {
    assert.throws(() => assertSameMutationTransaction(
      base,
      createMutationTransaction(definition(override))
    ), /Conflicting/);
  }
});

test('created transaction and nested transition history are deeply immutable', () => {
  const original = createMutationTransaction(definition());
  const next = transitionMutationTransaction(original, 'LOCKED');
  assert.ok(Object.isFrozen(original));
  assert.ok(Object.isFrozen(original.history));
  assert.ok(Object.isFrozen(original.history[0]));
  assert.ok(Object.isFrozen(next));
  assert.ok(Object.isFrozen(next.history));
  assert.ok(Object.isFrozen(next.history[1]));
  assert.equal(original.stage, 'PREPARED');
  assert.equal(original.version, 1);
  assert.equal(next.stage, 'LOCKED');
  assert.equal(next.version, 2);
});

test('normal stage progression is ordered and reaches successful terminal state', () => {
  const completed = advance(createMutationTransaction(definition()), [
    'LOCKED', 'BEFORE_VERIFIED', 'MUTATION_STARTED', 'PHYSICAL_APPLIED',
    'AFTER_VERIFIED', 'EVIDENCE_RECORDED', 'FINALIZED_SUCCESS'
  ]);
  assert.deepEqual(completed.history.map((event) => event.stage), [
    'PREPARED', 'LOCKED', 'BEFORE_VERIFIED', 'MUTATION_STARTED',
    'PHYSICAL_APPLIED', 'AFTER_VERIFIED', 'EVIDENCE_RECORDED', 'FINALIZED_SUCCESS'
  ]);
  assert.equal(completed.version, completed.history.length);
  assert.throws(() => transitionMutationTransaction(completed, 'FINALIZED_FAILED'), /Terminal/);
});

test('unknown, skipped and repeated transitions fail closed', () => {
  const prepared = createMutationTransaction(definition());
  assert.throws(() => transitionMutationTransaction(prepared, 'UNKNOWN'), /Unknown/);
  assert.throws(() => transitionMutationTransaction(prepared, 'BEFORE_VERIFIED'), /skipped/);
  assert.throws(() => transitionMutationTransaction(prepared, 'PREPARED'), /Repeated/);
  const locked = transitionMutationTransaction(prepared, 'LOCKED');
  assert.throws(() => transitionMutationTransaction(locked, 'PHYSICAL_APPLIED'), /skipped/);
});

test('pre-mutation failure can finalize without claiming physical stages', () => {
  const failed = transitionMutationTransaction(
    transitionMutationTransaction(createMutationTransaction(definition()), 'LOCKED'),
    'FINALIZED_FAILED'
  );
  assert.equal(failed.stage, 'FINALIZED_FAILED');
  assert.throws(() => transitionMutationTransaction(failed, 'RECOVERY_REQUIRED'), /Terminal/);
});

test('recovery ordering requires explicit recovery and evidence stages', () => {
  const applied = advance(createMutationTransaction(definition()), [
    'LOCKED', 'BEFORE_VERIFIED', 'MUTATION_STARTED', 'PHYSICAL_APPLIED'
  ]);
  assert.throws(() => transitionMutationTransaction(applied, 'RECOVERED'), /skipped/);
  const required = transitionMutationTransaction(applied, 'RECOVERY_REQUIRED');
  const recovered = transitionMutationTransaction(required, 'RECOVERED');
  assert.throws(() => transitionMutationTransaction(recovered, 'FINALIZED_FAILED'), /skipped/);
  const recorded = transitionMutationTransaction(recovered, 'EVIDENCE_RECORDED');
  const failed = transitionMutationTransaction(recorded, 'FINALIZED_FAILED');
  assert.equal(failed.stage, 'FINALIZED_FAILED');
});

test('unresolved recovery is terminal and cannot masquerade as success', () => {
  const unresolved = advance(createMutationTransaction(definition()), [
    'LOCKED', 'BEFORE_VERIFIED', 'MUTATION_STARTED', 'RECOVERY_REQUIRED',
    'RECOVERY_UNRESOLVED'
  ]);
  assert.equal(unresolved.stage, 'RECOVERY_UNRESOLVED');
  assert.throws(() => transitionMutationTransaction(unresolved, 'FINALIZED_SUCCESS'), /Terminal/);
});

test('contract exposes every ADR-007 foundation stage', () => {
  assert.deepEqual(STAGES, [
    'PREPARED', 'LOCKED', 'BEFORE_VERIFIED', 'MUTATION_STARTED',
    'PHYSICAL_APPLIED', 'AFTER_VERIFIED', 'EVIDENCE_RECORDED',
    'FINALIZED_SUCCESS', 'FINALIZED_FAILED', 'RECOVERY_REQUIRED', 'RECOVERED',
    'RECOVERY_UNRESOLVED'
  ]);
});
