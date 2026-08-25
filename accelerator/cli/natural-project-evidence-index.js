'use strict';

/*
 * ADR-024-C commit-bound project evidence index.
 *
 * This module is deliberately pure and in-memory. It indexes evidence already
 * admitted by the canonical Orchestrator; it never reads the filesystem, Git,
 * a process or a provider. A hit is data-only and grants no authority.
 */

const crypto = require('node:crypto');

const INDEX_SCHEMA =
  'sdo.natural_project_evidence_index.v1';
const ENTRY_SCHEMA =
  'sdo.natural_project_evidence_index_entry.v1';
const PARSER_VERSION = 'natural-evidence-v1';
const MAX_ENTRIES = 32;
const MAX_ENTRY_BYTES = 64 * 1024;
const MAX_TOTAL_BYTES = 512 * 1024;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function sha256(value, label) {
  const digest = text(value, label);
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error(`${label} must be canonical SHA-256.`);
  }
  return digest;
}

function canonicalTarget(value) {
  const target = text(value, 'Canonical target');
  if (
    target.startsWith('/') ||
    target.includes('\\') ||
    target.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error('Canonical workspace-relative target is required.');
  }
  return target;
}

function canonicalTime(value) {
  const observedAt = text(value, 'Observation time');
  if (
    !Number.isFinite(Date.parse(observedAt)) ||
    new Date(Date.parse(observedAt)).toISOString() !== observedAt
  ) {
    throw new Error('Canonical ISO-8601 observation time is required.');
  }
  return observedAt;
}

function byteCount(value, maximum = MAX_ENTRY_BYTES) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error('Bounded evidence byte count is required.');
  }
  return value;
}

function bindingFingerprint(binding) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(binding), 'utf8')
    .digest('hex');
}

function normalizeBinding(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('Project evidence binding is required.');
  }

  return deepFreeze({
    physicalWorkspaceIdentity: sha256(
      value.physicalWorkspaceIdentity,
      'Physical workspace identity'
    ),
    repositoryHead: sha256(value.repositoryHead, 'Repository HEAD'),
    worktreeFingerprint: sha256(
      value.worktreeFingerprint,
      'Worktree fingerprint'
    ),
    parserVersion: text(value.parserVersion || PARSER_VERSION, 'Parser version')
  });
}

function createNaturalProjectEvidenceIndex(binding) {
  const normalized = normalizeBinding(binding);

  return deepFreeze({
    schema: INDEX_SCHEMA,
    binding: normalized,
    bindingFingerprint: bindingFingerprint(normalized),
    entries: [],
    indexedBytes: 0,
    maxEntries: MAX_ENTRIES,
    maxEntryBytes: MAX_ENTRY_BYTES,
    maxTotalBytes: MAX_TOTAL_BYTES,
    persistent: false,
    readOnlyEvidence: true,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function requireIndex(index) {
  if (
    !index ||
    index.schema !== INDEX_SCHEMA ||
    !Object.isFrozen(index) ||
    bindingFingerprint(index.binding) !== index.bindingFingerprint
  ) {
    throw new Error('Immutable canonical project evidence index is required.');
  }
  return index;
}

function createNaturalProjectEvidenceEntry(index, value) {
  requireIndex(index);
  if (!value || typeof value !== 'object') {
    throw new Error('Governed project evidence is required.');
  }

  const target = canonicalTarget(value.target);
  const bytes = byteCount(value.bytes);
  if (typeof value.content !== 'string' || value.content.length === 0) {
    throw new Error('Indexed evidence content is required.');
  }
  const content = value.content;

  if (Buffer.byteLength(content, 'utf8') !== bytes) {
    throw new Error('Evidence bytes do not match indexed content.');
  }

  const contentSha256 = sha256(value.contentSha256, 'Content hash');
  if (
    crypto.createHash('sha256').update(content, 'utf8').digest('hex') !==
    contentSha256
  ) {
    throw new Error('Evidence content does not match its content hash.');
  }

  return deepFreeze({
    schema: ENTRY_SCHEMA,
    bindingFingerprint: index.bindingFingerprint,
    physicalWorkspaceIdentity: index.binding.physicalWorkspaceIdentity,
    repositoryHead: index.binding.repositoryHead,
    worktreeFingerprint: index.binding.worktreeFingerprint,
    target,
    contentSha256,
    bytes,
    parserVersion: index.binding.parserVersion,
    observedAt: canonicalTime(value.observedAt),
    content,
    source: 'Surgical DevOps governed Orchestrator evidence',
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function admitNaturalProjectEvidence(index, entry) {
  requireIndex(index);
  if (
    !entry ||
    entry.schema !== ENTRY_SCHEMA ||
    !Object.isFrozen(entry) ||
    entry.bindingFingerprint !== index.bindingFingerprint
  ) {
    throw new Error('Evidence entry is not bound to this index.');
  }

  const retained = index.entries.filter((item) => item.target !== entry.target);
  const retainedBytes = retained.reduce((sum, item) => sum + item.bytes, 0);

  if (retained.length + 1 > MAX_ENTRIES) {
    throw new Error('Project evidence index entry bound exceeded.');
  }
  if (retainedBytes + entry.bytes > MAX_TOTAL_BYTES) {
    throw new Error('Project evidence index byte bound exceeded.');
  }

  return deepFreeze({
    ...index,
    entries: [...retained, entry].sort((left, right) =>
      left.target.localeCompare(right.target)
    ),
    indexedBytes: retainedBytes + entry.bytes
  });
}

function miss(index, reason, stale = false) {
  return deepFreeze({
    schema: 'sdo.natural_project_evidence_lookup.v1',
    status: stale ? 'STALE' : 'MISS',
    reason,
    entry: null,
    physicalReadRequired: true,
    evidenceCost: 'PHYSICAL_OBSERVATION',
    operationalAuthority: false,
    mutationAuthority: false,
    indexBindingFingerprint: index.bindingFingerprint
  });
}

function lookupNaturalProjectEvidence(index, query) {
  requireIndex(index);
  if (!query || typeof query !== 'object') {
    throw new Error('Bounded evidence lookup is required.');
  }

  if (query.freshPhysicalObservationRequired === true) {
    return miss(index, 'Governing contract requires fresh physical evidence.');
  }

  const current = normalizeBinding(query);
  if (bindingFingerprint(current) !== index.bindingFingerprint) {
    return miss(index, 'Project evidence binding changed.', true);
  }

  const target = canonicalTarget(query.target);
  const entry = index.entries.find((item) => item.target === target);
  if (!entry) {
    return miss(index, 'Canonical target is not indexed.');
  }

  if (
    query.observedContentSha256 !== undefined &&
    sha256(query.observedContentSha256, 'Observed content hash') !==
      entry.contentSha256
  ) {
    return miss(index, 'Indexed content hash is stale.', true);
  }

  return deepFreeze({
    schema: 'sdo.natural_project_evidence_lookup.v1',
    status: 'HIT',
    reason: null,
    entry,
    physicalReadRequired: false,
    evidenceCost: 'INDEX_REUSE',
    operationalAuthority: false,
    mutationAuthority: false,
    indexBindingFingerprint: index.bindingFingerprint
  });
}

module.exports = Object.freeze({
  INDEX_SCHEMA,
  ENTRY_SCHEMA,
  PARSER_VERSION,
  MAX_ENTRIES,
  MAX_ENTRY_BYTES,
  MAX_TOTAL_BYTES,
  createNaturalProjectEvidenceIndex,
  createNaturalProjectEvidenceEntry,
  admitNaturalProjectEvidence,
  lookupNaturalProjectEvidence
});
