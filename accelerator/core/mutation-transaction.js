'use strict';

const crypto = require('node:crypto');
const path = require('node:path');

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

const TRANSITIONS = Object.freeze({
  PREPARED: new Set(['LOCKED', 'FINALIZED_FAILED']),
  LOCKED: new Set(['BEFORE_VERIFIED', 'FINALIZED_FAILED']),
  BEFORE_VERIFIED: new Set(['MUTATION_STARTED', 'FINALIZED_FAILED']),
  MUTATION_STARTED: new Set(['PHYSICAL_APPLIED', 'RECOVERY_REQUIRED']),
  PHYSICAL_APPLIED: new Set(['AFTER_VERIFIED', 'RECOVERY_REQUIRED']),
  AFTER_VERIFIED: new Set(['EVIDENCE_RECORDED', 'RECOVERY_REQUIRED']),
  EVIDENCE_RECORDED: new Set(['FINALIZED_SUCCESS', 'FINALIZED_FAILED']),
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

function createMutationTransaction(input) {
  const definition = normalizeDefinition(input);
  const identity = identityFor(definition);
  return deepFreeze({
    schema: SCHEMA,
    version: 1,
    ...identity,
    ...definition,
    stage: 'PREPARED',
    history: [{ sequence: 1, stage: 'PREPARED' }]
  });
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
    if (Object.keys(event).length !== 2 || event.sequence !== index + 1 ||
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
  return transaction;
}

function transitionMutationTransaction(transaction, nextStage) {
  const current = requireTransaction(transaction);
  if (!STAGES.includes(nextStage)) throw new Error('Unknown mutation transaction stage.');
  if (TERMINAL.has(current.stage)) throw new Error('Terminal mutation transaction cannot transition.');
  if (nextStage === current.stage) throw new Error('Repeated mutation transaction stage is forbidden.');
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
  createMutationTransaction,
  transitionMutationTransaction,
  assertSameMutationTransaction
};
