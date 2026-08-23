'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const http =
  require('node:http');

const os =
  require('node:os');

const path =
  require('node:path');

const {
  loadOrCreateInstallationIdentity
} = require(
  '../../accelerator/telemetry/installation-identity'
);

const {
  createSessionStartedEvent,
  validateTelemetryEvent
} = require(
  '../../accelerator/telemetry/event-contract'
);

const {
  submitTelemetryEvent
} = require(
  '../../accelerator/telemetry/telemetry-client'
);

const {
  createTelemetryStore
} = require(
  '../../accelerator/telemetry/telemetry-store'
);

const {
  createTelemetryServer
} = require(
  '../../accelerator/telemetry/telemetry-server'
);

const {
  requestMetrics,
  formatMetrics
} = require(
  '../../accelerator/cli/surgical-metrics'
);

function fixture() {
  return fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'sdo-telemetry-'
    )
  );
}

function event(
  installationId,
  overrides = {}
) {
  return createSessionStartedEvent({
    installationId,

    version:
      '2.5.0',

    platform:
      'linux',

    interactionMode:
      'ENGINEER',

    occurredAt:
      '2026-08-23T12:00:00.000Z',

    ...overrides
  });
}

test(
  'installation identity is persistent pseudonymous telemetry identity',
  () => {
    const root =
      fixture();

    try {
      const environment = {
        SDO_TELEMETRY_STATE_ROOT:
          root
      };

      const first =
        loadOrCreateInstallationIdentity({
          environment,
          platform:
            'linux',
          home:
            root
        });

      const second =
        loadOrCreateInstallationIdentity({
          environment,
          platform:
            'linux',
          home:
            root
        });

      assert.equal(
        first.installationId,
        second.installationId
      );

      assert.deepEqual(
        Object.keys(first).sort(),
        [
          'createdAt',
          'installationId',
          'schema'
        ]
      );

      assert.equal(
        'username' in first,
        false
      );

      assert.equal(
        'email' in first,
        false
      );

      assert.equal(
        'hostname' in first,
        false
      );
    } finally {
      fs.rmSync(
        root,
        {
          recursive: true,
          force: true
        }
      );
    }
  }
);

test(
  'telemetry event contract carries aggregate-safe metadata only',
  () => {
    const root =
      fixture();

    try {
      const identity =
        loadOrCreateInstallationIdentity({
          environment: {
            SDO_TELEMETRY_STATE_ROOT:
              root
          },

          platform:
            'linux',

          home:
            root
        });

      const value =
        event(
          identity.installationId
        );

      assert.equal(
        value.eventType,
        'SESSION_STARTED'
      );

      assert.equal(
        value.interactionMode,
        'ENGINEER'
      );

      for (
        const forbidden
        of [
          'prompt',
          'response',
          'sourceCode',
          'workspace',
          'repository',
          'file',
          'username',
          'email',
          'token',
          'credential'
        ]
      ) {
        assert.equal(
          forbidden in value,
          false
        );
      }

      assert.throws(
        () =>
          validateTelemetryEvent({
            ...value,
            prompt:
              'secret'
          }),
        /forbidden/i
      );
    } finally {
      fs.rmSync(
        root,
        {
          recursive: true,
          force: true
        }
      );
    }
  }
);

test(
  'telemetry failure is best-effort and never throws into operational caller',
  async () => {
    const root =
      fixture();

    try {
      const identity =
        loadOrCreateInstallationIdentity({
          environment: {
            SDO_TELEMETRY_STATE_ROOT:
              root
          },

          platform:
            'linux',

          home:
            root
        });

      const value =
        event(
          identity.installationId
        );

      const disabled =
        await submitTelemetryEvent(
          value,
          {
            endpoint:
              null
          }
        );

      assert.equal(
        disabled.status,
        'DISABLED'
      );

      const unavailable =
        await submitTelemetryEvent(
          value,
          {
            endpoint:
              'http://127.0.0.1:9/v1/telemetry/events',

            timeoutMs:
              200
          }
        );

      assert.equal(
        unavailable.status,
        'FAILED'
      );
    } finally {
      fs.rmSync(
        root,
        {
          recursive: true,
          force: true
        }
      );
    }
  }
);

test(
  'private store aggregates installations sessions modes platforms and versions',
  () => {
    const root =
      fixture();

    try {
      const store =
        createTelemetryStore({
          storageRoot:
            root
        });

      const a =
        '11111111-1111-4111-8111-111111111111';

      const b =
        '22222222-2222-4222-8222-222222222222';

      store.append(
        event(a)
      );

      store.append(
        event(
          a,
          {
            occurredAt:
              '2026-08-23T13:00:00.000Z',

            interactionMode:
              'EXPERT'
          }
        )
      );

      store.append(
        event(
          b,
          {
            occurredAt:
              '2026-08-22T13:00:00.000Z',

            interactionMode:
              'NATURAL',

            platform:
              'win32'
          }
        )
      );

      const metrics =
        store.metrics(
          new Date(
            '2026-08-23T14:00:00.000Z'
          )
        );

      assert.equal(
        metrics.installations.total,
        2
      );

      /*
       * Installation B last reported at 2026-08-22T13:00Z.
       * The metrics clock is 2026-08-23T14:00Z.
       * It is therefore 25 hours old and correctly falls
       * outside the rolling 24-hour active window.
       */
      assert.equal(
        metrics.installations.active24h,
        1
      );

      assert.equal(
        metrics.installations.active7d,
        2
      );

      assert.equal(
        metrics.installations.active30d,
        2
      );

      assert.equal(
        metrics.sessions,
        3
      );

      assert.equal(
        metrics.interactionModes.ENGINEER,
        1
      );

      assert.equal(
        metrics.interactionModes.EXPERT,
        1
      );

      assert.equal(
        metrics.interactionModes.NATURAL,
        1
      );

      assert.equal(
        metrics.platforms.linux,
        2
      );

      assert.equal(
        metrics.platforms.win32,
        1
      );

      assert.equal(
        metrics.versions['2.5.0'],
        3
      );
    } finally {
      fs.rmSync(
        root,
        {
          recursive: true,
          force: true
        }
      );
    }
  }
);

test(
  'ingestion and private administrative metrics form one bounded vertical slice',
  async () => {
    const root =
      fixture();

    const token =
      '0123456789abcdef0123456789abcdef';

    const server =
      createTelemetryServer({
        storageRoot:
          root,

        adminToken:
          token
      });

    try {
      await new Promise(
        (resolve) => {
          server.listen(
            0,
            '127.0.0.1',
            resolve
          );
        }
      );

      const address =
        server.address();

      const endpoint =
        `http://127.0.0.1:${address.port}/v1/telemetry/events`;

      const adminEndpoint =
        `http://127.0.0.1:${address.port}/v1/admin/metrics`;

      const identityRoot =
        path.join(
          root,
          'identity'
        );

      const identity =
        loadOrCreateInstallationIdentity({
          environment: {
            SDO_TELEMETRY_STATE_ROOT:
              identityRoot
          },

          platform:
            'linux',

          home:
            root
        });

      const delivery =
        await submitTelemetryEvent(
          event(
            identity.installationId
          ),
          {
            endpoint,
            timeoutMs:
              1000
          }
        );

      assert.equal(
        delivery.status,
        'SENT'
      );

      const metrics =
        await requestMetrics({
          endpoint:
            adminEndpoint,

          token,
          timeoutMs:
            1000
        });

      assert.equal(
        metrics.installations.total,
        1
      );

      assert.equal(
        metrics.sessions,
        1
      );

      const output =
        formatMetrics(metrics);

      assert.match(
        output,
        /Total installations\s+1/
      );

      assert.match(
        output,
        /Sessions\s+1/
      );

      await assert.rejects(
        requestMetrics({
          endpoint:
            adminEndpoint,

          token:
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',

          timeoutMs:
            1000
        }),
        /denied/i
      );
    } finally {
      await new Promise(
        (resolve) =>
          server.close(resolve)
      );

      fs.rmSync(
        root,
        {
          recursive: true,
          force: true
        }
      );
    }
  }
);

test(
  'telemetry production modules do not import the Surgical Orchestrator',
  () => {
    const files = [
      'installation-identity.js',
      'event-contract.js',
      'telemetry-client.js',
      'session-telemetry.js',
      'telemetry-store.js',
      'telemetry-server.js'
    ];

    for (const file of files) {
      const source =
        fs.readFileSync(
          path.join(
            __dirname,
            '../../accelerator/telemetry',
            file
          ),
          'utf8'
        );

      assert.doesNotMatch(
        source,
        /surgical-orchestrator/
      );
    }
  }
);
