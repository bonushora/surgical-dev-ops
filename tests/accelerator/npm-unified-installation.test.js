'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

test('one npm installation exposes all three interaction experiences', () => {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdo-unified-install-')
  );
  const packOutput = JSON.parse(
    execFileSync(
      NPM,
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

  execFileSync(
    NPM,
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
        env: {
          ...process.env,
          XDG_CONFIG_HOME: temporary
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
