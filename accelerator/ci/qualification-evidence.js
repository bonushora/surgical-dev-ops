'use strict';

const fs = require('node:fs');

const SCHEMA = 'sdo.qualification_evidence.v1';
const PRODUCER_SOURCE = 'accelerator/ci/qualification-evidence.js';
const WORKFLOW_FILE = '.github/workflows/accelerator-conformance.yml';
const CANONICAL_COMMAND = 'npm test';
const FULL_SHA = /^[0-9a-f]{40}$/;
const PLATFORMS = Object.freeze({
  linux: 'Linux',
  darwin: 'macOS',
  win32: 'Windows'
});

function fail(message) {
  throw new Error(`QUALIFICATION_EVIDENCE_INVALID: ${message}`);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    fail(`${label} has an unexpected or missing field: ${actual.join(',')}`);
  }
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    fail(`${label} must be a non-empty canonical string`);
  }
  return value;
}

function positiveIntegerString(value, label) {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) {
    fail(`${label} must be a positive integer string`);
  }
  return value;
}

function fullSha(value, label) {
  if (typeof value !== 'string' || !FULL_SHA.test(value)) {
    fail(`${label} must be a full lowercase Git SHA`);
  }
  return value;
}

function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
}

function parseCanonicalSummary(log) {
  if (typeof log !== 'string' || log.length === 0) {
    fail('canonical summary log is missing');
  }
  const normalized = stripAnsi(log);
  const labels = ['tests', 'suites', 'pass', 'fail', 'cancelled', 'skipped', 'todo'];
  const counts = {};

  for (const label of labels) {
    const matches = [...normalized.matchAll(
      new RegExp(`^\\s*(?:ℹ\\s+)?${label}\\s+([0-9]+)\\s*$`, 'gmi')
    )];
    if (matches.length !== 1) {
      fail(`${label} summary must occur exactly once; observed ${matches.length}`);
    }
    counts[label] = Number(matches[0][1]);
    nonNegativeInteger(counts[label], `canonicalTest.counts.${label}`);
  }

  const accounted = counts.pass + counts.fail + counts.cancelled +
    counts.skipped + counts.todo;
  if (counts.tests !== accounted) {
    fail(`canonical test total is inconsistent: tests=${counts.tests}, accounted=${accounted}`);
  }
  return counts;
}

function validateQualificationEvidence(evidence) {
  exactKeys(evidence, [
    'schema',
    'repository',
    'workflow',
    'git',
    'runner',
    'runtime',
    'canonicalTest',
    'producer',
    'externalReviewCompleted',
    'releaseAuthorized'
  ], 'evidence');
  if (evidence.schema !== SCHEMA) fail('unsupported schema');
  if (evidence.repository !== 'bonushora/surgical-dev-ops') fail('unexpected repository identity');

  exactKeys(evidence.workflow, [
    'name', 'file', 'runId', 'runAttempt', 'event', 'requestedQualificationRef'
  ], 'workflow');
  if (evidence.workflow.name !== 'Accelerator Conformance') fail('unexpected workflow identity');
  if (evidence.workflow.file !== WORKFLOW_FILE) fail('unexpected workflow file');
  positiveIntegerString(evidence.workflow.runId, 'workflow.runId');
  positiveIntegerString(evidence.workflow.runAttempt, 'workflow.runAttempt');
  if (!['workflow_dispatch', 'push', 'pull_request'].includes(evidence.workflow.event)) {
    fail('unsupported workflow event');
  }

  exactKeys(evidence.git, [
    'expectedTargetSha', 'checkedOutSha', 'githubSha'
  ], 'git');
  const target = fullSha(evidence.git.expectedTargetSha, 'expected target SHA');
  const checkedOut = fullSha(evidence.git.checkedOutSha, 'checked-out SHA');
  const github = fullSha(evidence.git.githubSha, 'GitHub SHA');
  if (target !== checkedOut || target !== github) {
    fail('target SHA, checked-out SHA and GitHub SHA must match');
  }
  if (evidence.workflow.event === 'workflow_dispatch') {
    const requested = fullSha(
      evidence.workflow.requestedQualificationRef,
      'requested qualification ref'
    );
    if (requested !== target) fail('requested qualification ref does not match target SHA');
  } else if (evidence.workflow.requestedQualificationRef !== null) {
    fail('requested qualification ref must be null outside workflow_dispatch');
  }

  exactKeys(evidence.runner, ['label', 'os', 'platform', 'architecture'], 'runner');
  nonEmptyString(evidence.runner.label, 'runner.label');
  if (PLATFORMS[evidence.runner.platform] !== evidence.runner.os) {
    fail('unknown or inconsistent platform identity');
  }
  if (!['x64', 'arm64'].includes(evidence.runner.architecture)) {
    fail('unsupported runner architecture');
  }

  exactKeys(evidence.runtime, ['nodeVersion'], 'runtime');
  if (evidence.runtime.nodeVersion !== 'v24.18.0') fail('unexpected Node version');

  exactKeys(evidence.canonicalTest, ['command', 'exitCode', 'result', 'counts'], 'canonicalTest');
  if (evidence.canonicalTest.command !== CANONICAL_COMMAND) fail('unexpected canonical command');
  nonNegativeInteger(evidence.canonicalTest.exitCode, 'canonicalTest.exitCode');
  if (!['PASS', 'FAIL'].includes(evidence.canonicalTest.result)) {
    fail('unknown canonical result');
  }
  exactKeys(evidence.canonicalTest.counts, [
    'tests', 'suites', 'pass', 'fail', 'cancelled', 'skipped', 'todo'
  ], 'canonicalTest.counts');
  for (const [key, value] of Object.entries(evidence.canonicalTest.counts)) {
    nonNegativeInteger(value, `canonicalTest.counts.${key}`);
  }
  const counts = evidence.canonicalTest.counts;
  const accounted = counts.pass + counts.fail + counts.cancelled + counts.skipped + counts.todo;
  if (counts.tests !== accounted) fail('canonical counts are not internally consistent');
  const pass = evidence.canonicalTest.exitCode === 0 && counts.fail === 0 && counts.cancelled === 0;
  if ((evidence.canonicalTest.result === 'PASS') !== pass) {
    fail('canonical result contradicts exit code or failure counts');
  }

  exactKeys(evidence.producer, ['source', 'version'], 'producer');
  if (evidence.producer.source !== PRODUCER_SOURCE || evidence.producer.version !== 1) {
    fail('unsupported evidence producer');
  }
  if (evidence.externalReviewCompleted !== false) fail('external review cannot be promoted');
  if (evidence.releaseAuthorized !== false) fail('release cannot be authorized by evidence');
  return evidence;
}

function createQualificationEvidence(input) {
  exactKeys(input, [
    'log',
    'testExitCode',
    'repository',
    'workflowName',
    'workflowFile',
    'runId',
    'runAttempt',
    'event',
    'requestedQualificationRef',
    'expectedTargetSha',
    'checkedOutSha',
    'githubSha',
    'runnerOs',
    'platform',
    'architecture',
    'nodeVersion'
  ], 'producer input');
  const counts = parseCanonicalSummary(input.log);
  const exitCode = typeof input.testExitCode === 'string'
    ? Number(input.testExitCode)
    : input.testExitCode;
  nonNegativeInteger(exitCode, 'canonical test exit code');
  if (exitCode === 0 && (counts.fail !== 0 || counts.cancelled !== 0)) {
    fail('zero exit code contradicts canonical failure counts');
  }

  const evidence = {
    schema: SCHEMA,
    repository: input.repository,
    workflow: {
      name: input.workflowName,
      file: input.workflowFile,
      runId: String(input.runId),
      runAttempt: String(input.runAttempt),
      event: input.event,
      requestedQualificationRef: input.event === 'workflow_dispatch'
        ? input.requestedQualificationRef
        : null
    },
    git: {
      expectedTargetSha: input.expectedTargetSha,
      checkedOutSha: input.checkedOutSha,
      githubSha: input.githubSha
    },
    runner: {
      label: input.runnerOs,
      os: PLATFORMS[input.platform] || input.runnerOs,
      platform: input.platform,
      architecture: input.architecture
    },
    runtime: {
      nodeVersion: input.nodeVersion
    },
    canonicalTest: {
      command: CANONICAL_COMMAND,
      exitCode,
      result: exitCode === 0 ? 'PASS' : 'FAIL',
      counts
    },
    producer: {
      source: PRODUCER_SOURCE,
      version: 1
    },
    externalReviewCompleted: false,
    releaseAuthorized: false
  };
  return validateQualificationEvidence(evidence);
}

function serializeQualificationEvidence(evidence) {
  validateQualificationEvidence(evidence);
  return `${JSON.stringify(evidence, null, 2)}\n`;
}

function fromEnvironment(environment, log) {
  return createQualificationEvidence({
    log,
    testExitCode: environment.CANONICAL_TEST_EXIT_CODE,
    repository: environment.GITHUB_REPOSITORY,
    workflowName: environment.GITHUB_WORKFLOW,
    workflowFile: WORKFLOW_FILE,
    runId: environment.GITHUB_RUN_ID,
    runAttempt: environment.GITHUB_RUN_ATTEMPT,
    event: environment.GITHUB_EVENT_NAME,
    requestedQualificationRef: environment.REQUESTED_QUALIFICATION_REF,
    expectedTargetSha: environment.EXPECTED_TARGET_SHA,
    checkedOutSha: environment.CHECKED_OUT_SHA,
    githubSha: environment.GITHUB_SHA,
    runnerOs: environment.RUNNER_OS,
    platform: process.platform,
    architecture: process.arch,
    nodeVersion: process.version
  });
}

if (require.main === module) {
  const log = fs.readFileSync('native-test.log', 'utf8');
  const evidence = fromEnvironment(process.env, log);
  fs.writeFileSync('qualification-evidence.json', serializeQualificationEvidence(evidence), {
    encoding: 'utf8',
    flag: 'wx'
  });
}

module.exports = {
  SCHEMA,
  parseCanonicalSummary,
  createQualificationEvidence,
  validateQualificationEvidence,
  serializeQualificationEvidence,
  fromEnvironment
};
