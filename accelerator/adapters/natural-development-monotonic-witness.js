'use strict';

const fs = require('node:fs');
const path = require('node:path');

const identity = require('./natural-development-store-integrity-identity');
const transition = require('./natural-development-store-transition');

const EVENT_SCHEMA = 'sdo.store_integrity_witness_event.v1';
const POINTER_SCHEMA = 'sdo.store_integrity_witness_pointer.v1';
const EVENT_KEYS = Object.freeze([
  'authorizationFingerprint', 'epoch', 'eventType', 'generation', 'headDigest',
  'keyId', 'phase', 'physicalWorkspaceIdentity', 'previousHead', 'purpose',
  'repositoryIdentity', 'schema', 'signature', 'storeId', 'storeRoot',
  'transitionDigest'
].sort());
const POINTER_KEYS = Object.freeze([
  'epoch', 'eventDigest', 'generation', 'headDigest', 'purpose',
  'schema', 'storeId', 'storeRoot'
].sort());
const MAX_WITNESS_BYTES = 128 * 1024;

function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, 'r');
  try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
}

function serialize(value) {
  const data = JSON.stringify(value, null, 2) + '\n';
  if (Buffer.byteLength(data) > MAX_WITNESS_BYTES) {
    throw new Error('Store-integrity witness record exceeds its size bound.');
  }
  return data;
}

function writeExclusive(target, value) {
  const descriptor = fs.openSync(target, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, serialize(value), 'utf8');
    fs.fsyncSync(descriptor);
  } finally { fs.closeSync(descriptor); }
  fsyncDirectory(path.dirname(target));
}

function replacePointer(target, value) {
  const directory = path.dirname(target);
  const temporary = path.join(directory, `.pointer-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`);
  writeExclusive(temporary, value);
  try {
    fs.renameSync(temporary, target);
    fsyncDirectory(directory);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
}

function readJson(target, label) {
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_WITNESS_BYTES) {
    throw new Error(`${label} is unsafe.`);
  }
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function eventFilename(generation, phase) {
  return `${String(generation).padStart(16, '0')}-${phase.toLowerCase()}.json`;
}

function unsignedEvent(event) {
  const { signature: _signature, ...unsigned } = event;
  return unsigned;
}

function signedEvent(context, fields) {
  const unsigned = {
    schema: EVENT_SCHEMA,
    purpose: transition.PURPOSE,
    storeId: context.storeId,
    epoch: context.epoch,
    repositoryIdentity: context.repositoryIdentity,
    keyId: context.keyId,
    ...fields
  };
  return Object.freeze({ ...unsigned, signature: identity.signWitnessEvent(context, unsigned) });
}

function validateEvent(context, event) {
  transition.exactKeys(event, EVENT_KEYS, 'Store-integrity witness event');
  if (
    event.schema !== EVENT_SCHEMA || event.purpose !== transition.PURPOSE ||
    event.storeId !== context.storeId || event.epoch !== context.epoch ||
    event.repositoryIdentity !== context.repositoryIdentity || event.keyId !== context.keyId
  ) throw new Error('Store-integrity witness event binding is invalid.');
  if (!Number.isSafeInteger(event.generation) || event.generation < 0) {
    throw new Error('Store-integrity witness generation is malformed.');
  }
  for (const [value, label] of [
    [event.previousHead, 'Witness previous head'], [event.headDigest, 'Witness head'],
    [event.storeRoot, 'Witness store root'], [event.transitionDigest, 'Witness transition digest'],
    [event.authorizationFingerprint, 'Witness authorization fingerprint'],
    [event.physicalWorkspaceIdentity, 'Witness physical workspace identity']
  ]) {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
      throw new Error(`${label} is malformed.`);
    }
  }
  if (!['PREPARED', 'COMMITTED', 'ABORTED'].includes(event.phase)) {
    throw new Error('Store-integrity witness phase is unknown.');
  }
  if (!['BOOTSTRAP', 'CLAIM', 'CONSUME'].includes(event.eventType)) {
    throw new Error('Store-integrity witness event type is unknown.');
  }
  identity.verifyWitnessEventSignature(context, unsignedEvent(event), event.signature);
  return event;
}

function validatePointer(context, pointer) {
  transition.exactKeys(pointer, POINTER_KEYS, 'Store-integrity witness pointer');
  if (
    pointer.schema !== POINTER_SCHEMA || pointer.purpose !== transition.PURPOSE ||
    pointer.storeId !== context.storeId || pointer.epoch !== context.epoch ||
    !Number.isSafeInteger(pointer.generation) || pointer.generation < 0
  ) throw new Error('Store-integrity witness pointer binding is invalid.');
  for (const key of ['eventDigest', 'headDigest', 'storeRoot']) {
    if (!/^[a-f0-9]{64}$/.test(pointer[key] || '')) throw new Error('Store-integrity witness pointer digest is malformed.');
  }
  return pointer;
}

function bootstrapTestWitness(context) {
  const eventsRoot = path.join(context.witnessRoot, 'events');
  fs.mkdirSync(eventsRoot, { mode: 0o700 });
  fsyncDirectory(context.witnessRoot);
  const emptyRoot = transition.computeStoreRoot([]);
  const event = signedEvent(context, {
    phase: 'COMMITTED',
    eventType: 'BOOTSTRAP',
    generation: 0,
    previousHead: transition.ZERO_HEAD,
    headDigest: transition.ZERO_HEAD,
    storeRoot: emptyRoot,
    transitionDigest: transition.ZERO_HEAD,
    authorizationFingerprint: transition.ZERO_HEAD,
    physicalWorkspaceIdentity: transition.ZERO_HEAD
  });
  writeExclusive(path.join(eventsRoot, eventFilename(0, 'COMMITTED')), event);
  const pointer = {
    schema: POINTER_SCHEMA,
    purpose: transition.PURPOSE,
    storeId: context.storeId,
    epoch: context.epoch,
    generation: 0,
    headDigest: transition.ZERO_HEAD,
    storeRoot: emptyRoot,
    eventDigest: transition.digest(event)
  };
  writeExclusive(path.join(context.witnessRoot, 'current.json'), pointer);
  fsyncDirectory(context.witnessRoot);
  return Object.freeze(pointer);
}

function loadEvents(context) {
  const root = path.join(context.witnessRoot, 'events');
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Store-integrity witness event root is unsafe.');
  const files = fs.readdirSync(root).sort();
  if (files.length === 0) throw new Error('Store-integrity witness event log is missing.');
  const events = [];
  for (const file of files) {
    if (!/^\d{16}-(prepared|committed|aborted)\.json$/.test(file)) {
      throw new Error('Store-integrity witness contains an unknown artifact.');
    }
    const event = validateEvent(context, readJson(path.join(root, file), 'Store-integrity witness event'));
    if (file !== eventFilename(event.generation, event.phase)) {
      throw new Error('Store-integrity witness event position binding is invalid.');
    }
    events.push(event);
  }
  return events;
}

function loadCommittedState(context) {
  identity.loadKeyMetadata(context, { requireActive: true });
  const witnessArtifacts = fs.readdirSync(context.witnessRoot).sort();
  if (
    witnessArtifacts.length !== 2 ||
    witnessArtifacts[0] !== 'current.json' ||
    witnessArtifacts[1] !== 'events'
  ) throw new Error('Store-integrity witness root contains an unknown or incomplete artifact set.');
  const pointer = validatePointer(context, readJson(path.join(context.witnessRoot, 'current.json'), 'Store-integrity witness pointer'));
  const events = loadEvents(context);
  const groups = new Map();
  for (const event of events) {
    const group = groups.get(event.generation) || {};
    if (group[event.phase]) throw new Error('Store-integrity witness contains a competing same-generation event.');
    group[event.phase] = event;
    groups.set(event.generation, group);
  }
  const bootstrap = groups.get(0);
  if (!bootstrap || !bootstrap.COMMITTED || Object.keys(bootstrap).length !== 1 || bootstrap.COMMITTED.eventType !== 'BOOTSTRAP') {
    throw new Error('Store-integrity witness bootstrap is invalid.');
  }
  let latest = bootstrap.COMMITTED;
  let expectedGeneration = 1;
  while (groups.has(expectedGeneration)) {
    const group = groups.get(expectedGeneration);
    if (!group.PREPARED) throw new Error('Store-integrity witness generation lacks its prepared event.');
    if (group.COMMITTED && group.ABORTED) throw new Error('Store-integrity witness generation has competing terminal states.');
    if (!group.COMMITTED && !group.ABORTED) {
      throw new Error('Store-integrity witness has an outstanding PREPARED transition; authority use is blocked.');
    }
    const prepared = group.PREPARED;
    if (prepared.previousHead !== latest.headDigest) throw new Error('Store-integrity witness predecessor chain is invalid.');
    const terminal = group.COMMITTED || group.ABORTED;
    for (const key of ['eventType', 'generation', 'previousHead', 'headDigest', 'storeRoot', 'transitionDigest', 'authorizationFingerprint', 'physicalWorkspaceIdentity']) {
      if (terminal[key] !== prepared[key]) throw new Error('Store-integrity witness prepared/terminal binding mismatch.');
    }
    if (group.COMMITTED) latest = group.COMMITTED;
    expectedGeneration += 1;
  }
  if ([...groups.keys()].some((generation) => generation >= expectedGeneration)) {
    throw new Error('Store-integrity witness generations are noncontiguous.');
  }
  if (
    pointer.generation !== latest.generation || pointer.headDigest !== latest.headDigest ||
    pointer.storeRoot !== latest.storeRoot || pointer.eventDigest !== transition.digest(latest)
  ) throw new Error('Store-integrity witness current pointer is stale, newer, or corrupt.');
  return Object.freeze({ ...pointer, event: latest });
}

function prepareTransition(context, { expected, envelope }) {
  const current = loadCommittedState(context);
  if (
    current.generation !== expected.generation || current.headDigest !== expected.headDigest ||
    current.storeRoot !== expected.storeRoot
  ) throw new Error('Store-integrity witness compare-and-swap contention denied.');
  if (envelope.generation !== current.generation + 1 || envelope.previousHead !== current.headDigest) {
    throw new Error('Store-integrity transition does not advance the exact witness head.');
  }
  const headDigest = transition.digest(envelope);
  const event = signedEvent(context, {
    phase: 'PREPARED',
    eventType: envelope.transitionType,
    generation: envelope.generation,
    previousHead: envelope.previousHead,
    headDigest,
    storeRoot: envelope.storeRoot,
    transitionDigest: headDigest,
    authorizationFingerprint: envelope.authorizationFingerprint,
    physicalWorkspaceIdentity: envelope.physicalWorkspaceIdentity
  });
  try {
    writeExclusive(path.join(context.witnessRoot, 'events', eventFilename(event.generation, event.phase)), event);
  } catch (error) {
    if (error && error.code === 'EEXIST') throw new Error('Store-integrity witness compare-and-swap contention denied.');
    throw error;
  }
  return event;
}

function commitPreparedTransition(context, prepared) {
  validateEvent(context, prepared);
  if (prepared.phase !== 'PREPARED') throw new Error('A PREPARED witness event is required.');
  const pointer = validatePointer(context, readJson(path.join(context.witnessRoot, 'current.json'), 'Store-integrity witness pointer'));
  if (
    pointer.generation === prepared.generation &&
    pointer.headDigest === prepared.headDigest &&
    pointer.storeRoot === prepared.storeRoot
  ) {
    const existing = validateEvent(
      context,
      readJson(
        path.join(context.witnessRoot, 'events', eventFilename(prepared.generation, 'COMMITTED')),
        'Committed store-integrity witness event'
      )
    );
    if (transition.digest(existing) !== pointer.eventDigest) {
      throw new Error('Idempotent witness commit does not match the current pointer.');
    }
    return Object.freeze(pointer);
  }
  if (pointer.generation !== prepared.generation - 1 || pointer.headDigest !== prepared.previousHead) {
    throw new Error('Store-integrity witness commit compare-and-swap failed.');
  }
  const event = signedEvent(context, {
    phase: 'COMMITTED',
    eventType: prepared.eventType,
    generation: prepared.generation,
    previousHead: prepared.previousHead,
    headDigest: prepared.headDigest,
    storeRoot: prepared.storeRoot,
    transitionDigest: prepared.transitionDigest,
    authorizationFingerprint: prepared.authorizationFingerprint,
    physicalWorkspaceIdentity: prepared.physicalWorkspaceIdentity
  });
  const target = path.join(context.witnessRoot, 'events', eventFilename(prepared.generation, 'COMMITTED'));
  if (!fs.existsSync(target)) writeExclusive(target, event);
  const persisted = validateEvent(context, readJson(target, 'Committed store-integrity witness event'));
  for (const key of ['eventType', 'generation', 'previousHead', 'headDigest', 'storeRoot', 'transitionDigest', 'authorizationFingerprint', 'physicalWorkspaceIdentity']) {
    if (persisted[key] !== prepared[key]) throw new Error('Committed witness event conflicts with its prepare.');
  }
  const next = {
    schema: POINTER_SCHEMA,
    purpose: transition.PURPOSE,
    storeId: context.storeId,
    epoch: context.epoch,
    generation: persisted.generation,
    headDigest: persisted.headDigest,
    storeRoot: persisted.storeRoot,
    eventDigest: transition.digest(persisted)
  };
  replacePointer(path.join(context.witnessRoot, 'current.json'), next);
  return Object.freeze(next);
}

module.exports = Object.freeze({
  EVENT_SCHEMA,
  POINTER_SCHEMA,
  bootstrapTestWitness,
  commitPreparedTransition,
  loadCommittedState,
  prepareTransition
});
