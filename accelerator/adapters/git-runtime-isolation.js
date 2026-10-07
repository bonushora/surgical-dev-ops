'use strict';

const AUTHORITY_BEARING_ENVIRONMENT_KEYS = Object.freeze([
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CEILING_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_SSH',
  'GIT_SSH_COMMAND',
  'GIT_PROXY_COMMAND'
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function createGitPlatformIsolation(platform = process.platform) {
  if (!['linux', 'darwin', 'win32'].includes(platform)) {
    throw new Error(`Git platform is unsupported: ${platform}`);
  }

  const nullDevice = platform === 'win32' ? 'NUL' : '/dev/null';
  const fixedConfig = Object.freeze([
    '-c', 'credential.helper=',
    '-c', 'core.fsmonitor=',
    '-c', `core.hooksPath=${nullDevice}`,
    '-c', 'diff.external=',
    '-c', 'diff.trustExitCode=false',
    '-c', 'pager.status=false',
    '-c', 'pager.diff=false',
    '-c', 'pager.show=false'
  ]);
  const environment = Object.freeze({
    GIT_CONFIG_GLOBAL: nullDevice,
    GIT_CONFIG_SYSTEM: nullDevice
  });

  return deepFreeze({ platform, nullDevice, fixedConfig, environment });
}

function createGitRuntimeIsolation(platform = process.platform) {
  const isolation = createGitPlatformIsolation(platform);
  const environment = {
    PATH: platform === 'win32'
      ? 'C:\\Windows\\System32;C:\\Program Files\\Git\\cmd'
      : '/usr/local/bin:/usr/bin:/bin',
    LANG: 'C',
    LC_ALL: 'C',
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: isolation.environment.GIT_CONFIG_GLOBAL,
    GIT_CONFIG_SYSTEM: isolation.environment.GIT_CONFIG_SYSTEM,
    GIT_PAGER: 'cat',
    PAGER: 'cat',
    NO_PROXY: '*',
    no_proxy: '*'
  };

  return deepFreeze({
    platform,
    nullDevice: isolation.nullDevice,
    fixedConfig: isolation.fixedConfig,
    environment,
    clearedEnvironmentKeys: AUTHORITY_BEARING_ENVIRONMENT_KEYS
  });
}

module.exports = Object.freeze({
  AUTHORITY_BEARING_ENVIRONMENT_KEYS,
  createGitPlatformIsolation,
  createGitRuntimeIsolation
});
