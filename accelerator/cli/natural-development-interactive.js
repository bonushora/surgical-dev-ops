'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

const { discover } = require('../core/repository-discovery');
const {
  createNaturalDevelopmentTaskContract
} = require('./natural-development-task-contract');
const {
  runNaturalDevelopmentPlanningLoop
} = require('./natural-development-planning-loop');
const {
  materializeNaturalDevelopmentPatchProposal
} = require('./natural-development-patch-proposal');
const {
  materializeLocalNaturalDevelopmentAuthorization
} = require('./natural-development-local-authorization');
const {
  createNaturalDevelopmentEndToEndBoundary
} = require('./natural-development-end-to-end');

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function evidenceText(evidence) {
  return evidence.map((item, index) =>
    `EVIDENCE_${index + 1}:\n${JSON.stringify(item)}`
  ).join('\n\n').slice(0, 96000);
}

async function prepareInteractiveNaturalDevelopment({
  request,
  activation,
  cognitiveSession,
  dispatchEvidence,
  workMode = 'SUPERVISED_MICROTASKS'
} = {}) {
  if (
    !request || typeof request.objective !== 'string' ||
    typeof request.target !== 'string' ||
    !activation || typeof activation.repositoryPath !== 'string' ||
    !cognitiveSession || typeof cognitiveSession.proposePatch !== 'function'
  ) {
    throw new Error('Bounded interactive development request is required.');
  }

  const repository = discover(activation.repositoryPath);
  if (!repository.worktree.clean) {
    throw new Error('Interactive development requires a clean worktree.');
  }
  const repositoryPath = fs.realpathSync(repository.repository.path);
  const physicalWorkspaceIdentity = sha(repositoryPath);
  const contract = createNaturalDevelopmentTaskContract({
    objective: request.objective,
    physicalWorkspaceIdentity,
    repositoryHead: repository.repository.commit,
    workMode,
    allowedTargets: [request.target],
    validationKinds: ['VALIDATE_JS'],
    riskCeiling: 'R3'
  });
  const planningResult = await runNaturalDevelopmentPlanningLoop({
    contract,
    physicalWorkspaceIdentity,
    repositoryHead: repository.repository.commit,
    activation,
    cognitiveSession,
    ...(dispatchEvidence ? { dispatchEvidence } : {})
  });

  if (planningResult.status !== 'COMPLETED') {
    throw new Error('Governed development planning did not complete.');
  }
  const governedProposal = await cognitiveSession.proposePatch(
    request.objective,
    activation,
    evidenceText(planningResult.evidence)
  );
  const patchProposal = materializeNaturalDevelopmentPatchProposal({
    contract,
    planningResult,
    governedProposal,
    patchAttempt: 1
  });

  return freeze({
    schema: 'sdo.interactive_natural_development_pending.v1',
    state: 'EXACT_HUMAN_REVIEW_REQUIRED',
    contract,
    planningResult,
    governedProposal,
    patchProposal,
    physicalWorkspaceIdentity,
    repositoryPath,
    reusableApproval: false,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

async function approveInteractiveNaturalDevelopment({
  pending,
  approvedProposalFingerprint,
  authorityRoot,
  journalStorageRoot,
  tenantId = null,
  projectId = null
} = {}) {
  if (
    !pending || pending.state !== 'EXACT_HUMAN_REVIEW_REQUIRED' ||
    !Object.isFrozen(pending)
  ) {
    throw new Error('Immutable pending development proposal is required.');
  }

  const boundary = createNaturalDevelopmentEndToEndBoundary({
    materializeProposal() {
      return pending.patchProposal;
    },
    materializeAuthorization({ patchProposal }) {
      return materializeLocalNaturalDevelopmentAuthorization({
        patchProposal,
        approvedProposalFingerprint,
        physicalWorkspaceIdentity: pending.physicalWorkspaceIdentity,
        repositoryPath: pending.repositoryPath,
        authorityRoot,
        journalStorageRoot,
        tenantId,
        projectId
      });
    }
  });

  return boundary.execute({
    contract: pending.contract,
    planningResult: pending.planningResult,
    governedProposal: pending.governedProposal,
    physicalWorkspaceIdentity: pending.physicalWorkspaceIdentity,
    repositoryPath: pending.repositoryPath,
    authorityRoot,
    journalStorageRoot,
    tenantId,
    projectId
  });
}

module.exports = Object.freeze({
  prepareInteractiveNaturalDevelopment,
  approveInteractiveNaturalDevelopment
});
