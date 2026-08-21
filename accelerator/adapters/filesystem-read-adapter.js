'use strict';

const crypto = require('crypto');
const fs = require('fs');
const {
  createPathIdentityAuthority,
  canonicalizeAuthorizedRoot,
  resolveInspectedFile
} = require('../core/workspace-boundary');

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

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function requireTimestamp(value, name) {
  const timestamp = requireText(value, name);
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== timestamp) {
    throw new Error(`${name} must be a canonical ISO timestamp.`);
  }
  return timestamp;
}

function validateGrant(evaluation) {
  if (!evaluation || typeof evaluation !== 'object' ||
      evaluation.schema !== 'sdo.capability_grant_evaluation.v1' ||
      evaluation.decision !== 'ALLOWED' || !evaluation.grant ||
      !isDeepFrozen(evaluation)) {
    throw new Error('A valid immutable ALLOWED capability grant is required.');
  }
  const grant = evaluation.grant;
  if (grant.capabilityType !== 'FILESYSTEM_READ' ||
      grant.policyDecision !== 'ALLOWED' ||
      grant.lifecycleState !== 'PENDING' ||
      grant.idempotency !== 'IDEMPOTENT') {
    throw new Error('Capability grant does not permit bounded filesystem read.');
  }
  if (!grant.scope || !Array.isArray(grant.scope.paths) ||
      grant.scope.paths.length === 0) {
    throw new Error('Capability grant scope is missing or malformed.');
  }
  return grant;
}

function readFileWithGrant({
  operationId,
  workspace,
  target,
  grantEvaluation,
  observedAt
}) {
  const grant = validateGrant(grantEvaluation);
  const normalizedOperationId = requireText(operationId, 'operationId');
  if (normalizedOperationId !== grant.operationId) {
    throw new Error('Capability operationId mismatch.');
  }

  const pathIdentity = createPathIdentityAuthority(process.platform);
  if (!pathIdentity.isCanonicalAbsoluteIdentity(workspace)) {
    throw new Error('Capability workspace mismatch.');
  }
  const canonicalWorkspace = canonicalizeAuthorizedRoot(workspace);
  if (canonicalWorkspace !== grant.workspace) {
    throw new Error('Capability workspace mismatch.');
  }

  const observationTime = requireTimestamp(observedAt, 'observedAt');
  const expiresAt = requireTimestamp(grant.expiresAt, 'grant.expiresAt');
  if (Date.parse(observationTime) >= Date.parse(expiresAt)) {
    throw new Error('Capability grant is expired.');
  }

  const requestedTarget = requireText(target, 'target');
  const resolved = resolveInspectedFile(canonicalWorkspace, requestedTarget);
  const authorized = grant.scope.paths.find(
    (entry) => entry && entry.path === requestedTarget
  );
  if (!authorized || authorized.canonicalPath !== resolved.canonicalTarget) {
    throw new Error('Requested target is outside the authorized capability scope.');
  }

  if (typeof fs.constants.O_NOFOLLOW !== 'number') {
    throw new Error('Platform cannot guarantee no-follow filesystem reads.');
  }

  let descriptor;
  let content;
  try {
    descriptor = fs.openSync(
      resolved.canonicalTarget,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW
    );
    if (!fs.fstatSync(descriptor).isFile()) {
      throw new Error('Opened target is not a regular file.');
    }
    content = fs.readFileSync(descriptor);
  } catch {
    throw new Error('Authorized filesystem read failed closed.');
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }

  return deepFreeze({
    schema: 'sdo.filesystem_read_result.v1',
    operationId: normalizedOperationId,
    workspace: canonicalWorkspace,
    target: {
      requested: requestedTarget,
      canonical: resolved.canonicalTarget
    },
    observedAt: observationTime,
    evidence: {
      bytes: content.byteLength,
      sha256: crypto.createHash('sha256').update(content).digest('hex'),
      content: content.toString('utf8')
    }
  });
}

module.exports = { readFileWithGrant };
