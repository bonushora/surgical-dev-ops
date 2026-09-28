'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PRODUCTION_ENABLEMENT_STATES,
  createControlPlaneProductionEnablement,
} = require('../../accelerator/core/control-plane-production-enablement');
const { createControlPlanePhysicalService } = require('../../accelerator/core/control-plane-physical-service');
const {
  createDurableControlPlanePhysicalSubmissionRegistry,
} = require('../../accelerator/adapters/durable-control-plane-physical-submission-registry');
const { createPhysicalV2Fixture } = require('./fixtures/control-plane-physical-v2-fixture');

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function configuration(current) {
  return {
    schema: 'sdo.control_plane_production_eligibility.v1',
    mode: 'ENABLED',
    workspace: {
      path: current.request.workspace.path,
      physicalIdentity: current.request.workspace.physicalIdentity,
      repositoryId: current.request.repository.id,
      allowedCapabilities: ['mutation.applyConditional'],
      allowedTargets: [current.request.physicalExecution.target],
    },
  };
}

function inspection(request, changes = {}) {
  return {
    schema: 'sdo.control_plane_production_operation_inspection.v1',
    canonicalWorkspacePath: request.workspace.path,
    physicalWorkspaceIdentity: request.workspace.physicalIdentity,
    repositoryId: request.repository.id,
    repositoryHead: request.repository.head,
    worktreeFingerprint: request.expectedState.worktreeFingerprint,
    target: request.physicalExecution.target,
    targetConfined: true,
    beforeSha256: request.physicalExecution.beforeSha256,
    qualified: true,
    clean: true,
    ...changes,
  };
}

function authorized(request, changes = {}) {
  return {
    status: 'VALID',
    oneShot: true,
    consumed: false,
    binding: {
      operationId: request.operationId,
      authority: request.authority,
      approvalReference: request.approvalReference,
      workspace: request.workspace,
      repository: request.repository,
      expectedState: request.expectedState,
      physicalExecution: request.physicalExecution,
      ...changes,
    },
    authorizedExecution: { localSurgicalEvidence: true },
  };
}

function gate(current, overrides = {}) {
  const value = createControlPlaneProductionEnablement({
    implementationAvailable: overrides.implementationAvailable !== false,
    productionConfiguration: Object.hasOwn(overrides, 'productionConfiguration')
      ? overrides.productionConfiguration : configuration(current),
    inspectOperation: overrides.inspectOperation || (async ({ request }) => inspection(request)),
    resolveSurgicalAuthority: Object.hasOwn(overrides, 'resolveSurgicalAuthority')
      ? overrides.resolveSurgicalAuthority : (async ({ request }) => authorized(request)),
    validateCas: overrides.validateCas || (async () => ({ status: 'MATCH' })),
  });
  return value;
}

test('production enablement exposes explicit states and never treats discovery as authority', async (t) => {
  const current = createPhysicalV2Fixture();
  t.after(current.cleanup);
  const cases = [
    ['implementation unavailable', { implementationAvailable: false }, 'IMPLEMENTATION_UNAVAILABLE'],
    ['implementation available and production disabled', { productionConfiguration: null }, 'PRODUCTION_DISABLED'],
    ['production configured without human authority', { resolveSurgicalAuthority: null }, 'AUTHORITY_REQUIRED'],
    ['stale human authority', { resolveSurgicalAuthority: async () => ({ status: 'STALE' }) }, 'AUTHORITY_REQUIRED'],
  ];
  for (const [name, overrides, expected] of cases) {
    const candidate = gate(current, overrides);
    const evaluated = await candidate.evaluate(clone(current.request));
    assert.equal(evaluated.state, expected, name);
    assert.equal(evaluated.dispatchPermitted, false, name);
  }
  assert.deepEqual(Object.keys(PRODUCTION_ENABLEMENT_STATES).sort(), [
    'AUTHORITY_REQUIRED', 'AUTHORITY_VALID', 'IMPLEMENTATION_AVAILABLE',
    'IMPLEMENTATION_UNAVAILABLE', 'OPERATION_INELIGIBLE', 'PRODUCTION_CONFIGURED',
    'PRODUCTION_DISABLED', 'READY_FOR_EXACT_PHYSICAL_OPERATION',
  ]);
});

test('authority for a different exact binding never becomes current authority', async (t) => {
  const current = createPhysicalV2Fixture();
  t.after(current.cleanup);
  const variants = [
    ['operation', { operationId: 'operation-different-binding' }],
    ['target', { physicalExecution: { ...current.request.physicalExecution, target: 'different.js' } }],
    ['workspace', { workspace: { ...current.request.workspace, path: `${current.request.workspace.path}-other` } }],
    ['HEAD', { repository: { ...current.request.repository, head: 'f'.repeat(40) } }],
  ];
  for (const [name, changes] of variants) {
    const candidate = gate(current, {
      resolveSurgicalAuthority: async ({ request }) => authorized(request, changes),
    });
    const evaluated = await candidate.evaluate(clone(current.request));
    assert.equal(evaluated.state, 'AUTHORITY_REQUIRED', name);
    assert.equal(evaluated.dispatchPermitted, false, name);
  }
});

test('stale CAS after valid exact authority remains ineligible with zero effects', async (t) => {
  const current = createPhysicalV2Fixture();
  t.after(current.cleanup);
  const candidate = gate(current, { validateCas: async () => ({ status: 'STALE' }) });
  const evaluated = await candidate.evaluate(clone(current.request));
  assert.equal(evaluated.state, 'OPERATION_INELIGIBLE');
  assert.ok(evaluated.transitions.includes('AUTHORITY_VALID'));
  assert.equal(evaluated.dispatchPermitted, false);
});

test('only exact configuration eligibility current Surgical authority and CAS permit dispatch', async (t) => {
  const current = createPhysicalV2Fixture();
  t.after(current.cleanup);
  const candidate = gate(current);
  const evaluated = await candidate.evaluate(clone(current.request));
  assert.equal(evaluated.state, 'READY_FOR_EXACT_PHYSICAL_OPERATION');
  assert.equal(evaluated.dispatchPermitted, true);
  assert.deepEqual(evaluated.transitions, [
    'IMPLEMENTATION_AVAILABLE', 'PRODUCTION_CONFIGURED', 'AUTHORITY_VALID',
    'READY_FOR_EXACT_PHYSICAL_OPERATION',
  ]);
  assert.deepEqual(await candidate.resolveAuthorizedExecution({ request: clone(current.request) }), {
    localSurgicalEvidence: true,
  });
});

test('configuration environment and Control Plane approval cannot mint Surgical authority', async (t) => {
  const current = createPhysicalV2Fixture();
  t.after(current.cleanup);
  const previous = process.env.SDO_PRODUCTION_PHYSICAL_ENABLED;
  process.env.SDO_PRODUCTION_PHYSICAL_ENABLED = 'true';
  t.after(() => {
    if (previous === undefined) delete process.env.SDO_PRODUCTION_PHYSICAL_ENABLED;
    else process.env.SDO_PRODUCTION_PHYSICAL_ENABLED = previous;
  });
  for (const candidate of [
    gate(current, { resolveSurgicalAuthority: null }),
    gate(current, { productionConfiguration: null }),
  ]) {
    const evaluated = await candidate.evaluate(clone(current.request));
    assert.notEqual(evaluated.state, 'READY_FOR_EXACT_PHYSICAL_OPERATION');
    await assert.rejects(() => candidate.resolveAuthorizedExecution({ request: clone(current.request) }));
  }
});

test('one-shot Surgical authority cannot be replayed for a second physical effect', async (t) => {
  const current = createPhysicalV2Fixture();
  t.after(current.cleanup);
  let consumed = false;
  const candidate = gate(current, {
    resolveSurgicalAuthority: async ({ request }) => consumed
      ? { status: 'CONSUMED' }
      : authorized(request),
  });
  await candidate.resolveAuthorizedExecution({ request: clone(current.request) });
  consumed = true;
  await assert.rejects(
    () => candidate.resolveAuthorizedExecution({ request: clone(current.request) }),
    (error) => error.code === 'CURRENT_SURGICAL_AUTHORITY_REQUIRED',
  );
});

test('production gate composes only with the governed executor and identical replay has one effect', async (t) => {
  const current = createPhysicalV2Fixture();
  t.after(current.cleanup);
  const enablement = gate(current, {
    resolveSurgicalAuthority: async ({ request }) => ({
      ...authorized(request),
      authorizedExecution: current.resolveAuthorizedExecution(),
    }),
  });
  const executor = current.createExecutor({
    resolveAuthorizedExecution: enablement.resolveAuthorizedExecution,
  });
  const service = createControlPlanePhysicalService({
    registry: createDurableControlPlanePhysicalSubmissionRegistry({
      storageRoot: current.registryStorageRoot,
    }),
    governedPhysicalExecutor: executor,
    now: () => new Date().toISOString(),
    createExternalExecutionId: ({ operationId }) => `sdo-${operationId}`,
  });
  const first = await service.submit(clone(current.request));
  const replay = await service.submit(clone(current.request));
  assert.equal(first.classification, 'succeeded');
  assert.equal(replay.code, 'IDENTICAL_PHYSICAL_REPLAY');
  assert.equal(executor.inspectMetrics().gatewayDispatches, 1);
});
