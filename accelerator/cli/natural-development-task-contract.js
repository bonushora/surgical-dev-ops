'use strict';

/*
 * Defines the authority-free G1 scope contract for one governed development
 * task. Later stages may consume this contract, but this module cannot read,
 * execute, approve, grant, mutate, validate or dispatch anything.
 */

const crypto = require('node:crypto');
const path = require('node:path');

const CONTRACT_SCHEMA =
  'sdo.natural_development_task_contract.v1';

const EVALUATION_SCHEMA =
  'sdo.natural_development_task_boundary_evaluation.v1';

const WORK_MODES = Object.freeze([
  'SUPERVISED_MICROTASKS',
  'BOUNDED_AUTONOMY_TO_BOUNDARY'
]);

const VALIDATION_KINDS = Object.freeze([
  'VALIDATE_JS'
]);

const RISK = Object.freeze({
  R0: 0,
  R1: 1,
  R2: 2,
  R3: 3
});

const STOP_CONDITIONS = Object.freeze([
  'WORKSPACE_EXPANSION',
  'TARGET_EXPANSION',
  'RISK_EXPANSION',
  'ARCHITECTURAL_DECISION',
  'CREDENTIAL_REQUIRED',
  'EXTERNAL_SIDE_EFFECT',
  'UNQUALIFIED_VALIDATION',
  'EVIDENCE_STALE',
  'STEP_BOUND_REACHED',
  'PATCH_ATTEMPT_BOUND_REACHED',
  'CONFLICT_OR_RECOVERY_REQUIRED'
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

function boundedText(value, label, maximum) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > maximum ||
    value.includes('\0')
  ) {
    throw new Error(`${label} is malformed.`);
  }

  return value.trim();
}

function canonicalSha256(value, label) {
  const result = boundedText(value, label, 64);

  if (!/^[a-f0-9]{64}$/.test(result)) {
    throw new Error(`${label} must be canonical SHA-256.`);
  }

  return result;
}

function canonicalGitHead(value) {
  const result = boundedText(
    value,
    'Repository HEAD',
    64
  );

  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(result)) {
    throw new Error('Repository HEAD is malformed.');
  }

  return result;
}

function canonicalTarget(value) {
  const target = boundedText(
    value,
    'Development target',
    1024
  );

  if (
    /[\r\n]/.test(target) ||
    path.posix.isAbsolute(target) ||
    path.win32.isAbsolute(target)
  ) {
    throw new Error(
      'Development target must be one relative path.'
    );
  }

  const portable = target.replace(/\\/g, '/');
  const parts = portable.split('/');

  if (
    portable !== target ||
    parts.some(
      (part) =>
        !part ||
        part === '.' ||
        part === '..'
    ) ||
    path.posix.normalize(portable) !== portable
  ) {
    throw new Error(
      'Development target is non-canonical or traverses scope.'
    );
  }

  return portable;
}

function boundedInteger(value, label, maximum) {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > maximum
  ) {
    throw new Error(`${label} is outside the bounded contract.`);
  }

  return value;
}

function canonicalSet(values, label, canonicalize, maximum) {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.length > maximum
  ) {
    throw new Error(`${label} is outside the bounded contract.`);
  }

  const canonical = values.map(canonicalize);

  if (new Set(canonical).size !== canonical.length) {
    throw new Error(`${label} contains a duplicate.`);
  }

  return Object.freeze([...canonical].sort());
}

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}

function createNaturalDevelopmentTaskContract({
  objective,
  physicalWorkspaceIdentity,
  repositoryHead,
  workMode = 'SUPERVISED_MICROTASKS',
  allowedTargets,
  validationKinds = ['VALIDATE_JS'],
  riskCeiling = 'R3',
  evidenceStepCeiling = 16,
  patchAttemptCeiling = 4
} = {}) {
  const canonicalObjective = boundedText(
    objective,
    'Development objective',
    4096
  );

  if (!WORK_MODES.includes(workMode)) {
    throw new Error('Development work mode is not supported.');
  }

  if (!(riskCeiling in RISK)) {
    throw new Error('Development risk ceiling is not supported.');
  }

  const targets = canonicalSet(
    allowedTargets,
    'Allowed development targets',
    canonicalTarget,
    32
  );

  const validations = canonicalSet(
    validationKinds,
    'Allowed validation kinds',
    (kind) => {
      if (!VALIDATION_KINDS.includes(kind)) {
        throw new Error('Development validation kind is not qualified.');
      }

      return kind;
    },
    VALIDATION_KINDS.length
  );

  if (
    validations.includes('VALIDATE_JS') &&
    !targets.some((target) => target.endsWith('.js'))
  ) {
    throw new Error(
      'JavaScript validation requires an allowed .js target.'
    );
  }

  const binding = deepFreeze({
    schema: CONTRACT_SCHEMA,
    objective: canonicalObjective,
    physicalWorkspaceIdentity: canonicalSha256(
      physicalWorkspaceIdentity,
      'Physical workspace identity'
    ),
    repositoryHead: canonicalGitHead(repositoryHead),
    workMode,
    allowedTargets: targets,
    validationKinds: validations,
    riskCeiling,
    evidenceStepCeiling: boundedInteger(
      evidenceStepCeiling,
      'Evidence-step ceiling',
      64
    ),
    patchAttemptCeiling: boundedInteger(
      patchAttemptCeiling,
      'Patch-attempt ceiling',
      8
    ),
    mutationPolicy: 'EXACT_SEPARATE_R3_AUTHORITY_REQUIRED',
    validationPolicy: 'QUALIFIED_FIXED_VALIDATIONS_ONLY',
    credentialUse: 'FORBIDDEN',
    genericShell: 'FORBIDDEN',
    externalSideEffects: 'STOP_FOR_HUMAN',
    architecturalDecision: 'STOP_FOR_HUMAN',
    stopConditions: STOP_CONDITIONS,
    successCriterion: 'ALL_AUTHORIZED_VALIDATIONS_PASS',
    reusableApproval: false,
    operationalAuthority: false,
    mutationAuthority: false,
    approvalAuthority: false,
    dispatchAuthority: false
  });

  return deepFreeze({
    ...binding,
    contractFingerprint: fingerprint(binding)
  });
}

function boundaryDecision(
  contract,
  decision,
  reason,
  stopCondition = null,
  requiresExactR3Authority = false
) {
  return deepFreeze({
    schema: EVALUATION_SCHEMA,
    decision,
    reason,
    stopCondition,
    contractFingerprint: contract.contractFingerprint,
    requiresExactR3Authority,
    operationalAuthority: false,
    mutationAuthority: false,
    approvalAuthority: false,
    dispatchAuthority: false
  });
}

function evaluateNaturalDevelopmentTaskBoundary(
  contract,
  step
) {
  if (
    !contract ||
    contract.schema !== CONTRACT_SCHEMA ||
    !Object.isFrozen(contract)
  ) {
    throw new Error(
      'Immutable natural development task contract is required.'
    );
  }

  const {
    contractFingerprint,
    ...binding
  } = contract;

  if (
    !/^[a-f0-9]{64}$/.test(contractFingerprint) ||
    fingerprint(binding) !== contractFingerprint ||
    !Object.isFrozen(contract.allowedTargets) ||
    !Object.isFrozen(contract.validationKinds) ||
    !Object.isFrozen(contract.stopConditions)
  ) {
    throw new Error(
      'Natural development task contract binding is malformed.'
    );
  }

  if (
    !step ||
    typeof step !== 'object' ||
    Array.isArray(step) ||
    !Object.isFrozen(step)
  ) {
    throw new Error('Immutable development step is required.');
  }

  if (
    step.physicalWorkspaceIdentity !==
      contract.physicalWorkspaceIdentity
  ) {
    return boundaryDecision(
      contract,
      'STOPPED',
      'Physical workspace expansion requires new human authority.',
      'WORKSPACE_EXPANSION'
    );
  }

  if (step.repositoryHead !== contract.repositoryHead) {
    return boundaryDecision(
      contract,
      'STOPPED',
      'Repository evidence is stale.',
      'EVIDENCE_STALE'
    );
  }

  let target;

  try {
    target = canonicalTarget(step.target);
  } catch {
    return boundaryDecision(
      contract,
      'STOPPED',
      'Target expansion requires new human authority.',
      'TARGET_EXPANSION'
    );
  }

  if (!contract.allowedTargets.includes(target)) {
    return boundaryDecision(
      contract,
      'STOPPED',
      'Target expansion requires new human authority.',
      'TARGET_EXPANSION'
    );
  }

  if (
    !(step.risk in RISK) ||
    RISK[step.risk] > RISK[contract.riskCeiling] ||
    (step.mutating === true && step.risk !== 'R3')
  ) {
    return boundaryDecision(
      contract,
      'STOPPED',
      'Risk expansion requires new human authority.',
      'RISK_EXPANSION'
    );
  }

  if (step.architecturalDecision === true) {
    return boundaryDecision(
      contract,
      'STOPPED',
      'Architectural decisions remain human-sovereign.',
      'ARCHITECTURAL_DECISION'
    );
  }

  if (step.credentialUse === true) {
    return boundaryDecision(
      contract,
      'STOPPED',
      'Credential use requires a separate human decision.',
      'CREDENTIAL_REQUIRED'
    );
  }

  if (step.externalSideEffect === true) {
    return boundaryDecision(
      contract,
      'STOPPED',
      'External side effects require a separate human decision.',
      'EXTERNAL_SIDE_EFFECT'
    );
  }

  if (step.genericShell === true) {
    return boundaryDecision(
      contract,
      'STOPPED',
      'Generic shell is outside the qualified contract.',
      'UNQUALIFIED_VALIDATION'
    );
  }

  if (
    step.validationKind !== null &&
    (
      !contract.validationKinds.includes(step.validationKind) ||
      (
        step.validationKind === 'VALIDATE_JS' &&
        !target.endsWith('.js')
      )
    )
  ) {
    return boundaryDecision(
      contract,
      'STOPPED',
      'Validation expansion is not qualified.',
      'UNQUALIFIED_VALIDATION'
    );
  }

  if (
    !Number.isInteger(step.evidenceStep) ||
    step.evidenceStep < 1 ||
    step.evidenceStep > contract.evidenceStepCeiling
  ) {
    return boundaryDecision(
      contract,
      'STOPPED',
      'Evidence-step ceiling was reached.',
      'STEP_BOUND_REACHED'
    );
  }

  if (
    !Number.isInteger(step.patchAttempt) ||
    step.patchAttempt < 0 ||
    step.patchAttempt > contract.patchAttemptCeiling
  ) {
    return boundaryDecision(
      contract,
      'STOPPED',
      'Patch-attempt ceiling was reached.',
      'PATCH_ATTEMPT_BOUND_REACHED'
    );
  }

  if (step.conflictOrRecoveryRequired === true) {
    return boundaryDecision(
      contract,
      'STOPPED',
      'Conflict or recovery requires a separate governed path.',
      'CONFLICT_OR_RECOVERY_REQUIRED'
    );
  }

  return boundaryDecision(
    contract,
    'CONTAINED',
    'Step remains inside the declared development-task boundary.',
    null,
    step.mutating === true
  );
}

module.exports = Object.freeze({
  CONTRACT_SCHEMA,
  EVALUATION_SCHEMA,
  WORK_MODES,
  VALIDATION_KINDS,
  STOP_CONDITIONS,
  createNaturalDevelopmentTaskContract,
  evaluateNaturalDevelopmentTaskBoundary
});
