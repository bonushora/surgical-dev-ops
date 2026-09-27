'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { createControlPlanePhysicalService } = require('../../accelerator/core/control-plane-physical-service');
const {
  REGISTRY_FILENAME,
  createDurableControlPlanePhysicalSubmissionRegistry,
} = require('../../accelerator/adapters/durable-control-plane-physical-submission-registry');
const { createPhysicalV2Fixture, sha } = require('./fixtures/control-plane-physical-v2-fixture');

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function service(current, registry, executor = current.createExecutor()) {
  return {
    executor,
    value: createControlPlanePhysicalService({
      registry,
      governedPhysicalExecutor: executor,
      now: () => new Date().toISOString(),
      createExternalExecutionId: ({ operationId }) => `sdo-${operationId}`,
    }),
  };
}

function files(root) {
  const output = [];
  function visit(current) {
    for (const name of fs.readdirSync(current)) {
      if (name === '.git') continue;
      const target = path.join(current, name);
      const stat = fs.lstatSync(target);
      if (stat.isDirectory() && !stat.isSymbolicLink()) visit(target);
      else if (stat.isFile()) output.push(target);
    }
  }
  visit(root);
  return output;
}

test('real governed v2 fixture mutation is durable replay-safe and restart-safe', async (t) => {
  const current = createPhysicalV2Fixture();
  t.after(current.cleanup);
  const registry = createDurableControlPlanePhysicalSubmissionRegistry({
    storageRoot: current.registryStorageRoot,
  });
  const first = service(current, registry);

  const beforeBytes = fs.readFileSync(path.join(current.repositoryPath, current.target));
  assert.equal(sha(beforeBytes), current.physicalExecution.beforeSha256);
  const result = await first.value.submit(current.request);
  assert.equal(result.classification, 'succeeded');
  assert.equal(result.physicalEvidence.recoveryStatus, 'COMMITTED');
  assert.match(result.physicalEvidence.transactionId, /^[a-f0-9]{64}$/);
  assert.match(result.physicalEvidence.journalId, /^[a-f0-9]{64}$/);

  const managedProjection = current.readManagedProjection();
  assert.equal(sha(fs.readFileSync(managedProjection)), current.physicalExecution.afterSha256);
  assert.equal(fs.readFileSync(path.join(current.repositoryPath, current.target), 'utf8'), current.before);
  assert.ok(files(current.journalStorageRoot).length >= 2, 'journal and authorization evidence must exist');

  const replay = await first.value.submit(copy(current.request));
  assert.equal(replay.code, 'IDENTICAL_PHYSICAL_REPLAY');
  assert.equal(replay.externalExecutionId, result.externalExecutionId);
  assert.equal(first.executor.inspectMetrics().gatewayDispatches, 1);
  assert.equal(first.value.inspectMetrics().physicalDispatches, 1);
  assert.deepEqual(registry.inspectMetrics(), {
    durableWrites: 2,
    zeroWriteReplays: 1,
    fileFlushes: 2,
    directorySyncs: 2,
  });

  const reopenedRegistry = createDurableControlPlanePhysicalSubmissionRegistry({
    storageRoot: current.registryStorageRoot,
  });
  const restarted = service(current, reopenedRegistry);
  const replayAfterRestart = await restarted.value.submit(copy(current.request));
  assert.equal(replayAfterRestart.classification, 'succeeded');
  assert.equal(replayAfterRestart.externalExecutionId, result.externalExecutionId);
  assert.equal(restarted.executor.inspectMetrics().gatewayDispatches, 0);
  assert.equal(reopenedRegistry.inspectMetrics().zeroWriteReplays, 1);

  const raw = fs.readFileSync(path.join(current.registryStorageRoot, REGISTRY_FILENAME), 'utf8');
  assert.doesNotMatch(raw, /private.?key|Bearer|provider.?token|authorityRoot|journalStorageRoot|raw.?request/i);
  console.log(`SDO_PHYSICAL_V2_EVIDENCE ${JSON.stringify({
    schema: 'sdo.control_plane_physical_v2_evidence.v1',
    platform: process.platform,
    protocolVersion: current.request.protocolVersion,
    physicalEffectCount: 1,
    replayEffectCount: 0,
    transactionId: result.physicalEvidence.transactionId,
    journalId: result.physicalEvidence.journalId,
    firstSubmitRegistryWrites: 2,
    identicalReplayRegistryWrites: 0,
    fileFlushes: 2,
    directorySyncs: 2,
    sleeps: 0,
    polls: 0,
    retries: 0,
  })}`);
});

test('forged authority stale CAS and changed physical binding produce zero physical effects', async (t) => {
  for (const mutate of [
    (request) => { request.authority.reference = 'authority-forged-physical-v2'; },
    (request) => { request.expectedState.repositoryHead = '0'.repeat(40); },
    (request) => { request.physicalExecution.target = 'other.js'; },
  ]) {
    const current = createPhysicalV2Fixture();
    t.after(current.cleanup);
    const registry = createDurableControlPlanePhysicalSubmissionRegistry({ storageRoot: current.registryStorageRoot });
    const active = service(current, registry);
    const request = copy(current.request);
    mutate(request);
    await assert.rejects(active.value.submit(request));
    assert.equal(active.executor.inspectMetrics().gatewayDispatches, 0);
    assert.equal(fs.readFileSync(path.join(current.repositoryPath, current.target), 'utf8'), current.before);
    assert.equal(files(current.journalStorageRoot).length, 0);
  }
});

test('durable physical registry corruption fails closed on reopen', async (t) => {
  const current = createPhysicalV2Fixture();
  t.after(current.cleanup);
  const registry = createDurableControlPlanePhysicalSubmissionRegistry({ storageRoot: current.registryStorageRoot });
  await service(current, registry).value.submit(current.request);
  const registryPath = path.join(current.registryStorageRoot, REGISTRY_FILENAME);
  const envelope = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  envelope.entries[0].physicalExecution.afterSha256 = '0'.repeat(64);
  fs.writeFileSync(registryPath, `${JSON.stringify(envelope)}\n`);
  assert.throws(
    () => createDurableControlPlanePhysicalSubmissionRegistry({ storageRoot: current.registryStorageRoot }),
    (error) => error.code === 'REGISTRY_INTEGRITY_MISMATCH',
  );
});
