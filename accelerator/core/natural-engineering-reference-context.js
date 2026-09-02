'use strict';

const crypto = require('node:crypto');

const {
  REVALIDATION_SCHEMA
} = require(
  '../adapters/deterministic-workspace-session-adapter'
);

const {
  validateNaturalAgenticMission
} = require('./natural-agentic-mission');

const CONTEXT_SCHEMA =
  'sdo.natural_engineering_reference_context.v1';
const REFERENT_SCHEMA =
  'sdo.natural_engineering_referent.v1';
const RESOLUTION_SCHEMA =
  'sdo.natural_engineering_reference_resolution.v1';
const PROJECTION_SCHEMA =
  'sdo.natural_engineering_reference_projection.v1';

const SUPPORTED_REFERENCE_TYPES = Object.freeze([
  'LAST_EVIDENCE',
  'LAST_OPERATION',
  'CURRENT_DIFF',
  'LAST_FAILURE',
  'LAST_TEST',
  'CURRENT_PLAN_STEP',
  'CURRENT_BLOCKER'
]);

const KNOWN_UNSUPPORTED_REFERENCE_TYPES = Object.freeze([
  'LAST_CHANGED_FILE',
  'LAST_PATCH',
  'LAST_RECOMMENDATION',
  'CURRENT_CHECKPOINT'
]);

const RESOLUTION_CLASSES = Object.freeze([
  'RESOLVED',
  'NO_REFERENT',
  'AMBIGUOUS_REFERENT',
  'STALE_REFERENT',
  'UNSUPPORTED_REFERENT'
]);

const REFERENCE_OPERATIONS = Object.freeze([
  'workspace.status',
  'workspace.diff',
  'tests.run',
  'tests.runCanonical',
  'mutation.applyConditional'
]);

const GATEWAY_OPERATIONS = Object.freeze([
  ...REFERENCE_OPERATIONS,
  'evidence.inspect'
]);

const RESULT_CLASSES = Object.freeze([
  'SUCCESS',
  'FAILURE',
  'DENIED',
  'AUTHORITY_REQUIRED',
  'STALE_STATE',
  'CAS_MISMATCH',
  'UNSUPPORTED',
  'ENVIRONMENT_ERROR',
  'INCOMPLETE_EVIDENCE'
]);

const REFERENT_INPUT_FIELDS = new Set([
  'mission',
  'type',
  'operation',
  'evidenceDigest',
  'resultFingerprint',
  'resultClassification',
  'createdAt',
  'sequence'
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

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(
          (key) => [key, canonicalize(value[key])]
        )
    );
  }

  return value;
}

function fingerprint(label, value) {
  return crypto
    .createHash('sha256')
    .update(
      `${label}\0${JSON.stringify(canonicalize(value))}`,
      'utf8'
    )
    .digest('hex');
}

function requireText(value, label, maximum = 512) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value !== value.trim() ||
    value.length > maximum ||
    value.includes('\0')
  ) {
    throw new Error(`${label} is malformed.`);
  }

  return value;
}

function requireDigest(value, label) {
  const digest = requireText(value, label, 64);

  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error(`${label} must be canonical SHA-256.`);
  }

  return digest;
}

function requireObjectId(value, label) {
  const objectId = requireText(value, label, 64);

  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(objectId)) {
    throw new Error(`${label} is malformed.`);
  }

  return objectId;
}

function requireTimestamp(value, label) {
  const timestamp = requireText(value, label, 64);
  const parsed = Date.parse(timestamp);

  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString() !== timestamp
  ) {
    throw new Error(`${label} is malformed.`);
  }

  return timestamp;
}

function rejectUnexpectedFields(input, allowed, label) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error(`${label} is malformed.`);
  }

  const unexpected =
    Object.keys(input).filter(
      (key) => !allowed.has(key)
    );

  if (unexpected.length > 0) {
    throw new Error(
      `${label} contains an unexpected field: ${unexpected[0]}.`
    );
  }
}

function normalizeBinding(mission) {
  const current =
    validateNaturalAgenticMission(
      mission
    );

  return deepFreeze({
    repositoryPath:
      requireText(
        current.binding.repositoryPath,
        'Reference repository path',
        4096
      ),
    sessionFingerprint:
      requireDigest(
        current.binding.sessionFingerprint,
        'Reference session fingerprint'
      ),
    physicalWorkspaceIdentity:
      requireDigest(
        current.binding.physicalWorkspaceIdentity,
        'Reference physical workspace identity'
      ),
    repositoryHead:
      requireObjectId(
        current.binding.repositoryHead,
        'Reference repository HEAD'
      ),
    worktreeFingerprint:
      requireDigest(
        current.binding.worktreeFingerprint,
        'Reference worktree fingerprint'
      )
  });
}

function sameBinding(left, right) {
  return Boolean(
    left &&
    right &&
    left.repositoryPath === right.repositoryPath &&
    left.sessionFingerprint === right.sessionFingerprint &&
    left.physicalWorkspaceIdentity === right.physicalWorkspaceIdentity &&
    left.repositoryHead === right.repositoryHead &&
    left.worktreeFingerprint === right.worktreeFingerprint
  );
}

function createNaturalEngineeringReferent(input = {}) {
  rejectUnexpectedFields(
    input,
    REFERENT_INPUT_FIELDS,
    'Engineering referent input'
  );

  const mission =
    validateNaturalAgenticMission(
      input.mission
    );
  const type =
    requireText(
      input.type,
      'Engineering reference type',
      64
    ).toUpperCase();

  if (!SUPPORTED_REFERENCE_TYPES.includes(type)) {
    throw new Error(
      'Engineering reference type is unsupported.'
    );
  }

  const operation =
    requireText(
      input.operation,
      'Engineering reference operation',
      128
    );

  if (!REFERENCE_OPERATIONS.includes(operation)) {
    throw new Error(
      'Engineering reference operation is unsupported.'
    );
  }

  const resultClassification =
    requireText(
      input.resultClassification,
      'Engineering reference result classification',
      32
    ).toUpperCase();

  if (!RESULT_CLASSES.includes(resultClassification)) {
    throw new Error(
      'Engineering reference result classification is unsupported.'
    );
  }

  if (
    !Number.isSafeInteger(input.sequence) ||
    input.sequence < 1
  ) {
    throw new Error(
      'Engineering reference sequence is malformed.'
    );
  }

  const body = {
    schema: REFERENT_SCHEMA,
    type,
    missionId: mission.missionId,
    operation,
    evidenceDigest:
      requireDigest(
        input.evidenceDigest,
        'Engineering reference evidence digest'
      ),
    resultFingerprint:
      requireDigest(
        input.resultFingerprint,
        'Engineering reference result fingerprint'
      ),
    resultClassification,
    binding:
      normalizeBinding(mission),
    createdAt:
      requireTimestamp(
        input.createdAt,
        'Engineering reference timestamp'
      ),
    sequence:
      input.sequence,
    status:
      'CURRENT',
    persistent:
      false,
    providerDerived:
      false,
    operationalAuthority:
      false,
    mutationAuthority:
      false
  };

  return deepFreeze({
    ...body,
    referenceId:
      fingerprint(
        REFERENT_SCHEMA,
        body
      )
  });
}

function validateNaturalEngineeringReferent(referent) {
  if (
    !referent ||
    referent.schema !== REFERENT_SCHEMA ||
    !Object.isFrozen(referent)
  ) {
    throw new Error(
      'Immutable engineering referent is required.'
    );
  }

  const {
    referenceId,
    ...body
  } = referent;

  if (
    !SUPPORTED_REFERENCE_TYPES.includes(referent.type) ||
    !REFERENCE_OPERATIONS.includes(referent.operation) ||
    !RESULT_CLASSES.includes(referent.resultClassification) ||
    !/^[a-f0-9]{64}$/.test(referenceId || '') ||
    fingerprint(REFERENT_SCHEMA, body) !== referenceId
  ) {
    throw new Error(
      'Engineering referent has lost integrity.'
    );
  }

  return referent;
}

function contextBody(input) {
  return {
    schema: CONTEXT_SCHEMA,
    missionId: input.missionId,
    binding: input.binding,
    references: input.references,
    resultSequence: input.resultSequence,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    persistent: false,
    providerMemoryAuthoritative: false,
    operationalAuthority: false,
    mutationAuthority: false
  };
}

function withContextFingerprint(input) {
  const body = contextBody(input);

  return deepFreeze({
    ...body,
    contextFingerprint:
      fingerprint(
        CONTEXT_SCHEMA,
        body
      )
  });
}

function createNaturalEngineeringReferenceContext({
  mission,
  createdAt
} = {}) {
  const current =
    validateNaturalAgenticMission(
      mission
    );
  const at =
    requireTimestamp(
      createdAt,
      'Reference context creation timestamp'
    );

  return withContextFingerprint({
    missionId:
      current.missionId,
    binding:
      normalizeBinding(current),
    references: [],
    resultSequence: 0,
    createdAt: at,
    updatedAt: at
  });
}

function validateNaturalEngineeringReferenceContext(context) {
  if (
    !context ||
    context.schema !== CONTEXT_SCHEMA ||
    !Object.isFrozen(context) ||
    !Array.isArray(context.references) ||
    context.references.length >
      SUPPORTED_REFERENCE_TYPES.length
  ) {
    throw new Error(
      'Immutable bounded engineering reference context is required.'
    );
  }

  for (const referent of context.references) {
    validateNaturalEngineeringReferent(
      referent
    );
  }

  if (
    new Set(
      context.references.map(
        (reference) => reference.type
      )
    ).size !== context.references.length
  ) {
    throw new Error(
      'Engineering reference types must be unique.'
    );
  }

  const {
    contextFingerprint,
    ...body
  } = context;

  if (
    !Number.isSafeInteger(context.resultSequence) ||
    context.resultSequence < 0 ||
    !/^[a-f0-9]{64}$/.test(contextFingerprint || '') ||
    fingerprint(CONTEXT_SCHEMA, body) !== contextFingerprint
  ) {
    throw new Error(
      'Engineering reference context has lost integrity.'
    );
  }

  return context;
}

function requireContextMission(context, mission) {
  const current =
    validateNaturalAgenticMission(
      mission
    );
  const binding =
    normalizeBinding(current);

  return Object.freeze({
    current,
    valid:
      context.missionId === current.missionId &&
      sameBinding(
        context.binding,
        binding
      )
  });
}

function validateGatewayResult(result) {
  if (
    !result ||
    result.schema !==
      'sdo.integrated_governed_agent_gateway_result.v1' ||
    !Object.isFrozen(result) ||
    !GATEWAY_OPERATIONS.includes(result.operation) ||
    !RESULT_CLASSES.includes(result.classification)
  ) {
    throw new Error(
      'Immutable structured Gateway result is required.'
    );
  }

  requireDigest(
    result.evidenceDigest,
    'Gateway result evidence digest'
  );
  requireDigest(
    result.resultFingerprint,
    'Gateway result fingerprint'
  );

  const {
    resultFingerprint,
    ...body
  } = result;

  if (
    fingerprint(
      'sdo.integrated_governed_agent_gateway_result.v1',
      body
    ) !== resultFingerprint
  ) {
    throw new Error(
      'Gateway result has lost integrity.'
    );
  }

  return result;
}

function referenceTypesForResult(
  gatewayOperation,
  sourceOperation,
  result,
  mission
) {
  const types = [
    'LAST_OPERATION',
    'LAST_EVIDENCE'
  ];

  if (
    sourceOperation === 'workspace.diff' &&
    result.classification === 'SUCCESS'
  ) {
    types.push('CURRENT_DIFF');
  }

  if (result.classification !== 'SUCCESS') {
    types.push('LAST_FAILURE');

    if (mission.state === 'BLOCKED') {
      types.push('CURRENT_BLOCKER');
    }
  }

  return Object.freeze([
    ...new Set(types)
  ]);
}

function recordNaturalEngineeringGatewayResult(
  context,
  {
    mission,
    gatewayOperation,
    sourceOperation,
    result,
    createdAt
  } = {}
) {
  const currentContext =
    validateNaturalEngineeringReferenceContext(
      context
    );
  const missionBinding =
    requireContextMission(
      currentContext,
      mission
    );

  if (!missionBinding.valid) {
    throw new Error(
      'Engineering reference context belongs to another mission or physical state.'
    );
  }

  const gateway =
    requireText(
      gatewayOperation,
      'Reference Gateway operation',
      128
    );
  const source =
    requireText(
      sourceOperation,
      'Reference source operation',
      128
    );

  if (
    !GATEWAY_OPERATIONS.includes(gateway) ||
    !REFERENCE_OPERATIONS.includes(source)
  ) {
    throw new Error(
      'Reference operation is unsupported.'
    );
  }

  const governedResult =
    validateGatewayResult(
      result
    );

  if (governedResult.operation !== gateway) {
    throw new Error(
      'Gateway result operation does not match the reference update.'
    );
  }

  if (
    governedResult.missionId !==
      missionBinding.current.missionId
  ) {
    throw new Error(
      'Gateway result belongs to another mission.'
    );
  }

  const at =
    requireTimestamp(
      createdAt,
      'Reference update timestamp'
    );

  if (
    Date.parse(at) <
      Date.parse(currentContext.updatedAt)
  ) {
    throw new Error(
      'Reference context time cannot move backwards.'
    );
  }

  const nextSequence =
    currentContext.resultSequence + 1;
  const types =
    referenceTypesForResult(
      gateway,
      source,
      governedResult,
      missionBinding.current
    );
  const replacements =
    types.map(
      (type) =>
        createNaturalEngineeringReferent({
          mission:
            missionBinding.current,
          type,
          operation:
            source,
          evidenceDigest:
            governedResult.evidenceDigest,
          resultFingerprint:
            governedResult.resultFingerprint,
          resultClassification:
            governedResult.classification,
          createdAt:
            at,
          sequence:
            nextSequence
        })
    );
  const replacedTypes =
    new Set(types);

  return withContextFingerprint({
    missionId:
      currentContext.missionId,
    binding:
      currentContext.binding,
    references: [
      ...currentContext.references.filter(
        (reference) =>
          !replacedTypes.has(
            reference.type
          )
      ),
      ...replacements
    ],
    resultSequence:
      nextSequence,
    createdAt:
      currentContext.createdAt,
    updatedAt:
      at
  });
}

function resolution(
  classification,
  {
    requestedType,
    reference = null,
    candidates = [],
    physicalState = 'NOT_VALIDATED',
    reason
  }
) {
  if (!RESOLUTION_CLASSES.includes(classification)) {
    throw new Error(
      'Engineering reference resolution class is unsupported.'
    );
  }

  const candidateTypes = [
    ...new Set(
      candidates.map(
        (candidate) => candidate.type
      )
    )
  ].sort();
  const body = {
    schema: RESOLUTION_SCHEMA,
    classification,
    requestedType,
    reference,
    candidateTypes,
    physicalState,
    reason:
      requireText(
        reason,
        'Reference resolution reason',
        512
      ),
    providerInvoked: false,
    operationalAuthority: false,
    mutationAuthority: false
  };

  return deepFreeze({
    ...body,
    resolutionFingerprint:
      fingerprint(
        RESOLUTION_SCHEMA,
        body
      )
  });
}

function physicalReferenceIsValid(
  reference,
  context,
  revalidation
) {
  return Boolean(
    revalidation &&
    revalidation.schema === REVALIDATION_SCHEMA &&
    Object.isFrozen(revalidation) &&
    revalidation.decision === 'VALID' &&
    revalidation.sessionFingerprint ===
      context.binding.sessionFingerprint &&
    revalidation.current &&
    revalidation.current.physicalWorkspaceIdentity ===
      reference.binding.physicalWorkspaceIdentity &&
    revalidation.current.repositoryHead ===
      reference.binding.repositoryHead &&
    revalidation.current.worktreeFingerprint ===
      reference.binding.worktreeFingerprint
  );
}

function resolveNaturalEngineeringReference({
  context,
  mission,
  requestedType,
  requestedAction = 'INSPECT_EVIDENCE',
  revalidation
} = {}) {
  const currentContext =
    validateNaturalEngineeringReferenceContext(
      context
    );
  const type =
    requireText(
      requestedType,
      'Requested engineering reference type',
      64
    ).toUpperCase();
  const action =
    requireText(
      requestedAction,
      'Requested reference action',
      64
    ).toUpperCase();

  if (
    KNOWN_UNSUPPORTED_REFERENCE_TYPES.includes(type) ||
    (
      type !== 'DEICTIC' &&
      !SUPPORTED_REFERENCE_TYPES.includes(type)
    )
  ) {
    return resolution(
      'UNSUPPORTED_REFERENT',
      {
        requestedType: type,
        reason:
          'The requested engineering reference is not represented by the current bounded runtime.'
      }
    );
  }

  const missionBinding =
    requireContextMission(
      currentContext,
      mission
    );

  if (!missionBinding.valid) {
    return resolution(
      'STALE_REFERENT',
      {
        requestedType: type,
        physicalState: 'STALE',
        reason:
          'The bounded reference belongs to another mission or physical workspace state.'
      }
    );
  }

  let candidates;

  if (
    type === 'DEICTIC' &&
    action === 'REQUEST_MUTATION'
  ) {
    const lastFailure =
      currentContext.references.filter(
        (reference) =>
          reference.type === 'LAST_FAILURE'
      );
    candidates =
      lastFailure.length > 0
        ? lastFailure
        : currentContext.references.filter(
            (reference) =>
              reference.type === 'LAST_OPERATION'
          );
  } else if (type === 'DEICTIC') {
    candidates =
      currentContext.references;
  } else {
    candidates =
      currentContext.references.filter(
        (reference) =>
          reference.type === type
      );
  }

  if (candidates.length === 0) {
    return resolution(
      'NO_REFERENT',
      {
        requestedType: type,
        reason:
          'No bounded governed reference of this type exists in the current mission.'
      }
    );
  }

  if (candidates.length !== 1) {
    return resolution(
      'AMBIGUOUS_REFERENT',
      {
        requestedType: type,
        candidates,
        reason:
          'More than one bounded governed result could satisfy this weak reference.'
      }
    );
  }

  const reference =
    validateNaturalEngineeringReferent(
      candidates[0]
    );

  if (
    !physicalReferenceIsValid(
      reference,
      currentContext,
      revalidation
    )
  ) {
    return resolution(
      'STALE_REFERENT',
      {
        requestedType: type,
        reference,
        candidates,
        physicalState: 'STALE',
        reason:
          'The physical state changed after this governed result was recorded.'
      }
    );
  }

  return resolution(
    'RESOLVED',
    {
      requestedType: type,
      reference,
      candidates,
      physicalState: 'VALID',
      reason:
        'The bounded mission reference was physically revalidated.'
    }
  );
}

function projectNaturalEngineeringReferenceContext(
  context
) {
  const current =
    validateNaturalEngineeringReferenceContext(
      context
    );

  return deepFreeze({
    schema: PROJECTION_SCHEMA,
    missionId:
      current.missionId,
    count:
      current.references.length,
    types:
      current.references
        .map(
          (reference) => reference.type
        )
        .sort(),
    updatedAt:
      current.updatedAt,
    persistent:
      false,
    providerMemoryAuthoritative:
      false,
    operationalAuthority:
      false,
    mutationAuthority:
      false
  });
}

module.exports = Object.freeze({
  CONTEXT_SCHEMA,
  REFERENT_SCHEMA,
  RESOLUTION_SCHEMA,
  PROJECTION_SCHEMA,
  SUPPORTED_REFERENCE_TYPES,
  KNOWN_UNSUPPORTED_REFERENCE_TYPES,
  RESOLUTION_CLASSES,
  createNaturalEngineeringReferent,
  validateNaturalEngineeringReferent,
  createNaturalEngineeringReferenceContext,
  validateNaturalEngineeringReferenceContext,
  recordNaturalEngineeringGatewayResult,
  resolveNaturalEngineeringReference,
  projectNaturalEngineeringReferenceContext
});
