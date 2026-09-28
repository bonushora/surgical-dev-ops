'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  REGISTRY_WRITER_LOCK_FILENAME,
  createDurableControlPlanePhysicalSubmissionRegistry,
} = require('../../accelerator/adapters/durable-control-plane-physical-submission-registry');
const {
  RECOVERY_CLASSIFICATIONS,
  createControlPlaneRegistryWriterRecovery,
} = require('../../accelerator/adapters/control-plane-registry-writer-recovery');
const { canonicalSerialize } = require('../../accelerator/core/control-plane-protocol-v2');
const { createPhysicalV2Fixture } = require('./fixtures/control-plane-physical-v2-fixture');

function sha(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function installOwner(current, changes = {}) {
  const registry = createDurableControlPlanePhysicalSubmissionRegistry({ storageRoot: current.registryStorageRoot });
  registry.claim({
    request: current.request,
    externalExecutionId: 'sdo-operation-physical-v2-fixture',
    observedAt: new Date().toISOString(),
  });
  const envelope = JSON.parse(fs.readFileSync(path.join(
    current.registryStorageRoot,
    'control-plane-physical-submission-registry.json',
  ), 'utf8'));
  const owner = {
    schema: 'sdo.control_plane_physical_registry_writer.v2',
    protocolVersion: 'sacp.sdo-local/v2',
    ownerToken: 'a'.repeat(64),
    ownerProcess: 'opaque-writer-session:fixture',
    operationId: current.request.operationId,
    externalExecutionId: 'sdo-operation-physical-v2-fixture',
    workspace: current.request.workspace,
    repository: current.request.repository,
    physicalExecution: current.request.physicalExecution,
    observedGeneration: envelope.generation,
    observedIntegrityDigest: envelope.integrityDigest,
    intendedGeneration: envelope.generation + 1,
    mutationKind: 'OBSERVE',
    ...changes,
  };
  fs.writeFileSync(
    path.join(current.registryStorageRoot, REGISTRY_WRITER_LOCK_FILENAME),
    `${JSON.stringify(owner)}\n`,
    { mode: 0o600 },
  );
  return owner;
}

function request(current, owner, changes = {}) {
  return {
    schema: 'sdo.control_plane_registry_writer_recovery_request.v1',
    recoveryId: 'recovery-operation-physical-v2-fixture',
    operationId: owner.operationId,
    externalExecutionId: owner.externalExecutionId,
    workspace: owner.workspace,
    repository: owner.repository,
    observedOwnerFingerprint: sha(canonicalSerialize(owner)),
    observedGeneration: owner.observedGeneration,
    observedIntegrityDigest: owner.observedIntegrityDigest,
    authorizationReference: 'authority-registry-recovery-once',
    ...changes,
  };
}

function evidence(owner, stage = 'NO_OPERATION', effect = 'NO_EFFECT', changes = {}) {
  return {
    schema: 'sdo.control_plane_registry_writer_surgical_evidence.v1',
    writerOwnership: 'ORPHAN_CONFIRMED',
    operationId: owner.operationId,
    externalExecutionId: owner.externalExecutionId,
    stage,
    effect,
    journalCorrelation: effect === 'COMMITTED' ? {
      transactionId: 'transaction-recovery-fixture',
      journalId: 'journal-recovery-fixture',
      effectFingerprint: 'e'.repeat(64),
      terminal: stage === 'TERMINAL_JOURNAL',
    } : null,
    ...changes,
  };
}

function recovery(current, owner, overrides = {}) {
  let authorizationConsumed = false;
  const adapter = createControlPlaneRegistryWriterRecovery({
    storageRoot: current.registryStorageRoot,
    inspectSurgicalEvidence: overrides.inspectSurgicalEvidence
      || (async () => evidence(owner, overrides.stage, overrides.effect)),
    consumeRecoveryAuthorization: overrides.consumeRecoveryAuthorization || (async ({ request: input }) => {
      if (authorizationConsumed) return { status: 'CONSUMED' };
      authorizationConsumed = true;
      return { status: 'VALID', oneShot: true, binding: clone(input) };
    }),
    ...(overrides.filesystem ? { filesystem: overrides.filesystem } : {}),
  });
  return { adapter, consumed: () => authorizationConsumed };
}

test('recovery classifications are closed and exact', () => {
  assert.deepEqual([...RECOVERY_CLASSIFICATIONS], [
    'NOT_ORPHANED', 'ORPHAN_CONFIRMED', 'RECOVERY_NOT_AUTHORIZED',
    'RECOVERY_CONFLICT', 'RECOVERED_NO_EFFECT', 'RECOVERED_COMMITTED',
    'INDETERMINATE', 'CORRUPT_FAIL_CLOSED',
  ]);
});

test('orphan stages recover only from physical Surgical evidence', async (t) => {
  const cases = [
    ['NO_OPERATION', 'NO_EFFECT', 'RECOVERED_NO_EFFECT'],
    ['LOGICAL_CLAIM', 'NO_EFFECT', 'RECOVERED_NO_EFFECT'],
    ['AUTHORITY_CONSUMED', 'NO_EFFECT', 'RECOVERED_NO_EFFECT'],
    ['PREPARED', 'NO_EFFECT', 'RECOVERED_NO_EFFECT'],
    ['PHYSICAL_COMMIT', 'COMMITTED', 'RECOVERED_COMMITTED'],
    ['TERMINAL_JOURNAL', 'COMMITTED', 'RECOVERED_COMMITTED'],
  ];
  for (const [stage, effect, expected] of cases) {
    const current = createPhysicalV2Fixture();
    t.after(current.cleanup);
    const owner = installOwner(current);
    const candidate = recovery(current, owner, { stage, effect });
    const result = await candidate.adapter.recover(request(current, owner));
    assert.equal(result.classification, expected, stage);
    assert.equal(candidate.consumed(), true, stage);
    assert.equal(fs.existsSync(path.join(current.registryStorageRoot, REGISTRY_WRITER_LOCK_FILENAME)), false, stage);
    assert.equal(result.durable, true, stage);
  }
});

test('active absent and contradictory evidence never remove ownership', async (t) => {
  for (const [name, inspected, expected] of [
    ['active', evidence({ operationId: 'operation-physical-v2-fixture', externalExecutionId: 'sdo-operation-physical-v2-fixture' }, 'LOGICAL_CLAIM', 'NO_EFFECT', { writerOwnership: 'ACTIVE' }), 'NOT_ORPHANED'],
    ['absent', null, 'INDETERMINATE'],
    ['contradictory', evidence({ operationId: 'wrong-operation', externalExecutionId: 'wrong-execution' }, 'PHYSICAL_COMMIT', 'NO_EFFECT'), 'INDETERMINATE'],
  ]) {
    const current = createPhysicalV2Fixture();
    t.after(current.cleanup);
    const owner = installOwner(current);
    const candidate = recovery(current, owner, { inspectSurgicalEvidence: async () => inspected });
    const result = await candidate.adapter.recover(request(current, owner));
    assert.equal(result.classification, expected, name);
    assert.equal(fs.existsSync(path.join(current.registryStorageRoot, REGISTRY_WRITER_LOCK_FILENAME)), true, name);
    assert.equal(candidate.consumed(), false, name);
  }
});

test('wrong binding forged or reused authorization fails closed', async (t) => {
  const current = createPhysicalV2Fixture();
  t.after(current.cleanup);
  const owner = installOwner(current);
  for (const changes of [
    { workspace: { ...owner.workspace, path: `${owner.workspace.path}-wrong` } },
    { operationId: 'operation-wrong-recovery' },
    { observedGeneration: owner.observedGeneration + 1 },
  ]) {
    const candidate = recovery(current, owner);
    const result = await candidate.adapter.recover(request(current, owner, changes));
    assert.equal(result.classification, 'RECOVERY_CONFLICT');
  }
  const forged = recovery(current, owner, {
    consumeRecoveryAuthorization: async () => ({ status: 'FORGED' }),
  });
  assert.equal((await forged.adapter.recover(request(current, owner))).classification, 'RECOVERY_NOT_AUTHORIZED');
  assert.equal(fs.existsSync(path.join(current.registryStorageRoot, REGISTRY_WRITER_LOCK_FILENAME)), true);
});

test('one recovery authorization cannot recover a second orphan owner', async (t) => {
  const firstCurrent = createPhysicalV2Fixture();
  const secondCurrent = createPhysicalV2Fixture();
  t.after(firstCurrent.cleanup);
  t.after(secondCurrent.cleanup);
  const firstOwner = installOwner(firstCurrent);
  const secondOwner = installOwner(secondCurrent);
  let consumed = false;
  const consumeRecoveryAuthorization = async ({ request: input }) => {
    if (consumed) return { status: 'CONSUMED' };
    consumed = true;
    return { status: 'VALID', oneShot: true, binding: clone(input) };
  };
  const first = recovery(firstCurrent, firstOwner, { consumeRecoveryAuthorization });
  const second = recovery(secondCurrent, secondOwner, { consumeRecoveryAuthorization });
  assert.equal(
    (await first.adapter.recover(request(firstCurrent, firstOwner))).classification,
    'RECOVERED_NO_EFFECT',
  );
  assert.equal(
    (await second.adapter.recover(request(secondCurrent, secondOwner))).classification,
    'RECOVERY_NOT_AUTHORIZED',
  );
  assert.equal(fs.existsSync(path.join(
    secondCurrent.registryStorageRoot,
    REGISTRY_WRITER_LOCK_FILENAME,
  )), true);
});

test('malformed and symlink ownership fail closed without deleting their targets', async (t) => {
  for (const symlink of [false, true]) {
    const current = createPhysicalV2Fixture();
    t.after(current.cleanup);
    const lockPath = path.join(current.registryStorageRoot, REGISTRY_WRITER_LOCK_FILENAME);
    const target = path.join(current.root, 'recovery-substitution-target');
    fs.writeFileSync(target, 'preserve\n');
    if (symlink && process.platform !== 'win32') fs.symlinkSync(target, lockPath);
    else fs.writeFileSync(lockPath, '{}\n', { mode: 0o600 });
    const candidate = createControlPlaneRegistryWriterRecovery({
      storageRoot: current.registryStorageRoot,
      inspectSurgicalEvidence: async () => null,
      consumeRecoveryAuthorization: async () => ({ status: 'VALID' }),
    });
    const result = await candidate.recover({});
    assert.equal(result.classification, 'CORRUPT_FAIL_CLOSED');
    assert.equal(fs.readFileSync(target, 'utf8'), 'preserve\n');
  }
});

test('replacement before recovery CAS and two recovery actors produce at most one effect', async (t) => {
  const current = createPhysicalV2Fixture();
  t.after(current.cleanup);
  const owner = installOwner(current);
  const lockPath = path.join(current.registryStorageRoot, REGISTRY_WRITER_LOCK_FILENAME);
  let recoveryClaimCreated = false;
  const filesystem = Object.freeze({
    ...fs,
    openSync(target, flags, mode) {
      const descriptor = fs.openSync(target, flags, mode);
      if (String(target).includes('writer-recovery-claim')) recoveryClaimCreated = true;
      return descriptor;
    },
    readFileSync(target, encoding) {
      if (target === lockPath && recoveryClaimCreated) {
        const replacement = { ...owner, ownerToken: 'b'.repeat(64), ownerProcess: 'replacement-owner:fixture' };
        return `${JSON.stringify(replacement)}\n`;
      }
      return fs.readFileSync(target, encoding);
    },
  });
  const stale = recovery(current, owner, { filesystem });
  assert.equal((await stale.adapter.recover(request(current, owner))).classification, 'RECOVERY_CONFLICT');
  assert.equal(fs.existsSync(lockPath), true);

  const first = recovery(current, owner);
  const second = recovery(current, owner);
  const outcomes = await Promise.all([
    first.adapter.recover(request(current, owner)),
    second.adapter.recover(request(current, owner)),
  ]);
  assert.equal(outcomes.filter((value) => value.classification.startsWith('RECOVERED_')).length, 1);
  assert.equal(outcomes.filter((value) => value.classification === 'RECOVERY_CONFLICT').length, 1);
});
