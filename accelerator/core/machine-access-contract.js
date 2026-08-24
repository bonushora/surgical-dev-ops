'use strict';

const crypto =
  require('node:crypto');

const SCHEMAS =
  Object.freeze({
    request:
      'sdo.machine_access_request.v1',
    authority:
      'sdo.machine_access_authority.v1',
    operation:
      'sdo.machine_access_operation.v1',
    evidence:
      'sdo.machine_access_evidence.v1',
    result:
      'sdo.machine_access_result.v1'
  });

const OPERATION_PROFILES =
  deepFreeze({
    LIST_DIRECTORY: {
      capabilityType:
        'GIT_READ',
      action:
        'WORKSPACE_FILES',
      riskLevel:
        'R0',
      targetRequired:
        false
    },

    READ_FILE: {
      capabilityType:
        'FILESYSTEM_READ',
      action:
        'READ_FILE',
      riskLevel:
        'R1',
      targetRequired:
        true
    },

    GIT_STATUS: {
      capabilityType:
        'GIT_READ',
      action:
        'WORKTREE_STATUS',
      riskLevel:
        'R0',
      targetRequired:
        false
    },

    GIT_DIFF: {
      capabilityType:
        'GIT_READ',
      action:
        'WORKTREE_DIFF',
      riskLevel:
        'R0',
      targetRequired:
        false
    },

    RUN_FIXED_VALIDATION: {
      capabilityType:
        'PROCESS_VALIDATION',
      action:
        'NODE_SYNTAX_CHECK',
      riskLevel:
        'R1',
      targetRequired:
        true
    }
  });

const RESULT_STATUSES =
  Object.freeze(
    new Set([
      'COMPLETED',
      'FAILED'
    ])
  );

function deepFreeze(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (
    const child
    of Object.values(value)
  ) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(
      canonicalize
    );
  }

  if (
    value &&
    typeof value === 'object'
  ) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(
          (key) => [
            key,
            canonicalize(value[key])
          ]
        )
    );
  }

  return value;
}

function fingerprint(
  label,
  value
) {
  return crypto
    .createHash('sha256')
    .update(
      `${label}\0${
        JSON.stringify(
          canonicalize(value)
        )
      }`
    )
    .digest('hex');
}

function requireText(
  value,
  label,
  maximum = 4096
) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value !== value.trim() ||
    value.length > maximum ||
    value.includes('\0')
  ) {
    throw new Error(
      `${label} is malformed.`
    );
  }

  return value;
}

function requireTimestamp(
  value,
  label
) {
  const text =
    requireText(
      value,
      label,
      64
    );

  const milliseconds =
    Date.parse(text);

  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds)
      .toISOString() !== text
  ) {
    throw new Error(
      `${label} is malformed.`
    );
  }

  return text;
}

function requireFingerprint(
  value,
  label
) {
  const text =
    requireText(
      value,
      label,
      64
    );

  if (
    !/^[a-f0-9]{64}$/.test(text)
  ) {
    throw new Error(
      `${label} is malformed.`
    );
  }

  return text;
}

function exactKeys(
  value,
  expected,
  label
) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${label} is malformed.`
    );
  }

  const actual =
    Object.keys(value)
      .sort();

  const canonicalExpected =
    [...expected]
      .sort();

  if (
    JSON.stringify(actual) !==
      JSON.stringify(
        canonicalExpected
      )
  ) {
    throw new Error(
      `${label} has an unsupported surface.`
    );
  }
}

function normalizeTarget(
  value,
  required
) {
  if (!required) {
    if (
      value !== null &&
      value !== undefined
    ) {
      throw new Error(
        'Machine access target must be null for a workspace operation.'
      );
    }

    return null;
  }

  const target =
    requireText(
      value,
      'Machine access target',
      2048
    );

  if (
    target.startsWith('/') ||
    /^[a-zA-Z]:[\\/]/.test(target) ||
    target.startsWith('\\\\') ||
    target
      .split(/[\\/]+/)
      .some(
        (part) =>
          part === '..' ||
          part === '.' ||
          !part
      )
  ) {
    throw new Error(
      'Machine access target must be a canonical relative identity.'
    );
  }

  return target;
}

function operationProfile(
  operationType
) {
  const type =
    requireText(
      operationType,
      'Machine access operation type',
      64
    );

  const profile =
    OPERATION_PROFILES[type];

  if (!profile) {
    throw new Error(
      'Machine access operation type is unsupported.'
    );
  }

  return {
    type,
    profile
  };
}

function createMachineAccessRequest(
  input
) {
  exactKeys(
    input,
    [
      'requestId',
      'operationId',
      'workspace',
      'operationType',
      'target',
      'purpose',
      'requestedAt'
    ],
    'Machine access request input'
  );

  const selected =
    operationProfile(
      input.operationType
    );

  const fields = {
    schema:
      SCHEMAS.request,

    requestId:
      requireText(
        input.requestId,
        'Machine access requestId',
        256
      ),

    operationId:
      requireText(
        input.operationId,
        'Machine access operationId',
        256
      ),

    workspace:
      requireText(
        input.workspace,
        'Machine access workspace',
        4096
      ),

    operationType:
      selected.type,

    target:
      normalizeTarget(
        input.target,
        selected.profile
          .targetRequired
      ),

    purpose:
      requireText(
        input.purpose,
        'Machine access purpose',
        1024
      ),

    requestedAt:
      requireTimestamp(
        input.requestedAt,
        'Machine access requestedAt'
      ),

    capabilityType:
      selected.profile
        .capabilityType,

    action:
      selected.profile.action,

    riskLevel:
      selected.profile
        .riskLevel
  };

  return deepFreeze({
    ...fields,
    fingerprint:
      fingerprint(
        SCHEMAS.request,
        fields
      )
  });
}

function validateRequest(
  request
) {
  exactKeys(
    request,
    [
      'schema',
      'requestId',
      'operationId',
      'workspace',
      'operationType',
      'target',
      'purpose',
      'requestedAt',
      'capabilityType',
      'action',
      'riskLevel',
      'fingerprint'
    ],
    'Machine access request'
  );

  if (
    request.schema !==
      SCHEMAS.request ||
    !Object.isFrozen(request)
  ) {
    throw new Error(
      'Machine access request is not authoritative evidence.'
    );
  }

  const rebuilt =
    createMachineAccessRequest({
      requestId:
        request.requestId,
      operationId:
        request.operationId,
      workspace:
        request.workspace,
      operationType:
        request.operationType,
      target:
        request.target,
      purpose:
        request.purpose,
      requestedAt:
        request.requestedAt
    });

  if (
    rebuilt.fingerprint !==
      requireFingerprint(
        request.fingerprint,
        'Machine access request fingerprint'
      )
  ) {
    throw new Error(
      'Machine access request fingerprint mismatch.'
    );
  }

  return request;
}

function createMachineAccessAuthority({
  authorityId,
  request,
  grantEvaluation,
  issuedAt,
  expiresAt
}) {
  const authoritativeRequest =
    validateRequest(request);

  if (
    !grantEvaluation ||
    typeof grantEvaluation !==
      'object' ||
    Array.isArray(
      grantEvaluation
    ) ||
    !Object.isFrozen(
      grantEvaluation
    ) ||
    grantEvaluation.schema !==
      'sdo.capability_grant_evaluation.v1' ||
    grantEvaluation.decision !==
      'ALLOWED' ||
    !grantEvaluation.grant ||
    !Object.isFrozen(
      grantEvaluation.grant
    )
  ) {
    throw new Error(
      'Machine access authority requires a frozen allowed capability grant.'
    );
  }

  const grant =
    grantEvaluation.grant;

  if (
    grant.operationId !==
      authoritativeRequest
        .operationId ||
    grant.workspace !==
      authoritativeRequest
        .workspace ||
    grant.capabilityType !==
      authoritativeRequest
        .capabilityType ||
    grant.action !==
      authoritativeRequest.action ||
    grant.riskLevel !==
      authoritativeRequest
        .riskLevel ||
    grant.policyDecision !==
      'ALLOWED' ||
    grant.lifecycleState !==
      'PENDING'
  ) {
    throw new Error(
      'Capability grant does not match the machine access request.'
    );
  }

  const normalizedIssuedAt =
    requireTimestamp(
      issuedAt,
      'Machine access authority issuedAt'
    );

  const normalizedExpiresAt =
    requireTimestamp(
      expiresAt,
      'Machine access authority expiresAt'
    );

  if (
    Date.parse(
      normalizedExpiresAt
    ) <=
      Date.parse(
        normalizedIssuedAt
      )
  ) {
    throw new Error(
      'Machine access authority expiry is invalid.'
    );
  }

  const fields = {
    schema:
      SCHEMAS.authority,

    authorityId:
      requireText(
        authorityId,
        'Machine access authorityId',
        256
      ),

    operationId:
      authoritativeRequest
        .operationId,

    workspace:
      authoritativeRequest
        .workspace,

    operationType:
      authoritativeRequest
        .operationType,

    requestFingerprint:
      authoritativeRequest
        .fingerprint,

    grantFingerprint:
      requireFingerprint(
        grant.fingerprint,
        'Capability grant fingerprint'
      ),

    capabilityType:
      authoritativeRequest
        .capabilityType,

    action:
      authoritativeRequest.action,

    riskLevel:
      authoritativeRequest
        .riskLevel,

    issuedAt:
      normalizedIssuedAt,

    expiresAt:
      normalizedExpiresAt
  };

  return deepFreeze({
    ...fields,
    fingerprint:
      fingerprint(
        SCHEMAS.authority,
        fields
      )
  });
}

function createMachineAccessOperation({
  request,
  authority
}) {
  const authoritativeRequest =
    validateRequest(request);

  if (
    !authority ||
    typeof authority !==
      'object' ||
    Array.isArray(authority) ||
    !Object.isFrozen(authority) ||
    authority.schema !==
      SCHEMAS.authority ||
    authority.operationId !==
      authoritativeRequest
        .operationId ||
    authority.workspace !==
      authoritativeRequest
        .workspace ||
    authority.operationType !==
      authoritativeRequest
        .operationType ||
    authority.requestFingerprint !==
      authoritativeRequest
        .fingerprint
  ) {
    throw new Error(
      'Machine access authority is missing or request-bound incorrectly.'
    );
  }

  const fields = {
    schema:
      SCHEMAS.operation,

    operationId:
      authoritativeRequest
        .operationId,

    workspace:
      authoritativeRequest
        .workspace,

    operationType:
      authoritativeRequest
        .operationType,

    target:
      authoritativeRequest.target,

    purpose:
      authoritativeRequest
        .purpose,

    capabilityType:
      authoritativeRequest
        .capabilityType,

    action:
      authoritativeRequest.action,

    riskLevel:
      authoritativeRequest
        .riskLevel,

    requestFingerprint:
      authoritativeRequest
        .fingerprint,

    authorityFingerprint:
      requireFingerprint(
        authority.fingerprint,
        'Machine access authority fingerprint'
      )
  };

  return deepFreeze({
    ...fields,
    fingerprint:
      fingerprint(
        SCHEMAS.operation,
        fields
      )
  });
}

function createMachineAccessEvidence({
  operation,
  adapterEvidence
}) {
  if (
    !operation ||
    typeof operation !==
      'object' ||
    Array.isArray(operation) ||
    !Object.isFrozen(operation) ||
    operation.schema !==
      SCHEMAS.operation
  ) {
    throw new Error(
      'Machine access operation is malformed.'
    );
  }

  if (
    !adapterEvidence ||
    typeof adapterEvidence !==
      'object' ||
    Array.isArray(
      adapterEvidence
    ) ||
    !Object.isFrozen(
      adapterEvidence
    )
  ) {
    throw new Error(
      'Machine access adapter evidence must be frozen.'
    );
  }

  if (
    adapterEvidence.operationId !==
      operation.operationId ||
    adapterEvidence.workspace !==
      operation.workspace
  ) {
    throw new Error(
      'Machine access adapter evidence context mismatch.'
    );
  }

  const fields = {
    schema:
      SCHEMAS.evidence,

    operationId:
      operation.operationId,

    workspace:
      operation.workspace,

    operationType:
      operation.operationType,

    operationFingerprint:
      requireFingerprint(
        operation.fingerprint,
        'Machine access operation fingerprint'
      ),

    adapterSchema:
      requireText(
        adapterEvidence.schema,
        'Machine access adapter evidence schema',
        256
      ),

    adapterEvidence
  };

  return deepFreeze({
    ...fields,
    fingerprint:
      fingerprint(
        SCHEMAS.evidence,
        fields
      )
  });
}

function createMachineAccessResult({
  operation,
  status,
  evidence = null,
  reason = null
}) {
  if (
    !operation ||
    typeof operation !==
      'object' ||
    !Object.isFrozen(operation) ||
    operation.schema !==
      SCHEMAS.operation
  ) {
    throw new Error(
      'Machine access operation is malformed.'
    );
  }

  if (
    !RESULT_STATUSES.has(status)
  ) {
    throw new Error(
      'Machine access result status is unsupported.'
    );
  }

  if (
    status === 'COMPLETED' &&
    (
      !evidence ||
      !Object.isFrozen(evidence) ||
      evidence.schema !==
        SCHEMAS.evidence ||
      evidence.operationId !==
        operation.operationId ||
      evidence.operationFingerprint !==
        operation.fingerprint
    )
  ) {
    throw new Error(
      'Completed machine access requires bound evidence.'
    );
  }

  if (
    status === 'FAILED' &&
    (
      typeof reason !== 'string' ||
      !reason.trim()
    )
  ) {
    throw new Error(
      'Failed machine access requires a reason.'
    );
  }

  const fields = {
    schema:
      SCHEMAS.result,

    operationId:
      operation.operationId,

    workspace:
      operation.workspace,

    operationType:
      operation.operationType,

    operationFingerprint:
      operation.fingerprint,

    status,

    evidence:
      status === 'COMPLETED'
        ? evidence
        : null,

    reason:
      status === 'FAILED'
        ? reason.trim()
        : null
  };

  return deepFreeze({
    ...fields,
    fingerprint:
      fingerprint(
        SCHEMAS.result,
        fields
      )
  });
}

module.exports =
  Object.freeze({
    createMachineAccessRequest,
    createMachineAccessAuthority,
    createMachineAccessOperation,
    createMachineAccessEvidence,
    createMachineAccessResult
  });
