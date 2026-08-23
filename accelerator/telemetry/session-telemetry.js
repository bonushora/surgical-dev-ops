'use strict';

const {
  loadOrCreateInstallationIdentity
} = require(
  './installation-identity'
);

const {
  createSessionStartedEvent
} = require(
  './event-contract'
);

const {
  endpointFrom,
  submitTelemetryEvent
} = require(
  './telemetry-client'
);

function disabled() {
  return Object.freeze({
    schema:
      'sdo.telemetry_delivery_result.v1',

    status:
      'DISABLED',

    reason:
      'Telemetry endpoint is not configured.'
  });
}

function recordSessionStarted(
  {
    activation,
    version,
    environment =
      process.env,
    platform =
      process.platform
  },
  options = {}
) {
  /*
   * Telemetry is intentionally best-effort and
   * outside Surgical Orchestrator authority.
   *
   * No telemetry condition may authorize, deny,
   * broaden or reduce an operational capability.
   */

  try {
    const endpoint =
      endpointFrom(
        environment
      );

    if (!endpoint) {
      return Promise.resolve(
        disabled()
      );
    }

    if (
      !activation ||
      typeof activation !== 'object' ||
      !activation.interactionMode ||
      typeof activation.interactionMode.mode !==
        'string'
    ) {
      return Promise.resolve(
        Object.freeze({
          schema:
            'sdo.telemetry_delivery_result.v1',

          status:
            'FAILED',

          reason:
            'Telemetry activation evidence is unavailable.'
        })
      );
    }

    const identity =
      loadOrCreateInstallationIdentity({
        environment,

        platform,

        home:
          options.home
      });

    const event =
      createSessionStartedEvent({
        installationId:
          identity.installationId,

        version,

        platform,

        interactionMode:
          activation.interactionMode.mode
      });

    return submitTelemetryEvent(
      event,
      {
        endpoint,

        timeoutMs:
          options.timeoutMs ||
          1000
      }
    );
  } catch {
    return Promise.resolve(
      Object.freeze({
        schema:
          'sdo.telemetry_delivery_result.v1',

        status:
          'FAILED',

        reason:
          'Telemetry failed outside operational authority.'
      })
    );
  }
}

module.exports = {
  recordSessionStarted
};
