'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createGitPlatformIsolation
} = require('../../accelerator/adapters/git-read-adapter');

test('Git platform isolation factory is exposed', () => {
  assert.equal(
    typeof createGitPlatformIsolation,
    'function'
  );
});

test('Linux uses POSIX null-device isolation', () => {
  const isolation =
    createGitPlatformIsolation('linux');

  assert.equal(isolation.platform, 'linux');
  assert.equal(isolation.nullDevice, '/dev/null');

  assert.ok(
    isolation.fixedConfig.includes(
      'core.hooksPath=/dev/null'
    )
  );

  assert.equal(
    isolation.environment.GIT_CONFIG_GLOBAL,
    '/dev/null'
  );

  assert.equal(
    isolation.environment.GIT_CONFIG_SYSTEM,
    '/dev/null'
  );
});

test('macOS uses POSIX null-device isolation', () => {
  const isolation =
    createGitPlatformIsolation('darwin');

  assert.equal(isolation.platform, 'darwin');
  assert.equal(isolation.nullDevice, '/dev/null');

  assert.ok(
    isolation.fixedConfig.includes(
      'core.hooksPath=/dev/null'
    )
  );

  assert.equal(
    isolation.environment.GIT_CONFIG_GLOBAL,
    '/dev/null'
  );

  assert.equal(
    isolation.environment.GIT_CONFIG_SYSTEM,
    '/dev/null'
  );
});

test('Windows uses native NUL isolation without POSIX null device', () => {
  const isolation =
    createGitPlatformIsolation('win32');

  assert.equal(isolation.platform, 'win32');
  assert.equal(isolation.nullDevice, 'NUL');

  assert.ok(
    isolation.fixedConfig.includes(
      'core.hooksPath=NUL'
    )
  );

  assert.equal(
    isolation.environment.GIT_CONFIG_GLOBAL,
    'NUL'
  );

  assert.equal(
    isolation.environment.GIT_CONFIG_SYSTEM,
    'NUL'
  );

  assert.equal(
    isolation.fixedConfig.some(
      (value) => value.includes('/dev/null')
    ),
    false
  );

  assert.equal(
    Object.values(isolation.environment).some(
      (value) =>
        typeof value === 'string' &&
        value.includes('/dev/null')
    ),
    false
  );
});

test('platform isolation remains deeply immutable', () => {
  const isolation =
    createGitPlatformIsolation('win32');

  assert.ok(Object.isFrozen(isolation));
  assert.ok(Object.isFrozen(isolation.fixedConfig));
  assert.ok(Object.isFrozen(isolation.environment));

  assert.throws(
    () => {
      isolation.nullDevice = '/dev/null';
    },
    TypeError
  );

  assert.throws(
    () => {
      isolation.environment.GIT_CONFIG_GLOBAL =
        '/dev/null';
    },
    TypeError
  );
});

test('unknown platform fails closed', () => {
  assert.throws(
    () => createGitPlatformIsolation('unknown-os'),
    /unsupported.*platform|platform.*unsupported/i
  );
});

test('platform isolation does not introduce shell execution authority', () => {
  const {
    fixedConfig,
    environment
  } = createGitPlatformIsolation('win32');

  const text =
    JSON.stringify({
      fixedConfig,
      environment
    });

  assert.doesNotMatch(
    text,
    /cmd\.exe|powershell|pwsh|bash|\/bin\/sh/i
  );
});
