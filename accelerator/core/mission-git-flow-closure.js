'use strict';

const crypto = require('node:crypto');
const {
  validateNaturalAgenticMission
} = require('./natural-agentic-mission');
const {
  validateGitFlowAuthorization,
  createGitFlowReport
} = require('./git-flow-contract');

const SCHEMA = 'sdo.mission_git_flow_closure.v1';
const STATES = Object.freeze(['ELIGIBLE', 'LOCAL_GREEN', 'REMOTE_GREEN', 'BLOCKED']);
const RESULT_PHASES = Object.freeze([
  'PREPARED', 'COMMIT', 'LOCAL_GREEN', 'PUSH', 'PUBLISHED', 'RECONCILE'
]);
const FIELDS = Object.freeze([
  'schema', 'closureId', 'missionId', 'missionFingerprint',
  'authorizationFingerprint', 'state', 'commitSha', 'localReport',
  'remoteReport', 'lastReport', 'snapshot', 'attempts', 'reason',
  'localGreen', 'remoteGreen', 'missionGreenIsGitAuthority',
  'authorityCopiedFromMission', 'operationalAuthority', 'mutationAuthority',
  'publicationAuthority', 'closureFingerprint'
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
  );
}

function fingerprint(label, value) {
  return crypto
    .createHash('sha256')
    .update(`${label}\0${JSON.stringify(canonicalize(value))}`, 'utf8')
    .digest('hex');
}

function exactFields(value, fields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join('\0') !== [...fields].sort().join('\0')) {
    throw new Error(`${label} is malformed.`);
  }
}

function digest(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} is malformed.`);
  }
  return value;
}

function objectId(value, label, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value)) {
    throw new Error(`${label} is malformed.`);
  }
  return value;
}

function closureFingerprint(value) {
  const { closureFingerprint: ignored, ...body } = value;
  return fingerprint(SCHEMA, body);
}

function withFingerprint(body) {
  return deepFreeze({ ...body, closureFingerprint: fingerprint(SCHEMA, body) });
}

function validateEligibility(missionInput, authorizationInput) {
  const mission = validateNaturalAgenticMission(missionInput);
  const authorization = validateGitFlowAuthorization(authorizationInput);
  const canonical = mission.tests.canonical;
  if (mission.state !== 'GREEN' || !canonical || canonical.canonical !== true ||
      canonical.classification !== 'PASSED' || canonical.failed !== 0) {
    throw new Error('Only a canonically qualified GREEN mission is eligible for Git Flow closure.');
  }
  if (mission.plan.some((step) => ['PENDING', 'ACTIVE'].includes(step.status))) {
    throw new Error('Mission Git Flow closure requires a completed live plan.');
  }
  if (authorization.objective !== mission.objective ||
      authorization.workspace !== mission.binding.repositoryPath ||
      authorization.expectedHead !== mission.binding.repositoryHead) {
    throw new Error('Git Flow authorization is not bound to the exact mission objective and repository baseline.');
  }
  const changedTargets = [...new Set(mission.changes.map((change) => change.target))].sort();
  if (changedTargets.length === 0 ||
      changedTargets.length !== authorization.authorizedFiles.length ||
      changedTargets.some((target, index) => target !== authorization.authorizedFiles[index])) {
    throw new Error('Git Flow allowlist must exactly match the governed mission changes.');
  }
  if (mission.operationalAuthority !== false || mission.mutationAuthority !== false ||
      mission.authority.publicationAuthority !== false) {
    throw new Error('Mission state cannot carry or mint Git publication authority.');
  }
  return { mission, authorization };
}

function createMissionGitFlowClosure({ mission, authorization } = {}) {
  const bound = validateEligibility(mission, authorization);
  const body = {
    schema: SCHEMA,
    closureId: fingerprint('sdo.mission_git_flow_closure_id.v1', {
      missionFingerprint: bound.mission.missionFingerprint,
      authorizationFingerprint: bound.authorization.authorizationFingerprint
    }),
    missionId: bound.mission.missionId,
    missionFingerprint: bound.mission.missionFingerprint,
    authorizationFingerprint: bound.authorization.authorizationFingerprint,
    state: 'ELIGIBLE',
    commitSha: null,
    localReport: null,
    remoteReport: null,
    lastReport: null,
    snapshot: null,
    attempts: { reconcile: 0, commit: 0, push: 0 },
    reason: 'Mission is GREEN locally; Git authority remains separately required.',
    localGreen: false,
    remoteGreen: false,
    missionGreenIsGitAuthority: false,
    authorityCopiedFromMission: false,
    operationalAuthority: false,
    mutationAuthority: false,
    publicationAuthority: false
  };
  return withFingerprint(body);
}

function validateMissionGitFlowClosure(value) {
  exactFields(value, FIELDS, 'Mission Git Flow closure');
  if (!Object.isFrozen(value) || value.schema !== SCHEMA || !STATES.includes(value.state) ||
      digest(value.closureId, 'Mission Git Flow closure id') !== value.closureId ||
      digest(value.missionFingerprint, 'Mission fingerprint') !== value.missionFingerprint ||
      digest(value.authorizationFingerprint, 'Git authorization fingerprint') !== value.authorizationFingerprint ||
      objectId(value.commitSha, 'Closure commit SHA', true) !== value.commitSha ||
      value.localGreen !== ['LOCAL_GREEN', 'REMOTE_GREEN'].includes(value.state) ||
      value.remoteGreen !== (value.state === 'REMOTE_GREEN') ||
      value.missionGreenIsGitAuthority !== false || value.authorityCopiedFromMission !== false ||
      value.operationalAuthority !== false || value.mutationAuthority !== false ||
      value.publicationAuthority !== false ||
      !value.attempts || !Object.isFrozen(value.attempts) ||
      !['reconcile', 'commit', 'push'].every((key) =>
        Number.isSafeInteger(value.attempts[key]) && value.attempts[key] >= 0) ||
      digest(value.closureFingerprint, 'Closure fingerprint') !== closureFingerprint(value)) {
    throw new Error('Mission Git Flow closure integrity is invalid.');
  }
  return value;
}

function validateContext(closureInput, missionInput, authorizationInput) {
  const closure = validateMissionGitFlowClosure(closureInput);
  const bound = validateEligibility(missionInput, authorizationInput);
  if (closure.missionId !== bound.mission.missionId ||
      closure.missionFingerprint !== bound.mission.missionFingerprint ||
      closure.authorizationFingerprint !== bound.authorization.authorizationFingerprint) {
    throw new Error('Mission Git Flow closure context changed after preparation.');
  }
  return { closure, ...bound };
}

function validateRunnerReport(report, authorization) {
  if (!report || !Object.isFrozen(report) || report.schema !== 'sdo.git_flow_report.v1' ||
      report.authorizationFingerprint !== authorization.authorizationFingerprint) {
    throw new Error('Immutable bound Git Flow report is required.');
  }
  const recreated = createGitFlowReport({
    authorization,
    state: report.state,
    phase: report.phase,
    commitSha: report.commitSha,
    observedRemoteSha: report.remote.observedSha,
    validations: report.validations,
    warnings: report.warnings,
    recovery: report.recovery
  });
  if (recreated.reportFingerprint !== report.reportFingerprint) {
    throw new Error('Git Flow report fingerprint mismatch.');
  }
  return report;
}

function advanceMissionGitFlowClosure({ closure: closureInput, mission, authorization,
  operation, result, snapshot = null } = {}) {
  const bound = validateContext(closureInput, mission, authorization);
  const action = typeof operation === 'string' ? operation.toLowerCase() : '';
  if (!['reconcile', 'commit', 'push'].includes(action)) {
    throw new Error('Mission Git Flow closure operation is unsupported.');
  }
  if (!result || !Object.isFrozen(result) || !['GREEN', 'BLOCKED'].includes(result.state) ||
      !RESULT_PHASES.includes(result.phase)) {
    throw new Error('Immutable governed Git Flow result is required.');
  }
  const report = validateRunnerReport(result.report, bound.authorization);
  if (snapshot !== null && (!Object.isFrozen(snapshot) ||
      snapshot.schema !== 'sdo.bh_sdp_snapshot.v2.3')) {
    throw new Error('Immutable BH-SDP v2.3 snapshot is required.');
  }

  let state = bound.closure.state;
  let commitSha = bound.closure.commitSha;
  let localReport = bound.closure.localReport;
  let remoteReport = bound.closure.remoteReport;
  let reason = result.reason;
  if (result.state === 'BLOCKED') {
    state = 'BLOCKED';
  } else if (result.phase === 'PUBLISHED') {
    state = 'REMOTE_GREEN';
    commitSha = objectId(result.commitSha, 'Published commit SHA');
    remoteReport = report;
    localReport = localReport || report;
  } else if (['COMMIT', 'LOCAL_GREEN'].includes(result.phase)) {
    state = 'LOCAL_GREEN';
    commitSha = objectId(result.commitSha, 'Local commit SHA');
    localReport = report;
  } else if (result.phase === 'PREPARED') {
    state = bound.closure.state === 'BLOCKED' ? 'BLOCKED' : 'ELIGIBLE';
    commitSha = null;
  }

  const body = {
    ...bound.closure,
    state,
    commitSha,
    localReport,
    remoteReport,
    lastReport: report,
    snapshot,
    attempts: {
      ...bound.closure.attempts,
      [action]: bound.closure.attempts[action] + 1
    },
    reason,
    localGreen: ['LOCAL_GREEN', 'REMOTE_GREEN'].includes(state),
    remoteGreen: state === 'REMOTE_GREEN'
  };
  delete body.closureFingerprint;
  return withFingerprint(body);
}

module.exports = deepFreeze({
  SCHEMA,
  STATES,
  createMissionGitFlowClosure,
  validateMissionGitFlowClosure,
  advanceMissionGitFlowClosure
});
