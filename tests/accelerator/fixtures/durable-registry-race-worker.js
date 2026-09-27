'use strict';

const { parentPort, workerData } = require('node:worker_threads');

const {
  createDurableControlPlanePhysicalSubmissionRegistry,
} = require('../../../accelerator/adapters/durable-control-plane-physical-submission-registry');

const barrier = new Int32Array(workerData.barrier);

try {
  const registry = createDurableControlPlanePhysicalSubmissionRegistry({
    storageRoot: workerData.storageRoot,
  });
  const arrived = Atomics.add(barrier, 0, 1) + 1;
  if (arrived === 2) Atomics.notify(barrier, 0, 2);
  else Atomics.wait(barrier, 0, 1, 5_000);
  const result = registry.claim({
    request: workerData.request,
    externalExecutionId: workerData.externalExecutionId,
    observedAt: workerData.observedAt,
  });
  parentPort.postMessage({ ok: true, created: result.created });
} catch (error) {
  parentPort.postMessage({
    ok: false,
    code: error && error.code,
    classification: error && error.classification,
    message: error && error.message,
  });
}
