'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  PROTOCOL_VERSION,
  canonicalSerialize,
  deepFreezeCopy,
} = require('../core/control-plane-protocol-v2');
const { defaultFilesystemDurabilityAdapter } = require('./filesystem-durability-adapter');
const { requireDurabilityReceipt } = require('../core/mutation-durability');

const REGISTRY_FILENAME = 'control-plane-physical-submission-registry.json';
const WRITER_LOCK_FILENAME = 'control-plane-physical-submission-registry.writer-lock';
const WRITER_SCHEMA = 'sdo.control_plane_physical_registry_writer.v2';
const LEGACY_WRITER_SCHEMA = 'sdo.control_plane_physical_registry_writer.v1';
const REQUEST_SCHEMA = 'sdo.control_plane_registry_writer_recovery_request.v1';
const EVIDENCE_SCHEMA = 'sdo.control_plane_registry_writer_surgical_evidence.v1';
const CLAIM_SCHEMA = 'sdo.control_plane_registry_writer_recovery_claim.v1';
const RESULT_SCHEMA = 'sdo.control_plane_registry_writer_recovery_result.v1';
const DIGEST = /^[a-f0-9]{64}$/;
const GIT_HEAD = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;

const RECOVERY_CLASSIFICATIONS = Object.freeze([
  'NOT_ORPHANED',
  'ORPHAN_CONFIRMED',
  'RECOVERY_NOT_AUTHORIZED',
  'RECOVERY_CONFLICT',
  'RECOVERED_NO_EFFECT',
  'RECOVERED_COMMITTED',
  'INDETERMINATE',
  'CORRUPT_FAIL_CLOSED',
]);

const OWNER_FIELDS = Object.freeze([
  'schema', 'protocolVersion', 'ownerToken', 'ownerProcess', 'operationId',
  'externalExecutionId', 'workspace', 'repository', 'physicalExecution',
  'observedGeneration', 'observedIntegrityDigest', 'intendedGeneration', 'mutationKind',
]);
const REQUEST_FIELDS = Object.freeze([
  'schema', 'recoveryId', 'operationId', 'externalExecutionId', 'workspace',
  'repository', 'observedOwnerFingerprint', 'observedGeneration',
  'observedIntegrityDigest', 'authorizationReference',
]);
const EVIDENCE_FIELDS = Object.freeze([
  'schema', 'writerOwnership', 'operationId', 'externalExecutionId', 'stage',
  'effect', 'journalCorrelation',
]);

function exact(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === fields.length
    && keys.every((key) => typeof key === 'string' && fields.includes(key));
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(canonicalSerialize(value), 'utf8').digest('hex');
}

function same(left, right) {
  try { return canonicalSerialize(left) === canonicalSerialize(right); }
  catch { return false; }
}

function output(classification, code, extra = {}) {
  return deepFreezeCopy({
    classification,
    code,
    recoveryEffect: classification.startsWith('RECOVERED_') ? 1 : 0,
    durable: classification.startsWith('RECOVERED_'),
    ...extra,
  });
}

function validWorkspace(value) {
  return exact(value, ['path', 'physicalIdentity'])
    && typeof value.path === 'string' && path.isAbsolute(value.path)
    && DIGEST.test(value.physicalIdentity || '');
}

function validRepository(value) {
  return exact(value, ['id', 'head']) && typeof value.id === 'string'
    && GIT_HEAD.test(value.head || '');
}

function validPhysicalExecution(value) {
  return exact(value, [
    'target', 'beforeSha256', 'afterSha256', 'contractFingerprint',
    'proposalFingerprint', 'authorizationFingerprint', 'executionReference',
  ]) && typeof value.target === 'string'
    && ['beforeSha256', 'afterSha256', 'contractFingerprint', 'proposalFingerprint', 'authorizationFingerprint']
      .every((field) => DIGEST.test(value[field] || ''));
}

function validateOwner(value) {
  if (exact(value, ['schema', 'protocolVersion', 'ownerToken', 'ownerProcess'])
    && value.schema === LEGACY_WRITER_SCHEMA
    && value.protocolVersion === PROTOCOL_VERSION
    && DIGEST.test(value.ownerToken || '')
    && typeof value.ownerProcess === 'string') {
    return { legacy: true, value: deepFreezeCopy(value) };
  }
  if (!exact(value, OWNER_FIELDS) || value.schema !== WRITER_SCHEMA
    || value.protocolVersion !== PROTOCOL_VERSION || !DIGEST.test(value.ownerToken || '')
    || typeof value.ownerProcess !== 'string' || value.ownerProcess.length < 8
    || typeof value.operationId !== 'string' || value.operationId.length < 8
    || typeof value.externalExecutionId !== 'string' || value.externalExecutionId.length < 8
    || !validWorkspace(value.workspace) || !validRepository(value.repository)
    || !validPhysicalExecution(value.physicalExecution)
    || !Number.isSafeInteger(value.observedGeneration) || value.observedGeneration < 0
    || (value.observedIntegrityDigest !== null && !DIGEST.test(value.observedIntegrityDigest))
    || value.intendedGeneration !== value.observedGeneration + 1
    || !['CLAIM', 'OBSERVE'].includes(value.mutationKind)) return null;
  return { legacy: false, value: deepFreezeCopy(value) };
}

function validateRequest(value) {
  return exact(value, REQUEST_FIELDS) && value.schema === REQUEST_SCHEMA
    && typeof value.recoveryId === 'string' && value.recoveryId.length >= 8
    && typeof value.operationId === 'string' && value.operationId.length >= 8
    && typeof value.externalExecutionId === 'string' && value.externalExecutionId.length >= 8
    && validWorkspace(value.workspace) && validRepository(value.repository)
    && DIGEST.test(value.observedOwnerFingerprint || '')
    && Number.isSafeInteger(value.observedGeneration) && value.observedGeneration >= 0
    && (value.observedIntegrityDigest === null || DIGEST.test(value.observedIntegrityDigest))
    && typeof value.authorizationReference === 'string'
    && value.authorizationReference.length >= 8;
}

function validateEvidence(value, owner) {
  if (!exact(value, EVIDENCE_FIELDS) || value.schema !== EVIDENCE_SCHEMA
    || !['ACTIVE', 'ORPHAN_CONFIRMED'].includes(value.writerOwnership)
    || value.operationId !== owner.operationId
    || value.externalExecutionId !== owner.externalExecutionId
    || !['NO_OPERATION', 'LOGICAL_CLAIM', 'AUTHORITY_CONSUMED', 'PREPARED', 'PHYSICAL_COMMIT', 'TERMINAL_JOURNAL']
      .includes(value.stage)
    || !['NO_EFFECT', 'COMMITTED'].includes(value.effect)) return null;
  if (value.effect === 'NO_EFFECT') {
    if (value.journalCorrelation !== null
      || ['PHYSICAL_COMMIT', 'TERMINAL_JOURNAL'].includes(value.stage)) return null;
  } else {
    const journal = value.journalCorrelation;
    if (!['PHYSICAL_COMMIT', 'TERMINAL_JOURNAL'].includes(value.stage)
      || !exact(journal, ['transactionId', 'journalId', 'effectFingerprint', 'terminal'])
      || typeof journal.transactionId !== 'string' || journal.transactionId.length < 8
      || typeof journal.journalId !== 'string' || journal.journalId.length < 8
      || !DIGEST.test(journal.effectFingerprint || '')
      || typeof journal.terminal !== 'boolean'
      || (value.stage === 'TERMINAL_JOURNAL' && journal.terminal !== true)) return null;
  }
  return deepFreezeCopy(value);
}

function registryDigest(envelope) {
  return fingerprint({
    schema: envelope.schema,
    protocolVersion: envelope.protocolVersion,
    generation: envelope.generation,
    entries: envelope.entries,
    integrityAlgorithm: envelope.integrityAlgorithm,
  });
}

function createControlPlaneRegistryWriterRecovery(options = {}) {
  const allowed = new Set([
    'storageRoot', 'filesystem', 'durabilityAdapter',
    'inspectSurgicalEvidence', 'consumeRecoveryAuthorization',
  ]);
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Reflect.ownKeys(options).some((key) => typeof key !== 'string' || !allowed.has(key))
    || typeof options.storageRoot !== 'string' || !path.isAbsolute(options.storageRoot)
    || typeof options.inspectSurgicalEvidence !== 'function'
    || typeof options.consumeRecoveryAuthorization !== 'function') {
    throw new TypeError('Registry writer recovery dependencies are invalid');
  }
  const filesystem = options.filesystem || fs;
  const durability = options.durabilityAdapter || defaultFilesystemDurabilityAdapter;
  const storageRoot = options.storageRoot;
  let rootStat;
  let rootPhysical;
  try {
    rootStat = filesystem.lstatSync(storageRoot);
    rootPhysical = filesystem.realpathSync(storageRoot);
  } catch { throw new TypeError('Registry writer recovery storage is invalid'); }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || rootPhysical !== storageRoot) {
    throw new TypeError('Registry writer recovery storage is invalid');
  }
  const lockPath = path.join(storageRoot, WRITER_LOCK_FILENAME);
  const registryPath = path.join(storageRoot, REGISTRY_FILENAME);

  function readOwner() {
    let metadata;
    let raw;
    try {
      metadata = filesystem.lstatSync(lockPath);
      if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size < 2 || metadata.size > 16384) {
        return { classification: 'CORRUPT_FAIL_CLOSED' };
      }
      raw = filesystem.readFileSync(lockPath, 'utf8');
    } catch (caught) {
      if (caught && caught.code === 'ENOENT') return { classification: 'NOT_ORPHANED' };
      return { classification: 'CORRUPT_FAIL_CLOSED' };
    }
    if (!raw.endsWith('\n')) return { classification: 'CORRUPT_FAIL_CLOSED' };
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return { classification: 'CORRUPT_FAIL_CLOSED' }; }
    const validated = validateOwner(parsed);
    if (!validated) return { classification: 'CORRUPT_FAIL_CLOSED' };
    if (validated.legacy) return { classification: 'INDETERMINATE' };
    return { classification: 'ORPHAN_CONFIRMED', owner: validated.value };
  }

  function readRegistry() {
    try {
      const metadata = filesystem.lstatSync(registryPath);
      if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size < 2 || metadata.size > 1024 * 1024) return null;
      const raw = filesystem.readFileSync(registryPath, 'utf8');
      if (!raw.endsWith('\n')) return null;
      const parsed = JSON.parse(raw);
      if (!exact(parsed, ['schema', 'protocolVersion', 'generation', 'entries', 'integrityAlgorithm', 'integrityDigest'])
        || parsed.schema !== 'sdo.control_plane_physical_submission_registry.v1'
        || parsed.protocolVersion !== PROTOCOL_VERSION
        || !Number.isSafeInteger(parsed.generation) || parsed.generation < 1
        || !Array.isArray(parsed.entries) || parsed.integrityAlgorithm !== 'sha256'
        || !DIGEST.test(parsed.integrityDigest || '')
        || registryDigest(parsed) !== parsed.integrityDigest) return null;
      return deepFreezeCopy(parsed);
    } catch (caught) {
      if (caught && caught.code === 'ENOENT') {
        return deepFreezeCopy({ generation: 0, integrityDigest: null, entries: [] });
      }
      return null;
    }
  }

  function matches(input, owner, registry) {
    return validateRequest(input)
      && input.operationId === owner.operationId
      && input.externalExecutionId === owner.externalExecutionId
      && same(input.workspace, owner.workspace)
      && same(input.repository, owner.repository)
      && input.observedOwnerFingerprint === fingerprint(owner)
      && input.observedGeneration === owner.observedGeneration
      && input.observedIntegrityDigest === owner.observedIntegrityDigest
      && registry.generation === owner.observedGeneration
      && registry.integrityDigest === owner.observedIntegrityDigest;
  }

  async function inspect(input) {
    const owned = readOwner();
    if (owned.classification !== 'ORPHAN_CONFIRMED') {
      return output(owned.classification, `REGISTRY_WRITER_${owned.classification}`);
    }
    const registry = readRegistry();
    if (!registry) return output('CORRUPT_FAIL_CLOSED', 'REGISTRY_STATE_CORRUPT');
    if (!matches(input, owned.owner, registry)) {
      return output('RECOVERY_CONFLICT', 'REGISTRY_WRITER_RECOVERY_BINDING_CONFLICT');
    }
    let inspected;
    try {
      inspected = await options.inspectSurgicalEvidence(deepFreezeCopy({
        request: input,
        owner: owned.owner,
        registry: { generation: registry.generation, integrityDigest: registry.integrityDigest },
      }));
    } catch { return output('INDETERMINATE', 'SURGICAL_RECOVERY_EVIDENCE_INDETERMINATE'); }
    if (inspected === null || inspected === undefined) {
      return output('INDETERMINATE', 'SURGICAL_RECOVERY_EVIDENCE_ABSENT');
    }
    const physicalEvidence = validateEvidence(inspected, owned.owner);
    if (!physicalEvidence) return output('INDETERMINATE', 'SURGICAL_RECOVERY_EVIDENCE_CONTRADICTORY');
    if (physicalEvidence.writerOwnership === 'ACTIVE') {
      return output('NOT_ORPHANED', 'REGISTRY_WRITER_ACTIVE');
    }
    return output('ORPHAN_CONFIRMED', 'REGISTRY_WRITER_ORPHAN_CONFIRMED', {
      owner: owned.owner,
      physicalEvidence,
    });
  }

  function writeExclusive(filePath, value, label) {
    let descriptor;
    try {
      descriptor = filesystem.openSync(
        filePath,
        fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
        0o600,
      );
      filesystem.writeFileSync(descriptor, `${canonicalSerialize(value)}\n`, 'utf8');
      requireDurabilityReceipt(durability.flushFile(descriptor, label), 'FLUSH_FILE_DATA');
      filesystem.closeSync(descriptor);
      descriptor = undefined;
      requireDurabilityReceipt(durability.confirmLock(storageRoot), 'DURABLE_LOCK_BOUNDARY');
      return true;
    } catch (caught) {
      if (descriptor !== undefined) { try { filesystem.closeSync(descriptor); } catch {} }
      if (caught && caught.code === 'EEXIST') return false;
      throw caught;
    }
  }

  function exactOwnerStillPresent(expected) {
    const current = readOwner();
    return current.classification === 'ORPHAN_CONFIRMED' && same(current.owner, expected);
  }

  function publishClaimResult(claimPath, claim, classification, evidence) {
    const result = {
      schema: RESULT_SCHEMA,
      recoveryId: claim.recoveryId,
      ownerFingerprint: claim.ownerFingerprint,
      registryGeneration: claim.registryGeneration,
      authorizationReference: claim.authorizationReference,
      classification,
      physicalEvidenceFingerprint: fingerprint(evidence),
      recoveryEffect: 1,
    };
    const temporary = `${claimPath}.${claim.claimToken}.tmp`;
    let descriptor;
    try {
      descriptor = filesystem.openSync(
        temporary,
        fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
        0o600,
      );
      filesystem.writeFileSync(descriptor, `${canonicalSerialize(result)}\n`, 'utf8');
      requireDurabilityReceipt(durability.flushFile(descriptor, `writer-recovery-result:${claim.recoveryId}`), 'FLUSH_FILE_DATA');
      filesystem.closeSync(descriptor);
      descriptor = undefined;
      filesystem.renameSync(temporary, claimPath);
      requireDurabilityReceipt(durability.confirmRename(storageRoot), 'DURABLE_RENAME_BOUNDARY');
    } catch (caught) {
      if (descriptor !== undefined) { try { filesystem.closeSync(descriptor); } catch {} }
      try { filesystem.unlinkSync(temporary); } catch {}
      throw caught;
    }
    return result;
  }

  function abandonClaim(claimPath, claim) {
    try {
      const parsed = JSON.parse(filesystem.readFileSync(claimPath, 'utf8'));
      if (same(parsed, claim)) {
        filesystem.unlinkSync(claimPath);
        requireDurabilityReceipt(durability.confirmLock(storageRoot), 'DURABLE_LOCK_BOUNDARY');
      }
    } catch {}
  }

  async function recover(input) {
    const inspected = await inspect(input);
    if (inspected.classification !== 'ORPHAN_CONFIRMED') return inspected;
    const owner = inspected.owner;
    const ownerFingerprint = fingerprint(owner);
    const claimToken = crypto.randomBytes(32).toString('hex');
    const claimPath = path.join(storageRoot, `${WRITER_LOCK_FILENAME}.writer-recovery-claim.${ownerFingerprint}`);
    const intendedClassification = inspected.physicalEvidence.effect === 'COMMITTED'
      ? 'RECOVERED_COMMITTED' : 'RECOVERED_NO_EFFECT';
    const claim = deepFreezeCopy({
      schema: CLAIM_SCHEMA,
      protocolVersion: PROTOCOL_VERSION,
      recoveryId: input.recoveryId,
      claimToken,
      ownerFingerprint,
      registryGeneration: input.observedGeneration,
      registryIntegrityDigest: input.observedIntegrityDigest,
      operationId: input.operationId,
      externalExecutionId: input.externalExecutionId,
      authorizationReference: input.authorizationReference,
      intendedClassification,
    });
    try {
      if (!writeExclusive(claimPath, claim, `writer-recovery-claim:${input.recoveryId}`)) {
        return output('RECOVERY_CONFLICT', 'REGISTRY_WRITER_RECOVERY_ALREADY_CLAIMED');
      }
    } catch {
      return output('INDETERMINATE', 'REGISTRY_WRITER_RECOVERY_CLAIM_DURABILITY_FAILED');
    }

    const registry = readRegistry();
    if (!registry || !matches(input, owner, registry) || !exactOwnerStillPresent(owner)) {
      abandonClaim(claimPath, claim);
      return output('RECOVERY_CONFLICT', 'REGISTRY_WRITER_RECOVERY_CAS_CONFLICT');
    }
    let reinspection;
    try {
      reinspection = validateEvidence(await options.inspectSurgicalEvidence(deepFreezeCopy({
        request: input,
        owner,
        registry: { generation: registry.generation, integrityDigest: registry.integrityDigest },
        exclusiveRecoveryClaim: claim,
      })), owner);
    } catch {}
    if (!reinspection || reinspection.writerOwnership !== 'ORPHAN_CONFIRMED'
      || reinspection.effect !== inspected.physicalEvidence.effect
      || reinspection.stage !== inspected.physicalEvidence.stage) {
      abandonClaim(claimPath, claim);
      return output('INDETERMINATE', 'SURGICAL_RECOVERY_EVIDENCE_CHANGED');
    }
    let authorization;
    try {
      authorization = await options.consumeRecoveryAuthorization(deepFreezeCopy({
        request: input,
        owner,
        physicalEvidence: reinspection,
        exclusiveRecoveryClaim: claim,
      }));
    } catch {}
    if (!authorization || authorization.status !== 'VALID' || authorization.oneShot !== true
      || !same(authorization.binding, input)) {
      abandonClaim(claimPath, claim);
      return output('RECOVERY_NOT_AUTHORIZED', 'SURGICAL_RECOVERY_AUTHORITY_REQUIRED');
    }
    if (!exactOwnerStillPresent(owner)) {
      abandonClaim(claimPath, claim);
      return output('RECOVERY_CONFLICT', 'REGISTRY_WRITER_RECOVERY_CAS_CONFLICT');
    }
    try {
      filesystem.unlinkSync(lockPath);
      requireDurabilityReceipt(durability.confirmLock(storageRoot), 'DURABLE_LOCK_BOUNDARY');
      const durableResult = publishClaimResult(claimPath, claim, intendedClassification, reinspection);
      return output(intendedClassification, 'REGISTRY_WRITER_RECOVERY_COMMITTED', {
        recoveryResult: durableResult,
      });
    } catch {
      return output('INDETERMINATE', 'REGISTRY_WRITER_RECOVERY_DURABILITY_INDETERMINATE');
    }
  }

  return Object.freeze({ inspect, recover });
}

module.exports = Object.freeze({
  RECOVERY_CLASSIFICATIONS,
  createControlPlaneRegistryWriterRecovery,
});
