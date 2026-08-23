'use strict';

const crypto =
  require('node:crypto');

const fs =
  require('node:fs');

const os =
  require('node:os');

const path =
  require('node:path');

const SCHEMA =
  'sdo.telemetry_installation_identity.v1';

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

function isUuid(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value)
  );
}

function isTimestamp(value) {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value))
  );
}

function telemetryStateRoot(
  {
    environment = process.env,
    platform = process.platform,
    home = os.homedir()
  } = {}
) {
  if (
    environment.SDO_TELEMETRY_STATE_ROOT
  ) {
    const configured =
      path.resolve(
        environment.SDO_TELEMETRY_STATE_ROOT
      );

    if (
      !path.isAbsolute(configured)
    ) {
      throw new Error(
        'Telemetry state root must be absolute.'
      );
    }

    return configured;
  }

  if (platform === 'win32') {
    const base =
      environment.LOCALAPPDATA;

    if (!base) {
      throw new Error(
        'LOCALAPPDATA is required for telemetry state.'
      );
    }

    return path.join(
      base,
      'SurgicalDevOps',
      'telemetry'
    );
  }

  if (platform === 'darwin') {
    return path.join(
      home,
      'Library',
      'Application Support',
      'SurgicalDevOps',
      'telemetry'
    );
  }

  const base =
    environment.XDG_STATE_HOME ||
    path.join(
      home,
      '.local',
      'state'
    );

  return path.join(
    base,
    'surgical-devops',
    'telemetry'
  );
}

function validateIdentity(identity) {
  if (
    !identity ||
    typeof identity !== 'object' ||
    Array.isArray(identity)
  ) {
    throw new Error(
      'Telemetry installation identity is malformed.'
    );
  }

  const keys =
    Object.keys(identity).sort();

  if (
    JSON.stringify(keys) !==
    JSON.stringify([
      'createdAt',
      'installationId',
      'schema'
    ])
  ) {
    throw new Error(
      'Telemetry installation identity has forbidden fields.'
    );
  }

  if (
    identity.schema !== SCHEMA ||
    !isUuid(identity.installationId) ||
    !isTimestamp(identity.createdAt)
  ) {
    throw new Error(
      'Telemetry installation identity is invalid.'
    );
  }

  return deepFreeze({
    schema:
      SCHEMA,

    installationId:
      identity.installationId,

    createdAt:
      identity.createdAt
  });
}

function readIdentity(file) {
  return validateIdentity(
    JSON.parse(
      fs.readFileSync(
        file,
        'utf8'
      )
    )
  );
}

function loadOrCreateInstallationIdentity(
  options = {}
) {
  const root =
    telemetryStateRoot(options);

  fs.mkdirSync(
    root,
    {
      recursive: true,
      mode: 0o700
    }
  );

  const stat =
    fs.lstatSync(root);

  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink()
  ) {
    throw new Error(
      'Telemetry state root is unsafe.'
    );
  }

  const file =
    path.join(
      root,
      'installation.json'
    );

  if (fs.existsSync(file)) {
    const existing =
      fs.lstatSync(file);

    if (
      !existing.isFile() ||
      existing.isSymbolicLink()
    ) {
      throw new Error(
        'Telemetry installation identity file is unsafe.'
      );
    }

    return readIdentity(file);
  }

  const identity =
    validateIdentity({
      schema:
        SCHEMA,

      installationId:
        crypto.randomUUID(),

      createdAt:
        new Date().toISOString()
    });

  const temporary =
    path.join(
      root,
      `.installation-${process.pid}-${crypto.randomUUID()}.tmp`
    );

  fs.writeFileSync(
    temporary,
    JSON.stringify(identity, null, 2) + '\n',
    {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx'
    }
  );

  try {
    fs.renameSync(
      temporary,
      file
    );
  } catch (error) {
    try {
      fs.unlinkSync(temporary);
    } catch {}

    if (fs.existsSync(file)) {
      return readIdentity(file);
    }

    throw error;
  }

  return readIdentity(file);
}

module.exports = {
  telemetryStateRoot,
  validateIdentity,
  loadOrCreateInstallationIdentity
};
