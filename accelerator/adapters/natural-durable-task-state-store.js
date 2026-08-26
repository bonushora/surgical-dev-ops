'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  TASK_STATE_SCHEMA,
  validateNaturalDurableTaskState
} = require('../cli/natural-durable-task-state');

const MAX_STATE_BYTES = 1024 * 1024;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalRoot(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || path.normalize(value) !== value) {
    throw new Error('Canonical absolute durable task state root is required.');
  }
  fs.mkdirSync(value, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(value);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Durable task state root is unsafe.');
  return fs.realpathSync(value);
}

function taskPath(stateRoot, taskId) {
  if (!/^[a-f0-9]{64}$/.test(taskId || '')) throw new Error('Durable task identity is required.');
  return path.join(canonicalRoot(stateRoot), `${taskId}.json`);
}

function hydrate(value) {
  if (!value || value.schema !== TASK_STATE_SCHEMA) throw new Error('Persisted durable task state is malformed.');
  return validateNaturalDurableTaskState(deepFreeze(value));
}

function saveNaturalDurableTaskState({ stateRoot, state } = {}) {
  validateNaturalDurableTaskState(state);
  const target = taskPath(stateRoot, state.taskId);
  if (fs.existsSync(target)) {
    const currentStat = fs.lstatSync(target);
    if (!currentStat.isFile() || currentStat.isSymbolicLink()) throw new Error('Durable task state file is unsafe.');
    const current = hydrate(JSON.parse(fs.readFileSync(target, 'utf8')));
    if (current.transitions.length > state.transitions.length ||
        (current.transitions.length === state.transitions.length && current.stateFingerprint !== state.stateFingerprint)) {
      throw new Error('Durable task state rollback or conflicting replacement was stopped.');
    }
  }

  const serialized = JSON.stringify(state, null, 2) + '\n';
  if (Buffer.byteLength(serialized) > MAX_STATE_BYTES) throw new Error('Durable task state size bound exceeded.');
  const temporary = path.join(path.dirname(target), `.task-${process.pid}-${crypto.randomUUID()}.tmp`);
  const descriptor = fs.openSync(temporary, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, serialized, 'utf8');
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
    schema: 'sdo.natural_durable_task_store_receipt.v1',
    taskId: state.taskId,
    stateFingerprint: state.stateFingerprint,
    transitionCount: state.transitions.length,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function loadNaturalDurableTaskState({ stateRoot, taskId, physicalWorkspaceIdentity } = {}) {
  const target = taskPath(stateRoot, taskId);
  if (!fs.existsSync(target)) return null;
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_STATE_BYTES) {
    throw new Error('Durable task state file is unsafe.');
  }
  const state = hydrate(JSON.parse(fs.readFileSync(target, 'utf8')));
  if (state.physicalWorkspaceIdentity !== physicalWorkspaceIdentity) {
    throw new Error('Durable task state belongs to another physical workspace.');
  }
  return state;
}

module.exports = Object.freeze({
  MAX_STATE_BYTES,
  saveNaturalDurableTaskState,
  loadNaturalDurableTaskState
});
