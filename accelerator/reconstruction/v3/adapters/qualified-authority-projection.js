'use strict';

const crypto = require('node:crypto');

const {
  validateIdentityVerificationResult
} = require('../../../adapters/identity-verification-adapter');
const {
  authorityFingerprint
} = require('../../../core/risk-classification');
const {
  deriveCapabilityGrantFingerprint
} = require('../../../core/capability-grant');
const {
  evaluateAuthorityBinding
} = require('../core/authority-binding-contract');

function denied(reason) {
  return Object.freeze({
    decision: 'DENIED',
    reason
  });
}

function isObject(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (!isObject(value)) {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
}

function logicalScope(value) {
  if (Array.isArray(value)) {
    return value.map(logicalScope);
  }

  if (!isObject(value)) {
    return value;
  }

  return Object.keys(value)
    .filter((key) => key !== 'canonicalPath')
    .sort()
    .reduce((result, key) => {
      result[key] = logicalScope(value[key]);
      return result;
    }, {});
}

function scopeFingerprint(scope) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify(
        canonicalize(
          logicalScope(scope)
        )
      )
    )
    .digest('hex');
}

function validApprovalFingerprint(authority) {
  if (!isObject(authority)) {
    return false;
  }

  const {
    fingerprint,
    verifiedIdentityAssertion,
    ...fields
  } = authority;

  return (
    typeof fingerprint === 'string' &&
    isObject(verifiedIdentityAssertion) &&
    authorityFingerprint(fields) === fingerprint
  );
}

function validGrantFingerprint(grant) {
  return (
    isObject(grant) &&
    typeof grant.fingerprint === 'string' &&
    deriveCapabilityGrantFingerprint(grant) ===
      grant.fingerprint
  );
}

function projectQualifiedAuthority(input) {
  if (!isObject(input)) {
    return denied(
      'Qualified authority projection input is missing.'
    );
  }

  const identity = validateIdentityVerificationResult(
    input.identityVerification,
    input.expectedIdentity,
    input.temporalAuthority
  );

  if (!identity) {
    return denied(
      'Identity verification evidence is not qualified.'
    );
  }

  const approval = input.approvalAuthority;
  const grantEvaluation =
    input.capabilityGrantEvaluation;

  const grant =
    isObject(grantEvaluation) &&
    grantEvaluation.decision === 'ALLOWED'
      ? grantEvaluation.grant
      : null;

  if (!validApprovalFingerprint(approval)) {
    return denied(
      'R3 approval-authority fingerprint is not qualified.'
    );
  }

  if (!validGrantFingerprint(grant)) {
    return denied(
      'Capability-grant fingerprint is not qualified.'
    );
  }

  const approvalScopeFingerprint =
    scopeFingerprint(approval.scope);
  const grantScopeFingerprint =
    scopeFingerprint(grant.scope);

  if (
    approvalScopeFingerprint !==
      grantScopeFingerprint
  ) {
    return denied(
      'Approval and grant logical scopes mismatched.'
    );
  }

  return evaluateAuthorityBinding({
    identity: {
      decision: 'VERIFIED',
      subjectId:
        identity.assertion.subject.id,
      operationId:
        identity.assertion.operationId,
      workspace:
        identity.assertion.workspace,
      tenantId:
        identity.assertion.tenantId,
      projectId:
        identity.assertion.projectId,
      assertionFingerprint:
        identity.assertion.fingerprint,
      verificationEvidenceFingerprint:
        identity.evidence.fingerprint
    },
    approval: {
      decision: 'ALLOWED',
      approverId:
        approval.approver.id,
      operationId:
        approval.operationId,
      workspace:
        approval.workspace,
      tenantId:
        approval.tenantId,
      projectId:
        approval.projectId,
      riskLevel:
        approval.riskLevel,
      policyDecision:
        approval.policyDecision,
      capabilityType:
        approval.capabilityType,
      action:
        approval.action,
      scopeFingerprint:
        approvalScopeFingerprint,
      assertionFingerprint:
        approval.verifiedIdentityAssertionFingerprint,
      approvalAuthorityFingerprint:
        approval.fingerprint
    },
    grant: {
      decision: 'ALLOWED',
      subjectId:
        identity.assertion.subject.id,
      operationId:
        grant.operationId,
      workspace:
        grant.workspace,
      tenantId:
        grant.tenantId,
      projectId:
        grant.projectId,
      riskLevel:
        grant.riskLevel,
      policyDecision:
        grant.policyDecision,
      underlyingPolicyDecision:
        grant.underlyingPolicyDecision,
      capabilityType:
        grant.capabilityType,
      action:
        grant.action,
      scopeFingerprint:
        grantScopeFingerprint,
      assertionFingerprint:
        grant.verifiedIdentityAssertionFingerprint,
      verificationEvidenceFingerprint:
        grant.identityVerificationEvidenceFingerprint,
      approvalAuthorityFingerprint:
        grant.approvalAuthorityFingerprint
    }
  });
}

module.exports = Object.freeze({
  projectQualifiedAuthority,
  scopeFingerprint
});
