'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { Worker } = require('node:worker_threads');

const { createControlPlanePhysicalService } = require('../../accelerator/core/control-plane-physical-service');
const {
  defaultFilesystemDurabilityAdapter,
} = require('../../accelerator/adapters/filesystem-durability-adapter');
const {
  REGISTRY_WRITER_LOCK_FILENAME,
  createDurableControlPlanePhysicalSubmissionRegistry,
} = require('../../accelerator/adapters/durable-control-plane-physical-submission-registry');
const { createPhysicalV2Fixture } = require('./fixtures/control-plane-physical-v2-fixture');

const WORKER = path.join(__dirname, 'fixtures', 'durable-registry-race-worker.js');

function runWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER, { workerData: data });
    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`registry race worker exited ${code}`));
    });
  });
}

function service(current, registry, executor) {
  return createControlPlanePhysicalService({
    registry,
    governedPhysicalExecutor: executor,
    now: () => new Date().toISOString(),
    createExternalExecutionId: ({ operationId }) => `sdo-${operationId}`,
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('two registry writers cannot both claim the same physical operation', async (t) => {
  const current = createPhysicalV2Fixture();
  t.after(current.cleanup);
  const barrier = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  const common = {
    barrier,
    storageRoot: current.registryStorageRoot,
    request: current.request,
    externalExecutionId: 'sdo-operation-physical-v2-fixture',
    observedAt: new Date().toISOString(),
  };
  const outcomes = await Promise.all([runWorker(common), runWorker(common)]);
  assert.equal(
    outcomes.filter((outcome) => outcome.ok && outcome.created).length,
    1,
    `exactly one durable claim must win: ${JSON.stringify(outcomes)}`,
  );
  const loser = outcomes.find((outcome) => !(outcome.ok && outcome.created));
  assert.ok(loser, `one writer must lose ownership: ${JSON.stringify(outcomes)}`);
  assert.ok(
    (loser.ok && loser.created === false)
      || (!loser.ok && ['REGISTRY_WRITE_CONTENDED', 'STALE_REGISTRY_GENERATION'].includes(loser.code)),
    `the loser must replay or fail closed on durable ownership: ${JSON.stringify(outcomes)}`,
  );
});

test('two Control Plane clients submitting one logical mutation produce one physical effect', async (t) => {
  const current = createPhysicalV2Fixture();
  t.after(current.cleanup);
  const firstExecutor = current.createExecutor();
  const secondExecutor = current.createExecutor();
  const first = service(current, createDurableControlPlanePhysicalSubmissionRegistry({
    storageRoot: current.registryStorageRoot,
  }), firstExecutor);
  const second = service(current, createDurableControlPlanePhysicalSubmissionRegistry({
    storageRoot: current.registryStorageRoot,
  }), secondExecutor);

  const outcomes = await Promise.allSettled([
    first.submit(clone(current.request)),
    second.submit(clone(current.request)),
  ]);
  assert.equal(
    firstExecutor.inspectMetrics().gatewayDispatches
      + secondExecutor.inspectMetrics().gatewayDispatches,
    1,
  );
  assert.equal(
    outcomes.filter((outcome) => outcome.status === 'fulfilled'
      && outcome.value.classification === 'succeeded').length,
    1,
  );
  assert.equal(
    fs.readFileSync(path.join(current.repositoryPath, current.target), 'utf8'),
    current.before,
    'qualification never mutates the fixture Git worktree itself',
  );
});

test('two Control Plane clients with conflicting operation identities produce at most one effect', async (t) => {
  const current = createPhysicalV2Fixture();
  t.after(current.cleanup);
  const firstExecutor = current.createExecutor();
  const secondExecutor = current.createExecutor();
  const first = service(current, createDurableControlPlanePhysicalSubmissionRegistry({
    storageRoot: current.registryStorageRoot,
  }), firstExecutor);
  const second = service(current, createDurableControlPlanePhysicalSubmissionRegistry({
    storageRoot: current.registryStorageRoot,
  }), secondExecutor);
  const conflicting = clone(current.request);
  conflicting.requestId = 'request-physical-v2-conflict';
  conflicting.operationId = 'operation-physical-v2-conflict';
  conflicting.idempotencyKey = 'idempotency-physical-v2-conflict';
  conflicting.intentFingerprint = 'f'.repeat(64);

  const outcomes = await Promise.allSettled([
    first.submit(clone(current.request)),
    second.submit(conflicting),
  ]);
  assert.equal(
    outcomes.filter((outcome) => outcome.status === 'fulfilled'
      && outcome.value.classification === 'succeeded').length,
    1,
    `exactly one conflicting mutation may succeed: ${JSON.stringify(outcomes)}`,
  );
  assert.equal(current.readRecoveredEvidence().recoveryStatus, 'COMMITTED');
});

test('orphan and malformed registry ownership evidence fail closed without mutation', async (t) => {
  for (const malformed of [false, true]) {
    const current = createPhysicalV2Fixture();
    t.after(current.cleanup);
    const lockPath = path.join(current.registryStorageRoot, REGISTRY_WRITER_LOCK_FILENAME);
    const record = malformed ? {} : {
      schema: 'sdo.control_plane_physical_registry_writer.v1',
      protocolVersion: 'sacp.sdo-local/v2',
      ownerToken: 'a'.repeat(64),
      ownerProcess: 'orphan-owner:fixture',
    };
    fs.writeFileSync(lockPath, `${JSON.stringify(record)}\n`, { mode: 0o600 });
    const registry = createDurableControlPlanePhysicalSubmissionRegistry({
      storageRoot: current.registryStorageRoot,
    });
    assert.throws(
      () => registry.claim({
        request: current.request,
        externalExecutionId: 'sdo-operation-physical-v2-fixture',
        observedAt: new Date().toISOString(),
      }),
      (error) => error.code === (malformed
        ? 'REGISTRY_WRITER_LOCK_CORRUPT'
        : 'REGISTRY_WRITE_CONTENDED'),
    );
    assert.equal(current.readRecoveredEvidence(), null);
  }
});

test('symlink ownership substitution fails closed and preserves its target', (t) => {
  const current = createPhysicalV2Fixture();
  t.after(current.cleanup);
  const lockPath = path.join(current.registryStorageRoot, REGISTRY_WRITER_LOCK_FILENAME);
  const substitutionTarget = path.join(current.root, 'substitution-target');
  fs.writeFileSync(substitutionTarget, 'do-not-delete\n');
  if (process.platform === 'win32') {
    fs.writeFileSync(lockPath, '{}\n', { mode: 0o600 });
  } else {
    fs.symlinkSync(substitutionTarget, lockPath);
  }
  const registry = createDurableControlPlanePhysicalSubmissionRegistry({
    storageRoot: current.registryStorageRoot,
  });
  assert.throws(
    () => registry.claim({
      request: current.request,
      externalExecutionId: 'sdo-operation-physical-v2-fixture',
      observedAt: new Date().toISOString(),
    }),
    (error) => error.code === 'REGISTRY_WRITER_LOCK_CORRUPT',
  );
  assert.equal(fs.readFileSync(substitutionTarget, 'utf8'), 'do-not-delete\n');
});

test('stale writer release cannot delete replacement ownership evidence', (t) => {
  const current = createPhysicalV2Fixture();
  t.after(current.cleanup);
  const lockPath = path.join(current.registryStorageRoot, REGISTRY_WRITER_LOCK_FILENAME);
  const replacement = {
    schema: 'sdo.control_plane_physical_registry_writer.v1',
    protocolVersion: 'sacp.sdo-local/v2',
    ownerToken: 'b'.repeat(64),
    ownerProcess: 'newer-owner:fixture',
  };
  const filesystem = Object.freeze({
    ...fs,
    renameSync(from, to) {
      fs.renameSync(from, to);
      fs.unlinkSync(lockPath);
      fs.writeFileSync(lockPath, `${JSON.stringify(replacement)}\n`, { mode: 0o600 });
    },
  });
  const registry = createDurableControlPlanePhysicalSubmissionRegistry({
    storageRoot: current.registryStorageRoot,
    filesystem,
  });
  assert.throws(
    () => registry.claim({
      request: current.request,
      externalExecutionId: 'sdo-operation-physical-v2-fixture',
      observedAt: new Date().toISOString(),
    }),
    (error) => error.code === 'REGISTRY_WRITER_LOCK_CORRUPT',
  );
  assert.deepEqual(JSON.parse(fs.readFileSync(lockPath, 'utf8')), replacement);
});

test('registry fault after file flush but before rename proves NO_EFFECT', (t) => {
  const current = createPhysicalV2Fixture();
  t.after(current.cleanup);
  const filesystem = Object.freeze({
    ...fs,
    renameSync() {
      throw new Error('injected crash before registry rename');
    },
  });
  const registry = createDurableControlPlanePhysicalSubmissionRegistry({
    storageRoot: current.registryStorageRoot,
    filesystem,
  });
  assert.throws(() => registry.claim({
    request: current.request,
    externalExecutionId: 'sdo-operation-physical-v2-fixture',
    observedAt: new Date().toISOString(),
  }), /rejected the operation/);
  const reopened = createDurableControlPlanePhysicalSubmissionRegistry({
    storageRoot: current.registryStorageRoot,
  });
  assert.deepEqual(reopened.inspect(), []);
  assert.equal(current.readRecoveredEvidence(), null);
  assert.deepEqual(fs.readdirSync(current.registryStorageRoot), []);
});

test('registry fault after rename before directory sync is recoverable accepted ownership', (t) => {
  const current = createPhysicalV2Fixture();
  t.after(current.cleanup);
  let failRenameBoundary = true;
  const durabilityAdapter = Object.freeze({
    capabilities: defaultFilesystemDurabilityAdapter.capabilities,
    flushFile: defaultFilesystemDurabilityAdapter.flushFile,
    flushDirectory: defaultFilesystemDurabilityAdapter.flushDirectory,
    confirmJournal: defaultFilesystemDurabilityAdapter.confirmJournal,
    confirmLock: defaultFilesystemDurabilityAdapter.confirmLock,
    confirmRename(directory) {
      if (failRenameBoundary) {
        failRenameBoundary = false;
        throw new Error('injected crash after registry rename');
      }
      return defaultFilesystemDurabilityAdapter.confirmRename(directory);
    },
  });
  const registry = createDurableControlPlanePhysicalSubmissionRegistry({
    storageRoot: current.registryStorageRoot,
    durabilityAdapter,
  });
  assert.throws(() => registry.claim({
    request: current.request,
    externalExecutionId: 'sdo-operation-physical-v2-fixture',
    observedAt: new Date().toISOString(),
  }), /rejected the operation/);
  const reopened = createDurableControlPlanePhysicalSubmissionRegistry({
    storageRoot: current.registryStorageRoot,
  });
  const entries = reopened.inspect();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].currentObservationState, 'accepted');
  assert.equal(current.readRecoveredEvidence(), null);
  const replay = reopened.claim({
    request: current.request,
    externalExecutionId: 'sdo-operation-physical-v2-fixture',
    observedAt: new Date().toISOString(),
  });
  assert.equal(replay.created, false);
  assert.equal(reopened.inspectMetrics().zeroWriteReplays, 1);
});
