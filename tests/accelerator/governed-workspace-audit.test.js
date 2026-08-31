'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { createGovernedWorkspaceAudit, appendGovernedWorkspaceAuditEvent, MAX_EVENTS } = require('../../accelerator/core/governed-workspace-audit');

const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');

test('workspace audit creates an immutable hash-chained attributable record', () => {
  const first = createGovernedWorkspaceAudit({ sessionFingerprint: sha('session'), physicalWorkspaceIdentity: sha('workspace') });
  const second = appendGovernedWorkspaceAuditEvent(first, { kind: 'SESSION_BOUND', observedAt: '2026-08-30T12:00:00.000Z', operationFingerprint: sha('bind'), outcome: 'BOUND' });
  const third = appendGovernedWorkspaceAuditEvent(second, { kind: 'EVIDENCE_READ', observedAt: '2026-08-30T12:00:01.000Z', operationFingerprint: sha('read'), outcome: 'REDACTED', target: 'config/example.txt' });
  assert.equal(third.events.length, 2);
  assert.equal(third.events[1].previousEventHash, third.events[0].eventHash);
  assert.equal(third.contentTelemetry, false);
  assert.equal(first.events.length, 0);
  assert.ok(Object.isFrozen(third.events[1]));
});

test('content telemetry unknown events and malformed bindings fail closed', () => {
  const audit = createGovernedWorkspaceAudit({ sessionFingerprint: sha('session'), physicalWorkspaceIdentity: sha('workspace') });
  const base = { observedAt: '2026-08-30T12:00:00.000Z', operationFingerprint: sha('op'), outcome: 'OK' };
  assert.throws(() => appendGovernedWorkspaceAuditEvent(audit, { ...base, kind: 'UNKNOWN' }), /not qualified/);
  assert.throws(() => appendGovernedWorkspaceAuditEvent(audit, { ...base, kind: 'DISCOVERY', content: 'secret' }), /content telemetry/);
});

test('audit event ceiling fails closed without dropping history', () => {
  let audit = createGovernedWorkspaceAudit({ sessionFingerprint: sha('session'), physicalWorkspaceIdentity: sha('workspace') });
  for (let index = 0; index < MAX_EVENTS; index += 1) {
    audit = appendGovernedWorkspaceAuditEvent(audit, { kind: 'DISCOVERY', observedAt: new Date(Date.parse('2026-08-30T12:00:00.000Z') + index).toISOString(), operationFingerprint: sha(`op-${index}`), outcome: 'OK' });
  }
  assert.throws(() => appendGovernedWorkspaceAuditEvent(audit, { kind: 'DISCOVERY', observedAt: '2026-08-30T13:00:00.000Z', operationFingerprint: sha('overflow'), outcome: 'OK' }), /ceiling/);
  assert.equal(audit.events.length, MAX_EVENTS);
});
