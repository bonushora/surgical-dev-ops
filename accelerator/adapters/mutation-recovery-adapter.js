'use strict';

const crypto = require('node:crypto');
const { classifyMutationRecovery } = require('../core/mutation-recovery');
const {
  transitionMutationTransaction,
  bindMutationRecoveryEvidence
} = require('../core/mutation-transaction');
const filesystemPatch = require('./filesystem-patch-adapter');
const defaultLock = require('./mutation-lock-adapter');
const { defaultFilesystemDurabilityAdapter } = require('./filesystem-durability-adapter');

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function terminationEvidence(port, transaction) {
  if (!port || typeof port.verifyTerminated !== 'function') return null;
  const raw = port.verifyTerminated({ transactionId: transaction.transactionId,
    ownerProcess: transaction.lock.ownerProcess, lockId: transaction.lock.lockId });
  if (!raw || raw.decision !== 'TERMINATED' ||
      raw.ownerProcess !== transaction.lock.ownerProcess || !raw.verifierId) return null;
  return deepFreeze({ schema: 'sdo.owner_termination_evidence.v1', decision: 'TERMINATED',
    transactionId: transaction.transactionId, ownerProcess: transaction.lock.ownerProcess,
    lockId: transaction.lock.lockId, verifierId: raw.verifierId,
    fingerprint: crypto.createHash('sha256').update(JSON.stringify({
      transactionId: transaction.transactionId, ownerProcess: transaction.lock.ownerProcess,
      lockId: transaction.lock.lockId, verifierId: raw.verifierId
    })).digest('hex') });
}

function createMutationRecoveryAdapter({ journalAdapter, lockAdapter = defaultLock,
  authoritativeClock, ownerTerminationPort,
  durabilityAdapter = defaultFilesystemDurabilityAdapter } = {}) {
  if (!journalAdapter || typeof journalAdapter.reopen !== 'function' ||
      typeof journalAdapter.append !== 'function' || !authoritativeClock ||
      typeof authoritativeClock.observe !== 'function') {
    throw new Error('Trusted journal and authoritative clock ports are required for recovery.');
  }

  function recover({ transaction }) {
    const reopened = journalAdapter.reopen(transaction);
    let current = reopened.transaction;
    const physical = filesystemPatch.inspectMutationTarget({ transaction: current });
    let lock = lockAdapter.inspectMutationLock({ transaction: current });
    if (lock.classification === 'MATCHED' && current.lock &&
        lock.lock.ownerToken !== current.lock.ownerToken) {
      lock = deepFreeze({ classification: 'CORRUPT', lock: null });
    }
    const observation = authoritativeClock.observe();
    if (lock.classification !== 'MATCHED') return classifyMutationRecovery({
      journal: reopened, physical, lock, authoritativeObservation: observation });
    const termination = terminationEvidence(ownerTerminationPort, current);
    if (!termination) return classifyMutationRecovery({ journal: reopened, physical,
      lock: deepFreeze({ classification: 'AMBIGUOUS_OWNER' }),
      authoritativeObservation: observation });
    const preliminary = classifyMutationRecovery({ journal: reopened, physical, lock,
      authoritativeObservation: observation });
    const ownership = lockAdapter.acquireMutationRecoveryClaim({ transaction: current,
      terminationEvidence: termination, durabilityAdapter });
    if (ownership.decision !== 'ACQUIRED') return classifyMutationRecovery({
      journal: reopened, physical, lock: deepFreeze({ classification: 'AMBIGUOUS_OWNER' }),
      authoritativeObservation: observation });
    try {
      if (['FINALIZED_SUCCESS', 'FINALIZED_FAILED', 'RECOVERY_UNRESOLVED'].includes(current.stage)) {
        if (current.stage !== 'RECOVERY_UNRESOLVED') {
          lockAdapter.releaseMutationLock({ transaction: current, lock: current.lock,
            durabilityAdapter });
        }
        return preliminary;
      }
      if (!['RECOVERY_REQUIRED', 'RECOVERED'].includes(current.stage)) {
        current = transitionMutationTransaction(current, 'RECOVERY_REQUIRED');
        journalAdapter.append(current);
      }
      if (current.stage === 'RECOVERY_REQUIRED') {
        const resolved = bindMutationRecoveryEvidence(current, preliminary);
        journalAdapter.append(resolved);
        current = resolved;
      }
      if (current.stage === 'RECOVERED') {
        current = transitionMutationTransaction(current, 'EVIDENCE_RECORDED');
        journalAdapter.append(current);
        current = transitionMutationTransaction(current, preliminary.terminalStage);
        journalAdapter.append(current);
        lockAdapter.releaseMutationLock({ transaction: current, lock: current.lock,
          durabilityAdapter });
      }
      return preliminary;
    } finally {
      lockAdapter.releaseMutationRecoveryClaim({ transaction: current, claim: ownership.claim,
        durabilityAdapter });
    }
  }

  return deepFreeze({ recover });
}

module.exports = { createMutationRecoveryAdapter };
