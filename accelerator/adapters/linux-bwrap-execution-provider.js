'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');
const { digest } = require('../core/execution-isolation/runtime-profile');
const {
  isExecutionEnvelope
} = require('../core/execution-isolation/execution-envelope');

const REQUIRED_FLAGS = Object.freeze([
  '--unshare-user', '--unshare-pid', '--unshare-net', '--unshare-ipc', '--unshare-uts',
  '--new-session', '--die-with-parent', '--clearenv', '--ro-bind', '--bind', '--tmpfs'
]);
const RUNTIME_CANDIDATES = Object.freeze(['/usr', '/bin', '/lib', '/lib64']);
const INTERNAL_WORKSPACE = '/workspace';
const INTERNAL_RUNTIME = '/runtime';
const INTERNAL_AUTHORIZED_EXECUTABLE = `${INTERNAL_RUNTIME}/authorized-executable`;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function unavailable(message, code = 'ISOLATION_BACKEND_UNAVAILABLE') {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  return error;
}

function exactBinaryPath(input) {
  if (typeof input !== 'string' || !path.isAbsolute(input)) {
    throw new Error('Bubblewrap binaryPath must be exact and absolute.');
  }
  const resolved = path.resolve(input);
  try { return fs.realpathSync(resolved); } catch { return resolved; }
}

function boundedEvidence(value) {
  return String(value || '').replaceAll('\0', '').slice(0, 8192).trim();
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' &&
    !relative.startsWith(`..${path.sep}`));
}

function createLinuxBwrapExecutionProvider({
  binaryPath = '/usr/bin/bwrap',
  platform = process.platform,
  processPort = childProcess,
  runtimeDirectories = RUNTIME_CANDIDATES.filter((candidate) => fs.existsSync(candidate)),
  terminationGraceMs = 100
} = {}) {
  const launcher = exactBinaryPath(binaryPath);
  const runtimeRoots = [...runtimeDirectories].map((candidate) => ({
    hostPhysicalRoot: fs.realpathSync(path.resolve(candidate)),
    guestRoot: path.resolve(candidate)
  }));
  const issuedPlans = new WeakSet();

  function namespaceArguments() {
    return [
      '--unshare-user', '--uid', '0', '--gid', '0',
      '--unshare-pid', '--unshare-net', '--unshare-ipc', '--unshare-uts',
      '--new-session', '--die-with-parent', '--clearenv', '--cap-drop', 'ALL'
    ];
  }

  function runtimeMountArguments() {
    return runtimeRoots.flatMap(({ hostPhysicalRoot, guestRoot }) =>
      ['--ro-bind', hostPhysicalRoot, guestRoot]);
  }

  function probe() {
    const evidence = {
      schema: 'sdo.execution-isolation-probe/v1',
      backend: 'linux-bwrap',
      platform,
      binaryPath: launcher,
      available: false,
      versionEvidence: '',
      helpEvidence: '',
      requiredCapabilities: Object.fromEntries(REQUIRED_FLAGS.map((flag) => [flag, false])),
      reason: null
    };
    if (platform !== 'linux') {
      return deepFreeze({ ...evidence, reason: 'PLATFORM_NOT_LINUX' });
    }
    if (!fs.existsSync(launcher) || !fs.statSync(launcher).isFile()) {
      return deepFreeze({ ...evidence, reason: 'BWRAP_BINARY_UNAVAILABLE' });
    }
    const options = {
      shell: false,
      encoding: 'utf8',
      timeout: 3000,
      maxBuffer: 64 * 1024,
      windowsHide: true,
      env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' }
    };
    const version = processPort.spawnSync(launcher, ['--version'], options);
    const help = processPort.spawnSync(launcher, ['--help'], options);
    const helpEvidence = boundedEvidence(help.stdout || help.stderr);
    const capabilities = Object.fromEntries(REQUIRED_FLAGS.map((flag) =>
      [flag, helpEvidence.includes(flag)]));
    const capabilityMissing = Object.values(capabilities).includes(false);
    const physical = capabilityMissing ? null : processPort.spawnSync(launcher, [
      ...namespaceArguments(), ...runtimeMountArguments(),
      '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp', '--dir', '/tmp/home',
      '--setenv', 'PATH', '/usr/bin:/bin', '--setenv', 'HOME', '/tmp/home',
      '--', '/usr/bin/true'
    ], options);
    const available = !version.error && version.status === 0 && !help.error && help.status === 0 &&
      !capabilityMissing && physical && !physical.error && physical.status === 0;
    return deepFreeze({
      ...evidence,
      available: Boolean(available),
      versionEvidence: boundedEvidence(version.stdout || version.stderr),
      helpEvidence,
      requiredCapabilities: capabilities,
      reason: available ? null : capabilityMissing ? 'REQUIRED_CAPABILITY_MISSING' :
        boundedEvidence(physical && (physical.stderr || physical.stdout) ||
          version.error && version.error.code || help.error && help.error.code) ||
          'BWRAP_PHYSICAL_PROBE_FAILED'
    });
  }

  function buildPlan(envelope) {
    if (!isExecutionEnvelope(envelope) || envelope.runtimeProfile.backend !== 'linux-bwrap') {
      throw new Error('A normalized immutable execution envelope is required.');
    }
    const internalCwd = envelope.cwd === '.' ? INTERNAL_WORKSPACE :
      `${INTERNAL_WORKSPACE}/${envelope.cwd.split(path.sep).join('/')}`;
    const childEnvironment = {
      PATH: '/usr/bin:/bin',
      HOME: '/tmp/home',
      TMPDIR: '/tmp',
      LANG: 'C.UTF-8',
      ...envelope.explicitEnvironment
    };
    const authorizedExecutable = envelope.argv[0];
    const visibleRuntime = runtimeRoots.find(({ hostPhysicalRoot }) =>
      isWithin(hostPhysicalRoot, authorizedExecutable));
    const guestExecutable = visibleRuntime ? path.join(visibleRuntime.guestRoot,
      path.relative(visibleRuntime.hostPhysicalRoot, authorizedExecutable)) :
      INTERNAL_AUTHORIZED_EXECUTABLE;
    const executableBinding = {
      hostPhysicalPath: authorizedExecutable,
      guestPath: guestExecutable,
      mode: visibleRuntime ? 'system-runtime' : 'exact-file-read-only'
    };
    const executableMountArguments = visibleRuntime ? [] : [
      '--dir', INTERNAL_RUNTIME,
      '--ro-bind', authorizedExecutable, INTERNAL_AUTHORIZED_EXECUTABLE
    ];
    const arguments_ = [
      ...namespaceArguments(), ...runtimeMountArguments(),
      '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp', '--dir', '/tmp/home',
      ...executableMountArguments,
      '--bind', envelope.authorizedWorkspacePhysicalRoot, INTERNAL_WORKSPACE,
      '--remount-ro', '/', '--chdir', internalCwd,
      ...Object.keys(childEnvironment).sort().flatMap((key) =>
        ['--setenv', key, childEnvironment[key]]),
      '--', guestExecutable, ...envelope.argv.slice(1)
    ];
    const fields = {
      schema: 'sdo.execution-isolation-plan/v1',
      backend: 'linux-bwrap',
      executable: launcher,
      arguments: arguments_,
      spawnOptions: {
        cwd: envelope.authorizedWorkspacePhysicalRoot,
        shell: false,
        windowsHide: true,
        detached: true,
        env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' }
      },
      limits: envelope.runtimeProfile.limits,
      executableBinding,
      envelopeDigest: envelope.digest
    };
    const plan = deepFreeze({ ...fields, digest: digest(fields.schema, fields) });
    issuedPlans.add(plan);
    return plan;
  }

  function run(plan) {
    if (!plan || !issuedPlans.has(plan)) {
      return Promise.reject(unavailable('Execution plan was not built by this provider.',
        'ISOLATION_PLAN_INVALID'));
    }
    const availability = probe();
    if (!availability.available) {
      return Promise.reject(unavailable(availability.reason));
    }
    return new Promise((resolve, reject) => {
      let child;
      try { child = processPort.spawn(plan.executable, plan.arguments, plan.spawnOptions); } catch (error) {
        reject(unavailable(error.code || error.message));
        return;
      }
      let stdout = Buffer.alloc(0);
      let stderr = Buffer.alloc(0);
      let classification = null;
      let forceTimer = null;
      let settled = false;

      const signalTree = (signal) => {
        try { process.kill(-child.pid, signal); } catch {
          try { child.kill(signal); } catch { /* already exited */ }
        }
      };
      const terminate = (reason) => {
        if (classification) return;
        classification = reason;
        signalTree('SIGTERM');
        forceTimer = setTimeout(() => signalTree('SIGKILL'), terminationGraceMs);
        forceTimer.unref();
      };
      const collect = (current, chunk, limit, reason) => {
        const remaining = Math.max(0, limit - current.length);
        const bounded = remaining ? Buffer.concat([current, chunk.subarray(0, remaining)]) : current;
        if (chunk.length > remaining) terminate(reason);
        return bounded;
      };
      child.stdout.on('data', (chunk) => {
        stdout = collect(stdout, chunk, plan.limits.maxStdoutBytes, 'STDOUT_LIMIT_EXCEEDED');
      });
      child.stderr.on('data', (chunk) => {
        stderr = collect(stderr, chunk, plan.limits.maxStderrBytes, 'STDERR_LIMIT_EXCEEDED');
      });
      const wallTimer = setTimeout(() => terminate('WALL_CLOCK_TIMEOUT'),
        plan.limits.wallClockMs);
      child.once('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(wallTimer);
        if (forceTimer) clearTimeout(forceTimer);
        reject(unavailable(error.code || error.message));
      });
      child.once('close', (code, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(wallTimer);
        if (forceTimer) clearTimeout(forceTimer);
        resolve(deepFreeze({
          schema: 'sdo.execution-isolation-result/v1',
          classification: classification || (code === 0 ? 'COMPLETED' : 'PROCESS_FAILED'),
          exitCode: code,
          signal: signal || null,
          stdout: stdout.toString('utf8'),
          stderr: stderr.toString('utf8'),
          stdoutBytes: stdout.length,
          stderrBytes: stderr.length,
          planDigest: plan.digest
        }));
      });
    });
  }

  return deepFreeze({ backend: 'linux-bwrap', binaryPath: launcher, probe, buildPlan, run });
}

module.exports = deepFreeze({
  createLinuxBwrapExecutionProvider,
  REQUIRED_FLAGS,
  INTERNAL_WORKSPACE,
  INTERNAL_RUNTIME,
  INTERNAL_AUTHORIZED_EXECUTABLE
});
