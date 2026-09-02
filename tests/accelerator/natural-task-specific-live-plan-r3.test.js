'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { spawn, spawnSync } = require('node:child_process');

const {
  createDeterministicWorkspaceSession,
  revalidateDeterministicWorkspaceSession
} = require('../../accelerator/adapters/deterministic-workspace-session-adapter');
const {
  createNaturalAgenticMission,
  updateNaturalAgenticMissionPlanStep,
  recordNaturalAgenticMissionPlanResult,
  selectNaturalAgenticMissionContinuation,
  projectMissionStatus,
  projectMissionPlan
} = require('../../accelerator/core/natural-agentic-mission');
const {
  createGatewayRequest,
  dispatchGatewayRequest
} = require('../../accelerator/core/integrated-governed-agent-gateway');
const {
  createNaturalSessionControl
} = require('../../accelerator/cli/natural-session-control');
const {
  createHermeticGitRepository
} = require('./helpers/hermetic-git-repository');

const CLI = require.resolve('../../accelerator/cli/surgical');
const NOW = '2099-01-01T00:00:00.000Z';

function missionFor(repository, plan, allowedCapabilities) {
  const session = createDeterministicWorkspaceSession({
    authorizedRoot: repository,
    humanSubject: 'r3-test-human',
    authorizedAt: NOW
  });
  return createNaturalAgenticMission({
    missionId: `r3-${session.sessionFingerprint.slice(0, 32)}`,
    objective: 'Inspect the governed engineering state.',
    session,
    createdAt: NOW,
    plan,
    authority: {
      allowedCapabilities
    }
  });
}

function requestFor(mission, operation, args = {}) {
  return createGatewayRequest({
    requestId: `r3-${operation.replaceAll('.', '-')}`,
    mission,
    operation,
    args,
    requestedAt: NOW
  });
}

function processEnvironment(repository) {
  const stateRoot = path.dirname(repository);
  return {
    ...process.env,
    XDG_CONFIG_HOME: stateRoot,
    LOCALAPPDATA: stateRoot,
    APPDATA: stateRoot
  };
}

function runNatural(repository, lines, language = 'pt-BR') {
  return spawnSync(
    process.execPath,
    [CLI, '--interaction', 'NATURAL', '--language', language],
    {
      cwd: repository,
      env: processEnvironment(repository),
      input: [...lines, ''].join('\n'),
      encoding: 'utf8',
      timeout: 15_000,
      maxBuffer: 4 * 1024 * 1024
    }
  );
}

function waitForOutput(read, pattern, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const inspect = () => {
      if (pattern.test(read())) return resolve();
      if (Date.now() - started >= timeoutMs) {
        return reject(new Error(`Timed out waiting for ${pattern}.\n${read()}`));
      }
      setTimeout(inspect, 10);
    };
    inspect();
  });
}

test('structured governed results update the existing live plan without creating authority', () => {
  const fixture = createHermeticGitRepository();
  try {
    const pending = missionFor(fixture.repository, [
      {
        stepId: 'inspect-diff',
        summary: 'Inspect governed workspace changes.',
        status: 'PENDING',
        operation: 'workspace.diff'
      },
      {
        stepId: 'inspect-evidence',
        summary: 'Inspect governed evidence.',
        status: 'PENDING',
        operation: 'evidence.inspect',
        sourceOperation: 'workspace.diff'
      }
    ], ['workspace.diff', 'evidence.inspect']);
    const mission = updateNaturalAgenticMissionPlanStep(pending, {
      stepId: 'inspect-diff',
      status: 'ACTIVE',
      at: NOW
    });
    assert.equal(pending.plan[0].status, 'PENDING');
    assert.equal(mission.plan[0].status, 'ACTIVE');
    const dispatch = dispatchGatewayRequest({
      mission,
      request: requestFor(mission, 'workspace.diff'),
      options: { now: () => NOW }
    });
    const updated = recordNaturalAgenticMissionPlanResult(
      dispatch.mission,
      {
        stepId: 'inspect-diff',
        result: dispatch.result,
        at: NOW
      }
    );
    const status = projectMissionStatus(updated);
    const plan = projectMissionPlan(updated);

    assert.equal(updated.plan[0].status, 'COMPLETED');
    assert.equal(updated.plan[0].resultClass, 'SUCCESS');
    assert.equal(updated.plan[0].evidenceRef.fingerprint, dispatch.result.evidenceDigest);
    assert.equal(status.objective, mission.objective);
    assert.equal(status.lastGovernedResult.classification, 'SUCCESS');
    assert.equal(status.nextStep.stepId, 'inspect-evidence');
    assert.equal(plan.nextStep.stepId, 'inspect-evidence');
    assert.equal(plan.operationalAuthority, false);
    assert.equal(updated.mutationAuthority, false);
  } finally {
    fixture.cleanup();
  }
});

test('a governed operation failure blocks its live step and can never become completion', () => {
  const fixture = createHermeticGitRepository();
  try {
    const mission = missionFor(fixture.repository, [{
      stepId: 'read-missing',
      summary: 'Read bounded governed evidence.',
      status: 'ACTIVE',
      operation: 'workspace.read'
    }], ['workspace.read']);
    const dispatch = dispatchGatewayRequest({
      mission,
      request: requestFor(mission, 'workspace.read', { target: 'missing-r3.js' }),
      options: { now: () => NOW }
    });

    assert.equal(dispatch.result.classification, 'FAILURE');
    const updated = recordNaturalAgenticMissionPlanResult(dispatch.mission, {
      stepId: 'read-missing',
      result: dispatch.result,
      at: NOW
    });

    assert.equal(updated.state, 'BLOCKED');
    assert.equal(updated.plan[0].status, 'BLOCKED');
    assert.equal(updated.plan[0].resultClass, 'FAILURE');
    assert.match(updated.plan[0].blocker, /failed|denied|unavailable|not resolve/i);
    assert.equal(projectMissionStatus(updated).plan.completed, 0);
  } finally {
    fixture.cleanup();
  }
});

test('continuation selection is physical, unambiguous, bounded, and authority-free', () => {
  const fixture = createHermeticGitRepository();
  try {
    const eligibleMission = missionFor(fixture.repository, [{
      stepId: 'inspect',
      summary: 'Inspect workspace changes.',
      status: 'PENDING',
      operation: 'workspace.diff'
    }], ['workspace.diff']);
    const valid = revalidateDeterministicWorkspaceSession(eligibleMission.session);
    const eligible = selectNaturalAgenticMissionContinuation({
      mission: eligibleMission,
      revalidation: valid
    });
    assert.equal(eligible.classification, 'ELIGIBLE');
    assert.equal(eligible.step.stepId, 'inspect');
    assert.equal(eligible.operationalAuthority, false);

    const ambiguousMission = missionFor(fixture.repository, [
      { stepId: 'one', summary: 'First inspection.', status: 'PENDING', operation: 'workspace.status' },
      { stepId: 'two', summary: 'Second inspection.', status: 'PENDING', operation: 'workspace.diff' }
    ], ['workspace.status', 'workspace.diff']);
    assert.equal(
      selectNaturalAgenticMissionContinuation({
        mission: ambiguousMission,
        revalidation: revalidateDeterministicWorkspaceSession(ambiguousMission.session)
      }).classification,
      'AMBIGUOUS_NEXT_STEP'
    );

    const authorityMission = missionFor(fixture.repository, [{
      stepId: 'commit',
      summary: 'Create a local checkpoint.',
      status: 'PENDING',
      operation: 'git.commit'
    }], ['workspace.diff']);
    assert.equal(
      selectNaturalAgenticMissionContinuation({
        mission: authorityMission,
        revalidation: revalidateDeterministicWorkspaceSession(authorityMission.session)
      }).classification,
      'AUTHORITY_REQUIRED'
    );

    fs.writeFileSync(path.join(fixture.repository, 'package-lock.json'), '{"stale":true}\n');
    assert.equal(
      selectNaturalAgenticMissionContinuation({
        mission: eligibleMission,
        revalidation: revalidateDeterministicWorkspaceSession(eligibleMission.session)
      }).classification,
      'STALE_STATE'
    );
  } finally {
    fixture.cleanup();
  }
});

test('PT-BR and English mission questions resolve by semantic projection families', () => {
  const cases = [
    [['o que você está fazendo?', 'what are you doing?'], 'status'],
    [['qual é o objetivo atual?', 'what is the current objective?'], 'status'],
    [['qual é o estado da missão?', 'what is the mission status?'], 'status'],
    [['qual é a etapa atual?', 'what is the current step?'], 'plan'],
    [['qual é o próximo passo?', 'what is next?'], 'plan'],
    [['o que já foi concluído?', 'what has been completed?'], 'plan'],
    [['o que ainda falta?', 'what remains?'], 'plan'],
    [['há algum bloqueio?', 'is anything blocked?'], 'plan'],
    [['por que você está bloqueado?', 'why are you blocked?'], 'plan'],
    [['mostre o plano', 'show the plan'], 'plan']
  ];

  for (const [phrases, projection] of cases) {
    for (const phrase of phrases) {
      const result = createNaturalSessionControl({
        language: phrase === phrases[1] ? 'en' : 'pt-BR'
      }).handle(phrase);
      assert.equal(result.action, 'MISSION_PROJECTION', phrase);
      assert.equal(result.projection, projection, phrase);
      assert.equal(result.authorityExpansion, false, phrase);
    }
  }

  for (const phrase of [
    'continue',
    'continue de onde estamos',
    'continue com o próximo passo',
    'continue with the next step'
  ]) {
    const result = createNaturalSessionControl().handle(phrase);
    assert.equal(result.action, 'MISSION_CONTINUE', phrase);
    assert.equal(result.authorityExpansion, false, phrase);
  }

  for (const phrase of [
    'what is this function doing?',
    'o que este código está fazendo?'
  ]) {
    assert.notEqual(
      createNaturalSessionControl().handle(phrase).action,
      'MISSION_PROJECTION',
      phrase
    );
  }
});

test('production NATURAL projects one task-specific mission and the live R2 follow-up plan', () => {
  const fixture = createHermeticGitRepository();
  try {
    fs.writeFileSync(path.join(fixture.repository, 'package-lock.json'), '{"r3":true}\n');
    const outcome = runNatural(fixture.repository, [
      'quais arquivos mudaram?',
      'mostre a evidência',
      'o que você está fazendo?',
      'qual é o próximo passo?',
      '/plan',
      '/status',
      'exit'
    ]);

    assert.equal(outcome.status, 0, outcome.stderr);
    assert.match(outcome.stdout, /Objective: quais arquivos mudaram\?/);
    assert.doesNotMatch(outcome.stdout, /Interactive NATURAL governed engineering session/);
    assert.match(outcome.stdout, /COMPLETED \[workspace\.diff\]:/);
    assert.match(outcome.stdout, /COMPLETED \[evidence\.inspect\]:/);
    assert.match(outcome.stdout, /Last governed result: SUCCESS/);
    assert.match(outcome.stdout, /Current step: none/);
    assert.match(outcome.stdout, /Next step: none/);
    assert.match(outcome.stdout, /Workspace: .*surgical-dev-ops/);
    const missionIds = [...outcome.stdout.matchAll(/Mission: (\S+)/g)].map((match) => match[1]);
    assert.ok(missionIds.length >= 4, outcome.stdout);
    assert.equal(new Set(missionIds).size, 1, outcome.stdout);
    assert.doesNotMatch(outcome.stdout, /Processando com o provider cognitivo local/);
  } finally {
    fixture.cleanup();
  }
});

test('process-local continue executes one eligible governed read and no mission fails closed', () => {
  const fixture = createHermeticGitRepository();
  try {
    fs.writeFileSync(path.join(fixture.repository, 'package-lock.json'), '{"r3":true}\n');
    const continued = runNatural(fixture.repository, [
      'quais arquivos mudaram?',
      'continue',
      '/plan',
      'exit'
    ]);
    assert.equal(continued.status, 0, continued.stderr);
    assert.match(continued.stdout, /Continuation: ELIGIBLE/);
    assert.equal((continued.stdout.match(/Operação governada iniciada: workspace\.diff/g) || []).length, 1);
    assert.equal((continued.stdout.match(/Operação governada iniciada: evidence\.inspect/g) || []).length, 1);
    assert.match(continued.stdout, /COMPLETED \[evidence\.inspect\]:/);

    const absent = runNatural(fixture.repository, ['continue', '/status', 'exit']);
    assert.equal(absent.status, 0, absent.stderr);
    assert.match(absent.stdout, /Continuation: NO_MISSION/);
    assert.doesNotMatch(absent.stdout, /Operação governada iniciada/);
    assert.doesNotMatch(absent.stdout, /Interactive NATURAL governed engineering session/);
  } finally {
    fixture.cleanup();
  }
});

test('stale process-local continuation blocks its next step without dispatch', async () => {
  const fixture = createHermeticGitRepository();
  const child = spawn(
    process.execPath,
    [CLI, '--interaction', 'NATURAL', '--language', 'pt-BR'],
    {
      cwd: fixture.repository,
      env: processEnvironment(fixture.repository),
      stdio: ['pipe', 'pipe', 'pipe']
    }
  );
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  try {
    child.stdin.write('quais arquivos mudaram?\n');
    await waitForOutput(() => stdout, /Resultado: SUCCESS/);
    fs.writeFileSync(path.join(fixture.repository, 'package-lock.json'), '{"stale":"r3"}\n');
    child.stdin.end('continue\n/plan\nexit\n');
    const [code] = await once(child, 'close');

    assert.equal(code, 0, stderr);
    assert.match(stdout, /Continuation: STALE_STATE/);
    assert.match(stdout, /BLOCKED \[evidence\.inspect\]:/);
    assert.match(stdout, /STALE_STATE/);
    assert.equal((stdout.match(/Operação governada iniciada/g) || []).length, 1);
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM');
    fixture.cleanup();
  }
});

test('resolved mutation target becomes a blocked plan step and continue grants no authority', () => {
  const fixture = createHermeticGitRepository();
  try {
    const before = fs.readFileSync(path.join(fixture.repository, 'package-lock.json'), 'utf8');
    const outcome = runNatural(fixture.repository, [
      'quais arquivos mudaram?',
      'corrija isso',
      'continue',
      '/plan',
      '/authority',
      'exit'
    ]);

    assert.equal(outcome.status, 0, outcome.stderr);
    assert.match(outcome.stdout, /Referência governada resolvida:/);
    assert.match(outcome.stdout, /HUMAN_AUTHORITY_REQUIRED/);
    assert.match(outcome.stdout, /Continuation: AUTHORITY_REQUIRED/);
    assert.match(outcome.stdout, /BLOCKED \[mutation\.applyConditional\]:/);
    assert.match(outcome.stdout, /exact governed mutation proposal|proposta de mutação governada exata/i);
    assert.doesNotMatch(outcome.stdout, /Operação governada iniciada: mutation\.applyConditional/);
    assert.equal(fs.readFileSync(path.join(fixture.repository, 'package-lock.json'), 'utf8'), before);
  } finally {
    fixture.cleanup();
  }
});
