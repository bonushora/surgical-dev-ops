'use strict';

const crypto = require('node:crypto');
const { SESSION_SCHEMA, REVALIDATION_SCHEMA } = require('../adapters/deterministic-workspace-session-adapter');
const { createGovernedWorkspaceDiscoveryIndex, searchGovernedWorkspaceDiscovery } = require('../core/governed-workspace-discovery-index');
const { createSensitiveContentPolicy } = require('../core/sensitive-content-boundary');
const { createQualifiedCommandCatalog } = require('../core/qualified-command-catalog');
const { createGovernedWorkspaceAudit, appendGovernedWorkspaceAuditEvent } = require('../core/governed-workspace-audit');
const { evaluateNaturalTaskEnvelopeOperation } = require('./natural-task-envelope-authorization');

const EXPERIENCE_SCHEMA = 'sdo.natural_governed_workspace_experience.v1';
const MICROREAD_SCHEMA = 'sdo.natural_governed_workspace_microread.v1';
const MUTATION_REVIEW_SCHEMA = 'sdo.natural_governed_workspace_mutation_review.v1';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function openNaturalGovernedWorkspaceExperience({ session, revalidation, governedInventory, observedAt } = {}) {
  if (!session || session.schema !== SESSION_SCHEMA || !Object.isFrozen(session)) throw new Error('Immutable deterministic workspace session is required.');
  if (!revalidation || revalidation.schema !== REVALIDATION_SCHEMA || !Object.isFrozen(revalidation) || revalidation.sessionFingerprint !== session.sessionFingerprint || revalidation.decision !== 'VALID') {
    throw new Error('Fresh valid workspace-session revalidation is required.');
  }
  const execution = governedInventory?.execution;
  if (governedInventory?.orchestration?.status !== 'COMPLETED' || execution?.schema !== 'sdo.git_read_result.v1' || execution.selector !== 'WORKSPACE_FILES' || !Array.isArray(execution.result?.files)) {
    throw new Error('Canonical governed workspace inventory evidence is required.');
  }
  const binding = { physicalWorkspaceIdentity: session.physicalWorkspaceIdentity, repositoryHead: session.repositoryHead, worktreeFingerprint: session.worktreeFingerprint };
  const discoveryIndex = createGovernedWorkspaceDiscoveryIndex({ ...binding, files: execution.result.files });
  let audit = createGovernedWorkspaceAudit({ sessionFingerprint: session.sessionFingerprint, physicalWorkspaceIdentity: session.physicalWorkspaceIdentity });
  audit = appendGovernedWorkspaceAuditEvent(audit, { kind: 'SESSION_REVALIDATED', observedAt, operationFingerprint: fingerprint(revalidation), outcome: 'VALID' });
  audit = appendGovernedWorkspaceAuditEvent(audit, { kind: 'DISCOVERY', observedAt, operationFingerprint: discoveryIndex.indexFingerprint, outcome: 'COMPLETED' });
  const base = {
    schema: EXPERIENCE_SCHEMA,
    session,
    binding: deepFreeze(binding),
    discoveryIndex,
    sensitiveContentPolicy: createSensitiveContentPolicy(),
    qualifiedCommandCatalog: createQualifiedCommandCatalog(),
    audit,
    providerDirectFilesystem: false,
    providerDirectShell: false,
    providerDirectGit: false,
    providerDirectNetwork: false,
    readImpliesMutation: false,
    persistentContextAuthoritative: false,
    operationalAuthority: false,
    mutationAuthority: false
  };
  return deepFreeze({ ...base, experienceFingerprint: fingerprint(base) });
}

function searchNaturalGovernedWorkspace(experience, query) {
  if (!experience || experience.schema !== EXPERIENCE_SCHEMA || !Object.isFrozen(experience)) throw new Error('Immutable governed workspace experience is required.');
  return searchGovernedWorkspaceDiscovery(experience.discoveryIndex, { ...query, currentBinding: experience.binding });
}

function planNaturalGovernedWorkspaceMicroread(experience, taskAuthorization, request, { now } = {}) {
  if (!experience || experience.schema !== EXPERIENCE_SCHEMA || !Object.isFrozen(experience)) throw new Error('Immutable governed workspace experience is required.');
  if (!request || !Object.isFrozen(request)) throw new Error('Immutable provider microread request is required.');
  const boundedRequest = deepFreeze({
    ...request,
    physicalWorkspaceIdentity:
      experience.binding.physicalWorkspaceIdentity
  });
  const evaluation = evaluateNaturalTaskEnvelopeOperation(taskAuthorization, boundedRequest, { now });
  const base = { schema: MICROREAD_SCHEMA, experienceFingerprint: experience.experienceFingerprint, decision: evaluation.decision, reason: evaluation.reason, governedIntent: evaluation.governedIntent, requiresNewHumanAuthority: evaluation.requiresNewHumanAuthority, dispatchAuthority: false, operationalAuthority: false, mutationAuthority: false };
  return deepFreeze({ ...base, microreadFingerprint: fingerprint(base) });
}

function projectNaturalWorkspaceMutationReview(experience, patchProposal, { validationSelectors = ['NODE_SYNTAX_CHECK'] } = {}) {
  if (!experience || experience.schema !== EXPERIENCE_SCHEMA || !Object.isFrozen(experience)) throw new Error('Immutable governed workspace experience is required.');
  if (!patchProposal || patchProposal.schema !== 'sdo.natural_development_patch_proposal.v1' || patchProposal.state !== 'HUMAN_REVIEW_REQUIRED' || !Object.isFrozen(patchProposal) || patchProposal.operationalAuthority !== false || patchProposal.mutationAuthority !== false) {
    throw new Error('Immutable authority-free patch proposal is required.');
  }
  if (!Array.isArray(validationSelectors) || validationSelectors.some((selector) => !experience.qualifiedCommandCatalog.commands[selector])) throw new Error('Mutation validation must use the qualified command catalog.');
  const review = {
    schema: MUTATION_REVIEW_SCHEMA,
    experienceFingerprint: experience.experienceFingerprint,
    purpose: patchProposal.objective || 'Apply the exact reviewed governed patch.',
    affectedPaths: [patchProposal.target],
    beforeSha256: patchProposal.beforeSha256,
    afterSha256: patchProposal.replacementSha256,
    diffFingerprint: patchProposal.exactDiff?.diffFingerprint || null,
    validationSelectors: [...validationSelectors],
    risk: 'R3',
    requiresExactHumanAuthorization: true,
    authorizationExpires: true,
    authorizationSingleUse: true,
    conditionalCASRequired: true,
    reusableApproval: false,
    dispatchAuthority: false,
    operationalAuthority: false,
    mutationAuthority: false
  };
  return deepFreeze({ ...review, reviewFingerprint: fingerprint(review) });
}

module.exports = Object.freeze({ EXPERIENCE_SCHEMA, MICROREAD_SCHEMA, MUTATION_REVIEW_SCHEMA, openNaturalGovernedWorkspaceExperience, searchNaturalGovernedWorkspace, planNaturalGovernedWorkspaceMicroread, projectNaturalWorkspaceMutationReview });
