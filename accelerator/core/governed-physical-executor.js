'use strict';

const {
  PROTOCOL_VERSION,
  PHYSICAL_CAPABILITY,
  ProtocolError,
  canonicalSerialize,
  deepFreezeCopy,
  validateRequest,
} = require('./control-plane-protocol-v2');
const gateway = require('./integrated-governed-agent-gateway');

const BINDING_FIELDS = Object.freeze([
  'principal', 'authority', 'approvalReference', 'workspace', 'repository',
  'expectedState', 'physicalExecution',
]);

function executorError(classification, code) {
  return new ProtocolError(classification, code, 'Governed physical execution rejected');
}

function exactObject(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === fields.length
    && keys.every((key) => typeof key === 'string' && fields.includes(key));
}

function same(left, right) {
  return canonicalSerialize(left) === canonicalSerialize(right);
}

function createGovernedPhysicalExecutor(options = {}) {
  const allowed = new Set([
    'resolveAuthorizedExecution', 'reconcilePhysicalEvidence',
    'dispatchGatewayRequest', 'createGatewayRequest', 'now', 'monotonicMs',
  ]);
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Reflect.ownKeys(options).some((key) => typeof key !== 'string' || !allowed.has(key))
    || typeof options.resolveAuthorizedExecution !== 'function'
    || typeof options.reconcilePhysicalEvidence !== 'function') {
    throw new TypeError('Governed physical executor dependencies are invalid');
  }
  const dispatch = options.dispatchGatewayRequest || gateway.dispatchGatewayRequest;
  const createRequest = options.createGatewayRequest || gateway.createGatewayRequest;
  const now = options.now || (() => new Date().toISOString());
  const monotonicMs = options.monotonicMs || (() => Number(process.hrtime.bigint() / 1000000n));
  if (typeof dispatch !== 'function' || typeof createRequest !== 'function'
    || typeof now !== 'function' || typeof monotonicMs !== 'function') {
    throw new TypeError('Governed physical executor dependencies are invalid');
  }
  const metrics = {
    authorityResolutions: 0,
    casValidations: 0,
    gatewayDispatches: 0,
    reconciliations: 0,
    genericShellDispatches: 0,
    genericFilesystemWrites: 0,
    providerCredentialReads: 0,
  };

  function descriptor() {
    return deepFreezeCopy({
      protocolVersion: PROTOCOL_VERSION,
      capability: PHYSICAL_CAPABILITY,
      physicalDispatchEnabled: true,
      authorityOwner: 'surgical-dev-ops',
      genericShell: false,
      genericFilesystemWriter: false,
      providerCredential: false,
    });
  }

  function validateResolved(resolved, request) {
    if (!resolved || typeof resolved !== 'object' || Array.isArray(resolved)
      || !exactObject(resolved.binding, BINDING_FIELDS)
      || !resolved.mission || !resolved.naturalDevelopment) {
      throw executorError('authorization_failure', 'LOCAL_AUTHORITY_REQUIRED');
    }
    const expected = {
      principal: request.principal,
      authority: request.authority,
      approvalReference: request.approvalReference,
      workspace: request.workspace,
      repository: request.repository,
      expectedState: request.expectedState,
      physicalExecution: request.physicalExecution,
    };
    if (!same(resolved.binding, expected)) {
      throw executorError('authorization_failure', 'LOCAL_AUTHORITY_BINDING_MISMATCH');
    }
    const mission = resolved.mission;
    const natural = resolved.naturalDevelopment;
    if (!mission.binding || mission.binding.repositoryPath !== request.workspace.path
      || mission.binding.physicalWorkspaceIdentity !== request.workspace.physicalIdentity
      || mission.binding.repositoryHead !== request.repository.head
      || mission.binding.worktreeFingerprint !== request.expectedState.worktreeFingerprint
      || natural.repositoryPath !== request.workspace.path
      || natural.physicalWorkspaceIdentity !==
        mission.binding.physicalWorkspaceIdentity
      || !natural.contract || natural.contract.contractFingerprint !== request.physicalExecution.contractFingerprint
      || !natural.patchProposal || natural.patchProposal.proposalFingerprint !== request.physicalExecution.proposalFingerprint
      || natural.patchProposal.target !== request.physicalExecution.target
      || natural.patchProposal.beforeSha256 !== request.physicalExecution.beforeSha256
      || natural.patchProposal.replacementSha256 !== request.physicalExecution.afterSha256
      || !natural.patchAuthorization
      || natural.patchAuthorization.authorizationFingerprint !== request.physicalExecution.authorizationFingerprint) {
      throw executorError('stale_state', 'LOCAL_PHYSICAL_BINDING_STALE');
    }
    const grant = mission.authority && Array.isArray(mission.authority.grants)
      ? mission.authority.grants.find((candidate) =>
        candidate.authorityRef === request.authority.reference
        && candidate.capability === PHYSICAL_CAPABILITY)
      : null;
    if (!grant || (mission.authority.usedAuthorityRefs || []).includes(grant.authorityRef)) {
      throw executorError('authorization_failure', 'LOCAL_AUTHORITY_REQUIRED');
    }
    return { resolved, grant };
  }

  async function execute(input) {
    if (!input || typeof input !== 'object' || typeof input.externalExecutionId !== 'string') {
      throw executorError('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
    }
    const request = validateRequest('submit', input.request);
    metrics.authorityResolutions += 1;
    let local;
    try { local = await options.resolveAuthorizedExecution(deepFreezeCopy({ request })); }
    catch { throw executorError('authorization_failure', 'LOCAL_AUTHORITY_REQUIRED'); }
    const { resolved, grant } = validateResolved(local, request);
    metrics.casValidations += 1;
    const gatewayRequest = createRequest({
      mission: resolved.mission,
      requestId: `gateway-${request.operationId}`,
      operation: PHYSICAL_CAPABILITY,
      args: {
        naturalDevelopment: request.physicalExecution,
        expectedCas: {
          repositoryHead: request.repository.head,
          worktreeFingerprint: request.expectedState.worktreeFingerprint,
          physicalWorkspaceIdentity: request.workspace.physicalIdentity,
        },
        targetCas: {
          target: request.physicalExecution.target,
          beforeSha256: request.physicalExecution.beforeSha256,
        },
        scope: grant.scope || null,
      },
      authorityRef: request.authority.reference,
      requestedAt: request.submittedAt,
    });
    metrics.gatewayDispatches += 1;
    const dispatched = await Promise.resolve(dispatch({
      request: gatewayRequest,
      mission: resolved.mission,
      options: {
        now,
        monotonicMs,
        naturalDevelopment: resolved.naturalDevelopment,
      },
    }));
    const result = dispatched && dispatched.result;
    if (!result || result.classification !== 'SUCCESS' || !result.data
      || result.data.kind !== 'CONDITIONAL_MUTATION') {
      const classification = result && result.classification;
      if (classification === 'CAS_MISMATCH' || classification === 'STALE_STATE') {
        throw executorError('stale_state', 'PHYSICAL_CAS_MISMATCH');
      }
      if (classification === 'AUTHORITY_REQUIRED' || classification === 'DENIED') {
        throw executorError('authorization_failure', 'LOCAL_AUTHORITY_REQUIRED');
      }
      throw executorError('internal_failure', 'GOVERNED_PHYSICAL_DISPATCH_FAILED');
    }
    const data = result.data;
    if (data.beforeSha256 !== request.physicalExecution.beforeSha256
      || data.afterSha256 !== request.physicalExecution.afterSha256
      || data.target !== request.physicalExecution.target
      || typeof data.transactionId !== 'string' || typeof data.journalId !== 'string') {
      throw executorError('internal_failure', 'PHYSICAL_EVIDENCE_MISMATCH');
    }
    return deepFreezeCopy({
      classification: 'succeeded',
      code: 'PHYSICAL_MUTATION_SUCCEEDED',
      physicalEvidence: {
        transactionId: data.transactionId,
        journalId: data.journalId,
        recoveryStatus: 'COMMITTED',
        effectFingerprint: data.composition.effectFingerprint,
      },
    });
  }

  async function reconcile(input) {
    if (!input || typeof input !== 'object' || !input.request || !input.entry) {
      throw executorError('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
    }
    const request = validateRequest('reconcile', input.request);
    metrics.reconciliations += 1;
    let recovered;
    try {
      recovered = await options.reconcilePhysicalEvidence(deepFreezeCopy({
        request,
        entry: input.entry,
      }));
    } catch {
      return deepFreezeCopy({ classification: 'unknown', code: 'PHYSICAL_EVIDENCE_UNKNOWN' });
    }
    if (!recovered || typeof recovered !== 'object'
      || !['succeeded', 'failed', 'unknown', 'indeterminate'].includes(recovered.classification)) {
      return deepFreezeCopy({ classification: 'unknown', code: 'PHYSICAL_EVIDENCE_UNKNOWN' });
    }
    if (recovered.classification === 'succeeded') {
      if (!recovered.physicalEvidence) {
        return deepFreezeCopy({ classification: 'unknown', code: 'PHYSICAL_EVIDENCE_UNKNOWN' });
      }
      return deepFreezeCopy({
        classification: 'succeeded',
        code: recovered.code || 'PHYSICAL_MUTATION_RECOVERED',
        physicalEvidence: { ...recovered.physicalEvidence, recoveryStatus: 'RECOVERED' },
      });
    }
    return deepFreezeCopy({
      classification: recovered.classification,
      code: recovered.code || 'PHYSICAL_EVIDENCE_UNKNOWN',
    });
  }

  return Object.freeze({
    describe: descriptor,
    execute,
    reconcile,
    inspectMetrics: () => deepFreezeCopy(metrics),
  });
}

module.exports = Object.freeze({ createGovernedPhysicalExecutor });
