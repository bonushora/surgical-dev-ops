'use strict';

const crypto = require('node:crypto');

const HASH = /^[a-f0-9]{64}$/;
const PRE_COMMIT = new Set(['PREPARED', 'LOCKED', 'BEFORE_VERIFIED', 'MUTATION_STARTED']);
const POST_COMMIT = new Set([
  'PHYSICAL_APPLIED', 'AFTER_VERIFIED', 'EVIDENCE_RECORDED', 'FINALIZED_SUCCESS'
]);

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(
    (key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function fingerprint(fields) {
  return crypto.createHash('sha256')
    .update(`sdo.mutation_recovery_evidence.v1\0${canonicalJson(fields)}`).digest('hex');
}

function classifyMutationRecovery({ journal, physical, lock, authoritativeObservation }) {
  const transaction = journal && journal.transaction;
  if (!journal || !transaction || !Object.isFrozen(journal) ||
      journal.identity.transactionId !== transaction.transactionId ||
      !physical || physical.transactionId !== transaction.transactionId ||
      physical.workspace !== transaction.workspace || physical.target !== transaction.target ||
      !['BEFORE', 'REPLACEMENT', 'OTHER', 'UNAVAILABLE'].includes(physical.classification) ||
      !lock || !['MATCHED', 'MISSING', 'CORRUPT', 'AMBIGUOUS_OWNER'].includes(lock.classification) ||
      !authoritativeObservation || authoritativeObservation.decision !== 'ALLOWED' ||
      !Object.isFrozen(authoritativeObservation)) {
    throw new Error('Recovery inputs are missing, mutable, or inconsistently bound.');
  }
  const commit = transaction.commitAuthority;
  const commitProven = Boolean(commit && HASH.test(commit.fingerprint || '') &&
    commit.transactionId === transaction.transactionId && commit.target === transaction.target &&
    commit.beforeSha256 === transaction.beforeSha256 &&
    commit.replacementSha256 === transaction.replacementSha256);
  let classification = 'RECOVERY_UNRESOLVED';
  let terminalStage = 'RECOVERY_UNRESOLVED';
  let outcome = 'FAILED';
  if (lock.classification === 'MATCHED') {
    if (physical.classification === 'BEFORE' && PRE_COMMIT.has(transaction.stage)) {
      classification = 'NOT_APPLIED';
      terminalStage = 'FINALIZED_FAILED';
    } else if (physical.classification === 'BEFORE' && transaction.stage === 'RECOVERED') {
      classification = 'RESTORED';
      terminalStage = 'FINALIZED_FAILED';
    } else if (physical.classification === 'REPLACEMENT' && commitProven &&
        (transaction.stage === 'COMMIT_AUTHORITY_VERIFIED' ||
         POST_COMMIT.has(transaction.stage) || transaction.stage === 'RECOVERY_REQUIRED' ||
         transaction.stage === 'RECOVERED')) {
      classification = 'PREVIOUSLY_AUTHORIZED_APPLIED';
      terminalStage = 'FINALIZED_SUCCESS';
      outcome = 'SUCCESS';
    }
  }
  const fields = {
    schema: 'sdo.mutation_recovery_evidence.v1', version: 1,
    transactionId: transaction.transactionId, operationId: transaction.operationId,
    journalId: journal.journalId, workspace: transaction.workspace, target: transaction.target,
    beforeSha256: transaction.beforeSha256, replacementSha256: transaction.replacementSha256,
    verifiedIdentityAssertionFingerprint: transaction.verifiedIdentityAssertionFingerprint,
    approvalAuthorityFingerprint: transaction.approvalAuthorityFingerprint,
    grantFingerprint: transaction.grantFingerprint,
    commitAuthorityFingerprint: commitProven ? commit.fingerprint : null,
    previousJournalStage: transaction.stage, observedHash: physical.sha256,
    physicalClassification: physical.classification, lockClassification: lock.classification,
    recoveryClassification: classification, terminalStage, outcome,
    finalRecoveryState: terminalStage,
    lockDisposition: terminalStage === 'RECOVERY_UNRESOLVED' ? 'RETAINED' : 'RELEASED',
    authoritativeObservation
  };
  return deepFreeze({ ...fields, fingerprint: fingerprint(fields) });
}

function deriveMutationRecoveryFingerprint(evidence) {
  const { fingerprint: ignored, ...fields } = evidence;
  return fingerprint(fields);
}

module.exports = { classifyMutationRecovery, deriveMutationRecoveryFingerprint };
