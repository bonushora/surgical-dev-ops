'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { classifyMutationAuthority } = require('./authoritative-clock');
const { deriveMutationRecoveryFingerprint } = require('./mutation-recovery');

const SCHEMA = 'sdo.mutation_transaction.v1';
const HASH = /^[a-f0-9]{64}$/;
const TEXT = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/;
const INPUT_FIELDS = new Set([
  'operationId', 'workspace', 'target', 'beforeSha256', 'replacementSha256',
  'grantFingerprint', 'approvalAuthorityFingerprint',
  'verifiedIdentityAssertionFingerprint', 'idempotencyKey'
]);

const STAGES = Object.freeze([
  'PREPARED',
  'LOCKED',
  'BEFORE_VERIFIED',
  'MUTATION_STARTED',
  'COMMIT_AUTHORITY_VERIFIED',
  'PHYSICAL_APPLIED',
  'AFTER_VERIFIED',
  'EVIDENCE_RECORDED',
  'FINALIZED_SUCCESS',
  'FINALIZED_FAILED',
  'RECOVERY_REQUIRED',
  'RECOVERED',
  'RECOVERY_UNRESOLVED'
]);

const TERMINAL = new Set([
  'FINALIZED_SUCCESS', 'FINALIZED_FAILED', 'RECOVERY_UNRESOLVED'
]);

const LOCK_FIELDS = new Set([
  'schema', 'adapter', 'version', 'lockId', 'transactionId', 'operationId',
  'workspace', 'target', 'ownerToken', 'ownerProcess', 'acquiredAt'
]);

const TRANSITIONS = Object.freeze({
  PREPARED: new Set(['LOCKED', 'FINALIZED_FAILED', 'RECOVERY_REQUIRED']),
  LOCKED: new Set(['BEFORE_VERIFIED', 'FINALIZED_FAILED', 'RECOVERY_REQUIRED']),
  BEFORE_VERIFIED: new Set(['MUTATION_STARTED', 'FINALIZED_FAILED', 'RECOVERY_REQUIRED']),
  MUTATION_STARTED: new Set(['COMMIT_AUTHORITY_VERIFIED', 'FINALIZED_FAILED', 'RECOVERY_REQUIRED']),
  COMMIT_AUTHORITY_VERIFIED: new Set(['PHYSICAL_APPLIED', 'FINALIZED_FAILED', 'RECOVERY_REQUIRED']),
  PHYSICAL_APPLIED: new Set(['AFTER_VERIFIED', 'RECOVERY_REQUIRED']),
  AFTER_VERIFIED: new Set(['EVIDENCE_RECORDED', 'RECOVERY_REQUIRED']),
  EVIDENCE_RECORDED: new Set(['FINALIZED_SUCCESS', 'FINALIZED_FAILED', 'RECOVERY_REQUIRED']),
  RECOVERY_REQUIRED: new Set(['RECOVERED', 'RECOVERY_UNRESOLVED']),
  RECOVERED: new Set(['EVIDENCE_RECORDED'])
});

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${label} must be an unambiguous plain object.`);
  }
  return value;
}

function exactInput(input) {
  requireObject(input, 'Mutation transaction definition');
  const keys = Object.keys(input);
  if (keys.length !== INPUT_FIELDS.size || keys.some((key) => !INPUT_FIELDS.has(key))) {
    throw new Error('Mutation transaction definition has missing or unknown fields.');
  }
}

function requireText(value, label) {
  if (typeof value !== 'string' || !TEXT.test(value)) {
    throw new Error(`${label} is missing or malformed.`);
  }
  return value;
}

function requireHash(value, label) {
  if (typeof value !== 'string' || !HASH.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  }
  return value;
}

function requireCanonicalAbsolute(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0') ||
      !path.isAbsolute(value) || path.normalize(value) !== value ||
      (value.length > path.parse(value).root.length && value.endsWith(path.sep))) {
    throw new Error(`${label} must be a canonical absolute path.`);
  }
  return value;
}

function requireContainedTarget(workspace, target) {
  const relative = path.relative(workspace, target);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)) {
    throw new Error('Physical target must be an exact canonical path inside the workspace.');
  }
  return target;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(label, value) {
  return crypto.createHash('sha256').update(`${label}\0${canonicalJson(value)}`).digest('hex');
}

function commitAuthorityFingerprint(value) {
  return digest('sdo.mutation_commit_authority_evidence.v1', value);
}

function deriveCommitAuthorityEvidenceFingerprint(evidence) {
  requireObject(evidence, 'Commit-authority evidence');
  if (Object.prototype.hasOwnProperty.call(evidence, 'fingerprint')) {
    const { fingerprint, ...fields } = evidence;
    return commitAuthorityFingerprint(fields);
  }
  return commitAuthorityFingerprint(evidence);
}

function normalizeDefinition(input) {
  exactInput(input);
  const workspace = requireCanonicalAbsolute(input.workspace, 'Workspace');
  const target = requireContainedTarget(
    workspace,
    requireCanonicalAbsolute(input.target, 'Physical target')
  );
  return {
    operationId: requireText(input.operationId, 'operationId'),
    workspace,
    target,
    beforeSha256: requireHash(input.beforeSha256, 'BEFORE hash'),
    replacementSha256: requireHash(input.replacementSha256, 'Replacement hash'),
    grantFingerprint: requireHash(input.grantFingerprint, 'Grant fingerprint'),
    approvalAuthorityFingerprint: requireHash(
      input.approvalAuthorityFingerprint,
      'Approval-authority fingerprint'
    ),
    verifiedIdentityAssertionFingerprint: requireHash(
      input.verifiedIdentityAssertionFingerprint,
      'Verified-human-identity fingerprint'
    ),
    idempotencyKey: requireText(input.idempotencyKey, 'Idempotency key')
  };
}

function identityFor(definition) {
  const replayIdentity = digest('sdo.mutation_replay.v1', definition);
  const transactionId = digest('sdo.mutation_transaction.v1', {
    ...definition,
    replayIdentity
  });
  return { transactionId, replayIdentity };
}

function deriveMutationLockId(workspace, target) {
  const canonicalWorkspace = requireCanonicalAbsolute(workspace, 'Workspace');
  const canonicalTarget = requireContainedTarget(
    canonicalWorkspace,
    requireCanonicalAbsolute(target, 'Physical target')
  );
  return digest('sdo.mutation_target_lock.v1', {
    workspace: canonicalWorkspace,
    target: canonicalTarget
  });
}

function createMutationTransaction(input) {
  const definition = normalizeDefinition(input);
  const identity = identityFor(definition);
  return deepFreeze({
    schema: SCHEMA,
    version: 1,
    ...identity,
    ...definition,
    stage: 'PREPARED',
    lock: null,
    commitAuthority: null,
    recoveryEvidence: null,
    history: [{ sequence: 1, stage: 'PREPARED' }]
  });
}

function requireLockMetadata(transaction, lock) {
  requireObject(lock, 'Mutation lock metadata');
  const keys = Object.keys(lock);
  if (keys.length !== LOCK_FIELDS.size || keys.some((key) => !LOCK_FIELDS.has(key)) ||
      lock.schema !== 'sdo.mutation_lock.v1' || lock.adapter !== 'FILESYSTEM_EXCLUSIVE_CREATE' ||
      lock.version !== 1 || lock.transactionId !== transaction.transactionId ||
      lock.operationId !== transaction.operationId || lock.workspace !== transaction.workspace ||
      lock.target !== transaction.target ||
      lock.lockId !== deriveMutationLockId(transaction.workspace, transaction.target) ||
      typeof lock.ownerToken !== 'string' ||
      !/^[a-f0-9]{32,128}$/.test(lock.ownerToken) ||
      typeof lock.ownerProcess !== 'string' || !lock.ownerProcess ||
      typeof lock.acquiredAt !== 'string' ||
      !Number.isFinite(Date.parse(lock.acquiredAt)) ||
      new Date(Date.parse(lock.acquiredAt)).toISOString() !== lock.acquiredAt ||
      !Object.isFrozen(lock)) {
    throw new Error('Mutation lock metadata is malformed or mismatched.');
  }
  return lock;
}

function expectedIdentity(transaction) {
  return identityFor({
    operationId: transaction.operationId,
    workspace: transaction.workspace,
    target: transaction.target,
    beforeSha256: transaction.beforeSha256,
    replacementSha256: transaction.replacementSha256,
    grantFingerprint: transaction.grantFingerprint,
    approvalAuthorityFingerprint: transaction.approvalAuthorityFingerprint,
    verifiedIdentityAssertionFingerprint: transaction.verifiedIdentityAssertionFingerprint,
    idempotencyKey: transaction.idempotencyKey
  });
}

function requireTransaction(transaction) {
  requireObject(transaction, 'Mutation transaction');
  const identity = expectedIdentity(transaction);
  if (transaction.schema !== SCHEMA || !Number.isInteger(transaction.version) ||
      transaction.version < 1 || transaction.transactionId !== identity.transactionId ||
      transaction.replayIdentity !== identity.replayIdentity ||
      !STAGES.includes(transaction.stage) || !Array.isArray(transaction.history) ||
      transaction.history.length !== transaction.version || !Object.isFrozen(transaction)) {
    throw new Error('Mutation transaction is malformed or has conflicting identity.');
  }
  let previous = null;
  for (let index = 0; index < transaction.history.length; index += 1) {
    const event = transaction.history[index];
    requireObject(event, 'Transaction history event');
    const eventKeys = Object.keys(event);
    const lockedEvent = event.stage === 'LOCKED' && eventKeys.length === 3 &&
      transaction.lock && event.lockId === transaction.lock.lockId;
    const authorityEvent = event.stage === 'COMMIT_AUTHORITY_VERIFIED' &&
      eventKeys.length === 3 && transaction.commitAuthority &&
      event.commitAuthorityFingerprint === transaction.commitAuthority.fingerprint;
    const recoveryEvent = ['RECOVERED', 'RECOVERY_UNRESOLVED'].includes(event.stage) &&
      eventKeys.length === 3 && transaction.recoveryEvidence &&
      event.recoveryEvidenceFingerprint === transaction.recoveryEvidence.fingerprint;
    if ((!lockedEvent && !authorityEvent && !recoveryEvent && eventKeys.length !== 2) ||
        event.sequence !== index + 1 ||
        !STAGES.includes(event.stage) || !Object.isFrozen(event) ||
        (index === 0 && event.stage !== 'PREPARED') ||
        (index > 0 && !(TRANSITIONS[previous] || new Set()).has(event.stage))) {
      throw new Error('Mutation transaction history is malformed or out of order.');
    }
    previous = event.stage;
  }
  if (previous !== transaction.stage) {
    throw new Error('Mutation transaction stage conflicts with its history.');
  }
  const hasLockStage = transaction.history.some((event) => event.stage === 'LOCKED');
  if (!hasLockStage) {
    if (transaction.lock !== null) throw new Error('Pre-lock transaction cannot carry a lock.');
  } else {
    requireLockMetadata(transaction, transaction.lock);
  }
  const authorityEvent = transaction.history.find(
    (event) => event.stage === 'COMMIT_AUTHORITY_VERIFIED'
  );
  if (!authorityEvent) {
    if (transaction.commitAuthority !== null) {
      throw new Error('Pre-commit transaction cannot carry commit-authority evidence.');
    }
  } else {
    requireCommitAuthorityEvidence(transaction, transaction.commitAuthority);
    if (authorityEvent.commitAuthorityFingerprint !== transaction.commitAuthority.fingerprint) {
      throw new Error('Commit-authority history binding is malformed.');
    }
  }
  const recoveryEvent = transaction.history.find(
    (event) => ['RECOVERED', 'RECOVERY_UNRESOLVED'].includes(event.stage)
  );
  if (!recoveryEvent) {
    if (transaction.recoveryEvidence !== null) {
      throw new Error('Transaction cannot carry unjournaled recovery evidence.');
    }
  } else if (transaction.recoveryEvidence !== null && (
      transaction.recoveryEvidence.transactionId !== transaction.transactionId ||
      transaction.recoveryEvidence.operationId !== transaction.operationId ||
      transaction.recoveryEvidence.workspace !== transaction.workspace ||
      transaction.recoveryEvidence.target !== transaction.target ||
      deriveMutationRecoveryFingerprint(transaction.recoveryEvidence) !==
        transaction.recoveryEvidence.fingerprint || !Object.isFrozen(transaction.recoveryEvidence))) {
    throw new Error('Mutation recovery evidence is malformed or mismatched.');
  }
  return transaction;
}

function requireCommitAuthorityEvidence(transaction, evidence) {
  requireObject(evidence, 'Commit-authority evidence');
  const { fingerprint, ...fields } = evidence;
  const target = fields.scope && fields.scope.target;
  const evaluation = fields.authoritativeEvaluation;
  const bounds = evaluation && evaluation.bounds;
  let authoritativeFingerprintValid = false;
  try {
    const progression = deepFreeze({ ...evaluation.progression, reading: evaluation.reading });
    authoritativeFingerprintValid = classifyMutationAuthority(
      evaluation.reading, evaluation.bounds, progression
    ).fingerprint === evaluation.fingerprint;
  } catch {}
  if (evidence.schema !== 'sdo.mutation_commit_authority_evidence.v1' ||
      evidence.version !== 1 || !Object.isFrozen(evidence) ||
      evidence.transactionId !== transaction.transactionId ||
      evidence.operationId !== transaction.operationId ||
      evidence.workspace !== transaction.workspace || evidence.target !== transaction.target ||
      evidence.beforeSha256 !== transaction.beforeSha256 ||
      evidence.replacementSha256 !== transaction.replacementSha256 ||
      evidence.grantFingerprint !== transaction.grantFingerprint ||
      evidence.approvalAuthorityFingerprint !== transaction.approvalAuthorityFingerprint ||
      evidence.verifiedIdentityAssertionFingerprint !==
        transaction.verifiedIdentityAssertionFingerprint ||
      evidence.policyDecision !== 'ALLOWED' || evidence.riskLevel !== 'R3' ||
      evidence.capabilityType !== 'FILESYSTEM_PATCH' || evidence.action !== 'PATCH_FILE' ||
      !target || target.canonicalPath !== transaction.target ||
      target.beforeSha256 !== transaction.beforeSha256 ||
      target.replacementSha256 !== transaction.replacementSha256 ||
      !evaluation || evaluation.schema !== 'sdo.mutation_authority_time_evidence.v1' ||
      evaluation.decision !== 'ALLOWED' || !authoritativeFingerprintValid || !bounds ||
      bounds.identity.fingerprint !== transaction.verifiedIdentityAssertionFingerprint ||
      bounds.approval.fingerprint !== transaction.approvalAuthorityFingerprint ||
      bounds.grant.fingerprint !== transaction.grantFingerprint ||
      canonicalJson(evidence.identityValidity) !== canonicalJson(bounds.identity) ||
      canonicalJson(evidence.approvalValidity) !== canonicalJson(bounds.approval) ||
      canonicalJson(evidence.grantValidity) !== canonicalJson(bounds.grant) ||
      canonicalJson(evidence.authoritativeReading) !== canonicalJson(evaluation.reading) ||
      !/^[a-f0-9]{64}$/.test(fingerprint || '') ||
      commitAuthorityFingerprint(fields) !== fingerprint) {
    throw new Error('Commit-authority evidence is malformed, altered, or mismatched.');
  }
  return evidence;
}

function createCommitAuthorityEvidence(transaction, input) {
  const current = requireTransaction(transaction);
  if (current.stage !== 'MUTATION_STARTED' || current.commitAuthority !== null) {
    throw new Error('Commit authority may bind only at MUTATION_STARTED.');
  }
  requireObject(input, 'Commit-authority evidence input');
  const evaluation = input.authoritativeEvaluation;
  const bounds = evaluation && evaluation.bounds;
  const fields = {
    schema: 'sdo.mutation_commit_authority_evidence.v1', version: 1,
    transactionId: current.transactionId, operationId: current.operationId,
    workspace: current.workspace, target: current.target,
    beforeSha256: current.beforeSha256, replacementSha256: current.replacementSha256,
    verifiedIdentityAssertionFingerprint: current.verifiedIdentityAssertionFingerprint,
    approvalAuthorityFingerprint: current.approvalAuthorityFingerprint,
    grantFingerprint: current.grantFingerprint,
    policyDecision: input.policyDecision, riskLevel: input.riskLevel,
    capabilityType: input.capabilityType, action: input.action, scope: input.scope,
    identityValidity: bounds && bounds.identity,
    approvalValidity: bounds && bounds.approval,
    grantValidity: bounds && bounds.grant,
    authoritativeReading: evaluation && evaluation.reading,
    authoritativeEvaluation: evaluation
  };
  const evidence = deepFreeze({ ...fields, fingerprint: commitAuthorityFingerprint(fields) });
  return requireCommitAuthorityEvidence(current, evidence);
}

function bindCommitAuthorityEvidence(transaction, evidence) {
  const current = requireTransaction(transaction);
  if (current.stage !== 'MUTATION_STARTED') {
    throw new Error('Commit-authority evidence must immediately precede physical commit.');
  }
  const authority = requireCommitAuthorityEvidence(current, evidence);
  const version = current.version + 1;
  return deepFreeze({
    ...current, version, stage: 'COMMIT_AUTHORITY_VERIFIED', commitAuthority: authority,
    history: [...current.history, { sequence: version, stage: 'COMMIT_AUTHORITY_VERIFIED',
      commitAuthorityFingerprint: authority.fingerprint }]
  });
}

function bindMutationRecoveryEvidence(transaction, evidence) {
  const current = requireTransaction(transaction);
  if (current.stage !== 'RECOVERY_REQUIRED' || !evidence || !Object.isFrozen(evidence) ||
      evidence.transactionId !== current.transactionId || evidence.operationId !== current.operationId ||
      evidence.workspace !== current.workspace || evidence.target !== current.target ||
      deriveMutationRecoveryFingerprint(evidence) !== evidence.fingerprint) {
    throw new Error('Recovery evidence may bind only to its exact RECOVERY_REQUIRED transaction.');
  }
  const stage = evidence.recoveryClassification === 'RECOVERY_UNRESOLVED'
    ? 'RECOVERY_UNRESOLVED' : 'RECOVERED';
  const version = current.version + 1;
  return deepFreeze({ ...current, version, stage, recoveryEvidence: evidence,
    history: [...current.history, { sequence: version, stage,
      recoveryEvidenceFingerprint: evidence.fingerprint }] });
}

function bindMutationLock(transaction, lockMetadata) {
  const current = requireTransaction(transaction);
  if (current.stage !== 'PREPARED') {
    throw new Error('Mutation lock may bind only to a PREPARED transaction.');
  }
  const lock = requireLockMetadata(current, lockMetadata);
  return deepFreeze({
    ...current,
    version: 2,
    stage: 'LOCKED',
    lock,
    history: [...current.history, { sequence: 2, stage: 'LOCKED', lockId: lock.lockId }]
  });
}

function transitionMutationTransaction(transaction, nextStage) {
  const current = requireTransaction(transaction);
  if (!STAGES.includes(nextStage)) throw new Error('Unknown mutation transaction stage.');
  if (TERMINAL.has(current.stage)) throw new Error('Terminal mutation transaction cannot transition.');
  if (nextStage === current.stage) throw new Error('Repeated mutation transaction stage is forbidden.');
  if (nextStage === 'LOCKED') {
    throw new Error('LOCKED transition requires immutable lock binding.');
  }
  if (nextStage === 'COMMIT_AUTHORITY_VERIFIED') {
    throw new Error('COMMIT_AUTHORITY_VERIFIED requires immutable authority evidence binding.');
  }
  if (!(TRANSITIONS[current.stage] || new Set()).has(nextStage)) {
    throw new Error('Invalid or skipped mutation transaction stage.');
  }
  const version = current.version + 1;
  return deepFreeze({
    ...current,
    version,
    stage: nextStage,
    history: [...current.history, { sequence: version, stage: nextStage }]
  });
}

function assertSameMutationTransaction(left, right) {
  const first = requireTransaction(left);
  const second = requireTransaction(right);
  if (first.transactionId !== second.transactionId ||
      first.replayIdentity !== second.replayIdentity) {
    throw new Error('Conflicting mutation transaction replay.');
  }
  return true;
}

module.exports = {
  STAGES,
  deriveMutationLockId,
  createMutationTransaction,
  bindMutationLock,
  createCommitAuthorityEvidence,
  bindCommitAuthorityEvidence,
  bindMutationRecoveryEvidence,
  deriveCommitAuthorityEvidenceFingerprint,
  transitionMutationTransaction,
  assertSameMutationTransaction
};
