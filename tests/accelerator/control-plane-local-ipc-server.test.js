'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const fixture = require('./fixtures/control-plane-protocol-v1.json');
const {
  createControlPlaneProtocolService,
} = require('../../accelerator/core/control-plane-service');
const {
  createInMemoryControlPlaneSubmissionRegistry,
} = require('../../accelerator/adapters/control-plane-submission-registry');
const {
  createControlPlaneLocalIpcServer,
  endpointKind,
} = require('../../accelerator/adapters/control-plane-local-ipc-server');
const {
  createLengthPrefixedFrameDecoder,
  encodeFrame,
} = require('../../accelerator/adapters/local-ipc-framing');

const NOW = '2030-01-01T00:00:00.000Z';
const TRANSPORT_VERSION = 'sacp.sdo-local-ipc/v1';
let endpointSequence = 0;

function service(registry = createInMemoryControlPlaneSubmissionRegistry()) {
  return {
    registry,
    value: createControlPlaneProtocolService({
      registry,
      now: () => NOW,
      createExternalExecutionId: ({ operationId }) => `sdo-${operationId}`,
    }),
  };
}

async function listener(t, options = {}) {
  let runtimeDirectory = null;
  let endpointPath;
  if (process.platform === 'win32') {
    endpointSequence += 1;
    endpointPath = `\\\\.\\pipe\\sdo-local-ipc-${process.pid}-${endpointSequence}`;
  } else {
    const lexicalDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), 'sdo-ipc-'));
    await fsp.chmod(lexicalDirectory, 0o700);
    runtimeDirectory = await fsp.realpath(lexicalDirectory);
    endpointPath = path.join(runtimeDirectory, 's');
  }
  const currentService = options.service || service();
  const server = createControlPlaneLocalIpcServer({
    service: currentService.value,
    endpointPath,
  });
  const descriptor = await server.start();
  t.after(async () => {
    await server.close();
    if (runtimeDirectory !== null) {
      await fsp.rm(runtimeDirectory, { recursive: true, force: true });
    }
  });
  return { runtimeDirectory, endpointPath, server, descriptor, ...currentService };
}

async function peer(t, endpointPath) {
  const socket = net.createConnection({ path: endpointPath });
  const pending = new Map();
  const decoder = createLengthPrefixedFrameDecoder({
    onMessage(message) {
      const current = pending.get(message.messageId);
      if (current) {
        pending.delete(message.messageId);
        current.resolve(message);
      }
    },
    onError(error) {
      for (const current of pending.values()) current.reject(error);
      pending.clear();
    },
  });
  socket.on('data', (chunk) => decoder.push(chunk));
  socket.on('end', () => decoder.end());
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  t.after(() => socket.destroy());
  let sequence = 0;
  return {
    socket,
    request(operation, payload) {
      sequence += 1;
      const messageId = `ipc-${String(sequence).padStart(12, '0')}`;
      const response = new Promise((resolve, reject) => {
        pending.set(messageId, { resolve, reject });
      });
      socket.write(encodeFrame({ transportVersion: TRANSPORT_VERSION, messageId, operation, payload }));
      return response;
    },
  };
}

async function validateSession(current) {
  const negotiated = await current.request('negotiate', fixture.negotiation.compatible);
  assert.equal(negotiated.ok, true);
  const capabilities = await current.request('capabilities', {
    protocolVersion: fixture.protocolVersion,
    requestId: 'request-local-ipc-capabilities',
  });
  assert.equal(capabilities.ok, true);
  assert.equal(capabilities.payload.schemaDigest, fixture.schemaDigest);
  return capabilities.payload;
}

test('platform mapping converges on node:net local-only endpoint kinds', () => {
  assert.equal(endpointKind('linux'), 'UNIX_DOMAIN_SOCKET');
  assert.equal(endpointKind('darwin'), 'UNIX_DOMAIN_SOCKET');
  assert.equal(endpointKind('win32'), 'WINDOWS_NAMED_PIPE');
  assert.throws(() => endpointKind('aix'), /unsupported/);
  assert.throws(
    () => createControlPlaneLocalIpcServer({
      service: service().value,
      endpointPath: '/tmp/invalid-frame-limit.sock',
      maxFrameBytes: 0,
    }),
    /maximum frame size/,
  );
});

test('listener source has no TCP HTTP provider process or physical mutation dispatch path', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../../accelerator/adapters/control-plane-local-ipc-server.js'),
    'utf8',
  );
  assert.match(source, /require\('node:net'\)/);
  assert.doesNotMatch(
    source,
    /node:http|node:https|createConnection|child_process|provider|mutation-transaction|mutation-journal|surgical-orchestrator/i,
  );
  assert.doesNotMatch(source, /\.listen\(\s*\{[^}]*\b(?:host|port)\b/s);
});

test('listener refuses platform emulation as physical transport evidence', async () => {
  const server = createControlPlaneLocalIpcServer({
    service: service().value,
    endpointPath: '/tmp/not-a-qualified-cross-platform-endpoint.sock',
    platform: process.platform === 'linux' ? 'darwin' : 'linux',
  });
  await assert.rejects(
    server.start(),
    (error) => error.code === 'PLATFORM_NOT_PHYSICALLY_QUALIFIED',
  );
});

test('native local listener serves one persistent non-physical session and cleans its endpoint', async (t) => {
  const current = await listener(t);
  assert.equal(current.descriptor.endpointKind, endpointKind(process.platform));
  assert.equal(current.descriptor.physicalDispatchEnabled, false);
  assert.equal(current.descriptor.peerProcessIdentityAuthenticated, false);
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(current.endpointPath).mode & 0o777, 0o600);
  }

  const client = await peer(t, current.endpointPath);
  await validateSession(client);
  const accepted = await client.request('submit', fixture.canonicalSubmit);
  assert.equal(accepted.ok, true);
  assert.equal(accepted.payload.classification, 'accepted');
  const replay = await client.request('submit', fixture.canonicalSubmit);
  assert.equal(replay.ok, true);
  assert.equal(replay.payload.code, 'IDENTICAL_REPLAY');
  assert.equal(replay.payload.externalExecutionId, accepted.payload.externalExecutionId);
  const observed = await client.request('reconcile', {
    protocolVersion: fixture.protocolVersion,
    requestId: 'request-local-ipc-reconcile',
    operationId: fixture.canonicalSubmit.operationId,
    idempotencyKey: fixture.canonicalSubmit.idempotencyKey,
    intentFingerprint: fixture.canonicalSubmit.intentFingerprint,
    principal: fixture.canonicalSubmit.principal,
    authority: fixture.canonicalSubmit.authority,
    workspace: fixture.canonicalSubmit.workspace,
    repository: fixture.canonicalSubmit.repository,
    externalExecutionId: accepted.payload.externalExecutionId,
    afterObservationSequence: accepted.payload.observationSequence,
  });
  assert.equal(observed.ok, true);
  const metrics = current.server.inspectMetrics();
  assert.deepEqual(metrics.operationDispatches, {
    negotiate: 1, capabilities: 1, submit: 2, reconcile: 1, inspect: 0, cancel: 0,
  });
  assert.equal(metrics.physicalDispatchCount, 0);
  assert.equal(current.registry.inspect().length, 1);
});

test('submission before session validation fails closed without a registry claim', async (t) => {
  const current = await listener(t);
  const client = await peer(t, current.endpointPath);
  const response = await client.request('submit', fixture.canonicalSubmit);
  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'SESSION_NOT_VALIDATED');
  assert.equal(response.error.message, 'Local IPC operation rejected');
  assert.equal(current.registry.inspect().length, 0);
});

test('concatenated and fragmented frames preserve deterministic session order', async (t) => {
  const current = await listener(t);
  const socket = net.createConnection({ path: current.endpointPath });
  t.after(() => socket.destroy());
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  const responses = [];
  const complete = new Promise((resolve, reject) => {
    const decoder = createLengthPrefixedFrameDecoder({
      onMessage(message) {
        responses.push(message);
        if (responses.length === 2) resolve();
      },
      onError: reject,
    });
    socket.on('data', (chunk) => decoder.push(chunk));
  });
  const negotiation = encodeFrame({
    transportVersion: TRANSPORT_VERSION,
    messageId: 'ipc-000000000001',
    operation: 'negotiate',
    payload: fixture.negotiation.compatible,
  });
  const capabilities = encodeFrame({
    transportVersion: TRANSPORT_VERSION,
    messageId: 'ipc-000000000002',
    operation: 'capabilities',
    payload: {
      protocolVersion: fixture.protocolVersion,
      requestId: 'request-fragmented-capabilities',
    },
  });
  socket.write(negotiation.subarray(0, 3));
  socket.write(Buffer.concat([negotiation.subarray(3), capabilities]));
  await complete;
  assert.deepEqual(responses.map((entry) => entry.ok), [true, true]);
  assert.deepEqual(current.server.inspectMetrics().operationDispatches, {
    negotiate: 1, capabilities: 1, submit: 0, reconcile: 0, inspect: 0, cancel: 0,
  });
});

test('nested credential smuggling invalidates the live session with a sanitized failure', async (t) => {
  const current = await listener(t);
  const client = await peer(t, current.endpointPath);
  await validateSession(client);
  const response = await client.request('submit', {
    ...fixture.canonicalSubmit,
    authority: {
      ...fixture.canonicalSubmit.authority,
      metadata: { nested: { providerToken: 'forbidden-local-ipc-secret' } },
    },
  });
  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'CREDENTIAL_MATERIAL_REJECTED');
  assert.doesNotMatch(JSON.stringify(response), /forbidden-local-ipc-secret/);
  assert.equal(current.registry.inspect().length, 0);
  await new Promise((resolve) => client.socket.once('close', resolve));
});

test('malformed oversized truncated and invalid UTF-8 connections fail closed', async (t) => {
  const current = await listener(t);
  const invalidFrames = [
    Buffer.from([0, 0, 0, 0]),
    Buffer.from([0, 1, 0, 1]),
    Buffer.from([0, 0, 0, 10, 0x7b]),
    Buffer.from([0, 0, 0, 1, 0xff]),
  ];
  for (const frame of invalidFrames) {
    const socket = net.createConnection({ path: current.endpointPath });
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    const closed = new Promise((resolve) => socket.once('close', resolve));
    socket.end(frame);
    await closed;
  }
  assert.equal(current.server.inspectMetrics().malformedConnections, invalidFrames.length);
  assert.equal(current.registry.inspect().length, 0);
});

test('stale endpoint is never removed to make listener startup succeed', {
  skip: process.platform === 'win32',
}, async (t) => {
  const lexicalDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), 'sdo-ipc-stale-'));
  await fsp.chmod(lexicalDirectory, 0o700);
  const runtimeDirectory = await fsp.realpath(lexicalDirectory);
  const endpointPath = path.join(runtimeDirectory, 's');
  await fsp.writeFile(endpointPath, 'foreign endpoint');
  t.after(() => fsp.rm(runtimeDirectory, { recursive: true, force: true }));
  const current = service();
  const server = createControlPlaneLocalIpcServer({ service: current.value, endpointPath });
  await assert.rejects(server.start(), (error) => error.code === 'STALE_ENDPOINT_PRESENT');
  assert.equal(await fsp.readFile(endpointPath, 'utf8'), 'foreign endpoint');
});

test('listener rejects a non-private runtime directory without creating an endpoint', {
  skip: process.platform === 'win32',
}, async (t) => {
  const lexicalDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), 'sdo-ipc-public-'));
  await fsp.chmod(lexicalDirectory, 0o755);
  const runtimeDirectory = await fsp.realpath(lexicalDirectory);
  const endpointPath = path.join(runtimeDirectory, 's');
  t.after(() => fsp.rm(runtimeDirectory, { recursive: true, force: true }));
  const current = service();
  const server = createControlPlaneLocalIpcServer({ service: current.value, endpointPath });
  await assert.rejects(
    server.start(),
    (error) => error.code === 'RUNTIME_DIRECTORY_CONFINEMENT_REJECTED',
  );
  assert.equal(fs.existsSync(endpointPath), false);
});
