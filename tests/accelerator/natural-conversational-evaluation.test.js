'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const {
  OBSERVATION_SCHEMA,
  LATENCY_TARGETS_MS,
  createEvaluationProfile,
  createEvaluationScenario,
  canonicalScenarios,
  evaluateConversationalProfile
} = require(
  '../../accelerator/evaluation/natural-conversational-evaluation'
);

function profile(
  overrides = {}
) {
  return createEvaluationProfile({
    profileId:
      'test-local-v1',
    providerId:
      'ollama:gemma3:4b',
    model:
      'gemma3:4b',
    execution:
      'LOCAL',
    latencyClass:
      'FAST',
    ...overrides
  });
}

function oneScenario(
  overrides = {}
) {
  return createEvaluationScenario({
    scenarioId:
      'project-pt',
    language:
      'pt-BR',
    objectiveClass:
      'PROJECT_EXPLANATION',
    requiredEvidenceTarget:
      'README.md',
    requiredConcepts: [
      'Surgical DevOps',
      'autoridade'
    ],
    minimumResponseCharacters:
      40,
    ...overrides
  });
}

function deterministicClock(
  values
) {
  const remaining = [...values];
  return () => remaining.shift();
}

function completedObservation(
  scenario,
  overrides = {}
) {
  return Object.freeze({
    schema:
      OBSERVATION_SCHEMA,
    status:
      'COMPLETED',
    language:
      scenario.language,
    response:
      'Surgical DevOps preserva a autoridade humana e mantém evidência governada no Orchestrator.',
    evidenceTargets:
      Object.freeze([
        scenario.requiredEvidenceTarget
      ]),
    cacheHit:
      scenario.cacheExpected,
    operationalAuthority:
      false,
    mutationAuthority:
      false,
    ...overrides
  });
}

test(
  'canonical PT and EN evaluation scenarios are immutable and behaviorally equivalent',
  () => {
    const scenarios =
      canonicalScenarios();

    assert.equal(
      scenarios.length,
      4
    );
    assert.deepEqual(
      scenarios.map(
        (scenario) => scenario.language
      ),
      ['pt-BR', 'en', 'pt-BR', 'en']
    );
    assert.deepEqual(
      scenarios.map(
        (scenario) => scenario.cacheExpected
      ),
      [false, false, true, true]
    );
    assert.equal(
      scenarios[0].requiredEvidenceTarget,
      'README.md'
    );
    assert.equal(
      scenarios[1].requiredEvidenceTarget,
      'README.md'
    );
    assert.equal(
      scenarios.every(Object.isFrozen),
      true
    );
  }
);

test(
  'evaluation measures acknowledgement first content completion quality grounding and cache',
  async () => {
    const scenario =
      oneScenario();

    const report =
      await evaluateConversationalProfile({
        profile:
          profile(),
        scenarios:
          Object.freeze([scenario]),
        now:
          deterministicClock([
            1000,
            1100,
            1400,
            5000
          ]),
        async runScenario(
          value,
          emit
        ) {
          emit('ACKNOWLEDGED');
          emit('FIRST_CONTENT');
          emit('COMPLETED');
          return completedObservation(
            value
          );
        }
      });

    assert.equal(
      report.qualified,
      true
    );
    assert.equal(
      report.passedScenarios,
      1
    );
    assert.deepEqual(
      report.results[0].latency,
      {
        acknowledgementMs: 100,
        firstContentMs: 400,
        completionMs: 4000,
        acknowledgementTargetPassed:
          true,
        firstContentTargetPassed:
          true,
        completionTargetMs:
          15000,
        completionTargetPassed:
          true
      }
    );
    assert.equal(
      report.results[0].quality.passed,
      true
    );
    assert.equal(
      Object.isFrozen(report),
      true
    );
  }
);

test(
  'failed targets remain explicit and never become qualified success',
  async () => {
    const scenario =
      oneScenario({
        cacheExpected: true
      });

    const report =
      await evaluateConversationalProfile({
        profile:
          profile(),
        scenarios:
          Object.freeze([scenario]),
        now:
          deterministicClock([
            0,
            500,
            3000,
            4000
          ]),
        async runScenario(
          value,
          emit
        ) {
          emit('ACKNOWLEDGED');
          emit('FIRST_CONTENT');
          emit('COMPLETED');
          return completedObservation(
            value,
            {
              response:
                'Resposta insuficiente.',
              evidenceTargets:
                Object.freeze([]),
              cacheHit:
                false
            }
          );
        }
      });

    assert.equal(
      report.qualified,
      false
    );
    assert.equal(
      report.failedScenarios,
      1
    );
    assert.equal(
      report.results[0].quality.groundingPassed,
      false
    );
    assert.equal(
      report.results[0].quality.cachePassed,
      false
    );
    assert.equal(
      report.results[0].latency.completionTargetPassed,
      false
    );
  }
);

test(
  'report contains no prompt response or evidence content',
  async () => {
    const secret =
      'SECRET_PROJECT_CONTENT_924';
    const scenario =
      oneScenario();

    const report =
      await evaluateConversationalProfile({
        profile:
          profile(),
        scenarios:
          Object.freeze([scenario]),
        now:
          deterministicClock([
            0,
            1,
            2,
            3
          ]),
        async runScenario(
          value,
          emit
        ) {
          emit('ACKNOWLEDGED');
          emit('FIRST_CONTENT');
          emit('COMPLETED');
          return completedObservation(
            value,
            {
              response:
                'Surgical DevOps e autoridade ' +
                secret
            }
          );
        }
      });

    const serialized =
      JSON.stringify(report);

    assert.doesNotMatch(
      serialized,
      new RegExp(secret)
    );
    assert.equal(
      report.results[0].responseIncluded,
      false
    );
    assert.equal(
      report.contentTelemetry,
      false
    );
  }
);

test(
  'out-of-order progress malformed observation and authority claims fail closed',
  async () => {
    const scenario =
      oneScenario();
    const options = {
      profile:
        profile(),
      scenarios:
        Object.freeze([scenario]),
      now:
        deterministicClock([
          0,
          1,
          2,
          3
        ])
    };

    await assert.rejects(
      evaluateConversationalProfile({
        ...options,
        async runScenario(
          _value,
          emit
        ) {
          emit('FIRST_CONTENT');
        }
      }),
      /canonical order/i
    );

    await assert.rejects(
      evaluateConversationalProfile({
        ...options,
        now:
          deterministicClock([
            0,
            1,
            2,
            3
          ]),
        async runScenario(
          value,
          emit
        ) {
          emit('ACKNOWLEDGED');
          emit('FIRST_CONTENT');
          emit('COMPLETED');
          return completedObservation(
            value,
            {
              operationalAuthority:
                true
            }
          );
        }
      }),
      /authority-free/i
    );

    await assert.rejects(
      evaluateConversationalProfile({
        ...options,
        now:
          deterministicClock([
            0,
            1,
            2,
            3
          ]),
        async runScenario(
          value,
          emit
        ) {
          emit('ACKNOWLEDGED');
          emit('FIRST_CONTENT');
          emit('COMPLETED');
          return Object.freeze({
            ...completedObservation(value),
            command:
              'forbidden'
          });
        }
      }),
      /unqualified field/i
    );
  }
);

test(
  'declared language without textual language evidence does not pass quality',
  async () => {
    const scenario =
      oneScenario({
        language: 'en',
        requiredEvidenceTarget:
          'README.md',
        requiredConcepts: [
          'Surgical DevOps',
          'authority'
        ]
      });

    const report =
      await evaluateConversationalProfile({
        profile:
          profile(),
        scenarios:
          Object.freeze([scenario]),
        now:
          deterministicClock([
            0,
            1,
            2,
            3
          ]),
        async runScenario(
          value,
          emit
        ) {
          emit('ACKNOWLEDGED');
          emit('FIRST_CONTENT');
          emit('COMPLETED');
          return completedObservation(
            value,
            {
              language: 'en',
              response:
                'Surgical DevOps preserva autoridade humana e governança determinística.'
            }
          );
        }
      });

    assert.equal(
      report.results[0].quality.languagePassed,
      false
    );
    assert.equal(report.qualified, false);
  }
);

test(
  'evaluation profile and module expose no operational execution surface',
  () => {
    const value = profile();
    const surface = require(
      '../../accelerator/evaluation/natural-conversational-evaluation'
    );

    assert.equal(
      value.operationalAuthority,
      false
    );
    assert.equal(
      LATENCY_TARGETS_MS.acknowledgement,
      300
    );

    for (const forbidden of [
      'exec',
      'spawn',
      'shell',
      'filesystem',
      'network',
      'mutate',
      'authorize',
      'credential'
    ]) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          surface,
          forbidden
        ),
        false
      );
    }
  }
);

test(
  'evaluation source has no filesystem process network provider or orchestrator dependency',
  () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../accelerator/evaluation/natural-conversational-evaluation.js'
      ),
      'utf8'
    );

    for (const forbidden of [
      'node:fs',
      'node:child_process',
      'node:http',
      'node:https',
      'ollama-local-transport',
      'surgical-orchestrator',
      'executeGovernedMachineAccess',
      'dispatchGoverned'
    ]) {
      assert.doesNotMatch(
        source,
        new RegExp(forbidden)
      );
    }
  }
);
