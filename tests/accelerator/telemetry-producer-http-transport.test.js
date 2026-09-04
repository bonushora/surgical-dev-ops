'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const {
  createTelemetryProducerHttpTransport
} = require(
  '../../accelerator/telemetry/producer-http-transport'
);

const EVENT =
  Object.freeze({
    tenant:
      'local',

    project:
      'local',

    consent:
      true,

    consentProof:
      Object.freeze({
        state:
          'GRANTED',

        transition:
          'EXPLICIT_LOCAL_CONSENT'
      }),

    event:
      'app_started',

    origin:
      'surgical',

    eventId:
      '11111111-1111-4111-8111-111111111111',

    installationId:
      '22222222-2222-4222-8222-222222222222'
  });

function fakeRequestHarness({
  statusCode = 202,
  requestError = null,
  timeout = false
} = {}) {
  const observations =
    [];

  function request(
    options,
    callback
  ) {
    const listeners =
      new Map();

    const requestObject = {
      setTimeout(
        milliseconds,
        handler
      ) {
        observations.push({
          type:
            'timeout-configured',
          milliseconds
        });

        if (timeout) {
          queueMicrotask(handler);
        }
      },

      on(
        name,
        handler
      ) {
        listeners.set(
          name,
          handler
        );

        if (
          name === 'error' &&
          requestError
        ) {
          queueMicrotask(
            () =>
              handler(
                requestError
              )
          );
        }

        return requestObject;
      },

      destroy() {
        observations.push({
          type:
            'destroy'
        });
      },

      end(body) {
        observations.push({
          type:
            'request',
          options,
          body:
            Buffer.from(body)
        });

        if (
          requestError ||
          timeout
        ) {
          return;
        }

        const response = {
          statusCode,

          resume() {},

          on(
            name,
            handler
          ) {
            if (name === 'end') {
              queueMicrotask(
                handler
              );
            }
          }
        };

        queueMicrotask(
          () =>
            callback(
              response
            )
        );
      }
    };

    return requestObject;
  }

  return {
    request,
    observations
  };
}

test(
  'canonical producer HTTP transport sends exact event with producer bearer',
  async () => {
    const harness =
      fakeRequestHarness();

    const transport =
      createTelemetryProducerHttpTransport({
        endpoint:
          'https://dashboard.example.test/api/telemetry/v1/events',

        producerToken:
          'producer-secret-token-value',

        request:
          harness.request
      });

    const result =
      await transport(
        EVENT
      );

    assert.equal(
      result.status,
      'SENT'
    );

    assert.equal(
      result.operationalAuthority,
      false
    );

    const observation =
      harness.observations.find(
        (item) =>
          item.type ===
          'request'
      );

    assert.ok(
      observation
    );

    assert.equal(
      observation.options.protocol,
      'https:'
    );

    assert.equal(
      observation.options.hostname,
      'dashboard.example.test'
    );

    assert.equal(
      observation.options.path,
      '/api/telemetry/v1/events'
    );

    assert.equal(
      observation.options.method,
      'POST'
    );

    assert.equal(
      observation.options.headers.authorization,
      'Bearer producer-secret-token-value'
    );

    assert.equal(
      observation.options.headers[
        'content-type'
      ],
      'application/json'
    );

    assert.deepEqual(
      JSON.parse(
        observation.body.toString(
          'utf8'
        )
      ),
      EVENT
    );
  }
);

test(
  'producer credential is transport metadata and never enters telemetry event',
  async () => {
    const harness =
      fakeRequestHarness();

    const secret =
      'producer-secret-token-value';

    const transport =
      createTelemetryProducerHttpTransport({
        endpoint:
          'https://dashboard.example.test/api/telemetry/v1/events',

        producerToken:
          secret,

        request:
          harness.request
      });

    await transport(
      EVENT
    );

    const observation =
      harness.observations.find(
        (item) =>
          item.type ===
          'request'
      );

    const body =
      observation.body.toString(
        'utf8'
      );

    assert.equal(
      body.includes(secret),
      false
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        EVENT,
        'token'
      ),
      false
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        EVENT,
        'credential'
      ),
      false
    );
  }
);

test(
  'HTTPS is required except explicit loopback HTTP',
  () => {
    assert.throws(
      () =>
        createTelemetryProducerHttpTransport({
          endpoint:
            'http://example.com/api/telemetry/v1/events',

          producerToken:
            'producer-secret-token-value',

          request() {}
        }),
      /HTTPS/i
    );

    assert.doesNotThrow(
      () =>
        createTelemetryProducerHttpTransport({
          endpoint:
            'http://127.0.0.1:9999/api/telemetry/v1/events',

          producerToken:
            'producer-secret-token-value',

          request() {}
        })
    );
  }
);

test(
  'endpoint rejects embedded credentials fragments and malformed URLs',
  () => {
    for (
      const endpoint of [
        'https://user:pass@example.com/api/telemetry/v1/events',
        'https://example.com/api/telemetry/v1/events#secret',
        'not-a-url'
      ]
    ) {
      assert.throws(
        () =>
          createTelemetryProducerHttpTransport({
            endpoint,
            producerToken:
              'producer-secret-token-value',

            request() {}
          })
      );
    }
  }
);

test(
  'producer token must be explicit nonblank and is never exposed by transport surface',
  () => {
    for (
      const producerToken of [
        undefined,
        null,
        '',
        '   '
      ]
    ) {
      assert.throws(
        () =>
          createTelemetryProducerHttpTransport({
            endpoint:
              'https://dashboard.example.test/api/telemetry/v1/events',

            producerToken,

            request() {}
          }),
        /producer credential/i
      );
    }

    const transport =
      createTelemetryProducerHttpTransport({
        endpoint:
          'https://dashboard.example.test/api/telemetry/v1/events',

        producerToken:
          'producer-secret-token-value',

        request() {}
      });

    assert.equal(
      transport.producerToken,
      undefined
    );

    assert.equal(
      transport.token,
      undefined
    );

    assert.equal(
      transport.credential,
      undefined
    );

    assert.equal(
      transport.operationalAuthority,
      'NONE'
    );
  }
);

test(
  'non-2xx response is observational failure without secret disclosure',
  async () => {
    const harness =
      fakeRequestHarness({
        statusCode:
          403
      });

    const secret =
      'producer-secret-token-value';

    const transport =
      createTelemetryProducerHttpTransport({
        endpoint:
          'https://dashboard.example.test/api/telemetry/v1/events',

        producerToken:
          secret,

        request:
          harness.request
      });

    const result =
      await transport(
        EVENT
      );

    assert.equal(
      result.status,
      'FAILED'
    );

    assert.equal(
      result.operationalAuthority,
      false
    );

    assert.equal(
      JSON.stringify(result)
        .includes(secret),
      false
    );
  }
);

test(
  'network error and timeout remain bounded observational failures',
  async () => {
    for (
      const harness of [
        fakeRequestHarness({
          requestError:
            new Error(
              'private-network-detail'
            )
        }),

        fakeRequestHarness({
          timeout:
            true
        })
      ]
    ) {
      const transport =
        createTelemetryProducerHttpTransport({
          endpoint:
            'https://dashboard.example.test/api/telemetry/v1/events',

          producerToken:
            'producer-secret-token-value',

          timeoutMs:
            200,

          request:
            harness.request
        });

      const result =
        await transport(
          EVENT
        );

      assert.equal(
        result.status,
        'FAILED'
      );

      assert.equal(
        result.operationalAuthority,
        false
      );

      assert.equal(
        JSON.stringify(result)
          .includes(
            'private-network-detail'
          ),
        false
      );
    }
  }
);

test(
  'transport carries no command mutation approval or authorization authority',
  () => {
    const transport =
      createTelemetryProducerHttpTransport({
        endpoint:
          'https://dashboard.example.test/api/telemetry/v1/events',

        producerToken:
          'producer-secret-token-value',

        request() {}
      });

    for (
      const capability of [
        'execute',
        'mutate',
        'dispatch',
        'approve',
        'authorize',
        'release',
        'deploy'
      ]
    ) {
      assert.equal(
        transport[capability],
        undefined
      );
    }

    assert.equal(
      transport.operationalAuthority,
      'NONE'
    );
  }
);
