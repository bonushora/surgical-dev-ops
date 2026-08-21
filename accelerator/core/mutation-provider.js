'use strict';

const crypto = require('crypto');
const {
  createInternalMutationProviderBoundary,
  isTrustedMutationProviderBoundary
} = require('./mutation-provider-composition');

const QUALIFICATION_STATES = Object.freeze([
  'QUALIFIED', 'UNQUALIFIED', 'UNSUPPORTED', 'FAILED'
]);

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

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

const defaultMutationProviderBoundary = createInternalMutationProviderBoundary({
  providerId: 'sdo:none',
  qualificationState: 'UNQUALIFIED',
  operation: 'COMPARE_AND_REPLACE',
  platform: process.platform,
  compareAndReplaceCapability: false
});

function deriveMutationProviderDecisionFingerprint(evidence) {
  return fingerprint({
    schema: evidence.schema,
    decision: evidence.decision,
    providerId: evidence.providerId,
    qualificationState: evidence.qualificationState,
    requestedCapability: evidence.requestedCapability,
    qualificationFingerprint: evidence.qualificationFingerprint || null,
    operationId: evidence.operationId || null,
    workspace: evidence.workspace || null,
    action: evidence.action,
    zeroDispatch: evidence.zeroDispatch,
    reason: evidence.reason
  });
}

function evaluateMutationProvider(boundary = defaultMutationProviderBoundary, context = {}) {
  const binding = deepFreeze({ operationId: context.operationId || null,
    workspace: context.workspace || null, action: context.action || 'PATCH_FILE' });
  if (!boundary || !isTrustedMutationProviderBoundary(boundary)) {
    const denied = {
      schema: 'sdo.mutation_provider_decision.v1', decision: 'DENIED',
      providerId: null, qualificationState: 'FAILED',
      ...binding,
      requestedCapability: 'COMPARE_AND_REPLACE', zeroDispatch: true,
      reason: 'Mutation provider boundary is missing, malformed, or untrusted.'
    };
    return deepFreeze({ ...denied,
      fingerprint: deriveMutationProviderDecisionFingerprint(denied) });
  }
  const qualification = boundary.qualification;
  const allowed = qualification.state === 'QUALIFIED' &&
    qualification.capability.compareAndReplace === true &&
    qualification.capability.operation === 'COMPARE_AND_REPLACE' &&
    typeof boundary.compareAndReplace === 'function';
  const reason = allowed
    ? 'Trusted provider is qualified for compare-and-replace.'
    : `Mutation provider is ${qualification.state}; physical mutation is disabled.`;
  const result = {
    schema: 'sdo.mutation_provider_decision.v1',
    decision: allowed ? 'ALLOWED' : 'DENIED',
    providerId: qualification.providerId,
    qualificationState: qualification.state,
    requestedCapability: 'COMPARE_AND_REPLACE',
    ...binding,
    qualificationFingerprint: qualification.fingerprint,
    zeroDispatch: !allowed,
    reason
  };
  return deepFreeze({ ...result,
    fingerprint: deriveMutationProviderDecisionFingerprint(result) });
}

function requireQualifiedMutationProvider(boundary) {
  const decision = evaluateMutationProvider(boundary);
  if (decision.decision !== 'ALLOWED') {
    const error = new Error(decision.reason);
    error.providerEvidence = decision;
    throw error;
  }
  return Object.freeze({ boundary, decision });
}

function validateMutationProviderResult(result, request, decision) {
  if (!result || result.schema !== 'sdo.compare_and_replace_result.v1' ||
      !isDeepFrozen(result) || result.providerId !== decision.providerId ||
      result.qualificationFingerprint !== decision.qualificationFingerprint ||
      result.transactionId !== request.transactionId || result.target !== request.target ||
      result.beforeSha256 !== request.beforeSha256 ||
      result.replacementSha256 !== request.replacementSha256 ||
      !['APPLIED', 'MISMATCH', 'FAILED_PRECOMMIT', 'AMBIGUOUS_POSTCOMMIT'].includes(result.outcome)) {
    throw new Error('Qualified mutation provider returned malformed or unbound evidence.');
  }
  return result;
}

module.exports = {
  QUALIFICATION_STATES,
  defaultMutationProviderBoundary,
  evaluateMutationProvider,
  deriveMutationProviderDecisionFingerprint,
  requireQualifiedMutationProvider,
  validateMutationProviderResult
};
