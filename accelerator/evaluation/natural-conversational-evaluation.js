'use strict';

const REPORT_SCHEMA =
  'sdo.natural_conversational_evaluation_report.v1';

const OBSERVATION_SCHEMA =
  'sdo.natural_conversational_evaluation_observation.v1';

const STAGES = Object.freeze([
  'ACKNOWLEDGED',
  'FIRST_CONTENT',
  'COMPLETED'
]);

const LATENCY_TARGETS_MS = Object.freeze({
  acknowledgement: 300,
  firstContent: 2000,
  cachedCompletion: 1000,
  localCompletion: 15000
});

const OBSERVATION_KEYS = Object.freeze([
  'schema',
  'status',
  'language',
  'response',
  'evidenceTargets',
  'cacheHit',
  'operationalAuthority',
  'mutationAuthority'
]);

function deepFreeze(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function requireText(value, name) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function requireBoundedInteger(
  value,
  name,
  maximum
) {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > maximum
  ) {
    throw new Error(
      `${name} must be a bounded non-negative integer.`
    );
  }

  return value;
}

function createEvaluationProfile({
  profileId,
  providerId,
  model,
  execution,
  latencyClass
} = {}) {
  if (
    !['LOCAL', 'REMOTE', 'FIXTURE'].includes(
      execution
    )
  ) {
    throw new Error(
      'Qualified evaluation execution class is required.'
    );
  }

  if (
    !['FAST', 'QUALITY', 'FRONTIER', 'CONTRACT'].includes(
      latencyClass
    )
  ) {
    throw new Error(
      'Qualified evaluation latency class is required.'
    );
  }

  return deepFreeze({
    schema:
      'sdo.natural_conversational_evaluation_profile.v1',
    profileId:
      requireText(profileId, 'profileId'),
    providerId:
      requireText(providerId, 'providerId'),
    model:
      requireText(model, 'model'),
    execution,
    latencyClass,
    contentTelemetry: false,
    operationalAuthority: false
  });
}

function createEvaluationScenario({
  scenarioId,
  language,
  objectiveClass,
  requiredEvidenceTarget,
  requiredConcepts,
  minimumResponseCharacters = 40,
  cacheExpected = false
} = {}) {
  if (!['pt-BR', 'en'].includes(language)) {
    throw new Error(
      'Qualified evaluation language is required.'
    );
  }

  if (
    !Array.isArray(requiredConcepts) ||
    requiredConcepts.length < 2 ||
    requiredConcepts.length > 8 ||
    requiredConcepts.some(
      (entry) => {
        const alternatives =
          Array.isArray(entry)
            ? entry
            : [entry];

        return (
          alternatives.length < 1 ||
          alternatives.length > 8 ||
          alternatives.some(
            (alternative) =>
              typeof alternative !== 'string' ||
              !alternative.trim() ||
              alternative.length > 80
          )
        );
      }
    )
  ) {
    throw new Error(
      'Bounded required evaluation concepts are required.'
    );
  }

  return deepFreeze({
    schema:
      'sdo.natural_conversational_evaluation_scenario.v1',
    scenarioId:
      requireText(scenarioId, 'scenarioId'),
    language,
    objectiveClass:
      requireText(objectiveClass, 'objectiveClass'),
    requiredEvidenceTarget:
      requireText(
        requiredEvidenceTarget,
        'requiredEvidenceTarget'
      ),
    requiredConcepts:
      requiredConcepts.map(
        (entry) =>
          Array.isArray(entry)
            ? [...new Set(entry.map((alternative) => alternative.trim()))]
            : entry.trim()
      ),
    minimumResponseCharacters:
      requireBoundedInteger(
        minimumResponseCharacters,
        'minimumResponseCharacters',
        4000
      ),
    cacheExpected:
      cacheExpected === true,
    operationalAuthority: false
  });
}

function canonicalScenarios() {
  const shared = {
    objectiveClass:
      'PROJECT_EXPLANATION',
    minimumResponseCharacters:
      80
  };

  return deepFreeze([
    createEvaluationScenario({
      ...shared,
      scenarioId:
        'project-explanation-pt-cold',
      language:
        'pt-BR',
      requiredEvidenceTarget:
        'README.md',
      requiredConcepts: [
        'Surgical DevOps',
        'Orchestrator',
        'autoridade'
      ]
    }),
    createEvaluationScenario({
      ...shared,
      scenarioId:
        'project-explanation-en-cold',
      language:
        'en',
      requiredEvidenceTarget:
        'README_EN.md',
      requiredConcepts: [
        'Surgical DevOps',
        'Orchestrator',
        'authority'
      ]
    }),
    createEvaluationScenario({
      ...shared,
      scenarioId:
        'project-explanation-pt-cache',
      language:
        'pt-BR',
      requiredEvidenceTarget:
        'README.md',
      requiredConcepts: [
        'Surgical DevOps',
        'Orchestrator',
        'autoridade'
      ],
      cacheExpected: true
    }),
    createEvaluationScenario({
      ...shared,
      scenarioId:
        'project-explanation-en-cache',
      language:
        'en',
      requiredEvidenceTarget:
        'README_EN.md',
      requiredConcepts: [
        'Surgical DevOps',
        'Orchestrator',
        'authority'
      ],
      cacheExpected: true
    })
  ]);
}

function validateObservation(
  value,
  scenario
) {
  if (
    !value ||
    typeof value !== 'object' ||
    value.schema !== OBSERVATION_SCHEMA ||
    value.status !== 'COMPLETED' ||
    typeof value.response !== 'string' ||
    !value.response.trim() ||
    value.language !== scenario.language ||
    !Array.isArray(value.evidenceTargets) ||
    !Object.isFrozen(value) ||
    !Object.isFrozen(value.evidenceTargets) ||
    value.operationalAuthority !== false ||
    value.mutationAuthority !== false
  ) {
    throw new Error(
      'Completed authority-free evaluation observation is required.'
    );
  }

  const keys = Object.keys(value).sort();
  const expectedKeys = [...OBSERVATION_KEYS].sort();

  if (
    JSON.stringify(keys) !==
      JSON.stringify(expectedKeys)
  ) {
    throw new Error(
      'Evaluation observation contains an unqualified field.'
    );
  }

  return value;
}

function scoreObservation(
  scenario,
  observation
) {
  const normalizedResponse =
    observation.response.toLocaleLowerCase('en');

  const conceptMatches =
    scenario.requiredConcepts.filter(
      (concept) => {
        const alternatives =
          Array.isArray(concept)
            ? concept
            : [concept];

        return alternatives.some(
          (alternative) =>
            normalizedResponse.includes(
              alternative.toLocaleLowerCase('en')
            )
        );
      }
    ).length;

  const groundingPassed =
    observation.evidenceTargets.includes(
      scenario.requiredEvidenceTarget
    );

  const languageMarkers =
    scenario.language === 'pt-BR'
      ? normalizedResponse.match(
          /\b(?:é|um|uma|o|a|de|do|da|e|para|com)\b/giu
        ) || []
      : normalizedResponse.match(
          /\b(?:the|is|an|a|of|and|to|with)\b/giu
        ) || [];

  const languagePassed =
    observation.language === scenario.language &&
    languageMarkers.length >= 3;

  const completenessPassed =
    observation.response.trim().length >=
      scenario.minimumResponseCharacters;

  const conceptsPassed =
    conceptMatches ===
      scenario.requiredConcepts.length;

  const cachePassed =
    observation.cacheHit ===
      scenario.cacheExpected;

  const authorityPassed =
    observation.operationalAuthority === false &&
    observation.mutationAuthority === false;

  const passed =
    groundingPassed &&
    languagePassed &&
    completenessPassed &&
    conceptsPassed &&
    cachePassed &&
    authorityPassed;

  return deepFreeze({
    passed,
    groundingPassed,
    languagePassed,
    completenessPassed,
    conceptsPassed,
    cachePassed,
    authorityPassed,
    conceptMatches,
    requiredConceptCount:
      scenario.requiredConcepts.length
  });
}

async function evaluateConversationalProfile({
  profile,
  scenarios = canonicalScenarios(),
  runScenario,
  now = () => Date.now()
} = {}) {
  if (
    !profile ||
    profile.schema !==
      'sdo.natural_conversational_evaluation_profile.v1' ||
    !Object.isFrozen(profile)
  ) {
    throw new Error(
      'Immutable conversational evaluation profile is required.'
    );
  }

  if (
    !Array.isArray(scenarios) ||
    scenarios.length < 1 ||
    scenarios.length > 16 ||
    scenarios.some(
      (scenario) =>
        !scenario ||
        scenario.schema !==
          'sdo.natural_conversational_evaluation_scenario.v1' ||
        !Object.isFrozen(scenario)
    )
  ) {
    throw new Error(
      'Bounded immutable evaluation scenarios are required.'
    );
  }

  if (
    typeof runScenario !== 'function' ||
    typeof now !== 'function'
  ) {
    throw new Error(
      'Evaluation runner and monotonic observation function are required.'
    );
  }

  const results = [];

  for (const scenario of scenarios) {
    const startedAt = now();

    if (!Number.isFinite(startedAt)) {
      throw new Error(
        'Evaluation clock must return a finite observation.'
      );
    }
    let previousAt = startedAt;
    const stageTimes = new Map();
    let nextStage = 0;

    const emit = (stage) => {
      if (
        stage !== STAGES[nextStage]
      ) {
        throw new Error(
          'Evaluation progress stage is out of canonical order.'
        );
      }

      const observedAt = now();

      if (
        !Number.isFinite(observedAt) ||
        observedAt < previousAt
      ) {
        throw new Error(
          'Evaluation clock must progress monotonically.'
        );
      }

      previousAt = observedAt;
      stageTimes.set(stage, observedAt);
      nextStage += 1;
    };

    const observation =
      validateObservation(
        await runScenario(
          scenario,
          emit
        ),
        scenario
      );

    if (nextStage !== STAGES.length) {
      throw new Error(
        'Evaluation scenario did not emit all canonical stages.'
      );
    }

    const acknowledgementMs =
      requireBoundedInteger(
        stageTimes.get('ACKNOWLEDGED') -
          startedAt,
        'acknowledgementMs',
        3600000
      );

    const firstContentMs =
      requireBoundedInteger(
        stageTimes.get('FIRST_CONTENT') -
          startedAt,
        'firstContentMs',
        3600000
      );

    const completionMs =
      requireBoundedInteger(
        stageTimes.get('COMPLETED') -
          startedAt,
        'completionMs',
        3600000
      );

    const quality =
      scoreObservation(
        scenario,
        observation
      );

    const targetCompletionMs =
      scenario.cacheExpected
        ? LATENCY_TARGETS_MS.cachedCompletion
        : profile.execution === 'LOCAL'
          ? LATENCY_TARGETS_MS.localCompletion
          : null;

    const latency = deepFreeze({
      acknowledgementMs,
      firstContentMs,
      completionMs,
      acknowledgementTargetPassed:
        acknowledgementMs <=
          LATENCY_TARGETS_MS.acknowledgement,
      firstContentTargetPassed:
        firstContentMs <=
          LATENCY_TARGETS_MS.firstContent,
      completionTargetMs:
        targetCompletionMs,
      completionTargetPassed:
        targetCompletionMs === null
          ? null
          : completionMs <=
            targetCompletionMs
    });

    const latencyPassed =
      latency.acknowledgementTargetPassed &&
      latency.firstContentTargetPassed &&
      latency.completionTargetPassed !== false;

    results.push(deepFreeze({
      scenarioId:
        scenario.scenarioId,
      language:
        scenario.language,
      objectiveClass:
        scenario.objectiveClass,
      cacheExpected:
        scenario.cacheExpected,
      latency,
      quality,
      passed:
        quality.passed && latencyPassed,
      responseIncluded: false,
      promptIncluded: false,
      evidenceContentIncluded: false,
      operationalAuthority: false
    }));
  }

  const passedScenarios =
    results.filter(
      (result) => result.passed
    ).length;

  return deepFreeze({
    schema: REPORT_SCHEMA,
    profile,
    targetsMs: LATENCY_TARGETS_MS,
    scenarioCount:
      results.length,
    passedScenarios,
    failedScenarios:
      results.length - passedScenarios,
    qualified:
      passedScenarios === results.length,
    results,
    contentTelemetry: false,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

module.exports = Object.freeze({
  REPORT_SCHEMA,
  OBSERVATION_SCHEMA,
  LATENCY_TARGETS_MS,
  createEvaluationProfile,
  createEvaluationScenario,
  canonicalScenarios,
  evaluateConversationalProfile
});
