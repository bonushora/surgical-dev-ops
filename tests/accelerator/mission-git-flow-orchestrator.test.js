'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');
const {
  createNaturalAgenticMission,
  recordNaturalAgenticMissionChange,
  qualifyNaturalAgenticMissionGreen
} = require('../../accelerator/core/natural-agentic-mission');
const {
  createGitFlowAuthorization
} = require('../../accelerator/core/git-flow-contract');
const {
  createGovernedGitFlowRunner
} = require('../../accelerator/adapters/governed-git-flow-runner');
const {
  createGovernedMissionGitFlowOrchestrator
} = require('../../accelerator/adapters/governed-mission-git-flow-orchestrator');

const OBJECTIVE = 'Apply one governed fixture change and close the mission safely.';

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-mission-git-flow-')));
  const repository = path.join(root, 'repository');
  const remote = path.join(root, 'remote.git');
  fs.mkdirSync(repository);
  git(repository, ['init', '-b', 'main']);
  git(repository, ['config', 'user.name', 'Mission Git Flow Test']);
  git(repository, ['config', 'user.email', 'mission-git-flow@surgical.invalid']);
  fs.writeFileSync(path.join(repository, 'authorized.txt'), 'baseline\n');
  git(repository, ['add', 'authorized.txt']);
  git(repository, ['commit', '-m', 'baseline']);
  git(root, ['init', '--bare', remote]);
  git(repository, ['remote', 'add', 'origin', remote]);
  git(repository, ['push', '-u', 'origin', 'main']);
  const baseline = git(repository, ['rev-parse', 'HEAD']);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, repository: fs.realpathSync(repository), remote, baseline };
}

function greenMission(fx) {
  const session = freeze({
    schema: 'sdo.deterministic_workspace_session.v1',
    physical: { root: fx.repository },
    physicalWorkspaceIdentity: sha(`workspace:${fx.repository}`),
    repositoryHead: fx.baseline,
    worktreeFingerprint: sha('baseline-worktree'),
    sessionFingerprint: sha(`session:${fx.repository}`),
    operationalAuthority: false,
    mutationAuthority: false
  });
  let mission = createNaturalAgenticMission({
    missionId: `mission-${sha(fx.repository)}`,
    objective: OBJECTIVE,
    session,
    createdAt: '2026-11-10T12:00:00.000Z',
    plan: [{
      stepId: 'repair',
      summary: 'Apply the governed fixture change.',
      status: 'COMPLETED',
      operation: 'mutation.applyConditional',
      resultClass: 'SUCCESS'
    }]
  });
  mission = recordNaturalAgenticMissionChange(mission, {
    target: 'authorized.txt',
    summary: 'Bounded fixture change.',
    beforeSha256: sha('baseline\n'),
    afterSha256: sha('authorized mission change\n'),
    at: '2026-11-10T12:01:00.000Z'
  });
  return qualifyNaturalAgenticMissionGreen(mission, {
    at: '2026-11-10T12:02:00.000Z',
    canonicalEvidence: {
      selector: 'npm test',
      target: 'tests/accelerator/*.test.js',
      classification: 'PASSED',
      testsDiscovered: 1,
      passed: 1,
      failed: 0,
      skipped: 0,
      canonical: true,
      evidenceDigest: sha('canonical-green')
    }
  });
}

function authorization(fx, overrides = {}) {
  const authorityOverrides = overrides.authorities || {};
  return createGitFlowAuthorization({
    authorizationId: overrides.authorizationId || `closure-${crypto.randomUUID()}`,
    objective: overrides.objective || OBJECTIVE,
    workspace: fx.repository,
    environment: 'localhost',
    risk: 'MÉDIO',
    authorizedFiles: overrides.authorizedFiles || ['authorized.txt'],
    validation: overrides.validation || [
      [process.execPath, '-e', 'process.exit(0)'],
      [process.execPath, '-e', 'process.exit(0)']
    ],
    remote: {
      name: 'origin',
      url: fx.remote,
      branch: 'main',
      expectedSha: fx.baseline
    },
    expectedHead: fx.baseline,
    authorities: {
      COMMIT_AUTHORIZED: authorityOverrides.COMMIT_AUTHORIZED ?? true,
      PUSH_AUTHORIZED: authorityOverrides.PUSH_AUTHORIZED ?? true,
      DISCLOSURE_AUTHORIZED: authorityOverrides.DISCLOSURE_AUTHORIZED ?? true
    }
  });
}

function writeChange(fx) {
  fs.writeFileSync(path.join(fx.repository, 'authorized.txt'), 'authorized mission change\n');
}

test('GREEN mission plus independent Git authority reaches distinct local and remote GREEN states', (t) => {
  const fx = fixture(t);
  const mission = greenMission(fx);
  const auth = authorization(fx);
  writeChange(fx);
  const orchestrator = createGovernedMissionGitFlowOrchestrator();
  const eligible = orchestrator.prepare({ mission, authorization: auth });
  assert.equal(eligible.state, 'ELIGIBLE');
  assert.equal(eligible.missionGreenIsGitAuthority, false);
  assert.equal(eligible.authorityCopiedFromMission, false);

  const local = orchestrator.commit({
    closure: eligible,
    mission,
    authorization: auth,
    message: 'test(mission): close local fixture'
  });
  assert.equal(local.state, 'LOCAL_GREEN');
  assert.equal(local.localGreen, true);
  assert.equal(local.remoteGreen, false);
  assert.equal(git(fx.root, ['--git-dir', fx.remote, 'rev-parse', 'refs/heads/main']), fx.baseline);

  const remote = orchestrator.publish({ closure: local, mission, authorization: auth });
  assert.equal(remote.state, 'REMOTE_GREEN');
  assert.equal(remote.commitSha, local.commitSha);
  assert.equal(remote.snapshot.estado_green.publicacao, 'PASSOU');
  assert.equal(git(fx.root, ['--git-dir', fx.remote, 'rev-parse', 'refs/heads/main']), local.commitSha);
});

test('mission GREEN cannot mint missing COMMIT_AUTHORIZED', (t) => {
  const fx = fixture(t);
  const mission = greenMission(fx);
  const auth = authorization(fx, { authorities: { COMMIT_AUTHORIZED: false } });
  writeChange(fx);
  const orchestrator = createGovernedMissionGitFlowOrchestrator();
  const closure = orchestrator.prepare({ mission, authorization: auth });
  const observed = orchestrator.commit({
    closure,
    mission,
    authorization: auth,
    message: 'must remain blocked'
  });
  assert.equal(observed.state, 'BLOCKED');
  assert.match(observed.reason, /COMMIT_AUTHORIZED/);
  assert.equal(git(fx.repository, ['rev-parse', 'HEAD']), fx.baseline);
});

test('local GREEN cannot mint PUSH_AUTHORIZED or DISCLOSURE_AUTHORIZED', (t) => {
  for (const authorities of [
    { PUSH_AUTHORIZED: false, DISCLOSURE_AUTHORIZED: true },
    { PUSH_AUTHORIZED: true, DISCLOSURE_AUTHORIZED: false }
  ]) {
    const fx = fixture(t);
    const mission = greenMission(fx);
    const auth = authorization(fx, { authorities });
    writeChange(fx);
    const orchestrator = createGovernedMissionGitFlowOrchestrator();
    const local = orchestrator.commit({
      closure: orchestrator.prepare({ mission, authorization: auth }),
      mission,
      authorization: auth,
      message: 'test(mission): local only'
    });
    assert.equal(local.state, 'LOCAL_GREEN');
    const blocked = orchestrator.publish({ closure: local, mission, authorization: auth });
    assert.equal(blocked.state, 'BLOCKED');
    assert.match(blocked.reason, /AUTHORIZED/);
    assert.equal(git(fx.root, ['--git-dir', fx.remote, 'rev-parse', 'refs/heads/main']), fx.baseline);
  }
});

test('mission changes and Git allowlist must match exactly', (t) => {
  const fx = fixture(t);
  const mission = greenMission(fx);
  const auth = authorization(fx, { authorizedFiles: ['outside.txt'] });
  assert.throws(
    () => createGovernedMissionGitFlowOrchestrator().prepare({ mission, authorization: auth }),
    /allowlist must exactly match/
  );
});

test('failing validation blocks closure without a commit', (t) => {
  const fx = fixture(t);
  const mission = greenMission(fx);
  const auth = authorization(fx, { validation: [
    [process.execPath, '-e', 'process.exit(0)'],
    [process.execPath, '-e', 'process.exit(9)']
  ] });
  writeChange(fx);
  const orchestrator = createGovernedMissionGitFlowOrchestrator();
  const blocked = orchestrator.commit({
    closure: orchestrator.prepare({ mission, authorization: auth }),
    mission,
    authorization: auth,
    message: 'must fail validation'
  });
  assert.equal(blocked.state, 'BLOCKED');
  assert.match(blocked.reason, /validation failed/);
  assert.equal(git(fx.repository, ['rev-parse', 'HEAD']), fx.baseline);
  assert.equal(git(fx.repository, ['diff', '--cached', '--name-only']), '');
});

test('remote divergence and concurrent advance fail closed', (t) => {
  const fx = fixture(t);
  const mission = greenMission(fx);
  const auth = authorization(fx);
  writeChange(fx);
  const orchestrator = createGovernedMissionGitFlowOrchestrator();
  const local = orchestrator.commit({
    closure: orchestrator.prepare({ mission, authorization: auth }),
    mission,
    authorization: auth,
    message: 'test(mission): concurrent fixture'
  });
  assert.equal(local.state, 'LOCAL_GREEN');

  const competitor = path.join(fx.root, 'competitor');
  git(fx.root, ['clone', '-b', 'main', fx.remote, competitor]);
  git(competitor, ['config', 'user.name', 'Concurrent Writer']);
  git(competitor, ['config', 'user.email', 'concurrent@surgical.invalid']);
  fs.writeFileSync(path.join(competitor, 'concurrent.txt'), 'advance\n');
  git(competitor, ['add', 'concurrent.txt']);
  git(competitor, ['commit', '-m', 'concurrent advance']);
  git(competitor, ['push', 'origin', 'main']);
  const concurrentSha = git(competitor, ['rev-parse', 'HEAD']);

  const blocked = orchestrator.publish({ closure: local, mission, authorization: auth });
  assert.equal(blocked.state, 'BLOCKED');
  assert.match(blocked.reason, /diverged/);
  assert.equal(blocked.lastReport.remote.observedSha, concurrentSha);
});

test('resume after interrupted commit adopts the exact commit without duplication', (t) => {
  const fx = fixture(t);
  const mission = greenMission(fx);
  const auth = authorization(fx);
  writeChange(fx);
  const runner = createGovernedGitFlowRunner();
  const committed = runner.commit({ authorization: auth, message: 'test(mission): interrupted commit' });
  assert.equal(committed.state, 'GREEN');

  const orchestrator = createGovernedMissionGitFlowOrchestrator({ runner });
  const closure = orchestrator.prepare({ mission, authorization: auth });
  const resumed = orchestrator.commit({
    closure,
    mission,
    authorization: auth,
    message: 'must not create a duplicate'
  });
  assert.equal(resumed.state, 'LOCAL_GREEN');
  assert.equal(resumed.commitSha, committed.commitSha);
  assert.equal(git(fx.repository, ['rev-list', '--count', `${fx.baseline}..HEAD`]), '1');
});

test('resume after interrupted push uses readback and does not push twice', (t) => {
  const fx = fixture(t);
  const mission = greenMission(fx);
  const auth = authorization(fx);
  writeChange(fx);
  const runner = createGovernedGitFlowRunner();
  const committed = runner.commit({ authorization: auth, message: 'test(mission): interrupted push' });
  assert.equal(committed.state, 'GREEN');
  const published = runner.push({ authorization: auth, commitSha: committed.commitSha });
  assert.equal(published.state, 'GREEN');

  const orchestrator = createGovernedMissionGitFlowOrchestrator({ runner });
  const closure = orchestrator.prepare({ mission, authorization: auth });
  const resumed = orchestrator.publish({ closure, mission, authorization: auth });
  assert.equal(resumed.state, 'REMOTE_GREEN');
  assert.equal(resumed.commitSha, committed.commitSha);
  const repeated = orchestrator.publish({ closure: resumed, mission, authorization: auth });
  assert.equal(repeated.state, 'REMOTE_GREEN');
  assert.equal(repeated.commitSha, committed.commitSha);
  assert.equal(git(fx.repository, ['rev-list', '--count', `${fx.baseline}..HEAD`]), '1');
});

test('rejected publication resumes from BLOCKED after fresh reconciliation', (t) => {
  const fx = fixture(t);
  const mission = greenMission(fx);
  const auth = authorization(fx);
  writeChange(fx);
  const orchestrator = createGovernedMissionGitFlowOrchestrator();
  const local = orchestrator.commit({
    closure: orchestrator.prepare({ mission, authorization: auth }),
    mission,
    authorization: auth,
    message: 'test(mission): recover rejected publication'
  });
  assert.equal(local.state, 'LOCAL_GREEN');
  const hook = path.join(fx.remote, 'hooks', 'pre-receive');
  fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n');
  fs.chmodSync(hook, 0o755);
  const blocked = orchestrator.publish({ closure: local, mission, authorization: auth });
  assert.equal(blocked.state, 'BLOCKED');
  assert.equal(blocked.commitSha, local.commitSha);
  assert.equal(git(fx.root, ['--git-dir', fx.remote, 'rev-parse', 'refs/heads/main']), fx.baseline);

  fs.rmSync(hook);
  const recovered = orchestrator.publish({ closure: blocked, mission, authorization: auth });
  assert.equal(recovered.state, 'REMOTE_GREEN');
  assert.equal(recovered.commitSha, local.commitSha);
  assert.equal(git(fx.root, ['--git-dir', fx.remote, 'rev-parse', 'refs/heads/main']), local.commitSha);
});

test('non-GREEN mission is ineligible even with a fully authorized Git envelope', (t) => {
  const fx = fixture(t);
  const session = freeze({
    schema: 'sdo.deterministic_workspace_session.v1',
    physical: { root: fx.repository },
    physicalWorkspaceIdentity: sha('workspace'),
    repositoryHead: fx.baseline,
    worktreeFingerprint: sha('worktree'),
    sessionFingerprint: sha('session'),
    operationalAuthority: false,
    mutationAuthority: false
  });
  const mission = createNaturalAgenticMission({
    missionId: 'not-green',
    objective: OBJECTIVE,
    session,
    createdAt: '2026-11-10T12:00:00.000Z'
  });
  assert.throws(
    () => createGovernedMissionGitFlowOrchestrator().prepare({
      mission,
      authorization: authorization(fx)
    }),
    /Only a canonically qualified GREEN mission/
  );
});

test('integration composes existing mission and runner without generic publication primitives', () => {
  const source = fs.readFileSync(
    require.resolve('../../accelerator/adapters/governed-mission-git-flow-orchestrator'),
    'utf8'
  );
  assert.match(source, /createGovernedGitFlowRunner/);
  assert.match(source, /validateNaturalAgenticMission/);
  assert.doesNotMatch(source, /child_process|spawnSync|execFile|--force|--no-verify/);
});
