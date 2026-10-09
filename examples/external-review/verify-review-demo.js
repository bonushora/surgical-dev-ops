#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  BASELINE_SHA,
  classifyReviewDemoPlatform,
  runReviewDemo
} = require('./run-review-demo');

const ROOT = path.resolve(__dirname, '../..');
const REQUIRED_PATHS = Object.freeze([
  'docs/review/REVIEWER-START-HERE.md',
  'docs/review/EXTERNAL-ENGINEERING-REVIEW-READINESS-v0.1.md',
  'docs/review/EXTERNAL-REVIEW-PACKAGE-MANIFEST-v0.1.md',
  'docs/adr/ADR-046-governed-isolated-execution-runtime.md',
  'docs/adr/ADR-047-portable-authorized-runtime-executable-binding.md',
  'docs/evidence/GOVERNED-ISOLATED-RUNTIME-PORTABLE-BINDING-v0.1.md',
  'docs/EXTERNAL_ENGINEERING_REVIEW.md',
  'docs/review/EXTERNAL_REVIEW_ACKNOWLEDGEMENTS.md',
  'docs/review/AGMI-STORE-HARDENING-v1.md',
  'docs/evidence/BH-CONTAINMENT-QUALIFICATION.md',
  'docs/evidence/BH-CONTAINMENT-HARDENING-V2.md',
  'examples/external-review/README.md',
  'examples/external-review/run-review-demo.js',
  'examples/external-review/verify-review-demo.js',
  'accelerator/core/execution-isolation/runtime-profile.js',
  'accelerator/core/execution-isolation/execution-envelope.js',
  'accelerator/adapters/linux-bwrap-execution-provider.js',
  'accelerator/core/capability-grant.js',
  'accelerator/core/surgical-orchestrator.js',
  'accelerator/core/git-manifest-cas.js',
  'accelerator/core/mutation-transaction.js',
  'accelerator/core/mutation-recovery.js',
  'accelerator/cli/natural-development-authorization-consumption.js',
  'tests/accelerator/external-review-demo.test.js',
  'tests/accelerator/execution-isolation-structural.test.js',
  'tests/accelerator/execution-isolation-live.test.js',
  'tests/accelerator/capability-grant.test.js',
  'tests/accelerator/human-identity-assertion.test.js',
  'tests/accelerator/natural-mission-scoped-mutation-authority-adversarial.test.js',
  'tests/accelerator/natural-development-g9-g10-crash-window-adversarial.test.js',
  'tests/accelerator/natural-development-agmi-store-hardening.test.js',
  'tests/accelerator/natural-development-production-antireplay-integration.test.js',
  'tests/accelerator/natural-development-workspace-substitution-adversarial.test.js',
  'tests/accelerator/git-manifest-cas.test.js',
  'tests/accelerator/mutation-recovery.test.js'
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function verifyPackagePaths() {
  for (const relative of REQUIRED_PATHS) {
    const absolute = path.join(ROOT, relative);
    assert.equal(fs.statSync(absolute).isFile(), true, `Missing review package path: ${relative}`);
  }
  const manifest = fs.readFileSync(path.join(
    ROOT, 'docs/review/EXTERNAL-REVIEW-PACKAGE-MANIFEST-v0.1.md'
  ), 'utf8');
  assert.match(manifest, new RegExp(BASELINE_SHA));
  assert.doesNotMatch(manifest, /\/(?:home|Users)\/[A-Za-z0-9._-]+\//);
  return REQUIRED_PATHS.length;
}

async function verifyReviewDemo() {
  if (classifyReviewDemoPlatform() !== 'SUPPORTED') {
    const error = new Error('The physical Bubblewrap demonstration is Linux-only.');
    error.code = 'UNSUPPORTED_PLATFORM';
    throw error;
  }
  const requiredPathCount = verifyPackagePaths();
  const run1 = await runReviewDemo();
  const run2 = await runReviewDemo();
  assert.equal(run1.result, 'PASS');
  assert.equal(run2.result, 'PASS');
  assert.equal(run1.requiredChecksFailed, 0);
  assert.equal(run2.requiredChecksFailed, 0);
  assert.equal(run1.requiredChecksSkipped, 0);
  assert.equal(run2.requiredChecksSkipped, 0);
  assert.equal(run1.securityDigest, run2.securityDigest);
  assert.deepEqual(run1.checks, run2.checks);

  return deepFreeze({
    schema: 'sdo.external-review-demo-verification/v1',
    baselineSha: BASELINE_SHA,
    harness: 'REVIEW_DEMONSTRATION_HARNESS',
    productionWiring: false,
    requiredPathCount,
    run1Result: 'PASS',
    run2Result: 'PASS',
    run1SecurityDigest: run1.securityDigest,
    run2SecurityDigest: run2.securityDigest,
    securityEvidenceMatch: true,
    requiredChecksFailed: 0,
    requiredChecksSkipped: 0,
    unauthorizedHostMutations: 0,
    result: 'PASS'
  });
}

if (require.main === module) {
  verifyReviewDemo().then((evidence) => {
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify({
      schema: 'sdo.external-review-demo-verification-error/v1',
      result: error && error.code === 'UNSUPPORTED_PLATFORM' ? 'UNSUPPORTED_PLATFORM' : 'FAIL',
      errorCode: String(error && error.code || 'VERIFICATION_FAILED').slice(0, 160)
    })}\n`);
    process.exitCode = error && error.code === 'UNSUPPORTED_PLATFORM' ? 2 : 1;
  });
}

module.exports = deepFreeze({ REQUIRED_PATHS, verifyPackagePaths, verifyReviewDemo });
