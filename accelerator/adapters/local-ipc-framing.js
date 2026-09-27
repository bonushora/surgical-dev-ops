'use strict';

const { TextDecoder } = require('node:util');

const DEFAULT_MAX_FRAME_BYTES = 65_536;
const HEADER_BYTES = 4;
const OPTION_FIELDS = new Set([
  'maxFrameBytes', 'onMessage', 'onError', 'onDecode', 'monotonicNow',
]);

class LocalIpcFramingError extends Error {
  constructor(code) {
    super('Local IPC frame rejected');
    this.name = 'LocalIpcFramingError';
    this.code = code;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalSerialize(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new LocalIpcFramingError('INVALID_FRAME_VALUE');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object' || ancestors.has(value)) {
    throw new LocalIpcFramingError('INVALID_FRAME_VALUE');
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const allowed = new Set(['length']);
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          throw new LocalIpcFramingError('INVALID_FRAME_VALUE');
        }
        allowed.add(String(index));
      }
      if (Reflect.ownKeys(value).some(
        (key) => typeof key !== 'string' || !allowed.has(key),
      )) throw new LocalIpcFramingError('INVALID_FRAME_VALUE');
      return `[${value.map((entry) => canonicalSerialize(entry, ancestors)).join(',')}]`;
    }
    if (!isPlainObject(value)
      || Reflect.ownKeys(value).some((key) => typeof key !== 'string')
      || Object.values(value).some((entry) => entry === undefined)) {
      throw new LocalIpcFramingError('INVALID_FRAME_VALUE');
    }
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalSerialize(value[key], ancestors)}`
    ).join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
}

function requireMaxFrameBytes(value) {
  const result = value === undefined ? DEFAULT_MAX_FRAME_BYTES : value;
  if (!Number.isSafeInteger(result) || result < 1 || result > 16 * 1024 * 1024) {
    throw new TypeError('Local IPC maximum frame size is invalid');
  }
  return result;
}

function encodeFrame(message, options = {}) {
  if (!isPlainObject(options)
    || Reflect.ownKeys(options).some((key) => key !== 'maxFrameBytes')) {
    throw new TypeError('Local IPC frame encoding options are invalid');
  }
  const maxFrameBytes = requireMaxFrameBytes(options.maxFrameBytes);
  const body = Buffer.from(canonicalSerialize(message), 'utf8');
  if (body.length === 0) throw new LocalIpcFramingError('ZERO_LENGTH_FRAME');
  if (body.length > maxFrameBytes) throw new LocalIpcFramingError('FRAME_TOO_LARGE');
  const frame = Buffer.allocUnsafe(HEADER_BYTES + body.length);
  frame.writeUInt32BE(body.length, 0);
  body.copy(frame, HEADER_BYTES);
  return frame;
}

function createLengthPrefixedFrameDecoder(options) {
  if (!isPlainObject(options)
    || Reflect.ownKeys(options).some((key) => typeof key !== 'string' || !OPTION_FIELDS.has(key))
    || typeof options.onMessage !== 'function'
    || typeof options.onError !== 'function'
    || (options.onDecode !== undefined && typeof options.onDecode !== 'function')) {
    throw new TypeError('Local IPC frame decoder options are invalid');
  }
  const maxFrameBytes = requireMaxFrameBytes(options.maxFrameBytes);
  const monotonicNow = options.monotonicNow || process.hrtime.bigint;
  if (typeof monotonicNow !== 'function') {
    throw new TypeError('Local IPC monotonic clock is invalid');
  }
  const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  let pending = Buffer.alloc(0);
  let closed = false;
  let framesDecoded = 0;
  let decodeNanoseconds = 0n;

  function fail(code) {
    if (closed) return;
    closed = true;
    pending = Buffer.alloc(0);
    options.onError(new LocalIpcFramingError(code));
  }

  function push(chunk) {
    if (closed) return 0;
    if (!Buffer.isBuffer(chunk)) {
      fail('INVALID_FRAME_CHUNK');
      return 0;
    }
    if (chunk.length > 0) pending = Buffer.concat([pending, chunk]);
    let dispatched = 0;
    while (!closed && pending.length >= HEADER_BYTES) {
      const length = pending.readUInt32BE(0);
      if (length === 0) {
        fail('ZERO_LENGTH_FRAME');
        break;
      }
      if (length > maxFrameBytes) {
        fail('FRAME_TOO_LARGE');
        break;
      }
      if (pending.length < HEADER_BYTES + length) break;
      const body = pending.subarray(HEADER_BYTES, HEADER_BYTES + length);
      pending = pending.subarray(HEADER_BYTES + length);
      const started = monotonicNow();
      let message;
      try {
        message = JSON.parse(utf8.decode(body));
      } catch {
        fail('INVALID_JSON_FRAME');
        break;
      }
      const finished = monotonicNow();
      if (typeof started !== 'bigint' || typeof finished !== 'bigint' || finished < started) {
        fail('INVALID_MONOTONIC_CLOCK');
        break;
      }
      framesDecoded += 1;
      const elapsed = finished - started;
      decodeNanoseconds += elapsed;
      if (options.onDecode) options.onDecode(elapsed);
      dispatched += 1;
      options.onMessage(message);
    }
    return dispatched;
  }

  function end() {
    if (closed) return;
    if (pending.length !== 0) {
      fail('TRUNCATED_FRAME');
      return;
    }
    closed = true;
  }

  function inspectMetrics() {
    return Object.freeze({
      framesDecoded,
      decodeNanoseconds: decodeNanoseconds.toString(),
      pendingBytes: pending.length,
    });
  }

  return Object.freeze({ push, end, inspectMetrics });
}

module.exports = Object.freeze({
  DEFAULT_MAX_FRAME_BYTES,
  HEADER_BYTES,
  LocalIpcFramingError,
  canonicalSerialize,
  encodeFrame,
  createLengthPrefixedFrameDecoder,
});
