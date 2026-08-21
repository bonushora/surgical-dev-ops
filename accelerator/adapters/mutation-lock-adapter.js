'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const { openVerifiedRegularRead } =
  require('./filesystem-safe-read-adapter');
const os = require('node:os');
const path = require('node:path');
const { defaultFilesystemDurabilityAdapter } = require('./filesystem-durability-adapter');
const { requireDurabilityReceipt } = require('../core/mutation-durability');

const {
  bindMutationLock,
  deriveMutationLockId
} = require('../core/mutation-transaction');
const {
  canonicalizeAuthorizedRoot,
  resolveInspectedFile
} = require('../core/workspace-boundary');

const LOCK_SCHEMA = 'sdo.mutation_lock.v1';
const ADAPTER = 'FILESYSTEM_EXCLUSIVE_CREATE';
const VERSION = 1;
const LOCK_FIELDS = new Set([
  'schema', 'adapter', 'version', 'lockId', 'transactionId', 'operationId',
  'workspace', 'target', 'ownerToken', 'ownerProcess', 'acquiredAt'
]);

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function userNamespace() {
  const identity = typeof process.getuid === 'function'
    ? `uid:${process.getuid()}`
    : `user:${os.userInfo().username}:${os.homedir()}`;
  return crypto.createHash('sha256').update(identity).digest('hex').slice(0, 24);
}

function lockRoot() {
  const temporaryRoot = fs.realpathSync(os.tmpdir());
  const root = path.join(temporaryRoot, `sdo-mutation-locks-v1-${userNamespace()}`);
  try {
    fs.mkdirSync(root, { mode: 0o700 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(root) !== root) {
    throw new Error('Mutation lock store is ambiguous or unsafe.');
  }
  if (typeof process.getuid === 'function' && stat.uid !== process.getuid()) {
    throw new Error('Mutation lock store is not owned by the current user.');
  }
  return root;
}

function resolveMutationLockIdentity({ workspace, target }) {
  const canonicalWorkspace = canonicalizeAuthorizedRoot(workspace);
  if (canonicalWorkspace !== workspace) {
    throw new Error('Mutation lock workspace must already be canonical.');
  }
  const resolved = resolveInspectedFile(canonicalWorkspace, target);
  const lockId = deriveMutationLockId(canonicalWorkspace, resolved.canonicalTarget);
  return deepFreeze({
    schema: 'sdo.mutation_lock_identity.v1',
    lockId,
    workspace: canonicalWorkspace,
    target: resolved.canonicalTarget
  });
}

function lockPath(lockId) {
  if (typeof lockId !== 'string' || !/^[a-f0-9]{64}$/.test(lockId)) {
    throw new Error('Mutation lock identity is malformed.');
  }
  return path.join(lockRoot(), `${lockId}.lock`);
}

function recoveryClaimPath(lockId) {
  return path.join(lockRoot(), `${lockId}.recovery`);
}

function serialize(metadata) {
  return `${JSON.stringify(metadata)}\n`;
}

function validateMetadata(metadata, expected = null) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) ||
      Object.getPrototypeOf(metadata) !== Object.prototype) {
    throw new Error('Mutation lock record is malformed or corrupt.');
  }
  const keys = Object.keys(metadata);
  if (keys.length !== LOCK_FIELDS.size || keys.some((key) => !LOCK_FIELDS.has(key)) ||
      metadata.schema !== LOCK_SCHEMA || metadata.adapter !== ADAPTER ||
      metadata.version !== VERSION || !/^[a-f0-9]{64}$/.test(metadata.lockId || '') ||
      !/^[a-f0-9]{64}$/.test(metadata.transactionId || '') ||
      typeof metadata.operationId !== 'string' || !metadata.operationId ||
      typeof metadata.workspace !== 'string' || typeof metadata.target !== 'string' ||
      metadata.lockId !== deriveMutationLockId(metadata.workspace, metadata.target) ||
      !/^[a-f0-9]{32,128}$/.test(metadata.ownerToken || '') ||
      typeof metadata.ownerProcess !== 'string' || !metadata.ownerProcess ||
      typeof metadata.acquiredAt !== 'string' ||
      !Number.isFinite(Date.parse(metadata.acquiredAt)) ||
      new Date(Date.parse(metadata.acquiredAt)).toISOString() !== metadata.acquiredAt) {
    throw new Error('Mutation lock record is malformed or corrupt.');
  }
  if (expected && Object.keys(expected).some((key) => metadata[key] !== expected[key])) {
    throw new Error('Mutation lock ownership or transaction binding mismatch.');
  }
  return deepFreeze(metadata);
}

function readLockFile(file) {
  let descriptor;
  try {
    const opened = openVerifiedRegularRead(file, { maxBytes: 8192 });
    descriptor = opened.descriptor;
    const stat = opened.stat;
    if (stat.size < 2n) {
      throw new Error('Mutation lock record is malformed or corrupt.');
    }
    const raw = fs.readFileSync(descriptor, 'utf8');
    let parsed;
    try { parsed = JSON.parse(raw); } catch {
      throw new Error('Mutation lock record is malformed or corrupt.');
    }
    return validateMetadata(parsed);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function acquireMutationLock({ transaction, workspace, target,
  durabilityAdapter = defaultFilesystemDurabilityAdapter }) {
  if (!transaction || transaction.stage !== 'PREPARED') {
    throw new Error('A PREPARED immutable mutation transaction is required.');
  }
  const identity = resolveMutationLockIdentity({ workspace, target });
  if (transaction.workspace !== identity.workspace || transaction.target !== identity.target) {
    throw new Error('Mutation transaction target identity mismatch.');
  }
  const metadata = deepFreeze({
    schema: LOCK_SCHEMA,
    adapter: ADAPTER,
    version: VERSION,
    lockId: identity.lockId,
    transactionId: transaction.transactionId,
    operationId: transaction.operationId,
    workspace: identity.workspace,
    target: identity.target,
    ownerToken: crypto.randomBytes(32).toString('hex'),
    ownerProcess: `${process.pid}:${crypto.randomUUID()}`,
    acquiredAt: new Date().toISOString()
  });
  const file = lockPath(identity.lockId);
  let descriptor;
  try {
    descriptor = fs.openSync(
      file,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
      0o600
    );
    fs.writeFileSync(descriptor, serialize(metadata));
    requireDurabilityReceipt(durabilityAdapter.flushFile(descriptor,
      `mutation-lock:${identity.lockId}`), 'FLUSH_FILE_DATA');
    fs.closeSync(descriptor);
    descriptor = undefined;
    requireDurabilityReceipt(durabilityAdapter.confirmLock(path.dirname(file)),
      'DURABLE_LOCK_BOUNDARY');
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (error.code === 'EEXIST') {
      const owner = readLockFile(file);
      if (owner.lockId !== identity.lockId || owner.workspace !== identity.workspace ||
          owner.target !== identity.target) {
        throw new Error('Mutation lock contention record is mismatched or corrupt.');
      }
      return deepFreeze({
        schema: 'sdo.mutation_lock_result.v1',
        decision: 'CONTENDED',
        lockId: identity.lockId,
        transactionId: transaction.transactionId,
        ownerTransactionId: owner.transactionId,
        reason: 'Exact canonical target is already locked; stale/orphan reclamation is forbidden.'
      });
    }
    try { fs.unlinkSync(file); } catch {}
    throw error;
  }
  const boundTransaction = bindMutationLock(transaction, metadata);
  return deepFreeze({
    schema: 'sdo.mutation_lock_result.v1',
    decision: 'ACQUIRED',
    lock: metadata,
    transaction: boundTransaction
  });
}

function releaseMutationLock({ transaction, lock,
  durabilityAdapter = defaultFilesystemDurabilityAdapter }) {
  if (!transaction || transaction.lock !== lock || !Object.isFrozen(transaction) ||
      !Object.isFrozen(lock)) {
    throw new Error('Release requires the exact immutable bound transaction and lock metadata.');
  }
  const expected = validateMetadata(lock);
  if (transaction.transactionId !== expected.transactionId ||
      transaction.operationId !== expected.operationId ||
      transaction.workspace !== expected.workspace || transaction.target !== expected.target ||
      transaction.lock.lockId !== expected.lockId ||
      transaction.lock.ownerToken !== expected.ownerToken) {
    throw new Error('Mutation lock release ownership mismatch.');
  }
  const file = lockPath(expected.lockId);
  let current;
  try {
    current = readLockFile(file);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return deepFreeze({
        decision: 'NOT_HELD', lockId: expected.lockId,
        reason: 'Lock absence is ambiguous; repeated release cannot prove prior ownership release.'
      });
    }
    throw error;
  }
  validateMetadata(current, expected);
  try {
    fs.unlinkSync(file);
    requireDurabilityReceipt(durabilityAdapter.confirmLock(path.dirname(file)),
      'DURABLE_LOCK_BOUNDARY');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return deepFreeze({
        decision: 'NOT_HELD', lockId: expected.lockId,
        reason: 'Lock disappeared during release; ownership state is ambiguous.'
      });
    }
    throw error;
  }
  return deepFreeze({ decision: 'RELEASED', lockId: expected.lockId });
}

function inspectMutationLock({ transaction }) {
  if (!transaction || !Object.isFrozen(transaction) || !transaction.lock) {
    return deepFreeze({ classification: 'MISSING', lock: null });
  }
  try {
    const lock = readLockFile(lockPath(transaction.lock.lockId));
    validateMetadata(lock, transaction.lock);
    return deepFreeze({ classification: 'MATCHED', lock });
  } catch (error) {
    if (error.code === 'ENOENT') return deepFreeze({ classification: 'MISSING', lock: null });
    return deepFreeze({ classification: 'CORRUPT', lock: null, reason: error.message });
  }
}

function acquireMutationRecoveryClaim({ transaction, terminationEvidence,
  durabilityAdapter = defaultFilesystemDurabilityAdapter }) {
  if (!transaction || !transaction.lock || !Object.isFrozen(transaction) ||
      !terminationEvidence || terminationEvidence.decision !== 'TERMINATED' ||
      terminationEvidence.ownerProcess !== transaction.lock.ownerProcess ||
      !Object.isFrozen(terminationEvidence)) {
    throw new Error('Trusted owner-termination evidence is required for recovery ownership.');
  }
  const file = recoveryClaimPath(transaction.lock.lockId);
  const claim = deepFreeze({ schema: 'sdo.mutation_recovery_claim.v1',
    transactionId: transaction.transactionId, operationId: transaction.operationId,
    lockId: transaction.lock.lockId, ownerToken: crypto.randomBytes(32).toString('hex') });
  let descriptor;
  try {
    descriptor = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT |
      fs.constants.O_EXCL, 0o600);
    fs.writeFileSync(descriptor, serialize(claim));
    requireDurabilityReceipt(durabilityAdapter.flushFile(descriptor,
      `mutation-recovery-claim:${transaction.transactionId}`), 'FLUSH_FILE_DATA');
  } catch (error) {
    if (error.code === 'EEXIST') return deepFreeze({ decision: 'CONTENDED' });
    throw error;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
  requireDurabilityReceipt(durabilityAdapter.confirmLock(path.dirname(file)),
    'DURABLE_LOCK_BOUNDARY');
  return deepFreeze({ decision: 'ACQUIRED', claim });
}

function releaseMutationRecoveryClaim({ transaction, claim,
  durabilityAdapter = defaultFilesystemDurabilityAdapter }) {
  if (!transaction || !claim || claim.transactionId !== transaction.transactionId ||
      claim.lockId !== transaction.lock.lockId) {
    throw new Error('Recovery claim ownership mismatch.');
  }
  const file = recoveryClaimPath(claim.lockId);
  let current;
  try { current = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') return deepFreeze({ decision: 'NOT_HELD' });
    throw new Error('Recovery claim is corrupt or ambiguous.');
  }
  if (JSON.stringify(current) !== JSON.stringify(claim)) {
    throw new Error('Recovery claim ownership mismatch.');
  }
  fs.unlinkSync(file);
  requireDurabilityReceipt(durabilityAdapter.confirmLock(path.dirname(file)),
    'DURABLE_LOCK_BOUNDARY');
  return deepFreeze({ decision: 'RELEASED' });
}

module.exports = {
  resolveMutationLockIdentity,
  acquireMutationLock,
  releaseMutationLock,
  inspectMutationLock,
  acquireMutationRecoveryClaim,
  releaseMutationRecoveryClaim
};
