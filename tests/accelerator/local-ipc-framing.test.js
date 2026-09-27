'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

function framing() {
  return require('../../accelerator/adapters/local-ipc-framing');
}

test('complete received frame dispatches synchronously without polling or delay', () => {
  const { createLengthPrefixedFrameDecoder, encodeFrame } = framing();
  const messages = [];
  const decodeDurations = [];
  const ticks = [10n, 14n];
  const decoder = createLengthPrefixedFrameDecoder({
    onMessage: (message) => messages.push(message),
    onError: assert.fail,
    onDecode: (elapsed) => decodeDurations.push(elapsed),
    monotonicNow: () => ticks.shift(),
  });

  decoder.push(encodeFrame({ operation: 'submit', payload: { value: 1 } }));

  assert.deepEqual(messages, [{ operation: 'submit', payload: { value: 1 } }]);
  assert.deepEqual(decodeDurations, [4n]);
});

test('incomplete frame never dispatches and fails closed when the stream ends', () => {
  const { createLengthPrefixedFrameDecoder, encodeFrame } = framing();
  const messages = [];
  const errors = [];
  const frame = encodeFrame({ operation: 'submit', payload: { value: 1 } });
  const decoder = createLengthPrefixedFrameDecoder({
    onMessage: (message) => messages.push(message),
    onError: (error) => errors.push(error),
  });

  decoder.push(frame.subarray(0, frame.length - 1));
  assert.deepEqual(messages, []);
  decoder.end();

  assert.deepEqual(messages, []);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'TRUNCATED_FRAME');
});

test('oversized frame fails closed before payload allocation or dispatch', () => {
  const { createLengthPrefixedFrameDecoder } = framing();
  const errors = [];
  const header = Buffer.alloc(4);
  header.writeUInt32BE(65_537, 0);
  const decoder = createLengthPrefixedFrameDecoder({
    maxFrameBytes: 65_536,
    onMessage: assert.fail,
    onError: (error) => errors.push(error),
  });

  decoder.push(header);

  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'FRAME_TOO_LARGE');
});

test('invalid JSON frame fails closed without dispatch', () => {
  const { createLengthPrefixedFrameDecoder } = framing();
  const errors = [];
  const body = Buffer.from('{invalid', 'utf8');
  const frame = Buffer.alloc(4 + body.length);
  frame.writeUInt32BE(body.length, 0);
  body.copy(frame, 4);
  const decoder = createLengthPrefixedFrameDecoder({
    onMessage: assert.fail,
    onError: (error) => errors.push(error),
  });

  decoder.push(frame);

  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'INVALID_JSON_FRAME');
});
