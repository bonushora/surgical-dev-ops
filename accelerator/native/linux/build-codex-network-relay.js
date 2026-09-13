'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

if (process.platform === 'linux') {
  const directory = __dirname;
  const source = path.join(directory, 'sdo-codex-network-relay.c');
  const output = path.join(directory, 'sdo-codex-network-relay');
  const result = childProcess.spawnSync('/usr/bin/cc', [
    '-std=c11',
    '-O2',
    '-Wall',
    '-Wextra',
    '-Werror',
    source,
    '-o',
    output,
  ], {
    shell: false,
    stdio: 'inherit',
    env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' },
  });
  if (result.error || result.signal || result.status !== 0) {
    process.stderr.write('Codex provider relay build failed closed.\n');
    process.exitCode = 1;
  } else {
    fs.chmodSync(output, 0o500);
  }
}
