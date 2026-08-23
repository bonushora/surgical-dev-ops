'use strict';

const http =
  require('node:http');

const https =
  require('node:https');

const {
  validateTelemetryEvent
} = require(
  './event-contract'
);

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

function result(
  status,
  reason = null
) {
  return deepFreeze({
    schema:
      'sdo.telemetry_delivery_result.v1',

    status,

    reason
  });
}

function endpointFrom(
  environment = process.env
) {
  if (
    environment.SDO_TELEMETRY_DISABLED ===
      '1'
  ) {
    return null;
  }

  const endpoint =
    environment.SDO_TELEMETRY_ENDPOINT;

  if (
    typeof endpoint !== 'string' ||
    !endpoint.trim()
  ) {
    return null;
  }

  return endpoint.trim();
}

function validateEndpoint(value) {
  const url =
    new URL(value);

  const loopback =
    [
      '127.0.0.1',
      'localhost',
      '::1',
      '[::1]'
    ].includes(url.hostname);

  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      loopback
    )
  ) {
    throw new Error(
      'Telemetry transport requires HTTPS except for loopback.'
    );
  }

  if (
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new Error(
      'Telemetry endpoint contains forbidden authority material.'
    );
  }

  return url;
}

function submitTelemetryEvent(
  event,
  {
    endpoint =
      endpointFrom(),
    timeoutMs = 1000
  } = {}
) {
  if (!endpoint) {
    return Promise.resolve(
      result(
        'DISABLED',
        'Telemetry endpoint is not configured.'
      )
    );
  }

  let canonicalEvent;
  let url;

  try {
    canonicalEvent =
      validateTelemetryEvent(event);

    url =
      validateEndpoint(endpoint);
  } catch {
    return Promise.resolve(
      result(
        'FAILED',
        'Telemetry request was rejected locally.'
      )
    );
  }

  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 100 ||
    timeoutMs > 10000
  ) {
    return Promise.resolve(
      result(
        'FAILED',
        'Telemetry timeout configuration is invalid.'
      )
    );
  }

  const body =
    Buffer.from(
      JSON.stringify(canonicalEvent),
      'utf8'
    );

  const transport =
    url.protocol === 'https:'
      ? https
      : http;

  return new Promise((resolve) => {
    let settled =
      false;

    function finish(
      status,
      reason = null
    ) {
      if (settled) {
        return;
      }

      settled = true;

      resolve(
        result(
          status,
          reason
        )
      );
    }

    let request;

    try {
      request =
        transport.request(
          {
            protocol:
              url.protocol,

            hostname:
              url.hostname,

            port:
              url.port || undefined,

            path:
              `${url.pathname}${url.search}`,

            method:
              'POST',

            headers: {
              'content-type':
                'application/json',

              'content-length':
                String(body.length),

              'user-agent':
                'surgical-dev-ops-telemetry/1'
            }
          },
          (response) => {
            response.resume();

            response.on(
              'end',
              () => {
                if (
                  response.statusCode >= 200 &&
                  response.statusCode < 300
                ) {
                  finish('SENT');
                  return;
                }

                finish(
                  'FAILED',
                  'Telemetry endpoint rejected the event.'
                );
              }
            );
          }
        );
    } catch {
      finish(
        'FAILED',
        'Telemetry transport initialization failed.'
      );

      return;
    }

    request.setTimeout(
      timeoutMs,
      () => {
        request.destroy();

        finish(
          'FAILED',
          'Telemetry transport timed out.'
        );
      }
    );

    request.on(
      'error',
      () => {
        finish(
          'FAILED',
          'Telemetry transport failed.'
        );
      }
    );

    request.end(body);
  });
}

module.exports = {
  endpointFrom,
  validateEndpoint,
  submitTelemetryEvent
};
