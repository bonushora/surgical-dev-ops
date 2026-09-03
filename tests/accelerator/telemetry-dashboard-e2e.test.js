'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createTelemetryProducer } = require('../../accelerator/telemetry/producer');
const { createLocalDashboardTransport } = require('./telemetry-dashboard-e2e-adapter');
const dashboardIngestion = require('/home/usuario/Desenvolvimento/bonushora/surgical-dashboard/src/telemetry-ingestion');
const { createDashboardApi } = require('/home/usuario/Desenvolvimento/bonushora/surgical-dashboard/src/api');

const binding = { tenant: 'tenant-a', project: 'project-a' };
const root = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-dashboard-e2e-'));

function harness(transportOverride) {
  const storage = dashboardIngestion.createMemoryStorage();
  const endpoint = dashboardIngestion.createIngestionEndpoint({
    storage,
    authenticate: (request) => request.token === 'producer' ? { role: 'producer' } : null,
    authorize: (principal, request) => principal.role === 'producer' && request.tenant === binding.tenant && request.project === binding.project
  });
  const transport = transportOverride || createLocalDashboardTransport({ endpoint, token: 'producer' });
  const producer = createTelemetryProducer({ stateRoot: root(), transport });
  const api = createDashboardApi({ storage, authenticate: (request) => request.token === 'admin' ? { role: 'admin' } : null, authorize: (principal, request) => principal.role === 'admin' && request.tenant === binding.tenant && request.project === binding.project });
  return { producer, storage, endpoint, api };
}

test('local cross-repository path enforces consent, lifecycle, metrics and withdrawal', async () => {
  const { producer, storage, api } = harness();
  await producer.appStarted(binding);
  assert.equal(storage.size, 0);
  await producer.grantConsent(binding);
  await producer.appStarted(binding);
  const session = producer.startSession();
  await producer.sessionStarted(binding, session);
  await producer.operationCompleted(binding, session, { classification: 'SUCCESS' });
  const metrics = api.getMetrics({ ...binding, token: 'admin' });
  assert.equal(metrics.totalAcceptedEvents, 4);
  assert.equal(metrics.uniqueConsentingObservedInstallations, 1);
  assert.equal(metrics.uniqueObservedSessions, 1);
  assert.equal(metrics.repeatObservedLaunches, 0);
  producer.withdrawConsent();
  await producer.appStarted(binding);
  await producer.sessionStarted(binding, producer.startSession());
  assert.equal(storage.size, 4);
  assert.equal(metrics.readOnly, true);
  assert.equal(metrics.operationalAuthority, 'NONE');
});

test('dashboard deduplicates repeated eventId and rejects malformed or cross-tenant requests', async () => {
  const { producer, endpoint, storage } = harness();
  await producer.grantConsent(binding);
  const payload = { ...binding, consent: true, consentProof: { state: 'GRANTED', transition: 'EXPLICIT_LOCAL_CONSENT' }, event: 'app_started', origin: 'surgical', eventId: producer.installationId, installationId: producer.installationId };
  const first = endpoint.ingest({ token: 'producer', ...payload });
  const second = endpoint.ingest({ token: 'producer', ...payload });
  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  assert.equal(storage.size, 2);
  assert.equal(endpoint.ingest({ token: 'producer', ...payload, tenant: 'tenant-b' }).reason, 'UNAUTHORIZED');
  assert.equal(endpoint.ingest({ token: 'wrong', ...payload }).reason, 'UNAUTHORIZED');
  assert.equal(endpoint.ingest({ token: 'producer', ...payload, prompt: 'secret' }).accepted, false);
});

test('telemetry rejection and storage failure remain observational', async () => {
  const outcomes = ['rejected', 'failed'];
  for (const mode of outcomes) {
    const { producer } = harness(async () => mode === 'rejected' ? { accepted: false, reason: 'UNAUTHORIZED' } : (() => { throw new Error('offline'); })());
    await producer.grantConsent(binding);
    const result = await producer.appStarted(binding);
    assert.equal(result.operationalAuthority, false);
    assert.equal(producer.consent, true);
  }
});
