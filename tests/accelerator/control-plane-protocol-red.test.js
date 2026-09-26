'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createControlPlaneProtocolService,
} = require('../../accelerator/core/control-plane-service');
const {
  createInMemoryControlPlaneSubmissionRegistry,
} = require('../../accelerator/adapters/control-plane-submission-registry');

function submitRequest(overrides = {}) {
  return {
    protocolVersion: 'sacp.sdo-local/v1',
    requestId: 'request-protocol-red',
    operationId: 'operation-protocol-red',
    idempotencyKey: 'idempotency-protocol-red',
    intentFingerprint: 'a'.repeat(64),
    principal: { type: 'agent', id: 'agent-executor' },
    authority: {
      reference: 'authority-protocol-red',
      delegationReference: 'delegation-protocol-red',
    },
    requestedCapability: 'mutation.propose',
    workspace: {
      path: '/workspace/project',
      physicalIdentity: 'b'.repeat(64),
    },
    repository: {
      id: 'repository-project',
      head: 'c'.repeat(40),
    },
    expectedState: {
      repositoryHead: 'c'.repeat(40),
      worktreeFingerprint: 'd'.repeat(64),
      cas: 'e'.repeat(64),
    },
    approvalReference: 'approval-protocol-red',
    submittedAt: '2030-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('missing or incompatible protocol version is rejected before facade submission', async () => {
  const calls = {
    registry: 0,
    governedGateway: 0,
    surgicalOrchestrator: 0,
    mutationTransaction: 0,
    journal: 0,
  };
  const baseRegistry = createInMemoryControlPlaneSubmissionRegistry();
  const registry = Object.freeze({
    claim(input) {
      calls.registry += 1;
      return baseRegistry.claim(input);
    },
    get: baseRegistry.get,
    observe: baseRegistry.observe,
    inspect: baseRegistry.inspect,
  });
  const gateway = Object.freeze({
    describe: () => Object.freeze({
      protocol: 'sdo.non_physical_gateway.v1',
      physicalDispatch: false,
    }),
    submit: async () => {
      calls.governedGateway += 1;
      calls.surgicalOrchestrator += 1;
      calls.mutationTransaction += 1;
      calls.journal += 1;
      return null;
    },
  });
  const service = createControlPlaneProtocolService({
    registry,
    gateway,
    now: () => '2030-01-01T00:00:00.000Z',
    createExternalExecutionId: ({ operationId }) => `sdo-${operationId}`,
  });

  for (const request of [
    submitRequest({ protocolVersion: 'sacp.sdo-local/v2' }),
    (() => {
      const request = submitRequest();
      delete request.protocolVersion;
      return request;
    })(),
  ]) {
    await assert.rejects(
      service.submit(request),
      (error) => {
        assert.equal(error.classification, 'protocol_failure');
        assert.equal(error.code, 'UNSUPPORTED_PROTOCOL_VERSION');
        assert.doesNotMatch(error.message, /Bearer|credential|secret/i);
        return true;
      },
    );
  }

  assert.deepEqual(calls, {
    registry: 0,
    governedGateway: 0,
    surgicalOrchestrator: 0,
    mutationTransaction: 0,
    journal: 0,
  });
  assert.deepEqual(baseRegistry.inspect(), []);
});
