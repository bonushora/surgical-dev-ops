'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  provisionLocalOfflineHumanAuthority
} = require('../../accelerator/core/local-offline-human-authority-store');
const {
  createNaturalDevelopmentTaskContract
} = require('../../accelerator/cli/natural-development-task-contract');
const {
  materializeGovernedEngineeringProposal
} = require('../../accelerator/core/governed-engineering-proposal');
const {
  materializeNaturalDevelopmentPatchProposal
} = require('../../accelerator/cli/natural-development-patch-proposal');
const {
  materializeLocalNaturalDevelopmentAuthorization
} = require('../../accelerator/cli/natural-development-local-authorization');

const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function freeze(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') freeze(child);
  }
  return Object.freeze(value);
}

function proposal(root) {
  const before = 'module.exports = 1;\n';
  const after = 'module.exports = 2;\n';
  const contract = createNaturalDevelopmentTaskContract({
    objective: 'Update the fixture.',
    physicalWorkspaceIdentity: sha(root),
    repositoryPath: root,
    repositoryHead: 'a'.repeat(40),
    allowedTargets: ['fixture.js']
  });
  const planningBinding = freeze({
    schema: 'sdo.natural_development_planning_loop.v1',
    status: 'COMPLETED', contractFingerprint: contract.contractFingerprint,
    analysis: { status: 'COMPLETED' },
    evidence: [{ kind: 'READ_FILE', target: 'fixture.js', sha256: sha(before), bytes: Buffer.byteLength(before) }],
    response: 'ready', reason: null, pendingRequest: null,
    requiresNewHumanAuthority: false, reusableApproval: false,
    operationalAuthority: false, mutationAuthority: false,
    approvalAuthority: false, dispatchAuthority: false
  });
  const planningResult = freeze({
    ...planningBinding,
    planningFingerprint: sha(JSON.stringify(planningBinding))
  });
  const governedProposal = materializeGovernedEngineeringProposal({
    schema: 'sdo.ai_engineering_patch_proposal.v1',
    objective: contract.objective,
    target: 'fixture.js', beforeSha256: sha(before),
    replacementBase64: Buffer.from(after).toString('base64'),
    reason: 'Exact fixture update.', validationKind: 'VALIDATE_JS'
  });
  return materializeNaturalDevelopmentPatchProposal({
    contract, planningResult, governedProposal
  });
}

test('exact interactive decision becomes verified local single-use G4 evidence', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-local-g4-'));
  const authorityRoot = path.join(root, 'authority');
  const journalStorageRoot = path.join(root, 'journal');
  fs.mkdirSync(journalStorageRoot);
  provisionLocalOfflineHumanAuthority({
    authorityRoot, issuer: 'local:test', subjectId: 'human-test'
  });
  const patchProposal = proposal(root);
  const authorization = materializeLocalNaturalDevelopmentAuthorization({
    patchProposal,
    approvedProposalFingerprint: patchProposal.proposalFingerprint,
    physicalWorkspaceIdentity: sha(root),
    repositoryPath: root,
    authorityRoot,
    journalStorageRoot
  });

  assert.equal(authorization.state, 'AUTHORIZED_FOR_R3_COMPOSITION');
  assert.equal(authorization.singleUse, true);
  assert.equal(authorization.reusableApproval, false);
  assert.equal(authorization.proposalFingerprint, patchProposal.proposalFingerprint);
  assert.equal(Object.isFrozen(authorization), true);
});

test('local G4 refuses a decision for any other proposal fingerprint', () => {
  assert.throws(
    () => materializeLocalNaturalDevelopmentAuthorization({
      patchProposal: { proposalFingerprint: 'a'.repeat(64) },
      approvedProposalFingerprint: 'b'.repeat(64)
    }),
    /Exact reviewed proposal fingerprint/
  );
});
