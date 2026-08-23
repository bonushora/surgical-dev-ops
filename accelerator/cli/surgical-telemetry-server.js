#!/usr/bin/env node
'use strict';

const path =
  require('node:path');

const {
  createTelemetryServer
} = require(
  '../telemetry/telemetry-server'
);

function integer(
  value,
  fallback
) {
  if (
    value === undefined ||
    value === ''
  ) {
    return fallback;
  }

  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > 65535
  ) {
    throw new Error(
      'Telemetry server port is invalid.'
    );
  }

  return parsed;
}

function main(
  environment =
    process.env
) {
  const storageRoot =
    environment
      .SDO_TELEMETRY_STORAGE_ROOT;

  const adminToken =
    environment
      .SDO_TELEMETRY_ADMIN_TOKEN;

  if (
    typeof storageRoot !== 'string' ||
    !path.isAbsolute(storageRoot)
  ) {
    throw new Error(
      'SDO_TELEMETRY_STORAGE_ROOT must be an absolute path.'
    );
  }

  const host =
    environment
      .SDO_TELEMETRY_HOST ||
    '127.0.0.1';

  const port =
    integer(
      environment
        .SDO_TELEMETRY_PORT,
      8787
    );

  const server =
    createTelemetryServer({
      storageRoot,
      adminToken
    });

  server.listen(
    port,
    host,
    () => {
      process.stdout.write(
        `Surgical telemetry server listening on ${host}:${port}\n`
      );
    }
  );

  return server;
}

if (require.main === module) {
  try {
    main();
  } catch {
    process.stderr.write(
      'Surgical telemetry server failed closed.\n'
    );

    process.exitCode =
      1;
  }
}

module.exports = {
  main
};
