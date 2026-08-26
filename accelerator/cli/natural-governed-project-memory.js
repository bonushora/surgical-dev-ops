'use strict';

const crypto = require('node:crypto');

const MEMORY_SCHEMA = 'sdo.governed_project_memory.v1';
const RECORD_SCHEMA = 'sdo.governed_project_memory_record.v1';
const MAX_RECORDS = 128;
const MAX_CONTENT_CHARS = 4000;
const CLASSES = Object.freeze([
  'ARCHITECTURAL_DECISION',
  'HUMAN_PREFERENCE',
  'REPOSITORY_FACT',
  'TASK_STATE',
  'COGNITIVE_SUMMARY'
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function required(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function digest(value, label) {
  const result = required(value, label);
  if (!/^[a-f0-9]{64}$/.test(result)) {
    throw new Error(`${label} must be canonical SHA-256.`);
  }
  return result;
}

function timestamp(value) {
  const result = required(value, 'Record timestamp');
  if (!Number.isFinite(Date.parse(result)) || new Date(Date.parse(result)).toISOString() !== result) {
    throw new Error('Canonical ISO-8601 record timestamp is required.');
  }
  return result;
}

function rejectSecrets(content) {
  const patterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
    /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]/i,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    /\bsk-[A-Za-z0-9_-]{20,}\b/
  ];
  if (patterns.some((pattern) => pattern.test(content))) {
    throw new Error('Credential or secret-like content is forbidden in project memory.');
  }
}

function normalizeProjectBinding(value) {
  if (!value || typeof value !== 'object') throw new Error('Project binding is required.');
  return deepFreeze({
    physicalWorkspaceIdentity: digest(value.physicalWorkspaceIdentity, 'Physical workspace identity'),
    repositoryHead: digest(value.repositoryHead, 'Repository HEAD')
  });
}

function createGovernedProjectMemory(binding) {
  return deepFreeze({
    schema: MEMORY_SCHEMA,
    projectBinding: normalizeProjectBinding(binding),
    records: [],
    maxRecords: MAX_RECORDS,
    persistent: true,
    inspectable: true,
    exportable: true,
    deletable: true,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function requireMemory(memory) {
  if (!memory || memory.schema !== MEMORY_SCHEMA || !Object.isFrozen(memory)) {
    throw new Error('Immutable governed project memory is required.');
  }
  return memory;
}

function createGovernedProjectMemoryRecord(memory, input) {
  requireMemory(memory);
  if (!input || typeof input !== 'object') throw new Error('Memory record input is required.');
  const memoryClass = required(input.memoryClass, 'Memory class');
  if (!CLASSES.includes(memoryClass)) throw new Error('Memory class is not qualified.');
  const content = required(input.content, 'Memory content');
  if (content.length > MAX_CONTENT_CHARS) throw new Error('Memory content bound exceeded.');
  rejectSecrets(content);

  let evidenceBinding = null;
  if (input.evidenceBinding !== null && input.evidenceBinding !== undefined) {
    if (typeof input.evidenceBinding !== 'object') throw new Error('Evidence binding is malformed.');
    evidenceBinding = deepFreeze({
      repositoryHead: digest(input.evidenceBinding.repositoryHead, 'Evidence repository HEAD'),
      target: required(input.evidenceBinding.target, 'Evidence target'),
      contentSha256: digest(input.evidenceBinding.contentSha256, 'Evidence content hash')
    });
  }

  if (memoryClass === 'REPOSITORY_FACT' && !evidenceBinding) {
    throw new Error('Repository facts require an evidence binding.');
  }

  const createdAt = timestamp(input.createdAt);
  const source = required(input.source, 'Memory source');
  const authoritative = memoryClass === 'ARCHITECTURAL_DECISION' && input.authoritative === true;
  if (input.authoritative === true && memoryClass !== 'ARCHITECTURAL_DECISION') {
    throw new Error('Only a frozen architectural decision may be marked authoritative.');
  }

  const identity = {
    project: memory.projectBinding.physicalWorkspaceIdentity,
    memoryClass,
    source,
    content,
    evidenceBinding,
    createdAt
  };

  return deepFreeze({
    schema: RECORD_SCHEMA,
    recordId: crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex'),
    ...identity,
    authoritative,
    hypothesis: memoryClass === 'COGNITIVE_SUMMARY',
    approvalAuthority: false,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function rememberGovernedProjectRecord(memory, record) {
  requireMemory(memory);
  if (!record || record.schema !== RECORD_SCHEMA || !Object.isFrozen(record)) {
    throw new Error('Immutable governed memory record is required.');
  }
  if (record.project !== memory.projectBinding.physicalWorkspaceIdentity) {
    throw new Error('Memory record belongs to another physical project.');
  }
  const retained = memory.records.filter((item) => item.recordId !== record.recordId);
  if (retained.length + 1 > MAX_RECORDS) throw new Error('Project memory record bound exceeded.');
  return deepFreeze({ ...memory, records: [...retained, record] });
}

function deleteGovernedProjectRecord(memory, recordId) {
  requireMemory(memory);
  const id = digest(recordId, 'Record identity');
  return deepFreeze({ ...memory, records: memory.records.filter((item) => item.recordId !== id) });
}

function inspectGovernedProjectMemory(memory, currentBinding) {
  requireMemory(memory);
  const current = normalizeProjectBinding(currentBinding);
  if (current.physicalWorkspaceIdentity !== memory.projectBinding.physicalWorkspaceIdentity) {
    throw new Error('Project memory cannot cross physical workspace identity.');
  }
  return deepFreeze(memory.records.map((record) => ({
    ...record,
    stale: Boolean(
      record.evidenceBinding &&
      record.evidenceBinding.repositoryHead !== current.repositoryHead
    ),
    reusableAsAuthority: false
  })));
}

function exportGovernedProjectMemory(memory) {
  requireMemory(memory);
  return JSON.stringify(memory, null, 2) + '\n';
}

module.exports = Object.freeze({
  MEMORY_SCHEMA,
  RECORD_SCHEMA,
  MAX_RECORDS,
  MAX_CONTENT_CHARS,
  CLASSES,
  createGovernedProjectMemory,
  createGovernedProjectMemoryRecord,
  rememberGovernedProjectRecord,
  deleteGovernedProjectRecord,
  inspectGovernedProjectMemory,
  exportGovernedProjectMemory
});
