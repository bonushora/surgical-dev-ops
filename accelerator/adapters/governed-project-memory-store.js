'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { MEMORY_SCHEMA } = require('../cli/natural-governed-project-memory');

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalRoot(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || path.normalize(value) !== value) {
    throw new Error('Canonical absolute memory state root is required.');
  }
  fs.mkdirSync(value, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(value);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Memory state root is unsafe.');
  return fs.realpathSync(value);
}

function memoryPath(stateRoot, physicalWorkspaceIdentity) {
  if (!/^[a-f0-9]{64}$/.test(physicalWorkspaceIdentity || '')) {
    throw new Error('Physical workspace identity is required.');
  }
  return path.join(canonicalRoot(stateRoot), `${physicalWorkspaceIdentity}.json`);
}

function validate(memory, physicalWorkspaceIdentity) {
  if (
    !memory || memory.schema !== MEMORY_SCHEMA ||
    memory.projectBinding?.physicalWorkspaceIdentity !== physicalWorkspaceIdentity ||
    !Array.isArray(memory.records) || memory.operationalAuthority !== false ||
    memory.mutationAuthority !== false
  ) throw new Error('Persisted governed project memory is malformed or unbound.');
  return deepFreeze(memory);
}

function saveGovernedProjectMemory({ stateRoot, memory } = {}) {
  if (!memory || !Object.isFrozen(memory)) throw new Error('Immutable project memory is required.');
  const identity = memory.projectBinding?.physicalWorkspaceIdentity;
  validate(memory, identity);
  const target = memoryPath(stateRoot, identity);
  if (fs.existsSync(target)) {
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Memory state file is unsafe.');
  }
  const temporary = path.join(path.dirname(target), `.memory-${process.pid}-${crypto.randomUUID()}.tmp`);
  const descriptor = fs.openSync(temporary, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, JSON.stringify(memory, null, 2) + '\n', 'utf8');
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    fs.renameSync(temporary, target);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
  return Object.freeze({
    schema: 'sdo.governed_project_memory_store_receipt.v1',
    physicalWorkspaceIdentity: identity,
    recordCount: memory.records.length,
    sha256: crypto.createHash('sha256').update(JSON.stringify(memory)).digest('hex'),
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function loadGovernedProjectMemory({ stateRoot, physicalWorkspaceIdentity } = {}) {
  const target = memoryPath(stateRoot, physicalWorkspaceIdentity);
  if (!fs.existsSync(target)) return null;
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) {
    throw new Error('Memory state file is unsafe.');
  }
  return validate(JSON.parse(fs.readFileSync(target, 'utf8')), physicalWorkspaceIdentity);
}

function deleteGovernedProjectMemory({ stateRoot, physicalWorkspaceIdentity } = {}) {
  const target = memoryPath(stateRoot, physicalWorkspaceIdentity);
  if (!fs.existsSync(target)) return false;
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Memory state file is unsafe.');
  fs.unlinkSync(target);
  return true;
}

module.exports = Object.freeze({
  saveGovernedProjectMemory,
  loadGovernedProjectMemory,
  deleteGovernedProjectMemory
});
