'use strict';

const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const {
  createWindowsNativeDurabilityBridge
} = require('../../accelerator/adapters/windows-native-durability-bridge');

function outcome(run) {
  try {
    const value = run();
    return { ok: true, value: value === undefined ? null : value };
  } catch (error) {
    return {
      ok: false,
      code: error && error.code ? String(error.code) : null,
      message: error && error.message ? String(error.message) : String(error)
    };
  }
}

test('Windows native filesystem and Git primitives are observable without changing production semantics', (t) => {
  if (process.platform !== 'win32') {
    return t.skip('Windows-only native capability observation.');
  }

  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-win-native-probe-'));
  const file = path.join(base, 'probe.txt');
  fs.writeFileSync(file, 'probe\n');

  t.after(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  const fileFsync = outcome(() => {
    const fd = fs.openSync(file, fs.constants.O_RDWR);
    try {
      fs.fsyncSync(fd);
      return 'FSYNC_CONFIRMED';
    } finally {
      fs.closeSync(fd);
    }
  });

  const directoryFsync = outcome(() => {
    const fd = fs.openSync(base, fs.constants.O_RDONLY);
    try {
      fs.fsyncSync(fd);
      return 'DIRECTORY_FSYNC_CONFIRMED';
    } finally {
      fs.closeSync(fd);
    }
  });

  const gitRoot = outcome(() => childProcess.execFileSync(
    'git', ['rev-parse', '--show-toplevel'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }
  ).trim());

  const gitRootPhysical = gitRoot.ok
    ? outcome(() => fs.realpathSync(gitRoot.value))
    : { ok: false, code: 'NOT_ATTEMPTED', message: 'Git root unavailable.' };

  const nativeBridge = createWindowsNativeDurabilityBridge();
  const nativeDirectoryFlush = outcome(() => {
    if (!nativeBridge.available()) throw new Error('Windows native durability helper unavailable.');
    return nativeBridge.flushDirectory(base);
  });

  const evidence = {
    schema: 'sdo.windows_native_primitives_probe.v1',
    platform: process.platform,
    node: process.version,
    cwd: process.cwd(),
    cwdPhysical: outcome(() => fs.realpathSync(process.cwd())),
    tmpdir: os.tmpdir(),
    tmpdirPhysical: outcome(() => fs.realpathSync(os.tmpdir())),
    oNoFollow: typeof fs.constants.O_NOFOLLOW === 'number'
      ? fs.constants.O_NOFOLLOW : null,
    fileFsync,
    directoryFsync,
    nativeDirectoryFlush,
    gitRoot,
    gitRootPhysical,
    stackUsesBackslash: (new Error().stack || '').includes('\\')
  };

  console.log(`SDO_WINDOWS_NATIVE_PROBE ${JSON.stringify(evidence)}`);
});
