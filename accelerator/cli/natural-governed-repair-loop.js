'use strict';

/*
 * R5 process-local composition.
 *
 * This module owns no filesystem, shell, test, Git or approval authority. It
 * sequences immutable mission state through the Integrated Governed Agent
 * Gateway, exact local G4 authority, G5 and the Surgical Orchestrator.
 */

const crypto = require('node:crypto');

const {
  createNaturalAgenticMission,
  validateNaturalAgenticMission,
  transitionNaturalAgenticMission,
  updateNaturalAgenticMissionPlan,
  updateNaturalAgenticMissionPlanStep,
  recordNaturalAgenticMissionAuthorityGrant,
  completeNaturalAgenticMissionGreen,
  blockNaturalAgenticMission,
  cancelNaturalAgenticMission,
  prepareNaturalAgenticMissionForDurableRestart
} = require('../core/natural-agentic-mission');

const {
  evaluateNaturalDevelopmentTaskBoundary
} = require('./natural-development-task-contract');

const {
  createGatewayRequest,
  dispatchGatewayRequest
} = require('../core/integrated-governed-agent-gateway');

const {
  materializeLocalNaturalDevelopmentAuthorization
} = require('./natural-development-local-authorization');

const LOOP_SCHEMA = 'sdo.natural_governed_repair_loop.v1';

const LOOP_STATES = Object.freeze([
  'INVESTIGATING',
  'READY_FOR_REPAIR',
  'AUTHORITY_REQUIRED',
  'TESTING',
  'QUALIFYING',
  'GREEN',
  'BLOCKED',
  'CANCELLED'
]);

const ALLOWED_CAPABILITIES = Object.freeze([
  'workspace.read',
  'evidence.inspect',
  'tests.run',
  'tests.runCanonical',
  'mutation.propose',
  'mutation.applyConditional',
  'mission.status',
  'mission.plan',
  'mission.changes',
  'mission.tests',
  'mission.authority',
  'mission.journal',
  'authority.inspect',
  'authority.request'
]);

const DENIED_CAPABILITIES = Object.freeze([
  'arbitrary.shell',
  'credential.read',
  'network.mutate',
  'git.status',
  'git.diff',
  'git.stage',
  'git.commit',
  'git.push',
  'git.merge',
  'git.tag',
  'release.create',
  'npm.publish',
  'deploy'
]);

const LOOP_FIELDS = Object.freeze([
  'schema', 'state', 'objective', 'mission', 'allowedTargets', 'testTarget',
  'qualificationTarget', 'qualificationAuthorityRef', 'attemptCeiling',
  'attempts', 'pending', 'approvalRequest', 'lastDispatch', 'stopReason',
  'processLocal', 'durableRestart', 'operationalAuthority',
  'mutationAuthority', 'providerAuthority', 'gitAuthority', 'remoteAuthority',
  'releaseAuthority'
]);
const COMPACT_ATTEMPT_FIELDS = Object.freeze([
  'attempt', 'target', 'proposalFingerprint', 'authorizationFingerprint',
  'beforeSha256', 'afterSha256', 'mutationEvidenceDigest',
  'testClassification', 'testEvidenceDigest'
]);
const COMPACT_PENDING_FIELDS = Object.freeze([
  'schema', 'state', 'contract', 'patchProposal',
  'physicalWorkspaceIdentity', 'repositoryPath', 'reusableApproval',
  'operationalAuthority', 'mutationAuthority'
]);
const RESTART_APPROVAL_FIELDS = Object.freeze([
  'operation', 'proposalFingerprint', 'decision', 'reusableAuthority'
]);
const DURABLE_PATCH_FIELDS = Object.freeze([
  'schema', 'contractFingerprint', 'planningFingerprint', 'objective',
  'target', 'beforeSha256', 'replacementBase64', 'replacementBytes',
  'replacementSha256', 'reason', 'validationKind', 'patchAttempt',
  'exactDiff', 'state', 'requiresExactR3Authority', 'reusableApproval',
  'operationalAuthority', 'mutationAuthority', 'approvalAuthority',
  'dispatchAuthority', 'proposalFingerprint'
]);
const DURABLE_CONTRACT_FIELDS = Object.freeze([
  'schema', 'objective', 'physicalWorkspaceIdentity', 'repositoryHead',
  'workMode', 'allowedTargets', 'validationKinds', 'riskCeiling',
  'evidenceStepCeiling', 'patchAttemptCeiling', 'mutationPolicy',
  'validationPolicy', 'credentialUse', 'genericShell',
  'externalSideEffects', 'architecturalDecision', 'stopConditions',
  'successCriterion', 'reusableApproval', 'operationalAuthority',
  'mutationAuthority', 'approvalAuthority', 'dispatchAuthority',
  'contractFingerprint'
]);

const SECRET_PATTERNS = Object.freeze([
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{12,}/i,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9]{20,})\b/,
  /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd)\s*[:=]\s*[^\s,;]+/i
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireText(value, label, maximum = 4096) {
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

function timestamp(value, label = 'R5 timestamp') {
  const text = requireText(value, label, 64);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) {
    throw new Error(`${label} is malformed.`);
  }
  return text;
}

function target(value, label) {
  const text = requireText(value, label, 1024);
  if (
    text.startsWith('/') ||
    text.includes('\\') ||
    text.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error(`${label} is outside the bounded workspace.`);
  }
  return text;
}

function digest(value, label) {
  const text = requireText(value, label, 64);
  if (!/^[a-f0-9]{64}$/.test(text)) throw new Error(`${label} is malformed.`);
  return text;
}

function hash(label, value) {
  return crypto
    .createHash('sha256')
    .update(`${label}\0${JSON.stringify(value)}`, 'utf8')
    .digest('hex');
}

function physicalIdentity(repositoryPath) {
  return crypto
    .createHash('sha256')
    .update(repositoryPath, 'utf8')
    .digest('hex');
}

function loopValue(value) {
  const frozen = deepFreeze(value);
  return deepFreeze({
    ...frozen,
    operationalAuthority: false,
    mutationAuthority: false,
    providerAuthority: false,
    gitAuthority: false,
    remoteAuthority: false,
    releaseAuthority: false
  });
}

function validateNaturalGovernedRepairLoop(loop) {
  if (
    !loop ||
    loop.schema !== LOOP_SCHEMA ||
    !Object.isFrozen(loop) ||
    !LOOP_STATES.includes(loop.state) ||
    loop.operationalAuthority !== false ||
    loop.mutationAuthority !== false ||
    loop.providerAuthority !== false ||
    loop.gitAuthority !== false ||
    loop.remoteAuthority !== false ||
    loop.releaseAuthority !== false ||
    !Array.isArray(loop.allowedTargets) ||
    !Array.isArray(loop.attempts) ||
    !Number.isInteger(loop.attemptCeiling) ||
    loop.attemptCeiling < 1 ||
    loop.attemptCeiling > 8
  ) {
    throw new Error('Immutable bounded R5 repair loop is required.');
  }
  validateNaturalAgenticMission(loop.mission);
  return loop;
}

function exactFields(value, fields, label) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== fields.length ||
    fields.some((field) => !Object.prototype.hasOwnProperty.call(value, field))
  ) {
    throw new Error(`${label} is malformed.`);
  }
}

function unlabelledFingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function validateDurablePatchProposal(proposal) {
  exactFields(proposal, DURABLE_PATCH_FIELDS, 'Persisted R5 patch proposal');
  exactFields(
    proposal.exactDiff,
    ['schema', 'representation', 'target', 'before', 'after', 'contentChanged', 'diffFingerprint'],
    'Persisted R5 exact diff'
  );
  exactFields(proposal.exactDiff.before, ['sha256', 'bytes'], 'Persisted R5 BEFORE diff');
  exactFields(proposal.exactDiff.after, ['sha256', 'bytes'], 'Persisted R5 AFTER diff');
  const replacement = Buffer.from(proposal.replacementBase64, 'base64');
  const { diffFingerprint, ...diffBinding } = proposal.exactDiff;
  const { proposalFingerprint, ...binding } = proposal;
  if (
    proposal.schema !== 'sdo.natural_development_patch_proposal.v1' ||
    proposal.exactDiff.schema !== 'sdo.natural_development_exact_diff.v1' ||
    proposal.state !== 'HUMAN_REVIEW_REQUIRED' ||
    proposal.requiresExactR3Authority !== true ||
    proposal.reusableApproval !== false ||
    proposal.operationalAuthority !== false ||
    proposal.mutationAuthority !== false ||
    proposal.approvalAuthority !== false ||
    proposal.dispatchAuthority !== false ||
    !Number.isInteger(proposal.patchAttempt) ||
    proposal.patchAttempt < 1 ||
    proposal.patchAttempt > 8 ||
    replacement.length < 1 ||
    replacement.length > 1024 * 1024 ||
    replacement.toString('base64') !== proposal.replacementBase64 ||
    replacement.length !== proposal.replacementBytes ||
    crypto.createHash('sha256').update(replacement).digest('hex') !== proposal.replacementSha256 ||
    target(proposal.target, 'Persisted R5 patch target') !== proposal.target ||
    proposal.exactDiff.target !== proposal.target ||
    proposal.exactDiff.representation !== 'FULL_FILE_REPLACEMENT' ||
    proposal.exactDiff.before.sha256 !== proposal.beforeSha256 ||
    proposal.exactDiff.after.sha256 !== proposal.replacementSha256 ||
    proposal.exactDiff.after.bytes !== proposal.replacementBytes ||
    proposal.exactDiff.contentChanged !== true ||
    unlabelledFingerprint(diffBinding) !== diffFingerprint ||
    unlabelledFingerprint(binding) !== proposalFingerprint
  ) {
    throw new Error('Persisted R5 patch proposal has lost integrity.');
  }
  digest(proposal.contractFingerprint, 'Persisted R5 contract fingerprint');
  digest(proposal.planningFingerprint, 'Persisted R5 planning fingerprint');
  digest(proposal.beforeSha256, 'Persisted R5 BEFORE fingerprint');
  digest(proposal.replacementSha256, 'Persisted R5 replacement fingerprint');
  return proposal;
}

function compactAttempt(attempt) {
  return deepFreeze({
    attempt: attempt.attempt,
    target: target(attempt.target, 'Persisted repair target'),
    proposalFingerprint: digest(attempt.proposalFingerprint, 'Persisted proposal fingerprint'),
    authorizationFingerprint: digest(
      attempt.authorizationFingerprint,
      'Historical authorization fingerprint'
    ),
    beforeSha256: digest(attempt.beforeSha256, 'Persisted repair before digest'),
    afterSha256: digest(attempt.afterSha256, 'Persisted repair after digest'),
    mutationEvidenceDigest: digest(
      attempt.mutationEvidenceDigest,
      'Persisted mutation evidence digest'
    ),
    testClassification: requireText(
      attempt.testClassification,
      'Persisted test classification',
      32
    ),
    testEvidenceDigest: digest(
      attempt.testEvidenceDigest,
      'Persisted test evidence digest'
    )
  });
}

function compactPending(pending, persisted = false) {
  if (!pending) return null;
  if (persisted) {
    exactFields(pending, COMPACT_PENDING_FIELDS, 'Persisted pending R5 repair');
  }
  exactFields(
    pending.contract,
    DURABLE_CONTRACT_FIELDS,
    'Persisted R5 development contract'
  );
  const proposal = validateDurablePatchProposal(pending.patchProposal);
  const replacement = Buffer.from(proposal.replacementBase64, 'base64').toString('utf8');
  const durablePayload = JSON.stringify({
    contract: pending.contract,
    proposal
  });
  if (
    SECRET_PATTERNS.some((pattern) =>
      pattern.test(replacement) || pattern.test(durablePayload)
    )
  ) {
    throw new Error('Pending repair contains sensitive content and cannot be persisted.');
  }
  const contractStep = deepFreeze({
    physicalWorkspaceIdentity: pending.contract.physicalWorkspaceIdentity,
    repositoryHead: pending.contract.repositoryHead,
    target: proposal.target,
    risk: 'R3',
    validationKind: proposal.validationKind === 'NONE' ? null : proposal.validationKind,
    evidenceStep: 1,
    patchAttempt: proposal.patchAttempt,
    mutating: true,
    credentialUse: false,
    externalSideEffect: false,
    architecturalDecision: false,
    genericShell: false,
    conflictOrRecoveryRequired: false
  });
  const boundary = evaluateNaturalDevelopmentTaskBoundary(pending.contract, contractStep);
  if (
    boundary.decision !== 'CONTAINED' ||
    proposal.contractFingerprint !== pending.contract.contractFingerprint
  ) {
    throw new Error('Pending repair contract cannot be durably reconstructed.');
  }
  return deepFreeze({
    schema: 'sdo.interactive_natural_development_pending.v1',
    state: 'EXACT_HUMAN_REVIEW_REQUIRED',
    contract: pending.contract,
    patchProposal: proposal,
    physicalWorkspaceIdentity: digest(
      pending.physicalWorkspaceIdentity,
      'Pending repair workspace identity'
    ),
    repositoryPath: requireText(pending.repositoryPath, 'Pending repair repository', 4096),
    reusableApproval: false,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function prepareNaturalGovernedRepairLoopForDurableRestart(loop) {
  const current = validateNaturalGovernedRepairLoop(loop);
  const pending = compactPending(current.pending);
  return loopValue({
    schema: LOOP_SCHEMA,
    state: current.state,
    objective: current.objective,
    mission: prepareNaturalAgenticMissionForDurableRestart(current.mission),
    allowedTargets: [...current.allowedTargets],
    testTarget: current.testTarget,
    qualificationTarget: current.qualificationTarget,
    qualificationAuthorityRef: current.qualificationAuthorityRef,
    attemptCeiling: current.attemptCeiling,
    attempts: current.attempts.map(compactAttempt),
    pending,
    approvalRequest: pending
      ? deepFreeze({
          operation: 'mutation.applyConditional',
          proposalFingerprint: pending.patchProposal.proposalFingerprint,
          decision: 'FRESH_HUMAN_AUTHORITY_REQUIRED',
          reusableAuthority: false
        })
      : null,
    lastDispatch: null,
    stopReason: current.stopReason,
    processLocal: false,
    durableRestart: true
  });
}

function rehydrateNaturalGovernedRepairLoop(value, { mission } = {}) {
  exactFields(value, LOOP_FIELDS, 'Persisted R5 repair loop');
  if (
    value.schema !== LOOP_SCHEMA ||
    value.processLocal !== false ||
    value.durableRestart !== true ||
    value.lastDispatch !== null ||
    value.operationalAuthority !== false ||
    value.mutationAuthority !== false ||
    value.providerAuthority !== false ||
    value.gitAuthority !== false ||
    value.remoteAuthority !== false ||
    value.releaseAuthority !== false ||
    !Array.isArray(value.attempts) ||
    value.attempts.length > value.attemptCeiling
  ) {
    throw new Error('Persisted R5 repair loop safety boundary is malformed.');
  }
  const pending = value.pending === null
    ? null
    : compactPending(deepFreeze(value.pending), true);
  if (value.approvalRequest !== null) {
    exactFields(
      value.approvalRequest,
      RESTART_APPROVAL_FIELDS,
      'Persisted R5 approval descriptor'
    );
    if (
      value.approvalRequest.operation !== 'mutation.applyConditional' ||
      value.approvalRequest.decision !== 'FRESH_HUMAN_AUTHORITY_REQUIRED' ||
      value.approvalRequest.reusableAuthority !== false ||
      !pending ||
      value.approvalRequest.proposalFingerprint !== pending.patchProposal.proposalFingerprint
    ) {
      throw new Error('Persisted R5 approval descriptor is malformed.');
    }
  }
  const restored = loopValue({
    schema: LOOP_SCHEMA,
    state: requireText(value.state, 'Persisted R5 state', 32),
    objective: requireText(value.objective, 'Persisted R5 objective'),
    mission,
    allowedTargets: value.allowedTargets.map((item) => target(item, 'Persisted allowed target')),
    testTarget: target(value.testTarget, 'Persisted targeted test'),
    qualificationTarget: target(value.qualificationTarget, 'Persisted qualification test'),
    qualificationAuthorityRef: requireText(
      value.qualificationAuthorityRef,
      'Persisted qualification authority reference',
      256
    ),
    attemptCeiling: value.attemptCeiling,
    attempts: value.attempts.map((attempt) => {
      exactFields(attempt, COMPACT_ATTEMPT_FIELDS, 'Persisted R5 repair attempt');
      return compactAttempt(attempt);
    }),
    pending,
    approvalRequest: value.approvalRequest === null
      ? null
      : deepFreeze(value.approvalRequest),
    lastDispatch: null,
    stopReason: value.stopReason === null
      ? null
      : requireText(value.stopReason, 'Persisted R5 stop reason', 128),
    processLocal: false,
    durableRestart: true
  });
  if (
    restored.objective !== mission.objective ||
    (pending && pending.repositoryPath !== mission.binding.repositoryPath)
  ) {
    throw new Error('Persisted R5 repair loop belongs to another mission or workspace.');
  }
  return validateNaturalGovernedRepairLoop(restored);
}

function bindNaturalGovernedRepairLoopAfterRestart(
  loop,
  { mission, physicalStateValid } = {}
) {
  const current = validateNaturalGovernedRepairLoop(loop);
  validateNaturalAgenticMission(mission);
  if (mission.missionId !== current.mission.missionId) {
    throw new Error('Restarted R5 loop mission identity is inconsistent.');
  }
  return loopValue({
    ...current,
    state: physicalStateValid === true ? current.state : 'BLOCKED',
    mission,
    pending: physicalStateValid === true ? current.pending : null,
    approvalRequest: physicalStateValid === true ? current.approvalRequest : null,
    lastDispatch: null,
    stopReason: physicalStateValid === true
      ? current.stopReason
      : 'STALE_STATE',
    processLocal: false,
    durableRestart: true
  });
}

function createNaturalGovernedRepairLoop({
  objective,
  session,
  allowedTargets,
  testTarget,
  qualificationTarget,
  createdAt,
  attemptCeiling = 4,
  provider = {}
} = {}) {
  const at = timestamp(createdAt);
  const boundedTargets = Array.isArray(allowedTargets)
    ? [...new Set(allowedTargets.map((item) => target(item, 'Repair target')))]
    : [];
  if (
    boundedTargets.length === 0 ||
    boundedTargets.length > 8 ||
    !Number.isInteger(attemptCeiling) ||
    attemptCeiling < 1 ||
    attemptCeiling > 8
  ) {
    throw new Error('R5 repair targets or attempt ceiling are outside the bounded contract.');
  }
  const test = target(testTarget, 'Targeted test');
  const qualification = target(qualificationTarget, 'Qualification test');
  const qualificationAuthorityRef = `r5-qualification-${hash(
    'sdo.natural_r5_qualification_authority.v1',
    { objective, qualification, session: session && session.sessionFingerprint }
  )}`;
  const expiresAt = new Date(Date.parse(at) + 60 * 60_000).toISOString();
  const mission = createNaturalAgenticMission({
    missionId: `natural-r5-${hash('sdo.natural_r5_mission.v1', {
      objective,
      session: session && session.sessionFingerprint,
      createdAt: at
    })}`,
    objective: requireText(objective, 'R5 objective'),
    session,
    createdAt: at,
    plan: [
      {
        stepId: 'inspect-failure',
        summary: `Run ${test} and capture the physical failure.`,
        status: 'ACTIVE',
        operation: 'tests.run'
      },
      {
        stepId: 'prepare-repair-1',
        summary: 'Inspect bounded evidence and prepare the first minimal repair.',
        status: 'PENDING',
        operation: 'mutation.propose'
      },
      {
        stepId: 'qualification',
        summary: `Run bounded canonical qualification ${qualification}.`,
        status: 'PENDING',
        operation: 'tests.runCanonical'
      }
    ],
    authority: {
      allowedCapabilities: ALLOWED_CAPABILITIES,
      deniedCapabilities: DENIED_CAPABILITIES,
      grants: [{
        authorityRef: qualificationAuthorityRef,
        capability: 'tests.runCanonical',
        operation: 'tests.runCanonical',
        scope: { target: qualification },
        issuedAt: at,
        expiresAt,
        lifetime: 'MISSION_SCOPED',
        authorityNotGranted: DENIED_CAPABILITIES
      }]
    },
    provider
  });
  return loopValue({
    schema: LOOP_SCHEMA,
    state: 'INVESTIGATING',
    objective: mission.objective,
    mission,
    allowedTargets: boundedTargets.sort(),
    testTarget: test,
    qualificationTarget: qualification,
    qualificationAuthorityRef,
    attemptCeiling,
    attempts: [],
    pending: null,
    approvalRequest: null,
    lastDispatch: null,
    stopReason: null,
    processLocal: true,
    durableRestart: false
  });
}

function dispatch(loop, operation, args, at, options = {}, authorityRef = null) {
  const current = validateNaturalGovernedRepairLoop(loop);
  const requestedAt = timestamp(at);
  if (typeof options.onMissionState === 'function') {
    try {
      options.onMissionState(current.mission, operation);
    } catch {
      // Presentation cannot alter governed repair execution.
    }
  }
  const request = createGatewayRequest({
    requestId: `${current.mission.missionId}-r5-${current.mission.events.length + 1}`,
    mission: current.mission,
    operation,
    args,
    authorityRef,
    requestedAt
  });
  return dispatchGatewayRequest({
    request,
    mission: current.mission,
    options: {
      ...options,
      now: () => requestedAt
    }
  });
}

function evidenceRef(dispatchResult, kind) {
  return {
    kind,
    target: dispatchResult.result.data && dispatchResult.result.data.target,
    fingerprint: digest(dispatchResult.result.evidenceDigest, 'Gateway evidence digest')
  };
}

function investigateNaturalGovernedRepairFailure(loop, { at, gatewayOptions = {} } = {}) {
  const current = validateNaturalGovernedRepairLoop(loop);
  if (current.state !== 'INVESTIGATING') {
    throw new Error('R5 investigation is not the current loop state.');
  }
  const testDispatch = dispatch(
    current,
    'tests.run',
    { target: current.testTarget },
    at,
    gatewayOptions
  );
  let mission = testDispatch.mission;
  const failed = testDispatch.result.classification === 'FAILURE';
  mission = updateNaturalAgenticMissionPlanStep(mission, {
    stepId: 'inspect-failure',
    status: 'COMPLETED',
    resultClass: failed ? 'SUCCESS' : 'PASSED',
    evidenceRef: evidenceRef(testDispatch, 'INITIAL_TEST_EVIDENCE'),
    at,
    eventSummary: failed
      ? 'Physical test failure was captured as bounded repair evidence.'
      : 'The bounded test was already passing.'
  });
  if (!failed) {
    mission = updateNaturalAgenticMissionPlanStep(mission, {
      stepId: 'prepare-repair-1',
      status: 'BLOCKED',
      resultClass: 'INCOMPLETE_EVIDENCE',
      blocker: 'No physical failure exists to justify a repair.',
      at,
      eventSummary: 'Repair stopped because no physical failure was established.'
    });
    mission = updateNaturalAgenticMissionPlanStep(mission, {
      stepId: 'qualification',
      status: 'BLOCKED',
      resultClass: 'INCOMPLETE_EVIDENCE',
      blocker: 'Qualification cannot substitute for an absent repair defect.',
      at,
      eventSummary: 'Qualification remained blocked without a repair defect.'
    });
    mission = blockNaturalAgenticMission(mission, {
      reason: 'R5 repair stopped fail-closed because the initial physical test was not RED.',
      at
    });
    return loopValue({
      ...current,
      state: 'BLOCKED',
      mission,
      lastDispatch: testDispatch,
      stopReason: 'INCOMPLETE_EVIDENCE'
    });
  }
  mission = updateNaturalAgenticMissionPlanStep(mission, {
    stepId: 'prepare-repair-1',
    status: 'ACTIVE',
    at,
    eventSummary: 'The first evidence-bound repair proposal may now be prepared.'
  });
  return loopValue({
    ...current,
    state: 'READY_FOR_REPAIR',
    mission,
    lastDispatch: testDispatch
  });
}

function validatePending(loop, pending) {
  if (
    !pending ||
    pending.schema !== 'sdo.interactive_natural_development_pending.v1' ||
    pending.state !== 'EXACT_HUMAN_REVIEW_REQUIRED' ||
    !Object.isFrozen(pending) ||
    !pending.patchProposal ||
    pending.patchProposal.patchAttempt !== loop.attempts.length + 1 ||
    pending.patchProposal.objective !== loop.objective ||
    !loop.allowedTargets.includes(pending.patchProposal.target) ||
    pending.repositoryPath !== loop.mission.binding.repositoryPath ||
    pending.physicalWorkspaceIdentity !== physicalIdentity(
      loop.mission.binding.repositoryPath
    )
  ) {
    throw new Error('Exact evidence-bound R5 repair proposal is required.');
  }
  if (
    loop.attempts.some(
      (attempt) => attempt.target === pending.patchProposal.target
    )
  ) {
    throw new Error('R5 cannot silently reuse a previously mutated target scope.');
  }
  return pending;
}

function insertBeforeQualification(plan, additions) {
  const index = plan.findIndex((step) => step.stepId === 'qualification');
  if (index < 0) throw new Error('R5 qualification plan step is unavailable.');
  return [
    ...plan.slice(0, index),
    ...additions,
    ...plan.slice(index)
  ];
}

function proposeNaturalGovernedRepair(loop, { pending, at, gatewayOptions = {} } = {}) {
  const current = validateNaturalGovernedRepairLoop(loop);
  if (current.state !== 'READY_FOR_REPAIR') {
    throw new Error('R5 is not ready to prepare another repair.');
  }
  const exact = validatePending(current, pending);
  const attempt = current.attempts.length + 1;
  const prepareStepId = `prepare-repair-${attempt}`;
  let mission = transitionNaturalAgenticMission(current.mission, {
    type: 'REPAIR_STARTED',
    state: 'REPAIRING',
    summary: `Evidence-bound repair attempt ${attempt} started.`,
    at,
    evidenceRef: {
      kind: 'REPAIR_PROPOSAL',
      target: exact.patchProposal.target,
      fingerprint: exact.patchProposal.proposalFingerprint
    }
  });
  const proposalDispatch = dispatch(
    loopValue({ ...current, mission }),
    'mutation.propose',
    {
      proposal: {
        schema: 'sdo.ai_engineering_patch_proposal.v1',
        objective: exact.governedProposal.objective,
        target: exact.governedProposal.target,
        beforeSha256: exact.governedProposal.beforeSha256,
        replacementBase64: exact.governedProposal.replacementBase64,
        reason: exact.governedProposal.reason,
        validationKind: exact.governedProposal.validationKind
      }
    },
    at,
    gatewayOptions
  );
  if (proposalDispatch.result.classification !== 'SUCCESS') {
    throw new Error(
      `R5 mutation proposal failed governed validation: ${proposalDispatch.result.reason}`
    );
  }
  mission = proposalDispatch.mission;
  mission = updateNaturalAgenticMissionPlanStep(mission, {
    stepId: prepareStepId,
    status: 'COMPLETED',
    resultClass: 'SUCCESS',
    evidenceRef: {
      kind: 'REPAIR_PROPOSAL',
      target: exact.patchProposal.target,
      fingerprint: exact.patchProposal.proposalFingerprint
    },
    at,
    eventSummary: `Minimal repair proposal ${attempt} was physically bound and validated.`
  });
  const authorityStepId = `await-authority-${attempt}`;
  const applyStepId = `apply-repair-${attempt}`;
  const testStepId = `test-repair-${attempt}`;
  mission = updateNaturalAgenticMissionPlan(mission, {
    plan: insertBeforeQualification(mission.plan, [
      {
        stepId: authorityStepId,
        summary: `Await exact mutation authority for ${exact.patchProposal.target}.`,
        status: 'ACTIVE',
        operation: 'authority.request',
        sourceOperation: 'mutation.applyConditional'
      },
      {
        stepId: applyStepId,
        summary: `Apply repair ${attempt} through conditional G5 mutation.`,
        status: 'PENDING',
        operation: 'mutation.applyConditional'
      },
      {
        stepId: testStepId,
        summary: `Run ${current.testTarget} after repair ${attempt}.`,
        status: 'PENDING',
        operation: 'tests.run'
      }
    ]),
    at,
    summary: `Repair attempt ${attempt} entered the independent authority boundary.`
  });
  const scope = {
    target: exact.patchProposal.target,
    beforeSha256: exact.patchProposal.beforeSha256,
    afterSha256: exact.patchProposal.replacementSha256,
    proposalFingerprint: exact.patchProposal.proposalFingerprint
  };
  const authorityDispatch = dispatch(
    loopValue({ ...current, mission }),
    'authority.request',
    {
      operation: 'mutation.applyConditional',
      reason: exact.patchProposal.reason,
      scope
    },
    at,
    gatewayOptions
  );
  if (authorityDispatch.result.classification !== 'AUTHORITY_REQUIRED') {
    throw new Error('R5 exact mutation authority boundary was not established.');
  }
  return loopValue({
    ...current,
    state: 'AUTHORITY_REQUIRED',
    mission: authorityDispatch.mission,
    pending: exact,
    approvalRequest: authorityDispatch.result.approvalRequest,
    lastDispatch: authorityDispatch,
    stopReason: 'AUTHORITY_REQUIRED'
  });
}

function mutationScope(proposal) {
  return {
    target: proposal.target,
    beforeSha256: proposal.beforeSha256,
    afterSha256: proposal.replacementSha256,
    proposalFingerprint: proposal.proposalFingerprint
  };
}

function stopAfterDispatch(current, dispatchResult, stepId, at) {
  let mission = dispatchResult.mission;
  const classification = dispatchResult.result.classification;
  mission = updateNaturalAgenticMissionPlanStep(mission, {
    stepId,
    status: 'BLOCKED',
    resultClass: classification,
    blocker: dispatchResult.result.reason,
    evidenceRef: evidenceRef(dispatchResult, 'REPAIR_STOP_EVIDENCE'),
    at,
    eventSummary: 'The governed repair operation stopped without GREEN.'
  });
  mission = blockNaturalAgenticMission(mission, {
    reason: dispatchResult.result.reason,
    at
  });
  return loopValue({
    ...current,
    state: 'BLOCKED',
    mission,
    lastDispatch: dispatchResult,
    pending: null,
    approvalRequest: null,
    stopReason: classification
  });
}

function authorizeAndContinueNaturalGovernedRepair(
  loop,
  {
    approvedProposalFingerprint,
    authorityRoot,
    journalStorageRoot,
    tenantId = null,
    projectId = null,
    at,
    gatewayOptions = {}
  } = {}
) {
  const current = validateNaturalGovernedRepairLoop(loop);
  if (current.state !== 'AUTHORITY_REQUIRED' || !current.pending) {
    throw new Error('No exact R5 repair proposal is awaiting authority.');
  }
  const exact = current.pending;
  const proposal = exact.patchProposal;
  if (approvedProposalFingerprint !== proposal.proposalFingerprint) {
    throw new Error('Human authority does not match the exact pending repair proposal.');
  }
  const authorization = materializeLocalNaturalDevelopmentAuthorization({
    patchProposal: proposal,
    approvedProposalFingerprint,
    physicalWorkspaceIdentity: exact.physicalWorkspaceIdentity,
    repositoryPath: exact.repositoryPath,
    authorityRoot,
    journalStorageRoot,
    tenantId,
    projectId
  });
  const requestedAt = timestamp(at);
  const operationAt = Date.parse(requestedAt) > Date.parse(authorization.authorizedAt)
    ? requestedAt
    : authorization.authorizedAt;
  const scope = mutationScope(proposal);
  let mission = recordNaturalAgenticMissionAuthorityGrant(current.mission, {
    grant: {
      authorityRef: authorization.authorizationFingerprint,
      capability: 'mutation.applyConditional',
      operation: 'mutation.applyConditional',
      scope,
      issuedAt: authorization.authorizedAt,
      expiresAt: authorization.expiresAt,
      lifetime: 'ONE_SHOT',
      authorityNotGranted: DENIED_CAPABILITIES
    },
    at: authorization.authorizedAt
  });
  const attempt = current.attempts.length + 1;
  mission = updateNaturalAgenticMissionPlanStep(mission, {
    stepId: `await-authority-${attempt}`,
    status: 'COMPLETED',
    resultClass: 'SUCCESS',
    evidenceRef: {
      kind: 'AUTHORITY_GRANT',
      target: proposal.target,
      fingerprint: authorization.authorizationFingerprint
    },
    at: authorization.authorizedAt,
    eventSummary: `Exact one-shot authority for repair ${attempt} was verified.`
  });
  mission = updateNaturalAgenticMissionPlanStep(mission, {
    stepId: `apply-repair-${attempt}`,
    status: 'ACTIVE',
    at: authorization.authorizedAt,
    eventSummary: `Conditional repair ${attempt} reached the governed dispatch boundary.`
  });
  const binding = {
    contractFingerprint: exact.contract.contractFingerprint,
    proposalFingerprint: proposal.proposalFingerprint,
    authorizationFingerprint: authorization.authorizationFingerprint,
    target: proposal.target,
    beforeSha256: proposal.beforeSha256,
    afterSha256: proposal.replacementSha256
  };
  const mutationDispatch = dispatch(
    loopValue({ ...current, mission }),
    'mutation.applyConditional',
    {
      scope,
      targetCas: {
        target: proposal.target,
        beforeSha256: proposal.beforeSha256
      },
      naturalDevelopment: binding
    },
    operationAt,
    {
      ...gatewayOptions,
      naturalDevelopment: {
        contract: exact.contract,
        patchProposal: proposal,
        patchAuthorization: authorization,
        physicalWorkspaceIdentity: exact.physicalWorkspaceIdentity,
        repositoryPath: exact.repositoryPath,
        authorityRoot,
        journalStorageRoot,
        tenantId,
        projectId
      }
    },
    authorization.authorizationFingerprint
  );
  if (mutationDispatch.result.classification !== 'SUCCESS') {
    return stopAfterDispatch(
      current,
      mutationDispatch,
      `apply-repair-${attempt}`,
      operationAt
    );
  }
  mission = mutationDispatch.mission;
  mission = updateNaturalAgenticMissionPlanStep(mission, {
    stepId: `apply-repair-${attempt}`,
    status: 'COMPLETED',
    resultClass: 'SUCCESS',
    evidenceRef: evidenceRef(mutationDispatch, 'CONDITIONAL_MUTATION'),
    at: operationAt,
    eventSummary: `Conditional repair ${attempt} completed with physical CAS evidence.`
  });
  mission = updateNaturalAgenticMissionPlanStep(mission, {
    stepId: `test-repair-${attempt}`,
    status: 'ACTIVE',
    at: operationAt,
    eventSummary: `The bounded test became active after repair ${attempt}.`
  });
  const testDispatch = dispatch(
    loopValue({ ...current, mission }),
    'tests.run',
    { target: current.testTarget },
    operationAt,
    gatewayOptions
  );
  mission = testDispatch.mission;
  const passed = testDispatch.result.classification === 'SUCCESS';
  mission = updateNaturalAgenticMissionPlanStep(mission, {
    stepId: `test-repair-${attempt}`,
    status: passed ? 'COMPLETED' : 'BLOCKED',
    resultClass: passed ? 'PASSED' : 'FAILED',
    evidenceRef: evidenceRef(testDispatch, 'TARGETED_TEST_RESULT'),
    ...(passed ? {} : { blocker: testDispatch.result.reason }),
    at: operationAt,
    eventSummary: passed
      ? `Repair ${attempt} passed the physical targeted test.`
      : `Repair ${attempt} remains RED under the physical targeted test.`
  });
  const recordedAttempt = deepFreeze({
    attempt,
    target: proposal.target,
    proposalFingerprint: proposal.proposalFingerprint,
    authorizationFingerprint: authorization.authorizationFingerprint,
    beforeSha256: proposal.beforeSha256,
    afterSha256: proposal.replacementSha256,
    mutationEvidenceDigest: mutationDispatch.result.evidenceDigest,
    testClassification: passed ? 'PASSED' : 'FAILED',
    testEvidenceDigest: testDispatch.result.evidenceDigest,
    composition: mutationDispatch.result.data.composition
  });
  const attempts = [...current.attempts, recordedAttempt];
  if (!passed) {
    if (attempt >= current.attemptCeiling) {
      mission = updateNaturalAgenticMissionPlanStep(mission, {
        stepId: 'qualification',
        status: 'BLOCKED',
        resultClass: 'FAILED',
        blocker: 'The bounded repair-attempt ceiling was reached while tests remained RED.',
        at: operationAt,
        eventSummary: 'Canonical qualification was blocked by the repair-attempt ceiling.'
      });
      mission = blockNaturalAgenticMission(mission, {
        reason: 'R5 repair-attempt ceiling reached with physical tests still RED.',
        at: operationAt
      });
      return loopValue({
        ...current,
        state: 'BLOCKED',
        mission,
        attempts,
        pending: null,
        approvalRequest: null,
        lastDispatch: testDispatch,
        stopReason: 'PATCH_ATTEMPT_BOUND_REACHED'
      });
    }
    mission = updateNaturalAgenticMissionPlan(mission, {
      plan: insertBeforeQualification(mission.plan, [{
        stepId: `prepare-repair-${attempt + 1}`,
        summary: `Inspect new failure evidence and prepare repair ${attempt + 1}.`,
        status: 'ACTIVE',
        operation: 'mutation.propose',
        sourceOperation: 'tests.run'
      }]),
      at: operationAt,
      summary: `Physical RED evidence opened bounded repair attempt ${attempt + 1}.`
    });
    return loopValue({
      ...current,
      state: 'READY_FOR_REPAIR',
      mission,
      attempts,
      pending: null,
      approvalRequest: null,
      lastDispatch: testDispatch,
      stopReason: 'TEST_FAILED'
    });
  }
  mission = updateNaturalAgenticMissionPlanStep(mission, {
    stepId: 'qualification',
    status: 'ACTIVE',
    at: operationAt,
    eventSummary: 'Targeted GREEN advanced the mission to bounded canonical qualification.'
  });
  const qualificationDispatch = dispatch(
    loopValue({ ...current, mission }),
    'tests.runCanonical',
    {
      target: current.qualificationTarget,
      scope: { target: current.qualificationTarget }
    },
    operationAt,
    gatewayOptions,
    current.qualificationAuthorityRef
  );
  mission = qualificationDispatch.mission;
  if (qualificationDispatch.result.classification !== 'SUCCESS') {
    return stopAfterDispatch(
      loopValue({ ...current, attempts }),
      qualificationDispatch,
      'qualification',
      operationAt
    );
  }
  mission = updateNaturalAgenticMissionPlanStep(mission, {
    stepId: 'qualification',
    status: 'COMPLETED',
    resultClass: 'PASSED',
    evidenceRef: evidenceRef(qualificationDispatch, 'CANONICAL_TEST_RESULT'),
    at: operationAt,
    eventSummary: 'The bounded canonical qualification ladder completed physically GREEN.'
  });
  mission = completeNaturalAgenticMissionGreen(mission, { at: operationAt });
  return loopValue({
    ...current,
    state: 'GREEN',
    mission,
    attempts,
    pending: null,
    approvalRequest: null,
    lastDispatch: qualificationDispatch,
    stopReason: null
  });
}

function denyNaturalGovernedRepairAuthority(loop, { at, reason = 'Human denied the exact repair authority.' } = {}) {
  const current = validateNaturalGovernedRepairLoop(loop);
  if (current.state !== 'AUTHORITY_REQUIRED' || !current.pending) {
    throw new Error('No exact R5 repair authority request is pending.');
  }
  const attempt = current.attempts.length + 1;
  let mission = transitionNaturalAgenticMission(current.mission, {
    type: 'AUTHORITY_DENIED',
    state: 'BLOCKED',
    summary: requireText(reason, 'Authority denial reason', 512),
    at,
    resultClass: 'DENIED'
  });
  mission = updateNaturalAgenticMissionPlanStep(mission, {
    stepId: `await-authority-${attempt}`,
    status: 'BLOCKED',
    resultClass: 'DENIED',
    blocker: reason,
    at,
    eventSummary: `Human denied repair authority for attempt ${attempt}.`
  });
  for (const stepId of [`apply-repair-${attempt}`, `test-repair-${attempt}`, 'qualification']) {
    mission = updateNaturalAgenticMissionPlanStep(mission, {
      stepId,
      status: 'BLOCKED',
      resultClass: 'DENIED',
      blocker: 'Authority denial prevented this operation.',
      at,
      eventSummary: 'A later repair operation remained blocked after authority denial.'
    });
  }
  mission = blockNaturalAgenticMission(mission, { reason, at });
  return loopValue({
    ...current,
    state: 'BLOCKED',
    mission,
    pending: null,
    approvalRequest: null,
    stopReason: 'AUTHORITY_DENIED'
  });
}

function cancelNaturalGovernedRepairLoop(loop, { at, reason = 'Human cancelled the active R5 repair loop.' } = {}) {
  const current = validateNaturalGovernedRepairLoop(loop);
  if (current.state === 'GREEN' || current.state === 'CANCELLED') {
    throw new Error('Terminal R5 repair loop cannot be cancelled again.');
  }
  const mission = cancelNaturalAgenticMission(current.mission, { reason, at });
  return loopValue({
    ...current,
    state: 'CANCELLED',
    mission,
    pending: null,
    approvalRequest: null,
    stopReason: 'CANCELLED'
  });
}

module.exports = Object.freeze({
  LOOP_SCHEMA,
  LOOP_STATES,
  ALLOWED_CAPABILITIES,
  DENIED_CAPABILITIES,
  createNaturalGovernedRepairLoop,
  validateNaturalGovernedRepairLoop,
  prepareNaturalGovernedRepairLoopForDurableRestart,
  rehydrateNaturalGovernedRepairLoop,
  bindNaturalGovernedRepairLoopAfterRestart,
  investigateNaturalGovernedRepairFailure,
  proposeNaturalGovernedRepair,
  authorizeAndContinueNaturalGovernedRepair,
  denyNaturalGovernedRepairAuthority,
  cancelNaturalGovernedRepairLoop
});
