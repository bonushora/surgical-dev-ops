'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  SCHEMA,
  parseCanonicalSummary,
  createQualificationEvidence,
  validateQualificationEvidence,
  serializeQualificationEvidence
} = require('../../accelerator/ci/qualification-evidence');

const SHA = 'a'.repeat(40);

function summary({
  tests = 10,
  pass = 8,
  fail = 0,
  cancelled = 0,
  skipped = 2,
  todo = 0,
  suites = 0
} = {}) {
  return [
    `\u001b[34mℹ tests ${tests}\u001b[39m`,
    `ℹ suites ${suites}`,
    `ℹ pass ${pass}`,
    `ℹ fail ${fail}`,
    `ℹ cancelled ${cancelled}`,
    `ℹ skipped ${skipped}`,
    `ℹ todo ${todo}`,
    'ℹ duration_ms 123.45'
  ].join('\n');
}

function input(overrides = {}) {
  return {
    log: summary(),
    testExitCode: 0,
    repository: 'bonushora/surgical-dev-ops',
    workflowName: 'Accelerator Conformance',
    workflowFile: '.github/workflows/accelerator-conformance.yml',
    runId: '123456789',
    runAttempt: '1',
    event: 'workflow_dispatch',
    requestedQualificationRef: SHA,
    expectedTargetSha: SHA,
    checkedOutSha: SHA,
    githubSha: SHA,
    runnerOs: 'Linux',
    platform: 'linux',
    architecture: 'x64',
    nodeVersion: 'v24.18.0',
    ...overrides
  };
}

test('successful canonical summary yields stable exact-count PASS evidence', () => {
  const evidence = createQualificationEvidence(input());
  assert.equal(evidence.schema, 'sdo.qualification_evidence.v1');
  assert.equal(evidence.schema, SCHEMA);
  assert.deepEqual(evidence.canonicalTest, {
    command: 'npm test',
    exitCode: 0,
    result: 'PASS',
    counts: {
      tests: 10,
      suites: 0,
      pass: 8,
      fail: 0,
      cancelled: 0,
      skipped: 2,
      todo: 0
    }
  });
  assert.equal(evidence.externalReviewCompleted, false);
  assert.equal(evidence.releaseAuthorized, false);
  assert.deepEqual(JSON.parse(serializeQualificationEvidence(evidence)), evidence);
});

test('failing canonical execution remains FAIL and cannot be upgraded', () => {
  const evidence = createQualificationEvidence(input({
    log: summary({ tests: 10, pass: 8, fail: 1, skipped: 1 }),
    testExitCode: 2
  }));
  assert.equal(evidence.canonicalTest.exitCode, 2);
  assert.equal(evidence.canonicalTest.result, 'FAIL');
  assert.equal(evidence.canonicalTest.counts.fail, 1);
});

test('missing malformed duplicate or conflicting summaries fail closed', () => {
  assert.throws(() => parseCanonicalSummary('no summary'), /summary/i);
  assert.throws(() => parseCanonicalSummary('ℹ tests ten'), /summary/i);
  assert.throws(() => parseCanonicalSummary(`${summary()}\n${summary()}`), /duplicate|summary/i);
  assert.throws(
    () => parseCanonicalSummary(`${summary()}\n${summary({ tests: 9, pass: 7 })}`),
    /duplicate|conflict|summary/i
  );
});

test('inconsistent totals and false successful summaries fail closed', () => {
  assert.throws(
    () => createQualificationEvidence(input({
      log: summary({ tests: 11, pass: 8, skipped: 2 })
    })),
    /total|consistent/i
  );
  assert.throws(
    () => createQualificationEvidence(input({
      log: summary({ tests: 10, pass: 8, fail: 1, skipped: 1 }),
      testExitCode: 0
    })),
    /exit|failure|pass/i
  );
});

test('exact-ref evidence binds target to checkout while preserving workflow trigger SHA', () => {
  for (const overrides of [
    { expectedTargetSha: '' },
    { expectedTargetSha: 'abc' },
    { checkedOutSha: 'b'.repeat(40) },
    { requestedQualificationRef: 'refs/heads/main' }
  ]) {
    assert.throws(() => createQualificationEvidence(input(overrides)), /SHA|ref|target/i);
  }

  const triggerSha = 'b'.repeat(40);
  const dispatched = createQualificationEvidence(input({ githubSha: triggerSha }));
  assert.equal(dispatched.git.expectedTargetSha, SHA);
  assert.equal(dispatched.git.checkedOutSha, SHA);
  assert.equal(dispatched.git.githubSha, triggerSha);

  assert.throws(
    () => createQualificationEvidence(input({
      event: 'push',
      requestedQualificationRef: '',
      githubSha: triggerSha
    })),
    /GitHub SHA|target SHA/i
  );
});

test('unknown platforms and unsupported schemas cannot become qualified', () => {
  assert.throws(
    () => createQualificationEvidence(input({ platform: 'plan9' })),
    /platform/i
  );
  const evidence = createQualificationEvidence(input());
  assert.throws(
    () => validateQualificationEvidence({ ...evidence, schema: 'sdo.qualification_evidence.v2' }),
    /schema/i
  );
  for (const result of ['UNKNOWN', 'SKIPPED']) {
    assert.throws(
      () => validateQualificationEvidence({
        ...evidence,
        canonicalTest: { ...evidence.canonicalTest, result }
      }),
      /result/i
    );
  }
  const failed = createQualificationEvidence(input({
    log: summary({ tests: 10, pass: 8, fail: 1, skipped: 1 }),
    testExitCode: 1
  }));
  assert.throws(
    () => validateQualificationEvidence({
      ...failed,
      canonicalTest: { ...failed.canonicalTest, result: 'PASS' }
    }),
    /contradicts/i
  );
});

test('evidence validation rejects secret-bearing or authority-shaped fields', () => {
  const evidence = createQualificationEvidence(input());
  assert.throws(
    () => validateQualificationEvidence({ ...evidence, token: 'secret' }),
    /field|token|secret/i
  );
  assert.throws(
    () => validateQualificationEvidence({
      ...evidence,
      executionAuthorityUrl: 'https://example.invalid/run'
    }),
    /field|authority|url/i
  );
});

test('evidence producer has no Git shell or network execution authority', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../../accelerator/ci/qualification-evidence.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /node:child_process|\bexec(?:File|Sync)?\s*\(|\bspawn(?:Sync)?\s*\(/);
  assert.doesNotMatch(source, /node:(?:http|https|net)|\bfetch\s*\(/);
});
