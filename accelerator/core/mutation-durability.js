'use strict';

const OPERATIONS = Object.freeze([
  'FLUSH_FILE_DATA', 'FLUSH_DIRECTORY', 'DURABLE_RENAME_BOUNDARY',
  'DURABLE_JOURNAL_APPEND', 'DURABLE_LOCK_BOUNDARY', 'DURABLE_FINALIZATION'
]);
const CLAIMS = Object.freeze({
  PROCESS_CRASH_RECONCILIATION: 'PROCESS_CRASH_RECONCILIATION',
  FILESYSTEM_DURABILITY_PRIMITIVES_ENFORCED: 'FILESYSTEM_DURABILITY_PRIMITIVES_ENFORCED',
  POWER_LOSS_VALIDATED: 'POWER_LOSS_VALIDATED'
});

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function requireDurabilityReceipt(receipt, operation) {
  if (!OPERATIONS.includes(operation) || !receipt || !Object.isFrozen(receipt) ||
      receipt.schema !== 'sdo.filesystem_durability_receipt.v1' ||
      receipt.operation !== operation || receipt.decision !== 'CONFIRMED' ||
      receipt.claimLevel !== CLAIMS.FILESYSTEM_DURABILITY_PRIMITIVES_ENFORCED ||
      receipt.powerLossValidated !== false || !receipt.platform || !receipt.provider) {
    throw new Error(`Required durability operation ${operation} is unsupported or unconfirmed.`);
  }
  return receipt;
}

function durabilityClaims() {
  return deepFreeze({
    processCrashReconciliation: true,
    filesystemDurabilityPrimitivesEnforced: true,
    powerLossValidated: false,
    universalExactlyOnce: false
  });
}

module.exports = { OPERATIONS, CLAIMS, requireDurabilityReceipt, durabilityClaims };
