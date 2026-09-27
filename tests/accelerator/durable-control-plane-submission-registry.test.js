'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const fixture = require('./fixtures/control-plane-protocol-v1.json');
const {
  createControlPlaneProtocolService,
} = require('../../accelerator/core/control-plane-service');

const NOW = '2030-01-01T00:00:00.000Z';
const REGISTRY_FILENAME = 'control-plane-submission-registry.json';

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function registryRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-protocol-registry-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function durableRegistry(storageRoot) {
  const {
    createDurableControlPlaneSubmissionRegistry,
  } = require('../../accelerator/adapters/durable-control-plane-submission-registry');
  return createDurableControlPlaneSubmissionRegistry({ storageRoot });
}

function claim(registry, request = fixture.canonicalSubmit, externalExecutionId = 'sdo-durable-operation') {
  return registry.claim({ request, externalExecutionId, observedAt: NOW });
}

function observation(request, externalExecutionId, afterObservationSequence, overrides = {}) {
  return {
    protocolVersion: request.protocolVersion,
    requestId: `request-durable-observation-${afterObservationSequence}`,
    operationId: request.operationId,
    idempotencyKey: request.idempotencyKey,
    intentFingerprint: request.intentFingerprint,
    principal: request.principal,
    authority: request.authority,
    workspace: request.workspace,
    repository: request.repository,
    externalExecutionId,
    afterObservationSequence,
    ...overrides,
  };
}

function observe(registry, request, externalExecutionId, afterObservationSequence,
  classification, code = 'DURABLE_OBSERVATION') {
  return registry.observe({
    request: observation(request, externalExecutionId, afterObservationSequence),
    classification,
    code,
    observedAt: NOW,
  });
}

function registryFile(root) {
  return path.join(root, REGISTRY_FILENAME);
}

test('accepted submission survives durable registry restart', (t) => {
  const root = registryRoot(t);
  const accepted = claim(durableRegistry(root));
  const reopened = durableRegistry(root);

  assert.equal(accepted.created, true);
  assert.equal(reopened.inspect().length, 1);
  assert.equal(reopened.inspect()[0].externalExecutionId, accepted.entry.externalExecutionId);
  assert.equal(reopened.inspect()[0].currentObservationState, 'accepted');
});

test('conflicting idempotency remains rejected after durable registry restart', (t) => {
  const root = registryRoot(t);
  claim(durableRegistry(root));
  const conflicting = copy(fixture.canonicalSubmit);
  conflicting.operationId = 'operation-durable-conflict';
  conflicting.intentFingerprint = 'f'.repeat(64);

  assert.throws(
    () => claim(durableRegistry(root), conflicting, 'sdo-durable-conflict'),
    (error) => error.code === 'IDEMPOTENCY_CONFLICT',
  );
});

test('identical replay converges and conflicting idempotency fails before restart', (t) => {
  const root = registryRoot(t);
  const registry = durableRegistry(root);
  const accepted = claim(registry);
  const replay = claim(registry, copy(fixture.canonicalSubmit));
  const conflicting = copy(fixture.canonicalSubmit);
  conflicting.operationId = 'operation-durable-live-conflict';
  conflicting.intentFingerprint = '2'.repeat(64);

  assert.equal(replay.created, false);
  assert.equal(replay.entry.externalExecutionId, accepted.entry.externalExecutionId);
  assert.throws(
    () => claim(registry, conflicting, 'sdo-durable-live-conflict'),
    (error) => error.code === 'IDEMPOTENCY_CONFLICT',
  );
});

test('durable claim latency is monotonic structural evidence and is never persisted', (t) => {
  const root = registryRoot(t);
  const ticks = [100n, 125n, 200n, 205n];
  const {
    createDurableControlPlaneSubmissionRegistry,
  } = require('../../accelerator/adapters/durable-control-plane-submission-registry');
  const registry = createDurableControlPlaneSubmissionRegistry({
    storageRoot: root,
    monotonicNow: () => ticks.shift(),
  });
  claim(registry);
  claim(registry, copy(fixture.canonicalSubmit));

  assert.deepEqual(registry.inspectLatency(), {
    claimCount: 2,
    durableWriteCount: 1,
    claimNanoseconds: '30',
  });
  assert.doesNotMatch(fs.readFileSync(registryFile(root), 'utf8'), /Nanoseconds|latency/i);
});

test('corrupted durable registry fails closed', (t) => {
  const root = registryRoot(t);
  claim(durableRegistry(root));
  fs.writeFileSync(path.join(root, REGISTRY_FILENAME), '{"truncated":');

  assert.throws(
    () => durableRegistry(root),
    (error) => error.code === 'MALFORMED_PERSISTENT_STATE'
      && !error.message.includes('truncated'),
  );
});

test('stale registry generation CAS fails closed', (t) => {
  const root = registryRoot(t);
  const first = durableRegistry(root);
  const stale = durableRegistry(root);
  claim(first);
  const secondRequest = copy(fixture.canonicalSubmit);
  secondRequest.requestId = 'request-durable-second';
  secondRequest.operationId = 'operation-durable-second';
  secondRequest.idempotencyKey = 'idempotency-durable-second';
  secondRequest.intentFingerprint = '1'.repeat(64);

  assert.throws(
    () => claim(stale, secondRequest, 'sdo-durable-second'),
    (error) => error.code === 'STALE_REGISTRY_GENERATION',
  );
});

test('identical replay after restart converges without resubmission', async (t) => {
  const root = registryRoot(t);
  let gatewayCalls = 0;
  const gateway = Object.freeze({
    describe: () => Object.freeze({
      protocol: 'sdo.non_physical_gateway.v1',
      physicalDispatch: false,
    }),
    submit: async () => { gatewayCalls += 1; },
  });
  const service = (registry) => createControlPlaneProtocolService({
    registry,
    gateway,
    invokeNonPhysicalGateway: true,
    now: () => NOW,
    createExternalExecutionId: ({ operationId }) => `sdo-${operationId}`,
  });

  const accepted = await service(durableRegistry(root)).submit(fixture.canonicalSubmit);
  const replay = await service(durableRegistry(root)).submit(copy(fixture.canonicalSubmit));

  assert.equal(accepted.classification, 'accepted');
  assert.equal(replay.code, 'IDENTICAL_REPLAY');
  assert.equal(replay.externalExecutionId, accepted.externalExecutionId);
  assert.equal(gatewayCalls, 1);
});

test('principal substitution and operation reuse fail after restart', (t) => {
  const root = registryRoot(t);
  claim(durableRegistry(root));
  const substituted = copy(fixture.canonicalSubmit);
  substituted.idempotencyKey = 'idempotency-durable-principal';
  substituted.principal.id = 'agent-substituted';

  assert.throws(
    () => claim(durableRegistry(root), substituted, 'sdo-durable-principal'),
    (error) => error.code === 'PRINCIPAL_SUBSTITUTION',
  );
});

test('authority widening fails after restart', (t) => {
  const root = registryRoot(t);
  claim(durableRegistry(root));
  const widened = copy(fixture.canonicalSubmit);
  widened.idempotencyKey = 'idempotency-durable-authority';
  widened.authority.delegationReference = 'delegation-durable-widened';

  assert.throws(
    () => claim(durableRegistry(root), widened, 'sdo-durable-authority'),
    (error) => error.code === 'AUTHORITY_WIDENING',
  );
});

test('workspace and repository substitution fail after restart', (t) => {
  const root = registryRoot(t);
  const accepted = claim(durableRegistry(root));
  const base = observation(fixture.canonicalSubmit, accepted.entry.externalExecutionId, 1);
  const reopened = durableRegistry(root);

  for (const request of [
    { ...base, workspace: { ...base.workspace, physicalIdentity: '1'.repeat(64) } },
    { ...base, repository: { ...base.repository, id: 'repository-substituted' } },
  ]) {
    assert.throws(
      () => reopened.get(request),
      (error) => error.code === 'WORKSPACE_REPOSITORY_MISMATCH',
    );
  }
});

test('forged external execution identity fails after restart', (t) => {
  const root = registryRoot(t);
  claim(durableRegistry(root));
  const reopened = durableRegistry(root);

  assert.throws(
    () => reopened.get(observation(fixture.canonicalSubmit, 'sdo-forged-external', 1)),
    (error) => error.code === 'FORGED_EXTERNAL_EXECUTION_ID',
  );
});

test('running observation and monotonic sequence survive restart', (t) => {
  const root = registryRoot(t);
  const accepted = claim(durableRegistry(root));
  const running = observe(
    durableRegistry(root),
    fixture.canonicalSubmit,
    accepted.entry.externalExecutionId,
    1,
    'running',
  );
  const reopened = durableRegistry(root);

  assert.equal(running.observationSequence, 2);
  assert.equal(reopened.inspect()[0].currentObservationState, 'running');
  assert.equal(reopened.inspect()[0].observationSequence, 2);
  assert.throws(
    () => observe(
      reopened,
      fixture.canonicalSubmit,
      accepted.entry.externalExecutionId,
      1,
      'running',
    ),
    (error) => error.code === 'STALE_OBSERVATION_SEQUENCE',
  );
});

test('state regression fails after restart', (t) => {
  const root = registryRoot(t);
  const accepted = claim(durableRegistry(root));
  observe(
    durableRegistry(root),
    fixture.canonicalSubmit,
    accepted.entry.externalExecutionId,
    1,
    'running',
  );

  assert.throws(
    () => observe(
      durableRegistry(root),
      fixture.canonicalSubmit,
      accepted.entry.externalExecutionId,
      2,
      'accepted',
    ),
    (error) => error.code === 'RESULT_STATE_REGRESSION',
  );
});

test('terminal state survives restart and cannot regress', (t) => {
  const root = registryRoot(t);
  const accepted = claim(durableRegistry(root));
  observe(
    durableRegistry(root),
    fixture.canonicalSubmit,
    accepted.entry.externalExecutionId,
    1,
    'running',
  );
  const terminal = observe(
    durableRegistry(root),
    fixture.canonicalSubmit,
    accepted.entry.externalExecutionId,
    2,
    'succeeded',
  );
  const reopened = durableRegistry(root);

  assert.equal(terminal.observationSequence, 3);
  assert.equal(reopened.inspect()[0].currentObservationState, 'succeeded');
  assert.throws(
    () => observe(
      reopened,
      fixture.canonicalSubmit,
      accepted.entry.externalExecutionId,
      3,
      'running',
    ),
    (error) => error.code === 'RESULT_STATE_REGRESSION',
  );
});

test('nested credential smuggling is never persisted', (t) => {
  const root = registryRoot(t);
  const smuggled = copy(fixture.canonicalSubmit);
  smuggled.authority.metadata = {
    nested: { authorization: 'forbidden-durable-secret' },
  };

  assert.throws(
    () => claim(durableRegistry(root), smuggled),
    (error) => error.code === 'CREDENTIAL_MATERIAL_REJECTED'
      && !error.message.includes('forbidden-durable-secret'),
  );
  assert.equal(fs.existsSync(registryFile(root)), false);
});

test('durable format contains exact bindings and no credential or transport payload', (t) => {
  const root = registryRoot(t);
  claim(durableRegistry(root));
  const raw = fs.readFileSync(registryFile(root), 'utf8');
  const persisted = JSON.parse(raw);

  assert.equal(persisted.schemaVersion, 1);
  assert.equal(persisted.protocolVersion, fixture.protocolVersion);
  assert.equal(persisted.generation, 1);
  assert.equal(persisted.entries[0].operationId, fixture.canonicalSubmit.operationId);
  assert.equal(persisted.entries[0].requestId, fixture.canonicalSubmit.requestId);
  assert.equal(persisted.entries[0].externalExecutionId, 'sdo-durable-operation');
  assert.equal(persisted.entries[0].observationSequence, 1);
  assert.match(persisted.integrityDigest, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(
    raw,
    /Authorization|Bearer|providerToken|password|privateKey|environment|rawRequest|httpRequest/i,
  );
});

test('integrity digest mismatch fails closed', (t) => {
  const root = registryRoot(t);
  claim(durableRegistry(root));
  const persisted = JSON.parse(fs.readFileSync(registryFile(root), 'utf8'));
  persisted.entries[0].observedAt = '2030-01-01T00:00:01.000Z';
  fs.writeFileSync(registryFile(root), `${JSON.stringify(persisted)}\n`);

  assert.throws(
    () => durableRegistry(root),
    (error) => error.code === 'REGISTRY_INTEGRITY_MISMATCH',
  );
});

test('truncated durable registry fails closed', (t) => {
  const root = registryRoot(t);
  claim(durableRegistry(root));
  const raw = fs.readFileSync(registryFile(root));
  fs.writeFileSync(registryFile(root), raw.subarray(0, raw.length - 12));

  assert.throws(
    () => durableRegistry(root),
    (error) => error.code === 'MALFORMED_PERSISTENT_STATE',
  );
});

test('malformed persistent state fails closed', (t) => {
  const root = registryRoot(t);
  fs.writeFileSync(registryFile(root), '{}\n');

  assert.throws(
    () => durableRegistry(root),
    (error) => error.code === 'MALFORMED_PERSISTENT_STATE',
  );
});

test('unknown registry schema version fails closed', (t) => {
  const root = registryRoot(t);
  claim(durableRegistry(root));
  const persisted = JSON.parse(fs.readFileSync(registryFile(root), 'utf8'));
  persisted.schemaVersion = 999;
  fs.writeFileSync(registryFile(root), `${JSON.stringify(persisted)}\n`);

  assert.throws(
    () => durableRegistry(root),
    (error) => error.code === 'UNSUPPORTED_REGISTRY_SCHEMA_VERSION',
  );
});

test('storage failure before first publication is never acceptance and cleans its temp file', (t) => {
  const root = registryRoot(t);
  const failingFilesystem = Object.create(fs);
  failingFilesystem.writeFileSync = () => {
    throw new Error('raw storage password detail');
  };
  const {
    createDurableControlPlaneSubmissionRegistry,
  } = require('../../accelerator/adapters/durable-control-plane-submission-registry');
  const registry = createDurableControlPlaneSubmissionRegistry({
    storageRoot: root,
    filesystem: failingFilesystem,
  });

  assert.throws(
    () => claim(registry),
    (error) => error.code === 'REGISTRY_STORAGE_FAILURE'
      && !error.message.includes('password'),
  );
  assert.deepEqual(fs.readdirSync(root), []);
});

test('failed replacement preserves the last known good durable generation', (t) => {
  const root = registryRoot(t);
  const accepted = claim(durableRegistry(root));
  const failingFilesystem = Object.create(fs);
  failingFilesystem.renameSync = () => {
    throw new Error('raw replacement secret');
  };
  const {
    createDurableControlPlaneSubmissionRegistry,
  } = require('../../accelerator/adapters/durable-control-plane-submission-registry');
  const failing = createDurableControlPlaneSubmissionRegistry({
    storageRoot: root,
    filesystem: failingFilesystem,
  });

  assert.throws(
    () => observe(
      failing,
      fixture.canonicalSubmit,
      accepted.entry.externalExecutionId,
      1,
      'running',
    ),
    (error) => error.code === 'REGISTRY_STORAGE_FAILURE',
  );
  const reopened = durableRegistry(root);
  assert.equal(reopened.inspect()[0].currentObservationState, 'accepted');
  assert.equal(reopened.inspect()[0].observationSequence, 1);
  assert.deepEqual(fs.readdirSync(root), [REGISTRY_FILENAME]);
});
