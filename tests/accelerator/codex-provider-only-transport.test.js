'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const test = require('node:test');

const TRANSPORT_MODULE = '../../accelerator/adapters/codex-provider-only-transport';
const PROVIDER_HOST = '127.0.0.1:43127';
const linuxTest = process.platform === 'linux' ? test : test.skip;

function loadTransport() {
  return require(TRANSPORT_MODULE);
}

function createControlRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-provider-transport-test-'));
  fs.chmodSync(root, 0o700);
  return root;
}

function requestSocket(socketPath, {
  method = 'POST',
  requestPath = '/responses',
  headers = {},
  body = JSON.stringify({ model: 'test-model', input: 'hello', stream: true }),
} = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      socketPath,
      method,
      path: requestPath,
      headers: {
        host: PROVIDER_HOST,
        authorization: 'Bearer directed-test-secret',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
        ...headers,
      },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        statusCode: response.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.on('error', reject);
    request.end(body);
  });
}

function fixedResponse(body = '{}') {
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: Readable.from([body]),
  };
}

const disposals = [];

test.afterEach(() => {
  while (disposals.length > 0) {
    const dispose = disposals.pop();
    dispose();
  }
});

linuxTest('provider-only transport makes only the configured OpenAI Responses path available', async () => {
  const { createCodexProviderOnlyTransport } = loadTransport();
  const controlRoot = createControlRoot();
  let observedRequest;
  const transport = createCodexProviderOnlyTransport({
    controlRoot,
    providerKind: 'OPENAI_API',
    upstreamRequest: async (request) => {
      observedRequest = request;
      return fixedResponse('{"ok":true}');
    },
  });
  disposals.push(transport.dispose);

  const response = await requestSocket(transport.socketPath);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, '{"ok":true}');
  assert.deepEqual(
    {
      hostname: observedRequest.hostname,
      port: observedRequest.port,
      method: observedRequest.method,
      path: observedRequest.path,
    },
    { hostname: 'api.openai.com', port: 443, method: 'POST', path: '/v1/responses' },
  );
  assert.equal(transport.providerBaseUrl, `http://${PROVIDER_HOST}`);
  assert.equal(transport.attestation.destinationFixed, true);
  assert.equal(transport.attestation.genericProxyUnavailable, true);
});

linuxTest('caller-controlled provider destinations and generic proxy methods fail closed', async () => {
  const { createCodexProviderOnlyTransport } = loadTransport();
  const controlRoot = createControlRoot();
  let upstreamCalls = 0;
  const transport = createCodexProviderOnlyTransport({
    controlRoot,
    providerKind: 'OPENAI_API',
    upstreamRequest: async () => {
      upstreamCalls += 1;
      return fixedResponse();
    },
  });
  disposals.push(transport.dispose);

  const attempts = [
    { requestPath: 'http://example.invalid/' },
    { requestPath: '/responses?destination=http://example.invalid/' },
    { requestPath: '/v1/chat/completions' },
    { method: 'CONNECT', requestPath: 'example.invalid:443', body: '' },
    { headers: { host: 'localhost:9999' } },
  ];
  for (const attempt of attempts) {
    const response = await requestSocket(transport.socketPath, attempt).catch((error) => error);
    assert.ok(response.statusCode >= 400 || ['ECONNRESET', 'ECONNREFUSED'].includes(response.code));
  }
  assert.equal(upstreamCalls, 0);
});

linuxTest('model catalog transport permits only its bounded client-version query', async () => {
  const { createCodexProviderOnlyTransport } = loadTransport();
  const controlRoot = createControlRoot();
  let observedRequest;
  const transport = createCodexProviderOnlyTransport({
    controlRoot,
    providerKind: 'CHATGPT_LOGIN',
    upstreamRequest: async (request) => {
      observedRequest = request;
      return fixedResponse('{"models":[]}');
    },
  });
  disposals.push(transport.dispose);

  const response = await requestSocket(transport.socketPath, {
    method: 'GET',
    requestPath: '/models?client_version=0.153.4',
    body: '',
  });
  const rejected = await requestSocket(transport.socketPath, {
    method: 'GET',
    requestPath: '/models?destination=localhost',
    body: '',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(rejected.statusCode, 400);
  assert.deepEqual(
    { hostname: observedRequest.hostname, port: observedRequest.port, path: observedRequest.path },
    {
      hostname: 'chatgpt.com',
      port: 443,
      path: '/backend-api/codex/models?client_version=0.153.4'
    }
  );
});

linuxTest('arbitrary localhost and alternate-port requests are not represented by the transport contract', () => {
  const { createCodexProviderOnlyTransport } = loadTransport();
  const controlRoot = createControlRoot();
  const transport = createCodexProviderOnlyTransport({
    controlRoot,
    providerKind: 'OPENAI_API',
    upstreamRequest: async () => fixedResponse(),
  });
  disposals.push(transport.dispose);

  assert.equal(transport.providerBaseUrl, 'http://127.0.0.1:43127');
  assert.equal(Object.hasOwn(transport, 'destination'), false);
  assert.equal(Object.hasOwn(transport, 'connect'), false);
  assert.equal(Object.hasOwn(transport, 'request'), false);
});

linuxTest('an absent provider broker fails closed without shared-network fallback', async () => {
  const { createCodexProviderOnlyTransport } = loadTransport();
  const controlRoot = createControlRoot();
  const transport = createCodexProviderOnlyTransport({
    controlRoot,
    providerKind: 'OPENAI_API',
    upstreamRequest: async () => fixedResponse(),
  });
  transport.dispose();

  await assert.rejects(requestSocket(transport.socketPath), /ENOENT|ECONNREFUSED/);
  assert.equal(transport.attestation.hostNetworkFallback, false);
});

linuxTest('invalid provider kind and unsafe IPC parent permissions fail closed', () => {
  const { createCodexProviderOnlyTransport } = loadTransport();
  const invalidRoot = createControlRoot();
  assert.throws(
    () => createCodexProviderOnlyTransport({
      controlRoot: invalidRoot,
      providerKind: 'http://example.invalid',
      upstreamRequest: async () => fixedResponse(),
    }),
    /provider transport/i,
  );
  fs.rmSync(invalidRoot, { recursive: true, force: true });

  const permissiveRoot = createControlRoot();
  fs.chmodSync(permissiveRoot, 0o755);
  assert.throws(
    () => createCodexProviderOnlyTransport({
      controlRoot: permissiveRoot,
      providerKind: 'OPENAI_API',
      upstreamRequest: async () => fixedResponse(),
    }),
    /permissions/i,
  );
  fs.rmSync(permissiveRoot, { recursive: true, force: true });
});

linuxTest('malformed provider requests fail closed before external transport', async () => {
  const { createCodexProviderOnlyTransport } = loadTransport();
  const controlRoot = createControlRoot();
  let upstreamCalls = 0;
  const transport = createCodexProviderOnlyTransport({
    controlRoot,
    providerKind: 'OPENAI_API',
    upstreamRequest: async () => {
      upstreamCalls += 1;
      return fixedResponse();
    },
  });
  disposals.push(transport.dispose);

  const missingAuth = await requestSocket(transport.socketPath, {
    headers: { authorization: '' },
  });
  const malformedJson = await requestSocket(transport.socketPath, {
    body: '{not-json',
  });
  const nonStreaming = await requestSocket(transport.socketPath, {
    body: JSON.stringify({ model: 'test-model', input: 'hello', stream: false }),
  });
  const providerNetworkTool = await requestSocket(transport.socketPath, {
    body: JSON.stringify({
      model: 'test-model',
      input: 'hello',
      stream: true,
      tools: [{ type: 'web_search' }]
    }),
  });

  assert.deepEqual(
    [
      missingAuth.statusCode,
      malformedJson.statusCode,
      nonStreaming.statusCode,
      providerNetworkTool.statusCode
    ],
    [400, 400, 400, 400],
  );
  assert.equal(upstreamCalls, 0);
});

linuxTest('provider errors and attestation never emit authorization secrets', async () => {
  const { createCodexProviderOnlyTransport } = loadTransport();
  const controlRoot = createControlRoot();
  const secret = 'directed-test-secret';
  const transport = createCodexProviderOnlyTransport({
    controlRoot,
    providerKind: 'OPENAI_API',
    upstreamRequest: async () => {
      throw new Error(`upstream rejected ${secret}`);
    },
  });
  disposals.push(transport.dispose);

  const response = await requestSocket(transport.socketPath);

  assert.equal(response.statusCode, 502);
  assert.doesNotMatch(response.body, new RegExp(secret));
  assert.doesNotMatch(JSON.stringify(transport.attestation), new RegExp(secret));
});

linuxTest('ChatGPT login transport has a separate fixed provider destination', async () => {
  const { createCodexProviderOnlyTransport } = loadTransport();
  const controlRoot = createControlRoot();
  let observedRequest;
  const transport = createCodexProviderOnlyTransport({
    controlRoot,
    providerKind: 'CHATGPT_LOGIN',
    upstreamRequest: async (request) => {
      observedRequest = request;
      return fixedResponse();
    },
  });
  disposals.push(transport.dispose);

  const response = await requestSocket(transport.socketPath);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    { hostname: observedRequest.hostname, port: observedRequest.port, path: observedRequest.path },
    { hostname: 'chatgpt.com', port: 443, path: '/backend-api/codex/responses' },
  );
});

test('native relay mechanically creates a private namespace and exposes only its fixed loopback port', () => {
  const relaySource = fs.readFileSync(path.resolve(
    __dirname,
    '../../accelerator/native/linux/sdo-codex-network-relay.c'
  ), 'utf8');
  const brokerSource = fs.readFileSync(path.resolve(
    __dirname,
    '../../accelerator/adapters/codex-provider-only-transport.js'
  ), 'utf8');

  assert.match(relaySource, /unshare\(CLONE_NEWNET\)/);
  assert.match(relaySource, /SIOCSIFFLAGS/);
  assert.match(relaySource, /INADDR_LOOPBACK/);
  assert.match(relaySource, /#define PROVIDER_PORT 43127/);
  assert.match(relaySource, /AF_UNIX/);
  assert.doesNotMatch(relaySource, /getaddrinfo|gethostbyname|INADDR_ANY/);
  assert.match(brokerSource, /hostname: 'api\.openai\.com'/);
  assert.match(brokerSource, /hostname: 'chatgpt\.com'/);
  assert.doesNotMatch(brokerSource, /request\.headers\.host.*hostname/);
});
