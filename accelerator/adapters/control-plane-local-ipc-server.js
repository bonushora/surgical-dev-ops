'use strict';

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const defaultProtocol = require('../core/control-plane-protocol');
const {
  DEFAULT_MAX_FRAME_BYTES,
  createLengthPrefixedFrameDecoder,
  encodeFrame,
} = require('./local-ipc-framing');

const TRANSPORT_VERSION = 'sacp.sdo-local-ipc/v1';
const OPERATIONS = new Set([
  'negotiate', 'capabilities', 'submit', 'reconcile', 'inspect', 'cancel',
]);
const REQUEST_FIELDS = Object.freeze(['transportVersion', 'messageId', 'operation', 'payload']);
const OPTION_FIELDS = new Set([
  'service', 'endpointPath', 'platform', 'filesystem', 'serverFactory',
  'maxFrameBytes', 'monotonicNow', 'protocol', 'faultInjection',
]);

class LocalIpcServerError extends Error {
  constructor(code) {
    super('Local IPC listener failed');
    this.name = 'LocalIpcServerError';
    this.code = code;
    this.classification = 'transport_failure';
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function endpointKind(platform) {
  if (platform === 'linux' || platform === 'darwin') return 'UNIX_DOMAIN_SOCKET';
  if (platform === 'win32') return 'WINDOWS_NAMED_PIPE';
  throw new TypeError('Local IPC platform is unsupported');
}

function validateEndpoint(endpointPath, platform, filesystem) {
  const kind = endpointKind(platform);
  if (kind === 'WINDOWS_NAMED_PIPE') {
    if (typeof endpointPath !== 'string'
      || !/^\\\\\.\\pipe\\[A-Za-z0-9._-]{8,200}$/.test(endpointPath)) {
      throw new TypeError('Windows local IPC endpoint must be a bounded named pipe');
    }
    return Object.freeze({ kind, endpointPath });
  }
  if (typeof endpointPath !== 'string'
    || !path.isAbsolute(endpointPath)
    || path.normalize(endpointPath) !== endpointPath
    || endpointPath.length > 100) {
    throw new TypeError('POSIX local IPC endpoint path is invalid');
  }
  const directory = path.dirname(endpointPath);
  let current;
  let physicalDirectory;
  try {
    current = filesystem.lstatSync(directory);
    physicalDirectory = filesystem.realpathSync(directory);
  } catch {
    throw new LocalIpcServerError('RUNTIME_DIRECTORY_UNAVAILABLE');
  }
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  if (!current.isDirectory() || current.isSymbolicLink()
    || physicalDirectory !== directory
    || (current.mode & 0o077) !== 0
    || (uid !== null && current.uid !== uid)) {
    throw new LocalIpcServerError('RUNTIME_DIRECTORY_CONFINEMENT_REJECTED');
  }
  try {
    filesystem.lstatSync(endpointPath);
  } catch (error) {
    if (error && error.code === 'ENOENT') return Object.freeze({ kind, endpointPath });
    throw new LocalIpcServerError('ENDPOINT_INSPECTION_FAILED');
  }
  throw new LocalIpcServerError('STALE_ENDPOINT_PRESENT');
}

function createControlPlaneLocalIpcServer(options) {
  if (!isPlainObject(options)
    || Reflect.ownKeys(options).some((key) => typeof key !== 'string' || !OPTION_FIELDS.has(key))) {
    throw new TypeError('Local IPC listener options are invalid');
  }
  const protocol = options.protocol || defaultProtocol;
  const {
    PROTOCOL_VERSION,
    SCHEMA_DIGEST,
    ProtocolError,
    assertCredentialFree,
    deepFreezeCopy,
    exactFields,
  } = protocol;
  if (!protocol || typeof PROTOCOL_VERSION !== 'string' || typeof SCHEMA_DIGEST !== 'string'
    || typeof ProtocolError !== 'function' || typeof assertCredentialFree !== 'function'
    || typeof deepFreezeCopy !== 'function' || typeof exactFields !== 'function') {
    throw new TypeError('Local IPC logical protocol is invalid');
  }
  const requiredMethods = ['negotiate', 'capabilities', 'submit', 'reconcile', 'inspect', 'cancel'];
  if (!options.service
    || options.service.protocolVersion !== PROTOCOL_VERSION
    || typeof options.service.physicalDispatchEnabled !== 'boolean'
    || requiredMethods.some((method) => typeof options.service[method] !== 'function')) {
    throw new TypeError('Local IPC listener requires an exact protocol service');
  }
  const platform = options.platform || process.platform;
  const filesystem = options.filesystem || fs;
  const serverFactory = options.serverFactory || ((handler) => net.createServer(handler));
  const monotonicNow = options.monotonicNow || process.hrtime.bigint;
  const maxFrameBytes = options.maxFrameBytes === undefined
    ? DEFAULT_MAX_FRAME_BYTES
    : options.maxFrameBytes;
  if (!Number.isSafeInteger(maxFrameBytes)
    || maxFrameBytes < 1
    || maxFrameBytes > 16 * 1024 * 1024) {
    throw new TypeError('Local IPC maximum frame size is invalid');
  }
  if (!filesystem || typeof filesystem.lstatSync !== 'function'
    || typeof filesystem.realpathSync !== 'function'
    || typeof filesystem.chmodSync !== 'function'
    || typeof filesystem.unlinkSync !== 'function'
    || typeof serverFactory !== 'function'
    || typeof monotonicNow !== 'function'
    || typeof options.endpointPath !== 'string') {
    throw new TypeError('Local IPC listener dependencies are invalid');
  }
  if (options.faultInjection !== undefined
    && (!isPlainObject(options.faultInjection)
      || Reflect.ownKeys(options.faultInjection).some((key) => key !== 'afterDispatchBeforeResponse')
      || typeof options.faultInjection.afterDispatchBeforeResponse !== 'function')) {
    throw new TypeError('Local IPC listener fault injection is invalid');
  }

  let server = null;
  let started = false;
  let endpointIdentity = null;
  const sockets = new Set();
  const metrics = {
    connectionsAccepted: 0,
    connectionsClosed: 0,
    framesReceived: 0,
    responsesPublished: 0,
    malformedConnections: 0,
    listenerFailures: 0,
    responsePublicationFaults: 0,
    operationDispatches: {
      negotiate: 0, capabilities: 0, submit: 0, reconcile: 0, inspect: 0, cancel: 0,
    },
    dispatchNanoseconds: 0n,
    decodeNanoseconds: 0n,
    physicalDispatchCount: 0,
  };

  function now() {
    const value = monotonicNow();
    if (typeof value !== 'bigint') throw new LocalIpcServerError('INVALID_MONOTONIC_CLOCK');
    return value;
  }

  function sanitizedError(error) {
    if (error instanceof ProtocolError) {
      return Object.freeze({
        classification: error.classification,
        code: error.code,
        message: 'Local IPC operation rejected',
      });
    }
    return Object.freeze({
      classification: 'internal_failure',
      code: 'LOCAL_IPC_SERVICE_FAILURE',
      message: 'Local IPC operation rejected',
    });
  }

  function acceptConnection(socket) {
    metrics.connectionsAccepted += 1;
    sockets.add(socket);
    let stage = 'INITIAL';
    let capabilities = [];
    let queue = Promise.resolve();
    let queuedFrames = 0;
    let malformed = false;
    let expectedMessageSequence = 1;

    function failConnection() {
      if (!malformed) metrics.malformedConnections += 1;
      malformed = true;
      socket.destroy();
    }

    function publish(envelope, closeAfter = false) {
      if (socket.destroyed) return;
      let frame;
      try {
        frame = encodeFrame(envelope, { maxFrameBytes });
      } catch {
        failConnection();
        return;
      }
      socket.write(frame, (error) => {
        if (error) socket.destroy();
        else if (closeAfter && !socket.destroyed) socket.end();
      });
      metrics.responsesPublished += 1;
    }

    async function dispatch(envelope) {
      const startedAt = now();
      let messageId = null;
      try {
        exactFields(envelope, REQUEST_FIELDS);
        if (envelope.transportVersion !== TRANSPORT_VERSION
          || typeof envelope.messageId !== 'string'
          || !/^ipc-[0-9]{12}$/.test(envelope.messageId)
          || !OPERATIONS.has(envelope.operation)
          || !isPlainObject(envelope.payload)) {
          throw new ProtocolError(
            'protocol_failure',
            'MALFORMED_TRANSPORT_ENVELOPE',
            'Local IPC transport envelope is malformed',
          );
        }
        messageId = envelope.messageId;
        if (Number(envelope.messageId.slice(4)) !== expectedMessageSequence) {
          throw new ProtocolError(
            'protocol_failure',
            'INVALID_MESSAGE_SEQUENCE',
            'Local IPC message sequence is invalid',
          );
        }
        expectedMessageSequence += 1;
        assertCredentialFree(envelope.payload);
        if (envelope.operation === 'negotiate') {
          if (stage !== 'INITIAL') {
            throw new ProtocolError(
              'protocol_failure',
              'SESSION_ALREADY_NEGOTIATED',
              'Local IPC session is already negotiated',
            );
          }
        } else if (envelope.operation === 'capabilities') {
          if (stage !== 'NEGOTIATED') {
            throw new ProtocolError(
              'protocol_failure',
              'SESSION_NOT_NEGOTIATED',
              'Local IPC session is not negotiated',
            );
          }
        } else if (stage !== 'VALIDATED' || !capabilities.includes(envelope.operation)) {
          throw new ProtocolError(
            'protocol_failure',
            'SESSION_NOT_VALIDATED',
            'Local IPC session is not validated',
          );
        }
        metrics.operationDispatches[envelope.operation] += 1;
        const result = await options.service[envelope.operation](envelope.payload);
        assertCredentialFree(result);
        if (envelope.operation === 'negotiate') {
          if (result.classification !== 'accepted'
            || result.selectedVersion !== PROTOCOL_VERSION) {
            throw new ProtocolError(
              'protocol_failure',
              'UNSUPPORTED_PROTOCOL_VERSION',
              'Local IPC protocol version is unsupported',
            );
          }
          stage = 'NEGOTIATED';
        } else if (envelope.operation === 'capabilities') {
          if (result.classification !== 'accepted'
            || result.schemaDigest !== SCHEMA_DIGEST
            || result.physicalDispatchEnabled !== options.service.physicalDispatchEnabled) {
            throw new ProtocolError(
              'protocol_failure',
              'INVALID_SESSION_CAPABILITIES',
              'Local IPC capabilities are invalid',
            );
          }
          capabilities = [...result.capabilities];
          stage = 'VALIDATED';
        }
        if (options.faultInjection
          && options.faultInjection.afterDispatchBeforeResponse({
            operation: envelope.operation,
            result: deepFreezeCopy(result),
          }) === 'DROP_CONNECTION') {
          metrics.responsePublicationFaults += 1;
          socket.destroy();
          return;
        }
        publish({
          transportVersion: TRANSPORT_VERSION,
          messageId,
          ok: true,
          payload: result,
        });
      } catch (error) {
        if (messageId === null) {
          failConnection();
          return;
        }
        const invalidatesSession = error instanceof ProtocolError
          && ['protocol_failure', 'authorization_failure'].includes(error.classification);
        publish({
          transportVersion: TRANSPORT_VERSION,
          messageId,
          ok: false,
          error: sanitizedError(error),
        }, invalidatesSession);
        if (invalidatesSession) {
          stage = 'INVALID';
        }
      } finally {
        const finishedAt = now();
        if (finishedAt < startedAt) {
          failConnection();
        } else {
          metrics.dispatchNanoseconds += finishedAt - startedAt;
        }
      }
    }

    const decoder = createLengthPrefixedFrameDecoder({
      maxFrameBytes,
      monotonicNow,
      onDecode(elapsed) {
        metrics.decodeNanoseconds += elapsed;
      },
      onMessage(envelope) {
        metrics.framesReceived += 1;
        queuedFrames += 1;
        socket.pause();
        queue = queue
          .then(() => dispatch(envelope))
          .catch(() => failConnection())
          .finally(() => {
            queuedFrames -= 1;
            if (queuedFrames === 0 && !socket.destroyed) socket.resume();
          });
      },
      onError: failConnection,
    });
    socket.on('data', (chunk) => decoder.push(chunk));
    socket.on('end', () => {
      decoder.end();
      if (!socket.destroyed) socket.end();
    });
    socket.on('error', () => socket.destroy());
    socket.on('close', () => {
      sockets.delete(socket);
      metrics.connectionsClosed += 1;
    });
  }

  async function start() {
    if (started || server) throw new LocalIpcServerError('LISTENER_ALREADY_STARTED');
    if (platform !== process.platform) {
      throw new LocalIpcServerError('PLATFORM_NOT_PHYSICALLY_QUALIFIED');
    }
    const validatedEndpoint = validateEndpoint(options.endpointPath, platform, filesystem);
    let current;
    try {
      current = serverFactory(acceptConnection);
    } catch {
      throw new LocalIpcServerError('LISTENER_START_FAILED');
    }
    server = current;
    await new Promise((resolve, reject) => {
      const failLive = () => {
        metrics.listenerFailures += 1;
        started = false;
        if (server === current) server = null;
        for (const socket of sockets) socket.destroy();
        if (current.listening) current.close(() => {});
      };
      const fail = () => {
        current.removeListener('listening', ready);
        server = null;
        reject(new LocalIpcServerError('LISTENER_START_FAILED'));
      };
      const ready = () => {
        current.removeListener('error', fail);
        current.on('error', failLive);
        resolve();
      };
      current.once('error', fail);
      current.once('listening', ready);
      try {
        current.listen(options.endpointPath);
      } catch {
        fail();
      }
    });
    if (validatedEndpoint.kind === 'UNIX_DOMAIN_SOCKET') {
      try {
        filesystem.chmodSync(options.endpointPath, 0o600);
        const endpoint = filesystem.lstatSync(options.endpointPath);
        const uid = typeof process.getuid === 'function' ? process.getuid() : null;
        if (!endpoint.isSocket() || endpoint.isSymbolicLink()
          || (endpoint.mode & 0o077) !== 0
          || (uid !== null && endpoint.uid !== uid)) {
          throw new Error('endpoint confinement');
        }
        endpointIdentity = Object.freeze({
          device: endpoint.dev,
          inode: endpoint.ino,
          owner: endpoint.uid,
          mode: endpoint.mode & 0o777,
        });
      } catch {
        await new Promise((resolve) => current.close(resolve));
        server = null;
        throw new LocalIpcServerError('ENDPOINT_CONFINEMENT_REJECTED');
      }
    }
    started = true;
    return deepFreezeCopy({
      transportVersion: TRANSPORT_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      endpointPath: options.endpointPath,
      endpointKind: validatedEndpoint.kind,
      physicalDispatchEnabled: options.service.physicalDispatchEnabled,
      peerProcessIdentityAuthenticated: false,
    });
  }

  async function close() {
    const current = server;
    server = null;
    started = false;
    for (const socket of sockets) socket.destroy();
    if (current) {
      await new Promise((resolve) => current.close(() => resolve()));
    }
    if (endpointIdentity && endpointKind(platform) === 'UNIX_DOMAIN_SOCKET') {
      try {
        const endpoint = filesystem.lstatSync(options.endpointPath);
        if (endpoint.isSocket()
          && endpoint.dev === endpointIdentity.device
          && endpoint.ino === endpointIdentity.inode) {
          filesystem.unlinkSync(options.endpointPath);
        }
      } catch (error) {
        if (!error || error.code !== 'ENOENT') {
          endpointIdentity = null;
          throw new LocalIpcServerError('ENDPOINT_CLEANUP_FAILED');
        }
      }
    }
    endpointIdentity = null;
  }

  function inspectMetrics() {
    return deepFreezeCopy({
      connectionsAccepted: metrics.connectionsAccepted,
      connectionsClosed: metrics.connectionsClosed,
      framesReceived: metrics.framesReceived,
      responsesPublished: metrics.responsesPublished,
      malformedConnections: metrics.malformedConnections,
      listenerFailures: metrics.listenerFailures,
      responsePublicationFaults: metrics.responsePublicationFaults,
      operationDispatches: metrics.operationDispatches,
      dispatchNanoseconds: metrics.dispatchNanoseconds.toString(),
      decodeNanoseconds: metrics.decodeNanoseconds.toString(),
      physicalDispatchCount: metrics.physicalDispatchCount,
    });
  }

  return Object.freeze({ start, close, inspectMetrics });
}

module.exports = Object.freeze({
  TRANSPORT_VERSION,
  LocalIpcServerError,
  endpointKind,
  createControlPlaneLocalIpcServer,
});
