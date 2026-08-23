'use strict';

const crypto =
  require('node:crypto');

const {
  discover
} = require('./repository-discovery');

const {
  evaluateCapabilityGrant
} = require('./capability-grant');

const {
  createOperationRecord
} = require('./operation-record');

const {
  createLifecycle
} = require('./state-boundary');

const ADMISSION_SCHEMA =
  'sdo.governed_candidate_admission.v1';

const COMPOSITION_DOMAIN =
  'sdo.cognitive_r0_authority_composition.v1';

const EXPECTED_AUTHORITY =
  Object.freeze({
    executable: false,
    dispatchAllowed: false,
    repositoryAuthority: false,
    workspaceAuthority: false,
    operationAuthority: false,
    capabilityGrantAuthority: false,
    lifecycleAuthority: false,
    authorizationAuthority: false,
    mutationAuthority: false,
    humanAuthority: false
  });

function requireText(
  value,
  label
) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    throw new Error(
      `${label} must be a non-empty string.`
    );
  }

  return value.trim();
}

function requirePlainObject(
  value,
  label
) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${label} must be an object.`
    );
  }

  return value;
}

function canonicalTimestamp(value) {
  const normalized =
    requireText(
      value,
      'Timestamp'
    );

  const parsed =
    Date.parse(normalized);

  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString() !==
      normalized
  ) {
    throw new Error(
      'Timestamp must be canonical ISO-8601.'
    );
  }

  return normalized;
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (
    !value ||
    typeof value !== 'object'
  ) {
    return value;
  }

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

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

function fingerprint(value) {
  return sha256(
    JSON.stringify(
      canonicalize(value)
    )
  );
}

function isSha256(value) {
  return (
    typeof value === 'string' &&
    /^[a-f0-9]{64}$/.test(value)
  );
}

function isDeepFrozen(
  value,
  seen = new Set()
) {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return true;
  }

  if (seen.has(value)) {
    return true;
  }

  if (!Object.isFrozen(value)) {
    return false;
  }

  seen.add(value);

  return Object
    .values(value)
    .every(
      (child) =>
        isDeepFrozen(
          child,
          seen
        )
    );
}

function exactKeys(
  value,
  expected
) {
  const actual =
    Object.keys(value)
      .sort();

  const normalizedExpected =
    [...expected].sort();

  return (
    JSON.stringify(actual) ===
    JSON.stringify(
      normalizedExpected
    )
  );
}

function validateAdmissionAuthority(
  authority
) {
  requirePlainObject(
    authority,
    'Admission authority'
  );

  if (
    !exactKeys(
      authority,
      Object.keys(
        EXPECTED_AUTHORITY
      )
    )
  ) {
    throw new Error(
      'Admission authority surface is malformed or broadened.'
    );
  }

  for (
    const [
      key,
      expected
    ]
    of Object.entries(
      EXPECTED_AUTHORITY
    )
  ) {
    if (
      authority[key] !==
      expected
    ) {
      throw new Error(
        `Admission authority must deny ${key}.`
      );
    }
  }
}

function validateAdmissionFingerprint(
  admission
) {
  if (!isSha256(admission.fingerprint)) {
    throw new Error(
      'Admission fingerprint is missing or malformed.'
    );
  }

  const {
    fingerprint: supplied,
    ...evidence
  } = admission;

  if (
    supplied !==
    fingerprint(evidence)
  ) {
    throw new Error(
      'Admission fingerprint binding is invalid.'
    );
  }
}

function validateAdmission(
  admission
) {
  requirePlainObject(
    admission,
    'Governed candidate admission'
  );

  if (!isDeepFrozen(admission)) {
    throw new Error(
      'Governed candidate admission must be deeply immutable.'
    );
  }

  if (
    !exactKeys(
      admission,
      [
        'schema',
        'classification',
        'sourceCandidateFingerprint',
        'sourceProposalFingerprint',
        'humanIntent',
        'admittedIntent',
        'provenance',
        'authority',
        'nextBoundary',
        'fingerprint'
      ]
    )
  ) {
    throw new Error(
      'Governed candidate admission surface is malformed or broadened.'
    );
  }

  if (
    admission.schema !==
      ADMISSION_SCHEMA ||
    admission.classification !==
      'GOVERNANCE_ADMISSION_ONLY' ||
    admission.nextBoundary !==
      'AUTHORITY_COMPOSITION_REQUIRED'
  ) {
    throw new Error(
      'Governed candidate admission is outside the authorized boundary.'
    );
  }

  if (
    !isSha256(
      admission
        .sourceCandidateFingerprint
    ) ||
    !isSha256(
      admission
        .sourceProposalFingerprint
    )
  ) {
    throw new Error(
      'Admission provenance fingerprint is malformed.'
    );
  }

  requireText(
    admission.humanIntent,
    'Bound human intent'
  );

  const admittedIntent =
    requirePlainObject(
      admission.admittedIntent,
      'Admitted intent'
    );

  if (
    !exactKeys(
      admittedIntent,
      [
        'capabilityType',
        'target',
        'canonicalAction'
      ]
    ) ||
    admittedIntent.capabilityType !==
      'GIT_READ' ||
    !(
      (
        admittedIntent.target ===
          'status' &&
        admittedIntent.canonicalAction ===
          'WORKTREE_STATUS'
      ) ||
      (
        admittedIntent.target ===
          'rev-parse' &&
        admittedIntent.canonicalAction ===
          'HEAD_COMMIT'
      )
    )
  ) {
    throw new Error(
      'Only governed cognitive GIT_READ metadata admission can cross the R0 composition boundary.'
    );
  }

  const provenance =
    requirePlainObject(
      admission.provenance,
      'Admission provenance'
    );

  if (
    !exactKeys(
      provenance,
      [
        'origin',
        'humanRequesterAsserted',
        'humanAuthorityAsserted'
      ]
    ) ||
    provenance.origin !==
      'COGNITIVE_CANDIDATE' ||
    provenance
      .humanRequesterAsserted !==
      false ||
    provenance
      .humanAuthorityAsserted !==
      false
  ) {
    throw new Error(
      'Cognitive admission provenance is malformed or falsely asserts human authority.'
    );
  }

  validateAdmissionAuthority(
    admission.authority
  );

  validateAdmissionFingerprint(
    admission
  );

  return admission;
}

function physicalEvidence(
  discovery
) {
  return {
    path:
      discovery.repository.path,

    branch:
      discovery.repository.branch,

    commit:
      discovery.repository.commit,

    shortCommit:
      discovery.repository.shortCommit,

    clean:
      discovery.worktree.clean,

    changedFiles:
      discovery.worktree.changedFiles
  };
}

function operationIdFor({
  admissionFingerprint,
  workspace,
  action,
  observedAt
}) {
  return (
    'cognitive-r0-' +
    sha256(
      [
        COMPOSITION_DOMAIN,
        admissionFingerprint,
        workspace,
        'GIT_READ',
        action,
        observedAt
      ].join('\0')
    )
  );
}

function cognitiveRequesterFor(
  admission
) {
  return Object.freeze({
    id:
      `cognitive-admission:${admission.fingerprint}`,

    type:
      'COGNITIVE'
  });
}

function createCognitiveReadOnlyAuthorityRequest(
  {
    admission,
    repositoryPath
  },
  options = {}
) {
  const validatedAdmission =
    validateAdmission(
      admission
    );

  const repository =
    discover(
      requireText(
        repositoryPath,
        'Repository path'
      )
    );

  const workspace =
    repository.repository.path;

  const observedAt =
    canonicalTimestamp(
      typeof options.now ===
        'function'
        ? options.now()
        : new Date().toISOString()
    );

  const expiresAt =
    new Date(
      Date.parse(observedAt) +
      60_000
    ).toISOString();

  const action =
    validatedAdmission
      .admittedIntent
      .canonicalAction;

  const operation =
    validatedAdmission
      .admittedIntent
      .target;

  const operationId =
    operationIdFor({
      admissionFingerprint:
        validatedAdmission.fingerprint,

      workspace,

      action,

      observedAt
    });

  const capabilityType =
    'GIT_READ';

  const scope =
    Object.freeze({
      operations:
        Object.freeze([
          operation
        ])
    });

  const common = {
    operationId,
    workspace,
    policyDecision:
      'ALLOWED',
    riskLevel:
      'R0',
    lifecycleState:
      'PENDING',
    capabilityType,
    scope,
    idempotency:
      'IDEMPOTENT'
  };

  const grantEvaluation =
    evaluateCapabilityGrant(
      {
        ...common,
        expiresAt
      },
      {
        ...common,
        evaluatedAt:
          observedAt
      }
    );

  if (
    !grantEvaluation ||
    grantEvaluation.decision !==
      'ALLOWED' ||
    !grantEvaluation.grant
  ) {
    throw new Error(
      'Cognitive R0 capability composition was denied.'
    );
  }

  const objective =
    `Governed cognitive Git repository read: ${action}`;

  const requester =
    cognitiveRequesterFor(
      validatedAdmission
    );

  const operationRecordEvaluation =
    createOperationRecord({
      operationId,

      requester,

      workspace,

      objective,

      policyDecision:
        'ALLOWED',

      riskLevel:
        'R0',

      idempotency:
        'IDEMPOTENT',

      events: [
        {
          type:
            'intent',

          operationId,

          timestamp:
            observedAt,

          objective
        },
        {
          type:
            'policy',

          operationId,

          timestamp:
            observedAt,

          policyDecision:
            'ALLOWED',

          riskLevel:
            'R0'
        },
        {
          type:
            'state',

          operationId,

          timestamp:
            observedAt,

          status:
            'PENDING'
        }
      ]
    });

  if (
    !operationRecordEvaluation ||
    operationRecordEvaluation
      .decision !==
      'ALLOWED' ||
    !operationRecordEvaluation
      .record
  ) {
    throw new Error(
      'Cognitive R0 operation record was denied.'
    );
  }

  const lifecycle =
    createLifecycle({
      operationId,

      initialState:
        'PENDING',

      before:
        physicalEvidence(
          repository
        ),

      createdAt:
        observedAt
    });

  const execution =
    Object.freeze({
      adapter:
        'GIT_READ',

      action,

      operationId,

      workspace,

      observedAt,

      grantEvaluation,

      operationRecord:
        operationRecordEvaluation.record,

      lifecycle
    });

  return Object.freeze({
    repositoryPath:
      workspace,

    description:
      objective,

    files:
      Object.freeze([]),

    mode:
      'OBSERVE',

    risk:
      'BAIXO',

    authorizeExecution:
      true,

    estimatedDiffLines:
      0,

    architecturalChange:
      false,

    execution
  });
}

module.exports =
  Object.freeze({
    createCognitiveReadOnlyAuthorityRequest
  });
