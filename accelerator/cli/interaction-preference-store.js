'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  normalizeInteractionMode
} = require('../core/interaction-mode');

const SCHEMA =
  'sdo.interaction_preference.v1';

const LANGUAGES =
  Object.freeze(['PT-BR', 'EN']);

function samePhysicalPath(left, right) {
  if (process.platform === 'win32') {
    return left.toLowerCase() === right.toLowerCase();
  }

  return left === right;
}

function normalizeLanguage(value) {
  const normalized =
    String(value || '').trim().toUpperCase();

  if (!LANGUAGES.includes(normalized)) {
    throw new Error(
      'Interaction preference language must be PT-BR or EN.'
    );
  }

  return normalized;
}

function defaultConfigurationBase(environment = process.env) {
  if (process.platform === 'win32') {
    return environment.LOCALAPPDATA || environment.APPDATA;
  }

  return environment.XDG_CONFIG_HOME ||
    path.join(os.homedir(), '.config');
}

function safeDirectory(directory, { create = false } = {}) {
  if (
    typeof directory !== 'string' ||
    !path.isAbsolute(directory) ||
    path.normalize(directory) !== directory
  ) {
    throw new Error(
      'Interaction preference directory must be canonical and absolute.'
    );
  }

  if (create && !fs.existsSync(directory)) {
    const parent = path.dirname(directory);
    const parentStat = fs.lstatSync(parent);

    if (
      !parentStat.isDirectory() ||
      parentStat.isSymbolicLink() ||
      !samePhysicalPath(
        fs.realpathSync(parent),
        parent
      )
    ) {
      throw new Error(
        'Interaction preference parent directory is unsafe.'
      );
    }

    fs.mkdirSync(directory, { mode: 0o700 });
  }

  const stat = fs.lstatSync(directory);

  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink()
  ) {
    throw new Error(
      'Interaction preference directory is unsafe or ambiguous.'
    );
  }

  return fs.realpathSync(directory);
}

function createInteractionPreferenceStore(options = {}) {
  const suppliedDirectory =
    options.configurationDirectory;

  function directory(create = false) {
    if (suppliedDirectory) {
      return safeDirectory(
        suppliedDirectory,
        { create: false }
      );
    }

    const basePath =
      defaultConfigurationBase(
        options.environment
      );

    if (!create && !fs.existsSync(basePath)) {
      return null;
    }

    const base =
      safeDirectory(
        basePath,
        { create }
      );

    const applicationDirectory =
      path.join(base, 'surgical-dev-ops');

    if (
      !create &&
      !fs.existsSync(applicationDirectory)
    ) {
      return null;
    }

    return safeDirectory(
      applicationDirectory,
      { create }
    );
  }

  function file(create = false) {
    const configurationDirectory =
      directory(create);

    if (!configurationDirectory) return null;

    return path.join(
      configurationDirectory,
      'interaction-preference.json'
    );
  }

  function validate(value) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      value.schema !== SCHEMA ||
      value.authority !== false ||
      value.operationalAuthority !== false ||
      value.mutationAuthority !== false
    ) {
      throw new Error(
        'Interaction preference is malformed or authority-bearing.'
      );
    }

    return Object.freeze({
      schema: SCHEMA,
      language: normalizeLanguage(value.language),
      interactionMode:
        normalizeInteractionMode(
          value.interactionMode
        ),
      authority: false,
      operationalAuthority: false,
      mutationAuthority: false
    });
  }

  function load() {
    const target = file(false);

    if (!target || !fs.existsSync(target)) return null;

    const stat = fs.lstatSync(target);

    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size > 8192
    ) {
      throw new Error(
        'Interaction preference file is unsafe.'
      );
    }

    return validate(
      JSON.parse(
        fs.readFileSync(target, 'utf8')
      )
    );
  }

  function save({ language, interactionMode } = {}) {
    const preference =
      validate({
        schema: SCHEMA,
        language,
        interactionMode,
        authority: false,
        operationalAuthority: false,
        mutationAuthority: false
      });

    const target = file(true);
    const temporary =
      `${target}.pending-${process.pid}`;
    const descriptor =
      fs.openSync(temporary, 'wx', 0o600);

    try {
      fs.writeFileSync(
        descriptor,
        JSON.stringify(preference, null, 2) + '\n',
        'utf8'
      );
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }

    fs.renameSync(temporary, target);

    if (process.platform !== 'win32') {
      const parent =
        fs.openSync(
          directory(true),
          fs.constants.O_RDONLY
        );

      try {
        fs.fsyncSync(parent);
      } finally {
        fs.closeSync(parent);
      }
    }

    return preference;
  }

  return Object.freeze({ load, save });
}

module.exports = Object.freeze({
  SCHEMA,
  LANGUAGES,
  normalizeLanguage,
  createInteractionPreferenceStore
});
