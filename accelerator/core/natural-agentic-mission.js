'use strict';

const crypto = require('node:crypto');

const {
  SESSION_SCHEMA,
  REVALIDATION_SCHEMA
} = require('../adapters/deterministic-workspace-session-adapter');

const MISSION_SCHEMA = 'sdo.natural_agentic_mission.v1';
const EVENT_SCHEMA = 'sdo.natural_agentic_mission_event.v1';
const PROJECTION_SCHEMA = 'sdo.natural_agentic_mission_projection.v1';
const CONTINUATION_SCHEMA = 'sdo.natural_agentic_mission_continuation.v1';

const MISSION_STATES = Object.freeze([
  'PLANNING',
  'AUDITING',
  'IMPLEMENTING',
  'TESTING',
  'REPAIRING',
  'QUALIFYING',
  'CHECKPOINTING',
  'GREEN',
  'BLOCKED',
  'CANCELLED'
]);

const TERMINAL_STATES = new Set(['GREEN', 'CANCELLED']);

const PLAN_STATUSES = Object.freeze([
  'PENDING',
  'ACTIVE',
  'COMPLETED',
  'BLOCKED'
]);

const PLAN_RESULT_CLASSES = Object.freeze([
  'SUCCESS',
  'FAILURE',
  'DENIED',
  'AUTHORITY_REQUIRED',
  'STALE_STATE',
  'CAS_MISMATCH',
  'UNSUPPORTED',
  'ENVIRONMENT_ERROR',
  'INCOMPLETE_EVIDENCE',
  'PASSED',
  'FAILED'
]);

const CONTINUATION_CLASSES = Object.freeze([
  'ELIGIBLE',
  'NO_NEXT_STEP',
  'AMBIGUOUS_NEXT_STEP',
  'STALE_STATE',
  'AUTHORITY_REQUIRED'
]);

const PROCESS_LOCAL_CONTINUATION_OPERATIONS = Object.freeze([
  'workspace.status',
  'workspace.diff',
  'evidence.inspect'
]);

const PLAN_INPUT_FIELDS = new Set([
  'stepId',
  'summary',
  'status',
  'operation',
  'sourceOperation',
  'resultClass',
  'evidenceRef',
  'blocker'
]);

const PLAN_TRANSITIONS = Object.freeze({
  PENDING: Object.freeze(['PENDING', 'ACTIVE', 'BLOCKED']),
  ACTIVE: Object.freeze(['ACTIVE', 'COMPLETED', 'BLOCKED']),
  COMPLETED: Object.freeze(['COMPLETED']),
  BLOCKED: Object.freeze(['BLOCKED'])
});

const EVENT_TYPES = Object.freeze({
  MISSION_STARTED: 'MISSION_STARTED',
  PLAN_UPDATED: 'PLAN_UPDATED',
  WORKSPACE_VALIDATED: 'WORKSPACE_VALIDATED',
  EVIDENCE_DISCOVERED: 'EVIDENCE_DISCOVERED',
  AUTHORITY_REQUIRED: 'AUTHORITY_REQUIRED',
  AUTHORITY_GRANTED: 'AUTHORITY_GRANTED',
  AUTHORITY_DENIED: 'AUTHORITY_DENIED',
  OPERATION_STARTED: 'OPERATION_STARTED',
  OPERATION_COMPLETED: 'OPERATION_COMPLETED',
  OPERATION_DENIED: 'OPERATION_DENIED',
  TEST_STARTED: 'TEST_STARTED',
  TEST_PASSED: 'TEST_PASSED',
  TEST_FAILED: 'TEST_FAILED',
  REPAIR_STARTED: 'REPAIR_STARTED',
  QUALIFICATION_STARTED: 'QUALIFICATION_STARTED',
  CHECKPOINT_CREATED: 'CHECKPOINT_CREATED',
  STATE_INVALIDATED: 'STATE_INVALIDATED',
  MISSION_BLOCKED: 'MISSION_BLOCKED',
  MISSION_GREEN: 'MISSION_GREEN',
  MISSION_CANCELLED: 'MISSION_CANCELLED'
});

const EVENT_FIELDS = Object.freeze([
  'schema',
  'missionId',
  'sequence',
  'type',
  'state',
  'summary',
  'at',
  'evidenceRef',
  'resultClass',
  'previousEventHash',
  'contentRecorded',
  'operationalAuthority',
  'mutationAuthority',
  'eventHash'
]);

const DEFAULT_AVAILABLE_CAPABILITIES = Object.freeze([
  'workspace.status',
  'workspace.search',
  'workspace.read',
  'workspace.diff',
  'evidence.inspect',
  'evidence.microread',
  'tests.run',
  'tests.runCanonical',
  'mutation.propose',
  'mutation.applyConditional',
  'git.status',
  'git.diff',
  'git.stage',
  'git.commit',
  'journal.inspect',
  'mission.status',
  'mission.plan',
  'mission.changes',
  'mission.tests',
  'mission.authority',
  'mission.journal',
  'mission.resume',
  'authority.inspect',
  'authority.request'
]);

const DEFAULT_ALLOWED_CAPABILITIES = Object.freeze([
  'workspace.status',
  'workspace.search',
  'workspace.read',
  'workspace.diff',
  'evidence.inspect',
  'evidence.microread',
  'tests.run',
  'mutation.propose',
  'git.status',
  'git.diff',
  'journal.inspect',
  'mission.status',
  'mission.plan',
  'mission.changes',
  'mission.tests',
  'mission.authority',
  'mission.journal',
  'mission.resume',
  'authority.inspect',
  'authority.request'
]);

const DEFAULT_DENIED_CAPABILITIES = Object.freeze([
  'arbitrary.shell',
  'credential.read',
  'network.mutate',
  'git.push',
  'git.tag',
  'git.historyRewrite',
  'release.create',
  'npm.publish'
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

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function fingerprint(label, value) {
  return crypto
    .createHash('sha256')
    .update(`${label}\0${JSON.stringify(canonicalize(value))}`, 'utf8')
    .digest('hex');
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
  rejectSensitiveText(value, label);
  return value;
}

function requireOptionalText(value, label, maximum = 1024) {
  if (value === null || value === undefined) return null;
  return requireText(value, label, maximum);
}

function requireTimestamp(value, label) {
  const timestamp = requireText(value, label, 64);
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== timestamp) {
    throw new Error(`${label} is malformed.`);
  }
  return timestamp;
}

function requireDigest(value, label) {
  const text = requireText(value, label, 64);
  if (!/^[a-f0-9]{64}$/.test(text)) throw new Error(`${label} is malformed.`);
  return text;
}

function requireObjectId(value, label) {
  const text = requireText(value, label, 64);
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(text)) {
    throw new Error(`${label} is malformed.`);
  }
  return text;
}

function rejectSensitiveText(value, label) {
  if (typeof value !== 'string') return;
  if (SECRET_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new Error(`${label} contains sensitive content.`);
  }
}

function normalizeState(value) {
  const state = requireText(value, 'Mission state', 32).toUpperCase();
  if (!MISSION_STATES.includes(state)) throw new Error('Mission state is unsupported.');
  return state;
}

function normalizePlan(plan = []) {
  if (!Array.isArray(plan) || plan.length > 64) {
    throw new Error('Mission plan is malformed.');
  }
  const normalized = plan.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Mission plan item is malformed.');
    }
    const unexpected = Object.keys(item).filter(
      (key) => !PLAN_INPUT_FIELDS.has(key)
    );
    if (unexpected.length > 0) {
      throw new Error(`Mission plan item contains an unexpected field: ${unexpected[0]}.`);
    }
    const summary = requireText(item.summary, 'Mission plan summary', 512);
    const status = requireText(item.status || 'PENDING', 'Mission plan status', 32).toUpperCase();
    if (!PLAN_STATUSES.includes(status)) {
      throw new Error('Mission plan status is unsupported.');
    }
    const stepId = item.stepId
      ? requireText(item.stepId, 'Mission plan step id', 128)
      : `step-${String(index + 1).padStart(2, '0')}`;
    const operation = requireOptionalText(
      item.operation,
      'Mission plan operation',
      128
    );
    const sourceOperation = requireOptionalText(
      item.sourceOperation,
      'Mission plan source operation',
      128
    );
    const resultClass = item.resultClass === undefined || item.resultClass === null
      ? null
      : requireText(item.resultClass, 'Mission plan result class', 64).toUpperCase();
    const evidenceRef = item.evidenceRef === undefined || item.evidenceRef === null
      ? null
      : normalizeEvidenceRef(item.evidenceRef);
    const blocker = requireOptionalText(
      item.blocker,
      'Mission plan blocker',
      1024
    );

    if (resultClass && !PLAN_RESULT_CLASSES.includes(resultClass)) {
      throw new Error('Mission plan result class is unsupported.');
    }
    if (
      status === 'COMPLETED' &&
      resultClass &&
      !['SUCCESS', 'PASSED'].includes(resultClass)
    ) {
      throw new Error('A failed mission plan result cannot be completed.');
    }
    if (
      status === 'BLOCKED' &&
      resultClass &&
      ['SUCCESS', 'PASSED'].includes(resultClass)
    ) {
      throw new Error('A successful mission plan result cannot be blocked.');
    }
    if (blocker && status !== 'BLOCKED') {
      throw new Error('Mission plan blocker requires BLOCKED status.');
    }

    return deepFreeze({
      stepId,
      summary,
      status,
      ...(operation ? { operation } : {}),
      ...(sourceOperation ? { sourceOperation } : {}),
      ...(resultClass ? { resultClass } : {}),
      ...(evidenceRef ? { evidenceRef } : {}),
      ...(blocker ? { blocker } : {})
    });
  });

  if (new Set(normalized.map((item) => item.stepId)).size !== normalized.length) {
    throw new Error('Mission plan step ids must be unique.');
  }
  if (normalized.filter((item) => item.status === 'ACTIVE').length > 1) {
    throw new Error('Mission plan cannot contain multiple active steps.');
  }

  return normalized;
}

function normalizeCapabilities(input, fallback) {
  const value = input === undefined ? fallback : input;
  if (!Array.isArray(value)) throw new Error('Mission capability list is malformed.');
  const normalized = [...new Set(value.map((item) => requireText(item, 'Mission capability', 128)))].sort();
  return deepFreeze(normalized);
}

function normalizeAuthority(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Mission authority projection is malformed.');
  }
  const availableCapabilities = normalizeCapabilities(
    input.availableCapabilities,
    DEFAULT_AVAILABLE_CAPABILITIES
  );
  const allowedCapabilities = normalizeCapabilities(
    input.allowedCapabilities,
    DEFAULT_ALLOWED_CAPABILITIES
  );
  const deniedCapabilities = normalizeCapabilities(
    input.deniedCapabilities,
    DEFAULT_DENIED_CAPABILITIES
  );
  for (const capability of allowedCapabilities) {
    if (!availableCapabilities.includes(capability)) {
      throw new Error('Allowed mission capability is not registered.');
    }
  }
  const grants = Array.isArray(input.grants)
    ? input.grants.map((grant) => normalizeAuthorityGrant(grant))
    : [];
  return deepFreeze({
    availableCapabilities,
    allowedCapabilities,
    deniedCapabilities,
    grants,
    usedAuthorityRefs: normalizeCapabilities(input.usedAuthorityRefs, []),
    staleGrantsInvalidated: input.staleGrantsInvalidated === true,
    providerAuthority: false,
    arbitraryShell: false,
    directFilesystem: false,
    directGitMutation: false,
    networkMutation: false,
    releaseAuthority: false,
    publicationAuthority: false,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function normalizeAuthorityGrant(grant) {
  if (!grant || typeof grant !== 'object' || Array.isArray(grant)) {
    throw new Error('Mission authority grant is malformed.');
  }
  const lifetime = requireText(grant.lifetime || 'ONE_SHOT', 'Authority grant lifetime', 32).toUpperCase();
  if (!['ONE_SHOT', 'MISSION_SCOPED'].includes(lifetime)) {
    throw new Error('Authority grant lifetime is unsupported.');
  }
  return deepFreeze({
    authorityRef: requireText(grant.authorityRef, 'Authority reference', 256),
    capability: requireText(grant.capability, 'Authority grant capability', 128),
    operation: requireOptionalText(grant.operation || grant.capability, 'Authority grant operation', 128),
    scope: grant.scope && typeof grant.scope === 'object' && !Array.isArray(grant.scope)
      ? deepFreeze(canonicalize(grant.scope))
      : null,
    issuedAt: requireTimestamp(grant.issuedAt, 'Authority grant issuedAt'),
    expiresAt: requireTimestamp(grant.expiresAt, 'Authority grant expiresAt'),
    lifetime,
    authorityNotGranted: normalizeCapabilities(
      grant.authorityNotGranted,
      DEFAULT_DENIED_CAPABILITIES
    ),
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function normalizeProvider(input = {}) {
  const provider = input || {};
  return deepFreeze({
    providerId: requireText(provider.providerId || 'deterministic-local', 'Provider id', 128),
    providerKind: requireText(provider.providerKind || 'LOCAL_DETERMINISTIC', 'Provider kind', 64),
    filesystemAuthority: false,
    mutationAuthority: false,
    gitAuthority: false,
    networkAuthority: false,
    releaseAuthority: false,
    publicationAuthority: false
  });
}

function validateSession(session) {
  if (
    !session ||
    session.schema !== SESSION_SCHEMA ||
    !Object.isFrozen(session) ||
    !session.physical ||
    typeof session.physical.root !== 'string'
  ) {
    throw new Error('Immutable deterministic workspace session is required.');
  }
  return session;
}

function bindingFromSession(session) {
  return deepFreeze({
    repositoryPath: requireText(session.physical.root, 'Mission repository path', 4096),
    sessionFingerprint: requireDigest(session.sessionFingerprint, 'Mission session fingerprint'),
    physicalWorkspaceIdentity: requireDigest(
      session.physicalWorkspaceIdentity,
      'Mission physical workspace identity'
    ),
    repositoryHead: requireObjectId(session.repositoryHead, 'Mission repository head'),
    worktreeFingerprint: requireDigest(session.worktreeFingerprint, 'Mission worktree fingerprint')
  });
}

function eventBody(input) {
  const type = requireText(input.type, 'Mission event type', 64).toUpperCase();
  if (!Object.values(EVENT_TYPES).includes(type)) {
    throw new Error('Mission event type is unsupported.');
  }
  const summary = requireText(input.summary, 'Mission event summary', 512);
  const evidenceRef = input.evidenceRef === undefined || input.evidenceRef === null
    ? null
    : normalizeEvidenceRef(input.evidenceRef);
  return {
    schema: EVENT_SCHEMA,
    missionId: requireText(input.missionId, 'Mission id', 256),
    sequence: input.sequence,
    type,
    state: normalizeState(input.state),
    summary,
    at: requireTimestamp(input.at, 'Mission event timestamp'),
    evidenceRef,
    resultClass: requireOptionalText(input.resultClass || null, 'Mission event result class', 64),
    previousEventHash: requireDigest(input.previousEventHash, 'Previous mission event hash'),
    contentRecorded: false,
    operationalAuthority: false,
    mutationAuthority: false
  };
}

function normalizeEvidenceRef(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Mission evidence reference is malformed.');
  }
  return deepFreeze({
    kind: requireText(input.kind, 'Mission evidence kind', 128),
    target: requireOptionalText(input.target || null, 'Mission evidence target', 1024),
    fingerprint: requireDigest(input.fingerprint, 'Mission evidence fingerprint')
  });
}

function createMissionEvent(input) {
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1) {
    throw new Error('Mission event sequence is malformed.');
  }
  const body = eventBody(input);
  return deepFreeze({
    ...body,
    eventHash: fingerprint(EVENT_SCHEMA, body)
  });
}

function validateNaturalAgenticMissionEvent(event) {
  if (
    !event ||
    typeof event !== 'object' ||
    Array.isArray(event) ||
    !Object.isFrozen(event) ||
    Object.keys(event).length !== EVENT_FIELDS.length ||
    EVENT_FIELDS.some((field) => !Object.prototype.hasOwnProperty.call(event, field))
  ) {
    throw new Error('Immutable canonical NATURAL mission event is required.');
  }
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) {
    throw new Error('Mission event sequence is malformed.');
  }
  if (
    event.contentRecorded !== false ||
    event.operationalAuthority !== false ||
    event.mutationAuthority !== false
  ) {
    throw new Error('Mission event cannot carry content or authority.');
  }

  const {
    eventHash,
    ...recordedBody
  } = event;
  const normalizedBody = eventBody(event);
  if (
    JSON.stringify(canonicalize(recordedBody)) !==
      JSON.stringify(canonicalize(normalizedBody)) ||
    requireDigest(eventHash, 'Mission event hash') !==
      fingerprint(EVENT_SCHEMA, normalizedBody)
  ) {
    throw new Error('NATURAL mission event has lost integrity.');
  }
  return event;
}

function withMissionFingerprint(base) {
  const frozen = deepFreeze(base);
  return deepFreeze({
    ...frozen,
    missionFingerprint: fingerprint(MISSION_SCHEMA, frozen)
  });
}

function validateNaturalAgenticMission(mission) {
  if (!mission || mission.schema !== MISSION_SCHEMA || !Object.isFrozen(mission)) {
    throw new Error('Immutable NATURAL agentic mission is required.');
  }
  const { missionFingerprint, ...body } = mission;
  if (
    !/^[a-f0-9]{64}$/.test(missionFingerprint || '') ||
    fingerprint(MISSION_SCHEMA, body) !== missionFingerprint ||
    !MISSION_STATES.includes(mission.state)
  ) {
    throw new Error('NATURAL agentic mission has lost integrity.');
  }
  return mission;
}

function createNaturalAgenticMission({
  missionId,
  objective,
  session,
  createdAt,
  plan = [],
  authority = {},
  provider = {}
} = {}) {
  const workspaceSession = validateSession(session);
  const id = requireText(
    missionId ||
      `natural-mission-${fingerprint('sdo.natural_agentic_mission_id.v1', {
        objective,
        sessionFingerprint: workspaceSession.sessionFingerprint,
        createdAt
      })}`,
    'Mission id',
    256
  );
  const at = requireTimestamp(createdAt, 'Mission creation timestamp');
  const normalizedPlan = normalizePlan(plan);
  const startEvent = createMissionEvent({
    missionId: id,
    sequence: 1,
    type: EVENT_TYPES.MISSION_STARTED,
    state: 'PLANNING',
    summary: 'Governed NATURAL mission started.',
    at,
    previousEventHash: '0'.repeat(64)
  });
  const events = normalizedPlan.length === 0
    ? [startEvent]
    : [
        startEvent,
        createMissionEvent({
          missionId: id,
          sequence: 2,
          type: EVENT_TYPES.PLAN_UPDATED,
          state: 'PLANNING',
          summary: 'Initial governed live plan recorded.',
          at,
          previousEventHash: startEvent.eventHash
        })
      ];
  const base = {
    schema: MISSION_SCHEMA,
    missionId: id,
    objective: requireText(objective, 'Mission objective', 4096),
    state: 'PLANNING',
    stateSequence: 1,
    createdAt: at,
    updatedAt: at,
    binding: bindingFromSession(workspaceSession),
    session: workspaceSession,
    plan: deepFreeze(normalizedPlan),
    tests: deepFreeze({ targeted: [], canonical: null, lastResult: null }),
    changes: deepFreeze([]),
    authority: normalizeAuthority(authority),
    journal: deepFreeze({
      durableEvidenceRefs: [],
      eventCount: events.length,
      latestEventHash: events.at(-1).eventHash,
      contentTelemetry: false
    }),
    events: deepFreeze(events),
    resumeCount: 0,
    provider: normalizeProvider(provider),
    persistentMission: true,
    livePlan: true,
    providerDirectFilesystem: false,
    providerDirectShell: false,
    providerDirectGit: false,
    providerDirectNetwork: false,
    operationalAuthority: false,
    mutationAuthority: false
  };
  return withMissionFingerprint(base);
}

function appendEvent(mission, input) {
  const current = validateNaturalAgenticMission(mission);
  const nextState = normalizeState(input.state || current.state);
  if (TERMINAL_STATES.has(current.state) && nextState !== current.state) {
    throw new Error('Terminal mission state cannot transition.');
  }
  const at = requireTimestamp(input.at, 'Mission event timestamp');
  if (Date.parse(at) < Date.parse(current.updatedAt)) {
    throw new Error('Mission event time cannot move backwards.');
  }
  const event = createMissionEvent({
    ...input,
    missionId: current.missionId,
    state: nextState,
    sequence: current.events.length + 1,
    previousEventHash: current.events.at(-1).eventHash
  });
  const next = {
    ...current,
    state: nextState,
    stateSequence: current.stateSequence + (nextState === current.state ? 0 : 1),
    updatedAt: at,
    events: [...current.events, event],
    journal: {
      ...current.journal,
      eventCount: current.events.length + 1,
      latestEventHash: event.eventHash
    }
  };
  delete next.missionFingerprint;
  return withMissionFingerprint(next);
}

function transitionNaturalAgenticMission(mission, input = {}) {
  return appendEvent(mission, input);
}

function updateNaturalAgenticMissionPlan(mission, { plan, at, summary = 'Governed live plan updated.' } = {}) {
  const current = validateNaturalAgenticMission(mission);
  const next = {
    ...current,
    plan: normalizePlan(plan)
  };
  delete next.missionFingerprint;
  return appendEvent(withMissionFingerprint(next), {
    type: EVENT_TYPES.PLAN_UPDATED,
    state: current.state,
    summary,
    at
  });
}

function updateNaturalAgenticMissionPlanStep(
  mission,
  {
    stepId,
    status,
    operation,
    sourceOperation,
    resultClass,
    evidenceRef,
    blocker,
    at,
    eventSummary = 'Governed live plan step updated.'
  } = {}
) {
  const current = validateNaturalAgenticMission(mission);
  const id = requireText(stepId, 'Mission plan step id', 128);
  const existing = current.plan.find((step) => step.stepId === id);

  if (!existing) {
    throw new Error('Mission plan step is unavailable.');
  }

  const nextStatus = requireText(
    status || existing.status,
    'Mission plan status',
    32
  ).toUpperCase();

  if (
    !PLAN_STATUSES.includes(nextStatus) ||
    !PLAN_TRANSITIONS[existing.status].includes(nextStatus)
  ) {
    throw new Error('Mission plan step transition is unsupported.');
  }

  const replacement = {
    ...existing,
    status: nextStatus
  };
  const optionalFields = {
    operation,
    sourceOperation,
    resultClass,
    evidenceRef,
    blocker
  };

  for (const [key, value] of Object.entries(optionalFields)) {
    if (value === undefined) continue;
    if (value === null) {
      delete replacement[key];
    } else {
      replacement[key] = value;
    }
  }

  return updateNaturalAgenticMissionPlan(current, {
    plan: current.plan.map((step) =>
      step.stepId === id
        ? replacement
        : step
    ),
    at,
    summary: requireText(eventSummary, 'Mission plan event summary', 512)
  });
}

function validateStructuredGatewayPlanResult(result) {
  if (
    !result ||
    result.schema !== 'sdo.integrated_governed_agent_gateway_result.v1' ||
    !Object.isFrozen(result) ||
    result.operationalAuthority !== false ||
    result.mutationAuthority !== false
  ) {
    throw new Error('Immutable zero-authority governed result is required.');
  }

  const operation = requireText(
    result.operation,
    'Governed result operation',
    128
  );
  const classification = requireText(
    result.classification,
    'Governed result classification',
    64
  ).toUpperCase();

  if (!PLAN_RESULT_CLASSES.includes(classification)) {
    throw new Error('Governed result classification is unsupported.');
  }

  requireText(result.reason, 'Governed result reason', 1024);
  requireDigest(result.evidenceDigest, 'Governed result evidence digest');

  const {
    resultFingerprint,
    ...body
  } = result;

  if (
    requireDigest(resultFingerprint, 'Governed result fingerprint') !==
      fingerprint('sdo.integrated_governed_agent_gateway_result.v1', body)
  ) {
    throw new Error('Governed result has lost integrity.');
  }

  return deepFreeze({
    missionId: requireText(result.missionId, 'Governed result mission id', 256),
    operation,
    classification,
    reason: result.reason,
    evidenceDigest: result.evidenceDigest
  });
}

function recordNaturalAgenticMissionPlanResult(
  mission,
  {
    stepId,
    result,
    at
  } = {}
) {
  const current = validateNaturalAgenticMission(mission);
  const id = requireText(stepId, 'Mission plan step id', 128);
  const step = current.plan.find((item) => item.stepId === id);
  const governed = validateStructuredGatewayPlanResult(result);

  if (
    !step ||
    step.status !== 'ACTIVE' ||
    step.operation !== governed.operation ||
    governed.missionId !== current.missionId
  ) {
    throw new Error('Governed result does not match the active mission plan step.');
  }

  const succeeded = governed.classification === 'SUCCESS';
  let updated = updateNaturalAgenticMissionPlanStep(current, {
    stepId: id,
    status: succeeded ? 'COMPLETED' : 'BLOCKED',
    resultClass: governed.classification,
    evidenceRef: {
      kind: governed.operation,
      fingerprint: governed.evidenceDigest
    },
    blocker: succeeded ? null : governed.reason,
    at,
    eventSummary: succeeded
      ? 'Governed operation completed the active live-plan step.'
      : 'Governed operation blocked the active live-plan step.'
  });

  if (!succeeded && updated.state !== 'BLOCKED') {
    updated = blockNaturalAgenticMission(updated, {
      reason: governed.reason,
      at
    });
  }

  return updated;
}

function recordNaturalAgenticMissionChange(
  mission,
  {
    target,
    summary,
    beforeSha256 = null,
    afterSha256 = null,
    authorityRef = null,
    at
  } = {}
) {
  const current = validateNaturalAgenticMission(mission);
  const change = deepFreeze({
    target: requireText(target, 'Mission change target', 1024),
    summary: requireText(summary, 'Mission change summary', 512),
    beforeSha256: beforeSha256 === null ? null : requireDigest(beforeSha256, 'Change before SHA-256'),
    afterSha256: afterSha256 === null ? null : requireDigest(afterSha256, 'Change after SHA-256')
  });
  let nextAuthority = current.authority;
  if (authorityRef !== null) {
    const ref = requireText(authorityRef, 'Authority reference', 256);
    const grant = current.authority.grants.find(
      (item) => item.authorityRef === ref
    );
    if (
      !grant ||
      current.authority.usedAuthorityRefs.includes(ref)
    ) {
      throw new Error('Mission authority grant is unavailable or already consumed.');
    }
    nextAuthority = normalizeAuthority({
      ...current.authority,
      usedAuthorityRefs: [
        ...current.authority.usedAuthorityRefs,
        ref
      ]
    });
  }
  const next = {
    ...current,
    changes: [...current.changes, change],
    authority: nextAuthority
  };
  delete next.missionFingerprint;
  return appendEvent(withMissionFingerprint(next), {
    type: EVENT_TYPES.OPERATION_COMPLETED,
    state: 'IMPLEMENTING',
    summary: 'Governed workspace change recorded.',
    at,
    evidenceRef: {
      kind: 'WORKSPACE_CHANGE',
      target: change.target,
      fingerprint: fingerprint('sdo.natural_agentic_mission_change.v1', change)
    }
  });
}

function recordNaturalAgenticMissionAuthorityGrant(
  mission,
  { grant, at } = {}
) {
  const current = validateNaturalAgenticMission(mission);
  const normalizedGrant = normalizeAuthorityGrant(grant);
  if (
    current.authority.grants.some(
      (item) => item.authorityRef === normalizedGrant.authorityRef
    ) ||
    current.authority.usedAuthorityRefs.includes(
      normalizedGrant.authorityRef
    ) ||
    Date.parse(normalizedGrant.issuedAt) > Date.parse(at) ||
    Date.parse(normalizedGrant.expiresAt) <= Date.parse(at)
  ) {
    throw new Error('Mission authority grant is duplicated, stale or not yet valid.');
  }
  const next = {
    ...current,
    authority: normalizeAuthority({
      ...current.authority,
      grants: [
        ...current.authority.grants,
        normalizedGrant
      ]
    })
  };
  delete next.missionFingerprint;
  return appendEvent(withMissionFingerprint(next), {
    type: EVENT_TYPES.AUTHORITY_GRANTED,
    state: current.state,
    summary: 'Exact bounded human authority was recorded for one governed operation.',
    at,
    evidenceRef: {
      kind: 'AUTHORITY_GRANT',
      fingerprint: fingerprint(
        'sdo.natural_agentic_mission_authority_grant.v1',
        normalizedGrant
      )
    }
  });
}

function normalizeTestEvidence(input = {}) {
  const classification = requireText(input.classification, 'Test classification', 32).toUpperCase();
  if (!['PASSED', 'FAILED'].includes(classification)) {
    throw new Error('Test classification is unsupported.');
  }
  const testsDiscovered = Number.isSafeInteger(input.testsDiscovered)
    ? input.testsDiscovered
    : null;
  const passed = Number.isSafeInteger(input.passed) ? input.passed : null;
  const failed = Number.isSafeInteger(input.failed) ? input.failed : null;
  const skipped = Number.isSafeInteger(input.skipped) ? input.skipped : null;
  return deepFreeze({
    selector: requireText(input.selector || 'UNKNOWN', 'Test selector', 128),
    target: requireOptionalText(input.target || null, 'Test target', 1024),
    classification,
    testsDiscovered,
    passed,
    failed,
    skipped,
    canonical: input.canonical === true,
    evidenceDigest: requireDigest(input.evidenceDigest, 'Test evidence digest')
  });
}

function recordNaturalAgenticMissionTestResult(mission, { testEvidence, at, state = 'TESTING' } = {}) {
  const current = validateNaturalAgenticMission(mission);
  const evidence = normalizeTestEvidence(testEvidence);
  const nextTests = evidence.canonical
    ? { ...current.tests, canonical: evidence, lastResult: evidence }
    : { ...current.tests, targeted: [...current.tests.targeted, evidence], lastResult: evidence };
  const next = {
    ...current,
    tests: deepFreeze(nextTests)
  };
  delete next.missionFingerprint;
  return appendEvent(withMissionFingerprint(next), {
    type: evidence.classification === 'PASSED'
      ? EVENT_TYPES.TEST_PASSED
      : EVENT_TYPES.TEST_FAILED,
    state,
    summary: evidence.classification === 'PASSED'
      ? 'Governed test evidence passed.'
      : 'Governed test evidence failed.',
    at,
    resultClass: evidence.classification,
    evidenceRef: {
      kind: evidence.canonical ? 'CANONICAL_TEST_RESULT' : 'TARGETED_TEST_RESULT',
      target: evidence.target,
      fingerprint: evidence.evidenceDigest
    }
  });
}

function qualifyNaturalAgenticMissionGreen(mission, { canonicalEvidence, at } = {}) {
  const evidence = normalizeTestEvidence(canonicalEvidence);
  if (
    evidence.canonical !== true ||
    evidence.classification !== 'PASSED' ||
    evidence.failed !== 0
  ) {
    throw new Error('GREEN requires passing canonical qualification evidence.');
  }
  const withTests = recordNaturalAgenticMissionTestResult(
    mission,
    { testEvidence: evidence, at, state: 'QUALIFYING' }
  );
  return completeNaturalAgenticMissionGreen(withTests, {
    at,
    requireCompletedPlan: false
  });
}

function completeNaturalAgenticMissionGreen(
  mission,
  { at, requireCompletedPlan = true } = {}
) {
  const current = validateNaturalAgenticMission(mission);
  const canonical = current.tests.canonical;
  if (
    !canonical ||
    canonical.canonical !== true ||
    canonical.classification !== 'PASSED' ||
    canonical.failed !== 0 ||
    (requireCompletedPlan && current.plan.some(
      (step) => ['PENDING', 'ACTIVE'].includes(step.status)
    ))
  ) {
    throw new Error('GREEN requires completed plan and passing canonical qualification evidence.');
  }
  return appendEvent(current, {
    type: EVENT_TYPES.MISSION_GREEN,
    state: 'GREEN',
    summary: 'Canonical qualification evidence is GREEN.',
    at,
    resultClass: 'PASSED',
    evidenceRef: {
      kind: 'CANONICAL_TEST_RESULT',
      target: canonical.target,
      fingerprint: canonical.evidenceDigest
    }
  });
}

function blockNaturalAgenticMission(mission, { reason, at } = {}) {
  return appendEvent(mission, {
    type: EVENT_TYPES.MISSION_BLOCKED,
    state: 'BLOCKED',
    summary: requireText(reason, 'Mission blocked reason', 512),
    at
  });
}

function cancelNaturalAgenticMission(mission, { reason = 'Human cancelled mission.', at } = {}) {
  return appendEvent(mission, {
    type: EVENT_TYPES.MISSION_CANCELLED,
    state: 'CANCELLED',
    summary: reason,
    at
  });
}

function consumeMissionAuthorityGrant(mission, authorityRef, { at } = {}) {
  const current = validateNaturalAgenticMission(mission);
  const ref = requireText(authorityRef, 'Authority reference', 256);
  if (current.authority.usedAuthorityRefs.includes(ref)) {
    throw new Error('Mission authority grant replay was stopped.');
  }
  const nextAuthority = normalizeAuthority({
    ...current.authority,
    usedAuthorityRefs: [...current.authority.usedAuthorityRefs, ref]
  });
  const next = {
    ...current,
    authority: nextAuthority
  };
  delete next.missionFingerprint;
  return appendEvent(withMissionFingerprint(next), {
    type: EVENT_TYPES.AUTHORITY_GRANTED,
    state: current.state,
    summary: 'One-shot mission authority reference consumed.',
    at
  });
}

function resumeNaturalAgenticMission({ mission, revalidation, resumedAt, authority = null } = {}) {
  const current = validateNaturalAgenticMission(mission);
  if (current.state === 'CANCELLED') {
    throw new Error('Cancelled mission cannot resume.');
  }
  if (!revalidation || revalidation.schema !== REVALIDATION_SCHEMA || !Object.isFrozen(revalidation)) {
    throw new Error('Immutable workspace revalidation evidence is required.');
  }
  const at = requireTimestamp(resumedAt, 'Mission resume timestamp');
  const valid =
    revalidation.decision === 'VALID' &&
    revalidation.sessionFingerprint === current.binding.sessionFingerprint;
  if (!valid) {
    const invalidated = {
      ...current,
      authority: normalizeAuthority({
        allowedCapabilities: [
          'mission.status',
          'mission.plan',
          'mission.changes',
          'mission.tests',
          'mission.authority',
          'mission.journal',
          'mission.resume',
          'authority.inspect',
          'authority.request'
        ],
        staleGrantsInvalidated: true
      })
    };
    delete invalidated.missionFingerprint;
    return appendEvent(withMissionFingerprint(invalidated), {
      type: EVENT_TYPES.STATE_INVALIDATED,
      state: 'BLOCKED',
      summary: 'Resume failed closed because physical workspace state changed.',
      at,
      resultClass: 'STALE_STATE'
    });
  }
  const next = {
    ...current,
    resumeCount: current.resumeCount + 1,
    authority: normalizeAuthority({
      ...(authority || current.authority),
      grants: [],
      usedAuthorityRefs: [],
      staleGrantsInvalidated: true
    })
  };
  delete next.missionFingerprint;
  return appendEvent(withMissionFingerprint(next), {
    type: EVENT_TYPES.WORKSPACE_VALIDATED,
    state: current.state,
    summary: 'Mission resumed after physical workspace revalidation.',
    at,
    resultClass: 'SUCCESS'
  });
}

function projectionBase(mission, projection) {
  const current = validateNaturalAgenticMission(mission);
  return deepFreeze({
    schema: PROJECTION_SCHEMA,
    projection,
    missionId: current.missionId,
    missionFingerprint: current.missionFingerprint,
    state: current.state,
    objective: current.objective,
    generatedFromEventCount: current.events.length,
    projectionOnly: true,
    localDeterministicFastPath: true,
    providerInvoked: false,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function planCounts(plan) {
  return PLAN_STATUSES.reduce((counts, status) => {
    counts[status.toLowerCase()] = plan.filter((item) => item.status === status).length;
    return counts;
  }, {});
}

function livePlanState(plan, missionState) {
  const terminal = TERMINAL_STATES.has(missionState);
  const active = plan.find((item) => item.status === 'ACTIVE') || null;
  const blocked = [...plan].reverse().find((item) => item.status === 'BLOCKED') || null;
  const pending = plan.filter((item) => item.status === 'PENDING');
  const completed = plan.filter((item) => item.status === 'COMPLETED');
  const lastResult = [...plan].reverse().find((item) => item.resultClass) || null;

  return deepFreeze({
    currentStep: terminal ? null : active || blocked,
    nextStep: !terminal && pending.length === 1 ? pending[0] : null,
    nextStepAmbiguous: !terminal && pending.length > 1,
    completedSteps: completed,
    pendingSteps: pending,
    blockedSteps: plan.filter((item) => item.status === 'BLOCKED'),
    lastGovernedResult: lastResult
      ? deepFreeze({
          stepId: lastResult.stepId,
          operation: lastResult.operation || null,
          classification: lastResult.resultClass,
          evidenceRef: lastResult.evidenceRef || null,
          blocker: lastResult.blocker || null
        })
      : null
  });
}

function continuationEnvelope(classification, mission, reason, step = null) {
  if (!CONTINUATION_CLASSES.includes(classification)) {
    throw new Error('Mission continuation classification is unsupported.');
  }
  const body = {
    schema: CONTINUATION_SCHEMA,
    classification,
    missionId: mission.missionId,
    missionFingerprint: mission.missionFingerprint,
    reason: requireText(reason, 'Mission continuation reason', 1024),
    step,
    processLocal: true,
    physicalStateValidated: classification !== 'STALE_STATE',
    authorityExpansion: false,
    operationalAuthority: false,
    mutationAuthority: false
  };
  return deepFreeze({
    ...body,
    continuationFingerprint: fingerprint(CONTINUATION_SCHEMA, body)
  });
}

function hasCurrentPhysicalBinding(mission, revalidation) {
  return Boolean(
    revalidation &&
    revalidation.schema === REVALIDATION_SCHEMA &&
    Object.isFrozen(revalidation) &&
    revalidation.decision === 'VALID' &&
    revalidation.sessionFingerprint === mission.binding.sessionFingerprint &&
    revalidation.samePhysical === true &&
    revalidation.sameRepository === true &&
    revalidation.sameWorktree === true &&
    revalidation.operationalAuthority === false &&
    revalidation.mutationAuthority === false &&
    revalidation.current &&
    revalidation.current.physicalWorkspaceIdentity === mission.binding.physicalWorkspaceIdentity &&
    revalidation.current.repositoryHead === mission.binding.repositoryHead &&
    revalidation.current.worktreeFingerprint === mission.binding.worktreeFingerprint
  );
}

function selectNaturalAgenticMissionContinuation({ mission, revalidation } = {}) {
  const current = validateNaturalAgenticMission(mission);

  if (!hasCurrentPhysicalBinding(current, revalidation)) {
    return continuationEnvelope(
      'STALE_STATE',
      current,
      'Process-local continuation stopped because physical mission state is stale.'
    );
  }

  const blocked = [...current.plan].reverse().find((item) => item.status === 'BLOCKED');
  if (blocked && blocked.resultClass === 'STALE_STATE') {
    return continuationEnvelope(
      'STALE_STATE',
      current,
      blocked.blocker || 'Process-local continuation is blocked by stale physical state.',
      blocked
    );
  }
  if (
    blocked &&
    ['AUTHORITY_REQUIRED', 'DENIED'].includes(blocked.resultClass)
  ) {
    return continuationEnvelope(
      'AUTHORITY_REQUIRED',
      current,
      blocked.blocker || 'The current mission step requires independent authority.',
      blocked
    );
  }

  const pending = current.plan.filter((item) => item.status === 'PENDING');
  if (pending.length === 0) {
    return continuationEnvelope(
      'NO_NEXT_STEP',
      current,
      'The current mission has no pending live-plan step.'
    );
  }
  if (pending.length > 1) {
    return continuationEnvelope(
      'AMBIGUOUS_NEXT_STEP',
      current,
      'More than one pending live-plan step is eligible for clarification.'
    );
  }

  const step = pending[0];
  if (
    !step.operation ||
    !PROCESS_LOCAL_CONTINUATION_OPERATIONS.includes(step.operation) ||
    !current.authority.allowedCapabilities.includes(step.operation) ||
    current.authority.deniedCapabilities.includes(step.operation)
  ) {
    return continuationEnvelope(
      'AUTHORITY_REQUIRED',
      current,
      'The next live-plan step is not independently authorized for process-local continuation.',
      step
    );
  }

  return continuationEnvelope(
    'ELIGIBLE',
    current,
    'Exactly one physically valid and already-authorized live-plan step is eligible.',
    step
  );
}

function projectMissionStatus(mission) {
  const current = validateNaturalAgenticMission(mission);
  const live = livePlanState(current.plan, current.state);
  return deepFreeze({
    ...projectionBase(current, 'status'),
    binding: current.binding,
    plan: planCounts(current.plan),
    lastQualification: current.tests.lastResult,
    currentStep: live.currentStep,
    nextStep: live.nextStep,
    nextStepAmbiguous: live.nextStepAmbiguous,
    lastGovernedResult: live.lastGovernedResult,
    blocker: live.blockedSteps.at(-1)?.blocker || null,
    pendingApproval: live.blockedSteps.some(
      (item) => item.resultClass === 'AUTHORITY_REQUIRED'
    ),
    workspace: current.binding.repositoryPath,
    repository: current.binding.repositoryPath,
    currentHead: current.binding.repositoryHead,
    worktreeFingerprint: current.binding.worktreeFingerprint,
    provider: current.provider,
    activeAuthority: current.authority.allowedCapabilities,
    unavailableAuthority: current.authority.deniedCapabilities
  });
}

function projectMissionPlan(mission) {
  const current = validateNaturalAgenticMission(mission);
  const live = livePlanState(current.plan, current.state);
  return deepFreeze({
    ...projectionBase(current, 'plan'),
    plan: current.plan,
    currentStep: live.currentStep,
    nextStep: live.nextStep,
    nextStepAmbiguous: live.nextStepAmbiguous,
    completedSteps: live.completedSteps,
    pendingSteps: live.pendingSteps,
    blockedSteps: live.blockedSteps,
    lastGovernedResult: live.lastGovernedResult
  });
}

function projectMissionChanges(mission) {
  const current = validateNaturalAgenticMission(mission);
  return deepFreeze({
    ...projectionBase(current, 'changes'),
    changes: current.changes
  });
}

function projectMissionTests(mission) {
  const current = validateNaturalAgenticMission(mission);
  return deepFreeze({
    ...projectionBase(current, 'tests'),
    tests: current.tests
  });
}

function projectMissionAuthority(mission) {
  const current = validateNaturalAgenticMission(mission);
  return deepFreeze({
    ...projectionBase(current, 'authority'),
    availableCapabilities: current.authority.availableCapabilities,
    allowedCapabilities: current.authority.allowedCapabilities,
    deniedCapabilities: current.authority.deniedCapabilities,
    localCommitSeparateFromPush: true,
    testExecutionNotArbitraryShell: true,
    readDoesNotImplyMutation: true,
    providerConnectionDoesNotImplyNetworkMutation: true,
    grants: current.authority.grants,
    usedAuthorityRefs: current.authority.usedAuthorityRefs,
    staleGrantsInvalidated: current.authority.staleGrantsInvalidated
  });
}

function projectMissionJournal(mission) {
  const current = validateNaturalAgenticMission(mission);
  return deepFreeze({
    ...projectionBase(current, 'journal'),
    journal: current.journal,
    eventTypes: current.events.map((event) => event.type),
    latestEventHash: current.journal.latestEventHash,
    contentTelemetry: false
  });
}

function projectMissionActivity(mission) {
  const current = validateNaturalAgenticMission(mission);
  const live = livePlanState(current.plan, current.state);
  return deepFreeze({
    ...projectionBase(current, 'activity'),
    latestEvent: validateNaturalAgenticMissionEvent(current.events.at(-1)),
    currentStep: live.currentStep,
    nextStep: live.nextStep,
    nextStepAmbiguous: live.nextStepAmbiguous,
    lastGovernedResult: live.lastGovernedResult,
    blocker: live.blockedSteps.at(-1)?.blocker || null,
    pendingApproval: live.blockedSteps.some(
      (item) => item.resultClass === 'AUTHORITY_REQUIRED'
    )
  });
}

function projectMissionView(mission, view) {
  const selected = requireText(view, 'Mission projection', 64).replace(/^\//, '').toLowerCase();
  if (selected === 'status') return projectMissionStatus(mission);
  if (selected === 'plan') return projectMissionPlan(mission);
  if (selected === 'changes') return projectMissionChanges(mission);
  if (selected === 'tests') return projectMissionTests(mission);
  if (selected === 'authority') return projectMissionAuthority(mission);
  if (selected === 'journal') return projectMissionJournal(mission);
  if (selected === 'activity') return projectMissionActivity(mission);
  throw new Error('Mission projection is unsupported.');
}

function substituteMissionProvider(mission, provider, { at } = {}) {
  const current = validateNaturalAgenticMission(mission);
  const next = {
    ...current,
    provider: normalizeProvider(provider)
  };
  delete next.missionFingerprint;
  return appendEvent(withMissionFingerprint(next), {
    type: EVENT_TYPES.EVIDENCE_DISCOVERED,
    state: current.state,
    summary: 'Cognitive provider projection changed without authority expansion.',
    at
  });
}

function missionExpectedState(mission) {
  const current = validateNaturalAgenticMission(mission);
  return deepFreeze({
    missionFingerprint: current.missionFingerprint,
    missionState: current.state,
    stateSequence: current.stateSequence,
    eventCount: current.events.length,
    sessionFingerprint: current.binding.sessionFingerprint,
    physicalWorkspaceIdentity: current.binding.physicalWorkspaceIdentity,
    repositoryHead: current.binding.repositoryHead,
    worktreeFingerprint: current.binding.worktreeFingerprint
  });
}

function formatMissionProjection(projection, language = 'en') {
  if (!projection || projection.schema !== PROJECTION_SCHEMA || !Object.isFrozen(projection)) {
    throw new Error('Immutable mission projection is required.');
  }
  if (projection.projection === 'status') {
    return (
      `Mission: ${projection.missionId}\n` +
      `State: ${projection.state}\n` +
      `Objective: ${projection.objective}\n` +
      `Current step: ${projection.currentStep ? projection.currentStep.summary : 'none'}\n` +
      `Next step: ${projection.nextStep ? projection.nextStep.summary : projection.nextStepAmbiguous ? 'clarification required' : 'none'}\n` +
      `Last governed result: ${projection.lastGovernedResult ? projection.lastGovernedResult.classification : 'not yet established'}\n` +
      `Last test: ${projection.lastQualification ? projection.lastQualification.classification : 'not yet established'}\n` +
      `Blocker: ${projection.blocker || 'none'}\n` +
      `Pending approval: ${projection.pendingApproval ? 'yes' : 'no'}\n` +
      `Provider: ${projection.provider.providerId} (${projection.provider.providerKind}; authority none)\n` +
      `Workspace: ${projection.workspace}\n` +
      `HEAD: ${projection.currentHead}\n` +
      `Plan: ${projection.plan.completed} completed, ${projection.plan.active} active, ${projection.plan.pending} pending, ${projection.plan.blocked} blocked\n` +
      'Projection authority: none\n'
    );
  }
  if (projection.projection === 'plan') {
    const steps = projection.plan.map((item) =>
      `${item.status}${item.operation ? ` [${item.operation}]` : ''}: ${item.summary}` +
      `${item.resultClass ? ` — ${item.resultClass}` : ''}` +
      `${item.blocker ? ` — ${item.blocker}` : ''}`
    ).join('\n');
    return (
      `Mission: ${projection.missionId}\n` +
      `Objective: ${projection.objective}\n` +
      `Current step: ${projection.currentStep ? projection.currentStep.summary : 'none'}\n` +
      `Next step: ${projection.nextStep ? projection.nextStep.summary : projection.nextStepAmbiguous ? 'clarification required' : 'none'}\n` +
      `Last governed result: ${projection.lastGovernedResult ? projection.lastGovernedResult.classification : 'not yet established'}\n` +
      (steps ? `${steps}\n` : 'No mission plan recorded.\n') +
      'Plan authority: none\n'
    );
  }
  if (projection.projection === 'changes') {
    return projection.changes.map((item) =>
      `${item.target}: ${item.summary}`
    ).join('\n') + (projection.changes.length ? '\n' : 'No governed changes recorded.\n');
  }
  if (projection.projection === 'tests') {
    const last = projection.tests.lastResult;
    return last
      ? `Last test: ${last.classification} ${last.target || last.selector}\nCanonical: ${projection.tests.canonical ? projection.tests.canonical.classification : 'not complete'}\n`
      : 'No governed test evidence recorded.\n';
  }
  if (projection.projection === 'authority') {
    return (
      'Authority projection:\n' +
      `  Allowed: ${projection.allowedCapabilities.join(', ') || 'none'}\n` +
      `  Denied: ${projection.deniedCapabilities.join(', ') || 'none'}\n` +
      '  Local commit does not grant push.\n'
    );
  }
  if (projection.projection === 'journal') {
    return (
      `Journal events: ${projection.journal.eventCount}\n` +
      `Latest event hash: ${projection.latestEventHash}\n` +
      'Content telemetry: false\n'
    );
  }
  if (projection.projection === 'activity') {
    const operation = projection.currentStep?.operation ||
      projection.lastGovernedResult?.operation ||
      null;
    if (language === 'pt-BR') {
      return (
        'Atividade atual da missão:\n' +
        `Missão: ${projection.missionId}\n` +
        `Estado: ${projection.state}\n` +
        `Último evento: ${projection.latestEvent.type}\n` +
        `Operação: ${operation || 'não estabelecida'}\n` +
        `Último resultado governado: ${projection.lastGovernedResult ? projection.lastGovernedResult.classification : 'não estabelecido'}\n` +
        `Bloqueio: ${projection.blocker || 'nenhum'}\n` +
        `Autoridade pendente: ${projection.pendingApproval ? 'sim, ainda não concedida' : 'não'}\n` +
        'Autoridade da projeção: nenhuma\n'
      );
    }
    return (
      'Current mission activity:\n' +
      `Mission: ${projection.missionId}\n` +
      `State: ${projection.state}\n` +
      `Latest event: ${projection.latestEvent.type}\n` +
      `Operation: ${operation || 'not established'}\n` +
      `Last governed result: ${projection.lastGovernedResult ? projection.lastGovernedResult.classification : 'not established'}\n` +
      `Blocker: ${projection.blocker || 'none'}\n` +
      `Pending authority: ${projection.pendingApproval ? 'yes, not granted' : 'no'}\n` +
      'Projection authority: none\n'
    );
  }
  return `${projection.projection}: ${projection.state}\n`;
}

module.exports = Object.freeze({
  MISSION_SCHEMA,
  EVENT_SCHEMA,
  PROJECTION_SCHEMA,
  CONTINUATION_SCHEMA,
  MISSION_STATES,
  PLAN_STATUSES,
  PLAN_RESULT_CLASSES,
  CONTINUATION_CLASSES,
  EVENT_TYPES,
  validateNaturalAgenticMissionEvent,
  DEFAULT_AVAILABLE_CAPABILITIES,
  DEFAULT_ALLOWED_CAPABILITIES,
  DEFAULT_DENIED_CAPABILITIES,
  createNaturalAgenticMission,
  validateNaturalAgenticMission,
  transitionNaturalAgenticMission,
  updateNaturalAgenticMissionPlan,
  updateNaturalAgenticMissionPlanStep,
  recordNaturalAgenticMissionPlanResult,
  selectNaturalAgenticMissionContinuation,
  recordNaturalAgenticMissionChange,
  recordNaturalAgenticMissionAuthorityGrant,
  recordNaturalAgenticMissionTestResult,
  qualifyNaturalAgenticMissionGreen,
  completeNaturalAgenticMissionGreen,
  blockNaturalAgenticMission,
  cancelNaturalAgenticMission,
  consumeMissionAuthorityGrant,
  resumeNaturalAgenticMission,
  projectMissionStatus,
  projectMissionPlan,
  projectMissionChanges,
  projectMissionTests,
  projectMissionAuthority,
  projectMissionJournal,
  projectMissionActivity,
  projectMissionView,
  substituteMissionProvider,
  missionExpectedState,
  formatMissionProjection
});
