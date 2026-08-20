'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  canonicalizeAuthorizedRoot,
  resolveInspectedFile
} = require('../core/workspace-boundary');

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
      !['R1', 'R2', 'R3'].includes(grant.riskLevel) || grant.lifecycleState !== 'PENDING' ||
      grant.idempotency !== 'IDEMPOTENT' || !target ||
      typeof target.path !== 'string' || !target.path ||
      typeof target.canonicalPath !== 'string' ||
      !/^[a-f0-9]{64}$/.test(target.beforeSha256)) {
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

function writeTemporary(directory, mode, content) {
  const temporary = path.join(directory, `.sdo-patch-${crypto.randomUUID()}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(
      temporary,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,
      mode & 0o777
    );
    fs.writeFileSync(descriptor, content);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    return temporary;
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
}

function atomicReplace(target, content, mode) {
  const temporary = writeTemporary(path.dirname(target), mode, content);
  try {
    fs.renameSync(temporary, target);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
}

function evidence({ operationId, workspace, requested, canonical, beforeHash, afterHash, outcome, recovery }) {
  return deepFreeze({
    schema: 'sdo.filesystem_patch_result.v1', operationId, workspace,
    target: { requested, canonical }, beforeSha256: beforeHash, afterSha256: afterHash,
    outcome, recovery
  });
}

function patchFileWithGrant({
  operationId, workspace, target, replacement, grantEvaluation, observedAt
}) {
  const grant = validateGrant(grantEvaluation);
  const normalizedOperationId = requireText(operationId, 'operationId');
  if (normalizedOperationId !== grant.operationId) throw new Error('Capability operationId mismatch.');
  const canonicalWorkspace = canonicalizeAuthorizedRoot(workspace);
  if (canonicalWorkspace !== workspace || canonicalWorkspace !== grant.workspace) {
    throw new Error('Capability workspace mismatch.');
  }
  const now = requireTimestamp(observedAt, 'observedAt');
  if (Date.parse(now) >= Date.parse(requireTimestamp(grant.expiresAt, 'grant.expiresAt'))) {
    throw new Error('Capability grant is expired.');
  }
  const requested = requireText(target, 'target');
  if (Array.isArray(replacement) || !(typeof replacement === 'string' || Buffer.isBuffer(replacement))) {
    throw new Error('Structured replacement content must be a string or Buffer.');
  }
  const replacementBytes = Buffer.from(replacement);
  if (replacementBytes.byteLength > MAX_BYTES) throw new Error('Replacement exceeds the bounded patch size.');

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
  const afterHash = hash(replacementBytes);
  if (beforeHash !== authorized.beforeSha256) {
    if (beforeHash === afterHash) {
      return evidence({ operationId: normalizedOperationId, workspace: canonicalWorkspace,
        requested, canonical: resolved.canonicalTarget, beforeHash: authorized.beforeSha256,
        afterHash, outcome: 'ALREADY_APPLIED', recovery: 'NOT_REQUIRED' });
    }
    throw new Error('BEFORE hash mismatch; target is stale or conflicting.');
  }

  const checked = readRegularNoFollow(resolved.canonicalTarget);
  if (!sameIdentity(before.stat, checked.stat) || hash(checked.content) !== beforeHash) {
    throw new Error('Target changed concurrently before replacement.');
  }

  atomicReplace(resolved.canonicalTarget, replacementBytes, Number(before.stat.mode));
  try {
    const afterResolved = resolveInspectedFile(canonicalWorkspace, requested);
    const after = readRegularNoFollow(afterResolved.canonicalTarget);
    if (afterResolved.canonicalTarget !== resolved.canonicalTarget ||
        hash(after.content) !== afterHash || !after.content.equals(replacementBytes)) {
      throw new Error('AFTER verification failed.');
    }
    return evidence({ operationId: normalizedOperationId, workspace: canonicalWorkspace,
      requested, canonical: resolved.canonicalTarget, beforeHash, afterHash,
      outcome: 'APPLIED', recovery: 'NOT_REQUIRED' });
  } catch (verificationError) {
    let owned = false;
    try {
      const current = readRegularNoFollow(resolved.canonicalTarget);
      owned = hash(current.content) === afterHash && current.content.equals(replacementBytes);
    } catch {}
    if (owned) {
      try {
        atomicReplace(resolved.canonicalTarget, before.content, Number(before.stat.mode));
        const restored = readRegularNoFollow(resolved.canonicalTarget);
        if (hash(restored.content) !== beforeHash) throw new Error('Restore verification failed.');
        const error = new Error('AFTER verification failed; original content was restored.');
        error.evidence = evidence({ operationId: normalizedOperationId, workspace: canonicalWorkspace,
          requested, canonical: resolved.canonicalTarget, beforeHash, afterHash,
          outcome: 'FAILED', recovery: 'RESTORED' });
        throw error;
      } catch (restoreError) {
        if (restoreError.evidence) throw restoreError;
      }
    }
    const error = new Error('AFTER verification failed; target ownership is unproven and was not restored.');
    error.evidence = evidence({ operationId: normalizedOperationId, workspace: canonicalWorkspace,
      requested, canonical: resolved.canonicalTarget, beforeHash, afterHash,
      outcome: 'FAILED', recovery: 'NOT_ATTEMPTED_UNPROVEN_OWNERSHIP' });
    throw error;
  }
}

module.exports = { patchFileWithGrant };
