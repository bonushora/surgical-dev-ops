'use strict';

const crypto = require('node:crypto');

const {
  SESSION_SCHEMA,
  REVALIDATION_SCHEMA
} = require('../adapters/deterministic-workspace-session-adapter');

const MISSION_SCHEMA = 'sdo.natural_agentic_mission.v1';
const EVENT_SCHEMA = 'sdo.natural_agentic_mission_event.v1';
const PROJECTION_SCHEMA = 'sdo.natural_agentic_mission_projection.v1';

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
  return plan.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Mission plan item is malformed.');
    }
    const summary = requireText(item.summary, 'Mission plan summary', 512);
    const status = requireText(item.status || 'PENDING', 'Mission plan status', 32).toUpperCase();
    if (!PLAN_STATUSES.includes(status)) {
      throw new Error('Mission plan status is unsupported.');
    }
    const stepId = item.stepId
      ? requireText(item.stepId, 'Mission plan step id', 128)
      : `step-${String(index + 1).padStart(2, '0')}`;
    return deepFreeze({ stepId, summary, status });
  });
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

function recordNaturalAgenticMissionChange(mission, { target, summary, beforeSha256 = null, afterSha256 = null, at } = {}) {
  const current = validateNaturalAgenticMission(mission);
  const change = deepFreeze({
    target: requireText(target, 'Mission change target', 1024),
    summary: requireText(summary, 'Mission change summary', 512),
    beforeSha256: beforeSha256 === null ? null : requireDigest(beforeSha256, 'Change before SHA-256'),
    afterSha256: afterSha256 === null ? null : requireDigest(afterSha256, 'Change after SHA-256')
  });
  const next = {
    ...current,
    changes: [...current.changes, change]
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
  return appendEvent(withTests, {
    type: EVENT_TYPES.MISSION_GREEN,
    state: 'GREEN',
    summary: 'Canonical qualification evidence is GREEN.',
    at,
    resultClass: 'PASSED',
    evidenceRef: {
      kind: 'CANONICAL_TEST_RESULT',
      target: evidence.target,
      fingerprint: evidence.evidenceDigest
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

function projectMissionStatus(mission) {
  const current = validateNaturalAgenticMission(mission);
  return deepFreeze({
    ...projectionBase(current, 'status'),
    binding: current.binding,
    plan: planCounts(current.plan),
    lastQualification: current.tests.lastResult,
    currentHead: current.binding.repositoryHead,
    worktreeFingerprint: current.binding.worktreeFingerprint,
    activeAuthority: current.authority.allowedCapabilities,
    unavailableAuthority: current.authority.deniedCapabilities
  });
}

function projectMissionPlan(mission) {
  const current = validateNaturalAgenticMission(mission);
  return deepFreeze({
    ...projectionBase(current, 'plan'),
    plan: current.plan
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

function projectMissionView(mission, view) {
  const selected = requireText(view, 'Mission projection', 64).replace(/^\//, '').toLowerCase();
  if (selected === 'status') return projectMissionStatus(mission);
  if (selected === 'plan') return projectMissionPlan(mission);
  if (selected === 'changes') return projectMissionChanges(mission);
  if (selected === 'tests') return projectMissionTests(mission);
  if (selected === 'authority') return projectMissionAuthority(mission);
  if (selected === 'journal') return projectMissionJournal(mission);
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

function formatMissionProjection(projection) {
  if (!projection || projection.schema !== PROJECTION_SCHEMA || !Object.isFrozen(projection)) {
    throw new Error('Immutable mission projection is required.');
  }
  if (projection.projection === 'status') {
    return (
      `Mission: ${projection.missionId}\n` +
      `State: ${projection.state}\n` +
      `Objective: ${projection.objective}\n` +
      `HEAD: ${projection.currentHead}\n` +
      `Plan: ${projection.plan.completed} completed, ${projection.plan.active} active, ${projection.plan.pending} pending, ${projection.plan.blocked} blocked\n` +
      'Projection authority: none\n'
    );
  }
  if (projection.projection === 'plan') {
    return projection.plan.map((item) =>
      `${item.status}: ${item.summary}`
    ).join('\n') + (projection.plan.length ? '\n' : 'No mission plan recorded.\n');
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
  return `${projection.projection}: ${projection.state}\n`;
}

module.exports = Object.freeze({
  MISSION_SCHEMA,
  EVENT_SCHEMA,
  PROJECTION_SCHEMA,
  MISSION_STATES,
  PLAN_STATUSES,
  EVENT_TYPES,
  DEFAULT_AVAILABLE_CAPABILITIES,
  DEFAULT_ALLOWED_CAPABILITIES,
  DEFAULT_DENIED_CAPABILITIES,
  createNaturalAgenticMission,
  validateNaturalAgenticMission,
  transitionNaturalAgenticMission,
  updateNaturalAgenticMissionPlan,
  recordNaturalAgenticMissionChange,
  recordNaturalAgenticMissionTestResult,
  qualifyNaturalAgenticMissionGreen,
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
  projectMissionView,
  substituteMissionProvider,
  missionExpectedState,
  formatMissionProjection
});
