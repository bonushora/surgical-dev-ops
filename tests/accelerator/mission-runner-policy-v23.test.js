'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createMissionExecutionEnvelope,
  canReuseEvidence,
  evaluateMissionRunnerStep
} = require('../../accelerator/core/mission-runner-policy');
const {
  createNaturalRunnerRuntime
} = require('../../accelerator/cli/natural-runner-runtime');

function envelope(overrides = {}) {
  return createMissionExecutionEnvelope({
    objective: 'Apply one bounded documentation repair and verify it.',
    workspace: '/workspace/surgical-dev-ops',
    environment: 'localhost',
    risk: 'BAIXO',
    allowedOperations: ['workspace.read', 'mutation.propose', 'tests.run'],
    allowedTargets: ['README.md'],
    completionCriterion: 'README parses and the targeted documentation test passes.',
    ...overrides
  });
}

function step(overrides = {}) {
  return {
    envelope: envelope(),
    operation: 'workspace.read',
    target: 'README.md',
    risk: 'BAIXO',
    ...overrides
  };
}

test('v2.3 envelope is immutable, bounded and carries no authority', () => {
  const value = envelope();
  assert.equal(Object.isFrozen(value), true);
  assert.equal(value.equivalentAttemptCeiling, 2);
  assert.equal(value.operationalAuthority, false);
  assert.equal(value.mutationAuthority, false);
  assert.equal(value.publicationAuthority, false);
  assert.match(value.envelopeFingerprint, /^[a-f0-9]{64}$/);
});

test('covered low-risk steps continue without an artificial new gate', () => {
  const result = evaluateMissionRunnerStep(step());
  assert.equal(result.classification, 'CONTINUE');
  assert.equal(result.authorityExpansion, false);
});

test('scope and two equivalent no-progress attempts fail closed', () => {
  assert.equal(evaluateMissionRunnerStep(step({ target: 'package.json' })).classification, 'BLOCKED');
  assert.equal(evaluateMissionRunnerStep(step({ equivalentAttempts: 2 })).classification, 'BLOCKED');
});

test('real boundaries consolidate human authority instead of silently continuing', () => {
  for (const signal of [
    'authorityExpansion', 'credentialRequired', 'destructive',
    'production', 'publication', 'scopeExpansion'
  ]) {
    const result = evaluateMissionRunnerStep(step({ signals: { [signal]: true } }));
    assert.equal(result.classification, 'HUMAN_AUTHORITY_REQUIRED', signal);
  }
  assert.equal(
    evaluateMissionRunnerStep(step({ risk: 'ALTO' })).classification,
    'HUMAN_AUTHORITY_REQUIRED'
  );
});

test('evidence reuse requires exact workspace target SHA and environment identity', () => {
  const identity = {
    workspace: '/workspace/surgical-dev-ops',
    target: 'README.md',
    sha256: 'a'.repeat(64),
    environment: 'localhost'
  };
  assert.equal(canReuseEvidence(identity, { ...identity }), true);
  assert.equal(canReuseEvidence(identity, { ...identity, sha256: 'b'.repeat(64) }), false);
  assert.equal(canReuseEvidence(identity, { ...identity, environment: 'Preview' }), false);
  assert.equal(canReuseEvidence(identity, { ...identity, target: './README.md' }), true);
  assert.equal(canReuseEvidence(identity, { ...identity, sha256: null }), false);
  assert.equal(canReuseEvidence(identity, { ...identity, sha256: 'malformed' }), false);
  const reused = evaluateMissionRunnerStep(step({
    previousEvidence: identity,
    currentEvidence: { ...identity }
  }));
  assert.equal(reused.classification, 'REUSE_EVIDENCE');
});

test('friction budget is proportional and enforced', () => {
  assert.equal(
    evaluateMissionRunnerStep(step({ frictionSpent: { gates: 2 } })).classification,
    'BLOCKED'
  );
  assert.equal(
    evaluateMissionRunnerStep(step({ frictionSpent: { gates: 1 } })).classification,
    'CONTINUE'
  );
});

test('RUNNER runtime consumes the v2.3 policy without gaining execution authority', () => {
  const runner = createNaturalRunnerRuntime();
  const started = runner.start(envelope());
  assert.equal(started.state, 'CONTINUING');
  assert.match(started.detail, /^[a-f0-9]{64}$/);

  const continued = runner.evaluate({
    operation: 'workspace.read',
    target: 'README.md',
    risk: 'BAIXO'
  });
  assert.equal(continued.state, 'CONTINUING');
  assert.equal(continued.policy.classification, 'CONTINUE');
  assert.equal(continued.operationalAuthority, false);
  assert.equal(continued.mutationAuthority, false);

  const stopped = runner.evaluate({
    operation: 'workspace.read',
    target: 'README.md',
    risk: 'BAIXO',
    signals: { credentialRequired: true }
  });
  assert.equal(stopped.state, 'EXACT_HUMAN_REVIEW_REQUIRED');
  assert.equal(stopped.policy.classification, 'HUMAN_AUTHORITY_REQUIRED');
});
