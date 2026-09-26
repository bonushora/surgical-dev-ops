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
} = require('../core/control-plane-protocol');
const {
  defaultFilesystemDurabilityAdapter,
} = require('./filesystem-durability-adapter');
const { requireDurabilityReceipt } = require('../core/mutation-durability');

const REGISTRY_SCHEMA = 'sdo.control_plane_submission_registry';
const REGISTRY_SCHEMA_VERSION = 1;
const REGISTRY_FILENAME = 'control-plane-submission-registry.json';
const TEMPORARY_PREFIX = '.control-plane-submission-registry.';
const TEMPORARY_SUFFIX = '.tmp';
const DEFAULT_MAX_REGISTRY_BYTES = 1024 * 1024;
const INTEGRITY_ALGORITHM = 'sha256';
const TERMINAL = new Set(['succeeded', 'failed', 'cancelled', 'rejected']);
const PROGRESS = Object.freeze({
  accepted: 1,
  running: 2,
  succeeded: 3,
  failed: 3,
  cancelled: 3,
  rejected: 3,
});
const OPTION_FIELDS = new Set([
  'storageRoot', 'filesystem', 'durabilityAdapter', 'maxRegistryBytes',
]);
const ENVELOPE_FIELDS = new Set([
  'schema', 'schemaVersion', 'protocolVersion', 'generation', 'entries',
  'integrityAlgorithm', 'integrityDigest',
]);
const ENTRY_FIELDS = new Set([
  'protocolVersion', 'operationId', 'requestId', 'idempotencyKey',
  'intentFingerprint', 'principal', 'authority', 'requestedCapability',
  'workspace', 'repository', 'expectedState', 'approvalReference',
  'submittedAt', 'externalExecutionId', 'currentObservationState',
  'observationSequence', 'observedAt', 'lastCode',
]);
const FILESYSTEM_METHODS = [
  'lstatSync', 'realpathSync', 'openSync', 'fstatSync', 'readFileSync',
  'writeFileSync', 'closeSync', 'renameSync', 'unlinkSync', 'readdirSync',
];
const EXTERNAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{7,255}$/;

function registryError(classification, code) {
  return new ProtocolError(classification, code, 'Durable submission registry rejected the operation');
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, fields) {
  if (!isPlainObject(value)) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === fields.size
    && keys.every((key) => typeof key === 'string' && fields.has(key));
}

function canonicalTimestamp(value) {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function same(left, right) {
  return canonicalSerialize(left) === canonicalSerialize(right);
}

function requestFromRecord(record) {
  return {
    protocolVersion: record.protocolVersion,
    requestId: record.requestId,
    operationId: record.operationId,
    idempotencyKey: record.idempotencyKey,
    intentFingerprint: record.intentFingerprint,
    principal: record.principal,
    authority: record.authority,
    requestedCapability: record.requestedCapability,
    workspace: record.workspace,
    repository: record.repository,
    expectedState: record.expectedState,
    approvalReference: record.approvalReference,
    submittedAt: record.submittedAt,
  };
}

function recordFromClaim(request, externalExecutionId, observedAt) {
  return {
    ...request,
    externalExecutionId,
    currentObservationState: 'accepted',
    observationSequence: 1,
    observedAt,
    lastCode: null,
  };
}

function entryFromRecord(record) {
  return deepFreezeCopy({
    protocolVersion: record.protocolVersion,
    operationId: record.operationId,
    requestId: record.requestId,
    idempotencyKey: record.idempotencyKey,
    intentFingerprint: record.intentFingerprint,
    principal: record.principal,
    authority: record.authority,
    workspace: record.workspace,
    repository: record.repository,
    request: requestFromRecord(record),
    externalExecutionId: record.externalExecutionId,
    currentObservationState: record.currentObservationState,
    observationSequence: record.observationSequence,
    observedAt: record.observedAt,
    ...(record.lastCode === null ? {} : { lastCode: record.lastCode }),
  });
}

function digestContent(envelope) {
  return {
    schema: envelope.schema,
    schemaVersion: envelope.schemaVersion,
    protocolVersion: envelope.protocolVersion,
    generation: envelope.generation,
    entries: envelope.entries,
    integrityAlgorithm: envelope.integrityAlgorithm,
  };
}

function integrityDigest(envelope) {
  return crypto.createHash(INTEGRITY_ALGORITHM)
    .update(canonicalSerialize(digestContent(envelope)), 'utf8')
    .digest('hex');
}

function validateRecord(input) {
  if (!exactKeys(input, ENTRY_FIELDS)) {
    throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE');
  }
  assertCredentialFree(input);
  let request;
  try {
    request = validateRequest('submit', requestFromRecord(input));
  } catch {
    throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE');
  }
  if (!EXTERNAL_ID.test(input.externalExecutionId)
    || !RESULT_CLASSIFICATIONS.includes(input.currentObservationState)
    || !Number.isSafeInteger(input.observationSequence)
    || input.observationSequence < 1
    || !canonicalTimestamp(input.observedAt)
    || (input.lastCode !== null
      && (typeof input.lastCode !== 'string' || input.lastCode.length === 0
        || input.lastCode.length > 256))) {
    throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE');
  }
  return deepFreezeCopy({ ...request, ...input });
}

function validateEnvelope(input) {
  if (!isPlainObject(input)) {
    throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE');
  }
  if (!Object.hasOwn(input, 'schemaVersion')
    || !Number.isSafeInteger(input.schemaVersion)) {
    throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE');
  }
  if (input.schemaVersion !== REGISTRY_SCHEMA_VERSION) {
    throw registryError('internal_failure', 'UNSUPPORTED_REGISTRY_SCHEMA_VERSION');
  }
  if (!exactKeys(input, ENVELOPE_FIELDS)
    || input.schema !== REGISTRY_SCHEMA
    || input.protocolVersion !== PROTOCOL_VERSION
    || !Number.isSafeInteger(input.generation)
    || input.generation < 1
    || !Array.isArray(input.entries)
    || input.integrityAlgorithm !== INTEGRITY_ALGORITHM
    || typeof input.integrityDigest !== 'string'
    || !/^[a-f0-9]{64}$/.test(input.integrityDigest)) {
    throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE');
  }
  if (integrityDigest(input) !== input.integrityDigest) {
    throw registryError('internal_failure', 'REGISTRY_INTEGRITY_MISMATCH');
  }
  const records = input.entries.map(validateRecord);
  const operationIds = new Set();
  const idempotencyKeys = new Set();
  const externalIds = new Set();
  let previousOperationId = null;
  for (const record of records) {
    if ((previousOperationId !== null && previousOperationId.localeCompare(record.operationId) >= 0)
      || operationIds.has(record.operationId)
      || idempotencyKeys.has(record.idempotencyKey)
      || externalIds.has(record.externalExecutionId)) {
      throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE');
    }
    previousOperationId = record.operationId;
    operationIds.add(record.operationId);
    idempotencyKeys.add(record.idempotencyKey);
    externalIds.add(record.externalExecutionId);
  }
  return deepFreezeCopy({
    schema: input.schema,
    schemaVersion: input.schemaVersion,
    protocolVersion: input.protocolVersion,
    generation: input.generation,
    entries: records,
    integrityAlgorithm: input.integrityAlgorithm,
    integrityDigest: input.integrityDigest,
  });
}

function validateStorageRoot(storageRoot, filesystem) {
  if (typeof storageRoot !== 'string' || !path.isAbsolute(storageRoot)
    || path.normalize(storageRoot) !== storageRoot
    || path.parse(storageRoot).root === storageRoot) {
    throw new TypeError('Durable registry storage root must be a dedicated canonical absolute path');
  }
  let stat;
  let physical;
  try {
    stat = filesystem.lstatSync(storageRoot);
    physical = filesystem.realpathSync(storageRoot);
  } catch {
    throw registryError('internal_failure', 'REGISTRY_STORAGE_FAILURE');
  }
  if (!stat.isDirectory() || stat.isSymbolicLink() || physical !== storageRoot
    || (typeof process.getuid === 'function' && stat.uid !== process.getuid())) {
    throw registryError('internal_failure', 'REGISTRY_STORAGE_FAILURE');
  }
  return physical;
}

function requireFilesystem(filesystem) {
  if (!filesystem || typeof filesystem !== 'object'
    || FILESYSTEM_METHODS.some((method) => typeof filesystem[method] !== 'function')) {
    throw new TypeError('Durable registry filesystem adapter is invalid');
  }
  return filesystem;
}

function createDurableControlPlaneSubmissionRegistry(options) {
  if (!isPlainObject(options)
    || Reflect.ownKeys(options).some((key) => typeof key !== 'string' || !OPTION_FIELDS.has(key))) {
    throw new TypeError('Durable registry options are invalid');
  }
  const filesystem = requireFilesystem(options.filesystem || fs);
  const durabilityAdapter = options.durabilityAdapter || defaultFilesystemDurabilityAdapter;
  if (!durabilityAdapter
    || typeof durabilityAdapter.flushFile !== 'function'
    || typeof durabilityAdapter.confirmRename !== 'function') {
    throw new TypeError('Durable registry durability adapter is invalid');
  }
  const maxRegistryBytes = options.maxRegistryBytes === undefined
    ? DEFAULT_MAX_REGISTRY_BYTES
    : options.maxRegistryBytes;
  if (!Number.isSafeInteger(maxRegistryBytes) || maxRegistryBytes <= 0) {
    throw new TypeError('Durable registry byte limit is invalid');
  }
  const storageRoot = validateStorageRoot(options.storageRoot, filesystem);
  const registryPath = path.join(storageRoot, REGISTRY_FILENAME);

  function readCommitted() {
    let descriptor;
    try {
      let stat;
      try {
        stat = filesystem.lstatSync(registryPath);
      } catch (error) {
        if (error && error.code === 'ENOENT') {
          return deepFreezeCopy({ generation: 0, entries: [] });
        }
        throw error;
      }
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2
        || stat.size > maxRegistryBytes) {
        throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE');
      }
      const noFollow = fs.constants.O_NOFOLLOW || 0;
      descriptor = filesystem.openSync(registryPath, fs.constants.O_RDONLY | noFollow);
      const opened = filesystem.fstatSync(descriptor);
      if (!opened.isFile() || opened.size !== stat.size || opened.size > maxRegistryBytes) {
        throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE');
      }
      const bytes = filesystem.readFileSync(descriptor);
      const raw = Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes);
      if (!raw.endsWith('\n')) {
        throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE');
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw registryError('internal_failure', 'MALFORMED_PERSISTENT_STATE');
      }
      return validateEnvelope(parsed);
    } catch (error) {
      if (error instanceof ProtocolError) throw error;
      throw registryError('internal_failure', 'REGISTRY_STORAGE_FAILURE');
    } finally {
      if (descriptor !== undefined) {
        try {
          filesystem.closeSync(descriptor);
        } catch {
          // A failed close cannot turn an invalid read into accepted ownership.
        }
      }
    }
  }

  let committed = readCommitted();

  function requireCurrentGeneration() {
    const current = readCommitted();
    if (current.generation !== committed.generation
      || (current.generation > 0 && current.integrityDigest !== committed.integrityDigest)) {
      throw registryError('stale_state', 'STALE_REGISTRY_GENERATION');
    }
    return current;
  }

  function createEnvelope(entries) {
    const envelope = {
      schema: REGISTRY_SCHEMA,
      schemaVersion: REGISTRY_SCHEMA_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      generation: committed.generation + 1,
      entries: [...entries].sort((left, right) => left.operationId.localeCompare(right.operationId)),
      integrityAlgorithm: INTEGRITY_ALGORITHM,
    };
    envelope.integrityDigest = integrityDigest(envelope);
    return validateEnvelope(envelope);
  }

  function persist(entries) {
    requireCurrentGeneration();
    const next = createEnvelope(entries);
    const bytes = Buffer.from(`${canonicalSerialize(next)}\n`, 'utf8');
    if (bytes.length > maxRegistryBytes) {
      throw registryError('internal_failure', 'REGISTRY_STORAGE_FAILURE');
    }
    const temporaryPath = path.join(
      storageRoot,
      `${TEMPORARY_PREFIX}${next.generation}.${process.pid}.${crypto.randomUUID()}${TEMPORARY_SUFFIX}`,
    );
    let descriptor;
    let renamed = false;
    try {
      descriptor = filesystem.openSync(
        temporaryPath,
        fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
        0o600,
      );
      filesystem.writeFileSync(descriptor, bytes);
      requireDurabilityReceipt(
        durabilityAdapter.flushFile(descriptor, `control-plane-registry:${next.generation}`),
        'FLUSH_FILE_DATA',
      );
      filesystem.closeSync(descriptor);
      descriptor = undefined;
      requireCurrentGeneration();
      filesystem.renameSync(temporaryPath, registryPath);
      renamed = true;
      requireDurabilityReceipt(
        durabilityAdapter.confirmRename(storageRoot),
        'DURABLE_RENAME_BOUNDARY',
      );
      committed = next;
      return next;
    } catch (error) {
      if (descriptor !== undefined) {
        try { filesystem.closeSync(descriptor); } catch {}
      }
      if (!renamed) {
        try { filesystem.unlinkSync(temporaryPath); } catch {}
      }
      if (error instanceof ProtocolError) throw error;
      throw registryError('internal_failure', 'REGISTRY_STORAGE_FAILURE');
    }
  }

  function maps() {
    const byOperation = new Map();
    const byIdempotency = new Map();
    const byExternal = new Map();
    for (const record of committed.entries) {
      byOperation.set(record.operationId, record);
      byIdempotency.set(record.idempotencyKey, record);
      byExternal.set(record.externalExecutionId, record);
    }
    return { byOperation, byIdempotency, byExternal };
  }

  function requireBound(request) {
    requireCurrentGeneration();
    const { byOperation, byIdempotency } = maps();
    const record = byOperation.get(request.operationId);
    const keyed = byIdempotency.get(request.idempotencyKey);
    if (!record || !keyed || record !== keyed) {
      throw registryError('unknown', 'UNKNOWN_SUBMISSION');
    }
    if (!same(record.principal, request.principal)) {
      throw registryError('authorization_failure', 'PRINCIPAL_SUBSTITUTION');
    }
    if (!same(record.authority, request.authority)) {
      throw registryError('authorization_failure', 'AUTHORITY_WIDENING');
    }
    if (!same(record.workspace, request.workspace)
      || !same(record.repository, request.repository)) {
      throw registryError('stale_state', 'WORKSPACE_REPOSITORY_MISMATCH');
    }
    if (record.intentFingerprint !== request.intentFingerprint) {
      throw registryError('protocol_failure', 'INTENT_FINGERPRINT_MISMATCH');
    }
    if (request.externalExecutionId !== undefined
      && request.externalExecutionId !== record.externalExecutionId) {
      throw registryError('protocol_failure', 'FORGED_EXTERNAL_EXECUTION_ID');
    }
    return record;
  }

  function claim(input) {
    exactFields(input, ['request', 'externalExecutionId', 'observedAt']);
    assertCredentialFree(input);
    const request = validateRequest('submit', input.request);
    if (!EXTERNAL_ID.test(input.externalExecutionId) || !canonicalTimestamp(input.observedAt)) {
      throw registryError('internal_failure', 'REGISTRY_STORAGE_FAILURE');
    }
    requireCurrentGeneration();
    const { byOperation, byIdempotency, byExternal } = maps();
    const existingKey = byIdempotency.get(request.idempotencyKey);
    if (existingKey) {
      if (same(requestFromRecord(existingKey), request)) {
        return deepFreezeCopy({ created: false, entry: entryFromRecord(existingKey) });
      }
      throw registryError('protocol_failure', 'IDEMPOTENCY_CONFLICT');
    }
    const existingOperation = byOperation.get(request.operationId);
    if (existingOperation) {
      if (!same(existingOperation.principal, request.principal)) {
        throw registryError('authorization_failure', 'PRINCIPAL_SUBSTITUTION');
      }
      if (!same(existingOperation.authority, request.authority)) {
        throw registryError('authorization_failure', 'AUTHORITY_WIDENING');
      }
      if (!same(existingOperation.workspace, request.workspace)
        || !same(existingOperation.repository, request.repository)) {
        throw registryError('stale_state', 'WORKSPACE_REPOSITORY_MISMATCH');
      }
      throw registryError('protocol_failure', 'OPERATION_BINDING_CONFLICT');
    }
    if (byExternal.has(input.externalExecutionId)) {
      throw registryError('protocol_failure', 'EXTERNAL_EXECUTION_ID_CONFLICT');
    }
    const record = validateRecord(recordFromClaim(
      request,
      input.externalExecutionId,
      input.observedAt,
    ));
    persist([...committed.entries, record]);
    return deepFreezeCopy({ created: true, entry: entryFromRecord(record) });
  }

  function get(request) {
    assertCredentialFree(request);
    return entryFromRecord(requireBound(request));
  }

  function observe(input) {
    exactFields(input, ['request', 'classification', 'code', 'observedAt']);
    assertCredentialFree(input);
    const record = requireBound(input.request);
    if (!RESULT_CLASSIFICATIONS.includes(input.classification)
      || typeof input.code !== 'string' || input.code.length === 0 || input.code.length > 256
      || !canonicalTimestamp(input.observedAt)) {
      throw registryError('protocol_failure', 'MALFORMED_PROTOCOL_MESSAGE');
    }
    if (input.request.afterObservationSequence !== record.observationSequence) {
      throw registryError('stale_state', 'STALE_OBSERVATION_SEQUENCE');
    }
    const previousRank = PROGRESS[record.currentObservationState];
    const nextRank = PROGRESS[input.classification];
    if ((TERMINAL.has(record.currentObservationState)
      && input.classification !== record.currentObservationState)
      || (previousRank !== undefined && nextRank !== undefined && nextRank < previousRank)) {
      throw registryError('stale_state', 'RESULT_STATE_REGRESSION');
    }
    const nextRecord = validateRecord({
      ...record,
      currentObservationState: input.classification,
      observationSequence: record.observationSequence + 1,
      observedAt: input.observedAt,
      lastCode: input.code,
    });
    persist(committed.entries.map(
      (entry) => entry.operationId === nextRecord.operationId ? nextRecord : entry,
    ));
    return entryFromRecord(nextRecord);
  }

  function inspect() {
    requireCurrentGeneration();
    return Object.freeze(committed.entries.map(entryFromRecord));
  }

  function cleanupTemporaryArtifacts() {
    let removed = 0;
    try {
      for (const name of filesystem.readdirSync(storageRoot)) {
        if (!name.startsWith(TEMPORARY_PREFIX) || !name.endsWith(TEMPORARY_SUFFIX)) continue;
        const target = path.join(storageRoot, name);
        const stat = filesystem.lstatSync(target);
        if (!stat.isFile() || stat.isSymbolicLink()) {
          throw registryError('internal_failure', 'REGISTRY_STORAGE_FAILURE');
        }
        filesystem.unlinkSync(target);
        removed += 1;
      }
      if (removed > 0) {
        requireDurabilityReceipt(
          durabilityAdapter.confirmRename(storageRoot),
          'DURABLE_RENAME_BOUNDARY',
        );
      }
      return removed;
    } catch (error) {
      if (error instanceof ProtocolError) throw error;
      throw registryError('internal_failure', 'REGISTRY_STORAGE_FAILURE');
    }
  }

  return Object.freeze({
    protocolVersion: PROTOCOL_VERSION,
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    claim,
    get,
    observe,
    inspect,
    cleanupTemporaryArtifacts,
  });
}

module.exports = Object.freeze({
  REGISTRY_FILENAME,
  REGISTRY_SCHEMA,
  REGISTRY_SCHEMA_VERSION,
  DEFAULT_MAX_REGISTRY_BYTES,
  createDurableControlPlaneSubmissionRegistry,
});
