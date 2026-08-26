'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  OBSERVATION_SCHEMA,
  canonicalAdversarialScenarios,
  qualifyNaturalAdversarialExperience
} = require('../../accelerator/evaluation/natural-adversarial-qualification');

function observation(value, overrides = {}) {
  return Object.freeze({
    schema: OBSERVATION_SCHEMA,
    language: value.language,
    outcome: value.expectedOutcome,
    boundary: value.expectedBoundary,
    elapsedMs: 100,
    latencyTargetMet: true,
    latencyFailureDisclosed: false,
    operationalAuthority: false,
    mutationAuthority: false,
    ...overrides
  });
}

test('canonical adversarial matrix pairs Portuguese and English at identical boundaries', async () => {
  const scenarios = canonicalAdversarialScenarios();
  const report = await qualifyNaturalAdversarialExperience({
    scenarios,
    async runScenario(value) { return observation(value); }
  });
  assert.equal(scenarios.length, 12);
  assert.equal(report.pairCount, 6);
  assert.equal(report.qualified, true);
  assert.equal(report.pairs.every((value) => value.equivalent), true);
  assert.equal(report.operationalAuthority, false);
});

test('prompt injection traversal credential stale stream and memory replay never qualify as authority', async () => {
  const report = await qualifyNaturalAdversarialExperience({
    async runScenario(value) { return observation(value); }
  });
  assert.equal(report.results.some((value) => value.outcome === 'COMPLETED'), false);
  assert.equal(report.results.every((value) => value.operationalAuthority === false), true);
  assert.equal(report.results.every((value) => value.mutationAuthority === false), true);
});

test('missed latency target passes disclosure only and cannot be hidden', async () => {
  const report = await qualifyNaturalAdversarialExperience({
    async runScenario(value) {
      return observation(value, {
        elapsedMs: 3000,
        latencyTargetMet: false,
        latencyFailureDisclosed: true
      });
    }
  });
  assert.equal(report.qualified, true);
  assert.equal(report.results.every((value) => !value.latencyTargetMet), true);
  assert.equal(report.results.every((value) => value.latencyFailureDisclosed), true);
});

test('undisclosed latency failure and bilingual boundary divergence fail qualification', async () => {
  let changed = false;
  const report = await qualifyNaturalAdversarialExperience({
    async runScenario(value) {
      if (!changed && value.language === 'en') {
        changed = true;
        return observation(value, { boundary: 'DIFFERENT', latencyTargetMet: false });
      }
      return observation(value);
    }
  });
  assert.equal(report.qualified, false);
  assert.equal(report.pairs.some((value) => !value.equivalent), true);
});

test('malformed or authority-bearing observations fail closed', async () => {
  await assert.rejects(
    qualifyNaturalAdversarialExperience({
      async runScenario(value) { return observation(value, { operationalAuthority: true }); }
    }),
    /authority-free/
  );
  await assert.rejects(
    qualifyNaturalAdversarialExperience({
      async runScenario(value) { return Object.freeze({ ...observation(value), command: 'rm' }); }
    }),
    /unqualified field/
  );
});

test('qualification module has no filesystem process network provider or dispatch dependency', () => {
  const source = fs.readFileSync(path.resolve(
    __dirname,
    '../../accelerator/evaluation/natural-adversarial-qualification.js'
  ), 'utf8');
  for (const forbidden of [
    'node:fs', 'node:child_process', 'node:http', 'node:https',
    'ollama', 'openai', 'surgical-orchestrator', 'dispatchGoverned'
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden, 'i'));
  }
});
