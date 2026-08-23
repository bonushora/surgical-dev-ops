'use strict';

const crypto =
  require('node:crypto');

const PROPOSAL_SCHEMA =
  'sdo.governed_cognitive_proposal.v1';

const CANDIDATE_SCHEMA =
  'sdo.materialized_candidate_intent.v1';

const REQUIRED_PROPOSAL_AUTHORITY =
  Object.freeze({
    executable: false,
    dispatchAllowed: false,
    physicalExecution: false,
    mutationAuthority: false,
    shellAuthority: false,
    authorizationAuthority: false,
    humanAuthority: false,
    capabilityGrantAuthority: false
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

function validateProposalAuthority(
  authority
) {
  requirePlainObject(
    authority,
    'Cognitive proposal authority'
  );

  const actualKeys =
    Object.keys(authority)
      .sort();

  const expectedKeys =
    Object.keys(
      REQUIRED_PROPOSAL_AUTHORITY
    ).sort();

  if (
    JSON.stringify(actualKeys) !==
      JSON.stringify(expectedKeys)
  ) {
    throw new Error(
      'Cognitive proposal authority surface is malformed or broadened.'
    );
  }

  for (
    const [
      key,
      expected
    ]
    of Object.entries(
      REQUIRED_PROPOSAL_AUTHORITY
    )
  ) {
    if (
      authority[key] !==
        expected
    ) {
      throw new Error(
        `Cognitive proposal authority must deny ${key}.`
      );
    }
  }
}

function validateProposalFingerprint(
  proposal
) {
  if (
    typeof proposal.fingerprint !==
      'string' ||
    !/^[a-f0-9]{64}$/.test(
      proposal.fingerprint
    )
  ) {
    throw new Error(
      'Cognitive proposal fingerprint is missing or malformed.'
    );
  }

  const {
    fingerprint: supplied,
    ...evidence
  } = proposal;

  const expected =
    fingerprint(evidence);

  if (supplied !== expected) {
    throw new Error(
      'Cognitive proposal fingerprint binding is invalid.'
    );
  }
}

function validateGovernedProposal(
  proposal
) {
  requirePlainObject(
    proposal,
    'Governed cognitive proposal'
  );

  if (
    proposal.schema !==
      PROPOSAL_SCHEMA ||
    proposal.classification !==
      'COGNITIVE_EVIDENCE_ONLY' ||
    proposal.nextBoundary !==
      'DETERMINISTIC_MATERIALIZATION_REQUIRED' ||
    !isDeepFrozen(proposal)
  ) {
    throw new Error(
      'Governed cognitive proposal is malformed, mutable, or outside the materialization boundary.'
    );
  }

  requireText(
    proposal.humanIntent,
    'Human intent'
  );

  requirePlainObject(
    proposal.source,
    'Cognitive proposal source'
  );

  requirePlainObject(
    proposal.proposal,
    'Cognitive proposal evidence'
  );

  validateProposalAuthority(
    proposal.authority
  );

  validateProposalFingerprint(
    proposal
  );

  return proposal;
}

function extractBoundedIntent(
  proposal
) {
  const candidate =
    requirePlainObject(
      proposal.proposal.intent,
      'Cognitive candidate intent'
    );

  const keys =
    Object.keys(candidate)
      .sort();

  const expectedKeys =
    [
      'action',
      'capabilityType'
    ];

  if (
    JSON.stringify(keys) !==
      JSON.stringify(expectedKeys)
  ) {
    throw new Error(
      'Cognitive candidate intent contains an unsupported or ambiguous field.'
    );
  }

  const capabilityType =
    requireText(
      candidate.capabilityType,
      'Candidate capabilityType'
    ).toUpperCase();

  const action =
    requireText(
      candidate.action,
      'Candidate action'
    ).toUpperCase();

  if (
    capabilityType !==
      'GIT_READ' ||
    ![
      'WORKTREE_STATUS',
      'HEAD_COMMIT'
    ].includes(action)
  ) {
    throw new Error(
      'Only governed GIT_READ metadata actions are materializable at this frontier.'
    );
  }

  return {
    capabilityType,
    action
  };
}

function materializeCandidateIntent(
  proposal
) {
  const governedProposal =
    validateGovernedProposal(
      proposal
    );

  const intent =
    extractBoundedIntent(
      governedProposal
    );

  const candidate =
    {
      schema:
        CANDIDATE_SCHEMA,

      classification:
        'DETERMINISTIC_CANDIDATE_ONLY',

      sourceProposalFingerprint:
        governedProposal.fingerprint,

      humanIntent:
        governedProposal.humanIntent,

      intent: {
        capabilityType:
          intent.capabilityType,

        action:
          intent.action
      },

      authority: {
        executable:
          false,

        dispatchAllowed:
          false,

        workspaceAuthority:
          false,

        operationAuthority:
          false,

        capabilityGrantAuthority:
          false,

        mutationAuthority:
          false,

        authorizationAuthority:
          false,

        humanAuthority:
          false
      },

      nextBoundary:
        'GOVERNANCE_REQUIRED'
    };

  return deepFreeze({
    ...candidate,

    fingerprint:
      fingerprint(candidate)
  });
}

module.exports =
  Object.freeze({
    materializeCandidateIntent
  });
