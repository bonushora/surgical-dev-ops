'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  INTERACTION_MODES,
  normalizeInteractionMode,
  createInteractionMode
} = require('../../accelerator/core/interaction-mode');

test('interaction contract exposes exactly the canonical modes', () => {
  assert.deepEqual(
    [...INTERACTION_MODES],
    [
      'NATURAL',
      'ENGINEER',
      'EXPERT'
    ]
  );

  assert.ok(Object.isFrozen(INTERACTION_MODES));
});

test('interaction mode defaults to EXPERT for v2.4.1 compatibility', () => {
  assert.equal(
    normalizeInteractionMode(),
    'EXPERT'
  );

  const profile = createInteractionMode();

  assert.equal(profile.mode, 'EXPERT');
});

test('interaction mode normalization is whitespace tolerant and case insensitive', () => {
  assert.equal(
    normalizeInteractionMode(' natural '),
    'NATURAL'
  );

  assert.equal(
    normalizeInteractionMode('Engineer'),
    'ENGINEER'
  );

  assert.equal(
    normalizeInteractionMode('EXPERT'),
    'EXPERT'
  );
});

test('unknown interaction modes fail closed', () => {
  for (const value of [
    '',
    'AUTO',
    'ADMIN',
    'UNRESTRICTED',
    'expert-shell'
  ]) {
    assert.throws(
      () => normalizeInteractionMode(value),
      /interaction mode/i
    );
  }
});

test('NATURAL exposes outcome-oriented progressive disclosure', () => {
  const profile =
    createInteractionMode('NATURAL');

  assert.deepEqual(
    profile.presentation,
    {
      naturalLanguagePrimary: true,
      technicalEvidence: 'SUMMARY',
      deterministicCommands: false
    }
  );
});

test('ENGINEER exposes natural language with technical evidence', () => {
  const profile =
    createInteractionMode('ENGINEER');

  assert.deepEqual(
    profile.presentation,
    {
      naturalLanguagePrimary: true,
      technicalEvidence: 'TECHNICAL',
      deterministicCommands: false
    }
  );
});

test('EXPERT preserves deterministic command-oriented control', () => {
  const profile =
    createInteractionMode('EXPERT');

  assert.deepEqual(
    profile.presentation,
    {
      naturalLanguagePrimary: false,
      technicalEvidence: 'EXACT',
      deterministicCommands: true
    }
  );
});

test('all interaction modes share the same canonical governance authority', () => {
  for (const mode of INTERACTION_MODES) {
    const profile =
      createInteractionMode(mode);

    assert.deepEqual(
      profile.governance,
      {
        authorityProfile: 'CANONICAL',
        orchestratorRequired: true,
        riskClassificationRequired: true,
        capabilityEnforcementRequired: true,
        securityInvariantsReduced: false
      }
    );
  }
});

test('interaction profile cannot become an easy-mode security bypass', () => {
  for (const mode of INTERACTION_MODES) {
    const profile =
      createInteractionMode(mode);

    assert.equal(
      profile.governance.securityInvariantsReduced,
      false
    );

    assert.equal(
      profile.governance.orchestratorRequired,
      true
    );

    assert.equal(
      profile.governance.capabilityEnforcementRequired,
      true
    );
  }
});

test('interaction profiles are deeply immutable', () => {
  for (const mode of INTERACTION_MODES) {
    const profile =
      createInteractionMode(mode);

    assert.ok(Object.isFrozen(profile));
    assert.ok(Object.isFrozen(profile.presentation));
    assert.ok(Object.isFrozen(profile.governance));
  }
});
