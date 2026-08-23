#!/usr/bin/env node
'use strict';

const http =
  require('node:http');

const https =
  require('node:https');

function validateEndpoint(
  value
) {
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
      'Administrative metrics require HTTPS except for loopback.'
    );
  }

  return url;
}

function requestMetrics(
  {
    endpoint,
    token,
    timeoutMs = 2000
  }
) {
  if (
    typeof token !== 'string' ||
    token.length < 32
  ) {
    return Promise.reject(
      new Error(
        'Administrative telemetry token is required.'
      )
    );
  }

  const url =
    validateEndpoint(endpoint);

  const transport =
    url.protocol === 'https:'
      ? https
      : http;

  return new Promise(
    (resolve, reject) => {
      const request =
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
              'GET',

            headers: {
              authorization:
                `Bearer ${token}`,

              accept:
                'application/json'
            }
          },
          (response) => {
            const chunks =
              [];

            response.on(
              'data',
              (chunk) => {
                chunks.push(chunk);
              }
            );

            response.on(
              'end',
              () => {
                if (
                  response.statusCode !==
                  200
                ) {
                  reject(
                    new Error(
                      'Administrative metrics request was denied.'
                    )
                  );

                  return;
                }

                try {
                  resolve(
                    JSON.parse(
                      Buffer
                        .concat(chunks)
                        .toString('utf8')
                    )
                  );
                } catch {
                  reject(
                    new Error(
                      'Administrative metrics response is malformed.'
                    )
                  );
                }
              }
            );
          }
        );

      request.setTimeout(
        timeoutMs,
        () => {
          request.destroy(
            new Error(
              'Administrative metrics request timed out.'
            )
          );
        }
      );

      request.on(
        'error',
        reject
      );

      request.end();
    }
  );
}

function sortedEntries(
  value
) {
  return Object.entries(
    value || {}
  ).sort(
    (a, b) =>
      b[1] - a[1] ||
      a[0].localeCompare(b[0])
  );
}

function section(
  title,
  values
) {
  const entries =
    sortedEntries(values);

  if (!entries.length) {
    return `${title}\n  none\n`;
  }

  return (
    `${title}\n` +
    entries
      .map(
        ([key, count]) =>
          `  ${key.padEnd(20)} ${count}`
      )
      .join('\n') +
    '\n'
  );
}

function formatMetrics(
  metrics
) {
  return (
`Surgical DevOps Adoption

Total installations        ${metrics.installations.total}
Active 24h                 ${metrics.installations.active24h}
Active 7d                  ${metrics.installations.active7d}
Active 30d                 ${metrics.installations.active30d}
Sessions                   ${metrics.sessions}

${section(
  'Interaction modes',
  metrics.interactionModes
)}
${section(
  'Platforms',
  metrics.platforms
)}
${section(
  'Versions',
  metrics.versions
)}
Generated at: ${metrics.generatedAt}
`
  );
}

async function main(
  argv =
    process.argv.slice(2),
  environment =
    process.env
) {
  if (
    argv.includes('--help')
  ) {
    process.stdout.write(
`Usage:
  surgical-metrics
  surgical-metrics --json

Environment:
  SDO_TELEMETRY_ADMIN_ENDPOINT
  SDO_TELEMETRY_ADMIN_TOKEN
`
    );

    return;
  }

  const endpoint =
    environment
      .SDO_TELEMETRY_ADMIN_ENDPOINT ||
    'http://127.0.0.1:8787/v1/admin/metrics';

  const metrics =
    await requestMetrics({
      endpoint,

      token:
        environment
          .SDO_TELEMETRY_ADMIN_TOKEN
    });

  if (
    argv.includes('--json')
  ) {
    process.stdout.write(
      JSON.stringify(
        metrics,
        null,
        2
      ) + '\n'
    );

    return;
  }

  process.stdout.write(
    formatMetrics(metrics)
  );
}

if (require.main === module) {
  main().catch(() => {
    process.stderr.write(
      'Unable to read private Surgical telemetry metrics.\n'
    );

    process.exitCode =
      1;
  });
}

module.exports = {
  requestMetrics,
  formatMetrics,
  main
};
