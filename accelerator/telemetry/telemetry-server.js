'use strict';

const crypto =
  require('node:crypto');

const http =
  require('node:http');

const {
  validateTelemetryEvent
} = require(
  './event-contract'
);

const {
  createTelemetryStore
} = require(
  './telemetry-store'
);

const MAX_BODY_BYTES =
  16384;

function constantTimeEqual(
  left,
  right
) {
  if (
    typeof left !== 'string' ||
    typeof right !== 'string'
  ) {
    return false;
  }

  const a =
    Buffer.from(left);

  const b =
    Buffer.from(right);

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    a,
    b
  );
}

function json(
  response,
  status,
  value
) {
  const body =
    Buffer.from(
      JSON.stringify(value),
      'utf8'
    );

  response.writeHead(
    status,
    {
      'content-type':
        'application/json',

      'content-length':
        String(body.length),

      'cache-control':
        'no-store'
    }
  );

  response.end(body);
}

function body(
  request
) {
  return new Promise(
    (resolve, reject) => {
      const chunks =
        [];

      let size =
        0;

      request.on(
        'data',
        (chunk) => {
          size +=
            chunk.length;

          if (
            size >
            MAX_BODY_BYTES
          ) {
            reject(
              new Error(
                'Telemetry request body is too large.'
              )
            );

            request.destroy();
            return;
          }

          chunks.push(chunk);
        }
      );

      request.on(
        'end',
        () => {
          resolve(
            Buffer
              .concat(chunks)
              .toString('utf8')
          );
        }
      );

      request.on(
        'error',
        reject
      );
    }
  );
}

function createTelemetryServer(
  {
    storageRoot,
    adminToken
  }
) {
  if (
    typeof adminToken !== 'string' ||
    adminToken.length < 32
  ) {
    throw new Error(
      'Telemetry administrative token must contain at least 32 characters.'
    );
  }

  const store =
    createTelemetryStore({
      storageRoot
    });

  return http.createServer(
    async (
      request,
      response
    ) => {
      try {
        if (
          request.method === 'POST' &&
          request.url ===
            '/v1/telemetry/events'
        ) {
          if (
            !/^application\/json(?:;|$)/i.test(
              String(
                request.headers[
                  'content-type'
                ] || ''
              )
            )
          ) {
            json(
              response,
              415,
              {
                accepted:
                  false
              }
            );

            return;
          }

          const input =
            JSON.parse(
              await body(request)
            );

          const event =
            validateTelemetryEvent(
              input
            );

          store.append(event);

          json(
            response,
            202,
            {
              accepted:
                true
            }
          );

          return;
        }

        if (
          request.method === 'GET' &&
          request.url ===
            '/v1/admin/metrics'
        ) {
          const authorization =
            String(
              request.headers.authorization ||
              ''
            );

          const expected =
            `Bearer ${adminToken}`;

          if (
            !constantTimeEqual(
              authorization,
              expected
            )
          ) {
            json(
              response,
              401,
              {
                error:
                  'unauthorized'
              }
            );

            return;
          }

          json(
            response,
            200,
            store.metrics()
          );

          return;
        }

        json(
          response,
          404,
          {
            error:
              'not_found'
          }
        );
      } catch {
        if (
          !response.headersSent
        ) {
          json(
            response,
            400,
            {
              accepted:
                false
            }
          );
        } else {
          response.end();
        }
      }
    }
  );
}

module.exports = {
  createTelemetryServer
};
