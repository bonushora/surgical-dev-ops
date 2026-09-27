'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const v1 = require('../../accelerator/core/control-plane-protocol');
const { createControlPlaneProtocolService } = require('../../accelerator/core/control-plane-service');
const { createInMemoryControlPlaneSubmissionRegistry } = require('../../accelerator/adapters/control-plane-submission-registry');

const NOW = '2030-01-01T00:00:00.000Z';

function loadV2() {
  return {
    protocol: require('../../accelerator/core/control-plane-protocol-v2'),
    service: require('../../accelerator/core/control-plane-physical-service'),
    registry: require('../../accelerator/adapters/control-plane-physical-submission-registry'),
  };
}

function request(overrides = {}) {
  return {
    protocolVersion: 'sacp.sdo-local/v2',
    requestId: 'request-physical-first-red',
    operationId: 'operation-physical-first-red',
    idempotencyKey: 'idempotency-physical-first-red',
    intentFingerprint: '1'.repeat(64),
    principal: { type: 'agent', id: 'agent-physical-first-red' },
    authority: {
      reference: 'authority-physical-first-red',
      delegationReference: 'delegation-physical-first-red',
    },
    requestedCapability: 'mutation.applyConditional',
    workspace: { path: '/workspace/fixture', physicalIdentity: '2'.repeat(64) },
    repository: { id: 'repository-physical-first-red', head: '3'.repeat(40) },
    expectedState: {
      repositoryHead: '3'.repeat(40),
      worktreeFingerprint: '4'.repeat(64),
      cas: '5'.repeat(64),
    },
    approvalReference: 'approval-physical-first-red',
    submittedAt: NOW,
    physicalExecution: {
      target: 'target.txt',
      beforeSha256: '6'.repeat(64),
      afterSha256: '7'.repeat(64),
      contractFingerprint: '8'.repeat(64),
      proposalFingerprint: '9'.repeat(64),
      authorizationFingerprint: 'a'.repeat(64),
      executionReference: 'execution-physical-first-red',
    },
    ...overrides,
  };
}

function physicalService(executor) {
  const { service, registry } = loadV2();
  return service.createControlPlanePhysicalService({
    registry: registry.createInMemoryControlPlanePhysicalSubmissionRegistry(),
    ...(executor ? { governedPhysicalExecutor: executor } : {}),
    now: () => NOW,
    createExternalExecutionId: ({ operationId }) => `sdo-${operationId}`,
  });
}

test('v1 remains frozen and cannot physically mutate', async () => {
  let dispatches = 0;
  const service = createControlPlaneProtocolService({
    registry: createInMemoryControlPlaneSubmissionRegistry(),
    now: () => NOW,
    createExternalExecutionId: ({ operationId }) => `sdo-${operationId}`,
  });
  const capabilities = await service.capabilities({
    protocolVersion: v1.PROTOCOL_VERSION,
    requestId: 'request-v1-first-red',
  });
  assert.equal(v1.SCHEMA_DIGEST, 'cd4e3fa7d7086f78291ef35b87e1b450be15bc77cb6ae8527e299101e5a11935');
  assert.equal(capabilities.physicalDispatchEnabled, false);
  assert.equal(dispatches, 0);
});

test('v2 without a governed executor advertises physical dispatch disabled', async () => {
  const service = physicalService();
  const result = await service.capabilities({
    protocolVersion: 'sacp.sdo-local/v2',
    requestId: 'request-v2-disabled-first-red',
  });
  assert.equal(result.physicalDispatchEnabled, false);
  assert.deepEqual(result.capabilities, ['inspect', 'reconcile']);
});

test('v2 cannot dispatch without exact local Surgical authority', async () => {
  const executor = Object.freeze({
    describe: () => Object.freeze({
      protocolVersion: 'sacp.sdo-local/v2',
      capability: 'mutation.applyConditional',
      physicalDispatchEnabled: true,
      authorityOwner: 'surgical-dev-ops',
      genericShell: false,
      genericFilesystemWriter: false,
      providerCredential: false,
    }),
    execute: async () => { throw Object.assign(new Error('denied'), { code: 'LOCAL_AUTHORITY_REQUIRED', classification: 'authorization_failure' }); },
    reconcile: async () => Object.freeze({ classification: 'unknown', code: 'PHYSICAL_EVIDENCE_UNKNOWN' }),
  });
  await assert.rejects(
    physicalService(executor).submit(request()),
    (error) => error.code === 'LOCAL_AUTHORITY_REQUIRED',
  );
});

test('stale repository CAS fails before any physical write', async () => {
  let effects = 0;
  const executor = Object.freeze({
    describe: () => Object.freeze({
      protocolVersion: 'sacp.sdo-local/v2', capability: 'mutation.applyConditional',
      physicalDispatchEnabled: true, authorityOwner: 'surgical-dev-ops', genericShell: false,
      genericFilesystemWriter: false, providerCredential: false,
    }),
    execute: async () => { effects += 1; return { classification: 'succeeded' }; },
    reconcile: async () => ({ classification: 'unknown', code: 'PHYSICAL_EVIDENCE_UNKNOWN' }),
  });
  const stale = request({
    expectedState: { repositoryHead: '0'.repeat(40), worktreeFingerprint: '4'.repeat(64), cas: '5'.repeat(64) },
  });
  await assert.rejects(physicalService(executor).submit(stale), (error) => error.classification === 'stale_state');
  assert.equal(effects, 0);
});

test('Control Plane references cannot mint Surgical authority', async () => {
  const forged = request({
    authority: { reference: 'authority-forged-first-red', delegationReference: 'delegation-forged-first-red' },
    approvalReference: 'approval-forged-first-red',
  });
  await assert.rejects(physicalService().submit(forged), (error) => error.code === 'PHYSICAL_DISPATCH_DISABLED');
});

test('a valid pre-authorized v2 mutation has a physical implementation path', async () => {
  let effects = 0;
  const executor = Object.freeze({
    describe: () => Object.freeze({
      protocolVersion: 'sacp.sdo-local/v2', capability: 'mutation.applyConditional',
      physicalDispatchEnabled: true, authorityOwner: 'surgical-dev-ops', genericShell: false,
      genericFilesystemWriter: false, providerCredential: false,
    }),
    execute: async () => {
      effects += 1;
      return Object.freeze({
        classification: 'succeeded', code: 'PHYSICAL_MUTATION_SUCCEEDED',
        physicalEvidence: Object.freeze({
          transactionId: 'transaction-first-red', journalId: 'journal-first-red',
          recoveryStatus: 'COMMITTED', effectFingerprint: 'b'.repeat(64),
        }),
      });
    },
    reconcile: async () => Object.freeze({ classification: 'unknown', code: 'PHYSICAL_EVIDENCE_UNKNOWN' }),
  });
  const result = await physicalService(executor).submit(request());
  assert.equal(result.classification, 'succeeded');
  assert.equal(effects, 1);
});

test('identical physical replay returns the same identity without a second effect', async () => {
  let effects = 0;
  const executor = Object.freeze({
    describe: () => Object.freeze({
      protocolVersion: 'sacp.sdo-local/v2', capability: 'mutation.applyConditional',
      physicalDispatchEnabled: true, authorityOwner: 'surgical-dev-ops', genericShell: false,
      genericFilesystemWriter: false, providerCredential: false,
    }),
    execute: async () => {
      effects += 1;
      return Object.freeze({
        classification: 'succeeded', code: 'PHYSICAL_MUTATION_SUCCEEDED',
        physicalEvidence: Object.freeze({
          transactionId: 'transaction-first-red', journalId: 'journal-first-red',
          recoveryStatus: 'COMMITTED', effectFingerprint: 'b'.repeat(64),
        }),
      });
    },
    reconcile: async () => Object.freeze({ classification: 'unknown', code: 'PHYSICAL_EVIDENCE_UNKNOWN' }),
  });
  const service = physicalService(executor);
  const first = await service.submit(request());
  const replay = await service.submit(JSON.parse(JSON.stringify(request())));
  assert.equal(replay.externalExecutionId, first.externalExecutionId);
  assert.equal(replay.code, 'IDENTICAL_PHYSICAL_REPLAY');
  assert.equal(effects, 1);
});

test('ambiguous response never authorizes automatic physical resubmission', async () => {
  let effects = 0;
  const executor = Object.freeze({
    describe: () => Object.freeze({
      protocolVersion: 'sacp.sdo-local/v2', capability: 'mutation.applyConditional',
      physicalDispatchEnabled: true, authorityOwner: 'surgical-dev-ops', genericShell: false,
      genericFilesystemWriter: false, providerCredential: false,
    }),
    execute: async () => { effects += 1; throw Object.assign(new Error('response lost'), { code: 'PHYSICAL_OUTCOME_INDETERMINATE', classification: 'indeterminate' }); },
    reconcile: async () => Object.freeze({ classification: 'unknown', code: 'PHYSICAL_EVIDENCE_UNKNOWN' }),
  });
  const service = physicalService(executor);
  const result = await service.submit(request());
  assert.equal(result.classification, 'indeterminate');
  assert.equal(effects, 1);
  assert.equal(service.inspectMetrics().automaticResubmissions, 0);
});
