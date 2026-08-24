'use strict';

const {
  createMachineAccessOperation,
  createMachineAccessEvidence,
  createMachineAccessResult
} = require('./machine-access-contract');
const { readFileWithGrant } = require('../adapters/filesystem-read-adapter');
const { readGitWithGrant } = require('../adapters/git-read-adapter');
const { validateJavaScriptWithGrant } = require('../adapters/process-validation-adapter');

const ROUTES = Object.freeze({
  LIST_DIRECTORY: Object.freeze({ adapter: 'git', selector: 'WORKSPACE_FILES' }),
  READ_FILE: Object.freeze({ adapter: 'filesystem', selector: null }),
  GIT_STATUS: Object.freeze({ adapter: 'git', selector: 'WORKTREE_STATUS' }),
  GIT_DIFF: Object.freeze({ adapter: 'git', selector: 'WORKTREE_DIFF' }),
  RUN_FIXED_VALIDATION: Object.freeze({ adapter: 'process', selector: 'NODE_SYNTAX_CHECK' })
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isDeepFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  seen.add(value);
  return Object.values(value).every((child) => isDeepFrozen(child, seen));
}

function timestamp(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required.`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(`${name} must be canonical.`);
  }
  return value;
}

function validateBinding(request, authority, evaluation, observedAt) {
  if (!evaluation || evaluation.schema !== 'sdo.capability_grant_evaluation.v1' ||
      evaluation.decision !== 'ALLOWED' || !evaluation.grant || !isDeepFrozen(evaluation)) {
    throw new Error('Broker requires a frozen allowed capability grant.');
  }
  const grant = evaluation.grant;
  if (grant.operationId !== request.operationId || grant.workspace !== request.workspace ||
      grant.capabilityType !== request.capabilityType || grant.action !== request.action ||
      grant.riskLevel !== request.riskLevel || grant.fingerprint !== authority.grantFingerprint ||
      grant.policyDecision !== 'ALLOWED' || grant.lifecycleState !== 'PENDING' ||
      grant.idempotency !== 'IDEMPOTENT') {
    throw new Error('Broker capability binding mismatch.');
  }
  const observed = timestamp(observedAt, 'observedAt');
  if (Date.parse(observed) < Date.parse(authority.issuedAt) ||
      Date.parse(observed) >= Date.parse(authority.expiresAt) ||
      Date.parse(observed) >= Date.parse(grant.expiresAt)) {
    throw new Error('Broker authority is not active.');
  }
  return observed;
}

function dispatch(operation, grantEvaluation, observedAt) {
  const route = ROUTES[operation.operationType];
  if (!route) throw new Error('Broker operation is unsupported.');
  const base = { operationId: operation.operationId, workspace: operation.workspace,
    grantEvaluation, observedAt };
  if (route.adapter === 'filesystem') {
    return readFileWithGrant({ ...base, target: operation.target });
  }
  if (route.adapter === 'git') {
    return readGitWithGrant({ ...base, selector: route.selector });
  }
  if (route.adapter === 'process') {
    return validateJavaScriptWithGrant({ ...base, selector: route.selector, target: operation.target });
  }
  throw new Error('Broker route is malformed.');
}

function failureReason(error) {
  const reason = error && typeof error.message === 'string' ? error.message.trim() : '';
  return (reason || 'Read-only adapter failed closed.').slice(0, 1024);
}

function executeMachineAccessReadOnly({ request, authority, grantEvaluation, observedAt }) {
  const operation = createMachineAccessOperation({ request, authority });
  const observed = validateBinding(request, authority, grantEvaluation, observedAt);
  try {
    const adapterEvidence = dispatch(operation, grantEvaluation, observed);
    const evidence = createMachineAccessEvidence({ operation, adapterEvidence });
    return createMachineAccessResult({ operation, status: 'COMPLETED', evidence });
  } catch (error) {
    return createMachineAccessResult({ operation, status: 'FAILED', reason: failureReason(error) });
  }
}

module.exports = deepFreeze({ executeMachineAccessReadOnly });
