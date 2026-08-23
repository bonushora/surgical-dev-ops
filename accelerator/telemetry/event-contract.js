'use strict';

const crypto =
  require('node:crypto');

const EVENT_SCHEMA =
  'sdo.telemetry_event.v1';

const EVENT_TYPES =
  Object.freeze([
    'SESSION_STARTED'
  ]);

const MODES =
  new Set([
    'NATURAL',
    'ENGINEER',
    'EXPERT'
  ]);

function deepFreeze(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function uuid(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value)
  );
}

function timestamp(value) {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value))
  );
}

function boundedText(
  value,
  label,
  maximum = 64
) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > maximum ||
    /[\r\n\0]/.test(value)
  ) {
    throw new Error(
      `${label} is malformed.`
    );
  }

  return value;
}

function validateTelemetryEvent(event) {
  if (
    !event ||
    typeof event !== 'object' ||
    Array.isArray(event)
  ) {
    throw new Error(
      'Telemetry event is malformed.'
    );
  }

  const allowed =
    [
      'eventId',
      'eventType',
      'installationId',
      'interactionMode',
      'occurredAt',
      'platform',
      'schema',
      'sessionId',
      'version'
    ].sort();

  const actual =
    Object.keys(event).sort();

  if (
    JSON.stringify(actual) !==
    JSON.stringify(allowed)
  ) {
    throw new Error(
      'Telemetry event contains forbidden fields.'
    );
  }

  if (
    event.schema !== EVENT_SCHEMA ||
    !EVENT_TYPES.includes(event.eventType) ||
    !uuid(event.eventId) ||
    !uuid(event.sessionId) ||
    !uuid(event.installationId) ||
    !timestamp(event.occurredAt) ||
    !MODES.has(event.interactionMode)
  ) {
    throw new Error(
      'Telemetry event contract is invalid.'
    );
  }

  const version =
    boundedText(
      event.version,
      'Telemetry version',
      32
    );

  const platform =
    boundedText(
      event.platform,
      'Telemetry platform',
      32
    );

  return deepFreeze({
    schema:
      EVENT_SCHEMA,

    eventId:
      event.eventId,

    eventType:
      event.eventType,

    installationId:
      event.installationId,

    sessionId:
      event.sessionId,

    occurredAt:
      event.occurredAt,

    version,

    platform,

    interactionMode:
      event.interactionMode
  });
}

function createSessionStartedEvent(
  {
    installationId,
    version,
    platform = process.platform,
    interactionMode,
    occurredAt =
      new Date().toISOString(),
    eventId =
      crypto.randomUUID(),
    sessionId =
      crypto.randomUUID()
  }
) {
  return validateTelemetryEvent({
    schema:
      EVENT_SCHEMA,

    eventId,

    eventType:
      'SESSION_STARTED',

    installationId,

    sessionId,

    occurredAt,

    version,

    platform,

    interactionMode
  });
}

module.exports = {
  EVENT_TYPES,
  validateTelemetryEvent,
  createSessionStartedEvent
};
