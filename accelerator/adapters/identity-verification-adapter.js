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

function verifyHumanIdentityAssertion(request, verifierPort) {
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
  const evaluation = evaluateVerifiedHumanIdentityAssertion(output.assertion, request.expected);
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
      ? output.verifierId.trim() : 'EXTERNAL_VERIFIER'
  };
  const evidenceFingerprint = crypto.createHash('sha256')
    .update(JSON.stringify(canonicalize(evidenceFields))).digest('hex');
  return deepFreeze({
    schema: 'sdo.identity_verification_result.v1', decision: 'VERIFIED',
    reason: 'External verifier and configured issuer trust accepted the human assertion.',
    assertion: evaluation.assertion,
    evidence: { ...evidenceFields, fingerprint: evidenceFingerprint }
  });
}

module.exports = { verifyHumanIdentityAssertion };
