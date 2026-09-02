'use strict';

/* Atomic repository-scoped storage for authority-free R6 continuity records. */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  canonicalizeAuthorizedRoot
} = require('../core/workspace-boundary');
const {
  defaultFilesystemDurabilityAdapter
} = require('./filesystem-durability-adapter');
const {
  validateNaturalMissionContinuityCheckpoint
} = require('../cli/natural-mission-continuity');

const MAX_CONTINUITY_BYTES = 2 * 1024 * 1024;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalStateRoot(value) {
  if (
    typeof value !== 'string' ||
    !path.isAbsolute(value) ||
    path.normalize(value) !== value ||
    value.includes('\0')
  ) {
    throw new Error('Canonical absolute mission continuity state root is required.');
  }
  fs.mkdirSync(value, { recursive: true, mode: 0o700 });
  const lexical = fs.lstatSync(value);
  if (!lexical.isDirectory() || lexical.isSymbolicLink()) {
    throw new Error('Mission continuity state root is unsafe.');
  }
  const physical = fs.realpathSync(value);
  if (physical !== value) {
    throw new Error('Mission continuity state root cannot traverse a symbolic link.');
  }
  return physical;
}

function repositoryKey(repositoryPath) {
  const repository = canonicalizeAuthorizedRoot(repositoryPath);
  return crypto
    .createHash('sha256')
    .update(`sdo.natural_mission_continuity_repository.v1\0${repository}`, 'utf8')
    .digest('hex');
}

function continuityPath(stateRoot, repositoryPath) {
  return path.join(
    canonicalStateRoot(stateRoot),
    `${repositoryKey(repositoryPath)}.json`
  );
}

function parseContinuity(serialized) {
  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('Durable mission continuity JSON is malformed or truncated.');
  }
  try {
    return validateNaturalMissionContinuityCheckpoint(deepFreeze(parsed));
  } catch (error) {
    throw new Error(`Durable mission continuity record is malformed: ${error.message}`);
  }
}

function readContinuity(target) {
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > MAX_CONTINUITY_BYTES) {
    throw new Error('Durable mission continuity file is unsafe or outside its size bound.');
  }
  return parseContinuity(fs.readFileSync(target, 'utf8'));
}

function saveNaturalMissionContinuity({
  stateRoot,
  checkpoint,
  durabilityAdapter = defaultFilesystemDurabilityAdapter
} = {}) {
  const record = validateNaturalMissionContinuityCheckpoint(checkpoint);
  const target = continuityPath(stateRoot, record.repositoryPath);
  const directory = path.dirname(target);
  if (fs.existsSync(target)) {
    const current = readContinuity(target);
    if (current.mission.missionId === record.mission.missionId) {
      if (
        Date.parse(current.recordedAt) > Date.parse(record.recordedAt) ||
        current.checkpointEventCount > record.checkpointEventCount ||
        (
          current.checkpointEventCount === record.checkpointEventCount &&
          current.mission.missionFingerprint !== record.mission.missionFingerprint
        )
      ) {
        throw new Error('Mission continuity rollback or conflicting replacement was stopped.');
      }
    } else if (Date.parse(record.mission.createdAt) < Date.parse(current.recordedAt)) {
      throw new Error('Older cross-mission continuity replacement was stopped.');
    }
  }
  const serialized = `${JSON.stringify(record, null, 2)}\n`;
  if (Buffer.byteLength(serialized, 'utf8') > MAX_CONTINUITY_BYTES) {
    throw new Error('Mission continuity record size bound exceeded.');
  }
  const temporary = path.join(
    directory,
    `.mission-continuity-${process.pid}-${crypto.randomUUID()}.tmp`
  );
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, serialized, 'utf8');
    durabilityAdapter.flushFile(descriptor, temporary);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
  try {
    fs.renameSync(temporary, target);
    durabilityAdapter.confirmRename(directory);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
  return deepFreeze({
    schema: 'sdo.natural_mission_continuity_store_receipt.v1',
    missionId: record.missionId,
    repositoryKey: repositoryKey(record.repositoryPath),
    recordFingerprint: record.recordFingerprint,
    checkpointEventCount: record.checkpointEventCount,
    durable: true,
    atomicRename: true,
    fileDataFlushed: true,
    directoryFlushed: true,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function loadNaturalMissionContinuity({ stateRoot, repositoryPath } = {}) {
  const repository = canonicalizeAuthorizedRoot(repositoryPath);
  const target = continuityPath(stateRoot, repository);
  if (!fs.existsSync(target)) return null;
  const record = readContinuity(target);
  if (record.repositoryPath !== repository) {
    throw new Error('Durable mission continuity belongs to another physical workspace.');
  }
  return record;
}

module.exports = Object.freeze({
  MAX_CONTINUITY_BYTES,
  saveNaturalMissionContinuity,
  loadNaturalMissionContinuity
});
