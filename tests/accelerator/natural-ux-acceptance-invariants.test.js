'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  interpretNaturalIntent
} = require('../../accelerator/cli/natural-intent');
const {
  detectNaturalGovernedTask
} = require('../../accelerator/cli/natural-governed-task');
const {
  createNaturalSessionControl
} = require('../../accelerator/cli/natural-session-control');
const {
  runNaturalRecursiveEvidenceLoop
} = require('../../accelerator/cli/natural-recursive-evidence-loop');
const {
  OBSERVATION_SCHEMA,
  createEvaluationProfile,
  createEvaluationScenario,
  evaluateConversationalProfile
} = require('../../accelerator/evaluation/natural-conversational-evaluation');

const OBJECTIVE_PT =
  'Explique o estado atual deste projeto e identifique o próximo trabalho de engenharia mais importante.';
const OBJECTIVE_EN =
  'Explain the current state of this project and identify the most important engineering work to do next.';

function activation() {
  return Object.freeze({
    workspace: 'surgical-dev-ops',
    repositoryPath: '/qualified/project',
    interactionMode: Object.freeze({ mode: 'NATURAL' })
  });
}

function workspaceFilesEvidence(files) {
  return {
    orchestration: { status: 'COMPLETED' },
    execution: {
      schema: 'sdo.git_read_result.v1',
      selector: 'WORKSPACE_FILES',
      result: { files }
    }
  };
}

function fileEvidence(target) {
  return {
    orchestration: { status: 'COMPLETED' },
    execution: {
      schema: 'sdo.filesystem_read_result.v1',
      target: { requested: target },
      evidence: {
        bytes: 32,
        sha256: 'a'.repeat(64),
        content: `Governed evidence from ${target}.`
      }
    }
  };
}

function clock() {
  const values = [0, 1, 2, 3];
  return () => values.shift();
}

function observation(scenario, response) {
  return Object.freeze({
    schema: OBSERVATION_SCHEMA,
    status: 'COMPLETED',
    language: scenario.language,
    response,
    evidenceTargets: Object.freeze(['ROADMAP.md']),
    cacheHit: false,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

async function evaluateResponse(scenario, response) {
  return evaluateConversationalProfile({
    profile: createEvaluationProfile({
      profileId: 'natural-ux-contract',
      providerId: 'fixture:deterministic',
      model: 'deterministic-fixture',
      execution: 'FIXTURE',
      latencyClass: 'CONTRACT'
    }),
    scenarios: Object.freeze([scenario]),
    now: clock(),
    async runScenario(value, emit) {
      emit('ACKNOWLEDGED');
      emit('FIRST_CONTENT');
      emit('COMPLETED');
      return observation(value, response);
    }
  });
}

test('broad project state and next-work objectives route to governed project analysis in PT and EN', () => {
  for (const objective of [OBJECTIVE_PT, OBJECTIVE_EN]) {
    assert.equal(interpretNaturalIntent(objective).matched, false);

    const task = detectNaturalGovernedTask(objective);
    assert.ok(task);
    assert.equal(task.kind, 'PROJECT_ANALYSIS');
    assert.equal(task.mutating, false);

    const control = createNaturalSessionControl({
      workspace: 'surgical-dev-ops',
      language: objective === OBJECTIVE_EN ? 'en' : 'pt-BR'
    });
    const boundary = control.handle(objective);
    assert.equal(boundary.matched, true);
    assert.equal(boundary.action, 'CONTINUE');
    assert.match(boundary.output, /workspace|project/i);
    assert.match(boundary.output, /8/);
    assert.match(boundary.output, /no (?:file|writes?)|nenhum arquivo/i);
    assert.equal(control.hasPendingAuthorization(), true);
  }
});

test('only a semantically bounded local-change question uses the Git status fast path', () => {
  for (const objective of [
    'Há alterações locais?',
    'Are there uncommitted local changes?'
  ]) {
    const result = interpretNaturalIntent(objective);
    assert.equal(result.matched, true);
    assert.deepEqual(result.intent, {
      capabilityType: 'GIT_READ',
      target: 'status'
    });
  }
});

test('project state and next-work synthesis receives governed project, state, and planning evidence', async () => {
  const task = detectNaturalGovernedTask(OBJECTIVE_PT);
  const progress = [];
  let providerCalls = 0;

  const result = await runNaturalRecursiveEvidenceLoop({
    task,
    activation: activation(),
    cognitiveSession: {
      async decideEvidence(_objective, _activation, history) {
        providerCalls += 1;
        assert.match(history.join('\n'), /TARGET: README\.md/);
        assert.match(history.join('\n'), /TARGET: docs\/ENGINEERING_EVIDENCE\.md/);
        assert.match(history.join('\n'), /TARGET: ROADMAP\.md/);
        return Object.freeze({
          schema: 'sdo.natural_evidence_decision.v1',
          decision: 'RESPOND',
          response:
            'O estado atual está qualificado pelas evidências observadas; a próxima prioridade de engenharia é a recomendação indicada pelo roadmap.',
          evidenceRequest: null
        });
      }
    },
    dispatchEvidence(intent) {
      if (intent.capabilityType === 'GIT_READ') {
        return workspaceFilesEvidence([
          'README.md',
          'docs/ENGINEERING_EVIDENCE.md',
          'ROADMAP.md'
        ]);
      }
      return fileEvidence(intent.target);
    },
    onProgress(event) {
      progress.push(event.stage);
    }
  });

  assert.equal(result.status, 'COMPLETED');
  assert.equal(providerCalls, 1);
  assert.deepEqual(
    result.evidence.filter((item) => item.kind === 'READ_FILE').map((item) => item.target),
    ['README.md', 'docs/ENGINEERING_EVIDENCE.md', 'ROADMAP.md']
  );
  assert.ok(progress.includes('GOVERNED_EVIDENCE_STARTED'));
  assert.ok(progress.includes('PROVIDER_COGNITION_STARTED'));
  assert.ok(progress.includes('SYNTHESIS_COMPLETED'));
  assert.equal(progress.at(-1), 'COMPLETED');
});

test('semantic completion rejects a truthful cleanliness fact that omits project state and next work', async () => {
  const scenario = createEvaluationScenario({
    scenarioId: 'project-state-next-work-pt',
    language: 'pt-BR',
    objectiveClass: 'PROJECT_STATE_AND_NEXT_WORK',
    requiredEvidenceTarget: 'ROADMAP.md',
    requiredConcepts: [
      ['estado atual', 'situação atual', 'ponto atual'],
      ['próximo trabalho', 'próxima prioridade', 'próximo passo de engenharia']
    ],
    minimumResponseCharacters: 30
  });

  const partial = await evaluateResponse(
    scenario,
    'O repositório não possui alterações locais pendentes.'
  );
  assert.equal(partial.qualified, false);
  assert.equal(partial.results[0].quality.conceptsPassed, false);

  const complete = await evaluateResponse(
    scenario,
    'O estado atual foi analisado com evidência governada; a próxima prioridade é o passo de engenharia indicado no roadmap.'
  );
  assert.equal(complete.qualified, true);
});
