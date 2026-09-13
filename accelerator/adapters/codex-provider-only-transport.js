'use strict';

const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');

const PROVIDER_PORT = 43127;
const PROVIDER_HOST = `127.0.0.1:${PROVIDER_PORT}`;
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const FORBIDDEN_PROVIDER_TOOL_TYPES = new Set([
  'code_interpreter',
  'computer_use_preview',
  'file_search',
  'image_generation',
  'mcp',
  'web_search',
  'web_search_preview',
]);

const PROVIDERS = Object.freeze({
  OPENAI_API: Object.freeze({
    hostname: 'api.openai.com',
    port: 443,
    pathPrefix: '/v1',
  }),
  CHATGPT_LOGIN: Object.freeze({
    hostname: 'chatgpt.com',
    port: 443,
    pathPrefix: '/backend-api/codex',
  }),
});

const REQUEST_HEADERS = new Set([
  'accept',
  'authorization',
  'chatgpt-account-id',
  'content-type',
  'openai-beta',
  'openai-organization',
  'openai-project',
  'originator',
  'session-id',
  'user-agent',
  'x-codex-turn-metadata',
  'x-stainless-arch',
  'x-stainless-lang',
  'x-stainless-os',
  'x-stainless-package-version',
  'x-stainless-retry-count',
  'x-stainless-runtime',
  'x-stainless-runtime-version',
  'x-stainless-timeout',
]);

const RESPONSE_HEADERS = new Set([
  'cache-control',
  'content-encoding',
  'content-type',
  'openai-processing-ms',
  'request-id',
  'x-request-id',
]);

const WEBSOCKET_REQUEST_HEADERS = new Set([
  ...REQUEST_HEADERS,
  'connection',
  'sec-websocket-extensions',
  'sec-websocket-key',
  'sec-websocket-protocol',
  'sec-websocket-version',
  'upgrade',
]);

const WEBSOCKET_RESPONSE_HEADERS = new Set([
  'connection',
  'sec-websocket-accept',
  'sec-websocket-extensions',
  'sec-websocket-protocol',
  'upgrade',
]);

function fail(message) {
  const error = new Error(message);
  error.code = 'CODEX_PROVIDER_TRANSPORT_UNAVAILABLE';
  return error;
}

function assertSecureControlRoot(controlRoot) {
  const resolved = path.resolve(controlRoot);
  const stats = fs.lstatSync(resolved);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw fail('Codex provider transport control root is invalid.');
  }
  if (stats.uid !== process.getuid() || (stats.mode & 0o077) !== 0) {
    throw fail('Codex provider transport control root permissions are unsafe.');
  }
  return resolved;
}

function filterHeaders(headers, allowed) {
  const filtered = {};
  for (const [name, value] of Object.entries(headers)) {
    const normalized = name.toLowerCase();
    if (allowed.has(normalized) && value !== undefined) {
      filtered[normalized] = value;
    }
  }
  return filtered;
}

function collectRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    request.on('data', (chunk) => {
      length += chunk.length;
      if (length > MAX_REQUEST_BYTES) {
        reject(fail('Codex provider request exceeded the bounded transport limit.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', () => reject(fail('Codex provider request could not be read.')));
  });
}

function requestProvider({ hostname, port, method, path: requestPath, headers, body }) {
  return new Promise((resolve, reject) => {
    const upstream = https.request({
      hostname,
      port,
      method,
      path: requestPath,
      headers: {
        ...headers,
        host: hostname,
        'content-length': body.length,
      },
      agent: false,
    }, (response) => {
      resolve({
        statusCode: response.statusCode || 502,
        headers: response.headers,
        body: response,
      });
    });
    upstream.setTimeout(120_000, () => {
      upstream.destroy(fail('Codex provider request timed out.'));
    });
    upstream.on('error', () => reject(fail('Codex provider request failed.')));
    upstream.end(body);
  });
}

function rejectRequest(response, statusCode, message) {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: { message } }));
}

function writeSocketResponse(socket, statusCode) {
  socket.end(
    `HTTP/1.1 ${statusCode} Provider Transport Rejected\r\n` +
    'Connection: close\r\nContent-Length: 0\r\n\r\n'
  );
}

function upgradeProvider({ provider, request, clientSocket, head, tunnels }) {
  const headers = filterHeaders(request.headers, WEBSOCKET_REQUEST_HEADERS);
  const upstreamRequest = https.request({
    hostname: provider.hostname,
    port: provider.port,
    method: 'GET',
    path: `${provider.pathPrefix}/responses`,
    headers: { ...headers, host: provider.hostname },
    agent: false,
  });
  let upgraded = false;
  upstreamRequest.setTimeout(30_000, () => upstreamRequest.destroy());
  upstreamRequest.once('upgrade', (response, upstreamSocket, upstreamHead) => {
    upgraded = true;
    tunnels.add(clientSocket);
    tunnels.add(upstreamSocket);
    const responseHeaders = filterHeaders(response.headers, WEBSOCKET_RESPONSE_HEADERS);
    const headerLines = Object.entries(responseHeaders).map(
      ([name, value]) => `${name}: ${value}`
    );
    clientSocket.write(
      `HTTP/1.1 101 Switching Protocols\r\n${headerLines.join('\r\n')}\r\n\r\n`
    );
    if (head.length > 0) upstreamSocket.write(head);
    if (upstreamHead.length > 0) clientSocket.write(upstreamHead);
    clientSocket.pipe(upstreamSocket).pipe(clientSocket);
    const closeTunnel = () => {
      tunnels.delete(clientSocket);
      tunnels.delete(upstreamSocket);
      clientSocket.destroy();
      upstreamSocket.destroy();
    };
    clientSocket.once('error', closeTunnel);
    upstreamSocket.once('error', closeTunnel);
    clientSocket.once('close', closeTunnel);
    upstreamSocket.once('close', closeTunnel);
  });
  upstreamRequest.once('response', (response) => {
    response.resume();
    if (!upgraded) writeSocketResponse(clientSocket, response.statusCode || 502);
  });
  upstreamRequest.once('error', () => {
    if (!upgraded) writeSocketResponse(clientSocket, 502);
  });
  upstreamRequest.end();
}

function validWebSocketUpgrade(request) {
  return request.method === 'GET' && request.url === '/responses' &&
    request.headers.host === PROVIDER_HOST &&
    typeof request.headers.authorization === 'string' &&
    request.headers.authorization.length > 0 &&
    String(request.headers.upgrade || '').toLowerCase() === 'websocket' &&
    String(request.headers.connection || '').toLowerCase().split(/\s*,\s*/).includes('upgrade') &&
    typeof request.headers['sec-websocket-key'] === 'string' &&
    request.headers['sec-websocket-version'] === '13';
}

function validateProviderRequest(request, body) {
  if (request.headers.host !== PROVIDER_HOST) {
    return false;
  }
  if (typeof request.headers.authorization !== 'string' || request.headers.authorization.length === 0) {
    return false;
  }
  if (request.method === 'GET' &&
      /^\/models(?:\?client_version=[A-Za-z0-9._-]{1,64})?$/.test(request.url) &&
      body.length === 0) {
    return true;
  }
  if (request.method !== 'POST' || !['/responses', '/responses/compact'].includes(request.url)) {
    return false;
  }
  if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    return false;
  }
  let payload;
  try {
    payload = JSON.parse(body.toString('utf8'));
  } catch {
    return false;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }
  if (payload.background === true || payload.store === true ||
      (Array.isArray(payload.tools) && payload.tools.some((tool) =>
        tool && FORBIDDEN_PROVIDER_TOOL_TYPES.has(tool.type)))) {
    return false;
  }
  if (request.url === '/responses' && payload.stream !== true) {
    return false;
  }
  return true;
}

function createCodexProviderOnlyTransport({
  controlRoot,
  providerKind,
  upstreamRequest = requestProvider,
}) {
  const provider = PROVIDERS[providerKind];
  if (!provider || typeof upstreamRequest !== 'function') {
    throw fail('Codex provider transport configuration is invalid.');
  }
  const secureRoot = assertSecureControlRoot(controlRoot);
  const socketPath = path.join(secureRoot, 'provider.sock');
  if (fs.existsSync(socketPath)) {
    throw fail('Codex provider transport endpoint already exists.');
  }

  let disposed = false;
  const tunnels = new Set();
  const server = http.createServer(async (request, response) => {
    let body;
    try {
      body = await collectRequestBody(request);
    } catch {
      rejectRequest(response, 400, 'Invalid provider request.');
      return;
    }
    if (!validateProviderRequest(request, body)) {
      rejectRequest(response, 400, 'Invalid provider request.');
      return;
    }

    try {
      const upstream = await upstreamRequest({
        hostname: provider.hostname,
        port: provider.port,
        method: request.method,
        path: `${provider.pathPrefix}${request.url}`,
        headers: filterHeaders(request.headers, REQUEST_HEADERS),
        body,
      });
      const responseHeaders = filterHeaders(upstream.headers || {}, RESPONSE_HEADERS);
      response.writeHead(upstream.statusCode, responseHeaders);
      upstream.body.on('error', () => response.destroy());
      upstream.body.pipe(response);
    } catch {
      rejectRequest(response, 502, 'Configured Codex provider transport failed.');
    }
  });
  server.on('upgrade', (request, socket, head) => {
    if (!validWebSocketUpgrade(request)) {
      writeSocketResponse(socket, 400);
      return;
    }
    upgradeProvider({ provider, request, clientSocket: socket, head, tunnels });
  });
  server.on('connect', (_request, socket) => socket.destroy());
  server.on('clientError', (_error, socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  });
  server.on('error', () => {});

  try {
    server.listen(socketPath);
    fs.chmodSync(socketPath, 0o600);
    const endpoint = fs.lstatSync(socketPath);
    if (!endpoint.isSocket() || endpoint.uid !== process.getuid() || (endpoint.mode & 0o177) !== 0) {
      throw fail('Codex provider transport endpoint attestation failed.');
    }
  } catch (error) {
    server.close();
    try {
      fs.unlinkSync(socketPath);
    } catch {}
    throw error && error.code === 'CODEX_PROVIDER_TRANSPORT_UNAVAILABLE'
      ? error
      : fail('Codex provider transport endpoint could not be established.');
  }
  server.unref();

  const attestation = Object.freeze({
    kind: 'CODEX_PROVIDER_ONLY_TRANSPORT',
    providerKind,
    destinationFixed: true,
    genericProxyUnavailable: true,
    hostNetworkFallback: false,
    credentialPersistence: false,
    credentialLogging: false,
    socketOwnerUid: process.getuid(),
    socketMode: '0600',
    providerHost: PROVIDER_HOST,
  });

  return Object.freeze({
    socketPath,
    providerBaseUrl: `http://${PROVIDER_HOST}`,
    providerPort: PROVIDER_PORT,
    attestation,
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      for (const tunnel of tunnels) tunnel.destroy();
      tunnels.clear();
      server.close();
      try {
        fs.unlinkSync(socketPath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    },
  });
}

module.exports = {
  PROVIDER_PORT,
  createCodexProviderOnlyTransport,
};
