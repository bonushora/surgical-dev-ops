'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const NPM_CLI = process.env.npm_execpath;
const NPM_COMMAND =
  process.platform === 'win32'
    ? 'npm.cmd'
    : 'npm';

function npm(arguments_, options) {
  if (typeof NPM_CLI === 'string' && NPM_CLI.length > 0) {
    return execFileSync(
      process.execPath,
      [NPM_CLI, ...arguments_],
      options
    );
  }

  return execFileSync(
    NPM_COMMAND,
    arguments_,
    {
      ...options,
      shell: process.platform === 'win32'
    }
  );
}

test('one npm installation exposes all three interaction experiences', () => {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdo-unified-install-')
  );
  const packOutput = JSON.parse(
    npm(
      [
        'pack',
        '--json',
        '--offline',
        '--pack-destination',
        temporary
      ],
      {
        cwd: ROOT,
        encoding: 'utf8'
      }
    )
  )[0];
  const tarball = path.join(
    temporary,
    packOutput.filename
  );
  const prefix = path.join(temporary, 'prefix');

  npm(
    [
      'install',
      '--global',
      '--ignore-scripts',
      '--offline',
      '--prefix',
      prefix,
      tarball
    ],
    {
      cwd: ROOT,
      encoding: 'utf8'
    }
  );

  const executable =
    process.platform === 'win32'
      ? path.join(prefix, 'surgical.cmd')
      : path.join(prefix, 'bin', 'surgical');

  assert.equal(fs.existsSync(executable), true);

  for (const mode of [
    'NATURAL',
    'ENGINEER',
    'EXPERT'
  ]) {
    const output = execFileSync(
      executable,
      ['--interaction', mode],
      {
        cwd: ROOT,
        input: '',
        encoding: 'utf8',
        shell: process.platform === 'win32',
        env: {
          ...process.env,
          XDG_CONFIG_HOME: temporary,
          LOCALAPPDATA: temporary,
          APPDATA: temporary
        }
      }
    );

    if (mode === 'EXPERT') {
      assert.match(output, /Interaction: EXPERT/);
    } else {
      assert.match(
        output,
        /Você pode conversar comigo normalmente/
      );
    }
  }
});
