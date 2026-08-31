'use strict';

const crypto = require('node:crypto');

const AUDIT_SCHEMA = 'sdo.governed_workspace_audit.v1';
const EVENT_SCHEMA = 'sdo.governed_workspace_audit_event.v1';
const EVENT_KINDS = Object.freeze(['SESSION_BOUND', 'SESSION_REVALIDATED', 'DISCOVERY', 'EVIDENCE_READ', 'AUTHORITY_EXPANSION', 'MUTATION_PROPOSED', 'MUTATION_COMMITTED', 'VALIDATION_RESULT']);
const MAX_EVENTS = 256;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function digest(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error(`${label} must be canonical SHA-256.`);
  return value;
}

function canonicalTime(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error('Canonical audit timestamp is required.');
  return value;
}

function createGovernedWorkspaceAudit({ sessionFingerprint, physicalWorkspaceIdentity } = {}) {
  return deepFreeze({ schema: AUDIT_SCHEMA, sessionFingerprint: digest(sessionFingerprint, 'Session fingerprint'), physicalWorkspaceIdentity: digest(physicalWorkspaceIdentity, 'Physical workspace identity'), events: [], maxEvents: MAX_EVENTS, contentTelemetry: false, operationalAuthority: false, mutationAuthority: false });
}

function appendGovernedWorkspaceAuditEvent(audit, { kind, observedAt, operationFingerprint, outcome, target = null, content = undefined } = {}) {
  if (!audit || audit.schema !== AUDIT_SCHEMA || !Object.isFrozen(audit)) throw new Error('Immutable governed workspace audit is required.');
  if (!EVENT_KINDS.includes(kind)) throw new Error('Workspace audit event kind is not qualified.');
  if (content !== undefined) throw new Error('Workspace content telemetry is forbidden.');
  if (target !== null && (typeof target !== 'string' || !target.trim() || target.length > 1024)) throw new Error('Bounded audit target is required.');
  if (typeof outcome !== 'string' || !outcome.trim() || outcome.length > 128) throw new Error('Bounded audit outcome is required.');
  if (audit.events.length >= audit.maxEvents) throw new Error('Workspace audit event ceiling exceeded.');
  const previousEventHash = audit.events.at(-1)?.eventHash || '0'.repeat(64);
  const body = { sequence: audit.events.length + 1, kind, observedAt: canonicalTime(observedAt), operationFingerprint: digest(operationFingerprint, 'Operation fingerprint'), outcome: outcome.trim(), target: target?.trim() || null, previousEventHash };
  const event = deepFreeze({ schema: EVENT_SCHEMA, ...body, eventHash: crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex'), contentRecorded: false, operationalAuthority: false, mutationAuthority: false });
  return deepFreeze({ ...audit, events: [...audit.events, event] });
}

module.exports = Object.freeze({ AUDIT_SCHEMA, EVENT_SCHEMA, EVENT_KINDS, MAX_EVENTS, createGovernedWorkspaceAudit, appendGovernedWorkspaceAuditEvent });
