'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const {
  provisionLocalOfflineHumanAuthority
} = require('../../accelerator/core/local-offline-human-authority-store');
const {
  materializeGovernedEngineeringProposal
} = require('../../accelerator/core/governed-engineering-proposal');
const {
  createDeterministicWorkspaceSession
} = require('../../accelerator/adapters/deterministic-workspace-session-adapter');
const {
  createGatewayRequest,
  dispatchGatewayRequest
} = require('../../accelerator/core/integrated-governed-agent-gateway');
const {
  prepareInteractiveNaturalDevelopment
} = require('../../accelerator/cli/natural-development-interactive');
const {
  deriveLocalNaturalDevelopmentAuthorizationFromRepairMission
} = require('../../accelerator/cli/natural-development-local-authorization');
const {
  createNaturalGovernedRepairLoop,
  investigateNaturalGovernedRepairFailure,
  authorizeNaturalGovernedRepairMission,
  proposeNaturalGovernedRepair,
  continueNaturalGovernedRepairWithMissionAuthority,
  cancelNaturalGovernedRepairLoop,
  prepareNaturalGovernedRepairLoopForDurableRestart
} = require('../../accelerator/cli/natural-governed-repair-loop');

const OBJECTIVE =
  'Repair first.js and second.js, test repair.test.js, and qualify qualification.test.js.';

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function git(repository, args) {
  return execFileSync('git', args, {
    cwd: repository,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function now() {
  return new Date().toISOString();
}

function testSource() {
  return (
    "'use strict';\n" +
    "const assert = require('node:assert/strict');\n" +
    "const crypto = require('node:crypto');\n" +
    "const fs = require('node:fs');\n" +
    "const path = require('node:path');\n" +
    "const test = require('node:test');\n" +
    "function exported(relative) {\n" +
    "  const key = crypto.createHash('sha256').update(relative).digest('hex');\n" +
    "  const ref = path.join(process.cwd(), '.git', 'refs', 'surgical-devops', 'workspace', key);\n" +
    "  const source = fs.existsSync(ref)\n" +
    "    ? fs.readFileSync(path.join(process.cwd(), '.git', 'surgical-devops', 'materialized', key, fs.readFileSync(ref, 'utf8').trim() + '.blob'), 'utf8')\n" +
    "    : fs.readFileSync(path.join(process.cwd(), relative), 'utf8');\n" +
    "  return /module\\.exports\\s*=\\s*true/.test(source);\n" +
    "}\n" +
    "test('bounded repair', () => {\n" +
    "  assert.equal(exported('first.js'), true);\n" +
    "  assert.equal(exported('second.js'), true);\n" +
    "});\n"
  );
}

function fixture(label = 'primary') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `sdo-mission-auth-${label}-`));
  const repository = path.join(root, 'repository');
  const authorityRoot = path.join(root, 'authority');
  const journalStorageRoot = path.join(root, 'journal');
  fs.mkdirSync(repository);
  fs.mkdirSync(journalStorageRoot);
  fs.writeFileSync(path.join(repository, 'first.js'), "'use strict';\nmodule.exports = false;\n");
  fs.writeFileSync(path.join(repository, 'second.js'), "'use strict';\nmodule.exports = false;\n");
  fs.writeFileSync(path.join(repository, 'repair.test.js'), testSource());
  fs.writeFileSync(path.join(repository, 'qualification.test.js'), testSource());
  git(repository, ['init', '-b', 'main']);
  git(repository, ['config', 'user.name', 'Mission Authority Adversary']);
  git(repository, ['config', 'user.email', 'authority-adversary@surgical.invalid']);
  git(repository, ['add', '.']);
  git(repository, ['commit', '-m', 'authority adversarial fixture']);
  provisionLocalOfflineHumanAuthority({
    authorityRoot,
    issuer: `local:mission-authority-${label}`,
    subjectId: 'mission-authority-human'
  });
  return {
    root,
    repository: fs.realpathSync(repository),
    authorityRoot: fs.realpathSync(authorityRoot),
    journalStorageRoot: fs.realpathSync(journalStorageRoot),
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
}

function loopFor(state, attemptCeiling = 2) {
  const at = now();
  return createNaturalGovernedRepairLoop({
    objective: OBJECTIVE,
    session: createDeterministicWorkspaceSession({
      authorizedRoot: state.repository,
      humanSubject: 'mission-authority-human',
      authorizedAt: at
    }),
    allowedTargets: ['first.js', 'second.js'],
    testTarget: 'repair.test.js',
    qualificationTarget: 'qualification.test.js',
    attemptCeiling,
    createdAt: at
  });
}

function investigateAndAuthorize(state, attemptCeiling = 2) {
  let loop = investigateNaturalGovernedRepairFailure(
    loopFor(state, attemptCeiling),
    { at: now() }
  );
  loop = authorizeNaturalGovernedRepairMission(loop, {
    approvedAuthorityRequestFingerprint:
      loop.missionAuthorityRequest.authorityRequestFingerprint,
    authorityRoot: state.authorityRoot,
    journalStorageRoot: state.journalStorageRoot,
    tenantId: 'mission-authority-adversarial',
    projectId: 'acceptance-a',
    at: now()
  });
  return loop;
}

async function pendingFor(state, loop, target, replacement = true) {
  const before = fs.readFileSync(path.join(state.repository, target));
  let reads = 0;
  return prepareInteractiveNaturalDevelopment({
    request: { objective: loop.objective, target },
    activation: {
      workspace: 'mission-authority-adversarial',
      repositoryPath: state.repository,
      interactionMode: { mode: 'NATURAL' },
      language: 'en'
    },
    cognitiveSession: Object.freeze({
      async decideEvidence() {
        reads += 1;
        return reads === 1
          ? Object.freeze({
              schema: 'sdo.natural_evidence_decision.v1',
              decision: 'REQUEST_EVIDENCE',
              response: null,
              evidenceRequest: Object.freeze({
                kind: 'READ_FILE',
                target,
                reason: 'Bind exact current evidence.'
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
          target,
          beforeSha256: sha(before),
          replacementBase64: Buffer.from(
            `'use strict';\nmodule.exports = ${replacement};\n`
          ).toString('base64'),
          reason: `Bounded repair for ${target}.`,
          validationKind: 'VALIDATE_JS'
        });
      }
    }),
    workMode: 'BOUNDED_AUTONOMY_TO_BOUNDARY',
    patchAttempt: loop.attempts.length + 1
  });
}

test('envelope is exact process-local human evidence and grants no shell Git network credential or remote authority', (t) => {
  const state = fixture('envelope');
  t.after(state.cleanup);
  let loop = investigateNaturalGovernedRepairFailure(loopFor(state), { at: now() });
  const request = loop.missionAuthorityRequest;
  assert.equal(Object.isFrozen(request), true);
  assert.equal(request.repositoryPath, state.repository);
  assert.equal(request.missionId, loop.mission.missionId);
  assert.equal(request.operation, 'mutation.applyConditional');
  assert.equal(request.mutationClass, 'EXACT_FULL_FILE_REPLACEMENT_R3');
  assert.deepEqual(request.allowedTargets, ['first.js', 'second.js']);
  assert.equal(request.riskCeiling, 'R3');
  assert.equal(request.processLocal, true);
  assert.equal(request.durableRestart, false);
  assert.equal(request.reusableApproval, false);
  assert.equal(request.operationalAuthority, false);
  assert.equal(request.mutationAuthority, false);
  assert.equal(request.gitAuthority, false);
  assert.equal(request.remoteAuthority, false);
  for (const denied of [
    'arbitrary.shell', 'credential.read', 'network.mutate', 'git.stage',
    'git.commit', 'git.push', 'git.merge', 'git.tag', 'release.create',
    'npm.publish', 'deploy'
  ]) {
    assert.equal(request.deniedCapabilities.includes(denied), true, denied);
  }
  assert.throws(
    () => authorizeNaturalGovernedRepairMission(loop, {
      approvedAuthorityRequestFingerprint: '0'.repeat(64),
      authorityRoot: state.authorityRoot,
      journalStorageRoot: state.journalStorageRoot,
      at: now()
    }),
    /fingerprint/
  );
  loop = authorizeNaturalGovernedRepairMission(loop, {
    approvedAuthorityRequestFingerprint: request.authorityRequestFingerprint,
    authorityRoot: state.authorityRoot,
    journalStorageRoot: state.journalStorageRoot,
    tenantId: 'mission-authority-adversarial',
    projectId: 'acceptance-a',
    at: now()
  });
  const authority = loop.missionMutationAuthority;
  assert.equal(Object.isFrozen(authority), true);
  for (const field of [
    'operationalAuthority', 'mutationAuthority', 'approvalAuthority',
    'dispatchAuthority', 'shellAuthority', 'gitAuthority',
    'networkAuthority', 'credentialAuthority', 'remoteAuthority'
  ]) {
    assert.equal(authority[field], false, field);
  }
  const canonicalGrant = loop.mission.authority.grants.find(
    (grant) => grant.authorityRef === authority.authorityFingerprint
  );
  assert.equal(canonicalGrant.lifetime, 'MISSION_SCOPED');
  assert.equal(canonicalGrant.scope.brokerOnly, true);
  const direct = dispatchGatewayRequest({
    request: createGatewayRequest({
      requestId: `${loop.mission.missionId}-broker-only-direct-use`,
      mission: loop.mission,
      operation: 'mutation.applyConditional',
      args: {
        scope: canonicalGrant.scope,
        targetCas: {
          target: 'first.js',
          beforeSha256: sha(fs.readFileSync(path.join(state.repository, 'first.js')))
        }
      },
      authorityRef: canonicalGrant.authorityRef,
      requestedAt: now()
    }),
    mission: loop.mission,
    options: { now }
  });
  assert.equal(direct.result.classification, 'AUTHORITY_REQUIRED');
  assert.equal(
    fs.readFileSync(path.join(state.repository, 'first.js'), 'utf8'),
    "'use strict';\nmodule.exports = false;\n"
  );
});

test('provider-shaped clones, other missions, outside scope, and proposal replay cannot derive mutation authority', async (t) => {
  const primary = fixture('primary');
  const foreign = fixture('foreign');
  t.after(primary.cleanup);
  t.after(foreign.cleanup);
  let loop = investigateAndAuthorize(primary);
  const pending = await pendingFor(primary, loop, 'first.js');
  loop = proposeNaturalGovernedRepair(loop, { pending, at: now() });
  const widenedLoop = Object.freeze({
    ...loop,
    allowedTargets: Object.freeze([...loop.allowedTargets, 'outside.js'])
  });
  assert.throws(
    () => continueNaturalGovernedRepairWithMissionAuthority(widenedLoop, {
      authorityRoot: primary.authorityRoot,
      journalStorageRoot: primary.journalStorageRoot,
      at: now()
    }),
    /differs from sovereign mission state/
  );
  const derive = (missionAuthority, mission, patchProposal) =>
    deriveLocalNaturalDevelopmentAuthorizationFromRepairMission({
      missionAuthority,
      mission,
      patchProposal,
      authorityRoot: primary.authorityRoot,
      journalStorageRoot: primary.journalStorageRoot,
      tenantId: 'mission-authority-adversarial',
      projectId: 'acceptance-a'
    });
  const providerClone = Object.freeze(JSON.parse(JSON.stringify(loop.missionMutationAuthority)));
  assert.throws(
    () => derive(providerClone, loop.mission, pending.patchProposal),
    /process-local/
  );
  const foreignMission = investigateAndAuthorize(foreign).mission;
  assert.throws(
    () => derive(loop.missionMutationAuthority, foreignMission, pending.patchProposal),
    /outside the current mission/
  );
  const outside = Object.freeze({ ...pending.patchProposal, target: 'outside.js' });
  assert.throws(
    () => derive(loop.missionMutationAuthority, loop.mission, outside),
    /outside the current mission/
  );
  assert.throws(
    () => deriveLocalNaturalDevelopmentAuthorizationFromRepairMission({
      missionAuthority: loop.missionMutationAuthority,
      mission: loop.mission,
      patchProposal: pending.patchProposal,
      authorityRoot: primary.authorityRoot,
      journalStorageRoot: primary.journalStorageRoot,
      tenantId: 'different-tenant',
      projectId: 'acceptance-a'
    }),
    /tenancy or project binding changed/
  );
  const authority = derive(
    loop.missionMutationAuthority,
    loop.mission,
    pending.patchProposal
  );
  assert.equal(authority.singleUse, true);
  assert.equal(authority.reusableApproval, false);
  assert.throws(
    () => derive(loop.missionMutationAuthority, loop.mission, pending.patchProposal),
    /replay/
  );
});

test('unexpected physical divergence blocks stale mission mutation and invalidates the envelope', async (t) => {
  const state = fixture('stale');
  t.after(state.cleanup);
  let loop = investigateAndAuthorize(state);
  const pending = await pendingFor(state, loop, 'first.js');
  loop = proposeNaturalGovernedRepair(loop, { pending, at: now() });
  const divergent = "'use strict';\nmodule.exports = 'external';\n";
  fs.writeFileSync(path.join(state.repository, 'first.js'), divergent);
  loop = continueNaturalGovernedRepairWithMissionAuthority(loop, {
    authorityRoot: state.authorityRoot,
    journalStorageRoot: state.journalStorageRoot,
    tenantId: 'mission-authority-adversarial',
    projectId: 'acceptance-a',
    at: now()
  });
  assert.equal(loop.state, 'BLOCKED');
  assert.equal(loop.missionMutationAuthority, null);
  assert.equal(loop.missionAuthorityRequest, null);
  assert.equal(fs.readFileSync(path.join(state.repository, 'first.js'), 'utf8'), divergent);
  assert.equal(loop.attempts.length, 0);
  assert.throws(
    () => continueNaturalGovernedRepairWithMissionAuthority(loop, {
      authorityRoot: state.authorityRoot,
      journalStorageRoot: state.journalStorageRoot,
      at: now()
    }),
    /No bounded mission-authorized/
  );
});

test('unexpected HEAD divergence invalidates mission authority before mutation', async (t) => {
  const state = fixture('head');
  t.after(state.cleanup);
  let loop = investigateAndAuthorize(state);
  const pending = await pendingFor(state, loop, 'first.js');
  loop = proposeNaturalGovernedRepair(loop, { pending, at: now() });
  fs.writeFileSync(path.join(state.repository, 'external.txt'), 'external HEAD\n');
  git(state.repository, ['add', 'external.txt']);
  git(state.repository, ['commit', '-m', 'external head divergence']);
  loop = continueNaturalGovernedRepairWithMissionAuthority(loop, {
    authorityRoot: state.authorityRoot,
    journalStorageRoot: state.journalStorageRoot,
    tenantId: 'mission-authority-adversarial',
    projectId: 'acceptance-a',
    at: now()
  });
  assert.equal(loop.state, 'BLOCKED');
  assert.equal(loop.stopReason, 'STALE_STATE');
  assert.equal(loop.missionMutationAuthority, null);
  assert.equal(
    fs.readFileSync(path.join(state.repository, 'first.js'), 'utf8'),
    "'use strict';\nmodule.exports = false;\n"
  );
});

test('GREEN CANCELLED exhaustion and restart all terminate process-local mission authority', async (t) => {
  const cancelledState = fixture('cancelled');
  const exhaustedState = fixture('exhausted');
  const restartState = fixture('restart');
  t.after(cancelledState.cleanup);
  t.after(exhaustedState.cleanup);
  t.after(restartState.cleanup);

  let cancelled = investigateAndAuthorize(cancelledState);
  const cancelledFingerprint = cancelled.missionMutationAuthority.authorityFingerprint;
  const capturedCancelledAuthority = cancelled.missionMutationAuthority;
  const capturedCancelledMission = cancelled.mission;
  const cancelledProposal = (
    await pendingFor(cancelledState, cancelled, 'first.js')
  ).patchProposal;
  cancelled = cancelNaturalGovernedRepairLoop(cancelled, { at: now() });
  assert.equal(cancelled.state, 'CANCELLED');
  assert.equal(cancelled.missionMutationAuthority, null);
  assert.throws(
    () => continueNaturalGovernedRepairWithMissionAuthority(cancelled, {
      authorityRoot: cancelledState.authorityRoot,
      journalStorageRoot: cancelledState.journalStorageRoot,
      tenantId: 'mission-authority-adversarial',
      projectId: 'acceptance-a',
      at: now()
    }),
    /No bounded mission-authorized/
  );
  assert.throws(
    () => deriveLocalNaturalDevelopmentAuthorizationFromRepairMission({
      missionAuthority: capturedCancelledAuthority,
      mission: capturedCancelledMission,
      patchProposal: cancelledProposal,
      authorityRoot: cancelledState.authorityRoot,
      journalStorageRoot: cancelledState.journalStorageRoot,
      tenantId: 'mission-authority-adversarial',
      projectId: 'acceptance-a'
    }),
    /process-local/
  );

  let exhausted = investigateAndAuthorize(exhaustedState, 1);
  exhausted = proposeNaturalGovernedRepair(exhausted, {
    pending: await pendingFor(exhaustedState, exhausted, 'first.js'),
    at: now()
  });
  exhausted = continueNaturalGovernedRepairWithMissionAuthority(exhausted, {
    authorityRoot: exhaustedState.authorityRoot,
    journalStorageRoot: exhaustedState.journalStorageRoot,
    tenantId: 'mission-authority-adversarial',
    projectId: 'acceptance-a',
    at: now()
  });
  assert.equal(exhausted.state, 'BLOCKED');
  assert.equal(
    exhausted.stopReason,
    'PATCH_ATTEMPT_BOUND_REACHED',
    exhausted.lastDispatch && exhausted.lastDispatch.result
      ? `${exhausted.lastDispatch.result.operation}: ${exhausted.lastDispatch.result.reason}`
      : 'missing dispatch evidence'
  );
  assert.equal(exhausted.missionMutationAuthority, null);

  const restartable = investigateAndAuthorize(restartState);
  const restartFingerprint = restartable.missionMutationAuthority.authorityFingerprint;
  const durable = prepareNaturalGovernedRepairLoopForDurableRestart(restartable);
  const bytes = JSON.stringify(durable);
  assert.equal(durable.missionMutationAuthority, null);
  assert.equal(durable.missionAuthorityRequest, null);
  assert.equal(durable.processLocal, false);
  assert.equal(durable.durableRestart, true);
  assert.equal(bytes.includes(restartFingerprint), false);
  assert.equal(
    bytes.includes('sdo.natural_repair_mission_authority.v1'),
    false
  );
  assert.equal(bytes.includes(cancelledFingerprint), false);
  assert.equal(bytes.includes('PRIVATE KEY'), false);
});

test('traversal and symlink escape never become bounded mutation targets', async (t) => {
  const state = fixture('path');
  t.after(state.cleanup);
  const at = now();
  const session = createDeterministicWorkspaceSession({
    authorizedRoot: state.repository,
    humanSubject: 'mission-authority-human',
    authorizedAt: at
  });
  assert.throws(
    () => createNaturalGovernedRepairLoop({
      objective: OBJECTIVE,
      session,
      allowedTargets: ['../escape.js'],
      testTarget: 'repair.test.js',
      qualificationTarget: 'qualification.test.js',
      createdAt: at
    }),
    /outside the bounded workspace/
  );
  const outside = path.join(state.root, 'outside.js');
  fs.writeFileSync(outside, "module.exports = 'outside';\n");
  fs.symlinkSync(outside, path.join(state.repository, 'linked.js'));
  const loop = createNaturalGovernedRepairLoop({
    objective: 'Repair linked.js without leaving this repository.',
    session: createDeterministicWorkspaceSession({
      authorizedRoot: state.repository,
      humanSubject: 'mission-authority-human',
      authorizedAt: now()
    }),
    allowedTargets: ['linked.js'],
    testTarget: 'repair.test.js',
    qualificationTarget: 'qualification.test.js',
    createdAt: now()
  });
  await assert.rejects(
    () => pendingFor(state, loop, 'linked.js'),
    /symbolic|symlink|outside|workspace|clean worktree/i
  );
  assert.equal(fs.readFileSync(outside, 'utf8'), "module.exports = 'outside';\n");
});
