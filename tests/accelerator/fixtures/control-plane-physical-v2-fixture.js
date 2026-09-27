'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { provisionLocalOfflineHumanAuthority } = require('../../../accelerator/core/local-offline-human-authority-store');
const { createAuthoritativeClock } = require('../../../accelerator/core/authoritative-clock');
const { createNaturalDevelopmentTaskContract } = require('../../../accelerator/cli/natural-development-task-contract');
const { materializeGovernedEngineeringProposal } = require('../../../accelerator/core/governed-engineering-proposal');
const { materializeNaturalDevelopmentPatchProposal } = require('../../../accelerator/cli/natural-development-patch-proposal');
const {
  AUTHORIZATION_AUDIENCE,
  HUMAN_DECISION_SCHEMA,
  materializeNaturalDevelopmentPatchAuthorization,
} = require('../../../accelerator/cli/natural-development-patch-authorization');
const { createDeterministicWorkspaceSession } = require('../../../accelerator/adapters/deterministic-workspace-session-adapter');
const { createNaturalAgenticMission } = require('../../../accelerator/core/natural-agentic-mission');
const gateway = require('../../../accelerator/core/integrated-governed-agent-gateway');
const { createGovernedPhysicalExecutor } = require('../../../accelerator/core/governed-physical-executor');

const BEFORE = 'const value = 1;\n';
const AFTER = 'const value = 2;\n';
const TARGET = 'target.js';

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, shell: false, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function temporal(wallTime) {
  const clock = createAuthoritativeClock({
    port: { read: () => ({
      schema: 'sdo.system_clock_observation.v1',
      availability: 'AVAILABLE',
      source: 'TEST',
      wallTime,
      monotonicNanoseconds: '1000000000',
    }) },
  });
  return { reading: clock.read(), requireCurrent: true };
}

function buildArtifacts(state, authorizedAt, expiresAt) {
  const physicalWorkspaceIdentity = sha(state.repositoryPath);
  const repositoryHead = git(state.repositoryPath, ['rev-parse', 'HEAD']);
  const contract = createNaturalDevelopmentTaskContract({
    objective: 'Change one exact governed JavaScript target.',
    physicalWorkspaceIdentity,
    repositoryHead,
    allowedTargets: [TARGET],
    patchAttemptCeiling: 1,
  });
  const planningBody = freeze({
    schema: 'sdo.natural_development_planning_loop.v1',
    status: 'COMPLETED',
    contractFingerprint: contract.contractFingerprint,
    analysis: { status: 'COMPLETED' },
    evidence: [{
      schema: 'sdo.natural_recursive_evidence.v1',
      kind: 'READ_FILE',
      target: TARGET,
      sha256: sha(BEFORE),
      bytes: Buffer.byteLength(BEFORE),
      summary: BEFORE,
    }],
    response: 'One exact patch is ready.',
    reason: null,
    pendingRequest: null,
    requiresNewHumanAuthority: false,
    reusableApproval: false,
    operationalAuthority: false,
    mutationAuthority: false,
    approvalAuthority: false,
    dispatchAuthority: false,
  });
  const planningResult = freeze({ ...planningBody, planningFingerprint: sha(JSON.stringify(planningBody)) });
  const governedProposal = materializeGovernedEngineeringProposal({
    schema: 'sdo.ai_engineering_patch_proposal.v1',
    objective: 'Change one exact governed JavaScript target.',
    target: TARGET,
    beforeSha256: sha(BEFORE),
    replacementBase64: Buffer.from(AFTER).toString('base64'),
    reason: 'Apply the exact reviewed correction.',
    validationKind: 'VALIDATE_JS',
  });
  const patchProposal = materializeNaturalDevelopmentPatchProposal({
    contract,
    planningResult,
    governedProposal,
    patchAttempt: 1,
  });
  const humanDecision = freeze({
    schema: HUMAN_DECISION_SCHEMA,
    decision: 'APPROVE_EXACT_PATCH',
    approved: true,
    proposalFingerprint: patchProposal.proposalFingerprint,
    diffFingerprint: patchProposal.exactDiff.diffFingerprint,
    target: TARGET,
    beforeSha256: patchProposal.beforeSha256,
    afterSha256: patchProposal.replacementSha256,
    humanSubject: 'human-physical-v2',
    authorizedAt,
    expiresAt,
  });
  const assertion = {
    schema: 'sdo.verified_human_identity_assertion.v1',
    verification: 'VERIFIED',
    assertionId: 'physical-v2-human-assertion',
    subject: { id: 'human-physical-v2', type: 'HUMAN' },
    issuer: 'local:physical-v2-human',
    authentication: { method: 'PUBLIC_KEY', context: 'LOCAL_OFFLINE' },
    issuedAt: new Date(Date.parse(authorizedAt) - 1000).toISOString(),
    expiresAt,
    audience: [AUTHORIZATION_AUDIENCE],
    operationId: `natural-development-patch:${patchProposal.proposalFingerprint}`,
    workspace: state.repositoryPath,
    tenantId: 'tenant-physical-v2',
    projectId: 'project-physical-v2',
    revocationStatus: 'NOT_REVOKED',
    verifiedAt: authorizedAt,
  };
  const patchAuthorization = materializeNaturalDevelopmentPatchAuthorization({
    patchProposal,
    humanDecision,
    verifiedHumanIdentityAssertion: assertion,
    temporalAuthority: temporal(new Date(Date.parse(authorizedAt) + 1).toISOString()),
  });
  return { contract, patchProposal, patchAuthorization, physicalWorkspaceIdentity, repositoryHead };
}

function createPhysicalV2Fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-physical-v2-'));
  const repositoryPath = path.join(root, 'repository');
  const authorityRoot = path.join(root, 'authority');
  const journalStorageRoot = path.join(root, 'journal');
  const registryStorageRoot = path.join(root, 'registry');
  fs.mkdirSync(repositoryPath);
  fs.mkdirSync(journalStorageRoot);
  fs.mkdirSync(registryStorageRoot);
  git(repositoryPath, ['init', '-b', 'main']);
  git(repositoryPath, ['config', 'user.email', 'physical-v2@example.invalid']);
  git(repositoryPath, ['config', 'user.name', 'Physical V2 Test']);
  fs.writeFileSync(path.join(repositoryPath, TARGET), BEFORE);
  git(repositoryPath, ['add', TARGET]);
  git(repositoryPath, ['commit', '-m', 'physical fixture']);
  provisionLocalOfflineHumanAuthority({
    authorityRoot,
    issuer: 'local:physical-v2-human',
    subjectId: 'human-physical-v2',
  });
  const state = {
    root,
    repositoryPath: fs.realpathSync(repositoryPath),
    authorityRoot: fs.realpathSync(authorityRoot),
    journalStorageRoot: fs.realpathSync(journalStorageRoot),
    registryStorageRoot: fs.realpathSync(registryStorageRoot),
  };
  const authorizedAt = new Date(Date.now() - 1000).toISOString();
  const expiresAt = new Date(Date.now() + 9 * 60_000).toISOString();
  const artifacts = buildArtifacts(state, authorizedAt, expiresAt);
  const session = createDeterministicWorkspaceSession({
    authorizedRoot: state.repositoryPath,
    humanSubject: 'human-physical-v2',
    authorizedAt,
  });
  const authorityReference = 'authority-physical-v2-once';
  const mission = createNaturalAgenticMission({
    missionId: 'mission-physical-v2-fixture',
    objective: 'Execute one governed physical v2 fixture mutation.',
    session,
    createdAt: authorizedAt,
    plan: [{ stepId: 'physical', summary: 'Apply exact authorized fixture patch.', status: 'ACTIVE' }],
    authority: {
      allowedCapabilities: ['mutation.applyConditional', 'mission.status', 'authority.inspect'],
      grants: [{
        authorityRef: authorityReference,
        capability: 'mutation.applyConditional',
        issuedAt: authorizedAt,
        expiresAt,
        lifetime: 'ONE_SHOT',
        authorityNotGranted: ['git.push', 'npm.publish'],
      }],
    },
    provider: {},
  });
  const physicalExecution = freeze({
    target: TARGET,
    beforeSha256: artifacts.patchProposal.beforeSha256,
    afterSha256: artifacts.patchProposal.replacementSha256,
    contractFingerprint: artifacts.contract.contractFingerprint,
    proposalFingerprint: artifacts.patchProposal.proposalFingerprint,
    authorizationFingerprint: artifacts.patchAuthorization.authorizationFingerprint,
    executionReference: 'execution-physical-v2-fixture',
  });
  const binding = freeze({
    principal: { type: 'agent', id: 'agent-physical-v2-fixture' },
    authority: { reference: authorityReference, delegationReference: 'delegation-physical-v2-fixture' },
    approvalReference: `approval-${artifacts.patchAuthorization.authorizationFingerprint.slice(0, 24)}`,
    workspace: { path: state.repositoryPath, physicalIdentity: mission.binding.physicalWorkspaceIdentity },
    repository: { id: 'repository-physical-v2-fixture', head: artifacts.repositoryHead },
    expectedState: {
      repositoryHead: artifacts.repositoryHead,
      worktreeFingerprint: mission.binding.worktreeFingerprint,
      cas: sha(`${artifacts.repositoryHead}\0${mission.binding.worktreeFingerprint}`),
    },
    physicalExecution,
  });
  const request = freeze({
    protocolVersion: 'sacp.sdo-local/v2',
    requestId: 'request-physical-v2-fixture',
    operationId: 'operation-physical-v2-fixture',
    idempotencyKey: 'idempotency-physical-v2-fixture',
    intentFingerprint: sha('physical-v2-fixture-intent'),
    principal: binding.principal,
    authority: binding.authority,
    requestedCapability: 'mutation.applyConditional',
    workspace: binding.workspace,
    repository: binding.repository,
    expectedState: binding.expectedState,
    approvalReference: binding.approvalReference,
    submittedAt: authorizedAt,
    physicalExecution,
  });
  const naturalDevelopment = freeze({
    contract: artifacts.contract,
    patchProposal: artifacts.patchProposal,
    patchAuthorization: artifacts.patchAuthorization,
    physicalWorkspaceIdentity: artifacts.physicalWorkspaceIdentity,
    repositoryPath: state.repositoryPath,
    authorityRoot: state.authorityRoot,
    journalStorageRoot: state.journalStorageRoot,
    tenantId: 'tenant-physical-v2',
    projectId: 'project-physical-v2',
  });
  let lastPhysicalEvidence = null;
  let lastManagedProjection = null;

  function createExecutor() {
    return createGovernedPhysicalExecutor({
      resolveAuthorizedExecution: async () => freeze({ binding, mission, naturalDevelopment }),
      reconcilePhysicalEvidence: async () => lastPhysicalEvidence
        ? freeze({ classification: 'succeeded', code: 'PHYSICAL_MUTATION_RECOVERED', physicalEvidence: lastPhysicalEvidence })
        : freeze({ classification: 'unknown', code: 'PHYSICAL_EVIDENCE_UNKNOWN' }),
      dispatchGatewayRequest(input) {
        const result = gateway.dispatchGatewayRequest(input);
        if (result.result.classification === 'SUCCESS' && result.result.data) {
          lastManagedProjection = result.result.data.composition.managedProjection;
          lastPhysicalEvidence = freeze({
            transactionId: result.result.data.transactionId,
            journalId: result.result.data.journalId,
            recoveryStatus: 'COMMITTED',
            effectFingerprint: result.result.data.composition.effectFingerprint,
          });
        }
        return result;
      },
      now: () => new Date().toISOString(),
    });
  }

  return freeze({
    ...state,
    before: BEFORE,
    after: AFTER,
    target: TARGET,
    binding,
    request,
    physicalExecution,
    artifacts,
    createExecutor,
    readRecoveredEvidence: () => lastPhysicalEvidence,
    readManagedProjection: () => lastManagedProjection,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  });
}

module.exports = Object.freeze({ BEFORE, AFTER, TARGET, sha, createPhysicalV2Fixture });
