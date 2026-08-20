'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  STAGES,
  createMutationTransaction,
  bindMutationLock,
  bindCommitAuthorityEvidence,
  bindMutationRecoveryEvidence,
  transitionMutationTransaction,
  assertSameMutationTransaction
} = require('../core/mutation-transaction');

const JOURNAL_SCHEMA = 'sdo.mutation_journal.v1';
const RECORD_SCHEMA = 'sdo.mutation_journal_record.v1';
const RECORD_FIELDS = new Set([
  'schema', 'journalId', 'transactionId', 'operationId', 'workspace', 'target',
  'beforeSha256', 'replacementSha256', 'grantFingerprint',
  'approvalAuthorityFingerprint', 'verifiedIdentityAssertionFingerprint',
  'replayIdentity', 'sequence', 'stage', 'payload', 'previousRecordHash',
  'recordHash'
]);
const DEFINITION_FIELDS = [
  'operationId', 'workspace', 'target', 'beforeSha256', 'replacementSha256',
  'grantFingerprint', 'approvalAuthorityFingerprint',
  'verifiedIdentityAssertionFingerprint', 'idempotencyKey'
];
const JOURNAL_TERMINAL = new Set([
  'FINALIZED_SUCCESS', 'FINALIZED_FAILED', 'RECOVERY_UNRESOLVED'
]);
const ZERO_HASH = '0'.repeat(64);
const RECORD_NAME = /^(\d{8})\.json$/;

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function plainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${label} must be an unambiguous plain object.`);
  }
  return value;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new Error('Journal data contains an unsupported mutable structure.');
    }
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  if (!['string', 'number', 'boolean'].includes(typeof value) && value !== null) {
    throw new Error('Journal data contains an unsupported value.');
  }
  return JSON.stringify(value);
}

function hash(label, value) {
  return crypto.createHash('sha256').update(`${label}\0${canonicalJson(value)}`).digest('hex');
}

function definitionOf(transaction) {
  return Object.fromEntries(DEFINITION_FIELDS.map((field) => [field, transaction[field]]));
}

function verifyTransaction(transaction) {
  if (!transaction || typeof transaction !== 'object' || !Object.isFrozen(transaction)) {
    throw new Error('An immutable mutation transaction is required.');
  }
  assertSameMutationTransaction(transaction, transaction);
  return transaction;
}

function identityOf(transaction) {
  verifyTransaction(transaction);
  const identity = {
    transactionId: transaction.transactionId,
    operationId: transaction.operationId,
    workspace: transaction.workspace,
    target: transaction.target,
    beforeSha256: transaction.beforeSha256,
    replacementSha256: transaction.replacementSha256,
    grantFingerprint: transaction.grantFingerprint,
    approvalAuthorityFingerprint: transaction.approvalAuthorityFingerprint,
    verifiedIdentityAssertionFingerprint: transaction.verifiedIdentityAssertionFingerprint,
    replayIdentity: transaction.replayIdentity
  };
  return deepFreeze({
    ...identity,
    journalId: hash('sdo.mutation_journal_identity.v1', identity)
  });
}

function validateStorageRoot(configuredRoot) {
  if (typeof configuredRoot !== 'string' || !configuredRoot || configuredRoot.includes('\0') ||
      !path.isAbsolute(configuredRoot) || path.normalize(configuredRoot) !== configuredRoot) {
    throw new Error('Trusted mutation journal root must be a canonical absolute path.');
  }
  let stat;
  let canonical;
  try {
    stat = fs.lstatSync(configuredRoot);
    canonical = fs.realpathSync(configuredRoot);
  } catch {
    throw new Error('Trusted mutation journal root cannot be resolved.');
  }
  if (!stat.isDirectory() || stat.isSymbolicLink() || canonical !== configuredRoot) {
    throw new Error('Trusted mutation journal root is unsafe or ambiguous.');
  }
  if (typeof process.getuid === 'function' && stat.uid !== process.getuid()) {
    throw new Error('Trusted mutation journal root is not owned by the current user.');
  }
  return canonical;
}

function journalDirectory(root, journalId) {
  if (!/^[a-f0-9]{64}$/.test(journalId)) throw new Error('Journal identity is malformed.');
  const directory = path.join(root, journalId);
  if (path.dirname(directory) !== root) throw new Error('Journal path escapes trusted storage.');
  return directory;
}

function validateJournalDirectory(root, directory) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(directory) !== directory ||
      path.dirname(directory) !== root) {
    throw new Error('Mutation journal directory is unsafe or ambiguous.');
  }
}

function recordPath(directory, sequence) {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 99999999) {
    throw new Error('Journal sequence is malformed.');
  }
  return path.join(directory, `${String(sequence).padStart(8, '0')}.json`);
}

function payloadFor(transaction) {
  if (transaction.stage === 'PREPARED') {
    return deepFreeze({ definition: definitionOf(transaction) });
  }
  if (transaction.stage === 'LOCKED') return deepFreeze({ lock: transaction.lock });
  if (transaction.stage === 'COMMIT_AUTHORITY_VERIFIED') {
    return deepFreeze({ commitAuthority: transaction.commitAuthority });
  }
  if (['RECOVERED', 'RECOVERY_UNRESOLVED'].includes(transaction.stage) &&
      transaction.recoveryEvidence) {
    return deepFreeze({ recoveryEvidence: transaction.recoveryEvidence });
  }
  return deepFreeze({});
}

function recordFor(transaction, identity, previousRecordHash) {
  const base = {
    schema: RECORD_SCHEMA,
    ...identity,
    sequence: transaction.version,
    stage: transaction.stage,
    payload: payloadFor(transaction),
    previousRecordHash
  };
  return deepFreeze({
    ...base,
    recordHash: hash('sdo.mutation_journal_record.v1', base)
  });
}

function readRecord(file) {
  let descriptor;
  try {
    const noFollow = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    descriptor = fs.openSync(file, fs.constants.O_RDONLY | noFollow);
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size < 3 || stat.size > 65536) {
      throw new Error('Mutation journal record is malformed or truncated.');
    }
    const raw = fs.readFileSync(descriptor, 'utf8');
    if (!raw.endsWith('\n')) throw new Error('Mutation journal record is malformed or truncated.');
    let parsed;
    try { parsed = JSON.parse(raw); } catch {
      throw new Error('Mutation journal record contains invalid JSON.');
    }
    return parsed;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function exactKeys(object, fields) {
  const keys = Object.keys(object);
  return keys.length === fields.size && keys.every((key) => fields.has(key));
}

function validateRecord(record, identity, sequence, previousRecordHash) {
  plainObject(record, 'Mutation journal record');
  if (!exactKeys(record, RECORD_FIELDS) || record.schema !== RECORD_SCHEMA ||
      record.journalId !== identity.journalId ||
      record.transactionId !== identity.transactionId ||
      record.operationId !== identity.operationId || record.workspace !== identity.workspace ||
      record.target !== identity.target || record.beforeSha256 !== identity.beforeSha256 ||
      record.replacementSha256 !== identity.replacementSha256 ||
      record.grantFingerprint !== identity.grantFingerprint ||
      record.approvalAuthorityFingerprint !== identity.approvalAuthorityFingerprint ||
      record.verifiedIdentityAssertionFingerprint !==
        identity.verifiedIdentityAssertionFingerprint ||
      record.replayIdentity !== identity.replayIdentity || record.sequence !== sequence ||
      !STAGES.includes(record.stage) || record.previousRecordHash !== previousRecordHash ||
      !/^[a-f0-9]{64}$/.test(record.recordHash || '')) {
    throw new Error('Mutation journal record identity, sequence, or correlation is invalid.');
  }
  plainObject(record.payload, 'Mutation journal record payload');
  const { recordHash, ...base } = record;
  if (recordHash !== hash('sdo.mutation_journal_record.v1', base)) {
    throw new Error('Mutation journal record hash is invalid; corruption or tampering detected.');
  }
  return deepFreeze(record);
}

function reconstruct(records) {
  if (records.length === 0 || records[0].stage !== 'PREPARED' ||
      Object.keys(records[0].payload).length !== 1) {
    throw new Error('Mutation journal lacks a valid PREPARED record.');
  }
  plainObject(records[0].payload.definition, 'PREPARED transaction definition');
  let transaction = createMutationTransaction(records[0].payload.definition);
  const identity = identityOf(transaction);
  let previous = ZERO_HASH;
  for (let index = 0; index < records.length; index += 1) {
    const record = validateRecord(records[index], identity, index + 1, previous);
    if (index === 0) {
      if (record.stage !== transaction.stage) throw new Error('PREPARED stage is inconsistent.');
    } else if (record.stage === 'LOCKED') {
      if (Object.keys(record.payload).length !== 1 || !record.payload.lock) {
        throw new Error('LOCKED journal payload is malformed.');
      }
      deepFreeze(record.payload.lock);
      transaction = bindMutationLock(transaction, record.payload.lock);
    } else if (record.stage === 'COMMIT_AUTHORITY_VERIFIED') {
      if (Object.keys(record.payload).length !== 1 || !record.payload.commitAuthority) {
        throw new Error('COMMIT_AUTHORITY_VERIFIED journal payload is malformed.');
      }
      deepFreeze(record.payload.commitAuthority);
      transaction = bindCommitAuthorityEvidence(transaction, record.payload.commitAuthority);
    } else if (['RECOVERED', 'RECOVERY_UNRESOLVED'].includes(record.stage) &&
        record.payload.recoveryEvidence) {
      if (Object.keys(record.payload).length !== 1) {
        throw new Error('Mutation recovery journal payload is malformed.');
      }
      deepFreeze(record.payload.recoveryEvidence);
      transaction = bindMutationRecoveryEvidence(transaction, record.payload.recoveryEvidence);
    } else {
      if (Object.keys(record.payload).length !== 0) {
        throw new Error('Mutation journal stage payload is malformed.');
      }
      transaction = transitionMutationTransaction(transaction, record.stage);
    }
    if (transaction.version !== record.sequence || transaction.stage !== record.stage) {
      throw new Error('Mutation journal stage ordering conflicts with transaction semantics.');
    }
    previous = record.recordHash;
  }
  return { transaction, identity };
}

function publishRecord(directory, record) {
  const destination = recordPath(directory, record.sequence);
  const temporary = path.join(directory,
    `.pending-${String(record.sequence).padStart(8, '0')}-${process.pid}-${crypto.randomUUID()}`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(record)}\n`);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.linkSync(temporary, destination);
    fs.unlinkSync(temporary);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
}

function createMutationJournalAdapter({ storageRoot } = {}) {
  const root = validateStorageRoot(storageRoot);

  function readJournal(transaction) {
    const requested = verifyTransaction(transaction);
    const identity = identityOf(requested);
    const directory = journalDirectory(root, identity.journalId);
    let names;
    try {
      validateJournalDirectory(root, directory);
      names = fs.readdirSync(directory);
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error('Mutation journal does not exist.');
      throw error;
    }
    if (names.length === 0 || names.some((name) => !RECORD_NAME.test(name))) {
      throw new Error('Mutation journal contains malformed, truncated, or ambiguous entries.');
    }
    names.sort();
    const records = names.map((name, index) => {
      const match = RECORD_NAME.exec(name);
      if (Number(match[1]) !== index + 1) {
        throw new Error('Mutation journal has a missing, duplicate, or reordered sequence.');
      }
      return readRecord(path.join(directory, name));
    });
    const reconstructed = reconstruct(records);
    assertSameMutationTransaction(requested, reconstructed.transaction);
    return deepFreeze({
      schema: JOURNAL_SCHEMA,
      journalId: identity.journalId,
      identity,
      transaction: reconstructed.transaction,
      records
    });
  }

  function create(transaction) {
    const prepared = verifyTransaction(transaction);
    if (prepared.stage !== 'PREPARED' || prepared.version !== 1) {
      throw new Error('Journal creation requires a PREPARED transaction.');
    }
    const identity = identityOf(prepared);
    const directory = journalDirectory(root, identity.journalId);
    try {
      fs.mkdirSync(directory, { mode: 0o700 });
    } catch (error) {
      if (error.code === 'EEXIST') {
        const existing = readJournal(prepared);
        if (existing.records.length === 1) return existing;
        throw new Error('Mutation journal already exists beyond PREPARED state.');
      }
      throw error;
    }
    validateJournalDirectory(root, directory);
    try {
      publishRecord(directory, recordFor(prepared, identity, ZERO_HASH));
    } catch (error) {
      if (error.code === 'EEXIST') return readJournal(prepared);
      throw error;
    }
    return readJournal(prepared);
  }

  function append(transaction) {
    const candidate = verifyTransaction(transaction);
    const current = readJournal(candidate);
    if (candidate.version === current.transaction.version) {
      if (canonicalJson(candidate) === canonicalJson(current.transaction)) return current;
      throw new Error('Conflicting duplicate mutation journal record.');
    }
    if (JOURNAL_TERMINAL.has(current.transaction.stage)) {
      throw new Error('Terminal mutation journal rejects new stage append.');
    }
    if (candidate.version !== current.transaction.version + 1 ||
        candidate.history.slice(0, -1).length !== current.transaction.history.length ||
        canonicalJson(candidate.history.slice(0, -1)) !==
          canonicalJson(current.transaction.history)) {
      throw new Error('Mutation journal append is skipped, reordered, or conflicting.');
    }
    const identity = current.identity;
    const record = recordFor(candidate, identity,
      current.records[current.records.length - 1].recordHash);
    const directory = journalDirectory(root, identity.journalId);
    try {
      publishRecord(directory, record);
    } catch (error) {
      if (error.code === 'EEXIST') {
        const winner = readJournal(candidate);
        if (winner.transaction.version === candidate.version &&
            canonicalJson(winner.transaction) === canonicalJson(candidate)) return winner;
        throw new Error('Conflicting concurrent mutation journal append.');
      }
      throw error;
    }
    return readJournal(candidate);
  }

  return deepFreeze({ create, append, reopen: readJournal });
}

module.exports = { createMutationJournalAdapter };
