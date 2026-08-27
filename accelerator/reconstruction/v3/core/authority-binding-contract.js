'use strict';

const CONTRACT_SCHEMA =
  'sdo.reconstruction.authority_binding_contract.v1';

const AUTHORITY_STAGES =
  Object.freeze([
    'VERIFIED_HUMAN_IDENTITY',
    'R3_APPROVAL_AUTHORITY',
    'CAPABILITY_GRANT'
  ]);

const REQUIRED_BINDINGS =
  Object.freeze([
    'subjectId',
    'operationId',
    'workspace',
    'tenantId',
    'projectId',
    'capabilityType',
    'action',
    'scopeFingerprint',
    'assertionFingerprint',
    'verificationEvidenceFingerprint',
    'approvalAuthorityFingerprint'
  ]);

function deepFreeze(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function denied(reason) {
  return deepFreeze({
    schema:
      CONTRACT_SCHEMA,
    decision:
      'DENIED',
    reason,
    binding:
      null
  });
}

function isPlainObject(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function exactKeys(value, allowed) {
  if (!isPlainObject(value)) {
    return false;
  }

  const actual =
    Object.keys(value).sort();

  const expected =
    [...allowed].sort();

  return (
    actual.length === expected.length &&
    actual.every(
      (key, index) =>
        key === expected[index]
    )
  );
}

function text(value) {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length > 0
  )
    ? value
    : null;
}

function fingerprint(value) {
  return (
    typeof value === 'string' &&
    /^[a-f0-9]{64}$/.test(value)
  )
    ? value
    : null;
}

function nullableText(value) {
  return value === null
    ? null
    : text(value);
}

function sameContext(left, right) {
  return (
    left.operationId === right.operationId &&
    left.workspace === right.workspace &&
    left.tenantId === right.tenantId &&
    left.projectId === right.projectId
  );
}

function normalizeIdentity(value) {
  const keys = [
    'decision',
    'subjectId',
    'operationId',
    'workspace',
    'tenantId',
    'projectId',
    'assertionFingerprint',
    'verificationEvidenceFingerprint'
  ];

  if (!exactKeys(value, keys)) {
    return null;
  }

  const normalized = {
    decision:
      value.decision,
    subjectId:
      text(value.subjectId),
    operationId:
      text(value.operationId),
    workspace:
      text(value.workspace),
    tenantId:
      nullableText(value.tenantId),
    projectId:
      nullableText(value.projectId),
    assertionFingerprint:
      fingerprint(value.assertionFingerprint),
    verificationEvidenceFingerprint:
      fingerprint(
        value.verificationEvidenceFingerprint
      )
  };

  if (
    normalized.decision !== 'VERIFIED' ||
    !normalized.subjectId ||
    !normalized.operationId ||
    !normalized.workspace ||
    (
      value.tenantId !== null &&
      !normalized.tenantId
    ) ||
    (
      value.projectId !== null &&
      !normalized.projectId
    ) ||
    !normalized.assertionFingerprint ||
    !normalized.verificationEvidenceFingerprint
  ) {
    return null;
  }

  return normalized;
}

function normalizeApproval(value) {
  const keys = [
    'decision',
    'approverId',
    'operationId',
    'workspace',
    'tenantId',
    'projectId',
    'riskLevel',
    'policyDecision',
    'capabilityType',
    'action',
    'scopeFingerprint',
    'assertionFingerprint',
    'approvalAuthorityFingerprint'
  ];

  if (!exactKeys(value, keys)) {
    return null;
  }

  const normalized = {
    decision:
      value.decision,
    approverId:
      text(value.approverId),
    operationId:
      text(value.operationId),
    workspace:
      text(value.workspace),
    tenantId:
      nullableText(value.tenantId),
    projectId:
      nullableText(value.projectId),
    riskLevel:
      value.riskLevel,
    policyDecision:
      value.policyDecision,
    capabilityType:
      text(value.capabilityType),
    action:
      text(value.action),
    scopeFingerprint:
      fingerprint(value.scopeFingerprint),
    assertionFingerprint:
      fingerprint(value.assertionFingerprint),
    approvalAuthorityFingerprint:
      fingerprint(
        value.approvalAuthorityFingerprint
      )
  };

  if (
    normalized.decision !== 'ALLOWED' ||
    !normalized.approverId ||
    !normalized.operationId ||
    !normalized.workspace ||
    (
      value.tenantId !== null &&
      !normalized.tenantId
    ) ||
    (
      value.projectId !== null &&
      !normalized.projectId
    ) ||
    normalized.riskLevel !== 'R3' ||
    normalized.policyDecision !==
      'APPROVAL_REQUIRED' ||
    !normalized.capabilityType ||
    !normalized.action ||
    !normalized.scopeFingerprint ||
    !normalized.assertionFingerprint ||
    !normalized.approvalAuthorityFingerprint
  ) {
    return null;
  }

  return normalized;
}

function normalizeGrant(value) {
  const keys = [
    'decision',
    'subjectId',
    'operationId',
    'workspace',
    'tenantId',
    'projectId',
    'riskLevel',
    'policyDecision',
    'underlyingPolicyDecision',
    'capabilityType',
    'action',
    'scopeFingerprint',
    'assertionFingerprint',
    'verificationEvidenceFingerprint',
    'approvalAuthorityFingerprint'
  ];

  if (!exactKeys(value, keys)) {
    return null;
  }

  const normalized = {
    decision:
      value.decision,
    subjectId:
      text(value.subjectId),
    operationId:
      text(value.operationId),
    workspace:
      text(value.workspace),
    tenantId:
      nullableText(value.tenantId),
    projectId:
      nullableText(value.projectId),
    riskLevel:
      value.riskLevel,
    policyDecision:
      value.policyDecision,
    underlyingPolicyDecision:
      value.underlyingPolicyDecision,
    capabilityType:
      text(value.capabilityType),
    action:
      text(value.action),
    scopeFingerprint:
      fingerprint(value.scopeFingerprint),
    assertionFingerprint:
      fingerprint(value.assertionFingerprint),
    verificationEvidenceFingerprint:
      fingerprint(
        value.verificationEvidenceFingerprint
      ),
    approvalAuthorityFingerprint:
      fingerprint(
        value.approvalAuthorityFingerprint
      )
  };

  if (
    normalized.decision !== 'ALLOWED' ||
    !normalized.subjectId ||
    !normalized.operationId ||
    !normalized.workspace ||
    (
      value.tenantId !== null &&
      !normalized.tenantId
    ) ||
    (
      value.projectId !== null &&
      !normalized.projectId
    ) ||
    normalized.riskLevel !== 'R3' ||
    normalized.policyDecision !== 'ALLOWED' ||
    normalized.underlyingPolicyDecision !==
      'APPROVAL_REQUIRED' ||
    !normalized.capabilityType ||
    !normalized.action ||
    !normalized.scopeFingerprint ||
    !normalized.assertionFingerprint ||
    !normalized.verificationEvidenceFingerprint ||
    !normalized.approvalAuthorityFingerprint
  ) {
    return null;
  }

  return normalized;
}

function evaluateAuthorityBinding(input) {
  if (
    !exactKeys(
      input,
      ['identity', 'approval', 'grant']
    )
  ) {
    return denied(
      'Complete explicit authority-chain evidence is required.'
    );
  }

  const identity =
    normalizeIdentity(input.identity);

  if (!identity) {
    return denied(
      'Verified human identity evidence is malformed or unavailable.'
    );
  }

  const approval =
    normalizeApproval(input.approval);

  if (!approval) {
    return denied(
      'Exact R3 approval authority is malformed or unavailable.'
    );
  }

  const grant =
    normalizeGrant(input.grant);

  if (!grant) {
    return denied(
      'Exact capability grant is malformed or unavailable.'
    );
  }

  if (
    !sameContext(identity, approval) ||
    !sameContext(identity, grant)
  ) {
    return denied(
      'Authority operation, workspace, tenant or project binding mismatched.'
    );
  }

  if (
    identity.subjectId !== approval.approverId ||
    identity.subjectId !== grant.subjectId
  ) {
    return denied(
      'Authenticated human and authorized approver identity mismatched.'
    );
  }

  if (
    identity.assertionFingerprint !==
      approval.assertionFingerprint ||
    identity.assertionFingerprint !==
      grant.assertionFingerprint
  ) {
    return denied(
      'Verified identity assertion fingerprint binding mismatched.'
    );
  }

  if (
    identity.verificationEvidenceFingerprint !==
      grant.verificationEvidenceFingerprint
  ) {
    return denied(
      'Identity-verification evidence binding mismatched.'
    );
  }

  if (
    approval.approvalAuthorityFingerprint !==
      grant.approvalAuthorityFingerprint
  ) {
    return denied(
      'R3 approval-authority fingerprint binding mismatched.'
    );
  }

  for (const field of [
    'capabilityType',
    'action',
    'scopeFingerprint'
  ]) {
    if (approval[field] !== grant[field]) {
      return denied(
        'Authority ' + field + ' binding mismatched.'
      );
    }
  }

  return deepFreeze({
    schema:
      CONTRACT_SCHEMA,
    decision:
      'ALLOWED',
    reason:
      'Verified human identity, R3 approval and capability grant are exactly bound.',
    binding: {
      stages:
        [...AUTHORITY_STAGES],
      subjectId:
        identity.subjectId,
      operationId:
        identity.operationId,
      workspace:
        identity.workspace,
      tenantId:
        identity.tenantId,
      projectId:
        identity.projectId,
      riskLevel:
        'R3',
      capabilityType:
        approval.capabilityType,
      action:
        approval.action,
      scopeFingerprint:
        approval.scopeFingerprint,
      assertionFingerprint:
        identity.assertionFingerprint,
      verificationEvidenceFingerprint:
        identity.verificationEvidenceFingerprint,
      approvalAuthorityFingerprint:
        approval.approvalAuthorityFingerprint
    }
  });
}

function describeAuthorityBindingContract() {
  return deepFreeze({
    schema:
      CONTRACT_SCHEMA,
    authorityStages:
      [...AUTHORITY_STAGES],
    requiredBindings:
      [...REQUIRED_BINDINGS],
    authenticationImpliesAuthorization:
      false,
    cognitiveAuthority: {
      identity:
        false,
      approval:
        false,
      grant:
        false,
      operational:
        false,
      mutation:
        false
    },
    providerSpecific:
      false,
    cryptographicVerification:
      'EXTERNAL_ADAPTER',
    defaultDecision:
      'DENIED'
  });
}

module.exports =
  Object.freeze({
    CONTRACT_SCHEMA,
    describeAuthorityBindingContract,
    evaluateAuthorityBinding
  });
