'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

const {
  orchestrate
} = require('../core/surgical-orchestrator');

const {
  discover
} = require('../core/repository-discovery');

const {
  resolveInspectedFile
} = require('../core/workspace-boundary');

const {
  evaluateR3ApprovalAuthority
} = require('../core/risk-classification');

const {
  evaluateCapabilityGrant
} = require('../core/capability-grant');

const {
  createOperationRecord
} = require('../core/operation-record');

const {
  createLifecycle
} = require('../core/state-boundary');

const {
  verifyHumanIdentityAssertion
} = require('../adapters/identity-verification-adapter');

const {
  createProductionMutationRuntime
} = require('../core/production-mutation-runtime');

const {
  loadLocalOfflineHumanSigner,
  readLocalOfflineHumanPublicAuthority
} = require('../core/local-offline-human-authority-store');

const AUDIENCE = 'surgical-devops';

function text(value, label) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

function freeze(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (const child of Object.values(value)) {
    freeze(child);
  }

  return Object.freeze(value);
}

function operationIdentity({
  workspace,
  target,
  beforeSha256,
  replacementSha256,
  issuedAt
}) {
  return sha256(
    [
      'sdo.governed_patch_cli.v1',
      workspace,
      target,
      beforeSha256,
      replacementSha256,
      issuedAt
    ].join('\0')
  );
}

function physicalEvidence(discovery) {
  return {
    path: discovery.repository.path,
    branch: discovery.repository.branch,
    commit: discovery.repository.commit,
    shortCommit: discovery.repository.shortCommit,
    clean: discovery.worktree.clean,
    changedFiles: discovery.worktree.changedFiles
  };
}

function createGovernedPatchRequest(
  {
    repositoryPath,
    target,
    replacement,
    authorityRoot,
    journalStorageRoot,
    tenantId = null,
    projectId = null
  }
) {
  const repository =
    discover(
      text(
        repositoryPath,
        'Repository path'
      )
    );

  const workspace =
    repository.repository.path;

  const requestedTarget =
    text(target, 'Patch target');

  if (
    typeof replacement !== 'string'
  ) {
    throw new Error(
      'Patch replacement must be an explicit string.'
    );
  }

  if (!repository.worktree.clean) {
    throw new Error(
      'Governed patch requires a clean worktree.'
    );
  }

  const resolved =
    resolveInspectedFile(
      workspace,
      requestedTarget
    );

  const targetStat =
    fs.lstatSync(
      resolved.canonicalTarget
    );

  if (
    !targetStat.isFile() ||
    targetStat.isSymbolicLink()
  ) {
    throw new Error(
      'Governed patch target must be a physical regular file.'
    );
  }

  const before =
    fs.readFileSync(
      resolved.canonicalTarget
    );

  const beforeHash =
    sha256(before);

  const replacementHash =
    sha256(replacement);

  const publicAuthority =
    readLocalOfflineHumanPublicAuthority({
      authorityRoot:
        text(
          authorityRoot,
          'Human authority root'
        )
    });

  const signer =
    loadLocalOfflineHumanSigner({
      authorityRoot:
        text(
          authorityRoot,
          'Human authority root'
        )
    });

  const runtime =
    createProductionMutationRuntime({
      journalStorageRoot:
        text(
          journalStorageRoot,
          'Mutation journal root'
        ),

      humanAuthorityPublicKeyPem:
        publicAuthority.publicKeyPem,

      humanAuthorityIssuer:
        publicAuthority.issuer,

      humanSubjectId:
        publicAuthority.subjectId,

      identityAudience:
        AUDIENCE
    });

  const initialObservation =
    runtime.authoritativeClock.observe();

  if (
    !initialObservation ||
    initialObservation.decision !== 'ALLOWED'
  ) {
    throw new Error(
      'Authoritative system clock denied patch preparation.'
    );
  }

  const issuedAt =
    initialObservation.reading.wallTime;

  const expiresAt =
    new Date(
      Date.parse(issuedAt) + 5 * 60_000
    ).toISOString();

  const operationDigest =
    operationIdentity({
      workspace,
      target: requestedTarget,
      beforeSha256: beforeHash,
      replacementSha256: replacementHash,
      issuedAt
    });

  const operationId =
    `cli-patch-${operationDigest}`;

  const challenge = freeze({
    schema:
      'sdo.local_offline_human_challenge.v1',

    challengeId:
      `challenge-${operationDigest}`,

    issuer:
      publicAuthority.issuer,

    subjectId:
      publicAuthority.subjectId,

    audience:
      Object.freeze([AUDIENCE]),

    operationId,

    workspace,

    tenantId:
      tenantId === undefined
        ? null
        : tenantId,

    projectId:
      projectId === undefined
        ? null
        : projectId,

    issuedAt,

    expiresAt
  });

  const signedAssertion =
    signer.signChallenge(
      challenge
    );

  const identityObservation =
    runtime.authoritativeClock.observe();

  if (
    !identityObservation ||
    identityObservation.decision !== 'ALLOWED'
  ) {
    throw new Error(
      'Authoritative system clock denied identity verification.'
    );
  }

  const identityVerification =
    verifyHumanIdentityAssertion(
      {
        rawAssertion:
          signedAssertion,

        trustedIssuers:
          runtime.trustedIdentityIssuers,

        expected: {
          subjectId:
            publicAuthority.subjectId,

          audience:
            AUDIENCE,

          operationId,

          workspace,

          tenantId:
            tenantId === undefined
              ? null
              : tenantId,

          projectId:
            projectId === undefined
              ? null
              : projectId
        }
      },

      runtime.identityVerifierPort,

      {
        reading:
          identityObservation.reading,

        requireCurrent:
          true
      }
    );

  if (
    !identityVerification ||
    identityVerification.decision !==
      'VERIFIED'
  ) {
    throw new Error(
      'Local human identity verification was denied.'
    );
  }

  const scope = freeze({
    target: {
      path:
        requestedTarget,

      beforeSha256:
        beforeHash,

      replacementSha256:
        replacementHash
    }
  });

  const approvalObservation =
    runtime.authoritativeClock.observe();

  if (
    !approvalObservation ||
    approvalObservation.decision !== 'ALLOWED'
  ) {
    throw new Error(
      'Authoritative system clock denied R3 approval.'
    );
  }

  const approvalEvaluation =
    evaluateR3ApprovalAuthority(
      {
        approvalAuthorityId:
          `approval-${operationDigest}`,

        operationId,

        approver: {
          id:
            publicAuthority.subjectId,
          type:
            'HUMAN'
        },

        decision:
          'APPROVED',

        riskLevel:
          'R3',

        capabilityType:
          'FILESYSTEM_PATCH',

        action:
          'PATCH_FILE',

        workspace,

        tenantId:
          tenantId === undefined
            ? null
            : tenantId,

        projectId:
          projectId === undefined
            ? null
            : projectId,

        scope,

        verifiedIdentityAssertion:
          identityVerification.assertion,

        policyDecision:
          'APPROVAL_REQUIRED',

        timestamp:
          approvalObservation.reading.wallTime,

        expiresAt
      },

      {
        operationId,
        workspace,
        capabilityType:
          'FILESYSTEM_PATCH',
        action:
          'PATCH_FILE',
        scope,
        riskLevel:
          'R3',
        policyDecision:
          'APPROVAL_REQUIRED',
        tenantId:
          tenantId === undefined
            ? null
            : tenantId,
        projectId:
          projectId === undefined
            ? null
            : projectId
      },

      {
        reading:
          approvalObservation.reading,
        requireCurrent:
          true
      }
    );

  if (
    !approvalEvaluation ||
    approvalEvaluation.decision !==
      'ALLOWED' ||
    !approvalEvaluation.authority
  ) {
    throw new Error(
      'R3 human approval authority was denied.'
    );
  }

  const approvalAuthority =
    approvalEvaluation.authority;

  const common = {
    operationId,
    workspace,
    policyDecision:
      'APPROVAL_REQUIRED',
    riskLevel:
      'R3',
    lifecycleState:
      'PENDING',
    capabilityType:
      'FILESYSTEM_PATCH',
    action:
      'PATCH_FILE',
    scope,
    idempotency:
      'IDEMPOTENT',
    approvalAuthority,
    identityVerification,
    tenantId:
      tenantId === undefined
        ? null
        : tenantId,
    projectId:
      projectId === undefined
        ? null
        : projectId
  };

  const grantEvaluation =
    evaluateCapabilityGrant(
      {
        ...common,
        expiresAt
      },

      {
        ...common
      },

      runtime.authoritativeClock
    );

  if (
    !grantEvaluation ||
    grantEvaluation.decision !==
      'ALLOWED' ||
    !grantEvaluation.grant
  ) {
    throw new Error(
      'R3 filesystem patch capability was denied.'
    );
  }

  const objective =
    `Governed R3 filesystem patch: ${requestedTarget}`;

  const operationRecordEvaluation =
    createOperationRecord(
      {
        operationId,

        requester: {
          id:
            publicAuthority.subjectId,
          type:
            'HUMAN'
        },

        workspace,
        objective,

        policyDecision:
          'APPROVAL_REQUIRED',

        riskLevel:
          'R3',

        idempotency:
          'IDEMPOTENT',

        approvalAuthority,
        identityVerification,

        capabilityType:
          'FILESYSTEM_PATCH',

        action:
          'PATCH_FILE',

        scope,

        tenantId:
          tenantId === undefined
            ? null
            : tenantId,

        projectId:
          projectId === undefined
            ? null
            : projectId,

        events: [
          {
            type:
              'intent',
            operationId,
            timestamp:
              approvalAuthority.timestamp,
            objective
          },
          {
            type:
              'policy',
            operationId,
            timestamp:
              approvalAuthority.timestamp,
            policyDecision:
              'APPROVAL_REQUIRED',
            riskLevel:
              'R3'
          },
          {
            type:
              'approval',
            operationId,
            timestamp:
              approvalAuthority.timestamp,
            approverId:
              approvalAuthority.approver.id,
            decision:
              approvalAuthority.decision,
            approvalTimestamp:
              approvalAuthority.timestamp,
            approvalAuthorityId:
              approvalAuthority.approvalAuthorityId,
            approvalAuthorityFingerprint:
              approvalAuthority.fingerprint,
            verifiedIdentityAssertionFingerprint:
              approvalAuthority
                .verifiedIdentityAssertionFingerprint
          },
          {
            type:
              'state',
            operationId,
            timestamp:
              approvalAuthority.timestamp,
            status:
              'PENDING'
          }
        ]
      },

      runtime.authoritativeClock
    );

  if (
    !operationRecordEvaluation ||
    operationRecordEvaluation.decision !==
      'ALLOWED' ||
    !operationRecordEvaluation.record
  ) {
    throw new Error(
      'R3 operation record was denied.'
    );
  }

  const lifecycle =
    createLifecycle({
      operationId,
      initialState:
        'PENDING',
      before:
        physicalEvidence(repository),
      createdAt:
        approvalAuthority.timestamp
    });

  const execution = freeze({
    adapter:
      'FILESYSTEM_PATCH',

    action:
      'PATCH_FILE',

    operationId,

    workspace,

    target:
      requestedTarget,

    replacement,

    observedAt:
      approvalAuthority.timestamp,

    tenantId:
      tenantId === undefined
        ? null
        : tenantId,

    projectId:
      projectId === undefined
        ? null
        : projectId,

    rawIdentityAssertion:
      signedAssertion,

    grantEvaluation,

    operationRecord:
      operationRecordEvaluation.record,

    lifecycle
  });

  return freeze({
    request: {
      repositoryPath:
        workspace,

      description:
        objective,

      files:
        Object.freeze([
          requestedTarget
        ]),

      mode:
        'PATCH',

      risk:
        'ALTO',

      authorizeExecution:
        true,

      estimatedDiffLines:
        1,

      architecturalChange:
        false,

      policy: {
        decision:
          'APPROVAL_REQUIRED',

        approvalAuthority:
          operationRecordEvaluation
            .record
            .approvalAuthority
      },

      execution
    },

    runtime,

    authority: {
      issuer:
        publicAuthority.issuer,

      subjectId:
        publicAuthority.subjectId,

      operationId,

      challengeId:
        challenge.challengeId,

      target:
        requestedTarget,

      beforeSha256:
        beforeHash,

      replacementSha256:
        replacementHash,

      expiresAt
    }
  });
}

function dispatchGovernedPatch(
  intent,
  repositoryPath,
  options = {}
) {
  if (
    !intent ||
    typeof intent !== 'object' ||
    Array.isArray(intent)
  ) {
    throw new Error(
      'Explicit governed patch intent is required.'
    );
  }

  const prepared =
    createGovernedPatchRequest({
      repositoryPath,

      target:
        text(
          intent.target,
          'Patch target'
        ),

      replacement:
        intent.replacement,

      authorityRoot:
        options.authorityRoot,

      journalStorageRoot:
        options.journalStorageRoot,

      tenantId:
        options.tenantId === undefined
          ? null
          : options.tenantId,

      projectId:
        options.projectId === undefined
          ? null
          : options.projectId
    });

  return freeze({
    authority:
      prepared.authority,

    orchestration:
      orchestrate(
        prepared.request,
        prepared.runtime
      )
  });
}

function formatGovernedPatchResult(result) {
  const orchestration =
    result &&
    result.orchestration;

  if (
    !orchestration ||
    !orchestration.orchestration
  ) {
    return (
      'Governed patch denied: malformed result.\n'
    );
  }

  const status =
    orchestration.orchestration.status;

  if (status !== 'COMPLETED') {
    const reason =
      orchestration.execution &&
      orchestration.execution.reason
        ? orchestration.execution.reason
        : orchestration.nextStep ||
          'Patch did not complete.';

    return (
      `Governed patch: ${status}\n` +
      `Reason: ${reason}\n`
    );
  }

  return (
    'Governed filesystem patch: COMPLETED\n' +
    `Target: ${result.authority.target}\n` +
    `Operation: ${result.authority.operationId}\n` +
    `Before SHA256: ${result.authority.beforeSha256}\n` +
    `Replacement SHA256: ${result.authority.replacementSha256}\n`
  );
}

module.exports = Object.freeze({
  createGovernedPatchRequest,
  dispatchGovernedPatch,
  formatGovernedPatchResult
});
