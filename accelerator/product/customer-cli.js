'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline/promises');

const { PRODUCT_VERSION } = require('./customer-configuration');
const {
  V1_DIGEST, V2_DIGEST, initializeCustomerState, inspectCustomerState,
  doctorCustomerState, createSupportBundle,
  backupCustomerState, restoreCustomerState, uninstallCustomerRuntime,
  runCustomerDemo, listEvidence, defaultCustomerStateRoot, configureCustomerProvider,
} = require('./customer-runtime');
const {
  startCustomerRuntime, stopCustomerRuntime, restartCustomerRuntime, probeCustomerRuntime,
  openCustomerRepository,
} = require('./customer-lifecycle');

const COMMANDS = new Set([
  'init', 'start', 'stop', 'restart', 'status', 'doctor', 'open', 'configure',
  'evidence', 'recovery', 'version', 'demo', 'backup', 'restore', 'upgrade', 'uninstall',
]);

function option(argv, name, fallback = null) {
  const indexes = argv.flatMap((value, index) => value === name ? [index] : []);
  if (indexes.length > 1) throw new Error(`${name} cannot be repeated`);
  if (indexes.length === 0) return fallback;
  const value = argv[indexes[0] + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function optionalOption(argv, name, fallback) {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  const next = argv[index + 1];
  return next && !next.startsWith('--') ? next : fallback;
}

function output(value, json, stream) {
  if (json) stream.write(`${JSON.stringify(value)}\n`);
  else stream.write(`${Object.entries(value).map(([key, child]) => `${key}: ${typeof child === 'object' ? JSON.stringify(child) : child}`).join('\n')}\n`);
}

function stateRoot(argv) {
  return path.resolve(option(argv, '--state-root', defaultCustomerStateRoot()));
}

async function exactDemoApproval(input, stdout) {
  if (!input.isTTY || !stdout.isTTY) {
    throw new Error('Demo requires an interactive exact approval or --approve-exact-demo');
  }
  const before = crypto.createHash('sha256').update('const governed = false;\n').digest('hex');
  const after = crypto.createHash('sha256').update('const governed = true;\n').digest('hex');
  stdout.write(
    'Surgical needs authority for an isolated disposable demo.\n' +
    'Operation: mutation.applyConditional (ONE SHOT)\n' +
    'Target: demo.js inside a new temporary Git repository\n' +
    `Before SHA256: ${before}\nAfter SHA256: ${after}\n` +
    'Does NOT authorize: real repositories, push, merge, release, deployment, or shell.\n'
  );
  const interface_ = readline.createInterface({ input, output: stdout });
  try {
    const answer = await interface_.question('Approve this exact disposable demo? [y/N] ');
    return /^(?:y|yes)$/i.test(answer.trim());
  } finally {
    interface_.close();
  }
}

async function runCustomerCommand(argv, { stdout = process.stdout, stdin = process.stdin } = {}) {
  const command = argv[0];
  if (!COMMANDS.has(command)) return false;
  const json = argv.includes('--json');
  const root = stateRoot(argv);
  let result;
  if (command === 'init') {
    result = initializeCustomerState({ stateRoot: root, profile: option(argv, '--profile', 'developer') });
  } else if (command === 'start') {
    result = await startCustomerRuntime({ stateRoot: root });
  } else if (command === 'stop') {
    result = await stopCustomerRuntime({ stateRoot: root });
  } else if (command === 'restart') {
    result = await restartCustomerRuntime({ stateRoot: root });
  } else if (command === 'status') {
    const inspected = inspectCustomerState({ stateRoot: root });
    result = { ...inspected, ...(await probeCustomerRuntime({ stateRoot: root })) };
  } else if (command === 'doctor') {
    result = doctorCustomerState({ stateRoot: root });
    if (argv.includes('--bundle')) {
      const bundle = createSupportBundle({ stateRoot: root });
      const target = optionalOption(argv, '--bundle', path.join(root, 'backups', 'support-bundle.json'));
      fs.writeFileSync(target, `${JSON.stringify(bundle, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      result = { ...result, supportBundle: target };
    }
  } else if (command === 'open') {
    if (!argv[1] || argv[1].startsWith('--')) throw new Error('open requires a repository path');
    result = await openCustomerRepository({ stateRoot: root, repositoryPath: path.resolve(argv[1]) });
  } else if (command === 'configure') {
    if (argv[1] !== 'provider') throw new Error('configure supports only the provider boundary');
    result = configureCustomerProvider({
      stateRoot: root,
      kind: option(argv, '--kind'),
      endpoint: option(argv, '--endpoint'),
      credentialReference: option(argv, '--credential-reference'),
      networkAllowed: argv.includes('--allow-network'),
    });
  } else if (command === 'evidence') {
    result = listEvidence({ stateRoot: root });
  } else if (command === 'recovery') {
    const state = inspectCustomerState({ stateRoot: root });
    result = { classification: state.runtime.status === 'RECOVERY_REQUIRED' ? 'RECOVERY_REQUIRED' : 'NO_RECOVERY_REQUIRED', authorityConsumed: false };
  } else if (command === 'version') {
    result = {
      product: `Surgical AI Control Plane ${PRODUCT_VERSION}`,
      controlPlaneComponent: '0.1.0-beta.1',
      surgicalDevOpsRuntime: '2.6.0-rc.6',
      platform: process.platform,
      protocols: {
        v1: { version: 'sacp.sdo-local/v1', digest: V1_DIGEST },
        v2: { version: 'sacp.sdo-local/v2', digest: V2_DIGEST },
        v3: false,
      },
    };
  } else if (command === 'demo') {
    const approved = argv.includes('--approve-exact-demo') || await exactDemoApproval(stdin, stdout);
    result = runCustomerDemo({ stateRoot: root, approved });
  } else if (command === 'backup') {
    if (!argv[1] || argv[1].startsWith('--')) throw new Error('backup requires an output path');
    result = backupCustomerState({ stateRoot: root, outputPath: path.resolve(argv[1]) });
  } else if (command === 'restore') {
    if (!argv[1] || argv[1].startsWith('--')) throw new Error('restore requires a backup path');
    result = restoreCustomerState({ stateRoot: root, backupPath: path.resolve(argv[1]) });
  } else if (command === 'upgrade') {
    const status = await probeCustomerRuntime({ stateRoot: root });
    if (status.runtimeStatus !== 'STOPPED') throw new Error('Upgrade is blocked while runtime is active or requires recovery; stop it first');
    result = argv.includes('--apply')
      ? (() => { throw new Error('No signed upgrade artifact was supplied; automatic upgrade is unavailable'); })()
      : { classification: 'UPGRADE_CHECK_GREEN', currentVersion: PRODUCT_VERSION, migrationRequired: false };
  } else if (command === 'uninstall') {
    result = uninstallCustomerRuntime({ stateRoot: root, purgeData: argv.includes('--purge-data') });
  }
  output(result, json, stdout);
  return true;
}

module.exports = Object.freeze({ COMMANDS, runCustomerCommand });
