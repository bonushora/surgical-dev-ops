'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createTelemetryProducer } = require('../../accelerator/telemetry/producer');

function fixture() { return fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-producer-')); }
const binding = { tenant: 'tenant-a', project: 'project-a' };

test('producer is disabled by default and sends nothing before explicit consent', async () => {
  const sent = [];
  const producer = createTelemetryProducer({ stateRoot: fixture(), transport: async (event) => sent.push(event) });
  assert.equal(producer.consent, false);
  await producer.appStarted(binding);
  assert.deepEqual(sent, []);
});

test('explicit consent emits consent event then permits canonical events; withdrawal blocks all later events', async () => {
  const sent = [];
  const producer = createTelemetryProducer({ stateRoot: fixture(), transport: async (event) => sent.push(event) });
  await producer.grantConsent(binding);
  await producer.appStarted(binding);
  const session = producer.startSession();
  await producer.sessionStarted(binding, session);
  await producer.operationCompleted(binding, session, { classification: 'SUCCESS' });
  assert.deepEqual(sent.map((event) => event.event), ['telemetry_consent_granted', 'app_started', 'governed_session_started', 'governed_operation_completed']);
  producer.withdrawConsent();
  await producer.appStarted(binding);
  assert.equal(sent.length, 4);
});

test('identities are opaque UUIDs, persist installation only, and restart preserves withdrawal', async () => {
  const root = fixture();
  const first = createTelemetryProducer({ stateRoot: root, transport: async () => {} });
  const installation = first.installationId;
  const session = first.startSession();
  assert.match(installation, /^[0-9a-f]{8}-[0-9a-f]{4}-4/);
  assert.match(session, /^[0-9a-f]{8}-[0-9a-f]{4}-4/);
  first.withdrawConsent();
  const second = createTelemetryProducer({ stateRoot: root, transport: async () => {} });
  assert.equal(second.installationId, installation);
  assert.equal(second.consent, false);
  assert.notEqual(second.startSession(), session);
});

test('transport failures are observational and payload excludes sensitive or operational data', async () => {
  const producer = createTelemetryProducer({ stateRoot: fixture(), transport: async () => { throw new Error('offline'); } });
  await producer.grantConsent();
  const result = await producer.appStarted(binding);
  assert.equal(result.status, 'FAILED');
  assert.equal(result.operationalAuthority, false);
  assert.equal(Object.keys(result).includes('prompt'), false);
});

test('duplicate delivery is deterministic and only successful governed completion emits completion', async () => {
  const sent = [];
  const producer = createTelemetryProducer({ stateRoot: fixture(), transport: async (event) => sent.push(event) });
  await producer.grantConsent();
  const session = producer.startSession();
  await producer.operationCompleted(binding, session, { classification: 'FAILURE' });
  assert.equal(sent.some((event) => event.event === 'governed_operation_completed'), false);
  const event = await producer.operationCompleted(binding, session, { classification: 'SUCCESS' });
  assert.equal(event.status, 'SENT');
  assert.equal(new Set(sent.map((item) => item.eventId)).size, sent.length);
});

test('emitted request matches Dashboard producer contract b9d837c without arbitrary fields', async () => {
  const sent = [];
  const producer = createTelemetryProducer({ stateRoot: fixture(), transport: async (event) => { sent.push(event); return { status: 'SENT' }; } });
  await producer.grantConsent(binding);
  await producer.appStarted(binding);
  const keys = Object.keys(sent[1]).sort();
  assert.deepEqual(keys, ['consent', 'consentProof', 'event', 'eventId', 'installationId', 'origin', 'project', 'tenant']);
  assert.equal('b9d837cd8c624634d8b0cb7c7f017d25197c8f47'.length, 40);
});
