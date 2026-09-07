'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const {
  createLinuxCodexCognitiveLaunchSpec
} = require('./linux-bwrap-sandbox-adapter');
const {
  createMacosCodexCognitiveLaunchSpec
} = require('./macos-seatbelt-sandbox-adapter');
const {
  createWindowsCodexCognitiveLaunchSpec
} = require('./windows-node-test-sandbox-adapter');

const TARGETS = Object.freeze({
  'linux:x64': Object.freeze({
    triple: 'x86_64-unknown-linux-musl',
    packageName: '@openai/codex-linux-x64',
    binary: 'codex'
  }),
  'linux:arm64': Object.freeze({
    triple: 'aarch64-unknown-linux-musl',
    packageName: '@openai/codex-linux-arm64',
    binary: 'codex'
  }),
  'darwin:x64': Object.freeze({
    triple: 'x86_64-apple-darwin',
    packageName: '@openai/codex-darwin-x64',
    binary: 'codex'
  }),
  'darwin:arm64': Object.freeze({
    triple: 'aarch64-apple-darwin',
    packageName: '@openai/codex-darwin-arm64',
    binary: 'codex'
  }),
  'win32:x64': Object.freeze({
    triple: 'x86_64-pc-windows-msvc',
    packageName: '@openai/codex-win32-x64',
    binary: 'codex.exe'
  }),
  'win32:arm64': Object.freeze({
    triple: 'aarch64-pc-windows-msvc',
    packageName: '@openai/codex-win32-arm64',
    binary: 'codex.exe'
  })
});

const NATIVE_FACTORIES = Object.freeze({
  linux: createLinuxCodexCognitiveLaunchSpec,
  darwin: createMacosCodexCognitiveLaunchSpec,
  win32: createWindowsCodexCognitiveLaunchSpec
});

function unavailable(reason) {
  const error = new Error(`CODEX_CONTAINMENT_UNAVAILABLE: ${reason}`);
  error.code = 'CODEX_CONTAINMENT_UNAVAILABLE';
  return error;
}

function cleanupFailure() {
  const error = new Error(
    'CODEX_CONTAINMENT_CLEANUP_FAILED: cognitive containment cleanup failed closed.'
  );
  error.code = 'CODEX_CONTAINMENT_CLEANUP_FAILED';
  return error;
}

function resolveCodexExecutable(platform = process.platform, arch = process.arch) {
  const target = TARGETS[`${platform}:${arch}`];
  if (!target) throw unavailable(`unsupported platform ${platform}/${arch}.`);
  try {
    const codexPackage = require.resolve('@openai/codex/package.json');
    const codexRequire = createRequire(codexPackage);
    const platformPackage = codexRequire.resolve(`${target.packageName}/package.json`);
    const executable = fs.realpathSync(path.join(
      path.dirname(platformPackage), 'vendor', target.triple, 'bin', target.binary
    ));
    if (!fs.statSync(executable).isFile()) throw new Error('not a file');
    return executable;
  } catch {
    throw unavailable(`qualified Codex executable is absent for ${platform}/${arch}.`);
  }
}

function secureDirectory(parent, name) {
  const directory = path.join(parent, name);
  fs.mkdirSync(directory, { mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  return fs.realpathSync(directory);
}

function stageExecutable(controlRoot, executable, platform) {
  const staged = path.join(controlRoot, platform === 'win32'
    ? 'codex-runtime.exe'
    : 'codex-runtime');
  try {
    fs.linkSync(executable, staged);
  } catch {
    fs.copyFileSync(executable, staged, fs.constants.COPYFILE_FICLONE);
    fs.chmodSync(staged, 0o500);
  }
  if (!fs.statSync(staged).isFile()) {
    throw unavailable('Codex executable staging failed qualification.');
  }
  return fs.realpathSync(staged);
}

function launcherSource(spec) {
  const configuration = JSON.stringify({
    nativeLauncher: spec.nativeLauncher,
    nativeArguments: spec.nativeArguments,
    executable: spec.executable,
    executableFdToken: spec.executableFdToken || null
  });
  return [
    `#!${process.execPath}`,
    "'use strict';",
    "const fs = require('node:fs');",
    "const { spawn } = require('node:child_process');",
    `const configuration = Object.freeze(${configuration});`,
    "const forwardedEnvironment = {};",
    "for (const key of ['CODEX_API_KEY', 'CODEX_INTERNAL_ORIGINATOR_OVERRIDE', 'LANG']) {",
    "  if (typeof process.env[key] === 'string') forwardedEnvironment[key] = process.env[key];",
    '}',
    'let executableDescriptor = null;',
    'const stdio = [\'inherit\', \'inherit\', \'inherit\'];',
    'let arguments_ = [...configuration.nativeArguments];',
    'if (configuration.executableFdToken) {',
    "  executableDescriptor = fs.openSync(configuration.executable, 'r');",
    '  stdio.push(executableDescriptor);',
    '  arguments_ = arguments_.map((value) =>',
    "    value === configuration.executableFdToken ? '/proc/self/fd/3' : value);",
    '}',
    'arguments_.push(...process.argv.slice(2));',
    'const child = spawn(configuration.nativeLauncher, arguments_, {',
    '  shell: false, stdio, windowsHide: true, env: forwardedEnvironment',
    '});',
    'if (executableDescriptor !== null) fs.closeSync(executableDescriptor);',
    'let failed = false;',
    "child.once('error', () => {",
    '  failed = true;',
    "  process.stderr.write('CODEX_CONTAINMENT_LAUNCH_FAILED\\n');",
    '  process.exitCode = 127;',
    '});',
    "for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {",
    '  process.on(signal, () => {',
    '    if (!child.killed) child.kill(signal);',
    '  });',
    '}',
    "child.once('exit', (code, signal) => {",
    '  if (failed) return;',
    '  if (signal) process.kill(process.pid, signal);',
    '  else process.exit(code === null ? 1 : code);',
    '});',
    ''
  ].join('\n');
}

function createCodexCognitiveContainment({
  platform = process.platform,
  arch = process.arch,
  codexExecutable = null,
  codexExecutableArguments = [],
  runtimeBindings = [],
  nativeFactories = NATIVE_FACTORIES,
  registerSignalHandlers = true,
  now = () => new Date().toISOString()
} = {}) {
  const nativeFactory = nativeFactories[platform];
  if (typeof nativeFactory !== 'function') {
    throw unavailable(`no native adapter exists for ${platform}.`);
  }
  const executable = codexExecutable || resolveCodexExecutable(platform, arch);
  const sessionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-codex-cognitive-'));
  fs.chmodSync(sessionRoot, 0o700);
  const controlRoot = secureDirectory(sessionRoot, 'control');
  const cognitiveRoot = secureDirectory(sessionRoot, 'cognitive');
  secureDirectory(cognitiveRoot, 'workspace');
  secureDirectory(cognitiveRoot, 'home');
  secureDirectory(cognitiveRoot, 'tmp');

  let disposed = false;
  const signalHandlers = new Map();
  let exitHandler = null;

  function detachHandlers() {
    if (exitHandler) process.removeListener('exit', exitHandler);
    for (const [signal, handler] of signalHandlers) {
      process.removeListener(signal, handler);
    }
    exitHandler = null;
    signalHandlers.clear();
  }

  function dispose() {
    if (disposed) return;
    detachHandlers();
    try {
      fs.rmSync(sessionRoot, { recursive: true, force: true });
    } catch {
      throw cleanupFailure();
    }
    if (fs.existsSync(sessionRoot)) throw cleanupFailure();
    disposed = true;
  }

  try {
    const stagedExecutable = stageExecutable(controlRoot, executable, platform);
    const spec = nativeFactory({
      cognitiveRoot,
      codexExecutable: stagedExecutable,
      codexExecutableArguments,
      runtimeBindings,
      observedAt: now()
    });
    if (!spec || spec.schema !== 'sdo.codex_cognitive_launch_spec.v1' ||
        spec.platform !== platform || typeof spec.nativeLauncher !== 'string' ||
        !Array.isArray(spec.nativeArguments) || typeof spec.sdkWorkingDirectory !== 'string' ||
        !spec.attestation || spec.attestation.decision !== 'ENFORCED') {
      throw unavailable(`native adapter for ${platform} returned no qualified launch spec.`);
    }
    const launcherPath = path.join(controlRoot, platform === 'win32'
      ? 'codex-contained-launcher.cmd'
      : 'codex-contained-launcher');
    fs.writeFileSync(launcherPath, launcherSource(spec), { mode: 0o700, flag: 'wx' });
    fs.chmodSync(launcherPath, 0o700);

    if (registerSignalHandlers) {
      exitHandler = () => {
        if (disposed) return;
        try { dispose(); } catch { process.exitCode = 1; }
      };
      process.once('exit', exitHandler);
      for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
        const handler = () => {
          try { dispose(); } catch { process.exitCode = 1; }
          process.removeListener(signal, handler);
          process.kill(process.pid, signal);
        };
        signalHandlers.set(signal, handler);
        process.once(signal, handler);
      }
    }

    return Object.freeze({
      schema: 'sdo.codex_cognitive_containment.v1',
      state: 'ENFORCED',
      platform,
      launcherPath,
      sdkWorkingDirectory: spec.sdkWorkingDirectory,
      sessionRoot,
      cognitiveRoot,
      attestation: spec.attestation,
      dispose,
      isDisposed: () => disposed
    });
  } catch (error) {
    try { dispose(); } catch { throw cleanupFailure(); }
    if (error && error.code === 'CODEX_CONTAINMENT_UNAVAILABLE') throw error;
    const failure = unavailable(`native containment failed qualification on ${platform}.`);
    Object.defineProperty(failure, 'cause', { value: error });
    throw failure;
  }
}

module.exports = Object.freeze({
  createCodexCognitiveContainment,
  resolveCodexExecutable
});
