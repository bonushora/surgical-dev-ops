'use strict';

const {
  ProtocolError,
  canonicalSerialize,
  deepFreezeCopy,
  validateRequest,
} = require('./control-plane-protocol-v2');

const PRODUCTION_ENABLEMENT_STATES = Object.freeze(Object.fromEntries([
  'IMPLEMENTATION_UNAVAILABLE',
  'IMPLEMENTATION_AVAILABLE',
  'PRODUCTION_DISABLED',
  'PRODUCTION_CONFIGURED',
  'OPERATION_INELIGIBLE',
  'AUTHORITY_REQUIRED',
  'AUTHORITY_VALID',
  'READY_FOR_EXACT_PHYSICAL_OPERATION',
].map((state) => [state, state])));

const CONFIGURATION_FIELDS = Object.freeze(['schema', 'mode', 'workspace']);
const WORKSPACE_CONFIGURATION_FIELDS = Object.freeze([
  'path', 'physicalIdentity', 'repositoryId', 'allowedCapabilities', 'allowedTargets',
]);
const INSPECTION_FIELDS = Object.freeze([
  'schema', 'canonicalWorkspacePath', 'physicalWorkspaceIdentity', 'repositoryId',
  'repositoryHead', 'worktreeFingerprint', 'target', 'targetConfined',
  'beforeSha256', 'qualified', 'clean',
]);
const AUTHORITY_BINDING_FIELDS = Object.freeze([
  'operationId', 'authority', 'approvalReference', 'workspace', 'repository',
  'expectedState', 'physicalExecution',
]);
const DIGEST = /^[a-f0-9]{64}$/;

function failure(classification, code) {
  return new ProtocolError(classification, code, 'Production physical operation rejected');
}

function exact(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === fields.length
    && keys.every((key) => typeof key === 'string' && fields.includes(key));
}

function same(left, right) {
  try { return canonicalSerialize(left) === canonicalSerialize(right); }
  catch { return false; }
}

function validStringArray(value) {
  return Array.isArray(value) && value.length > 0
    && value.every((entry) => typeof entry === 'string' && entry.length > 0)
    && new Set(value).size === value.length;
}

function validateConfiguration(value) {
  if (value === null) return null;
  if (!exact(value, CONFIGURATION_FIELDS)
    || value.schema !== 'sdo.control_plane_production_eligibility.v1'
    || value.mode !== 'ENABLED'
    || !exact(value.workspace, WORKSPACE_CONFIGURATION_FIELDS)
    || typeof value.workspace.path !== 'string'
    || typeof value.workspace.physicalIdentity !== 'string'
    || !DIGEST.test(value.workspace.physicalIdentity)
    || typeof value.workspace.repositoryId !== 'string'
    || !validStringArray(value.workspace.allowedCapabilities)
    || !validStringArray(value.workspace.allowedTargets)) {
    throw new TypeError('Production eligibility configuration is invalid');
  }
  return deepFreezeCopy(value);
}

function validInspection(value) {
  return exact(value, INSPECTION_FIELDS)
    && value.schema === 'sdo.control_plane_production_operation_inspection.v1'
    && typeof value.canonicalWorkspacePath === 'string'
    && DIGEST.test(value.physicalWorkspaceIdentity || '')
    && typeof value.repositoryId === 'string'
    && /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(value.repositoryHead || '')
    && DIGEST.test(value.worktreeFingerprint || '')
    && typeof value.target === 'string'
    && typeof value.targetConfined === 'boolean'
    && DIGEST.test(value.beforeSha256 || '')
    && typeof value.qualified === 'boolean'
    && typeof value.clean === 'boolean';
}

function exactAuthority(value, request) {
  if (!value || value.status !== 'VALID' || value.oneShot !== true || value.consumed !== false
    || !exact(value.binding, AUTHORITY_BINDING_FIELDS)
    || !value.authorizedExecution || typeof value.authorizedExecution !== 'object') return false;
  return same(value.binding, {
    operationId: request.operationId,
    authority: request.authority,
    approvalReference: request.approvalReference,
    workspace: request.workspace,
    repository: request.repository,
    expectedState: request.expectedState,
    physicalExecution: request.physicalExecution,
  });
}

function result(state, transitions, code) {
  return deepFreezeCopy({
    state,
    transitions,
    dispatchPermitted: state === PRODUCTION_ENABLEMENT_STATES.READY_FOR_EXACT_PHYSICAL_OPERATION,
    code,
  });
}

function createControlPlaneProductionEnablement(options = {}) {
  const allowed = new Set([
    'implementationAvailable', 'productionConfiguration', 'inspectOperation',
    'resolveSurgicalAuthority', 'validateCas',
  ]);
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Reflect.ownKeys(options).some((key) => typeof key !== 'string' || !allowed.has(key))
    || typeof options.implementationAvailable !== 'boolean'
    || typeof options.inspectOperation !== 'function'
    || (options.resolveSurgicalAuthority !== null && typeof options.resolveSurgicalAuthority !== 'function')
    || typeof options.validateCas !== 'function') {
    throw new TypeError('Production enablement dependencies are invalid');
  }
  const productionConfiguration = validateConfiguration(options.productionConfiguration);

  async function assess(input, includeAuthority = false) {
    const request = validateRequest('submit', input);
    const transitions = [];
    if (!options.implementationAvailable) {
      return { publicResult: result('IMPLEMENTATION_UNAVAILABLE', transitions, 'PHYSICAL_IMPLEMENTATION_UNAVAILABLE') };
    }
    transitions.push('IMPLEMENTATION_AVAILABLE');
    if (productionConfiguration === null) {
      return { publicResult: result('PRODUCTION_DISABLED', transitions, 'PRODUCTION_PHYSICAL_MODE_DISABLED') };
    }
    transitions.push('PRODUCTION_CONFIGURED');
    const configured = productionConfiguration.workspace;
    if (configured.path !== request.workspace.path
      || configured.physicalIdentity !== request.workspace.physicalIdentity
      || configured.repositoryId !== request.repository.id
      || !configured.allowedCapabilities.includes(request.requestedCapability)
      || !configured.allowedTargets.includes(request.physicalExecution.target)) {
      return { publicResult: result('OPERATION_INELIGIBLE', transitions, 'PRODUCTION_OPERATION_INELIGIBLE') };
    }
    let inspected;
    try { inspected = await options.inspectOperation(deepFreezeCopy({ request })); }
    catch {
      return { publicResult: result('OPERATION_INELIGIBLE', transitions, 'PRODUCTION_OPERATION_INSPECTION_FAILED') };
    }
    if (!validInspection(inspected)
      || inspected.canonicalWorkspacePath !== request.workspace.path
      || inspected.physicalWorkspaceIdentity !== request.workspace.physicalIdentity
      || inspected.repositoryId !== request.repository.id
      || inspected.repositoryHead !== request.repository.head
      || inspected.worktreeFingerprint !== request.expectedState.worktreeFingerprint
      || inspected.target !== request.physicalExecution.target
      || inspected.targetConfined !== true
      || inspected.beforeSha256 !== request.physicalExecution.beforeSha256
      || inspected.qualified !== true
      || inspected.clean !== true) {
      return { publicResult: result('OPERATION_INELIGIBLE', transitions, 'PRODUCTION_OPERATION_INELIGIBLE') };
    }
    if (!options.resolveSurgicalAuthority) {
      return { publicResult: result('AUTHORITY_REQUIRED', transitions, 'CURRENT_SURGICAL_AUTHORITY_REQUIRED') };
    }
    let authority;
    try {
      authority = await options.resolveSurgicalAuthority(deepFreezeCopy({ request, inspection: inspected }));
    } catch {
      return { publicResult: result('AUTHORITY_REQUIRED', transitions, 'CURRENT_SURGICAL_AUTHORITY_REQUIRED') };
    }
    if (!exactAuthority(authority, request)) {
      return { publicResult: result('AUTHORITY_REQUIRED', transitions, 'CURRENT_SURGICAL_AUTHORITY_REQUIRED') };
    }
    transitions.push('AUTHORITY_VALID');
    let cas;
    try {
      cas = await options.validateCas(deepFreezeCopy({
        request, inspection: inspected, authorizedExecution: authority.authorizedExecution,
      }));
    } catch {
      return { publicResult: result('OPERATION_INELIGIBLE', transitions, 'PRODUCTION_CAS_STALE') };
    }
    if (!exact(cas, ['status']) || cas.status !== 'MATCH') {
      return { publicResult: result('OPERATION_INELIGIBLE', transitions, 'PRODUCTION_CAS_STALE') };
    }
    transitions.push('READY_FOR_EXACT_PHYSICAL_OPERATION');
    return {
      publicResult: result('READY_FOR_EXACT_PHYSICAL_OPERATION', transitions, 'READY_FOR_EXACT_PHYSICAL_OPERATION'),
      ...(includeAuthority ? { authorizedExecution: authority.authorizedExecution } : {}),
    };
  }

  async function evaluate(input) {
    return (await assess(input, false)).publicResult;
  }

  async function resolveAuthorizedExecution(input) {
    const request = input && input.request ? input.request : input;
    const assessed = await assess(request, true);
    if (!assessed.publicResult.dispatchPermitted) {
      const classification = assessed.publicResult.state === 'AUTHORITY_REQUIRED'
        ? 'authorization_failure' : 'stale_state';
      throw failure(classification, assessed.publicResult.code);
    }
    return assessed.authorizedExecution;
  }

  return Object.freeze({ evaluate, resolveAuthorizedExecution });
}

module.exports = Object.freeze({
  PRODUCTION_ENABLEMENT_STATES,
  createControlPlaneProductionEnablement,
});
