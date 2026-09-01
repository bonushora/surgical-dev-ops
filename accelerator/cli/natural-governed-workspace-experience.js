'use strict';

const crypto = require('node:crypto');
const { SESSION_SCHEMA, REVALIDATION_SCHEMA } = require('../adapters/deterministic-workspace-session-adapter');
const { createGovernedWorkspaceDiscoveryIndex, searchGovernedWorkspaceDiscovery } = require('../core/governed-workspace-discovery-index');
const { createSensitiveContentPolicy, inspectSensitiveContent } = require('../core/sensitive-content-boundary');
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

function digest(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error(`${label} must be canonical SHA-256.`);
  return value;
}

function canonicalExperienceTarget(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Canonical workspace evidence target is required.');
  const target = value.trim().replace(/\\/g, '/');
  if (target.startsWith('/') || target.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Workspace evidence target must remain canonical and relative.');
  }
  return target;
}

function microreadResult(experience, evaluation, extra = {}) {
  const base = {
    schema: MICROREAD_SCHEMA,
    experienceFingerprint: experience.experienceFingerprint,
    decision: evaluation.decision,
    reason: evaluation.reason,
    governedIntent: evaluation.governedIntent,
    requiresNewHumanAuthority: evaluation.requiresNewHumanAuthority,
    dispatchAuthority: false,
    operationalAuthority: false,
    mutationAuthority: false,
    ...extra
  };
  return deepFreeze({ ...base, microreadFingerprint: fingerprint(base) });
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
  if (evaluation.decision !== 'CONTAINED') return microreadResult(experience, evaluation);

  const evidenceRequest = boundedRequest.evidenceRequest || {};
  if (evidenceRequest.kind === 'READ_FILE' || evidenceRequest.kind === 'VALIDATE_JS') {
    const target = canonicalExperienceTarget(evidenceRequest.target);
    if (!experience.discoveryIndex.files.includes(target)) {
      return microreadResult(
        experience,
        {
          ...evaluation,
          decision: 'STOPPED',
          reason: 'Evidence target was not admitted by the governed discovery index.',
          governedIntent: null,
          requiresNewHumanAuthority: true
        },
        { requiresFreshDiscovery: true }
      );
    }
  }

  if (evidenceRequest.kind === 'VALIDATE_JS' && !experience.qualifiedCommandCatalog.commands.NODE_SYNTAX_CHECK) {
    return microreadResult(
      experience,
      {
        ...evaluation,
        decision: 'STOPPED',
        reason: 'Validation command is outside the qualified command catalog.',
        governedIntent: null,
        requiresNewHumanAuthority: true
      },
      { qualifiedCommandSelector: null }
    );
  }

  return microreadResult(
    experience,
    evaluation,
    {
      requiresFreshDiscovery: false,
      qualifiedCommandSelector:
        evidenceRequest.kind === 'VALIDATE_JS'
          ? 'NODE_SYNTAX_CHECK'
          : null
    }
  );
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

function qualifyNaturalWorkspaceFileEvidenceForCognition(experience, evidence) {
  if (!experience || experience.schema !== EXPERIENCE_SCHEMA || !Object.isFrozen(experience)) throw new Error('Immutable governed workspace experience is required.');
  if (!evidence || typeof evidence !== 'object' || !Object.isFrozen(evidence)) throw new Error('Immutable governed file evidence is required.');
  const target = canonicalExperienceTarget(evidence.target);
  if (!experience.discoveryIndex.files.includes(target)) {
    throw new Error('Governed file evidence was not admitted by the discovery index.');
  }
  const sensitive = inspectSensitiveContent(
    experience.sensitiveContentPolicy,
    {
      target,
      content: evidence.content
    }
  );
  if (!sensitive.providerSafe) {
    throw new Error('Governed file evidence is blocked by sensitive-content policy.');
  }
  const base = {
    schema: 'sdo.natural_governed_workspace_provider_file_evidence.v1',
    experienceFingerprint: experience.experienceFingerprint,
    target,
    bytes: evidence.bytes,
    sha256: digest(evidence.sha256, 'Governed file evidence SHA-256'),
    content: sensitive.content,
    originalContentSha256: sensitive.contentSha256,
    sensitiveDecision: sensitive.decision,
    sensitiveRules: sensitive.rules,
    providerSafe: true,
    operationalAuthority: false,
    mutationAuthority: false
  };
  return deepFreeze({ ...base, evidenceFingerprint: fingerprint(base) });
}

module.exports = Object.freeze({
  EXPERIENCE_SCHEMA,
  MICROREAD_SCHEMA,
  MUTATION_REVIEW_SCHEMA,
  openNaturalGovernedWorkspaceExperience,
  searchNaturalGovernedWorkspace,
  planNaturalGovernedWorkspaceMicroread,
  projectNaturalWorkspaceMutationReview,
  qualifyNaturalWorkspaceFileEvidenceForCognition
});
