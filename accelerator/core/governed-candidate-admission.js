'use strict';

const crypto =
  require('node:crypto');

const CANDIDATE_SCHEMA =
  'sdo.materialized_candidate_intent.v1';

const ADMISSION_SCHEMA =
  'sdo.governed_candidate_admission.v1';

const REQUIRED_CANDIDATE_AUTHORITY =
  Object.freeze({
    executable: false,
    dispatchAllowed: false,
    workspaceAuthority: false,
    operationAuthority: false,
    capabilityGrantAuthority: false,
    mutationAuthority: false,
    authorizationAuthority: false,
    humanAuthority: false
  });

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

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify(
        canonicalize(value)
      )
    )
    .digest('hex');
}

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

function requirePlainObject(
  value,
  name
) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${name} must be an object.`
    );
  }

  return value;
}

function requireText(
  value,
  name
) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    throw new Error(
      `${name} is required.`
    );
  }

  return value.trim();
}

function validateAuthority(
  authority
) {
  requirePlainObject(
    authority,
    'Candidate authority'
  );

  const actualKeys =
    Object.keys(authority)
      .sort();

  const expectedKeys =
    Object.keys(
      REQUIRED_CANDIDATE_AUTHORITY
    ).sort();

  if (
    JSON.stringify(actualKeys) !==
      JSON.stringify(expectedKeys)
  ) {
    throw new Error(
      'Candidate authority surface is malformed or broadened.'
    );
  }

  for (
    const [
      key,
      expected
    ]
    of Object.entries(
      REQUIRED_CANDIDATE_AUTHORITY
    )
  ) {
    if (
      authority[key] !==
        expected
    ) {
      throw new Error(
        `Candidate authority must deny ${key}.`
      );
    }
  }
}

function validateFingerprint(
  candidate
) {
  if (
    typeof candidate.fingerprint !==
      'string' ||
    !/^[a-f0-9]{64}$/.test(
      candidate.fingerprint
    )
  ) {
    throw new Error(
      'Candidate fingerprint is missing or malformed.'
    );
  }

  const {
    fingerprint: supplied,
    ...evidence
  } = candidate;

  const expected =
    fingerprint(evidence);

  if (supplied !== expected) {
    throw new Error(
      'Candidate fingerprint binding is invalid.'
    );
  }
}

function validateCandidate(
  candidate
) {
  requirePlainObject(
    candidate,
    'Materialized candidate'
  );

  if (
    candidate.schema !==
      CANDIDATE_SCHEMA ||
    candidate.classification !==
      'DETERMINISTIC_CANDIDATE_ONLY' ||
    candidate.nextBoundary !==
      'GOVERNANCE_REQUIRED' ||
    !isDeepFrozen(candidate)
  ) {
    throw new Error(
      'Materialized candidate is malformed, mutable, or outside the governance boundary.'
    );
  }

  requireText(
    candidate.sourceProposalFingerprint,
    'Source proposal fingerprint'
  );

  requireText(
    candidate.humanIntent,
    'Human intent'
  );

  requirePlainObject(
    candidate.intent,
    'Candidate intent'
  );

  validateAuthority(
    candidate.authority
  );

  validateFingerprint(
    candidate
  );

  return candidate;
}

function admitGovernedCandidate(
  candidate
) {
  const validated =
    validateCandidate(
      candidate
    );

  const intentKeys =
    Object.keys(
      validated.intent
    ).sort();

  const expectedIntentKeys =
    [
      'action',
      'capabilityType'
    ];

  if (
    JSON.stringify(intentKeys) !==
      JSON.stringify(expectedIntentKeys)
  ) {
    throw new Error(
      'Candidate intent surface is unsupported or ambiguous.'
    );
  }

  if (
    validated.intent.capabilityType !==
      'GIT_READ' ||
    ![
      'WORKTREE_STATUS',
      'HEAD_COMMIT',
      'CURRENT_BRANCH'
    ].includes(
      validated.intent.action
    )
  ) {
    throw new Error(
      'Only governed GIT_READ metadata actions can be admitted at this frontier.'
    );
  }

  /*
   * The existing human-facing read-only path uses the selector
   * "status", which maps deterministically to WORKTREE_STATUS.
   *
   * This admission contract does not call any authority-composition
   * or dispatch layer. It only performs the bounded vocabulary
   * translation.
   */
  const admission =
    {
      schema:
        ADMISSION_SCHEMA,

      classification:
        'GOVERNANCE_ADMISSION_ONLY',

      sourceCandidateFingerprint:
        validated.fingerprint,

      sourceProposalFingerprint:
        validated.sourceProposalFingerprint,

      humanIntent:
        validated.humanIntent,

      admittedIntent: {
        capabilityType:
          'GIT_READ',

        target:
          validated.intent.action ===
            'WORKTREE_STATUS'
            ? 'status'
            : 'rev-parse',

        canonicalAction:
          validated.intent.action
      },

      provenance: {
        origin:
          'COGNITIVE_CANDIDATE',

        humanRequesterAsserted:
          false,

        humanAuthorityAsserted:
          false
      },

      authority: {
        executable:
          false,

        dispatchAllowed:
          false,

        repositoryAuthority:
          false,

        workspaceAuthority:
          false,

        operationAuthority:
          false,

        capabilityGrantAuthority:
          false,

        lifecycleAuthority:
          false,

        authorizationAuthority:
          false,

        mutationAuthority:
          false,

        humanAuthority:
          false
      },

      nextBoundary:
        'AUTHORITY_COMPOSITION_REQUIRED'
    };

  return deepFreeze({
    ...admission,

    fingerprint:
      fingerprint(admission)
  });
}

module.exports =
  Object.freeze({
    admitGovernedCandidate
  });
