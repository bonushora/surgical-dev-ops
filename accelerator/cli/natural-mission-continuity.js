'use strict';

/*
 * R6 authority-free continuity record.
 *
 * This module records and reconstructs bounded mission truth. It owns no
 * filesystem write, operation, mutation, test, Git, approval or provider
 * authority. The adapter owns durable bytes; physical workspace evidence owns
 * restart eligibility.
 */

const crypto = require('node:crypto');

const {
  canonicalizeAuthorizedRoot
} = require('../core/workspace-boundary');
const {
  revalidateDeterministicWorkspaceSession
} = require('../adapters/deterministic-workspace-session-adapter');
const {
  validateNaturalAgenticMission,
  rehydrateNaturalAgenticMission,
  prepareNaturalAgenticMissionForDurableRestart,
  resumeNaturalAgenticMission,
  selectNaturalAgenticMissionContinuation
} = require('../core/natural-agentic-mission');
const {
  createNaturalEngineeringReferenceContext
} = require('../core/natural-engineering-reference-context');
const {
  prepareNaturalGovernedRepairLoopForDurableRestart,
  rehydrateNaturalGovernedRepairLoop,
  bindNaturalGovernedRepairLoopAfterRestart
} = require('./natural-governed-repair-loop');

const CONTINUITY_SCHEMA = 'sdo.natural_mission_continuity.v1';
const CONTINUITY_SCHEMA_VERSION = 1;
const CONTINUITY_FIELDS = Object.freeze([
  'schema',
  'schemaVersion',
  'missionId',
  'repositoryPath',
  'physicalWorkspaceIdentity',
  'repositoryHead',
  'worktreeFingerprint',
  'checkpointEventCount',
  'latestEventHash',
  'recordedAt',
  'mission',
  'repairLoop',
  'pendingOperation',
  'pendingApproval',
  'authoritySerialized',
  'providerMemoryAuthoritative',
  'operationalAuthority',
  'mutationAuthority',
  'recordFingerprint'
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(`${CONTINUITY_SCHEMA}\0${JSON.stringify(canonicalize(value))}`, 'utf8')
    .digest('hex');
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

function timestamp(value, label) {
  if (
    typeof value !== 'string' ||
    value.length > 64 ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(Date.parse(value)).toISOString() !== value
  ) {
    throw new Error(`${label} is malformed.`);
  }
  return value;
}

function digest(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} is malformed.`);
  }
  return value;
}

function objectId(value, label) {
  if (typeof value !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value)) {
    throw new Error(`${label} is malformed.`);
  }
  return value;
}

function boundedText(value, label, maximum = 1024, optional = false) {
  if (optional && value === null) return null;
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.trim() ||
    value.length > maximum ||
    value.includes('\0')
  ) {
    throw new Error(`${label} is malformed.`);
  }
  return value;
}

function validateOperationDescriptor(value, mission) {
  if (value === null) return null;
  exactFields(
    value,
    ['stepId', 'operation', 'status', 'resultClass', 'evidenceFingerprint'],
    'Continuity pending operation descriptor'
  );
  const stepId = boundedText(value.stepId, 'Continuity pending step id', 128);
  const step = mission.plan.find((item) => item.stepId === stepId);
  if (
    !step ||
    value.operation !== (step.operation || null) ||
    value.status !== step.status ||
    value.resultClass !== (step.resultClass || null) ||
    value.evidenceFingerprint !== (step.evidenceRef?.fingerprint || null)
  ) {
    throw new Error('Continuity pending operation does not match the mission plan.');
  }
  boundedText(value.operation, 'Continuity pending operation', 128, true);
  boundedText(value.resultClass, 'Continuity pending result class', 64, true);
  if (value.evidenceFingerprint !== null) {
    digest(value.evidenceFingerprint, 'Continuity pending evidence fingerprint');
  }
  return value;
}

function validateApprovalDescriptor(value, mission) {
  if (value === null) return null;
  exactFields(
    value,
    ['stepId', 'requestedOperation', 'decision', 'reusableAuthority'],
    'Continuity pending approval descriptor'
  );
  const step = mission.plan.find((item) => item.stepId === value.stepId);
  if (
    !step ||
    !(
      (step.status === 'ACTIVE' && step.operation === 'authority.request') ||
      (step.status === 'BLOCKED' && step.resultClass === 'AUTHORITY_REQUIRED')
    ) ||
    value.requestedOperation !== (step.sourceOperation || null) ||
    value.decision !== 'REVALIDATION_REQUIRED' ||
    value.reusableAuthority !== false
  ) {
    throw new Error('Continuity pending approval does not match its authority boundary.');
  }
  return value;
}

function operationDescriptor(mission) {
  const step = mission.plan.find((item) => item.status === 'ACTIVE') ||
    [...mission.plan].reverse().find((item) => item.status === 'BLOCKED') ||
    mission.plan.find((item) => item.status === 'PENDING') ||
    null;
  if (!step) return null;
  return deepFreeze({
    stepId: step.stepId,
    operation: step.operation || null,
    status: step.status,
    resultClass: step.resultClass || null,
    evidenceFingerprint: step.evidenceRef?.fingerprint || null
  });
}

function approvalDescriptor(mission) {
  const step = mission.plan.find((item) =>
    item.status === 'ACTIVE' && item.operation === 'authority.request'
  ) || [...mission.plan].reverse().find((item) =>
    item.status === 'BLOCKED' && item.resultClass === 'AUTHORITY_REQUIRED'
  );
  if (!step) return null;
  return deepFreeze({
    stepId: step.stepId,
    requestedOperation: step.sourceOperation || null,
    decision: 'REVALIDATION_REQUIRED',
    reusableAuthority: false
  });
}

function createNaturalMissionContinuityCheckpoint({
  mission,
  repairLoop = null,
  recordedAt
} = {}) {
  const current = validateNaturalAgenticMission(mission);
  const durableRepairLoop = repairLoop === null
    ? null
    : prepareNaturalGovernedRepairLoopForDurableRestart(repairLoop);
  if (durableRepairLoop && durableRepairLoop.mission.missionId !== current.missionId) {
    throw new Error('R5 repair continuity does not match the active mission.');
  }
  const authorityFreeMission = durableRepairLoop
    ? durableRepairLoop.mission
    : prepareNaturalAgenticMissionForDurableRestart(current);
  const checkpointTime = timestamp(recordedAt, 'Continuity record time');
  if (Date.parse(checkpointTime) < Date.parse(authorityFreeMission.updatedAt)) {
    throw new Error('Continuity record time cannot precede its physical mission evidence.');
  }
  const body = {
    schema: CONTINUITY_SCHEMA,
    schemaVersion: CONTINUITY_SCHEMA_VERSION,
    missionId: authorityFreeMission.missionId,
    repositoryPath: authorityFreeMission.binding.repositoryPath,
    physicalWorkspaceIdentity: authorityFreeMission.binding.physicalWorkspaceIdentity,
    repositoryHead: authorityFreeMission.binding.repositoryHead,
    worktreeFingerprint: authorityFreeMission.binding.worktreeFingerprint,
    checkpointEventCount: authorityFreeMission.events.length,
    latestEventHash: authorityFreeMission.events.at(-1).eventHash,
    recordedAt: checkpointTime,
    mission: authorityFreeMission,
    repairLoop: durableRepairLoop,
    pendingOperation: operationDescriptor(authorityFreeMission),
    pendingApproval: approvalDescriptor(authorityFreeMission),
    authoritySerialized: false,
    providerMemoryAuthoritative: false,
    operationalAuthority: false,
    mutationAuthority: false
  };
  return deepFreeze({
    ...body,
    recordFingerprint: fingerprint(body)
  });
}

function validateNaturalMissionContinuityCheckpoint(value) {
  exactFields(value, CONTINUITY_FIELDS, 'Durable mission continuity record');
  if (
    value.schema !== CONTINUITY_SCHEMA ||
    value.schemaVersion !== CONTINUITY_SCHEMA_VERSION ||
    value.authoritySerialized !== false ||
    value.providerMemoryAuthoritative !== false ||
    value.operationalAuthority !== false ||
    value.mutationAuthority !== false
  ) {
    throw new Error('Durable mission continuity safety boundary is malformed.');
  }
  const mission = rehydrateNaturalAgenticMission(value.mission);
  const repairLoop = value.repairLoop === null
    ? null
    : rehydrateNaturalGovernedRepairLoop(deepFreeze(value.repairLoop), { mission });
  validateOperationDescriptor(value.pendingOperation, mission);
  validateApprovalDescriptor(value.pendingApproval, mission);
  const canonicalRepository = canonicalizeAuthorizedRoot(value.repositoryPath);
  if (
    canonicalRepository !== value.repositoryPath ||
    mission.missionId !== value.missionId ||
    mission.binding.repositoryPath !== value.repositoryPath ||
    mission.binding.physicalWorkspaceIdentity !== digest(
      value.physicalWorkspaceIdentity,
      'Continuity physical workspace identity'
    ) ||
    mission.binding.repositoryHead !== objectId(value.repositoryHead, 'Continuity repository HEAD') ||
    mission.binding.worktreeFingerprint !== digest(
      value.worktreeFingerprint,
      'Continuity worktree fingerprint'
    ) ||
    mission.events.length !== value.checkpointEventCount ||
    mission.events.at(-1).eventHash !== digest(value.latestEventHash, 'Continuity event hash')
  ) {
    throw new Error('Durable mission continuity record does not match its physical binding.');
  }
  const recordedAt = timestamp(value.recordedAt, 'Continuity record time');
  if (Date.parse(recordedAt) < Date.parse(mission.updatedAt)) {
    throw new Error('Continuity record predates its mission evidence.');
  }
  const { recordFingerprint, ...body } = value;
  if (fingerprint(body) !== digest(recordFingerprint, 'Continuity record fingerprint')) {
    throw new Error('Durable mission continuity record has lost integrity.');
  }
  return deepFreeze({
    ...body,
    mission,
    repairLoop,
    recordFingerprint
  });
}

function resumeNaturalMissionContinuity({ checkpoint, repositoryPath, resumedAt } = {}) {
  const record = validateNaturalMissionContinuityCheckpoint(checkpoint);
  const canonicalRepository = canonicalizeAuthorizedRoot(repositoryPath);
  if (canonicalRepository !== record.repositoryPath) {
    throw new Error('Durable mission continuity belongs to another repository or workspace.');
  }
  const revalidation = revalidateDeterministicWorkspaceSession(record.mission.session);
  let mission = record.mission;
  let classification;
  if (mission.state === 'CANCELLED') {
    classification = 'HISTORICAL_CANCELLED';
  } else if (mission.state === 'GREEN' && revalidation.decision === 'VALID') {
    classification = 'HISTORICAL_GREEN';
  } else {
    mission = resumeNaturalAgenticMission({
      mission,
      revalidation,
      resumedAt,
      restartKind: 'DURABLE_PROCESS_RESTART'
    });
    classification = revalidation.decision === 'VALID'
      ? 'RESUMED'
      : 'STATE_INVALIDATED';
  }
  const referenceContext = createNaturalEngineeringReferenceContext({
    mission,
    createdAt: timestamp(resumedAt, 'Continuity resume time')
  });
  const continuation = classification === 'RESUMED'
    ? selectNaturalAgenticMissionContinuation({ mission, revalidation })
    : null;
  const repairLoop = record.repairLoop === null
    ? null
    : bindNaturalGovernedRepairLoopAfterRestart(record.repairLoop, {
        mission,
        physicalStateValid: revalidation.decision === 'VALID'
      });
  return deepFreeze({
    schema: 'sdo.natural_mission_continuity_resume.v1',
    classification,
    mission,
    repairLoop,
    revalidation,
    referenceContext,
    historicalEventCount: record.checkpointEventCount,
    pendingOperation: record.pendingOperation,
    pendingApproval: record.pendingApproval,
    continuationEligible: continuation?.classification === 'ELIGIBLE',
    authorityRevalidated: false,
    providerMemoryUsed: false,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

module.exports = Object.freeze({
  CONTINUITY_SCHEMA,
  CONTINUITY_SCHEMA_VERSION,
  createNaturalMissionContinuityCheckpoint,
  validateNaturalMissionContinuityCheckpoint,
  resumeNaturalMissionContinuity
});
