'use strict';

const crypto = require('crypto');
const {
  evaluateVerifiedHumanIdentityAssertion,
  canonicalize,
  deepFreeze
} = require('../core/human-identity-assertion');

function denied(reason) {
  return deepFreeze({ schema: 'sdo.identity_verification_result.v1', decision: 'DENIED', reason, assertion: null, evidence: null });
}

function isDeepFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  seen.add(value);
  return Object.values(value).every((child) => isDeepFrozen(child, seen));
}

function evidenceFingerprint(fields) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(canonicalize(fields))).digest('hex');
}

function validateIdentityVerificationResult(result, expected = {}, temporalAuthority = {}) {
  if (!result || result.schema !== 'sdo.identity_verification_result.v1' ||
      result.decision !== 'VERIFIED' || !isDeepFrozen(result) ||
      !result.assertion || !result.evidence) return null;
  const assertion = evaluateVerifiedHumanIdentityAssertion(
    result.assertion, expected, temporalAuthority
  );
  if (assertion.decision !== 'VERIFIED') return null;
  const evidence = result.evidence;
  const fields = {
    schema: 'sdo.identity_verification_evidence.v1', outcome: 'VERIFIED',
    assertionFingerprint: assertion.assertion.fingerprint,
    issuer: assertion.assertion.issuer, subjectId: assertion.assertion.subject.id,
    operationId: assertion.assertion.operationId, workspace: assertion.assertion.workspace,
    tenantId: assertion.assertion.tenantId, projectId: assertion.assertion.projectId,
    verifiedAt: assertion.assertion.verifiedAt, verifierId: evidence.verifierId,
    trustConfigurationFingerprint: evidence.trustConfigurationFingerprint
  };
  if (typeof fields.verifierId !== 'string' || !fields.verifierId.trim() ||
      !/^[a-f0-9]{64}$/.test(fields.trustConfigurationFingerprint || '') ||
      evidence.fingerprint !== evidenceFingerprint(fields) ||
      Object.keys(evidence).length !== Object.keys(fields).length + 1) return null;
  return result;
}

function verifyHumanIdentityAssertion(request, verifierPort, temporalAuthority = {}) {
  if (!request || typeof request !== 'object' || Array.isArray(request) ||
      !request.rawAssertion || typeof request.rawAssertion !== 'object' ||
      !Array.isArray(request.trustedIssuers) || request.trustedIssuers.length === 0 ||
      request.trustedIssuers.some((issuer) => typeof issuer !== 'string' || !issuer.trim()) ||
      !request.expected || typeof request.expected !== 'object') {
    return denied('Identity verification request or explicit issuer trust is missing.');
  }
  const verify = typeof verifierPort === 'function' ? verifierPort
    : verifierPort && typeof verifierPort.verify === 'function'
      ? verifierPort.verify.bind(verifierPort) : null;
  if (!verify) return denied('A provider-neutral identity verifier port is required.');
  if (!temporalAuthority.reading) {
    return denied('Authoritative clock evidence is required for identity verification.');
  }

  let output;
  try {
    output = verify(deepFreeze({
      rawAssertion: request.rawAssertion,
      expected: request.expected,
      trustedIssuers: [...request.trustedIssuers]
    }));
  } catch {
    return denied('External identity verifier failed closed.');
  }
  if (!output || output.status !== 'VERIFIED' || !output.assertion ||
      typeof output.assertion !== 'object' || Array.isArray(output.assertion)) {
    return denied('External identity verifier did not produce VERIFIED assertion evidence.');
  }
  if (!request.trustedIssuers.includes(output.assertion.issuer)) {
    return denied('Identity assertion issuer is not explicitly trusted.');
  }
  const evaluation = evaluateVerifiedHumanIdentityAssertion(
    output.assertion,
    request.expected,
    { ...temporalAuthority, requireCurrent: true }
  );
  if (evaluation.decision !== 'VERIFIED') return denied(evaluation.reason);

  const evidenceFields = {
    schema: 'sdo.identity_verification_evidence.v1',
    outcome: 'VERIFIED',
    assertionFingerprint: evaluation.assertion.fingerprint,
    issuer: evaluation.assertion.issuer,
    subjectId: evaluation.assertion.subject.id,
    operationId: evaluation.assertion.operationId,
    workspace: evaluation.assertion.workspace,
    tenantId: evaluation.assertion.tenantId,
    projectId: evaluation.assertion.projectId,
    verifiedAt: evaluation.assertion.verifiedAt,
    verifierId: typeof output.verifierId === 'string' && output.verifierId.trim()
      ? output.verifierId.trim() : 'EXTERNAL_VERIFIER',
    trustConfigurationFingerprint: evidenceFingerprint({
      trustedIssuers: [...request.trustedIssuers].sort(),
      audience: request.expected.audience
    })
  };
  return deepFreeze({
    schema: 'sdo.identity_verification_result.v1', decision: 'VERIFIED',
    reason: 'External verifier and configured issuer trust accepted the human assertion.',
    assertion: evaluation.assertion,
    evidence: { ...evidenceFields, fingerprint: evidenceFingerprint(evidenceFields) }
  });
}

module.exports = { verifyHumanIdentityAssertion, validateIdentityVerificationResult };
