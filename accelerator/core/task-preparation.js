#!/usr/bin/env node

'use strict';

const RISK_LEVELS = new Set([
  'BAIXO',
  'MÉDIO',
  'ALTO'
]);

const MODES = new Set([
  'PATCH',
  'REFRACTOR'
]);

function normalizeText(value) {
  if (typeof value !== 'string') {
    throw new Error('Task description must be a string.');
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error('Task description cannot be empty.');
  }

  return normalized;
}

function normalizeMode(mode) {
  const normalized = String(mode || 'PATCH').trim().toUpperCase();

  if (!MODES.has(normalized)) {
    throw new Error(
      `Invalid execution mode: ${normalized}. Expected PATCH or REFRACTOR.`
    );
  }

  return normalized;
}

function normalizeRisk(risk) {
  const normalized = String(risk || 'BAIXO').trim().toUpperCase();

  if (!RISK_LEVELS.has(normalized)) {
    throw new Error(
      `Invalid risk level: ${normalized}. Expected BAIXO, MÉDIO or ALTO.`
    );
  }

  return normalized;
}

function prepareTask(description, options = {}) {
  const taskDescription = normalizeText(description);
  const mode = normalizeMode(options.mode);
  const risk = normalizeRisk(options.risk);

  const explicitExecutionAuthorization =
    options.authorizeExecution === true;

  return {
    schema: 'sdo.task.v1',

    task: {
      description: taskDescription,
      mode,
      risk,
      executionAllowed:
        explicitExecutionAuthorization
    },

    governance: {
      declarativeInspectionRequired: true,
      patchModeDefault: mode === 'PATCH',
      explicitExecutionAuthorizationRequired: true,
      explicitRefactorAuthorizationRequired:
        mode === 'REFRACTOR',
      physicalRepositoryValidationRequired: true
    }
  };
}

function main() {
  const description = process.argv.slice(2).join(' ');

  try {
    const result = prepareTask(description);
    process.stdout.write(
      `${JSON.stringify(result, null, 2)}\n`
    );
  } catch (error) {
    console.error(`SDO TASK PREPARATION ERROR: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  prepareTask
};
