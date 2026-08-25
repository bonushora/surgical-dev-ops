'use strict';

const {
  OBSERVATION_SCHEMA,
  createEvaluationProfile,
  canonicalScenarios,
  evaluateConversationalProfile
} = require(
  '../accelerator/evaluation/natural-conversational-evaluation'
);

const clockValues = [];

for (let index = 0; index < 4; index += 1) {
  const base = index * 1000;
  clockValues.push(
    base,
    base + 40,
    base + 120,
    base + 300
  );
}

function now() {
  return clockValues.shift();
}

async function main() {
  const profile = createEvaluationProfile({
    profileId:
      'contract-fixture-v1',
    providerId:
      'fixture:deterministic',
    model:
      'deterministic-fixture',
    execution:
      'FIXTURE',
    latencyClass:
      'CONTRACT'
  });

  const report =
    await evaluateConversationalProfile({
      profile,
      scenarios:
        canonicalScenarios(),
      now,
      async runScenario(
        scenario,
        emit
      ) {
        emit('ACKNOWLEDGED');
        emit('FIRST_CONTENT');
        emit('COMPLETED');

        const portuguese =
          scenario.language === 'pt-BR';

        return Object.freeze({
          schema:
            OBSERVATION_SCHEMA,
          status:
            'COMPLETED',
          language:
            scenario.language,
          response:
            portuguese
              ? 'Surgical DevOps mantém o Orchestrator como autoridade operacional e preserva a autoridade humana sobre decisões.'
              : 'Surgical DevOps is a system that keeps the Orchestrator as operational authority and preserves human authority over decisions.',
          evidenceTargets:
            Object.freeze([
              scenario.requiredEvidenceTarget
            ]),
          cacheHit:
            scenario.cacheExpected,
          operationalAuthority:
            false,
          mutationAuthority:
            false
        });
      }
    });

  process.stdout.write(
    JSON.stringify(report, null, 2) +
      '\n'
  );
}

main().catch(() => {
  process.stderr.write(
    'NATURAL evaluation contract demo failed safely.\n'
  );
  process.exitCode = 1;
});
