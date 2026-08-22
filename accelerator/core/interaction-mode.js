'use strict';

const INTERACTION_MODES = Object.freeze([
  'NATURAL',
  'ENGINEER',
  'EXPERT'
]);

const MODE_SET =
  new Set(INTERACTION_MODES);

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

function normalizeInteractionMode(value = 'EXPERT') {
  if (typeof value !== 'string') {
    throw new Error(
      'Interaction mode must be a string.'
    );
  }

  const normalized =
    value.trim().toUpperCase();

  if (!normalized || !MODE_SET.has(normalized)) {
    throw new Error(
      `Invalid interaction mode: ${String(value)}. ` +
      'Expected NATURAL, ENGINEER or EXPERT.'
    );
  }

  return normalized;
}

function presentationFor(mode) {
  if (mode === 'NATURAL') {
    return {
      naturalLanguagePrimary: true,
      technicalEvidence: 'SUMMARY',
      deterministicCommands: false
    };
  }

  if (mode === 'ENGINEER') {
    return {
      naturalLanguagePrimary: true,
      technicalEvidence: 'TECHNICAL',
      deterministicCommands: false
    };
  }

  return {
    naturalLanguagePrimary: false,
    technicalEvidence: 'EXACT',
    deterministicCommands: true
  };
}

function createInteractionMode(value = 'EXPERT') {
  const mode =
    normalizeInteractionMode(value);

  return deepFreeze({
    schema: 'sdo.interaction_mode.v1',

    mode,

    presentation:
      presentationFor(mode),

    governance: {
      authorityProfile: 'CANONICAL',
      orchestratorRequired: true,
      riskClassificationRequired: true,
      capabilityEnforcementRequired: true,
      securityInvariantsReduced: false
    }
  });
}

module.exports = {
  INTERACTION_MODES,
  normalizeInteractionMode,
  createInteractionMode
};
