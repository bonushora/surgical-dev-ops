'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  createDeterministicWorkspaceSession
} = require('../../accelerator/adapters/deterministic-workspace-session-adapter');
const {
  createNaturalAgenticMission,
  recordNaturalAgenticMissionPlanResult,
  qualifyNaturalAgenticMissionGreen,
  selectNaturalAgenticMissionContinuation,
  substituteMissionProvider
} = require('../../accelerator/core/natural-agentic-mission');
const {
  provisionLocalOfflineHumanAuthority
} = require('../../accelerator/core/local-offline-human-authority-store');
const {
  materializeGovernedEngineeringProposal
} = require('../../accelerator/core/governed-engineering-proposal');
const {
  createGatewayRequest,
  dispatchGatewayRequest
} = require('../../accelerator/core/integrated-governed-agent-gateway');
const {
  createNaturalMissionContinuityCheckpoint,
  resumeNaturalMissionContinuity
} = require('../../accelerator/cli/natural-mission-continuity');
const {
  saveNaturalMissionContinuity,
  loadNaturalMissionContinuity
} = require('../../accelerator/adapters/natural-mission-continuity-store');
const {
  prepareInteractiveNaturalDevelopment
} = require('../../accelerator/cli/natural-development-interactive');
const {
  createNaturalGovernedRepairLoop,
  investigateNaturalGovernedRepairFailure,
  proposeNaturalGovernedRepair,
  authorizeAndContinueNaturalGovernedRepair
} = require('../../accelerator/cli/natural-governed-repair-loop');
const {
  createHermeticGitRepository
} = require('./helpers/hermetic-git-repository');

const CLI = require.resolve('../../accelerator/cli/surgical');
const R6_REPAIR_PROCESS = require.resolve('./fixtures/natural-r6-repair-process');
const START = '2099-02-01T00:00:00.000Z';
const AFTER = '2099-02-01T00:00:01.000Z';
const RESTART = '2099-02-01T00:00:02.000Z';

function stateRoot() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-r6-state-')));
}

function progressedMission(repository, { grant = false } = {}) {
  const session = createDeterministicWorkspaceSession({
    authorizedRoot: repository,
    humanSubject: 'r6-human',
    authorizedAt: START
  });
  let mission = createNaturalAgenticMission({
    missionId: `r6-${session.sessionFingerprint.slice(0, 32)}`,
    objective: 'Inspect the project and preserve truthful durable continuity.',
    session,
    createdAt: START,
    plan: [
      {
        stepId: 'inspect',
        summary: 'Inspect physical project state.',
        status: 'ACTIVE',
        operation: 'workspace.status'
      },
      {
        stepId: 'evidence',
        summary: 'Inspect the resulting governed evidence.',
        status: 'PENDING',
        operation: 'evidence.inspect',
        sourceOperation: 'workspace.status'
      }
    ],
    authority: {
      allowedCapabilities: [
        'workspace.status',
        'evidence.inspect',
        'tests.runCanonical',
        'mission.status',
        'mission.plan',
        'mission.resume',
        'authority.request'
      ],
      grants: grant ? [{
        authorityRef: 'pre-restart-canonical-authority',
        capability: 'tests.runCanonical',
        operation: 'tests.runCanonical',
        scope: { target: 'qualification.test.js' },
        issuedAt: START,
        expiresAt: '2099-02-01T01:00:00.000Z',
        lifetime: 'ONE_SHOT'
      }] : []
    }
  });
  const request = createGatewayRequest({
    requestId: `${mission.missionId}-status`,
    mission,
    operation: 'workspace.status',
    args: {},
    requestedAt: AFTER
  });
  const dispatch = dispatchGatewayRequest({
    request,
    mission,
    options: { now: () => AFTER }
  });
  assert.equal(dispatch.result.classification, 'SUCCESS');
  mission = recordNaturalAgenticMissionPlanResult(dispatch.mission, {
    stepId: 'inspect',
    result: dispatch.result,
    at: AFTER
  });
  return mission;
}

function runNatural(repository, continuityRoot, lines, environment = {}) {
  return spawnSync(
    process.execPath,
    [CLI, '--interaction', 'NATURAL', '--language', 'pt-BR'],
    {
      cwd: repository,
      env: {
        ...process.env,
        ...environment,
        SDO_NATURAL_MISSION_STATE_ROOT: continuityRoot,
        XDG_CONFIG_HOME: path.dirname(repository),
        LOCALAPPDATA: path.dirname(repository),
        APPDATA: path.dirname(repository)
      },
      input: [...lines, ''].join('\n'),
      encoding: 'utf8',
      timeout: 15_000,
      maxBuffer: 4 * 1024 * 1024
    }
  );
}

function git(repository, args) {
  const outcome = spawnSync('git', args, {
    cwd: repository,
    encoding: 'utf8'
  });
  assert.equal(outcome.status, 0, outcome.stderr);
  return outcome.stdout.trim();
}

function repairSource() {
  return (
    "'use strict';\n" +
    "const assert = require('node:assert/strict');\n" +
    "const crypto = require('node:crypto');\n" +
    "const fs = require('node:fs');\n" +
    "const path = require('node:path');\n" +
    "const test = require('node:test');\n" +
    "function authoritative(relative) {\n" +
    "  const key = crypto.createHash('sha256').update(relative).digest('hex');\n" +
    "  const ref = path.join(process.cwd(), '.git', 'refs', 'surgical-devops', 'workspace', key);\n" +
    "  if (!fs.existsSync(ref)) return path.join(process.cwd(), relative);\n" +
    "  const oid = fs.readFileSync(ref, 'utf8').trim();\n" +
    "  return path.join(process.cwd(), '.git', 'surgical-devops', 'materialized', key, oid + '.blob');\n" +
    "}\n" +
    "test('durable repair', () => {\n" +
    "  const source = fs.readFileSync(authoritative('impl.js'), 'utf8');\n" +
    "  assert.match(source, /module\\.exports = true/);\n" +
    "});\n"
  );
}

function authoritativeContent(repository, target) {
  const key = require('node:crypto').createHash('sha256').update(target).digest('hex');
  const reference = path.join(repository, '.git', 'refs', 'surgical-devops', 'workspace', key);
  if (!fs.existsSync(reference)) return fs.readFileSync(path.join(repository, target), 'utf8');
  const oid = fs.readFileSync(reference, 'utf8').trim();
  return fs.readFileSync(
    path.join(repository, '.git', 'surgical-devops', 'materialized', key, `${oid}.blob`),
    'utf8'
  );
}

async function pendingRepair(
  repository,
  replacement = "'use strict';\nmodule.exports = true;\n"
) {
  fs.writeFileSync(path.join(repository, 'impl.js'), "'use strict';\nmodule.exports = false;\n");
  fs.writeFileSync(path.join(repository, 'repair.test.js'), repairSource());
  fs.writeFileSync(path.join(repository, 'qualification.test.js'), repairSource());
  git(repository, ['add', '.']);
  git(repository, ['commit', '-m', 'R6 repair fixture']);
  const createdAt = new Date().toISOString();
  const session = createDeterministicWorkspaceSession({
    authorizedRoot: repository,
    humanSubject: 'r6-repair-human',
    authorizedAt: createdAt
  });
  let loop = createNaturalGovernedRepairLoop({
    objective: 'Repair impl.js and prove durable R5 authority continuity.',
    session,
    allowedTargets: ['impl.js'],
    testTarget: 'repair.test.js',
    qualificationTarget: 'qualification.test.js',
    createdAt,
    attemptCeiling: 2
  });
  loop = investigateNaturalGovernedRepairFailure(loop, { at: new Date().toISOString() });
  let evidenceDecision = 0;
  const before = fs.readFileSync(path.join(repository, 'impl.js'));
  const pending = await prepareInteractiveNaturalDevelopment({
    request: { objective: loop.objective, target: 'impl.js' },
    activation: {
      workspace: 'r6-repair',
      repositoryPath: repository,
      interactionMode: { mode: 'NATURAL' },
      language: 'en'
    },
    cognitiveSession: Object.freeze({
      async decideEvidence() {
        evidenceDecision += 1;
        return evidenceDecision === 1
          ? Object.freeze({
              schema: 'sdo.natural_evidence_decision.v1',
              decision: 'REQUEST_EVIDENCE',
              response: null,
              evidenceRequest: Object.freeze({
                kind: 'READ_FILE',
                target: 'impl.js',
                reason: 'Bind exact physical BEFORE evidence.'
              })
            })
          : Object.freeze({
              schema: 'sdo.natural_evidence_decision.v1',
              decision: 'RESPOND',
              response: 'Evidence is sufficient.',
              evidenceRequest: null
            });
      },
      async proposePatch(objective) {
        return materializeGovernedEngineeringProposal({
          schema: 'sdo.ai_engineering_patch_proposal.v1',
          objective,
          target: 'impl.js',
          beforeSha256: require('node:crypto').createHash('sha256').update(before).digest('hex'),
          replacementBase64: Buffer.from(replacement).toString('base64'),
          reason: 'Apply the one bounded physical repair.',
          validationKind: 'VALIDATE_JS'
        });
      }
    }),
    workMode: 'SUPERVISED_MICROTASKS',
    patchAttempt: 1
  });
  return proposeNaturalGovernedRepair(loop, { pending, at: new Date().toISOString() });
}

test('authority-free checkpoint resumes the same mission only after physical revalidation', (t) => {
  const fixture = createHermeticGitRepository();
  const root = stateRoot();
  t.after(() => {
    fixture.cleanup();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const mission = progressedMission(fixture.repository, { grant: true });
  const checkpoint = createNaturalMissionContinuityCheckpoint({
    mission,
    recordedAt: AFTER
  });
  const receipt = saveNaturalMissionContinuity({ stateRoot: root, checkpoint });
  assert.equal(receipt.durable, true);
  const reopened = loadNaturalMissionContinuity({
    stateRoot: root,
    repositoryPath: fixture.repository
  });
  const restored = resumeNaturalMissionContinuity({
    checkpoint: reopened,
    repositoryPath: fixture.repository,
    resumedAt: RESTART
  });
  assert.equal(restored.classification, 'RESUMED');
  assert.equal(restored.revalidation.decision, 'VALID');
  assert.equal(restored.mission.missionId, mission.missionId);
  assert.equal(restored.mission.objective, mission.objective);
  assert.equal(restored.mission.plan[0].status, 'COMPLETED');
  assert.equal(restored.mission.plan[1].status, 'PENDING');
  assert.equal(restored.mission.events.at(-1).type, 'WORKSPACE_VALIDATED');
  assert.equal(restored.mission.authority.grants.length, 0);
  assert.equal(restored.mission.authority.staleGrantsInvalidated, true);
  assert.equal(restored.referenceContext.references.length, 0);
  const continuation = selectNaturalAgenticMissionContinuation({
    mission: restored.mission,
    revalidation: restored.revalidation
  });
  assert.equal(continuation.classification, 'ELIGIBLE');
  assert.equal(continuation.processLocal, false);
  assert.equal(continuation.durableRestart, true);
});

test('offline physical divergence creates canonical invalidation and blocks continuation', (t) => {
  const fixture = createHermeticGitRepository();
  const root = stateRoot();
  t.after(() => {
    fixture.cleanup();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const mission = progressedMission(fixture.repository, { grant: true });
  const checkpoint = createNaturalMissionContinuityCheckpoint({ mission, recordedAt: AFTER });
  saveNaturalMissionContinuity({ stateRoot: root, checkpoint });
  fs.writeFileSync(path.join(fixture.repository, 'package-lock.json'), '{"offline":true}\n');
  const reopened = loadNaturalMissionContinuity({
    stateRoot: root,
    repositoryPath: fixture.repository
  });
  const restored = resumeNaturalMissionContinuity({
    checkpoint: reopened,
    repositoryPath: fixture.repository,
    resumedAt: RESTART
  });
  assert.equal(restored.classification, 'STATE_INVALIDATED');
  assert.equal(restored.mission.state, 'BLOCKED');
  assert.equal(restored.mission.events.at(-1).type, 'STATE_INVALIDATED');
  assert.equal(restored.mission.authority.grants.length, 0);
  assert.equal(restored.continuationEligible, false);
});

test('provider substitution after restart changes no physical or authority decision', (t) => {
  const fixture = createHermeticGitRepository();
  const root = stateRoot();
  t.after(() => {
    fixture.cleanup();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const original = progressedMission(fixture.repository, { grant: true });
  const checkpoint = createNaturalMissionContinuityCheckpoint({
    mission: original,
    recordedAt: AFTER
  });
  saveNaturalMissionContinuity({ stateRoot: root, checkpoint });
  const restored = resumeNaturalMissionContinuity({
    checkpoint: loadNaturalMissionContinuity({
      stateRoot: root,
      repositoryPath: fixture.repository
    }),
    repositoryPath: fixture.repository,
    resumedAt: RESTART
  });
  const before = selectNaturalAgenticMissionContinuation({
    mission: restored.mission,
    revalidation: restored.revalidation
  });
  const substituted = substituteMissionProvider(
    restored.mission,
    { providerId: 'unavailable-provider', providerKind: 'UNAVAILABLE' },
    { at: '2099-02-01T00:00:03.000Z' }
  );
  const after = selectNaturalAgenticMissionContinuation({
    mission: substituted,
    revalidation: restored.revalidation
  });
  assert.equal(restored.providerMemoryUsed, false);
  assert.equal(before.classification, 'ELIGIBLE');
  assert.equal(after.classification, before.classification);
  assert.equal(substituted.authority.grants.length, 0);
  assert.equal(substituted.provider.filesystemAuthority, false);
  assert.equal(substituted.provider.mutationAuthority, false);
});

test('pre-restart authority is information only and cannot execute after reopen', (t) => {
  const fixture = createHermeticGitRepository();
  const root = stateRoot();
  t.after(() => {
    fixture.cleanup();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const mission = progressedMission(fixture.repository, { grant: true });
  const checkpoint = createNaturalMissionContinuityCheckpoint({ mission, recordedAt: AFTER });
  saveNaturalMissionContinuity({ stateRoot: root, checkpoint });
  const restored = resumeNaturalMissionContinuity({
    checkpoint: loadNaturalMissionContinuity({
      stateRoot: root,
      repositoryPath: fixture.repository
    }),
    repositoryPath: fixture.repository,
    resumedAt: RESTART
  });
  const request = createGatewayRequest({
    requestId: 'r6-stale-authority-replay',
    mission: restored.mission,
    operation: 'tests.runCanonical',
    args: {
      target: 'qualification.test.js',
      scope: { target: 'qualification.test.js' }
    },
    authorityRef: 'pre-restart-canonical-authority',
    requestedAt: RESTART
  });
  const replay = dispatchGatewayRequest({
    request,
    mission: restored.mission,
    options: { now: () => RESTART }
  });
  assert.equal(replay.result.classification, 'AUTHORITY_REQUIRED');
  assert.equal(replay.result.successful, false);
});

test('R5 pending repair survives as information and needs fresh exact authority after restart', async (t) => {
  const fixture = createHermeticGitRepository();
  const root = stateRoot();
  const authorityParent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-r6-authority-')));
  const authorityRoot = path.join(authorityParent, 'authority');
  const journalStorageRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-r6-journal-')));
  t.after(() => {
    fixture.cleanup();
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(authorityParent, { recursive: true, force: true });
    fs.rmSync(journalStorageRoot, { recursive: true, force: true });
  });
  provisionLocalOfflineHumanAuthority({
    authorityRoot,
    issuer: 'local:r6-restart-test',
    subjectId: 'r6-human'
  });
  const loop = await pendingRepair(fixture.repository);
  assert.equal(loop.state, 'AUTHORITY_REQUIRED');
  const proposalFingerprint = loop.pending.patchProposal.proposalFingerprint;
  const beforeRestart = fs.readFileSync(path.join(fixture.repository, 'impl.js'), 'utf8');
  const checkpoint = createNaturalMissionContinuityCheckpoint({
    mission: loop.mission,
    repairLoop: loop,
    recordedAt: new Date().toISOString()
  });
  saveNaturalMissionContinuity({ stateRoot: root, checkpoint });
  const restored = resumeNaturalMissionContinuity({
    checkpoint: loadNaturalMissionContinuity({
      stateRoot: root,
      repositoryPath: fixture.repository
    }),
    repositoryPath: fixture.repository,
    resumedAt: new Date().toISOString()
  });
  assert.equal(restored.classification, 'RESUMED');
  assert.equal(restored.repairLoop.state, 'AUTHORITY_REQUIRED');
  assert.equal(restored.repairLoop.durableRestart, true);
  assert.equal(restored.repairLoop.pending.patchProposal.proposalFingerprint, proposalFingerprint);
  assert.equal(restored.repairLoop.mission.authority.grants.length, 0);
  assert.equal(
    fs.readFileSync(path.join(fixture.repository, 'impl.js'), 'utf8'),
    beforeRestart,
    'restart must not apply a pending repair automatically'
  );
  const continued = authorizeAndContinueNaturalGovernedRepair(restored.repairLoop, {
    approvedProposalFingerprint: proposalFingerprint,
    authorityRoot,
    journalStorageRoot,
    tenantId: 'r6-test',
    projectId: 'restart-repair',
    at: new Date().toISOString()
  });
  assert.equal(continued.attempts.length, 1);
  assert.match(
    authoritativeContent(fixture.repository, 'impl.js'),
    /module\.exports = true/
  );
  assert.equal(continued.state, 'BLOCKED');
  assert.equal(continued.stopReason, 'AUTHORITY_REQUIRED');
  const journalBeforeSecondRestart = fs.readdirSync(journalStorageRoot, {
    recursive: true
  }).sort();
  const afterMutationCheckpoint = createNaturalMissionContinuityCheckpoint({
    mission: continued.mission,
    repairLoop: continued,
    recordedAt: new Date().toISOString()
  });
  saveNaturalMissionContinuity({
    stateRoot: root,
    checkpoint: afterMutationCheckpoint
  });
  const afterMutationRestart = resumeNaturalMissionContinuity({
    checkpoint: loadNaturalMissionContinuity({
      stateRoot: root,
      repositoryPath: fixture.repository
    }),
    repositoryPath: fixture.repository,
    resumedAt: new Date().toISOString()
  });
  assert.equal(afterMutationRestart.repairLoop.attempts.length, 1);
  assert.equal(afterMutationRestart.repairLoop.state, 'BLOCKED');
  assert.deepEqual(
    fs.readdirSync(journalStorageRoot, { recursive: true }).sort(),
    journalBeforeSecondRestart,
    'restart after one physical mutation must not dispatch a duplicate effect'
  );
});

test('offline divergence invalidates a persisted R5 proposal before any approval can apply', async (t) => {
  const fixture = createHermeticGitRepository();
  const root = stateRoot();
  t.after(() => {
    fixture.cleanup();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const loop = await pendingRepair(fixture.repository);
  const checkpoint = createNaturalMissionContinuityCheckpoint({
    mission: loop.mission,
    repairLoop: loop,
    recordedAt: new Date().toISOString()
  });
  saveNaturalMissionContinuity({ stateRoot: root, checkpoint });
  fs.writeFileSync(path.join(fixture.repository, 'impl.js'), "'use strict';\nmodule.exports = 'offline-change';\n");
  const restored = resumeNaturalMissionContinuity({
    checkpoint: loadNaturalMissionContinuity({
      stateRoot: root,
      repositoryPath: fixture.repository
    }),
    repositoryPath: fixture.repository,
    resumedAt: new Date().toISOString()
  });
  assert.equal(restored.classification, 'STATE_INVALIDATED');
  assert.equal(restored.repairLoop.state, 'BLOCKED');
  assert.equal(restored.repairLoop.pending, null);
  assert.equal(restored.repairLoop.approvalRequest, null);
});

test('two OS processes resume the production NATURAL R5 authority boundary without replay', (t) => {
  const fixture = createHermeticGitRepository();
  const root = stateRoot();
  const authorityParent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-r6-real-authority-')));
  const authorityRoot = path.join(authorityParent, 'authority');
  const journalStorageRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-r6-real-journal-')));
  t.after(() => {
    fixture.cleanup();
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(authorityParent, { recursive: true, force: true });
    fs.rmSync(journalStorageRoot, { recursive: true, force: true });
  });
  fs.writeFileSync(path.join(fixture.repository, 'impl.js'), "'use strict';\nmodule.exports = false;\n");
  fs.writeFileSync(path.join(fixture.repository, 'repair.test.js'), repairSource());
  fs.writeFileSync(path.join(fixture.repository, 'qualification.test.js'), repairSource());
  git(fixture.repository, ['add', '.']);
  git(fixture.repository, ['commit', '-m', 'R6 real restart repair fixture']);
  provisionLocalOfflineHumanAuthority({
    authorityRoot,
    issuer: 'local:r6-real-restart',
    subjectId: 'r6-real-human'
  });
  const environment = {
    ...process.env,
    SDO_NATURAL_MISSION_STATE_ROOT: root,
    SDO_NATURAL_PATCH_AUTHORITY_ROOT: authorityRoot,
    SDO_NATURAL_PATCH_JOURNAL_ROOT: journalStorageRoot
  };
  const first = spawnSync(process.execPath, [R6_REPAIR_PROCESS], {
    cwd: fixture.repository,
    env: { ...environment, SDO_R6_REPAIR_PHASE: 'PREPARE' },
    encoding: 'utf8',
    timeout: 20_000,
    maxBuffer: 4 * 1024 * 1024
  });
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const proposal = first.stdout.match(/R6_PROPOSAL=([a-f0-9]{64})/)?.[1];
  assert.ok(proposal, first.stdout);
  assert.match(authoritativeContent(fixture.repository, 'impl.js'), /module\.exports = false/);
  const second = spawnSync(process.execPath, [R6_REPAIR_PROCESS], {
    cwd: fixture.repository,
    env: {
      ...environment,
      SDO_R6_REPAIR_PHASE: 'APPROVE',
      SDO_R6_REPAIR_PROPOSAL: proposal
    },
    encoding: 'utf8',
    timeout: 20_000,
    maxBuffer: 4 * 1024 * 1024
  });
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.match(second.stdout, /Missão governada durável reconstruída/);
  assert.match(second.stdout, /Autoridade governada exata e limitada registrada/);
  assert.match(second.stdout, /tests\.runCanonical.*AUTHORITY_REQUIRED|AUTHORITY_REQUIRED[\s\S]*tests\.runCanonical/);
  assert.match(second.stdout, /State: BLOCKED/);
  assert.doesNotMatch(second.stdout, /Reparo governado iniciado/);
  assert.doesNotMatch(second.stdout, /Missão governada GREEN/);
  assert.match(authoritativeContent(fixture.repository, 'impl.js'), /module\.exports = true/);
});

test('corrupt state and cross-repository adoption fail closed', (t) => {
  const first = createHermeticGitRepository('first');
  const second = createHermeticGitRepository('second');
  const root = stateRoot();
  t.after(() => {
    first.cleanup();
    second.cleanup();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const checkpoint = createNaturalMissionContinuityCheckpoint({
    mission: progressedMission(first.repository),
    recordedAt: AFTER
  });
  saveNaturalMissionContinuity({ stateRoot: root, checkpoint });
  assert.throws(() => resumeNaturalMissionContinuity({
    checkpoint,
    repositoryPath: second.repository,
    resumedAt: RESTART
  }), /another repository|workspace/i);
  const file = path.join(root, fs.readdirSync(root).find((name) => name.endsWith('.json')));
  fs.writeFileSync(file, '{"schema":');
  assert.throws(() => loadNaturalMissionContinuity({
    stateRoot: root,
    repositoryPath: first.repository
  }), /malformed|truncated|JSON|continuity/i);
});

test('durable bytes contain no reusable authority and unsafe storage shapes fail closed', (t) => {
  const fixture = createHermeticGitRepository();
  const root = stateRoot();
  const symlinkParent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-r6-symlink-')));
  const symlinkRoot = path.join(symlinkParent, 'continuity-link');
  fs.symlinkSync(root, symlinkRoot, 'dir');
  t.after(() => {
    fixture.cleanup();
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(symlinkParent, { recursive: true, force: true });
  });
  const mission = progressedMission(fixture.repository, { grant: true });
  const checkpoint = createNaturalMissionContinuityCheckpoint({ mission, recordedAt: AFTER });
  assert.equal(checkpoint.authoritySerialized, false);
  const serialized = JSON.stringify(checkpoint);
  assert.doesNotMatch(serialized, /pre-restart-canonical-authority/);
  assert.doesNotMatch(serialized, /authorizationFingerprint/);
  assert.throws(() => saveNaturalMissionContinuity({
    stateRoot: symlinkRoot,
    checkpoint
  }), /symbolic link|unsafe/i);

  saveNaturalMissionContinuity({ stateRoot: root, checkpoint });
  const target = path.join(root, fs.readdirSync(root).find((name) => name.endsWith('.json')));
  const contaminated = fs.readFileSync(target, 'utf8').replace(
    '"mission": {',
    '"mission": {"__proto__": {},'
  );
  fs.writeFileSync(target, contaminated);
  assert.throws(() => loadNaturalMissionContinuity({
    stateRoot: root,
    repositoryPath: fixture.repository
  }), /unsafe object key|malformed/i);
  fs.writeFileSync(target, Buffer.alloc(2 * 1024 * 1024 + 1, 0x20));
  assert.throws(() => loadNaturalMissionContinuity({
    stateRoot: root,
    repositoryPath: fixture.repository
  }), /size bound|unsafe/i);
});

test('sensitive pending repair content is never admitted to durable continuity', async (t) => {
  const fixture = createHermeticGitRepository();
  t.after(() => fixture.cleanup());
  const loop = await pendingRepair(
    fixture.repository,
    "'use strict';\nconst api_key=super-secret-value;\nmodule.exports = true;\n"
  );
  assert.throws(() => createNaturalMissionContinuityCheckpoint({
    mission: loop.mission,
    repairLoop: loop,
    recordedAt: new Date().toISOString()
  }), /sensitive content/i);
});

test('a newer durable mission record rejects rollback to an older event boundary', (t) => {
  const fixture = createHermeticGitRepository();
  const root = stateRoot();
  t.after(() => {
    fixture.cleanup();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const mission = progressedMission(fixture.repository);
  const older = createNaturalMissionContinuityCheckpoint({ mission, recordedAt: AFTER });
  saveNaturalMissionContinuity({ stateRoot: root, checkpoint: older });
  const resumed = resumeNaturalMissionContinuity({
    checkpoint: older,
    repositoryPath: fixture.repository,
    resumedAt: RESTART
  });
  const newer = createNaturalMissionContinuityCheckpoint({
    mission: resumed.mission,
    recordedAt: RESTART
  });
  saveNaturalMissionContinuity({ stateRoot: root, checkpoint: newer });
  assert.throws(() => saveNaturalMissionContinuity({
    stateRoot: root,
    checkpoint: older
  }), /rollback/i);
});

test('a later explicit objective replaces repository continuity without inheriting authority', (t) => {
  const fixture = createHermeticGitRepository();
  const root = stateRoot();
  t.after(() => {
    fixture.cleanup();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const first = progressedMission(fixture.repository, { grant: true });
  saveNaturalMissionContinuity({
    stateRoot: root,
    checkpoint: createNaturalMissionContinuityCheckpoint({
      mission: first,
      recordedAt: AFTER
    })
  });
  const nextAt = '2099-02-01T00:00:03.000Z';
  const session = createDeterministicWorkspaceSession({
    authorizedRoot: fixture.repository,
    humanSubject: 'r6-new-objective-human',
    authorizedAt: nextAt
  });
  const next = createNaturalAgenticMission({
    missionId: 'r6-explicit-later-objective',
    objective: 'A new explicit objective with no inherited authority.',
    session,
    createdAt: nextAt,
    plan: []
  });
  saveNaturalMissionContinuity({
    stateRoot: root,
    checkpoint: createNaturalMissionContinuityCheckpoint({
      mission: next,
      recordedAt: nextAt
    })
  });
  const loaded = loadNaturalMissionContinuity({
    stateRoot: root,
    repositoryPath: fixture.repository
  });
  assert.equal(loaded.missionId, next.missionId);
  assert.equal(loaded.mission.authority.grants.length, 0);
  assert.equal(loaded.mission.authority.usedAuthorityRefs.length, 0);
  assert.doesNotMatch(JSON.stringify(loaded), /pre-restart-canonical-authority/);
});

test('completed GREEN is historical and is not emitted or executed again after restart', (t) => {
  const fixture = createHermeticGitRepository();
  const root = stateRoot();
  t.after(() => {
    fixture.cleanup();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const session = createDeterministicWorkspaceSession({
    authorizedRoot: fixture.repository,
    humanSubject: 'r6-green-human',
    authorizedAt: START
  });
  let mission = createNaturalAgenticMission({
    missionId: 'r6-completed-green',
    objective: 'Preserve historical GREEN without replay.',
    session,
    createdAt: START
  });
  mission = qualifyNaturalAgenticMissionGreen(mission, {
    canonicalEvidence: {
      selector: 'NODE_TEST_FILE',
      target: 'qualification.test.js',
      classification: 'PASSED',
      testsDiscovered: 1,
      passed: 1,
      failed: 0,
      skipped: 0,
      canonical: true,
      evidenceDigest: 'a'.repeat(64)
    },
    at: AFTER
  });
  const greenEvents = mission.events.filter((event) => event.type === 'MISSION_GREEN').length;
  const checkpoint = createNaturalMissionContinuityCheckpoint({ mission, recordedAt: AFTER });
  saveNaturalMissionContinuity({ stateRoot: root, checkpoint });
  const restored = resumeNaturalMissionContinuity({
    checkpoint: loadNaturalMissionContinuity({
      stateRoot: root,
      repositoryPath: fixture.repository
    }),
    repositoryPath: fixture.repository,
    resumedAt: RESTART
  });
  assert.equal(restored.classification, 'HISTORICAL_GREEN');
  assert.equal(restored.mission.state, 'GREEN');
  assert.equal(
    restored.mission.events.filter((event) => event.type === 'MISSION_GREEN').length,
    greenEvents
  );
  assert.equal(restored.mission.events.length, mission.events.length);
  assert.equal(restored.continuationEligible, false);
  fs.writeFileSync(path.join(fixture.repository, 'package-lock.json'), '{"afterGreen":true}\n');
  const invalidated = resumeNaturalMissionContinuity({
    checkpoint,
    repositoryPath: fixture.repository,
    resumedAt: RESTART
  });
  assert.equal(invalidated.classification, 'STATE_INVALIDATED');
  assert.equal(invalidated.mission.state, 'BLOCKED');
  assert.equal(invalidated.mission.events.at(-1).type, 'STATE_INVALIDATED');
  assert.equal(
    invalidated.mission.events.filter((event) => event.type === 'MISSION_GREEN').length,
    greenEvents
  );
});

test('two real NATURAL processes reconstruct and continue one physical mission', (t) => {
  const fixture = createHermeticGitRepository();
  const root = stateRoot();
  t.after(() => {
    fixture.cleanup();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const first = runNatural(fixture.repository, root, [
    'qual é o estado deste projeto?',
    '/status',
    'exit'
  ]);
  assert.equal(first.status, 0, first.stderr);
  const missionId = first.stdout.match(/Mission: ([^\n]+)/)?.[1];
  assert.ok(missionId, first.stdout);
  assert.ok(fs.readdirSync(root).some((name) => name.endsWith('.json')));

  const second = runNatural(fixture.repository, root, [
    '/status',
    '/plan',
    'continue',
    '/status',
    'exit'
  ]);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /Missão governada durável reconstruída|Durable governed mission reconstructed/);
  assert.match(second.stdout, new RegExp(`Mission: ${missionId}`));
  assert.match(second.stdout, /WORKSPACE_VALIDATED|Workspace governado validado/);
  assert.match(second.stdout, /Continuation: ELIGIBLE/);
  assert.match(second.stdout, /Operação governada iniciada: evidence\.inspect/);
  assert.doesNotMatch(second.stdout, /Operação governada iniciada: workspace\.status/);
});

test('a second real process detects offline divergence without replaying history', (t) => {
  const fixture = createHermeticGitRepository();
  const root = stateRoot();
  t.after(() => {
    fixture.cleanup();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const first = runNatural(fixture.repository, root, [
    'qual é o estado deste projeto?',
    'exit'
  ]);
  assert.equal(first.status, 0, first.stderr);
  fs.writeFileSync(path.join(fixture.repository, 'package-lock.json'), '{"offline":true}\n');
  const second = runNatural(fixture.repository, root, [
    '/status',
    'continue',
    'exit'
  ]);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /STATE_INVALIDATED|Estado governado invalidado/);
  assert.match(second.stdout, /State: BLOCKED/);
  assert.doesNotMatch(second.stdout, /Operação governada concluída: SUCCESS/);
  assert.doesNotMatch(second.stdout, /MISSION_GREEN/);
});
