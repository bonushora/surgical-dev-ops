'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  createNodeTestProfile
} = require('../../../accelerator/adapters/macos-seatbelt-sandbox-adapter');

const HELPER = path.resolve(
  __dirname, '../../../accelerator/native/macos/sdo-seatbelt-probe'
);
const TIMEOUT_MS = 10_000;
const MAX_OUTPUT_BYTES = 128 * 1024;

function bounded(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').slice(0, 256);
}

function observe(name, profile, workspace, target, node) {
  const result = childProcess.spawnSync(HELPER, [
    'macos-runtime-diagnostic',
    'a'.repeat(64),
    workspace,
    path.join(os.homedir(), '.ssh', 'id_rsa'),
    'node-test',
    profile,
    node,
    target
  ], {
    cwd: workspace,
    shell: false,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
    windowsHide: true,
    env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent' }
  });
  return {
    name,
    errorCode: result.error && result.error.code || null,
    signal: result.signal || null,
    status: Number.isInteger(result.status) ? result.status : null,
    stdout: bounded(result.stdout),
    stderr: bounded(result.stderr)
  };
}

if (process.platform !== 'darwin') {
  console.log('SDO_MACOS_SEATBELT_RUNTIME {"status":"NOT_DARWIN"}');
} else {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-macos-runtime-')));
  const workspace = path.join(root, 'workspace');
  const target = 'runtime.test.js';
  fs.mkdirSync(workspace);
  fs.writeFileSync(path.join(workspace, target), [
    "'use strict';",
    "const test = require('node:test');",
    "test('runtime reached JavaScript', () => {});",
    ''
  ].join('\n'));

  try {
    const node = fs.realpathSync(process.execPath);
    const baseline = createNodeTestProfile(workspace, node);
    const nodeRoot = path.dirname(path.dirname(node));
    const candidates = [
      ['baseline', ''],
      ['file-read', '(allow file-read*)'],
      ['file-read-data', '(allow file-read-data)'],
      ['file-read-xattr', '(allow file-read-xattr)'],
      ['node-install-root', `(allow file-read* (subpath ${JSON.stringify(nodeRoot)}))`],
      ['user-root', `(allow file-read* (subpath ${JSON.stringify(os.homedir())}))`],
      ['library-root', '(allow file-read* (subpath "/Library"))'],
      ['private-root', '(allow file-read* (subpath "/private"))'],
      ['usr-root', '(allow file-read* (subpath "/usr"))'],
      ['dev-root', '(allow file-read* (subpath "/dev"))'],
      ['opt-root', '(allow file-read* (subpath "/opt"))'],
      ['applications-root', '(allow file-read* (subpath "/Applications"))'],
      ['volumes-root', '(allow file-read* (subpath "/Volumes"))'],
      ['private-var-db', '(allow file-read* (subpath "/private/var/db"))'],
      ['private-var-folders', '(allow file-read* (subpath "/private/var/folders"))'],
      ['private-var-protected', '(allow file-read* (subpath "/private/var/protected"))'],
      ['private-preboot', '(allow file-read* (subpath "/private/preboot"))']
    ];
    const observations = candidates.map(([name, addition]) => observe(
      name,
      addition ? `${baseline}\n${addition}` : baseline,
      workspace,
      target,
      node
    ));
    console.log(`SDO_MACOS_SEATBELT_RUNTIME ${JSON.stringify({
      schema: 'sdo.macos_seatbelt_runtime_diagnostic.v1',
      status: 'OBSERVED',
      observations
    })}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
