'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyReviewDemoPlatform
} = require('../../examples/external-review/run-review-demo');
const {
  verifyReviewDemo
} = require('../../examples/external-review/verify-review-demo');

test('external review demo executes twice on Linux and reports other platforms honestly', async () => {
  if (process.platform !== 'linux') {
    assert.equal(classifyReviewDemoPlatform(), 'UNSUPPORTED_PLATFORM');
    return;
  }

  const evidence = await verifyReviewDemo();
  assert.equal(evidence.run1Result, 'PASS');
  assert.equal(evidence.run2Result, 'PASS');
  assert.equal(evidence.securityEvidenceMatch, true);
  assert.equal(evidence.requiredChecksFailed, 0);
  assert.equal(evidence.requiredChecksSkipped, 0);
  assert.equal(evidence.unauthorizedHostMutations, 0);
  assert.equal(evidence.productionWiring, false);
  assert.equal(evidence.result, 'PASS');
});
