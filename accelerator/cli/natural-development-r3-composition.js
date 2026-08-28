'use strict';

/*
 * G5 is the narrow operational bridge from exact G1-G4 evidence to the
 * already-qualified R3 patch path. It creates no alternative mutation,
 * journal, signer, clock or Manifest CAS implementation.
 */

const crypto = require('node:crypto');

const {
  discover
} = require('../core/repository-discovery');

const {
  orchestrate
} = require('../core/surgical-orchestrator');

const {
  evaluateNaturalDevelopmentTaskBoundary
} = require('./natural-development-task-contract');

const {
  evaluateNaturalDevelopmentPatchAuthorization
} = require('./natural-development-patch-authorization');

const {
  createGovernedPatchRequest
} = require('./governed-patch-dispatch');

const RESULT_SCHEMA =
  'sdo.natural_development_r3_composition_result.v1';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}

function replacementFromProposal(proposal) {
  if (
    !proposal ||
    proposal.schema !== 'sdo.natural_development_patch_proposal.v1' ||
    !Object.isFrozen(proposal) ||
    typeof proposal.replacementBase64 !== 'string'
  ) {
    throw new Error('Immutable exact G3 patch proposal is required.');
  }

  const replacement = Buffer.from(proposal.replacementBase64, 'base64');

  if (
    replacement.length === 0 ||
    replacement.toString('base64') !== proposal.replacementBase64 ||
    replacement.length !== proposal.replacementBytes ||
    crypto.createHash('sha256').update(replacement).digest('hex') !==
      proposal.replacementSha256
  ) {
    throw new Error('Exact G3 replacement content is malformed.');
  }

  return replacement.toString('utf8');
}

function validateTaskAnchors(
  contract,
  proposal,
  physicalWorkspaceIdentity,
  repository
) {
  if (
    !contract ||
    !Object.isFrozen(contract) ||
    proposal.contractFingerprint !== contract.contractFingerprint ||
    repository.repository.commit !== contract.repositoryHead
  ) {
    throw new Error('G1 contract or repository HEAD is stale.');
  }

  const boundary = evaluateNaturalDevelopmentTaskBoundary(
    contract,
    Object.freeze({
      physicalWorkspaceIdentity,
      repositoryHead: repository.repository.commit,
      target: proposal.target,
      risk: 'R3',
      validationKind: proposal.validationKind,
      evidenceStep: 1,
      patchAttempt: proposal.patchAttempt,
      mutating: true,
      credentialUse: false,
      externalSideEffect: false,
      architecturalDecision: false,
      genericShell: false,
      conflictOrRecoveryRequired: false
    })
  );

  if (
    boundary.decision !== 'CONTAINED' ||
    boundary.requiresExactR3Authority !== true
  ) {
    throw new Error(
      `G5 task boundary denied composition: ${boundary.stopCondition}.`
    );
  }
}

function successfulCasEvidence(orchestration) {
  const execution = orchestration && orchestration.execution;
  const mutationProvider = execution && execution.mutationProvider;
  const durability = mutationProvider && mutationProvider.durability;
  const materialization = durability && durability.materialization;
  const authority = durability && durability.authority;
  const transaction = execution && execution.transaction;

  if (
    !orchestration ||
    orchestration.orchestration.status !== 'COMPLETED' ||
    execution.outcome !== 'APPLIED' ||
    !transaction ||
    !/^[a-f0-9]{64}$/.test(transaction.transactionId || '') ||
    !/^[a-f0-9]{64}$/.test(transaction.journalId || '') ||
    !authority ||
    !/^[a-f0-9]{40,64}$/.test(authority.afterManifestOid || '') ||
    !materialization ||
    materialization.expectedManifestOid !== authority.afterManifestOid ||
    materialization.observedManifestOid !== authority.afterManifestOid ||
    typeof materialization.projection !== 'string' ||
    !materialization.projection
  ) {
    throw new Error(
      'G5 requires completed R3 journal and Manifest CAS evidence.'
    );
  }

  return {
    transactionId: transaction.transactionId,
    journalId: transaction.journalId,
    afterManifestOid: authority.afterManifestOid,
    managedProjection: materialization.projection,
    ordinaryWorktreeAuthoritative:
      durability.ordinaryWorktreeAuthoritative
  };
}

function composeAndDispatchNaturalDevelopmentPatch({
  contract,
  patchProposal,
  patchAuthorization,
  physicalWorkspaceIdentity,
  repositoryPath,
  authorityRoot,
  journalStorageRoot,
  tenantId = null,
  projectId = null
} = {}) {
  const repository = discover(repositoryPath);

  validateTaskAnchors(
    contract,
    patchProposal,
    physicalWorkspaceIdentity,
    repository
  );

  const replacement = replacementFromProposal(patchProposal);

  const prepared = createGovernedPatchRequest({
    repositoryPath: repository.repository.path,
    target: patchProposal.target,
    replacement,
    authorityRoot,
    journalStorageRoot,
    tenantId,
    projectId
  });

  if (
    prepared.authority.target !== patchProposal.target ||
    prepared.authority.beforeSha256 !== patchProposal.beforeSha256 ||
    prepared.authority.replacementSha256 !==
      patchProposal.replacementSha256
  ) {
    throw new Error(
      'Prepared R3 authority differs from exact G3 content.'
    );
  }

  const authorizationObservation =
    prepared.runtime.authoritativeClock.observe();

  if (
    !authorizationObservation ||
    authorizationObservation.decision !== 'ALLOWED'
  ) {
    throw new Error(
      'Authoritative system clock denied G4 consumption.'
    );
  }

  const authorizationEvaluation =
    evaluateNaturalDevelopmentPatchAuthorization(
      patchAuthorization,
      patchProposal,
      {
        temporalAuthority: {
          reading: authorizationObservation.reading,
          requireCurrent: true
        },
        expectedHumanSubject: prepared.authority.subjectId,
        expectedHumanIdentityIssuer: prepared.authority.issuer
      }
    );

  if (authorizationEvaluation.decision !== 'ALLOWED') {
    throw new Error(
      `G4 authorization denied R3 composition: ${authorizationEvaluation.reason}`
    );
  }

  const g10ClaimContext =
    _g9ClaimBeforeRealG5Dispatch(arguments);

  const orchestration = orchestrate(
    prepared.request,
    prepared.runtime
  );

  const cas = successfulCasEvidence(orchestration);

  /*
   * G10_DURABLE_POST_DISPATCH_CONSUMPTION
   *
   * The exact G9 claim is consumed only after the real G5 Orchestrator result
   * has passed the existing Journal + Manifest CAS qualification.
   */
  const g10EffectBinding = deepFreeze({
    schema:
      'sdo.natural_development_production_effect_binding.v1',
    authorizationFingerprint:
      patchAuthorization.authorizationFingerprint,
    operationId:
      prepared.authority.operationId,
    physicalWorkspaceIdentity,
    target:
      patchProposal.target,
    beforeSha256:
      patchProposal.beforeSha256,
    replacementSha256:
      patchProposal.replacementSha256,
    transactionId:
      cas.transactionId,
    journalId:
      cas.journalId,
    manifestAfterOid:
      cas.afterManifestOid
  });

  const g10EffectFingerprint =
    fingerprint(g10EffectBinding);

  const g10Consumption =
    _g10LinearizableConsumption
      .commitLinearizableNaturalDevelopmentAuthorizationConsumption({
        stateRoot:
          g10ClaimContext.stateRoot,
        claim:
          g10ClaimContext.claim,
        transactionId:
          cas.transactionId,
        journalId:
          cas.journalId,
        effectFingerprint:
          g10EffectFingerprint,
        manifestAfterOid:
          cas.afterManifestOid
      });

  if (
    !g10Consumption ||
    g10Consumption.state !== 'CONSUMED' ||
    g10Consumption.authorizationFingerprint !==
      patchAuthorization.authorizationFingerprint ||
    g10Consumption.transactionId !==
      cas.transactionId ||
    g10Consumption.journalId !==
      cas.journalId ||
    g10Consumption.effectFingerprint !==
      g10EffectFingerprint ||
    g10Consumption.manifestAfterOid !==
      cas.afterManifestOid ||
    g10Consumption.operationalAuthority !== false ||
    g10Consumption.mutationAuthority !== false ||
    g10Consumption.dispatchAuthority !== false
  ) {
    throw new Error(
      'G10 durable post-dispatch authorization consumption was not exactly confirmed.'
    );
  }


  const binding = deepFreeze({
    schema: RESULT_SCHEMA,
    status: 'COMPLETED',
    contractFingerprint: contract.contractFingerprint,
    planningFingerprint: patchProposal.planningFingerprint,
    proposalFingerprint: patchProposal.proposalFingerprint,
    authorizationFingerprint:
      patchAuthorization.authorizationFingerprint,
    diffFingerprint: patchProposal.exactDiff.diffFingerprint,
    workspace: repository.repository.path,
    physicalWorkspaceIdentity,
    repositoryHead: repository.repository.commit,
    r3OperationId: prepared.authority.operationId,
    target: patchProposal.target,
    beforeSha256: patchProposal.beforeSha256,
    afterSha256: patchProposal.replacementSha256,
    transactionId: cas.transactionId,
    journalId: cas.journalId,
    afterManifestOid: cas.afterManifestOid,
    managedProjection: cas.managedProjection,
    ordinaryWorktreeAuthoritative:
      cas.ordinaryWorktreeAuthoritative,
    authorizationUseRecorded: true,
    durableAntiReplayQualified: true,
    authorizationConsumptionFingerprint:
      g10Consumption.consumptionFingerprint,
    effectFingerprint:
      g10EffectFingerprint,
    nextRequiredStage: 'G6_VALIDATION_AND_RECOVERY_RECONCILIATION',
    genericShellAuthority: false,
    credentialAuthority: false,
    externalSideEffectAuthority: false
  });

  return deepFreeze({
    ...binding,
    compositionFingerprint: fingerprint(binding)
  });
}


/*
 * G9_DURABLE_CLAIM_BEFORE_REAL_G5_DISPATCH
 *
 * This boundary intentionally performs only the G7 durable authorization
 * claim.  It creates no dispatch authority.  The claim is invoked only at the
 * already-qualified G5 orchestration point, after G5 has completed its own
 * stale-HEAD, identity, expiry, G1-G4 and exact-patch checks.
 *
 * If the process stops after this durable claim, G8 recovery may reconcile
 * physical/journal/CAS evidence, but the same human authorization cannot be
 * replayed for another physical attempt.
 */
const _g9Path =
  require('node:path');

const _g9Authorization =
  require(
    './natural-development-authorization-consumption'
  );

const _g9AuthorizationStore =
  require(
    '../adapters/natural-development-authorization-consumption-store'
  );

const _g10LinearizableConsumption =
  require(
    '../adapters/natural-development-linearizable-consumption'
  );

function _g9Objects(value, seen = new Set(), output = []) {
  if (
    !value ||
    typeof value !== 'object' ||
    seen.has(value)
  ) {
    return output;
  }

  seen.add(value);
  output.push(value);

  if (Array.isArray(value)) {
    for (const child of value) {
      _g9Objects(child, seen, output);
    }
    return output;
  }

  for (const child of Object.values(value)) {
    _g9Objects(child, seen, output);
  }

  return output;
}

function _g9CanonicalSha(value) {
  return (
    typeof value === 'string' &&
    /^[a-f0-9]{64}$/.test(value)
  );
}

function _g9Text(value) {
  return (
    typeof value === 'string' &&
    value.trim()
  )
    ? value.trim()
    : null;
}

function _g9Unique(values, label) {
  const normalized =
    [...new Set(values.filter((value) => value !== null && value !== undefined))];

  if (normalized.length !== 1) {
    throw new Error(
      'G9 could not derive one exact ' +
      label +
      ' from the already-validated G5 invocation.'
    );
  }

  return normalized[0];
}

function _g9PropertyValues(objects, keys, predicate = () => true) {
  const output = [];

  for (const object of objects) {
    for (const key of keys) {
      if (
        Object.prototype.hasOwnProperty.call(object, key) &&
        predicate(object[key])
      ) {
        output.push(object[key]);
      }
    }
  }

  return output;
}

function _g9AuthorizationEvidence(objects) {
  const candidates =
    objects.filter((object) => {
      if (
        !_g9CanonicalSha(
          object.authorizationFingerprint
        )
      ) {
        return false;
      }

      return (
        object.singleUse === true ||
        object.reusable === false ||
        object.reusableApproval === false
      );
    });

  if (candidates.length === 0) {
    throw new Error(
      'G9 requires the exact immutable G4 single-use authorization at the real G5 dispatch boundary.'
    );
  }

  const fingerprints =
    [...new Set(
      candidates.map(
        (candidate) =>
          candidate.authorizationFingerprint
      )
    )];

  if (fingerprints.length !== 1) {
    throw new Error(
      'G9 found conflicting G4 authorization fingerprints.'
    );
  }

  const exact =
    candidates.find(
      (candidate) =>
        Object.isFrozen(candidate) &&
        candidate.authorizationFingerprint ===
          fingerprints[0]
    );

  if (!exact) {
    throw new Error(
      'G9 requires immutable G4 authorization evidence.'
    );
  }

  return exact;
}

function _g9PatchBinding(objects, authorization) {
  const patchCandidates =
    objects.filter((object) => {
      const before =
        object.beforeSha256;
      const replacement =
        object.replacementSha256;

      return (
        _g9CanonicalSha(before) &&
        _g9CanonicalSha(replacement)
      );
    });

  if (patchCandidates.length === 0) {
    throw new Error(
      'G9 could not locate exact BEFORE/replacement evidence.'
    );
  }

  const targetValues = [];

  for (const candidate of patchCandidates) {
    const direct =
      _g9Text(candidate.target);

    if (direct) {
      targetValues.push({
        target: direct,
        beforeSha256:
          candidate.beforeSha256,
        replacementSha256:
          candidate.replacementSha256
      });
      continue;
    }

    const nested =
      candidate.target &&
      typeof candidate.target === 'object'
        ? _g9Text(
            candidate.target.path ||
            candidate.target.requested
          )
        : null;

    if (nested) {
      targetValues.push({
        target: nested,
        beforeSha256:
          candidate.beforeSha256,
        replacementSha256:
          candidate.replacementSha256
      });
    }
  }

  if (
    authorization.target &&
    _g9Text(authorization.target)
  ) {
    const expected =
      _g9Text(authorization.target);

    const filtered =
      targetValues.filter(
        (item) => item.target === expected
      );

    if (filtered.length > 0) {
      targetValues.splice(
        0,
        targetValues.length,
        ...filtered
      );
    }
  }

  const tuples =
    new Map();

  for (const item of targetValues) {
    const key =
      JSON.stringify(item);
    tuples.set(key, item);
  }

  if (tuples.size !== 1) {
    throw new Error(
      'G9 exact target/BEFORE/replacement binding is ambiguous.'
    );
  }

  return [...tuples.values()][0];
}

function _g9ClaimBeforeRealG5Dispatch(invocationArguments) {
  const objects =
    _g9Objects(
      Array.from(invocationArguments)
    );

  const authorization =
    _g9AuthorizationEvidence(objects);

  const patch =
    _g9PatchBinding(
      objects,
      authorization
    );

  const operationId =
    _g9Text(
      authorization.operationId
    ) ||
    _g9Unique(
      _g9PropertyValues(
        objects,
        ['operationId'],
        (value) => Boolean(_g9Text(value))
      ).map(_g9Text),
      'operationId'
    );

  const physicalWorkspaceIdentity =
    (
      _g9CanonicalSha(
        authorization.physicalWorkspaceIdentity
      )
        ? authorization.physicalWorkspaceIdentity
        : null
    ) ||
    _g9Unique(
      _g9PropertyValues(
        objects,
        ['physicalWorkspaceIdentity'],
        _g9CanonicalSha
      ),
      'physical workspace identity'
    );

  const journalStorageRoot =
    _g9Unique(
      _g9PropertyValues(
        objects,
        [
          'journalStorageRoot',
          'mutationJournalStorageRoot'
        ],
        (value) =>
          Boolean(_g9Text(value)) &&
          _g9Path.isAbsolute(value)
      ).map(_g9Text),
      'production mutation journal storage root'
    );

  const claim =
    _g9Authorization
      .createNaturalDevelopmentAuthorizationClaim({
        authorization,
        operationId,
        physicalWorkspaceIdentity,
        target:
          patch.target,
        beforeSha256:
          patch.beforeSha256,
        replacementSha256:
          patch.replacementSha256
      });

  const stateRoot =
    _g9Path.join(
      journalStorageRoot,
      '.natural-development-authorization-consumption'
    );

  const receipt =
    _g9AuthorizationStore
      .claimNaturalDevelopmentAuthorization({
        stateRoot,
        claim
      });

  if (
    !receipt ||
    receipt.state !== 'CLAIMED' ||
    receipt.authorizationFingerprint !==
      claim.authorizationFingerprint ||
    receipt.operationalAuthority !== false ||
    receipt.mutationAuthority !== false
  ) {
    throw new Error(
      'G9 durable authorization claim was not confirmed before real G5 dispatch.'
    );
  }

  const g9Receipt =
    receipt;

  return Object.freeze({
    receipt: g9Receipt,
    claim,
    stateRoot
  });
}

module.exports = Object.freeze({
  RESULT_SCHEMA,
  composeAndDispatchNaturalDevelopmentPatch
});
