'use strict';

const {
  evaluateWorkspaceCasBinding
} = require(
  '../core/workspace-cas-binding-contract'
);

const {
  evaluateMutationProvider,
  validateMutationProviderResult
} = require(
  '../../../core/mutation-provider'
);

const {
  providerBoundary
} = require(
  '../../../core/content-addressed-mutation-provider'
);

const PROJECTION_SCHEMA =
  'sdo.reconstruction.qualified_workspace_cas_projection.v1';

function denied() {
  return evaluateWorkspaceCasBinding(null);
}

function validText(value) {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length > 0
  );
}

function validSha256(value) {
  return (
    typeof value === 'string' &&
    /^[a-f0-9]{64}$/.test(value)
  );
}

function validRequest(request) {
  return Boolean(
    request &&
    typeof request === 'object' &&
    Object.isFrozen(request) &&
    request.schema ===
      'sdo.compare_and_replace_request.v1' &&
    request.operation ===
      'COMPARE_AND_REPLACE' &&
    request.phase ===
      'AUTHORIZED_PATCH' &&
    validText(request.workspace) &&
    validText(request.target) &&
    validSha256(request.beforeSha256) &&
    validSha256(request.replacementSha256) &&
    request.beforeSha256 !==
      request.replacementSha256
  );
}

function projectQualifiedWorkspaceCasEvidence(
  input
) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== 2 ||
    !Object.prototype.hasOwnProperty.call(
      input,
      'request'
    ) ||
    !Object.prototype.hasOwnProperty.call(
      input,
      'result'
    ) ||
    !validRequest(input.request)
  ) {
    return denied();
  }

  const request = input.request;
  const decision =
    evaluateMutationProvider(providerBoundary);

  if (
    decision.decision !== 'ALLOWED' ||
    decision.qualificationState !==
      'QUALIFIED' ||
    decision.requestedCapability !==
      'COMPARE_AND_REPLACE' ||
    decision.zeroDispatch !== false
  ) {
    return denied();
  }

  let result;

  try {
    result = validateMutationProviderResult(
      input.result,
      request,
      decision
    );
  } catch {
    return denied();
  }

  if (
    result.outcome !== 'APPLIED' ||
    !result.durability ||
    result.durability.schema !==
      'sdo.content_addressed_provider_evidence.v1' ||
    result.durability
      .ordinaryWorktreeAuthoritative !== false ||
    !result.durability.authority ||
    !result.durability.materialization
  ) {
    return denied();
  }

  const authority =
    result.durability.authority;
  const materialization =
    result.durability.materialization;

  if (
    authority.workspace !== request.workspace ||
    authority.beforeSha256 !==
      request.beforeSha256 ||
    authority.replacementSha256 !==
      request.replacementSha256 ||
    materialization.contentSha256 !==
      request.replacementSha256
  ) {
    return denied();
  }

  return evaluateWorkspaceCasBinding({
    workspace: {
      decision:
        'RESOLVED',
      requestedRoot:
        request.workspace,
      physicalRoot:
        authority.workspace,
      requestedTarget:
        request.target,
      physicalTarget:
        result.target
    },

    provider: {
      decision:
        decision.decision,
      providerId:
        decision.providerId,
      qualificationFingerprint:
        decision.qualificationFingerprint,
      operation:
        request.operation,
      ordinaryWorktreeAuthoritative:
        result.durability
          .ordinaryWorktreeAuthoritative
    },

    cas: {
      decision:
        authority.decision,
      beforeManifestOid:
        authority.beforeManifestOid,
      afterManifestOid:
        authority.afterManifestOid,
      beforeSha256:
        authority.beforeSha256,
      replacementSha256:
        authority.replacementSha256
    },

    materialization: {
      decision:
        materialization.decision,
      expectedManifestOid:
        materialization.expectedManifestOid,
      observedManifestOid:
        materialization.observedManifestOid,
      contentSha256:
        materialization.contentSha256
    }
  });
}

function describeQualifiedWorkspaceCasProjection() {
  return Object.freeze({
    schema:
      PROJECTION_SCHEMA,
    defaultDecision:
      'DENIED',
    sourceProviderId:
      providerBoundary.qualification.providerId,
    requiredOperation:
      'COMPARE_AND_REPLACE',
    filesystemAuthority:
      false,
    gitAuthority:
      false,
    processAuthority:
      false,
    shellAuthority:
      false,
    providerSelectionAuthority:
      false,
    providerQualificationAuthority:
      false,
    mutationAuthority:
      false,
    productionConsumerMigrated:
      false
  });
}

module.exports = Object.freeze({
  PROJECTION_SCHEMA,
  describeQualifiedWorkspaceCasProjection,
  projectQualifiedWorkspaceCasEvidence
});
