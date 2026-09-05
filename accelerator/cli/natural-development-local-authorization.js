'use strict';

/*
 * Local G4 materialization after one exact interactive human decision.
 * The caller decides only whether the reviewed proposal fingerprint is the
 * proposal being approved. This adapter creates and verifies the existing
 * Ed25519 local-offline challenge; it cannot dispatch the patch.
 */

const crypto = require('node:crypto');
const path = require('node:path');

const {
  readLocalOfflineHumanPublicAuthority,
  loadLocalOfflineHumanSigner
} = require('../core/local-offline-human-authority-store');

const {
  createProductionMutationRuntime
} = require('../core/production-mutation-runtime');

const {
  verifyHumanIdentityAssertion
} = require('../adapters/identity-verification-adapter');

const {
  AUTHORIZATION_SCHEMA,
  HUMAN_DECISION_SCHEMA,
  AUTHORIZATION_AUDIENCE,
  materializeNaturalDevelopmentPatchAuthorization
} = require('./natural-development-patch-authorization');

const REPAIR_MISSION_REQUEST_SCHEMA =
  'sdo.natural_repair_mission_authority_request.v1';
const REPAIR_MISSION_AUTHORITY_SCHEMA =
  'sdo.natural_repair_mission_authority.v1';
const REPAIR_MISSION_AUTHORITY_AUDIENCE =
  'surgical-devops:natural-repair-mission';
const REPAIR_MISSION_AUTHORITY_VALIDITY_MS =
  10 * 60_000;
const PATCH_AUTHORIZATION_VALIDITY_MS =
  5 * 60_000;
const AUTHORIZED_REPAIR_OPERATION =
  'mutation.applyConditional';
const AUTHORIZED_MUTATION_CLASS =
  'EXACT_FULL_FILE_REPLACEMENT_R3';
const TERMINAL_STATES = Object.freeze([
  'GREEN',
  'BLOCKED',
  'CANCELLED'
]);

const materializedRepairMissionAuthorities = new WeakSet();
const repairMissionDerivations = new WeakMap();

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function required(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function optionalIdentity(value, label) {
  if (value === null || value === undefined) return null;
  const identity = required(value, label);
  if (identity !== value || identity.length > 256) {
    throw new Error(`${label} is malformed.`);
  }
  return identity;
}

function exactFields(value, fields, label) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== fields.length ||
    fields.some((field) => !Object.prototype.hasOwnProperty.call(value, field))
  ) {
    throw new Error(`${label} is malformed.`);
  }
}

function digest(value, label, lengths = [64]) {
  const text = required(value, label);
  if (
    !lengths.includes(text.length) ||
    !/^[a-f0-9]+$/.test(text)
  ) {
    throw new Error(`${label} is malformed.`);
  }
  return text;
}

function boundedTarget(value, label) {
  const target = required(value, label);
  if (
    target.length > 1024 ||
    target.startsWith('/') ||
    target.includes('\\') ||
    target.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error(`${label} is outside the bounded workspace.`);
  }
  return target;
}

function canonicalRepository(value) {
  const repository = required(value, 'Repository path');
  if (!path.isAbsolute(repository) || path.normalize(repository) !== repository) {
    throw new Error('Repository path must be canonical and absolute.');
  }
  return repository;
}

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value), 'utf8')
    .digest('hex');
}

function validateRepairMissionAuthorityRequest(value) {
  const fields = [
    'schema', 'authorityGeneration', 'missionId', 'objective',
    'repositoryPath', 'physicalWorkspaceIdentity', 'repositoryHead',
    'worktreeFingerprint', 'initialFailureEvidenceDigest', 'operation',
    'mutationClass', 'allowedTargets', 'testTarget', 'qualificationTarget',
    'riskCeiling', 'attemptCeiling', 'qualificationRequired',
    'terminalStates', 'deniedCapabilities', 'issuanceProvenance',
    'processLocal', 'durableRestart', 'reusableApproval',
    'operationalAuthority', 'mutationAuthority', 'gitAuthority',
    'remoteAuthority', 'authorityRequestFingerprint'
  ];
  exactFields(value, fields, 'Repair-mission authority request');
  const { authorityRequestFingerprint, ...binding } = value;
  const targets = Array.isArray(value.allowedTargets)
    ? value.allowedTargets.map((target) => boundedTarget(target, 'Allowed repair target'))
    : [];
  const denied = Array.isArray(value.deniedCapabilities)
    ? value.deniedCapabilities.map((item) => required(item, 'Denied capability'))
    : [];
  if (
    value.schema !== REPAIR_MISSION_REQUEST_SCHEMA ||
    value.authorityGeneration !== 1 ||
    required(value.missionId, 'Mission id').length > 256 ||
    required(value.objective, 'Mission objective').length > 4096 ||
    canonicalRepository(value.repositoryPath) !== value.repositoryPath ||
    digest(value.physicalWorkspaceIdentity, 'Physical workspace identity') !== value.physicalWorkspaceIdentity ||
    digest(value.repositoryHead, 'Repository HEAD', [40, 64]) !== value.repositoryHead ||
    digest(value.worktreeFingerprint, 'Worktree fingerprint') !== value.worktreeFingerprint ||
    digest(value.initialFailureEvidenceDigest, 'Initial failure evidence') !== value.initialFailureEvidenceDigest ||
    value.operation !== AUTHORIZED_REPAIR_OPERATION ||
    value.mutationClass !== AUTHORIZED_MUTATION_CLASS ||
    targets.length < 1 ||
    targets.length > 8 ||
    new Set(targets).size !== targets.length ||
    JSON.stringify([...targets].sort()) !== JSON.stringify(targets) ||
    boundedTarget(value.testTarget, 'Targeted test') !== value.testTarget ||
    boundedTarget(value.qualificationTarget, 'Qualification test') !== value.qualificationTarget ||
    value.riskCeiling !== 'R3' ||
    !Number.isInteger(value.attemptCeiling) ||
    value.attemptCeiling < 1 ||
    value.attemptCeiling > 8 ||
    value.qualificationRequired !== true ||
    JSON.stringify(value.terminalStates) !== JSON.stringify(TERMINAL_STATES) ||
    denied.length < 1 ||
    new Set(denied).size !== denied.length ||
    JSON.stringify([...denied].sort()) !== JSON.stringify(denied) ||
    value.issuanceProvenance !== 'EXPLICIT_LOCAL_HUMAN_DECISION' ||
    value.processLocal !== true ||
    value.durableRestart !== false ||
    value.reusableApproval !== false ||
    value.operationalAuthority !== false ||
    value.mutationAuthority !== false ||
    value.gitAuthority !== false ||
    value.remoteAuthority !== false ||
    fingerprint(binding) !== authorityRequestFingerprint
  ) {
    throw new Error('Repair-mission authority request has lost its exact bounded binding.');
  }
  return value;
}

function createNaturalRepairMissionAuthorityRequest({
  missionId,
  objective,
  repositoryPath,
  physicalWorkspaceIdentity,
  repositoryHead,
  worktreeFingerprint,
  initialFailureEvidenceDigest,
  allowedTargets,
  testTarget,
  qualificationTarget,
  attemptCeiling,
  deniedCapabilities
} = {}) {
  const targets = Array.isArray(allowedTargets)
    ? [...new Set(allowedTargets.map((target) => boundedTarget(target, 'Allowed repair target')))].sort()
    : [];
  const denied = Array.isArray(deniedCapabilities)
    ? [...new Set(deniedCapabilities.map((item) => required(item, 'Denied capability')))].sort()
    : [];
  const binding = deepFreeze({
    schema: REPAIR_MISSION_REQUEST_SCHEMA,
    authorityGeneration: 1,
    missionId: required(missionId, 'Mission id'),
    objective: required(objective, 'Mission objective'),
    repositoryPath: canonicalRepository(repositoryPath),
    physicalWorkspaceIdentity: digest(
      physicalWorkspaceIdentity,
      'Physical workspace identity'
    ),
    repositoryHead: digest(repositoryHead, 'Repository HEAD', [40, 64]),
    worktreeFingerprint: digest(worktreeFingerprint, 'Worktree fingerprint'),
    initialFailureEvidenceDigest: digest(
      initialFailureEvidenceDigest,
      'Initial failure evidence'
    ),
    operation: AUTHORIZED_REPAIR_OPERATION,
    mutationClass: AUTHORIZED_MUTATION_CLASS,
    allowedTargets: targets,
    testTarget: boundedTarget(testTarget, 'Targeted test'),
    qualificationTarget: boundedTarget(qualificationTarget, 'Qualification test'),
    riskCeiling: 'R3',
    attemptCeiling,
    qualificationRequired: true,
    terminalStates: TERMINAL_STATES,
    deniedCapabilities: denied,
    issuanceProvenance: 'EXPLICIT_LOCAL_HUMAN_DECISION',
    processLocal: true,
    durableRestart: false,
    reusableApproval: false,
    operationalAuthority: false,
    mutationAuthority: false,
    gitAuthority: false,
    remoteAuthority: false
  });
  return validateRepairMissionAuthorityRequest(
    deepFreeze({
      ...binding,
      authorityRequestFingerprint: fingerprint(binding)
    })
  );
}

function materializeLocalNaturalRepairMissionAuthority({
  authorityRequest,
  approvedAuthorityRequestFingerprint,
  authorityRoot,
  journalStorageRoot,
  tenantId = null,
  projectId = null
} = {}) {
  const request = validateRepairMissionAuthorityRequest(authorityRequest);
  if (
    approvedAuthorityRequestFingerprint !==
      request.authorityRequestFingerprint
  ) {
    throw new Error('Exact reviewed repair-mission authority fingerprint is required.');
  }
  const authorityPath = required(authorityRoot, 'Human authority root');
  const journalPath = required(journalStorageRoot, 'Mutation journal root');
  const boundedTenantId = optionalIdentity(tenantId, 'Tenant id');
  const boundedProjectId = optionalIdentity(projectId, 'Project id');
  const publicAuthority = readLocalOfflineHumanPublicAuthority({
    authorityRoot: authorityPath
  });
  const signer = loadLocalOfflineHumanSigner({ authorityRoot: authorityPath });
  const runtime = createProductionMutationRuntime({
    journalStorageRoot: journalPath,
    humanAuthorityPublicKeyPem: publicAuthority.publicKeyPem,
    humanAuthorityIssuer: publicAuthority.issuer,
    humanSubjectId: publicAuthority.subjectId,
    identityAudience: REPAIR_MISSION_AUTHORITY_AUDIENCE
  });
  const observation = runtime.authoritativeClock.observe();
  if (!observation || observation.decision !== 'ALLOWED') {
    throw new Error('Authoritative clock denied repair-mission authority.');
  }
  const issuedAt = observation.reading.wallTime;
  const expiresAt = new Date(
    Date.parse(issuedAt) + REPAIR_MISSION_AUTHORITY_VALIDITY_MS
  ).toISOString();
  const operationId =
    `natural-repair-mission:${request.authorityRequestFingerprint}`;
  const challenge = deepFreeze({
    schema: 'sdo.local_offline_human_challenge.v1',
    challengeId: operationId,
    issuer: publicAuthority.issuer,
    subjectId: publicAuthority.subjectId,
    audience: Object.freeze([REPAIR_MISSION_AUTHORITY_AUDIENCE]),
    operationId,
    workspace: request.repositoryPath,
    tenantId: boundedTenantId,
    projectId: boundedProjectId,
    issuedAt,
    expiresAt
  });
  const verification = verifyHumanIdentityAssertion(
    {
      rawAssertion: signer.signChallenge(challenge),
      trustedIssuers: runtime.trustedIdentityIssuers,
      expected: {
        subjectId: publicAuthority.subjectId,
        audience: REPAIR_MISSION_AUTHORITY_AUDIENCE,
        operationId,
        workspace: request.repositoryPath,
        tenantId: boundedTenantId,
        projectId: boundedProjectId
      }
    },
    runtime.identityVerifierPort,
    { reading: observation.reading, requireCurrent: true }
  );
  if (verification.decision !== 'VERIFIED') {
    throw new Error('Local human repair-mission identity verification failed closed.');
  }
  const body = deepFreeze({
    schema: REPAIR_MISSION_AUTHORITY_SCHEMA,
    state: 'AUTHORIZED',
    authorityGeneration: request.authorityGeneration,
    authorityRequestFingerprint: request.authorityRequestFingerprint,
    missionId: request.missionId,
    objective: request.objective,
    repositoryPath: request.repositoryPath,
    physicalWorkspaceIdentity: request.physicalWorkspaceIdentity,
    repositoryHead: request.repositoryHead,
    worktreeFingerprint: request.worktreeFingerprint,
    initialFailureEvidenceDigest: request.initialFailureEvidenceDigest,
    operation: request.operation,
    mutationClass: request.mutationClass,
    allowedTargets: request.allowedTargets,
    testTarget: request.testTarget,
    qualificationTarget: request.qualificationTarget,
    riskCeiling: request.riskCeiling,
    attemptCeiling: request.attemptCeiling,
    qualificationRequired: request.qualificationRequired,
    terminalStates: request.terminalStates,
    deniedCapabilities: request.deniedCapabilities,
    humanSubject: verification.assertion.subject.id,
    humanIdentityIssuer: verification.assertion.issuer,
    humanIdentityAuthenticationMethod:
      verification.assertion.authentication.method,
    humanIdentityFingerprint: verification.assertion.fingerprint,
    humanIdentityAssertionId: verification.assertion.assertionId,
    operationId,
    tenantId: boundedTenantId,
    projectId: boundedProjectId,
    issuedAt,
    expiresAt,
    processLocal: true,
    durableRestart: false,
    revoked: false,
    reusableApproval: false,
    operationalAuthority: false,
    mutationAuthority: false,
    approvalAuthority: false,
    dispatchAuthority: false,
    shellAuthority: false,
    gitAuthority: false,
    networkAuthority: false,
    credentialAuthority: false,
    remoteAuthority: false
  });
  const authority = deepFreeze({
    ...body,
    authorityFingerprint: fingerprint(body)
  });
  materializedRepairMissionAuthorities.add(authority);
  repairMissionDerivations.set(authority, new Set());
  return authority;
}

function validateMissionAuthorityForProposal(authority, mission, proposal) {
  const canonicalGrant =
    authority && mission && mission.authority && Array.isArray(mission.authority.grants)
      ? mission.authority.grants.find(
          (grant) => grant.authorityRef === authority.authorityFingerprint
        )
      : null;
  if (
    !materializedRepairMissionAuthorities.has(authority) ||
    !Object.isFrozen(authority) ||
    authority.schema !== REPAIR_MISSION_AUTHORITY_SCHEMA ||
    authority.state !== 'AUTHORIZED' ||
    authority.revoked !== false ||
    authority.processLocal !== true ||
    authority.durableRestart !== false ||
    authority.operation !== AUTHORIZED_REPAIR_OPERATION ||
    authority.mutationClass !== AUTHORIZED_MUTATION_CLASS ||
    authority.operationalAuthority !== false ||
    authority.mutationAuthority !== false ||
    authority.approvalAuthority !== false ||
    authority.dispatchAuthority !== false ||
    authority.shellAuthority !== false ||
    authority.gitAuthority !== false ||
    authority.networkAuthority !== false ||
    authority.credentialAuthority !== false ||
    authority.remoteAuthority !== false
  ) {
    throw new Error('Current process-local repair-mission authority is required.');
  }
  const { authorityFingerprint, ...binding } = authority;
  if (
    fingerprint(binding) !== authorityFingerprint ||
    !mission ||
    authority.missionId !== mission.missionId ||
    authority.objective !== mission.objective ||
    !mission.binding ||
    authority.repositoryPath !== mission.binding.repositoryPath ||
    authority.physicalWorkspaceIdentity !== mission.binding.physicalWorkspaceIdentity ||
    authority.repositoryHead !== mission.binding.repositoryHead ||
    authority.worktreeFingerprint !== mission.binding.worktreeFingerprint ||
    !canonicalGrant ||
    canonicalGrant.capability !== authority.operation ||
    canonicalGrant.operation !== authority.operation ||
    canonicalGrant.lifetime !== 'MISSION_SCOPED' ||
    canonicalGrant.issuedAt !== authority.issuedAt ||
    canonicalGrant.expiresAt !== authority.expiresAt ||
    mission.authority.usedAuthorityRefs.includes(authority.authorityFingerprint) ||
    !canonicalGrant.scope ||
    canonicalGrant.scope.brokerOnly !== true ||
    canonicalGrant.scope.authorityRequestFingerprint !==
      authority.authorityRequestFingerprint ||
    canonicalGrant.scope.mutationClass !== authority.mutationClass ||
    JSON.stringify(canonicalGrant.scope.allowedTargets) !==
      JSON.stringify(authority.allowedTargets) ||
    canonicalGrant.scope.testTarget !== authority.testTarget ||
    canonicalGrant.scope.qualificationTarget !== authority.qualificationTarget ||
    canonicalGrant.scope.riskCeiling !== authority.riskCeiling ||
    canonicalGrant.scope.attemptCeiling !== authority.attemptCeiling ||
    canonicalGrant.scope.qualificationRequired !== true ||
    JSON.stringify(canonicalGrant.authorityNotGranted) !==
      JSON.stringify(authority.deniedCapabilities) ||
    !mission.authority ||
    !mission.authority.allowedCapabilities.includes(authority.operation) ||
    JSON.stringify(authority.deniedCapabilities) !==
      JSON.stringify(mission.authority.deniedCapabilities) ||
    TERMINAL_STATES.includes(mission.state) ||
    !proposal ||
    proposal.objective !== authority.objective ||
    !authority.allowedTargets.includes(proposal.target) ||
    !Number.isInteger(proposal.patchAttempt) ||
    proposal.patchAttempt < 1 ||
    proposal.patchAttempt > authority.attemptCeiling
  ) {
    throw new Error('Repair proposal is outside the current mission authority envelope.');
  }
}

function deriveLocalNaturalDevelopmentAuthorizationFromRepairMission({
  missionAuthority,
  mission,
  patchProposal,
  authorityRoot,
  journalStorageRoot,
  tenantId = null,
  projectId = null
} = {}) {
  validateMissionAuthorityForProposal(
    missionAuthority,
    mission,
    patchProposal
  );
  const derivations = repairMissionDerivations.get(missionAuthority);
  if (derivations.has(patchProposal.proposalFingerprint)) {
    throw new Error('Repair-mission proposal authority derivation replay was stopped.');
  }
  const publicAuthority = readLocalOfflineHumanPublicAuthority({
    authorityRoot: required(authorityRoot, 'Human authority root')
  });
  if (
    optionalIdentity(tenantId, 'Tenant id') !== missionAuthority.tenantId ||
    optionalIdentity(projectId, 'Project id') !== missionAuthority.projectId
  ) {
    throw new Error('Repair-mission tenancy or project binding changed.');
  }
  if (
    publicAuthority.issuer !== missionAuthority.humanIdentityIssuer ||
    publicAuthority.subjectId !== missionAuthority.humanSubject
  ) {
    throw new Error('Repair-mission human authority identity changed.');
  }
  const runtime = createProductionMutationRuntime({
    journalStorageRoot: required(journalStorageRoot, 'Mutation journal root'),
    humanAuthorityPublicKeyPem: publicAuthority.publicKeyPem,
    humanAuthorityIssuer: publicAuthority.issuer,
    humanSubjectId: publicAuthority.subjectId,
    identityAudience: AUTHORIZATION_AUDIENCE
  });
  const observation = runtime.authoritativeClock.observe();
  if (!observation || observation.decision !== 'ALLOWED') {
    throw new Error('Authoritative clock denied mission-derived patch authority.');
  }
  const authorizedAt = observation.reading.wallTime;
  const expiresAt = new Date(Math.min(
    Date.parse(missionAuthority.expiresAt),
    Date.parse(authorizedAt) + PATCH_AUTHORIZATION_VALIDITY_MS
  )).toISOString();
  if (
    Date.parse(authorizedAt) < Date.parse(missionAuthority.issuedAt) ||
    Date.parse(authorizedAt) >= Date.parse(missionAuthority.expiresAt) ||
    Date.parse(expiresAt) <= Date.parse(authorizedAt)
  ) {
    throw new Error('Repair-mission authority is expired or not yet valid.');
  }
  const body = deepFreeze({
    schema: AUTHORIZATION_SCHEMA,
    state: 'AUTHORIZED_FOR_R3_COMPOSITION',
    proposalFingerprint: patchProposal.proposalFingerprint,
    contractFingerprint: patchProposal.contractFingerprint,
    planningFingerprint: patchProposal.planningFingerprint,
    diffFingerprint: patchProposal.exactDiff.diffFingerprint,
    target: patchProposal.target,
    beforeSha256: patchProposal.beforeSha256,
    afterSha256: patchProposal.replacementSha256,
    patchAttempt: patchProposal.patchAttempt,
    humanSubject: missionAuthority.humanSubject,
    humanIdentityIssuer: missionAuthority.humanIdentityIssuer,
    humanIdentityAuthenticationMethod:
      missionAuthority.humanIdentityAuthenticationMethod,
    humanIdentityFingerprint: missionAuthority.humanIdentityFingerprint,
    humanIdentityAssertionId: missionAuthority.humanIdentityAssertionId,
    operationId:
      `natural-development-patch:${patchProposal.proposalFingerprint}`,
    authorizedAt,
    expiresAt,
    authoritySource: 'MISSION_SCOPED_REPAIR_ENVELOPE',
    missionAuthorityFingerprint: missionAuthority.authorityFingerprint,
    missionId: missionAuthority.missionId,
    authorityGeneration: missionAuthority.authorityGeneration,
    singleUse: true,
    reusableApproval: false,
    consumed: false,
    requiresR3Composition: true,
    operationalAuthority: false,
    mutationAuthority: false,
    approvalAuthority: false,
    dispatchAuthority: false
  });
  const authorization = deepFreeze({
    ...body,
    authorizationFingerprint: fingerprint(body)
  });
  derivations.add(patchProposal.proposalFingerprint);
  return authorization;
}

function invalidateLocalNaturalRepairMissionAuthority(authority) {
  if (!authority || typeof authority !== 'object') return false;
  const invalidated = materializedRepairMissionAuthorities.delete(authority);
  repairMissionDerivations.delete(authority);
  return invalidated;
}

function materializeLocalNaturalDevelopmentAuthorization({
  patchProposal,
  approvedProposalFingerprint,
  physicalWorkspaceIdentity,
  repositoryPath,
  authorityRoot,
  journalStorageRoot,
  tenantId = null,
  projectId = null
} = {}) {
  if (
    !patchProposal ||
    approvedProposalFingerprint !== patchProposal.proposalFingerprint
  ) {
    throw new Error('Exact reviewed proposal fingerprint is required.');
  }

  required(
    physicalWorkspaceIdentity,
    'Physical workspace identity'
  );
  const workspace = required(repositoryPath, 'Repository path');
  const authorityPath = required(authorityRoot, 'Human authority root');
  const journalPath = required(journalStorageRoot, 'Mutation journal root');
  const publicAuthority = readLocalOfflineHumanPublicAuthority({
    authorityRoot: authorityPath
  });
  const signer = loadLocalOfflineHumanSigner({ authorityRoot: authorityPath });
  const runtime = createProductionMutationRuntime({
    journalStorageRoot: journalPath,
    humanAuthorityPublicKeyPem: publicAuthority.publicKeyPem,
    humanAuthorityIssuer: publicAuthority.issuer,
    humanSubjectId: publicAuthority.subjectId,
    identityAudience: AUTHORIZATION_AUDIENCE
  });
  const observation = runtime.authoritativeClock.observe();

  if (!observation || observation.decision !== 'ALLOWED') {
    throw new Error('Authoritative clock denied local G4 materialization.');
  }

  const issuedAt = observation.reading.wallTime;
  const expiresAt = new Date(Date.parse(issuedAt) + 5 * 60_000).toISOString();
  const operationId =
    `natural-development-patch:${patchProposal.proposalFingerprint}`;
  const challenge = deepFreeze({
    schema: 'sdo.local_offline_human_challenge.v1',
    challengeId: `natural-development-${patchProposal.proposalFingerprint}`,
    issuer: publicAuthority.issuer,
    subjectId: publicAuthority.subjectId,
    audience: Object.freeze([AUTHORIZATION_AUDIENCE]),
    operationId,
    workspace,
    tenantId,
    projectId,
    issuedAt,
    expiresAt
  });
  const signedAssertion = signer.signChallenge(challenge);
  const verification = verifyHumanIdentityAssertion(
    {
      rawAssertion: signedAssertion,
      trustedIssuers: runtime.trustedIdentityIssuers,
      expected: {
        subjectId: publicAuthority.subjectId,
        audience: AUTHORIZATION_AUDIENCE,
        operationId,
        workspace,
        tenantId,
        projectId
      }
    },
    runtime.identityVerifierPort,
    {
      reading: observation.reading,
      requireCurrent: true
    }
  );

  if (verification.decision !== 'VERIFIED') {
    throw new Error('Local human identity verification failed closed.');
  }

  const humanDecision = deepFreeze({
    schema: HUMAN_DECISION_SCHEMA,
    decision: 'APPROVE_EXACT_PATCH',
    approved: true,
    proposalFingerprint: patchProposal.proposalFingerprint,
    diffFingerprint: patchProposal.exactDiff.diffFingerprint,
    target: patchProposal.target,
    beforeSha256: patchProposal.beforeSha256,
    afterSha256: patchProposal.replacementSha256,
    humanSubject: publicAuthority.subjectId,
    authorizedAt: issuedAt,
    expiresAt
  });

  return materializeNaturalDevelopmentPatchAuthorization({
    patchProposal,
    humanDecision,
    verifiedHumanIdentityAssertion: verification.assertion,
    temporalAuthority: {
      reading: observation.reading,
      requireCurrent: true
    }
  });
}

module.exports = Object.freeze({
  REPAIR_MISSION_REQUEST_SCHEMA,
  REPAIR_MISSION_AUTHORITY_SCHEMA,
  createNaturalRepairMissionAuthorityRequest,
  materializeLocalNaturalRepairMissionAuthority,
  deriveLocalNaturalDevelopmentAuthorizationFromRepairMission,
  invalidateLocalNaturalRepairMissionAuthority,
  materializeLocalNaturalDevelopmentAuthorization
});
