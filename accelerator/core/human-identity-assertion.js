'use strict';

const crypto = require('crypto');
const {
  canonicalizeAuthorizedRoot
} = require('./workspace-boundary');
const path = require('path');
const { classifyExpiry } = require('./authoritative-clock');

const SCHEMA = 'sdo.verified_human_identity_assertion.v1';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function timestamp(value) {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? value : null;
}

function canonicalWorkspace(value) {
  const workspace = text(value);
  if (!workspace || !path.isAbsolute(workspace) || path.normalize(workspace) !== workspace) return null;
  try {
    return canonicalizeAuthorizedRoot(workspace);
  } catch {
    return null;
  }
}

function denied(reason) {
  return deepFreeze({ schema: 'sdo.human_identity_assertion_evaluation.v1', decision: 'DENIED', reason, assertion: null });
}

function evaluateVerifiedHumanIdentityAssertion(candidate, expected = {}, temporalAuthority = {}) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return denied('Verified human identity assertion is missing.');
  }
  const subject = candidate.subject;
  const authentication = candidate.authentication;
  const audience = Array.isArray(candidate.audience)
    ? candidate.audience.map(text) : [text(candidate.audience)];
  const tenantId = candidate.tenantId === null || candidate.tenantId === undefined
    ? null : text(candidate.tenantId);
  const projectId = candidate.projectId === null || candidate.projectId === undefined
    ? null : text(candidate.projectId);
  const fields = {
    schema: SCHEMA,
    verification: candidate.verification,
    assertionId: text(candidate.assertionId),
    subject: subject && { id: text(subject.id), type: subject.type },
    issuer: text(candidate.issuer),
    authentication: authentication && {
      method: text(authentication.method), context: text(authentication.context)
    },
    issuedAt: timestamp(candidate.issuedAt),
    expiresAt: timestamp(candidate.expiresAt),
    audience,
    operationId: text(candidate.operationId),
    workspace: canonicalWorkspace(candidate.workspace),
    tenantId,
    projectId,
    revocationStatus: candidate.revocationStatus,
    verifiedAt: timestamp(candidate.verifiedAt)
  };
  const fingerprint = digest(fields);
  const valid = candidate.schema === SCHEMA && fields.verification === 'VERIFIED' &&
    fields.assertionId && fields.subject && fields.subject.id && fields.subject.type === 'HUMAN' &&
    fields.issuer && fields.authentication && fields.authentication.method &&
    fields.authentication.context && fields.issuedAt && fields.expiresAt &&
    fields.audience.length > 0 && fields.audience.every(Boolean) &&
    new Set(fields.audience).size === fields.audience.length && fields.operationId &&
    fields.workspace && fields.revocationStatus === 'NOT_REVOKED' && fields.verifiedAt &&
    Date.parse(fields.expiresAt) > Date.parse(fields.issuedAt) &&
    Date.parse(fields.verifiedAt) >= Date.parse(fields.issuedAt) &&
    Date.parse(fields.verifiedAt) < Date.parse(fields.expiresAt) &&
    (candidate.tenantId === null || candidate.tenantId === undefined || tenantId) &&
    (candidate.projectId === null || candidate.projectId === undefined || projectId) &&
    (!candidate.fingerprint || candidate.fingerprint === fingerprint);
  if (!valid) return denied('Verified human identity assertion is malformed or unverifiable.');

  for (const callerTime of ['now', 'currentTime', 'validationTime', 'observedAt']) {
    if (Object.prototype.hasOwnProperty.call(expected, callerTime)) {
      return denied('Caller-supplied current time cannot authorize human identity.');
    }
  }
  if (temporalAuthority.requireCurrent === true && !temporalAuthority.reading) {
    return denied('Authoritative clock evidence is required for human identity validity.');
  }
  if (temporalAuthority.reading) {
    let expiry;
    try {
      expiry = classifyExpiry(temporalAuthority.reading, {
        issuedAt: fields.issuedAt,
        expiresAt: fields.expiresAt
      });
    } catch {
      return denied('Authoritative human identity time evidence is malformed.');
    }
    if (expiry.decision !== 'ALLOWED') {
      return denied(expiry.classification === 'ISSUED_IN_FUTURE'
        ? 'Verified human identity assertion is not yet valid.'
        : 'Verified human identity assertion is expired.');
    }
  }
  const exact = {
    subjectId: fields.subject.id, issuer: fields.issuer, operationId: fields.operationId,
    workspace: fields.workspace, tenantId: fields.tenantId, projectId: fields.projectId
  };
  const expectedExact = { ...expected };
  if (Object.prototype.hasOwnProperty.call(expectedExact, 'workspace')) {
    expectedExact.workspace = canonicalWorkspace(expectedExact.workspace);
    if (!expectedExact.workspace) {
      return denied('Verified human identity assertion workspace mismatch.');
    }
  }
  for (const key of ['subjectId', 'issuer', 'operationId', 'workspace', 'tenantId', 'projectId']) {
    if (Object.prototype.hasOwnProperty.call(expectedExact, key) && expectedExact[key] !== exact[key]) {
      return denied(`Verified human identity assertion ${key} mismatch.`);
    }
  }
  if (expected.audience !== undefined) {
    const required = Array.isArray(expected.audience) ? expected.audience : [expected.audience];
    if (required.length === 0 || required.some((entry) => !fields.audience.includes(entry))) {
      return denied('Verified human identity assertion audience mismatch.');
    }
  }
  if (expected.fingerprint !== undefined && expected.fingerprint !== fingerprint) {
    return denied('Verified human identity assertion fingerprint mismatch.');
  }
  return deepFreeze({
    schema: 'sdo.human_identity_assertion_evaluation.v1', decision: 'VERIFIED',
    reason: 'Externally authenticated human identity assertion is valid.',
    assertion: { ...fields, fingerprint }
  });
}

function identityAssertionFingerprint(value) {
  const evaluation = evaluateVerifiedHumanIdentityAssertion(value);
  return evaluation.decision === 'VERIFIED' ? evaluation.assertion.fingerprint : null;
}

function reconcileVerifiedHumanIdentityAssertion(previous, candidate, expected = {}, temporalAuthority = {}) {
  const prior = evaluateVerifiedHumanIdentityAssertion(previous, expected, temporalAuthority);
  const next = evaluateVerifiedHumanIdentityAssertion(candidate, expected, temporalAuthority);
  if (prior.decision !== 'VERIFIED' || next.decision !== 'VERIFIED') {
    throw new Error('Verified identity replay is malformed.');
  }
  if (prior.assertion.assertionId !== next.assertion.assertionId ||
      prior.assertion.operationId !== next.assertion.operationId) {
    throw new Error('Verified identity replay context conflicts.');
  }
  if (prior.assertion.fingerprint !== next.assertion.fingerprint) {
    throw new Error('Conflicting verified identity assertion replay.');
  }
  return prior.assertion;
}

module.exports = {
  evaluateVerifiedHumanIdentityAssertion,
  identityAssertionFingerprint,
  reconcileVerifiedHumanIdentityAssertion,
  canonicalize,
  deepFreeze
};
