'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('frozen customer-operable commercial beta candidate binds exact artifacts and human acceptance', () => {
  const candidate = JSON.parse(read(
    'docs/review/CUSTOMER_OPERABLE_COMMERCIAL_BETA_CANDIDATE_2026-10-02.json'
  ));

  assert.equal(
    candidate.schema,
    'sdo.customer_operable_commercial_beta_candidate.v1'
  );
  assert.equal(
    candidate.classification,
    'CUSTOMER_OPERABLE_COMMERCIAL_BETA_CANDIDATE'
  );
  assert.equal(candidate.date, '2026-10-02');

  assert.equal(candidate.humanAcceptance.classification, 'GREEN');
  assert.equal(candidate.humanAcceptance.automationSigned, false);

  for (let step = 1; step <= 12; step += 1) {
    assert.equal(candidate.humanAcceptance.steps[String(step)], 'GREEN');
  }

  assert.deepEqual(
    candidate.candidate.surgicalDevOps,
    {
      version: '2.6.0-rc.6',
      sourceCommit: '2b735ceb67512f0ecfca951ced69b91ad3b64e31',
      artifactSha256: 'd65cf44eb7368bda565e6e5594ba46fb496d22e944c80ede01adca1e41ff2045',
      artifactBytes: 804153,
      artifactFiles: 219
    }
  );

  assert.deepEqual(
    candidate.candidate.surgicalAiControlPlane,
    {
      version: '0.1.0-beta.1',
      sourceCommit: '6fc4baf4fd022fff9070d20d11be7c5f53cca024',
      artifactSha256: '66b652706ec6c41ad60ab206a2df18be13f1798f7dd50bd0980708bcc2bba46b',
      artifactBytes: 53247,
      artifactFiles: 36
    }
  );

  assert.equal(candidate.manualPhysicalEvidence.physicalEffects, 1);
  assert.equal(candidate.manualPhysicalEvidence.replayPhysicalEffects, 0);
  assert.equal(candidate.manualPhysicalEvidence.mutationJournalRecords, 9);
  assert.equal(candidate.manualPhysicalEvidence.authorizationConsumptionRecords, 1);
  assert.equal(candidate.manualPhysicalEvidence.authorityResurrectedAfterRestart, false);
  assert.equal(candidate.manualPhysicalEvidence.uninstallEvidencePreserved, true);
  assert.equal(candidate.manualPhysicalEvidence.uninstallRepositoriesUntouched, true);

  assert.equal(candidate.explicitNonClaims.productionEnabled, false);
  assert.equal(candidate.explicitNonClaims.generalAvailability, false);
  assert.equal(candidate.explicitNonClaims.stableReleaseAuthorized, false);
  assert.equal(candidate.explicitNonClaims.externalReviewCompleted, false);
  assert.equal(candidate.explicitNonClaims.independentAuditCompleted, false);
  assert.equal(candidate.explicitNonClaims.publicExposureAuthorized, false);
  assert.equal(candidate.explicitNonClaims.absoluteSecurity, false);
  assert.equal(candidate.explicitNonClaims.regulatoryCertification, false);

  assert.equal(
    candidate.nextGate,
    'EXTERNAL_ENGINEERING_AND_ADVERSARIAL_REVIEW'
  );
});

test('human acceptance record preserves the same qualification boundary', () => {
  const acceptance = read(
    'docs/review/HUMAN_ACCEPTANCE_2026-10-02.md'
  );

  assert.match(acceptance, /HUMAN_MANUAL_ACCEPTANCE = GREEN/);
  assert.match(
    acceptance,
    /2b735ceb67512f0ecfca951ced69b91ad3b64e31/
  );
  assert.match(
    acceptance,
    /6fc4baf4fd022fff9070d20d11be7c5f53cca024/
  );
  assert.match(
    acceptance,
    /d65cf44eb7368bda565e6e5594ba46fb496d22e944c80ede01adca1e41ff2045/
  );
  assert.match(
    acceptance,
    /66b652706ec6c41ad60ab206a2df18be13f1798f7dd50bd0980708bcc2bba46b/
  );

  for (const nonClaim of [
    /production enablement/i,
    /general availability/i,
    /stable release/i,
    /completed external review/i,
    /independent audit/i,
    /public exposure/i,
    /absolute security/i,
    /regulatory certification/i
  ]) {
    assert.match(acceptance, nonClaim);
  }
});

test('external-review qualification manifest remains a separate unresolved gate', () => {
  const manifest = JSON.parse(
    read('docs/review/QUALIFICATION_MANIFEST.json')
  );

  assert.equal(
    manifest.schema,
    'sdo.external_review_qualification_manifest.v2'
  );
  assert.equal(manifest.externalReviewStatus.completed, false);
  assert.equal(manifest.externalReviewStatus.releaseAuthorized, false);
  assert.equal(manifest.externalReviewStatus.publicExposureAuthorized, false);
  assert.equal(manifest.claims.absoluteSecurity, false);
  assert.equal(manifest.claims.independentAuditCompleted, false);
});
