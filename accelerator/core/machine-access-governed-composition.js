'use strict';

const crypto = require('node:crypto');
const {
  createMachineAccessRequest,
  createMachineAccessAuthority
} = require('./machine-access-contract');
const {
  executeMachineAccessReadOnly
} = require('./machine-access-readonly-broker');

const TYPES = Object.freeze({
  FILESYSTEM_READ: Object.freeze({ READ_FILE: 'READ_FILE' }),
  PROCESS_VALIDATION: Object.freeze({ NODE_SYNTAX_CHECK: 'RUN_FIXED_VALIDATION' }),
  GIT_READ: Object.freeze({
    WORKSPACE_FILES: 'LIST_DIRECTORY',
    WORKTREE_STATUS: 'GIT_STATUS',
    WORKTREE_DIFF: 'GIT_DIFF'
  })
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function machineType(execution) {
  const family = TYPES[execution.adapter];
  const type = family && family[execution.action];
  if (!type) throw new Error('Governed read-only request has no machine-access mapping.');
  return type;
}

function composeGovernedMachineAccess(governedRequest) {
  if (!governedRequest || !Object.isFrozen(governedRequest) ||
      !governedRequest.execution || !Object.isFrozen(governedRequest.execution)) {
    throw new Error('Immutable governed read-only request is required.');
  }
  const execution = governedRequest.execution;
  const grantEvaluation = execution.grantEvaluation;
  const grant = grantEvaluation && grantEvaluation.grant;
  if (!grant || grant.action !== execution.action) {
    throw new Error('Governed grant is not action-bound.');
  }
  const operationType = machineType(execution);
  const target = operationType === 'READ_FILE' || operationType === 'RUN_FIXED_VALIDATION'
    ? execution.target : null;
  const request = createMachineAccessRequest({
    requestId: `machine-request-${execution.operationId}`,
    operationId: execution.operationId,
    workspace: execution.workspace,
    operationType,
    target,
    purpose: governedRequest.description,
    requestedAt: execution.observedAt
  });
  const authorityId = 'machine-authority-' + crypto.createHash('sha256')
    .update(`${request.fingerprint}\0${grant.fingerprint}`, 'utf8').digest('hex');
  const authority = createMachineAccessAuthority({
    authorityId,
    request,
    grantEvaluation,
    issuedAt: grant.issuedAt,
    expiresAt: grant.expiresAt
  });
  return deepFreeze({ request, authority, grantEvaluation, observedAt: execution.observedAt });
}

function executeGovernedMachineAccess(governedRequest) {
  const context = composeGovernedMachineAccess(governedRequest);
  const machineAccess = executeMachineAccessReadOnly(context);
  return deepFreeze({
    orchestration: {
      status: machineAccess.status,
      operationId: machineAccess.operationId
    },
    execution: machineAccess.status === 'COMPLETED'
      ? machineAccess.evidence.adapterEvidence
      : { reason: machineAccess.reason },
    machineAccess
  });
}

module.exports = deepFreeze({ composeGovernedMachineAccess, executeGovernedMachineAccess });
