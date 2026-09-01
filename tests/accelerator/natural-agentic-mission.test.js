'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const test = require('node:test');

const {
  EVENT_TYPES,
  createNaturalAgenticMission,
  updateNaturalAgenticMissionPlan,
  recordNaturalAgenticMissionTestResult,
  qualifyNaturalAgenticMissionGreen,
  cancelNaturalAgenticMission,
  transitionNaturalAgenticMission,
  resumeNaturalAgenticMission,
  projectMissionStatus,
  projectMissionPlan,
  projectMissionAuthority,
  projectMissionJournal,
  substituteMissionProvider
} = require('../../accelerator/core/natural-agentic-mission');

const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function session() {
  return freeze({
    schema: 'sdo.deterministic_workspace_session.v1',
    physical: { root: '/project' },
    physicalWorkspaceIdentity: sha('workspace'),
    repositoryHead: sha('head'),
    worktreeFingerprint: sha('worktree'),
    sessionFingerprint: sha('session'),
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function mission(overrides = {}) {
  return createNaturalAgenticMission({
    missionId: 'mission-036',
    objective: 'Implement ADR-036 without weakening authority.',
    session: session(),
    createdAt: '2026-08-31T12:00:00.000Z',
    plan: [
      { stepId: 'inspect', summary: 'Inspect governed runtime.', status: 'ACTIVE' },
      { stepId: 'qualify', summary: 'Run canonical qualification.', status: 'PENDING' }
    ],
    ...overrides
  });
}

test('mission lifecycle exposes explicit state live plan events and projections', () => {
  let current = mission();
  assert.equal(current.state, 'PLANNING');
  assert.deepEqual(current.events.map((event) => event.type), [
    EVENT_TYPES.MISSION_STARTED,
    EVENT_TYPES.PLAN_UPDATED
  ]);
  assert.equal(current.events[1].previousEventHash, current.events[0].eventHash);

  current = updateNaturalAgenticMissionPlan(current, {
    at: '2026-08-31T12:01:00.000Z',
    plan: [
      { stepId: 'inspect', summary: 'Inspect governed runtime.', status: 'COMPLETED' },
      { stepId: 'implement', summary: 'Implement gateway vertical slice.', status: 'ACTIVE' },
      { stepId: 'qualify', summary: 'Run canonical qualification.', status: 'PENDING' }
    ]
  });

  const status = projectMissionStatus(current);
  assert.equal(status.projectionOnly, true);
  assert.equal(status.localDeterministicFastPath, true);
  assert.equal(status.providerInvoked, false);
  assert.deepEqual(status.plan, { pending: 1, active: 1, completed: 1, blocked: 0 });

  const plan = projectMissionPlan(current);
  assert.equal(plan.plan[1].status, 'ACTIVE');
});

test('GREEN requires canonical passing evidence and is never inferred from targeted tests', () => {
  let current = mission();
  const targetedDigest = sha('targeted');
  current = recordNaturalAgenticMissionTestResult(current, {
    at: '2026-08-31T12:01:00.000Z',
    testEvidence: {
      selector: 'NODE_TEST_FILE',
      target: 'tests/accelerator/integrated-governed-agent-gateway.test.js',
      classification: 'PASSED',
      testsDiscovered: 12,
      passed: 12,
      failed: 0,
      skipped: 0,
      canonical: false,
      evidenceDigest: targetedDigest
    }
  });

  assert.equal(current.state, 'TESTING');
  assert.notEqual(current.state, 'GREEN');
  assert.throws(
    () => qualifyNaturalAgenticMissionGreen(current, {
      at: '2026-08-31T12:02:00.000Z',
      canonicalEvidence: {
        selector: 'NODE_TEST_FILE',
        target: 'targeted-only.test.js',
        classification: 'PASSED',
        failed: 0,
        canonical: false,
        evidenceDigest: sha('not-canonical')
      }
    }),
    /GREEN requires passing canonical/
  );

  current = qualifyNaturalAgenticMissionGreen(current, {
    at: '2026-08-31T12:03:00.000Z',
    canonicalEvidence: {
      selector: 'npm test',
      target: 'tests/accelerator/*.test.js',
      classification: 'PASSED',
      testsDiscovered: 1200,
      passed: 1195,
      failed: 0,
      skipped: 5,
      canonical: true,
      evidenceDigest: sha('canonical')
    }
  });

  assert.equal(current.state, 'GREEN');
  assert.equal(current.tests.canonical.classification, 'PASSED');
  assert.equal(current.events.at(-1).type, EVENT_TYPES.MISSION_GREEN);
});

test('resume requires physical revalidation and invalidates stale grants', () => {
  const current = mission({
    authority: {
      grants: [
        {
          authorityRef: 'grant-r3-once',
          capability: 'mutation.applyConditional',
          issuedAt: '2026-08-31T12:00:00.000Z',
          expiresAt: '2026-08-31T12:05:00.000Z',
          lifetime: 'ONE_SHOT'
        }
      ]
    }
  });

  const valid = freeze({
    schema: 'sdo.deterministic_workspace_session_revalidation.v1',
    decision: 'VALID',
    sessionFingerprint: current.binding.sessionFingerprint,
    operationalAuthority: false,
    mutationAuthority: false
  });

  const resumed = resumeNaturalAgenticMission({
    mission: current,
    revalidation: valid,
    resumedAt: '2026-08-31T12:01:00.000Z'
  });

  assert.equal(resumed.resumeCount, 1);
  assert.equal(resumed.authority.grants.length, 0);
  assert.equal(resumed.authority.staleGrantsInvalidated, true);
  assert.equal(resumed.events.at(-1).type, EVENT_TYPES.WORKSPACE_VALIDATED);

  const invalid = freeze({
    schema: 'sdo.deterministic_workspace_session_revalidation.v1',
    decision: 'INVALIDATED',
    sessionFingerprint: current.binding.sessionFingerprint,
    operationalAuthority: false,
    mutationAuthority: false
  });

  const blocked = resumeNaturalAgenticMission({
    mission: current,
    revalidation: invalid,
    resumedAt: '2026-08-31T12:01:00.000Z'
  });

  assert.equal(blocked.state, 'BLOCKED');
  assert.equal(blocked.events.at(-1).type, EVENT_TYPES.STATE_INVALIDATED);
  assert.equal(blocked.authority.grants.length, 0);
});

test('authority and journal projections expose state without creating authority', () => {
  const current = mission();
  const authority = projectMissionAuthority(current);
  assert.equal(authority.localCommitSeparateFromPush, true);
  assert.equal(authority.testExecutionNotArbitraryShell, true);
  assert.equal(authority.readDoesNotImplyMutation, true);
  assert.ok(authority.deniedCapabilities.includes('git.push'));
  assert.equal(authority.operationalAuthority, false);

  const journal = projectMissionJournal(current);
  assert.equal(journal.contentTelemetry, false);
  assert.equal(journal.journal.eventCount, current.events.length);
});

test('provider substitution cannot expand deterministic authority', () => {
  const before = projectMissionAuthority(mission());
  const afterMission = substituteMissionProvider(mission(), {
    providerId: 'openai-compatible:test',
    providerKind: 'REMOTE'
  }, {
    at: '2026-08-31T12:01:00.000Z'
  });
  const after = projectMissionAuthority(afterMission);

  assert.deepEqual(after.allowedCapabilities, before.allowedCapabilities);
  assert.deepEqual(after.deniedCapabilities, before.deniedCapabilities);
  assert.equal(afterMission.provider.networkAuthority, false);
  assert.equal(afterMission.provider.mutationAuthority, false);
});

test('interruption is terminal and sensitive event summaries fail closed', () => {
  const cancelled = cancelNaturalAgenticMission(mission(), {
    at: '2026-08-31T12:01:00.000Z',
    reason: 'Human cancelled mission.'
  });
  assert.equal(cancelled.state, 'CANCELLED');
  assert.throws(
    () => resumeNaturalAgenticMission({
      mission: cancelled,
      revalidation: freeze({
        schema: 'sdo.deterministic_workspace_session_revalidation.v1',
        decision: 'VALID',
        sessionFingerprint:
          cancelled.binding.sessionFingerprint,
        operationalAuthority: false,
        mutationAuthority: false
      }),
      resumedAt: '2026-08-31T12:02:00.000Z'
    }),
    /Cancelled mission cannot resume/
  );
  assert.throws(
    () => transitionNaturalAgenticMission(cancelled, {
      type: EVENT_TYPES.TEST_STARTED,
      state: 'TESTING',
      summary: 'Queued stale test.',
      at: '2026-08-31T12:02:00.000Z'
    }),
    /Terminal mission state/
  );

  assert.throws(
    () => transitionNaturalAgenticMission(mission(), {
      type: EVENT_TYPES.EVIDENCE_DISCOVERED,
      state: 'AUDITING',
      summary: 'Bearer secret-token-that-must-not-stream',
      at: '2026-08-31T12:01:00.000Z'
    }),
    /sensitive content/
  );
});

test('mission module exposes no filesystem process shell or network surface', () => {
  const source = fs.readFileSync(
    require.resolve('../../accelerator/core/natural-agentic-mission'),
    'utf8'
  );
  assert.doesNotMatch(source, /child_process|spawn|execSync|fetch\(|node:http|node:https|writeFile|readFile|git push|npm publish/);
});
