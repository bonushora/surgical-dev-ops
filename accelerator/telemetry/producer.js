'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const IDENTIFIER = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENTS = new Set(['app_started', 'telemetry_consent_granted', 'governed_session_started', 'governed_operation_completed']);

function validBinding(value) { return typeof value === 'string' && IDENTIFIER.test(value); }
function validUuid(value) { return typeof value === 'string' && UUID.test(value); }
function result(status, reason = null) { return Object.freeze({ status, reason, operationalAuthority: false }); }

function createTelemetryProducer({ stateRoot, transport = async () => result('DISABLED', 'Telemetry transport is disabled.'), origin = 'surgical' } = {}) {
  if (typeof stateRoot !== 'string' || !path.isAbsolute(stateRoot)) throw new TypeError('telemetry state root must be absolute');
  if (typeof transport !== 'function' || typeof origin !== 'string' || !origin || origin.length > 32) throw new TypeError('telemetry producer contract is invalid');
  fs.mkdirSync(stateRoot, { recursive: true, mode: 0o700 });
  const identityFile = path.join(stateRoot, 'installation.json');
  const consentFile = path.join(stateRoot, 'consent.json');
  let installationId;
  let consent = false;
  try {
    if (fs.existsSync(identityFile)) installationId = JSON.parse(fs.readFileSync(identityFile, 'utf8')).installationId;
    if (!validUuid(installationId)) { installationId = crypto.randomUUID(); fs.writeFileSync(identityFile, JSON.stringify({ installationId }), { mode: 0o600 }); }
    if (fs.existsSync(consentFile)) consent = JSON.parse(fs.readFileSync(consentFile, 'utf8')).granted === true;
  } catch { consent = false; }

  function persistConsent() { fs.writeFileSync(consentFile, JSON.stringify({ schema: 'sdo.telemetry_consent.v1', granted: consent }), { mode: 0o600 }); }
  function bindingOf(binding) {
    if (!binding || !validBinding(binding.tenant) || !validBinding(binding.project)) throw new Error('telemetry binding is invalid');
    return { tenant: binding.tenant, project: binding.project };
  }
  async function emit(event, binding, sessionId) {
    if (!consent) return result('DISABLED', 'Consent is not granted.');
    if (!EVENTS.has(event)) return result('FAILED', 'Event is not canonical.');
    const bound = bindingOf(binding);
    if (sessionId !== undefined && !validUuid(sessionId)) return result('FAILED', 'Session identity is invalid.');
    const payload = Object.freeze({
      ...bound, consent: true, consentProof: Object.freeze({ state: 'GRANTED', transition: 'EXPLICIT_LOCAL_CONSENT' }),
      event, origin, eventId: crypto.randomUUID(), installationId, ...(sessionId ? { sessionId } : {})
    });
    try { const delivered = await Promise.race([Promise.resolve(transport(payload)), new Promise((resolve) => setTimeout(() => resolve(result('FAILED', 'Telemetry transport timed out.')), 1000))]); return delivered && delivered.status ? delivered : result('SENT'); }
    catch { return result('FAILED', 'Telemetry failed outside operational authority.'); }
  }
  return Object.freeze({
    get consent() { return consent; },
    get installationId() { return installationId; },
    grantConsent(binding = { tenant: 'local', project: 'local' }) { consent = true; persistConsent(); return emit('telemetry_consent_granted', binding); },
    withdrawConsent() { consent = false; persistConsent(); },
    startSession() { return crypto.randomUUID(); },
    appStarted(binding) { return emit('app_started', binding); },
    sessionStarted(binding, sessionId) { return emit('governed_session_started', binding, sessionId); },
    operationCompleted(binding, sessionId, outcome = {}) { return outcome.classification === 'SUCCESS' ? emit('governed_operation_completed', binding, sessionId) : Promise.resolve(result('DISABLED', 'Governed operation did not complete successfully.')); }
  });
}

module.exports = { createTelemetryProducer };
