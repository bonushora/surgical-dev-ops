'use strict';

const crypto = require('node:crypto');
const fs = require('fs');
const path = require('path');
const {
  canonicalizeAuthorizedRoot,
  resolveInspectedFile
} = require('./workspace-boundary');
const { evaluateR3ApprovalAuthority } = require('./risk-classification');
const { validateIdentityVerificationResult } = require('../adapters/identity-verification-adapter');
const { classifyExpiry } = require('./authoritative-clock');

const ALLOWED_TYPES = new Set([
  'FILESYSTEM_READ', 'FILESYSTEM_PATCH', 'GIT_READ', 'PROCESS_VALIDATION'
]);
const GIT_READ_OPERATIONS = new Set(['status', 'diff', 'show', 'rev-parse', 'ls-files']);
const VALIDATION_SELECTORS = new Set(['NODE_SYNTAX_CHECK']);
const RISKS = new Set(['R0', 'R1', 'R2', 'R3']);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function denied(reason) {
  return deepFreeze({
    schema: 'sdo.capability_grant_evaluation.v1',
    decision: 'DENIED',
    reason,
    grant: null
  });
}

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function timestamp(value) {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) return null;
  return value;
}

function canonicalWorkspace(value) {
  const workspace = text(value);
  if (!workspace || !path.isAbsolute(workspace) || path.normalize(workspace) !== workspace) {
    return null;
  }
  try {
    const canonical = canonicalizeAuthorizedRoot(workspace);
    return canonical === workspace && fs.statSync(canonical).isDirectory()
      ? canonical
      : null;
  } catch {
    return null;
  }
}

function stringList(value) {
  if (!Array.isArray(value) || value.length === 0 ||
      value.some((entry) => !text(entry))) return null;
  const normalized = value.map((entry) => entry.trim());
  return new Set(normalized).size === normalized.length ? normalized : null;
}

function isSubset(requested, authorized) {
  const allowed = new Set(authorized);
  return requested.every((entry) => allowed.has(entry));
}

function sha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function deriveCapabilityGrantFingerprint(grant) {
  if (!grant || typeof grant !== 'object' || Array.isArray(grant)) return null;
  const { fingerprint, ...fields } = grant;
  return crypto.createHash('sha256')
    .update(`sdo.capability_grant.v1\0${JSON.stringify(canonicalize(fields))}`).digest('hex');
}

function validateScope(type, scope, authorizedScope, workspace) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope) ||
      !authorizedScope || typeof authorizedScope !== 'object' || Array.isArray(authorizedScope)) {
    return { error: 'Capability scope is missing or ambiguous.' };
  }

  if (type === 'FILESYSTEM_READ') {
    const paths = stringList(scope.paths);
    const authorizedPaths = stringList(authorizedScope.paths);
    if (!paths || !authorizedPaths) return { error: 'Filesystem scope is missing or ambiguous.' };
    if (!isSubset(paths, authorizedPaths)) return { error: 'Capability scope broadening is forbidden.' };
    const resolved = [];
    try {
      for (const target of paths) {
        const file = resolveInspectedFile(workspace, target);
        resolved.push({ path: target, canonicalPath: file.canonicalTarget });
      }
    } catch {
      return { error: 'Filesystem scope is unresolved or outside the workspace.' };
    }
    return { scope: { paths: resolved } };
  }

  if (type === 'FILESYSTEM_PATCH') {
    const target = scope.target;
    const authorizedTarget = authorizedScope.target;
    if (!target || typeof target !== 'object' || Array.isArray(target) ||
        !authorizedTarget || typeof authorizedTarget !== 'object' || Array.isArray(authorizedTarget) ||
        !text(target.path) || !text(authorizedTarget.path) ||
        target.path !== authorizedTarget.path ||
        !sha256(target.beforeSha256) || target.beforeSha256 !== authorizedTarget.beforeSha256 ||
        !sha256(target.replacementSha256) ||
        target.replacementSha256 !== authorizedTarget.replacementSha256 ||
        Object.keys(scope).length !== 1 || Object.keys(authorizedScope).length !== 1 ||
        Object.keys(target).some((key) => !['path', 'beforeSha256', 'replacementSha256'].includes(key)) ||
        Object.keys(authorizedTarget).some((key) => !['path', 'beforeSha256', 'replacementSha256'].includes(key))) {
      return { error: 'Filesystem patch scope is missing, ambiguous or broadened.' };
    }
    try {
      const file = resolveInspectedFile(workspace, target.path);
      const lexicalTarget = path.resolve(workspace, target.path);
      const lexicalStat = fs.lstatSync(lexicalTarget);
      if (lexicalStat.isSymbolicLink() || !lexicalStat.isFile()) {
        return { error: 'Filesystem patch target must be an existing non-symlink regular file.' };
      }
      return {
        scope: {
          target: {
            path: target.path,
            canonicalPath: file.canonicalTarget,
            beforeSha256: target.beforeSha256,
            replacementSha256: target.replacementSha256
          }
        }
      };
    } catch {
      return { error: 'Filesystem patch target is unresolved or outside the workspace.' };
    }
  }

  if (type === 'GIT_READ') {
    const operations = stringList(scope.operations);
    const authorizedOperations = stringList(authorizedScope.operations);
    if (!operations || !authorizedOperations) return { error: 'Git scope is missing or ambiguous.' };
    if (operations.some((operation) => !GIT_READ_OPERATIONS.has(operation)) ||
        !isSubset(operations, authorizedOperations)) {
      return { error: 'Capability scope broadening is forbidden.' };
    }
    return { scope: { operations: [...operations] } };
  }

  if (type === 'PROCESS_VALIDATION') {
    const selectors = stringList(scope.selectors);
    const authorizedSelectors = stringList(authorizedScope.selectors);
    const paths = stringList(scope.paths);
    const authorizedPaths = stringList(authorizedScope.paths);
    if (!selectors || !authorizedSelectors || !paths || !authorizedPaths) {
      return { error: 'Process-validation scope is missing or ambiguous.' };
    }
    if (selectors.some((selector) => !VALIDATION_SELECTORS.has(selector)) ||
        !isSubset(selectors, authorizedSelectors) || !isSubset(paths, authorizedPaths)) {
      return { error: 'Capability scope broadening is forbidden.' };
    }
    const resolved = [];
    try {
      for (const target of paths) {
        const file = resolveInspectedFile(workspace, target);
        resolved.push({ path: target, canonicalPath: file.canonicalTarget });
      }
    } catch {
      return { error: 'Validation scope is unresolved or outside the workspace.' };
    }
    return { scope: { selectors: [...selectors], paths: resolved } };
  }

  return { error: 'Capability type is denied.' };
}

function evaluateCapabilityGrant(request, authority, authoritativeClock = null) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return denied('Capability request is missing or invalid.');
  }
  if (!authority || typeof authority !== 'object' || Array.isArray(authority)) {
    return denied('Authoritative capability policy is missing.');
  }

  const operationId = text(request.operationId);
  const authoritativeOperationId = text(authority.operationId);
  if (!operationId || !authoritativeOperationId || operationId !== authoritativeOperationId) {
    return denied('Capability operationId is missing or mismatched.');
  }

  const workspace = canonicalWorkspace(request.workspace);
  const authoritativeWorkspace = canonicalWorkspace(authority.workspace);
  if (!workspace || !authoritativeWorkspace || workspace !== authoritativeWorkspace) {
    return denied('Capability workspace is missing, non-canonical or mismatched.');
  }

  if (!RISKS.has(request.riskLevel) || request.riskLevel !== authority.riskLevel) {
    return denied('Risk requirements are missing, invalid or mismatched.');
  }
  if (request.lifecycleState !== 'PENDING' || authority.lifecycleState !== 'PENDING') {
    return denied('Lifecycle state does not permit a capability grant.');
  }
  if (request.idempotency !== 'IDEMPOTENT' || authority.idempotency !== 'IDEMPOTENT') {
    return denied('Capability must be explicitly idempotent.');
  }

  const capabilityType = text(request.capabilityType);
  if (!capabilityType || capabilityType !== authority.capabilityType ||
      !ALLOWED_TYPES.has(capabilityType)) {
    return denied('Capability type is denied.');
  }
  if (capabilityType === 'FILESYSTEM_PATCH' && request.riskLevel !== 'R3') {
    return denied('A filesystem patch requires R3 authenticated human authority.');
  }

  const r3Patch = capabilityType === 'FILESYSTEM_PATCH' && request.riskLevel === 'R3';
  let approvalAuthority = null;
  let authoritativeReading = null;
  let temporalAuthority = null;
  if (r3Patch) {
    for (const source of [request, authority]) {
      if (['now', 'currentTime', 'validationTime', 'observedAt'].some(
        (key) => Object.prototype.hasOwnProperty.call(source, key)
      )) return denied('Caller-supplied current time cannot authorize a mutation grant.');
    }
    if (!authoritativeClock || typeof authoritativeClock.observe !== 'function') {
      return denied('Authoritative clock is required for an R3 mutation grant.');
    }
    let observation;
    try { observation = authoritativeClock.observe(); } catch {
      return denied('Authoritative clock is unavailable for an R3 mutation grant.');
    }
    if (!observation || observation.decision !== 'ALLOWED') {
      return denied('Authoritative clock anomaly denied the R3 mutation grant.');
    }
    authoritativeReading = observation.reading;
    const currentTime = { reading: authoritativeReading, requireCurrent: true };
    const tenantId = request.tenantId === undefined ? null : text(request.tenantId);
    const authoritativeTenantId = authority.tenantId === undefined ? null : text(authority.tenantId);
    const projectId = request.projectId === undefined ? null : text(request.projectId);
    const authoritativeProjectId = authority.projectId === undefined ? null : text(authority.projectId);
    if (tenantId !== authoritativeTenantId || projectId !== authoritativeProjectId ||
        (request.tenantId !== undefined && !tenantId) ||
        (request.projectId !== undefined && !projectId)) {
      return denied('R3 tenant or project authority is missing or mismatched.');
    }
    if (request.policyDecision !== 'APPROVAL_REQUIRED' ||
        authority.policyDecision !== 'APPROVAL_REQUIRED') {
      return denied('R3 patch policy must remain APPROVAL_REQUIRED.');
    }
    const requestApproval = evaluateR3ApprovalAuthority(request.approvalAuthority, {
      operationId, workspace, capabilityType, action: 'PATCH_FILE', scope: request.scope,
      riskLevel: 'R3', policyDecision: 'APPROVAL_REQUIRED', tenantId, projectId
    }, currentTime);
    const authorityApproval = evaluateR3ApprovalAuthority(authority.approvalAuthority, {
      operationId, workspace, capabilityType, action: 'PATCH_FILE', scope: authority.scope,
      riskLevel: 'R3', policyDecision: 'APPROVAL_REQUIRED', tenantId, projectId
    }, currentTime);
    if (requestApproval.decision !== 'ALLOWED' || authorityApproval.decision !== 'ALLOWED' ||
        requestApproval.authority.fingerprint !== authorityApproval.authority.fingerprint) {
      return denied('Valid matching R3 approval authority is required.');
    }
    approvalAuthority = requestApproval.authority;
    const identityExpected = {
      subjectId: approvalAuthority.approver.id, operationId, workspace, tenantId, projectId,
      fingerprint: approvalAuthority.verifiedIdentityAssertionFingerprint
    };
    const requestIdentity = validateIdentityVerificationResult(
      request.identityVerification, identityExpected, currentTime
    );
    const authorityIdentity = validateIdentityVerificationResult(
      authority.identityVerification, identityExpected, currentTime
    );
    if (!requestIdentity || !authorityIdentity ||
        requestIdentity.evidence.fingerprint !== authorityIdentity.evidence.fingerprint) {
      return denied('Trusted identity verification evidence is required for R3 mutation.');
    }
  } else if (request.policyDecision !== 'ALLOWED' || authority.policyDecision !== 'ALLOWED') {
    return denied('Explicit ALLOWED policy is required.');
  }

  const expiresAt = timestamp(request.expiresAt);
  const evaluatedAt = r3Patch ? authoritativeReading.wallTime : timestamp(authority.evaluatedAt);
  if (!expiresAt || !evaluatedAt || Date.parse(expiresAt) <= Date.parse(evaluatedAt)) {
    return denied('Capability grant is expired or has invalid expiry evidence.');
  }
  if (r3Patch) {
    let grantExpiry;
    try {
      grantExpiry = classifyExpiry(authoritativeReading, {
        issuedAt: authoritativeReading.wallTime,
        expiresAt
      });
    } catch {
      return denied('Authoritative capability-grant validity is malformed.');
    }
    if (grantExpiry.decision !== 'ALLOWED') {
      return denied('Capability grant is expired according to authoritative time.');
    }
    temporalAuthority = deepFreeze({
      issuanceReading: authoritativeReading,
      identity: {
        issuedAt: approvalAuthority.verifiedIdentityAssertion.issuedAt,
        expiresAt: approvalAuthority.verifiedIdentityAssertion.expiresAt,
        fingerprint: approvalAuthority.verifiedIdentityAssertionFingerprint
      },
      approval: {
        issuedAt: approvalAuthority.timestamp,
        expiresAt: approvalAuthority.expiresAt,
        fingerprint: approvalAuthority.fingerprint
      },
      grant: {
        issuedAt: authoritativeReading.wallTime,
        expiresAt
      }
    });
  }

  const scopeResult = validateScope(
    capabilityType, request.scope, authority.scope, workspace
  );
  if (scopeResult.error) return denied(scopeResult.error);

  const grantFields = {
      operationId,
      workspace,
      policyDecision: 'ALLOWED',
      underlyingPolicyDecision: r3Patch ? 'APPROVAL_REQUIRED' : request.policyDecision,
      riskLevel: request.riskLevel,
      lifecycleState: request.lifecycleState,
      capabilityType,
      scope: scopeResult.scope,
      issuedAt: r3Patch ? authoritativeReading.wallTime : evaluatedAt,
      expiresAt,
      idempotency: request.idempotency,
      approvalAuthorityFingerprint: approvalAuthority ? approvalAuthority.fingerprint : null,
      approvalAuthorityId: approvalAuthority ? approvalAuthority.approvalAuthorityId : null,
      verifiedIdentityAssertionFingerprint: approvalAuthority
        ? approvalAuthority.verifiedIdentityAssertionFingerprint : null,
      tenantId: approvalAuthority ? approvalAuthority.tenantId : null,
      projectId: approvalAuthority ? approvalAuthority.projectId : null,
      identityVerificationEvidenceFingerprint: approvalAuthority
        ? request.identityVerification.evidence.fingerprint : null,
      temporalAuthority
  };
  const grant = deepFreeze({
    ...grantFields,
    fingerprint: deriveCapabilityGrantFingerprint(grantFields)
  });
  return deepFreeze({
    schema: 'sdo.capability_grant_evaluation.v1',
    decision: 'ALLOWED',
    reason: capabilityType === 'FILESYSTEM_PATCH'
      ? 'Explicit bounded single-file patch capability granted.'
      : 'Explicit bounded read-only capability granted.',
    grant
  });
}

module.exports = { evaluateCapabilityGrant, deriveCapabilityGrantFingerprint };
