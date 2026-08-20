'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  OPERATIONS, CLAIMS, requireDurabilityReceipt, durabilityClaims
} = require('../../accelerator/core/mutation-durability');

function receipt(operation) {
  return Object.freeze({
    schema: 'sdo.filesystem_durability_receipt.v1',
    operation,
    decision: 'CONFIRMED',
    platform: 'test',
    provider: 'TEST_DURABILITY',
    claimLevel: CLAIMS.FILESYSTEM_DURABILITY_PRIMITIVES_ENFORCED,
    powerLossValidated: false,
    subject: 'fixture'
  });
}

test('durability contract exposes the required OS-agnostic semantic boundaries', () => {
  assert.deepEqual(OPERATIONS, [
    'FLUSH_FILE_DATA', 'FLUSH_DIRECTORY', 'DURABLE_RENAME_BOUNDARY',
    'DURABLE_JOURNAL_APPEND', 'DURABLE_LOCK_BOUNDARY', 'DURABLE_FINALIZATION'
  ]);
  assert.ok(Object.isFrozen(OPERATIONS));
});

test('confirmed immutable receipt satisfies only its exact operation', () => {
  const value = receipt('FLUSH_FILE_DATA');
  assert.equal(requireDurabilityReceipt(value, 'FLUSH_FILE_DATA'), value);
  assert.throws(() => requireDurabilityReceipt(value, 'FLUSH_DIRECTORY'), /unsupported or unconfirmed/);
});

test('missing mutable malformed unsupported and power-loss claims fail closed', () => {
  assert.throws(() => requireDurabilityReceipt(null, 'FLUSH_FILE_DATA'));
  assert.throws(() => requireDurabilityReceipt({ ...receipt('FLUSH_FILE_DATA') }, 'FLUSH_FILE_DATA'));
  assert.throws(() => requireDurabilityReceipt(Object.freeze({
    ...receipt('FLUSH_FILE_DATA'), decision: 'UNSUPPORTED'
  }), 'FLUSH_FILE_DATA'));
  assert.throws(() => requireDurabilityReceipt(Object.freeze({
    ...receipt('FLUSH_FILE_DATA'), powerLossValidated: true
  }), 'FLUSH_FILE_DATA'));
});

test('claim levels remain immutable and explicitly exclude universal power-loss safety', () => {
  const claims = durabilityClaims();
  assert.ok(Object.isFrozen(claims));
  assert.equal(claims.processCrashReconciliation, true);
  assert.equal(claims.filesystemDurabilityPrimitivesEnforced, true);
  assert.equal(claims.powerLossValidated, false);
  assert.equal(claims.universalExactlyOnce, false);
  assert.equal(CLAIMS.POWER_LOSS_VALIDATED, 'POWER_LOSS_VALIDATED');
});
