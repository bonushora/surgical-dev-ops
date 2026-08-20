'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  canonicalizeAuthorizedRoot,
  resolveInspectedFile
} = require('../core/workspace-boundary');
const { deriveCapabilityGrantFingerprint } = require('../core/capability-grant');
const { evaluateMutationAuthority } = require('../core/authoritative-clock');
const { defaultFilesystemDurabilityAdapter } = require('./filesystem-durability-adapter');
const { requireDurabilityReceipt, durabilityClaims } = require('../core/mutation-durability');

const MAX_BYTES = 1024 * 1024;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isDeepFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  seen.add(value);
  return Object.values(value).every((child) => isDeepFrozen(child, seen));
}

function hash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

function requireTimestamp(value, name) {
  const result = requireText(value, name);
  const parsed = Date.parse(result);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== result) {
    throw new Error(`${name} must be a canonical ISO timestamp.`);
  }
  return result;
}

function validateGrant(evaluation) {
  if (!evaluation || evaluation.schema !== 'sdo.capability_grant_evaluation.v1' ||
      evaluation.decision !== 'ALLOWED' || !evaluation.grant || !isDeepFrozen(evaluation)) {
    throw new Error('A valid immutable ALLOWED capability grant is required.');
  }
  const grant = evaluation.grant;
  const target = grant.scope && grant.scope.target;
  if (grant.capabilityType !== 'FILESYSTEM_PATCH' || grant.policyDecision !== 'ALLOWED' ||
      grant.underlyingPolicyDecision !== 'APPROVAL_REQUIRED' || grant.riskLevel !== 'R3' ||
      !/^[a-f0-9]{64}$/.test(grant.approvalAuthorityFingerprint || '') ||
      !/^[a-f0-9]{64}$/.test(grant.verifiedIdentityAssertionFingerprint || '') ||
      !/^[a-f0-9]{64}$/.test(grant.identityVerificationEvidenceFingerprint || '') ||
      !/^[a-f0-9]{64}$/.test(grant.fingerprint || '') ||
      deriveCapabilityGrantFingerprint(grant) !== grant.fingerprint ||
      !grant.temporalAuthority ||
      grant.lifecycleState !== 'PENDING' ||
      grant.idempotency !== 'IDEMPOTENT' || !target ||
      typeof target.path !== 'string' || !target.path ||
      typeof target.canonicalPath !== 'string' ||
      !/^[a-f0-9]{64}$/.test(target.beforeSha256) ||
      !/^[a-f0-9]{64}$/.test(target.replacementSha256)) {
    throw new Error('Capability grant does not permit a bounded single-file patch.');
  }
  return grant;
}

function readRegularNoFollow(target) {
  if (typeof fs.constants.O_NOFOLLOW !== 'number') {
    throw new Error('Platform cannot guarantee no-follow filesystem access.');
  }
  let descriptor;
  try {
    descriptor = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const stat = fs.fstatSync(descriptor, { bigint: true });
    if (!stat.isFile()) throw new Error('Target is not a regular file.');
    if (stat.size > BigInt(MAX_BYTES)) throw new Error('Target exceeds the bounded patch size.');
    const content = fs.readFileSync(descriptor);
    return { content, stat };
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

function writeTemporary(directory, mode, content, durabilityAdapter) {
  const temporary = path.join(directory, `.sdo-patch-${crypto.randomUUID()}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(
      temporary,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,
      mode & 0o777
    );
    fs.writeFileSync(descriptor, content);
    const flushed = durabilityAdapter.flushFile(descriptor, `replacement-temp:${temporary}`);
    requireDurabilityReceipt(flushed, 'FLUSH_FILE_DATA');
    fs.closeSync(descriptor);
    descriptor = undefined;
    return temporary;
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
}

function atomicReplace(target, content, mode, durabilityAdapter) {
  const temporary = writeTemporary(path.dirname(target), mode, content, durabilityAdapter);
  const verified = readRegularNoFollow(temporary);
  if (!verified.content.equals(content)) {
    try { fs.unlinkSync(temporary); } catch {}
    throw new Error('Durably flushed replacement temporary file failed identity verification.');
  }
  try {
    fs.renameSync(temporary, target);
    try {
      const durableRename = durabilityAdapter.confirmRename(path.dirname(target));
      requireDurabilityReceipt(durableRename, 'DURABLE_RENAME_BOUNDARY');
      return deepFreeze({ tempData: 'CONFIRMED', renameBoundary: durableRename,
        claims: durabilityClaims() });
    } catch (error) {
      error.physicalCommitOccurred = true;
      throw error;
    }
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
}

function transactionEvidence(context) {
  const state = context && context.current();
  if (!state || !Object.isFrozen(state.transaction) || !state.journal ||
      state.transaction.transactionId !== state.journal.identity.transactionId ||
      state.transaction.stage !== state.journal.transaction.stage) {
    throw new Error('Mutation transaction/journal context is malformed or inconsistent.');
  }
  return deepFreeze({
    transactionId: state.transaction.transactionId,
    journalId: state.journal.journalId,
    stage: state.transaction.stage,
    lockId: state.transaction.lock && state.transaction.lock.lockId,
    commitAuthorityFingerprint: state.transaction.commitAuthority &&
      state.transaction.commitAuthority.fingerprint,
    classification: state.transaction.stage === 'RECOVERY_REQUIRED'
      ? 'RECOVERY_REQUIRED' : 'IN_PROGRESS'
  });
}

function evidence({ operationId, workspace, requested, canonical, beforeHash, afterHash,
  outcome, recovery, observedAt, temporalAuthority, commitAuthority, transaction,
  durability = null }) {
  return deepFreeze({
    schema: 'sdo.filesystem_patch_result.v1', operationId, workspace,
    target: { requested, canonical }, beforeSha256: beforeHash, afterSha256: afterHash,
    outcome, recovery, observedAt, temporalAuthority, commitAuthority: commitAuthority || null,
    transaction, durability
  });
}

function authorityBounds(grant) {
  const temporal = grant.temporalAuthority;
  return {
    identity: temporal.identity,
    approval: temporal.approval,
    grant: { ...temporal.grant, fingerprint: grant.fingerprint }
  };
}

function observeAuthority(clock, grant, previousReading = null) {
  try {
    return evaluateMutationAuthority(clock, authorityBounds(grant), previousReading);
  } catch {
    return null;
  }
}

function denyBeforeCommit(context, temporalAuthority, reason, transactionContext) {
  const error = new Error(reason);
  if (!temporalAuthority || !temporalAuthority.reading) throw error;
  const reading = temporalAuthority && temporalAuthority.reading;
  error.evidence = evidence({ ...context, afterHash: null, outcome: 'FAILED',
    recovery: 'NOT_STARTED_AUTHORITY_DENIED',
    observedAt: reading ? reading.wallTime : context.observedAt,
    temporalAuthority: deepFreeze({
      schema: 'sdo.mutation_commit_authority.v1',
      commitBoundary: 'IMMEDIATELY_BEFORE_ATOMIC_REPLACEMENT',
      physicalCommit: 'NOT_STARTED',
      decision: 'DENIED',
      evaluation: temporalAuthority
    }),
    transaction: transactionEvidence(transactionContext)
  });
  throw error;
}

function patchFileWithGrant({
  operationId, workspace, target, replacement, grantEvaluation
}, temporalRuntime = {}) {
  const grant = validateGrant(grantEvaluation);
  const normalizedOperationId = requireText(operationId, 'operationId');
  if (normalizedOperationId !== grant.operationId) throw new Error('Capability operationId mismatch.');
  const canonicalWorkspace = canonicalizeAuthorizedRoot(workspace);
  if (canonicalWorkspace !== workspace || canonicalWorkspace !== grant.workspace) {
    throw new Error('Capability workspace mismatch.');
  }
  const transactionContext = temporalRuntime.mutationTransaction;
  const durabilityAdapter = temporalRuntime.durabilityAdapter ||
    defaultFilesystemDurabilityAdapter;
  const initialTransaction = transactionContext && transactionContext.current();
  if (!initialTransaction || initialTransaction.transaction.stage !== 'LOCKED' ||
      !initialTransaction.transaction.lock) {
    throw new Error('Exact-target mutation lock and journaled LOCKED transaction are required.');
  }
  const entryAuthority = observeAuthority(
    temporalRuntime.authoritativeClock, grant, temporalRuntime.previousReading || null
  );
  if (!entryAuthority || entryAuthority.decision !== 'ALLOWED') {
    denyBeforeCommit({ operationId: normalizedOperationId, workspace: canonicalWorkspace,
      requested: target, canonical: grant.scope.target.canonicalPath,
      beforeHash: grant.scope.target.beforeSha256,
      observedAt: entryAuthority && entryAuthority.reading.wallTime }, entryAuthority,
    'Mutation authority is invalid before preparation.', transactionContext);
  }
  const requested = requireText(target, 'target');
  if (Array.isArray(replacement) || !(typeof replacement === 'string' || Buffer.isBuffer(replacement))) {
    throw new Error('Structured replacement content must be a string or Buffer.');
  }
  const replacementBytes = Buffer.from(replacement);
  if (replacementBytes.byteLength > MAX_BYTES) throw new Error('Replacement exceeds the bounded patch size.');
  const replacementHash = hash(replacementBytes);
  if (replacementHash !== grant.scope.target.replacementSha256) {
    throw new Error('Replacement content does not match the exact authorized SHA-256.');
  }

  const resolved = resolveInspectedFile(canonicalWorkspace, requested);
  const lexicalTarget = path.resolve(canonicalWorkspace, requested);
  let lexicalStat;
  try {
    lexicalStat = fs.lstatSync(lexicalTarget);
  } catch {
    throw new Error('Requested target cannot be resolved as an existing file.');
  }
  if (lexicalStat.isSymbolicLink()) {
    throw new Error('Symlink targets are forbidden.');
  }
  if (!lexicalStat.isFile()) {
    throw new Error('Requested target is not a regular file.');
  }
  const authorized = grant.scope.target;
  if (requested !== authorized.path || resolved.canonicalTarget !== authorized.canonicalPath) {
    throw new Error('Requested target is outside the exact authorized capability scope.');
  }
  const before = readRegularNoFollow(resolved.canonicalTarget);
  const beforeHash = hash(before.content);
  const afterHash = replacementHash;
  if (beforeHash !== authorized.beforeSha256) {
    if (beforeHash === afterHash) {
      throw new Error('ALREADY_APPLIED requires a previously FINALIZED_SUCCESS journal.');
    }
    throw new Error('BEFORE hash mismatch; target is stale or conflicting.');
  }

  const checked = readRegularNoFollow(resolved.canonicalTarget);
  if (!sameIdentity(before.stat, checked.stat) || hash(checked.content) !== beforeHash) {
    throw new Error('Target changed concurrently before replacement.');
  }
  transactionContext.advance('BEFORE_VERIFIED');

  const preparationAuthority = observeAuthority(
    temporalRuntime.authoritativeClock, grant, entryAuthority.reading
  );
  const commitContext = { operationId: normalizedOperationId, workspace: canonicalWorkspace,
    requested, canonical: resolved.canonicalTarget, beforeHash,
    observedAt: preparationAuthority && preparationAuthority.reading.wallTime };
  if (!preparationAuthority || preparationAuthority.decision !== 'ALLOWED') {
    denyBeforeCommit(commitContext, preparationAuthority,
      'Mutation authority expired or became anomalous before physical commit.', transactionContext);
  }
  transactionContext.advance('MUTATION_STARTED');
  const commitAuthority = observeAuthority(
    temporalRuntime.authoritativeClock, grant, preparationAuthority.reading
  );
  if (!commitAuthority || commitAuthority.decision !== 'ALLOWED') {
    denyBeforeCommit(commitContext, commitAuthority,
      'Mutation authority expired or became anomalous at physical commit.', transactionContext);
  }
  const commitEvidence = deepFreeze({
    schema: 'sdo.mutation_commit_authority.v1',
    commitBoundary: 'IMMEDIATELY_BEFORE_ATOMIC_REPLACEMENT',
    physicalCommit: 'APPLIED', decision: 'ALLOWED', evaluation: commitAuthority
  });
  const durableCommitAuthority = transactionContext.verifyCommitAuthority({
    policyDecision: grant.policyDecision,
    riskLevel: grant.riskLevel,
    capabilityType: grant.capabilityType,
    action: 'PATCH_FILE',
    scope: grant.scope,
    authoritativeEvaluation: commitAuthority
  });
  const committedTransaction = transactionContext.current();
  if (committedTransaction.transaction.stage !== 'COMMIT_AUTHORITY_VERIFIED' ||
      committedTransaction.transaction.commitAuthority !== durableCommitAuthority ||
      committedTransaction.journal.transaction.stage !== 'COMMIT_AUTHORITY_VERIFIED' ||
      !committedTransaction.journal.transaction.commitAuthority ||
      committedTransaction.journal.transaction.commitAuthority.fingerprint !==
        durableCommitAuthority.fingerprint) {
    throw new Error('Durable commit-authority journal proof is required before replacement.');
  }
  let physicalDurability;
  try {
    physicalDurability = atomicReplace(resolved.canonicalTarget, replacementBytes,
      Number(before.stat.mode), durabilityAdapter);
  } catch (commitError) {
    if (!commitError.physicalCommitOccurred) throw commitError;
    try { transactionContext.requireRecovery(); } catch {}
    const error = new Error(`Physical replacement durability is ambiguous: ${commitError.message}`);
    error.evidence = evidence({ operationId: normalizedOperationId,
      workspace: canonicalWorkspace, requested, canonical: resolved.canonicalTarget,
      beforeHash, afterHash, outcome: 'FAILED',
      recovery: 'RECOVERY_REQUIRED_JOURNAL_AMBIGUITY',
      observedAt: commitAuthority.reading.wallTime, temporalAuthority: commitEvidence,
      commitAuthority: durableCommitAuthority,
      transaction: transactionEvidence(transactionContext),
      durability: deepFreeze({ classification: 'POST_RENAME_AMBIGUOUS',
        claims: durabilityClaims() }) });
    throw error;
  }
  try {
    transactionContext.advance('PHYSICAL_APPLIED');
  } catch (stageError) {
    try { transactionContext.requireRecovery(); } catch {}
    const error = new Error(`Physical mutation applied but PHYSICAL_APPLIED journal failed: ${stageError.message}`);
    error.evidence = evidence({ operationId: normalizedOperationId, workspace: canonicalWorkspace,
      requested, canonical: resolved.canonicalTarget, beforeHash, afterHash,
      outcome: 'FAILED', recovery: 'RECOVERY_REQUIRED_JOURNAL_AMBIGUITY',
      observedAt: commitAuthority.reading.wallTime, temporalAuthority: commitEvidence,
      commitAuthority: durableCommitAuthority,
      transaction: transactionEvidence(transactionContext), durability: physicalDurability });
    throw error;
  }
  let afterResolved;
  let after;
  try {
    afterResolved = resolveInspectedFile(canonicalWorkspace, requested);
    after = readRegularNoFollow(afterResolved.canonicalTarget);
    if (afterResolved.canonicalTarget !== resolved.canonicalTarget ||
        hash(after.content) !== afterHash || !after.content.equals(replacementBytes)) {
      throw new Error('AFTER verification failed.');
    }
  } catch (verificationError) {
    try { transactionContext.requireRecovery(); } catch {}
    let owned = false;
    try {
      const current = readRegularNoFollow(resolved.canonicalTarget);
      owned = hash(current.content) === afterHash && current.content.equals(replacementBytes);
    } catch {}
    if (owned) {
      try {
        atomicReplace(resolved.canonicalTarget, before.content, Number(before.stat.mode),
          durabilityAdapter);
        const restored = readRegularNoFollow(resolved.canonicalTarget);
        if (hash(restored.content) !== beforeHash) throw new Error('Restore verification failed.');
        try { transactionContext.advance('RECOVERED'); } catch {}
        const error = new Error('AFTER verification failed; original content was restored.');
        error.evidence = evidence({ operationId: normalizedOperationId, workspace: canonicalWorkspace,
          requested, canonical: resolved.canonicalTarget, beforeHash, afterHash,
          outcome: 'FAILED', recovery: 'RESTORED',
          observedAt: commitAuthority.reading.wallTime, temporalAuthority: commitEvidence,
          commitAuthority: durableCommitAuthority,
          transaction: transactionEvidence(transactionContext), durability: physicalDurability });
        throw error;
      } catch (restoreError) {
        if (restoreError.evidence) throw restoreError;
      }
    }
    const error = new Error('AFTER verification failed; target ownership is unproven and was not restored.');
    error.evidence = evidence({ operationId: normalizedOperationId, workspace: canonicalWorkspace,
      requested, canonical: resolved.canonicalTarget, beforeHash, afterHash,
      outcome: 'FAILED', recovery: 'NOT_ATTEMPTED_UNPROVEN_OWNERSHIP',
      observedAt: commitAuthority.reading.wallTime, temporalAuthority: commitEvidence,
      commitAuthority: durableCommitAuthority,
      transaction: transactionEvidence(transactionContext), durability: physicalDurability });
    throw error;
  }
  try {
    transactionContext.advance('AFTER_VERIFIED');
  } catch (stageError) {
    try { transactionContext.requireRecovery(); } catch {}
    const error = new Error(`AFTER verified but journal append failed: ${stageError.message}`);
    error.evidence = evidence({ operationId: normalizedOperationId, workspace: canonicalWorkspace,
      requested, canonical: resolved.canonicalTarget, beforeHash, afterHash,
      outcome: 'FAILED', recovery: 'RECOVERY_REQUIRED_JOURNAL_AMBIGUITY',
      observedAt: commitAuthority.reading.wallTime, temporalAuthority: commitEvidence,
      commitAuthority: durableCommitAuthority,
      transaction: transactionEvidence(transactionContext), durability: physicalDurability });
    throw error;
  }
  return evidence({ operationId: normalizedOperationId, workspace: canonicalWorkspace,
    requested, canonical: resolved.canonicalTarget, beforeHash, afterHash,
    outcome: 'APPLIED', recovery: 'NOT_REQUIRED',
    observedAt: commitAuthority.reading.wallTime, temporalAuthority: commitEvidence,
    commitAuthority: durableCommitAuthority,
    transaction: transactionEvidence(transactionContext), durability: physicalDurability });
}

function verifyAppliedFile({ workspace, target, expectedSha256 }) {
  const canonicalWorkspace = canonicalizeAuthorizedRoot(workspace);
  if (canonicalWorkspace !== workspace || !/^[a-f0-9]{64}$/.test(expectedSha256 || '')) {
    throw new Error('Completed mutation verification input is malformed.');
  }
  const resolved = resolveInspectedFile(canonicalWorkspace, requireText(target, 'target'));
  const current = readRegularNoFollow(resolved.canonicalTarget);
  const currentSha256 = hash(current.content);
  return deepFreeze({
    schema: 'sdo.filesystem_patch_replay_verification.v1',
    workspace: canonicalWorkspace,
    target: resolved.canonicalTarget,
    expectedSha256,
    currentSha256,
    decision: currentSha256 === expectedSha256 ? 'PROVEN_APPLIED' : 'CONFLICT'
  });
}

function inspectMutationTarget({ transaction }) {
  if (!transaction || !Object.isFrozen(transaction) ||
      !/^[a-f0-9]{64}$/.test(transaction.transactionId || '')) {
    throw new Error('Immutable mutation transaction is required for physical recovery inspection.');
  }
  try {
    const relativeTarget = path.relative(transaction.workspace, transaction.target);
    const resolved = resolveInspectedFile(transaction.workspace, relativeTarget);
    const current = readRegularNoFollow(resolved.canonicalTarget);
    const sha256 = hash(current.content);
    return deepFreeze({ schema: 'sdo.mutation_recovery_physical_observation.v1',
      transactionId: transaction.transactionId, workspace: transaction.workspace,
      target: transaction.target, sha256,
      classification: sha256 === transaction.beforeSha256 ? 'BEFORE'
        : sha256 === transaction.replacementSha256 ? 'REPLACEMENT' : 'OTHER' });
  } catch (error) {
    return deepFreeze({ schema: 'sdo.mutation_recovery_physical_observation.v1',
      transactionId: transaction.transactionId, workspace: transaction.workspace,
      target: transaction.target, sha256: null, classification: 'UNAVAILABLE',
      reason: error.message });
  }
}

module.exports = { patchFileWithGrant, verifyAppliedFile, inspectMutationTarget };
