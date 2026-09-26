'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const fixture = require('./fixtures/control-plane-protocol-v1.json');
const protocol = require('../../accelerator/core/control-plane-protocol');
const {
  createControlPlaneProtocolService,
} = require('../../accelerator/core/control-plane-service');
const {
  createInMemoryControlPlaneSubmissionRegistry,
} = require('../../accelerator/adapters/control-plane-submission-registry');

const NOW = '2030-01-01T00:00:00.000Z';

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function observation(submit, externalExecutionId, afterObservationSequence, overrides = {}) {
  return {
    protocolVersion: submit.protocolVersion,
    requestId: overrides.requestId || `request-observe-${afterObservationSequence}`,
    operationId: submit.operationId,
    idempotencyKey: submit.idempotencyKey,
    intentFingerprint: submit.intentFingerprint,
    principal: submit.principal,
    authority: submit.authority,
    workspace: submit.workspace,
    repository: submit.repository,
    externalExecutionId,
    afterObservationSequence,
    ...overrides,
  };
}

function service(options = {}) {
  const registry = options.registry || createInMemoryControlPlaneSubmissionRegistry();
  const value = createControlPlaneProtocolService({
    registry,
    now: () => NOW,
    createExternalExecutionId: ({ operationId }) => `sdo-${operationId}`,
    ...(options.gateway ? { gateway: options.gateway } : {}),
    ...(options.invokeNonPhysicalGateway
      ? { invokeNonPhysicalGateway: true }
      : {}),
    ...(options.supportsCancellation ? { supportsCancellation: true } : {}),
  });
  return { registry, service: value };
}

test('protocol fixture and schema digest are compatible with Control Plane', () => {
  assert.equal(protocol.PROTOCOL_VERSION, fixture.protocolVersion);
  assert.equal(protocol.SCHEMA_DIGEST, fixture.schemaDigest);
  assert.deepEqual(protocol.PROTOCOL_CAPABILITIES, fixture.capabilities);
  assert.equal(fixture.cases.length, 16);
});

test('negotiation is exact and capability discovery is deterministic and non-physical', async () => {
  const value = service().service;
  const negotiated = await value.negotiate(fixture.negotiation.compatible);
  assert.equal(negotiated.selectedVersion, protocol.PROTOCOL_VERSION);
  assert.equal(negotiated.classification, 'accepted');
  const capabilities = await value.capabilities({
    protocolVersion: protocol.PROTOCOL_VERSION,
    requestId: 'request-capabilities',
  });
  assert.deepEqual(capabilities.capabilities, ['inspect', 'reconcile', 'submit']);
  assert.equal(capabilities.physicalDispatchEnabled, false);
  assert.equal(capabilities.schemaDigest, fixture.schemaDigest);
  for (const invalid of [fixture.negotiation.incompatible, fixture.negotiation.missing]) {
    await assert.rejects(
      value.negotiate(invalid),
      (error) => error.code === 'UNSUPPORTED_PROTOCOL_VERSION',
    );
  }
});

test('closed fields protocol downgrade workspace escape and nested credentials fail closed', async () => {
  const value = service().service;
  for (const invalid of [
    { ...fixture.canonicalSubmit, unexpected: true },
    { ...fixture.canonicalSubmit, protocolVersion: 'sacp.sdo-local/v0' },
    {
      ...fixture.canonicalSubmit,
      workspace: { ...fixture.canonicalSubmit.workspace, path: '/workspace/../escape' },
    },
    {
      ...fixture.canonicalSubmit,
      authority: {
        ...fixture.canonicalSubmit.authority,
        metadata: { environment: { SAFE: 'value' } },
      },
    },
  ]) {
    await assert.rejects(
      value.submit(invalid),
      (error) => ['protocol_failure', 'authorization_failure'].includes(error.classification)
        && !/Bearer|PRIVATE KEY|provider token/i.test(error.message),
    );
  }
});

test('submission registry establishes ownership before acceptance and identical replay converges', async () => {
  const current = service();
  const first = await current.service.submit(fixture.canonicalSubmit);
  const replay = await current.service.submit(copy(fixture.canonicalSubmit));
  assert.equal(first.classification, 'accepted');
  assert.equal(first.code, 'SUBMISSION_REGISTERED');
  assert.equal(replay.code, 'IDENTICAL_REPLAY');
  assert.equal(replay.externalExecutionId, first.externalExecutionId);
  assert.equal(current.registry.inspect().length, 1);
});

test('registry failure is not acceptance and remains sanitized', async () => {
  const registry = Object.freeze({
    claim() { throw new Error('database password leaked'); },
    get() { throw new Error('unreachable'); },
    observe() { throw new Error('unreachable'); },
    inspect() { return []; },
  });
  await assert.rejects(
    service({ registry }).service.submit(fixture.canonicalSubmit),
    (error) => error.classification === 'internal_failure'
      && error.code === 'REGISTRY_FAILURE'
      && !error.message.includes('password'),
  );
});

test('conflicting idempotency principal substitution and authority widening fail closed', async () => {
  const current = service();
  await current.service.submit(fixture.canonicalSubmit);
  const conflict = copy(fixture.canonicalSubmit);
  conflict.operationId = 'operation-conflicting-intent';
  conflict.intentFingerprint = 'f'.repeat(64);
  await assert.rejects(current.service.submit(conflict), (error) => error.code === 'IDEMPOTENCY_CONFLICT');

  const substituted = copy(fixture.canonicalSubmit);
  substituted.idempotencyKey = 'idempotency-principal-substitution';
  substituted.principal.id = 'agent-substituted';
  await assert.rejects(
    current.service.submit(substituted),
    (error) => error.code === 'PRINCIPAL_SUBSTITUTION',
  );

  const widened = copy(fixture.canonicalSubmit);
  widened.idempotencyKey = 'idempotency-authority-widening';
  widened.authority.delegationReference = 'delegation-widened';
  await assert.rejects(
    current.service.submit(widened),
    (error) => error.code === 'AUTHORITY_WIDENING',
  );
});

test('workspace repository authority and external identity stay bound during observation', async () => {
  const current = service();
  const accepted = await current.service.submit(fixture.canonicalSubmit);
  const base = observation(fixture.canonicalSubmit, accepted.externalExecutionId, 1);
  await assert.rejects(
    current.service.reconcile({
      ...base,
      workspace: { ...base.workspace, physicalIdentity: '1'.repeat(64) },
    }),
    (error) => error.code === 'WORKSPACE_REPOSITORY_MISMATCH',
  );
  await assert.rejects(
    current.service.reconcile({ ...base, externalExecutionId: 'forged-external-id' }),
    (error) => error.code === 'FORGED_EXTERNAL_EXECUTION_ID',
  );
  await assert.rejects(
    current.service.reconcile({
      ...base,
      authority: { ...base.authority, delegationReference: 'delegation-stale' },
    }),
    (error) => error.code === 'AUTHORITY_WIDENING',
  );
});

test('reconciliation reports unknown without resubmission and advances monotonically', async () => {
  const current = service();
  const accepted = await current.service.submit(fixture.canonicalSubmit);
  const first = await current.service.reconcile(
    observation(fixture.canonicalSubmit, accepted.externalExecutionId, 1),
  );
  assert.equal(first.classification, 'unknown');
  assert.equal(first.observationSequence, 2);
  await assert.rejects(
    current.service.reconcile(
      observation(fixture.canonicalSubmit, accepted.externalExecutionId, 1),
    ),
    (error) => error.code === 'STALE_OBSERVATION_SEQUENCE',
  );
});

test('registry rejects result regression and stale observation sequence', () => {
  const registry = createInMemoryControlPlaneSubmissionRegistry();
  const claim = registry.claim({
    request: fixture.canonicalSubmit,
    externalExecutionId: 'sdo-regression-operation',
    observedAt: NOW,
  });
  const firstRequest = observation(fixture.canonicalSubmit, claim.entry.externalExecutionId, 1);
  const running = registry.observe({
    request: firstRequest,
    classification: 'running',
    code: 'RUNNING',
    observedAt: NOW,
  });
  assert.equal(running.observationSequence, 2);
  assert.throws(
    () => registry.observe({
      request: observation(fixture.canonicalSubmit, claim.entry.externalExecutionId, 2),
      classification: 'accepted',
      code: 'REGRESSION',
      observedAt: NOW,
    }),
    (error) => error.code === 'RESULT_STATE_REGRESSION',
  );
  assert.throws(
    () => registry.observe({
      request: firstRequest,
      classification: 'running',
      code: 'STALE',
      observedAt: NOW,
    }),
    (error) => error.code === 'STALE_OBSERVATION_SEQUENCE',
  );
});

test('ambiguous non-physical gateway submission becomes indeterminate after registry ownership', async () => {
  let gatewayCalls = 0;
  const gateway = Object.freeze({
    describe: () => Object.freeze({
      protocol: 'sdo.non_physical_gateway.v1',
      physicalDispatch: false,
    }),
    submit: async () => {
      gatewayCalls += 1;
      throw new Error('provider credential detail');
    },
  });
  const current = service({ gateway, invokeNonPhysicalGateway: true });
  const result = await current.service.submit(fixture.canonicalSubmit);
  assert.equal(result.classification, 'indeterminate');
  assert.equal(result.observationSequence, 2);
  assert.equal(gatewayCalls, 1);
  assert.equal(current.registry.inspect().length, 1);
  assert.doesNotMatch(JSON.stringify(result), /credential detail/);
});

test('cancellation requires advertisement and the same principal', async () => {
  const unsupported = service();
  const accepted = await unsupported.service.submit(fixture.canonicalSubmit);
  const request = observation(fixture.canonicalSubmit, accepted.externalExecutionId, 1);
  await assert.rejects(
    unsupported.service.cancel(request),
    (error) => error.classification === 'unsupported_capability',
  );

  const supported = service({ supportsCancellation: true });
  const registered = await supported.service.submit(fixture.canonicalSubmit);
  const substituted = observation(fixture.canonicalSubmit, registered.externalExecutionId, 1, {
    principal: { type: 'agent', id: 'agent-substituted' },
  });
  await assert.rejects(
    supported.service.cancel(substituted),
    (error) => error.code === 'PRINCIPAL_SUBSTITUTION',
  );
});

test('facade may invoke only an explicitly non-physical injected gateway after all preconditions', async () => {
  let gatewayCalls = 0;
  const gateway = Object.freeze({
    describe: () => Object.freeze({
      protocol: 'sdo.non_physical_gateway.v1',
      physicalDispatch: false,
    }),
    submit: async (request) => {
      gatewayCalls += 1;
      assert.equal(request.protocolVersion, protocol.PROTOCOL_VERSION);
    },
  });
  const current = service({ gateway, invokeNonPhysicalGateway: true });
  const result = await current.service.submit(fixture.canonicalSubmit);
  assert.equal(result.classification, 'accepted');
  assert.equal(current.service.physicalDispatchEnabled, false);
  assert.equal(gatewayCalls, 1);
});

test('facade and registry sources do not import physical orchestration transaction or journal modules', () => {
  const files = [
    '../../accelerator/core/control-plane-service.js',
    '../../accelerator/adapters/control-plane-submission-registry.js',
  ];
  const source = files.map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n');
  assert.doesNotMatch(source, /surgical-orchestrator|mutation-transaction|mutation-journal-adapter/);
  assert.doesNotMatch(source, /createServer|\.listen\(|node:net|node:http|child_process/);
});
