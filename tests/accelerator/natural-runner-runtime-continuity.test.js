'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  createNaturalRunnerRuntime
} = require('../../accelerator/cli/natural-runner-runtime');

const root = path.resolve(__dirname, '../..');

function pending() {
  return Object.freeze({
    state: 'EXACT_HUMAN_REVIEW_REQUIRED',
    patchProposal: Object.freeze({
      proposalFingerprint: 'a'.repeat(64)
    })
  });
}

test('RUNNER runtime is continuity state only and exposes zero authority', () => {
  const runner = createNaturalRunnerRuntime();
  const started = runner.start();

  assert.equal(started.state, 'CONTINUING');
  assert.equal(started.boundary, 'AUTHORIZED_BOUNDED_CONTINUITY');
  assert.equal(started.continuationAuthority, false);
  assert.equal(started.operationalAuthority, false);
  assert.equal(started.mutationAuthority, false);
  assert.equal(started.approvalAuthority, false);
  assert.equal(started.publicationAuthority, false);
  assert.equal(started.authorityExpansion, false);
});

test('exact proposal moves RUNNER to human review without approving it', () => {
  const runner = createNaturalRunnerRuntime();
  runner.start();
  const state = runner.exactHumanReviewRequired(pending());

  assert.equal(state.state, 'EXACT_HUMAN_REVIEW_REQUIRED');
  assert.equal(state.boundary, 'HUMAN_AUTHORITY_REQUIRED');
  assert.equal(state.detail, 'a'.repeat(64));
  assert.equal(state.mutationAuthority, false);
  assert.equal(state.approvalAuthority, false);
});

test('completed effect is accepted only as evidence after external governed approval path', () => {
  const runner = createNaturalRunnerRuntime();
  runner.start();
  runner.exactHumanReviewRequired(pending());

  const state = runner.authorizedEffectCompleted(Object.freeze({
    target: 'accelerator/cli/example.js',
    beforeSha256: 'b'.repeat(64),
    afterSha256: 'c'.repeat(64)
  }));

  assert.equal(state.state, 'AUTHORIZED_EFFECT_COMPLETED');
  assert.equal(state.boundary, 'NEXT_DETERMINISTIC_STEP');
  assert.equal(state.mutationAuthority, false);
  assert.equal(state.approvalAuthority, false);
});

test('stop cancel and failure are explicit safe boundaries', () => {
  const stopped = createNaturalRunnerRuntime().stop();
  assert.equal(stopped.state, 'SAFE_STOPPED');
  assert.equal(stopped.boundary, 'USER_SAFE_STOP');

  const cancelled = createNaturalRunnerRuntime().cancelPending();
  assert.equal(cancelled.state, 'SAFE_STOPPED');
  assert.equal(cancelled.boundary, 'HUMAN_CANCELLED');

  const failed = createNaturalRunnerRuntime().failClosed('test failure');
  assert.equal(failed.state, 'FAILED_CLOSED');
  assert.equal(failed.boundary, 'FAIL_CLOSED');
});

test('surgical runtime composes RUNNER around but never replaces exact patch approval', () => {
  const source = fs.readFileSync(
    path.join(root, 'accelerator/cli/surgical.js'),
    'utf8'
  );

  assert.match(source, /createNaturalRunnerRuntime/);
  assert.match(source, /controlled\.action === 'RUNNER_START'/);
  assert.match(source, /controlled\.action === 'RUNNER_STATUS'/);
  assert.match(source, /controlled\.action === 'RUNNER_STOP'/);
  assert.match(source, /runnerRuntime\.exactHumanReviewRequired/);
  assert.match(source, /runnerRuntime\.authorizedEffectCompleted/);

  assert.match(
    source,
    /\^\(\?:aprovar\|approve\) patch \(\[a-f0-9\]\{64\}\)\$/m
  );
  assert.match(
    source,
    /approval\s*&&\s*approval\[1\]\.toLowerCase\(\)\s*===\s*fingerprint/m
  );
  assert.match(
    source,
    /approvedProposalFingerprint:\s*fingerprint/m
  );
});

test('RUNNER runtime module contains no execution publication or generic shell surface', () => {
  const source = fs.readFileSync(
    path.join(root, 'accelerator/cli/natural-runner-runtime.js'),
    'utf8'
  );

  assert.doesNotMatch(
    source,
    /child_process|execSync|spawn|fetch\(|node:http|node:https|git push|writeFileSync|orchestrate\(|dispatchGovernedPatch/
  );
});
