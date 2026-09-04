'use strict';

const http =
  require('node:http');

const https =
  require('node:https');

function result(
  status,
  reason = null
) {
  return Object.freeze({
    status,
    reason,
    operationalAuthority:
      false
  });
}

function endpointOf(
  value
) {
  let url;

  try {
    url =
      new URL(
        value
      );
  } catch {
    throw new TypeError(
      'telemetry producer endpoint is invalid'
    );
  }

  const loopback =
    new Set([
      '127.0.0.1',
      'localhost',
      '::1',
      '[::1]'
    ]);

  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      loopback.has(
        url.hostname
      )
    )
  ) {
    throw new Error(
      'Telemetry producer transport requires HTTPS except for loopback.'
    );
  }

  if (
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new Error(
      'Telemetry producer endpoint contains forbidden credential material.'
    );
  }

  return url;
}

function producerCredential(
  value
) {
  if (
    typeof value !== 'string' ||
    value.trim() === ''
  ) {
    throw new TypeError(
      'explicit producer credential required'
    );
  }

  return value;
}

function timeoutOf(
  value
) {
  if (
    !Number.isInteger(value) ||
    value < 100 ||
    value > 10000
  ) {
    throw new TypeError(
      'telemetry producer timeout is invalid'
    );
  }

  return value;
}

function createTelemetryProducerHttpTransport({
  endpoint,
  producerToken,
  timeoutMs = 1000,
  request
} = {}) {
  const url =
    endpointOf(
      endpoint
    );

  const credential =
    producerCredential(
      producerToken
    );

  const timeout =
    timeoutOf(
      timeoutMs
    );

  const requester =
    typeof request === 'function'
      ? request
      : (
          url.protocol === 'https:'
            ? https.request
            : http.request
        );

  async function transport(
    event
  ) {
    if (
      !event ||
      typeof event !== 'object' ||
      Array.isArray(event)
    ) {
      return result(
        'FAILED',
        'Telemetry event was rejected locally.'
      );
    }

    let body;

    try {
      body =
        Buffer.from(
          JSON.stringify(event),
          'utf8'
        );
    } catch {
      return result(
        'FAILED',
        'Telemetry event could not be serialized.'
      );
    }

    return new Promise(
      (resolve) => {
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

        let outgoing;

        try {
          outgoing =
            requester(
              {
                protocol:
                  url.protocol,

                hostname:
                  url.hostname,

                port:
                  url.port ||
                  undefined,

                path:
                  `${url.pathname}${url.search}`,

                method:
                  'POST',

                headers: {
                  authorization:
                    `Bearer ${credential}`,

                  'content-type':
                    'application/json',

                  'content-length':
                    String(
                      body.length
                    ),

                  'user-agent':
                    'surgical-dev-ops-telemetry/1'
                }
              },

              (response) => {
                if (
                  response &&
                  typeof response.resume ===
                    'function'
                ) {
                  response.resume();
                }

                if (
                  !response ||
                  typeof response.on !==
                    'function'
                ) {
                  finish(
                    'FAILED',
                    'Telemetry endpoint returned an invalid response.'
                  );

                  return;
                }

                response.on(
                  'end',
                  () => {
                    const statusCode =
                      response.statusCode;

                    if (
                      Number.isInteger(
                        statusCode
                      ) &&
                      statusCode >= 200 &&
                      statusCode < 300
                    ) {
                      finish(
                        'SENT'
                      );

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

        if (
          !outgoing ||
          typeof outgoing.end !==
            'function' ||
          typeof outgoing.on !==
            'function' ||
          typeof outgoing.setTimeout !==
            'function'
        ) {
          finish(
            'FAILED',
            'Telemetry transport initialization failed.'
          );

          return;
        }

        outgoing.setTimeout(
          timeout,
          () => {
            if (
              typeof outgoing.destroy ===
                'function'
            ) {
              outgoing.destroy();
            }

            finish(
              'FAILED',
              'Telemetry transport timed out.'
            );
          }
        );

        outgoing.on(
          'error',
          () => {
            finish(
              'FAILED',
              'Telemetry transport failed.'
            );
          }
        );

        try {
          outgoing.end(
            body
          );
        } catch {
          finish(
            'FAILED',
            'Telemetry transport failed.'
          );
        }
      }
    );
  }

  Object.defineProperty(
    transport,
    'operationalAuthority',
    {
      value:
        'NONE',

      enumerable:
        true
    }
  );

  return Object.freeze(
    transport
  );
}

module.exports = {
  createTelemetryProducerHttpTransport
};
