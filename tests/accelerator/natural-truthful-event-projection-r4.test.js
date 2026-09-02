'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { spawn, spawnSync } = require('node:child_process');

const {
  createDeterministicWorkspaceSession
} = require('../../accelerator/adapters/deterministic-workspace-session-adapter');
const {
  EVENT_SCHEMA,
  createNaturalAgenticMission,
  updateNaturalAgenticMissionPlanStep,
  recordNaturalAgenticMissionPlanResult,
  projectMissionActivity,
  validateNaturalAgenticMissionEvent
} = require('../../accelerator/core/natural-agentic-mission');
const {
  createGatewayRequest,
  dispatchGatewayRequest,
  streamGatewayRequest
} = require('../../accelerator/core/integrated-governed-agent-gateway');
const {
  formatNaturalGatewayEvent
} = require('../../accelerator/cli/natural-presentation');
const {
  createNaturalSessionControl
} = require('../../accelerator/cli/natural-session-control');
const {
  createHermeticGitRepository
} = require('./helpers/hermetic-git-repository');

const CLI = require.resolve('../../accelerator/cli/surgical');
const NOW = '2099-01-01T00:00:00.000Z';

function missionFor(repository, operation, overrides = {}) {
  const session = createDeterministicWorkspaceSession({
    authorizedRoot: repository,
    humanSubject: 'r4-test-human',
    authorizedAt: NOW
  });
  return createNaturalAgenticMission({
    missionId: overrides.missionId || `r4-${operation.replaceAll('.', '-')}`,
    objective: overrides.objective || `Exercise truthful ${operation} event projection.`,
    session,
    createdAt: NOW,
    plan: [{
      stepId: 'operation',
      summary: `Execute ${operation}.`,
      status: 'ACTIVE',
      operation
    }],
    authority: {
      allowedCapabilities: overrides.allowedCapabilities || [operation]
    },
    provider: overrides.provider
  });
}

function requestFor(mission, operation, args = {}) {
  return createGatewayRequest({
    requestId: `${mission.missionId}-request`,
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

test('real governed success emits canonical start before evidence and stream reuses those events', async () => {
  const fixture = createHermeticGitRepository();
  try {
    fs.writeFileSync(path.join(fixture.repository, 'package-lock.json'), '{"r4":true}\n');
    const mission = missionFor(fixture.repository, 'workspace.diff');
    const request = requestFor(mission, 'workspace.diff');
    const observed = [];
    const dispatch = dispatchGatewayRequest({
      mission,
      request,
      options: {
        now: () => NOW,
        onMissionEvent: (event) => observed.push(event)
      }
    });

    assert.deepEqual(observed.map((event) => event.type), [
      'OPERATION_STARTED',
      'EVIDENCE_DISCOVERED'
    ]);
    assert.deepEqual(
      observed.map((event) => event.eventHash),
      dispatch.result.events.map((event) => event.eventHash)
    );
    assert.ok(observed.every((event) => {
      assert.equal(validateNaturalAgenticMissionEvent(event).schema, EVENT_SCHEMA);
      return true;
    }));

    const streamed = [];
    for await (const item of streamGatewayRequest({
      mission,
      request,
      options: { now: () => NOW }
    })) {
      if (item.event) streamed.push(item.event);
    }
    assert.deepEqual(streamed.map((event) => event.type), [
      'OPERATION_STARTED',
      'EVIDENCE_DISCOVERED'
    ]);
    assert.equal(new Set(streamed.map((event) => event.eventHash)).size, 2);
    assert.ok(streamed.every((event) => event.schema === EVENT_SCHEMA));
  } finally {
    fixture.cleanup();
  }
});

test('canonical start is observed before the governed operation produces its physical result', () => {
  const fixture = createHermeticGitRepository();
  try {
    const target = 'r4-event-order.test.js';
    const marker = path.join(
      path.dirname(fixture.repository),
      'r4-operation-completed.marker'
    );
    fs.writeFileSync(
      path.join(fixture.repository, target),
      "'use strict';\n" +
        "const test = require('node:test');\n" +
        "const fs = require('node:fs');\n" +
        "test('physical completion marker', () => {\n" +
        `  fs.writeFileSync(${JSON.stringify(marker)}, 'completed\\n');\n` +
        "});\n"
    );
    for (const args of [
      ['add', target],
      ['commit', '-m', 'add R4 event ordering fixture']
    ]) {
      const git = spawnSync('git', args, {
        cwd: fixture.repository,
        encoding: 'utf8'
      });
      assert.equal(git.status, 0, git.stderr);
    }
    const mission = missionFor(fixture.repository, 'tests.run');
    const observed = [];
    const dispatch = dispatchGatewayRequest({
      mission,
      request: requestFor(mission, 'tests.run', { target }),
      options: {
        now: () => NOW,
        onMissionEvent: (event) => {
          observed.push(event.type);
          if (event.type === 'TEST_STARTED') assert.equal(fs.existsSync(marker), false);
          if (event.type === 'TEST_PASSED') assert.equal(fs.existsSync(marker), true);
        }
      }
    });

    assert.equal(
      dispatch.result.classification,
      'SUCCESS',
      JSON.stringify(dispatch.result)
    );
    assert.deepEqual(observed, ['TEST_STARTED', 'TEST_PASSED']);
  } finally {
    fixture.cleanup();
  }
});

test('failure, authority-required, and stale transitions project their exact truth and never success', () => {
  const fixture = createHermeticGitRepository();
  try {
    const failureMission = missionFor(fixture.repository, 'workspace.read');
    const failureEvents = [];
    const failure = dispatchGatewayRequest({
      mission: failureMission,
      request: requestFor(failureMission, 'workspace.read', { target: 'missing-r4.js' }),
      options: { now: () => NOW, onMissionEvent: (event) => failureEvents.push(event) }
    });
    assert.equal(failure.result.classification, 'FAILURE');
    assert.deepEqual(failureEvents.map((event) => event.type), [
      'OPERATION_STARTED',
      'OPERATION_DENIED'
    ]);
    const failureOutput = failureEvents.map((event) =>
      formatNaturalGatewayEvent(event, 'en', { operation: 'workspace.read' })
    ).join('');
    assert.match(failureOutput, /started: workspace\.read/);
    assert.match(failureOutput, /failed closed: workspace\.read — FAILURE/);
    assert.doesNotMatch(failureOutput, /completed|GREEN|SUCCESS/);

    const authorityMission = missionFor(fixture.repository, 'tests.runCanonical');
    const authorityEvents = [];
    const authority = dispatchGatewayRequest({
      mission: authorityMission,
      request: requestFor(authorityMission, 'tests.runCanonical'),
      options: { now: () => NOW, onMissionEvent: (event) => authorityEvents.push(event) }
    });
    assert.equal(authority.result.classification, 'AUTHORITY_REQUIRED');
    assert.deepEqual(authorityEvents.map((event) => event.type), ['AUTHORITY_REQUIRED']);
    const authorityOutput = formatNaturalGatewayEvent(
      authorityEvents[0],
      'en',
      { operation: 'tests.runCanonical' }
    );
    assert.match(authorityOutput, /requires authority.*not granted/i);
    assert.doesNotMatch(authorityOutput, /authority granted/i);

    const staleMission = missionFor(fixture.repository, 'workspace.diff', {
      missionId: 'r4-stale'
    });
    const staleRequest = requestFor(staleMission, 'workspace.diff');
    fs.writeFileSync(path.join(fixture.repository, 'package-lock.json'), '{"stale":true}\n');
    const staleEvents = [];
    const stale = dispatchGatewayRequest({
      mission: staleMission,
      request: staleRequest,
      options: { now: () => NOW, onMissionEvent: (event) => staleEvents.push(event) }
    });
    assert.equal(stale.result.classification, 'STALE_STATE');
    assert.deepEqual(staleEvents.map((event) => event.type), [
      'OPERATION_STARTED',
      'STATE_INVALIDATED'
    ]);
    const staleOutput = staleEvents.map((event) =>
      formatNaturalGatewayEvent(event, 'en', { operation: 'workspace.diff' })
    ).join('');
    assert.match(staleOutput, /state invalidated.*STALE_STATE/i);
    assert.doesNotMatch(staleOutput, /completed|GREEN/);
  } finally {
    fixture.cleanup();
  }
});

test('structured result drives plan completion and the activity projection uses the same mission truth', () => {
  const fixture = createHermeticGitRepository();
  try {
    const mission = missionFor(fixture.repository, 'workspace.diff');
    const dispatch = dispatchGatewayRequest({
      mission,
      request: requestFor(mission, 'workspace.diff'),
      options: { now: () => NOW }
    });
    const updated = recordNaturalAgenticMissionPlanResult(dispatch.mission, {
      stepId: 'operation',
      result: dispatch.result,
      at: NOW
    });
    const activity = projectMissionActivity(updated);

    assert.equal(updated.plan[0].status, 'COMPLETED');
    assert.equal(activity.latestEvent.type, 'PLAN_UPDATED');
    assert.equal(activity.lastGovernedResult.classification, 'SUCCESS');
    assert.equal(activity.currentStep, null);
    assert.equal(activity.operationalAuthority, false);
  } finally {
    fixture.cleanup();
  }
});

test('presentation rejects synthetic or altered progress and observer failures cannot affect dispatch', () => {
  const fixture = createHermeticGitRepository();
  try {
    assert.equal(formatNaturalGatewayEvent(Object.freeze({
      type: 'OPERATION_STARTED',
      operation: 'workspace.diff'
    })), '');

    const mission = missionFor(fixture.repository, 'workspace.diff');
    const dispatch = dispatchGatewayRequest({
      mission,
      request: requestFor(mission, 'workspace.diff'),
      options: {
        now: () => NOW,
        onMissionEvent: () => { throw new Error('presentation failed'); }
      }
    });
    assert.equal(dispatch.result.classification, 'SUCCESS');
    const altered = Object.freeze({
      ...dispatch.result.events[0],
      type: 'OPERATION_COMPLETED'
    });
    assert.equal(formatNaturalGatewayEvent(altered, 'en', {
      operation: 'workspace.diff'
    }), '');
  } finally {
    fixture.cleanup();
  }
});

test('canonical operational events are provider-independent and grant no authority', () => {
  const fixture = createHermeticGitRepository();
  try {
    const eventTypes = [];
    for (const provider of [
      { providerId: 'deterministic-local', providerKind: 'LOCAL_DETERMINISTIC' },
      { providerId: 'openai-compatible', providerKind: 'REMOTE_COGNITIVE' }
    ]) {
      const mission = missionFor(fixture.repository, 'workspace.diff', {
        missionId: `r4-${provider.providerId}`,
        provider
      });
      const dispatch = dispatchGatewayRequest({
        mission,
        request: requestFor(mission, 'workspace.diff'),
        options: { now: () => NOW }
      });
      eventTypes.push(dispatch.result.events.map((event) => event.type));
      assert.equal(dispatch.result.providerInvoked, false);
      assert.ok(dispatch.result.events.every((event) =>
        event.operationalAuthority === false && event.mutationAuthority === false
      ));
    }
    assert.deepEqual(eventTypes[0], eventTypes[1]);
  } finally {
    fixture.cleanup();
  }
});

test('PT-BR and English activity questions select one bounded current-mission projection', () => {
  for (const phrase of [
    'o que está acontecendo?',
    'o que acabou de acontecer?',
    'essa operação terminou?',
    'por que parou?',
    'what is happening?',
    'what just happened?',
    'did that operation finish?',
    'why did it stop?'
  ]) {
    const result = createNaturalSessionControl().handle(phrase);
    assert.equal(result.action, 'MISSION_PROJECTION', phrase);
    assert.equal(result.projection, 'activity', phrase);
    assert.equal(result.authorityExpansion, false, phrase);
  }

  for (const phrase of [
    'what is this function doing?',
    'o que este código está fazendo?'
  ]) {
    assert.notEqual(createNaturalSessionControl().handle(phrase).projection, 'activity', phrase);
  }
});

test('production NATURAL projects each real event once and preserves one R2/R3 mission', () => {
  const fixture = createHermeticGitRepository();
  try {
    fs.writeFileSync(path.join(fixture.repository, 'package-lock.json'), '{"r4":true}\n');
    const outcome = runNatural(fixture.repository, [
      'quais arquivos mudaram?',
      'mostre a evidência',
      'o que está acontecendo?',
      '/plan',
      '/status',
      'exit'
    ]);

    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal((outcome.stdout.match(/Operação governada iniciada: workspace\.diff/g) || []).length, 1);
    assert.equal((outcome.stdout.match(/Operação governada iniciada: evidence\.inspect/g) || []).length, 1);
    assert.equal((outcome.stdout.match(/Evidência governada descoberta: workspace\.diff/g) || []).length, 1);
    assert.equal((outcome.stdout.match(/Evidência governada descoberta: evidence\.inspect/g) || []).length, 1);
    assert.match(outcome.stdout, /Atividade atual da missão:/);
    assert.match(outcome.stdout, /Último evento: PLAN_UPDATED/);
    assert.match(outcome.stdout, /COMPLETED \[workspace\.diff\]:/);
    assert.match(outcome.stdout, /COMPLETED \[evidence\.inspect\]:/);
    assert.match(outcome.stdout, /Objective: quais arquivos mudaram\?/);
    assert.doesNotMatch(outcome.stdout, /Processando com o provider cognitivo local/);
  } finally {
    fixture.cleanup();
  }
});

test('production authority and stale paths emit blocked canonical truth without execution', async () => {
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
    child.stdin.write('corrija isso\n');
    await waitForOutput(() => stdout, /Autoridade governada requerida.*não concedida/i);
    child.stdin.write('continue\n');
    await waitForOutput(() => stdout, /Continuation: AUTHORITY_REQUIRED/);

    fs.writeFileSync(path.join(fixture.repository, 'package-lock.json'), '{"stale":"r4"}\n');
    child.stdin.end('/status\nexit\n');
    const [code] = await once(child, 'close');

    assert.equal(code, 0, stderr);
    assert.match(stdout, /Missão governada bloqueada:/);
    assert.match(stdout, /Continuation: AUTHORITY_REQUIRED/);
    assert.doesNotMatch(stdout, /Operação governada iniciada: mutation\.applyConditional/);
    assert.doesNotMatch(stdout, /Autoridade governada concedida/);
    assert.match(stdout, /Estado governado invalidado: STALE_STATE/);
    assert.doesNotMatch(stdout, /Missão governada GREEN/);
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM');
    fixture.cleanup();
  }
});

test('R4 leaves the qualified terminal busy-input guard in the production path', () => {
  const source = fs.readFileSync(CLI, 'utf8');
  assert.match(source, /interactiveRequestInFlight/);
  assert.match(source, /formatInteractiveBackpressureMessage/);
  assert.doesNotMatch(source, /setInterval\(|fakeProgress|progressPercent/);
});
