'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { PRODUCT_VERSION } = require('./customer-configuration');
const { canonicalRoot, rootPaths, runtimeState, replaceFile } = require('./customer-runtime');

function endpointFor(root) {
  if (process.platform === 'win32') {
    const identity = crypto.createHash('sha256').update(root).digest('hex').slice(0, 32);
    return `\\\\.\\pipe\\surgical-customer-${identity}`;
  }
  return path.join(root, 'runtime', 'control.sock');
}

function request(endpoint, payload, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let received = '';
    const socket = net.createConnection({ path: endpoint });
    const deadline = setTimeout(() => finish(new Error('Runtime control deadline expired')), timeoutMs);
    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      socket.destroy();
      if (error) reject(error); else resolve(value);
    }
    socket.once('connect', () => socket.write(`${JSON.stringify(payload)}\n`));
    socket.on('data', (chunk) => {
      received += chunk.toString('utf8');
      if (received.length > 16 * 1024) return finish(new Error('Runtime response exceeded its bound'));
      const newline = received.indexOf('\n');
      if (newline === -1) return;
      try { finish(null, JSON.parse(received.slice(0, newline))); }
      catch { finish(new Error('Runtime response is malformed')); }
    });
    socket.once('error', (error) => finish(error));
    socket.once('end', () => {
      if (!settled) finish(new Error('Runtime closed without terminal evidence'));
    });
  });
}

async function probeCustomerRuntime({ stateRoot }) {
  const root = canonicalRoot(stateRoot);
  const state = runtimeState(root);
  if (state.status === 'STOPPED') return Object.freeze({ runtimeStatus: 'STOPPED' });
  if (state.status === 'RECOVERY_REQUIRED') return Object.freeze({ runtimeStatus: 'RECOVERY_REQUIRED' });
  if (state.status !== 'READY' || typeof state.startupId !== 'string') {
    return Object.freeze({ runtimeStatus: 'DEGRADED' });
  }
  try {
    const response = await request(endpointFor(root), { schema: 'surgical.customer_control_request.v1', operation: 'status' });
    if (response.status !== 'READY' || response.startupId !== state.startupId
      || response.productVersion !== PRODUCT_VERSION) return Object.freeze({ runtimeStatus: 'INCOMPATIBLE_VERSION' });
    return Object.freeze({
      runtimeStatus: 'READY',
      productVersion: PRODUCT_VERSION,
      startupId: state.startupId,
      pid: state.pid,
      authorityState: 'AUTHORITY_UNAVAILABLE',
      productionEligibility: state.productionEligibility,
      currentRepository: state.currentRepository || null,
      activeMission: null,
      currentPhase: 'IDLE',
      pendingApproval: false,
      qualificationState: 'GREEN_BASELINE',
      recoveryRequirement: 'NONE',
      providerStatus: state.providerStatus,
    });
  } catch {
    return Object.freeze({ runtimeStatus: 'DEGRADED', recoveryRequirement: 'INSPECT_STALE_RUNTIME_STATE' });
  }
}

async function startCustomerRuntime({ stateRoot }) {
  const root = canonicalRoot(stateRoot);
  const existing = await probeCustomerRuntime({ stateRoot: root });
  if (existing.runtimeStatus === 'READY') throw new Error('Customer runtime is already running');
  if (existing.runtimeStatus !== 'STOPPED') throw new Error('Customer runtime is degraded or requires recovery');
  const paths = rootPaths(root);
  const logFd = fs.openSync(path.join(paths.logs, 'runtime.log'), 'a', 0o600);
  const child = spawn(process.execPath, [path.join(__dirname, 'customer-runtime-daemon.js'), '--state-root', root], {
    detached: true,
    stdio: ['ignore', logFd, logFd, 'ipc'],
    windowsHide: true,
  });
  fs.closeSync(logFd);
  const ready = await new Promise((resolve, reject) => {
    let settled = false;
    const deadline = setTimeout(() => finish(new Error('Runtime readiness deadline expired')), 10_000);
    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      child.removeAllListeners('message');
      child.removeAllListeners('error');
      child.removeAllListeners('exit');
      if (error) reject(error); else resolve(value);
    }
    child.once('message', (message) => {
      if (!message || message.schema !== 'surgical.customer_daemon_ready.v1'
        || message.status !== 'READY') finish(new Error('Runtime readiness evidence is malformed'));
      else finish(null, message);
    });
    child.once('error', (error) => finish(error));
    child.once('exit', (code) => finish(new Error(`Runtime exited before readiness (${code})`)));
  });
  child.disconnect();
  child.unref();
  return Object.freeze({ status: 'READY', productVersion: PRODUCT_VERSION, startupId: ready.startupId, pid: ready.pid });
}

async function stopCustomerRuntime({ stateRoot }) {
  const root = canonicalRoot(stateRoot);
  const state = runtimeState(root);
  if (state.status === 'STOPPED') return Object.freeze({ status: 'STOPPED', alreadyStopped: true });
  if (state.status !== 'READY') throw new Error('Runtime is not safely stoppable; recovery inspection is required');
  let response;
  try {
    response = await request(endpointFor(root), {
      schema: 'surgical.customer_control_request.v1', operation: 'stop', startupId: state.startupId,
    });
  } catch (error) {
    throw new Error(
      `Runtime stop could not obtain terminal evidence; recovery inspection is required (${error.message})`
    );
  }
  if (!response || response.status !== 'STOPPED' || response.startupId !== state.startupId) {
    throw new Error('Runtime stop evidence is invalid');
  }
  return Object.freeze({ status: 'STOPPED', startupId: state.startupId, evidencePreserved: true });
}

async function restartCustomerRuntime({ stateRoot }) {
  const root = canonicalRoot(stateRoot);
  const before = await probeCustomerRuntime({ stateRoot: root });
  if (before.runtimeStatus === 'READY') await stopCustomerRuntime({ stateRoot: root });
  else if (before.runtimeStatus !== 'STOPPED') throw new Error('Runtime cannot restart while degraded or recovery is required');
  const started = await startCustomerRuntime({ stateRoot: root });
  return Object.freeze({ ...started, restarted: true });
}

function writeStoppedState(root, previous) {
  replaceFile(rootPaths(root).runtimeState, {
    schema: 'surgical.customer_runtime_state.v1', status: 'STOPPED',
    productVersion: PRODUCT_VERSION, stoppedAt: new Date().toISOString(),
    previousStartupId: previous.startupId,
  });
}

module.exports = Object.freeze({
  endpointFor,
  request,
  probeCustomerRuntime,
  startCustomerRuntime,
  stopCustomerRuntime,
  restartCustomerRuntime,
  writeStoppedState,
});
