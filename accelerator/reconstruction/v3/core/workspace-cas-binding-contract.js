'use strict';

const CONTRACT_SCHEMA =
  'sdo.reconstruction.workspace_cas_binding.v1';

function deepFreeze(value) {
  if (
    value &&
    typeof value === 'object' &&
    !Object.isFrozen(value)
  ) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    Object.freeze(value);
  }

  return value;
}

function denied(reason) {
  return deepFreeze({
    schema: CONTRACT_SCHEMA,
    decision: 'DENIED',
    reason,
    binding: null
  });
}

function isObject(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function exactKeys(value, keys) {
  if (!isObject(value)) {
    return false;
  }

  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();

  return (
    actual.length === expected.length &&
    actual.every(
      (key, index) => key === expected[index]
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

function sha256(value) {
  return (
    typeof value === 'string' &&
    /^[a-f0-9]{64}$/.test(value)
  )
    ? value
    : null;
}

function oid(value) {
  return (
    typeof value === 'string' &&
    (
      /^[a-f0-9]{40}$/.test(value) ||
      /^[a-f0-9]{64}$/.test(value)
    )
  )
    ? value
    : null;
}

function normalizeWorkspace(value) {
  const keys = [
    'decision',
    'requestedRoot',
    'physicalRoot',
    'requestedTarget',
    'physicalTarget'
  ];

  if (!exactKeys(value, keys)) {
    return null;
  }

  const normalized = {
    decision: value.decision,
    requestedRoot:
      text(value.requestedRoot),
    physicalRoot:
      text(value.physicalRoot),
    requestedTarget:
      text(value.requestedTarget),
    physicalTarget:
      text(value.physicalTarget)
  };

  if (
    normalized.decision !== 'RESOLVED' ||
    !normalized.requestedRoot ||
    !normalized.physicalRoot ||
    !normalized.requestedTarget ||
    !normalized.physicalTarget
  ) {
    return null;
  }

  return normalized;
}

function normalizeProvider(value) {
  const keys = [
    'decision',
    'providerId',
    'qualificationFingerprint',
    'operation',
    'ordinaryWorktreeAuthoritative'
  ];

  if (!exactKeys(value, keys)) {
    return null;
  }

  const normalized = {
    decision: value.decision,
    providerId:
      text(value.providerId),
    qualificationFingerprint:
      sha256(value.qualificationFingerprint),
    operation:
      value.operation,
    ordinaryWorktreeAuthoritative:
      value.ordinaryWorktreeAuthoritative
  };

  if (
    normalized.decision !== 'ALLOWED' ||
    !normalized.providerId ||
    !normalized.qualificationFingerprint ||
    normalized.operation !==
      'COMPARE_AND_REPLACE' ||
    normalized.ordinaryWorktreeAuthoritative !==
      false
  ) {
    return null;
  }

  return normalized;
}

function normalizeCas(value) {
  const keys = [
    'decision',
    'beforeManifestOid',
    'afterManifestOid',
    'beforeSha256',
    'replacementSha256'
  ];

  if (!exactKeys(value, keys)) {
    return null;
  }

  const normalized = {
    decision:
      value.decision,
    beforeManifestOid:
      oid(value.beforeManifestOid),
    afterManifestOid:
      oid(value.afterManifestOid),
    beforeSha256:
      sha256(value.beforeSha256),
    replacementSha256:
      sha256(value.replacementSha256)
  };

  if (
    normalized.decision !== 'APPLIED' ||
    !normalized.beforeManifestOid ||
    !normalized.afterManifestOid ||
    normalized.beforeManifestOid ===
      normalized.afterManifestOid ||
    !normalized.beforeSha256 ||
    !normalized.replacementSha256 ||
    normalized.beforeSha256 ===
      normalized.replacementSha256
  ) {
    return null;
  }

  return normalized;
}

function normalizeMaterialization(value) {
  const keys = [
    'decision',
    'expectedManifestOid',
    'observedManifestOid',
    'contentSha256'
  ];

  if (!exactKeys(value, keys)) {
    return null;
  }

  const normalized = {
    decision:
      value.decision,
    expectedManifestOid:
      oid(value.expectedManifestOid),
    observedManifestOid:
      oid(value.observedManifestOid),
    contentSha256:
      sha256(value.contentSha256)
  };

  if (
    ![
      'MATERIALIZED',
      'ALREADY_MATERIALIZED'
    ].includes(normalized.decision) ||
    !normalized.expectedManifestOid ||
    !normalized.observedManifestOid ||
    !normalized.contentSha256
  ) {
    return null;
  }

  return normalized;
}

function evaluateWorkspaceCasBinding(input) {
  if (
    !exactKeys(
      input,
      [
        'workspace',
        'provider',
        'cas',
        'materialization'
      ]
    )
  ) {
    return denied(
      'Workspace/CAS evidence is missing or malformed.'
    );
  }

  const workspace =
    normalizeWorkspace(input.workspace);
  const provider =
    normalizeProvider(input.provider);
  const cas =
    normalizeCas(input.cas);
  const materialization =
    normalizeMaterialization(
      input.materialization
    );

  if (!workspace) {
    return denied(
      'Qualified physical workspace evidence is unavailable.'
    );
  }

  if (!provider) {
    return denied(
      'Qualified compare-and-replace provider is unavailable.'
    );
  }

  if (!cas) {
    return denied(
      'Authoritative manifest CAS evidence is unavailable.'
    );
  }

  if (!materialization) {
    return denied(
      'Qualified materialization evidence is unavailable.'
    );
  }

  if (
    materialization.expectedManifestOid !==
      cas.afterManifestOid ||
    materialization.observedManifestOid !==
      cas.afterManifestOid ||
    materialization.contentSha256 !==
      cas.replacementSha256
  ) {
    return denied(
      'CAS authority and materialized projection mismatched.'
    );
  }

  return deepFreeze({
    schema: CONTRACT_SCHEMA,
    decision: 'ALLOWED',
    reason:
      'Physical workspace, manifest CAS and materialization are exactly bound.',
    binding: {
      requestedRoot:
        workspace.requestedRoot,
      physicalRoot:
        workspace.physicalRoot,
      requestedTarget:
        workspace.requestedTarget,
      physicalTarget:
        workspace.physicalTarget,
      providerId:
        provider.providerId,
      qualificationFingerprint:
        provider.qualificationFingerprint,
      operation:
        provider.operation,
      beforeSha256:
        cas.beforeSha256,
      replacementSha256:
        cas.replacementSha256,
      beforeManifestOid:
        cas.beforeManifestOid,
      afterManifestOid:
        cas.afterManifestOid,
      ordinaryWorktreeAuthoritative:
        false
    }
  });
}

function describeWorkspaceCasBindingContract() {
  return deepFreeze({
    schema: CONTRACT_SCHEMA,
    defaultDecision: 'DENIED',
    filesystemAuthority: false,
    gitAuthority: false,
    processAuthority: false,
    shellAuthority: false,
    mutationAuthority: false,
    ordinaryWorktreeAuthoritative: false,
    requiredOperation: 'COMPARE_AND_REPLACE'
  });
}

module.exports = Object.freeze({
  CONTRACT_SCHEMA,
  describeWorkspaceCasBindingContract,
  evaluateWorkspaceCasBinding
});
