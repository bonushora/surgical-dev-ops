'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  PROTOCOL_VERSION,
  ProtocolError,
  RESULT_CLASSIFICATIONS,
  assertCredentialFree,
  canonicalSerialize,
  deepFreezeCopy,
  exactFields,
  validateRequest,
} = require('../core/control-plane-protocol-v2');
const {
  createInMemoryControlPlanePhysicalSubmissionRegistry,
} = require('./control-plane-physical-submission-registry');
const { defaultFilesystemDurabilityAdapter } = require('./filesystem-durability-adapter');
const { requireDurabilityReceipt } = require('../core/mutation-durability');

const SCHEMA = 'sdo.control_plane_physical_submission_registry.v1';
const FILENAME = 'control-plane-physical-submission-registry.json';
const ENVELOPE_FIELDS = ['schema', 'protocolVersion', 'generation', 'entries', 'integrityAlgorithm', 'integrityDigest'];
const ENTRY_FIELDS = [
  'request', 'operationId', 'idempotencyKey', 'intentFingerprint', 'principal',
  'authority', 'workspace', 'repository', 'physicalExecution', 'externalExecutionId',
  'currentObservationState', 'observationSequence', 'observedAt', 'lastCode',
];

function registryError(classification, code) {
  return new ProtocolError(classification, code, 'Durable physical registry rejected the operation');
}

function digestContent(value) {
  return {
    schema: value.schema,
    protocolVersion: value.protocolVersion,
    generation: value.generation,
    entries: value.entries,
    integrityAlgorithm: value.integrityAlgorithm,
  };
}

function digest(value) {
  return crypto.createHash('sha256').update(canonicalSerialize(digestContent(value)), 'utf8').digest('hex');
}

function exact(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === fields.length && keys.every((key) => typeof key === 'string' && fields.includes(key));
}

function canonicalTimestamp(value) {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function validateEntry(value) {
  const fields = value && Object.hasOwn(value, 'physicalEvidence')
    ? [...ENTRY_FIELDS, 'physicalEvidence'] : ENTRY_FIELDS;
  if (!exact(value, fields)) throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE');
  try { assertCredentialFree(value); }
  catch { throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE'); }
  let request;
  try { request = validateRequest('submit', value.request); }
  catch { throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE'); }
  if (value.operationId !== request.operationId || value.idempotencyKey !== request.idempotencyKey
    || value.intentFingerprint !== request.intentFingerprint
    || canonicalSerialize(value.principal) !== canonicalSerialize(request.principal)
    || canonicalSerialize(value.authority) !== canonicalSerialize(request.authority)
    || canonicalSerialize(value.workspace) !== canonicalSerialize(request.workspace)
    || canonicalSerialize(value.repository) !== canonicalSerialize(request.repository)
    || canonicalSerialize(value.physicalExecution) !== canonicalSerialize(request.physicalExecution)
    || typeof value.externalExecutionId !== 'string' || value.externalExecutionId.length < 8
    || !RESULT_CLASSIFICATIONS.includes(value.currentObservationState)
    || !Number.isSafeInteger(value.observationSequence) || value.observationSequence < 1
    || !canonicalTimestamp(value.observedAt) || typeof value.lastCode !== 'string') {
    throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE');
  }
  if (Object.hasOwn(value, 'physicalEvidence')) {
    const evidenceFields = ['transactionId', 'journalId', 'recoveryStatus', 'effectFingerprint'];
    const evidence = value.physicalEvidence;
    if (!exact(evidence, evidenceFields)
      || typeof evidence.transactionId !== 'string' || evidence.transactionId.length < 8
      || typeof evidence.journalId !== 'string' || evidence.journalId.length < 8
      || !['COMMITTED', 'RECOVERED'].includes(evidence.recoveryStatus)
      || !/^[a-f0-9]{64}$/.test(evidence.effectFingerprint)
      || value.currentObservationState !== 'succeeded') {
      throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE');
    }
  } else if (value.currentObservationState === 'succeeded') {
    throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE');
  }
  return deepFreezeCopy(value);
}

function validateEnvelope(value) {
  if (!exact(value, ENVELOPE_FIELDS) || value.schema !== SCHEMA
    || value.protocolVersion !== PROTOCOL_VERSION || !Number.isSafeInteger(value.generation)
    || value.generation < 1 || !Array.isArray(value.entries)
    || value.integrityAlgorithm !== 'sha256' || !/^[a-f0-9]{64}$/.test(value.integrityDigest)
    || digest(value) !== value.integrityDigest) {
    throw registryError('internal_failure', 'REGISTRY_INTEGRITY_MISMATCH');
  }
  const entries = value.entries.map(validateEntry);
  const operationIds = new Set(entries.map((entry) => entry.operationId));
  const idempotencyKeys = new Set(entries.map((entry) => entry.idempotencyKey));
  if (operationIds.size !== entries.length || idempotencyKeys.size !== entries.length) {
    throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE');
  }
  return deepFreezeCopy({ ...value, entries });
}

function observationRequest(entry, sequence) {
  const request = entry.request;
  return {
    protocolVersion: PROTOCOL_VERSION,
    requestId: request.requestId,
    operationId: request.operationId,
    idempotencyKey: request.idempotencyKey,
    intentFingerprint: request.intentFingerprint,
    principal: request.principal,
    authority: request.authority,
    workspace: request.workspace,
    repository: request.repository,
    physicalExecution: request.physicalExecution,
    externalExecutionId: entry.externalExecutionId,
    afterObservationSequence: sequence,
  };
}

function createDurableControlPlanePhysicalSubmissionRegistry(options = {}) {
  const allowed = new Set(['storageRoot', 'filesystem', 'durabilityAdapter', 'maxRegistryBytes']);
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Reflect.ownKeys(options).some((key) => typeof key !== 'string' || !allowed.has(key))) {
    throw new TypeError('Durable physical registry options are invalid');
  }
  const filesystem = options.filesystem || fs;
  const durability = options.durabilityAdapter || defaultFilesystemDurabilityAdapter;
  const maxBytes = options.maxRegistryBytes || 1024 * 1024;
  const storageRoot = options.storageRoot;
  if (typeof storageRoot !== 'string' || !path.isAbsolute(storageRoot)
    || path.normalize(storageRoot) !== storageRoot || path.parse(storageRoot).root === storageRoot
    || !Number.isSafeInteger(maxBytes) || maxBytes < 1024) {
    throw new TypeError('Durable physical registry storage is invalid');
  }
  let stat;
  let physical;
  try { stat = filesystem.lstatSync(storageRoot); physical = filesystem.realpathSync(storageRoot); }
  catch { throw registryError('internal_failure', 'REGISTRY_STORAGE_FAILURE'); }
  if (!stat.isDirectory() || stat.isSymbolicLink() || physical !== storageRoot
    || (typeof process.getuid === 'function' && stat.uid !== process.getuid())) {
    throw registryError('internal_failure', 'REGISTRY_STORAGE_FAILURE');
  }
  const registryPath = path.join(storageRoot, FILENAME);

  function read() {
    let metadata;
    try { metadata = filesystem.lstatSync(registryPath); }
    catch (caught) {
      if (caught && caught.code === 'ENOENT') return { generation: 0, entries: [], integrityDigest: null };
      throw registryError('internal_failure', 'REGISTRY_STORAGE_FAILURE');
    }
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size < 2 || metadata.size > maxBytes) {
      throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE');
    }
    let raw;
    try { raw = filesystem.readFileSync(registryPath, 'utf8'); }
    catch { throw registryError('internal_failure', 'REGISTRY_STORAGE_FAILURE'); }
    if (!raw.endsWith('\n')) throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE');
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE'); }
    return validateEnvelope(parsed);
  }

  let committed = read();
  let poisoned = false;
  const memory = createInMemoryControlPlanePhysicalSubmissionRegistry();
  for (const persisted of committed.entries) {
    const claimed = memory.claim({
      request: persisted.request,
      externalExecutionId: persisted.externalExecutionId,
      observedAt: persisted.observedAt,
    });
    let current = claimed.entry;
    while (current.observationSequence < persisted.observationSequence) {
      current = memory.observe({
        request: observationRequest(persisted, current.observationSequence),
        classification: persisted.currentObservationState,
        code: persisted.lastCode,
        observedAt: persisted.observedAt,
        ...(persisted.physicalEvidence ? { physicalEvidence: persisted.physicalEvidence } : {}),
      });
    }
  }
  const metrics = { durableWrites: 0, zeroWriteReplays: 0, fileFlushes: 0, directorySyncs: 0 };

  function requireHealthy() {
    if (poisoned) throw registryError('internal_failure', 'REGISTRY_REOPEN_REQUIRED');
  }

  function persist() {
    requireHealthy();
    const current = read();
    if (current.generation !== committed.generation || current.integrityDigest !== committed.integrityDigest) {
      poisoned = true;
      throw registryError('stale_state', 'STALE_REGISTRY_GENERATION');
    }
    const envelope = {
      schema: SCHEMA,
      protocolVersion: PROTOCOL_VERSION,
      generation: committed.generation + 1,
      entries: [...memory.inspect()].sort((left, right) => left.operationId.localeCompare(right.operationId)),
      integrityAlgorithm: 'sha256',
    };
    envelope.integrityDigest = digest(envelope);
    const validated = validateEnvelope(envelope);
    const bytes = Buffer.from(`${canonicalSerialize(validated)}\n`, 'utf8');
    if (bytes.length > maxBytes) throw registryError('internal_failure', 'REGISTRY_STORAGE_FAILURE');
    const temporaryPath = path.join(storageRoot, `.physical-registry.${validated.generation}.${process.pid}.${crypto.randomUUID()}.tmp`);
    let descriptor;
    let renamed = false;
    try {
      descriptor = filesystem.openSync(temporaryPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
      filesystem.writeFileSync(descriptor, bytes);
      requireDurabilityReceipt(durability.flushFile(descriptor, `physical-registry:${validated.generation}`), 'FLUSH_FILE_DATA');
      metrics.fileFlushes += 1;
      filesystem.closeSync(descriptor);
      descriptor = undefined;
      const beforeRename = read();
      if (beforeRename.generation !== committed.generation || beforeRename.integrityDigest !== committed.integrityDigest) {
        throw registryError('stale_state', 'STALE_REGISTRY_GENERATION');
      }
      filesystem.renameSync(temporaryPath, registryPath);
      renamed = true;
      requireDurabilityReceipt(durability.confirmRename(storageRoot), 'DURABLE_RENAME_BOUNDARY');
      metrics.directorySyncs += 1;
      committed = validated;
      metrics.durableWrites += 1;
    } catch (caught) {
      poisoned = true;
      if (descriptor !== undefined) { try { filesystem.closeSync(descriptor); } catch {} }
      if (!renamed) { try { filesystem.unlinkSync(temporaryPath); } catch {} }
      if (caught instanceof ProtocolError) throw caught;
      throw registryError('internal_failure', 'REGISTRY_STORAGE_FAILURE');
    }
  }

  function claim(input) {
    requireHealthy();
    const value = memory.claim(input);
    if (value.created) persist();
    else metrics.zeroWriteReplays += 1;
    return value;
  }

  function observe(input) {
    requireHealthy();
    const value = memory.observe(input);
    persist();
    return value;
  }

  return Object.freeze({
    claim,
    get(input) { requireHealthy(); return memory.get(input); },
    observe,
    inspect() { requireHealthy(); return memory.inspect(); },
    inspectMetrics: () => deepFreezeCopy(metrics),
  });
}

module.exports = Object.freeze({
  REGISTRY_SCHEMA: SCHEMA,
  REGISTRY_FILENAME: FILENAME,
  createDurableControlPlanePhysicalSubmissionRegistry,
});
