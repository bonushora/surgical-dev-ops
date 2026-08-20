'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const { createOperationRecord } = require('../../accelerator/core/operation-record');

const TIME = '2026-08-20T12:00:00.000Z';
const WORKSPACE = fs.realpathSync(os.tmpdir());

function events(riskLevel = 'R0', operationId = 'op-1') {
  const result = [
    { type: 'intent', operationId, timestamp: TIME,
      objective: 'Record an authorized operation.' },
    { type: 'policy', operationId, timestamp: TIME,
      policyDecision: riskLevel === 'R3' ? 'APPROVAL_REQUIRED' : 'ALLOWED', riskLevel }
  ];
  if (riskLevel === 'R3') {
    result.push({ type: 'approval', operationId, timestamp: TIME,
      approverId: 'human-1', decision: 'APPROVED', approvalTimestamp: TIME });
  }
  result.push({ type: 'state', operationId, timestamp: TIME, status: 'RECORDED' });
  return result;
}

function input(overrides = {}) {
  return {
    operationId: 'op-1',
    requester: { id: 'requester-1', type: 'HUMAN' },
    workspace: WORKSPACE,
    objective: 'Record an authorized operation.',
    policyDecision: 'ALLOWED',
    riskLevel: 'R0',
    idempotency: 'IDEMPOTENT',
    events: events(),
    ...overrides
  };
}

function r3(overrides = {}) {
  return input({
    policyDecision: 'APPROVAL_REQUIRED',
    riskLevel: 'R3',
    approval: {
      operationId: 'op-1',
      approver: { id: 'human-1', type: 'HUMAN' },
      decision: 'APPROVED',
      timestamp: TIME
    },
    events: events('R3'),
    ...overrides
  });
}

test('valid R0 operation requires no approval', () => {
  const result = createOperationRecord(input());
  assert.equal(result.decision, 'ALLOWED');
  assert.equal(result.record.approval, null);
});

test('valid R3 operation binds explicit approval', () => {
  const result = createOperationRecord(r3());
  assert.equal(result.decision, 'ALLOWED');
  assert.equal(result.record.approval.operationId, 'op-1');
});

test('R3 without approval is denied', () => {
  assert.equal(createOperationRecord(r3({ approval: undefined })).decision, 'DENIED');
});

test('approval operationId mismatch is denied', () => {
  const approval = { ...r3().approval, operationId: 'op-other' };
  assert.equal(createOperationRecord(r3({ approval })).decision, 'DENIED');
});

test('missing approver identity is denied', () => {
  const approval = { ...r3().approval, approver: undefined };
  assert.equal(createOperationRecord(r3({ approval })).decision, 'DENIED');
});

test('non-human approver identity is denied', () => {
  const approval = { ...r3().approval, approver: { id: 'agent-1', type: 'AGENT' } };
  assert.equal(createOperationRecord(r3({ approval })).decision, 'DENIED');
});

test('malformed approval timestamp is denied', () => {
  const approval = { ...r3().approval, timestamp: 'not-a-time' };
  assert.equal(createOperationRecord(r3({ approval })).decision, 'DENIED');
});

test('approval cannot tamper with policy or risk', () => {
  const approval = { ...r3().approval, policyDecision: 'ALLOWED', riskLevel: 'R0' };
  assert.equal(createOperationRecord(r3({ approval })).decision, 'DENIED');
});

test('operation evaluation, record and nested events are immutable', () => {
  const result = createOperationRecord(input());
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.record));
  assert.ok(Object.isFrozen(result.record.events));
  assert.ok(Object.isFrozen(result.record.events[0]));
  assert.throws(() => { result.record.operationId = 'changed'; }, TypeError);
});

test('valid mandatory events retain deterministic order', () => {
  const result = createOperationRecord(input());
  assert.deepEqual(result.record.events.map((event) => event.type), ['intent', 'policy', 'state']);
});

test('missing mandatory event is denied', () => {
  assert.equal(createOperationRecord(input({ events: events().slice(0, 2) })).decision, 'DENIED');
});

test('duplicate mandatory event is denied', () => {
  const duplicated = [events()[0], events()[1], events()[1], events()[2]];
  assert.equal(createOperationRecord(input({ events: duplicated })).decision, 'DENIED');
});

test('out-of-order mandatory events are denied', () => {
  const unordered = [events()[1], events()[0], events()[2]];
  assert.equal(createOperationRecord(input({ events: unordered })).decision, 'DENIED');
});

test('chronologically out-of-order event timestamps are denied', () => {
  const unordered = events();
  unordered[1] = { ...unordered[1], timestamp: '2026-08-20T11:59:59.000Z' };
  assert.equal(createOperationRecord(input({ events: unordered })).decision, 'DENIED');
});
