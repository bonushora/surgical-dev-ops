#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const crypto = require('node:crypto');

const { PRODUCT_VERSION } = require('./customer-configuration');
const { canonicalRoot, rootPaths, inspectCustomerState, doctorCustomerState, replaceFile } = require('./customer-runtime');
const { endpointFor, writeStoppedState } = require('./customer-lifecycle');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

async function main() {
  const root = canonicalRoot(argument('--state-root'));
  const doctor = doctorCustomerState({ stateRoot: root });
  if (!doctor.overall.startsWith('PASS')) throw new Error('Runtime prerequisites are invalid');
  const inspection = inspectCustomerState({ stateRoot: root });
  const previous = inspection.runtime;
  if (previous.status !== 'STOPPED') throw new Error('Runtime state is not stopped');
  const endpoint = endpointFor(root);
  if (process.platform !== 'win32' && fs.existsSync(endpoint)) {
    throw new Error('Stale runtime endpoint requires explicit recovery');
  }
  const startupId = crypto.randomUUID();
  const state = {
    schema: 'surgical.customer_runtime_state.v1',
    status: 'READY',
    productVersion: PRODUCT_VERSION,
    startupId,
    pid: process.pid,
    endpoint,
    startedAt: new Date().toISOString(),
    productionEligibility: inspection.productionEligibility,
    providerStatus: doctor.provider.configured ? 'CONFIGURED' : 'NOT_CONFIGURED',
    currentRepository: inspection.repositories.repositories.at(-1)?.path || null,
  };
  let endpointIdentity = null;
  let stopping = false;
  const server = net.createServer((socket) => {
    let input = '';
    socket.on('data', (chunk) => {
      input += chunk.toString('utf8');
      if (input.length > 16 * 1024) return socket.destroy();
      const newline = input.indexOf('\n');
      if (newline === -1) return;
      let request;
      try { request = JSON.parse(input.slice(0, newline)); } catch { return socket.destroy(); }
      if (!request || request.schema !== 'surgical.customer_control_request.v1') return socket.destroy();
      if (request.operation === 'status' && !stopping) {
        socket.end(`${JSON.stringify({ status: 'READY', productVersion: PRODUCT_VERSION, startupId })}\n`);
        return;
      }
      if (request.operation === 'stop' && request.startupId === startupId && !stopping) {
        stopping = true;
        if (process.platform !== 'win32' && endpointIdentity) {
          const current = fs.lstatSync(endpoint);
          if (!current.isSocket() || current.dev !== endpointIdentity.dev || current.ino !== endpointIdentity.ino) {
            return socket.destroy(new Error('Endpoint identity changed'));
          }
        }
        server.close();
        writeStoppedState(root, state);
        socket.end(`${JSON.stringify({ status: 'STOPPED', startupId, evidencePreserved: true })}\n`, () => {
          process.disconnect?.();
        });
        return;
      }
      socket.destroy();
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(endpoint, resolve);
  });
  if (process.platform !== 'win32') {
    fs.chmodSync(endpoint, 0o600);
    const stat = fs.lstatSync(endpoint);
    if (!stat.isSocket() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) throw new Error('Runtime endpoint confinement failed');
    endpointIdentity = { dev: stat.dev, ino: stat.ino };
  }
  replaceFile(rootPaths(root).runtimeState, state);
  if (process.send) process.send({ schema: 'surgical.customer_daemon_ready.v1', status: 'READY', startupId, pid: process.pid });
}

main().catch((error) => {
  if (process.send) process.send({ schema: 'surgical.customer_daemon_ready.v1', status: 'FAILED' });
  process.stderr.write(`Customer runtime failed closed: ${error.message}\n`);
  process.exitCode = 1;
});
