'use strict';

const crypto =
  require('node:crypto');

const STREAM_SCHEMA =
  'sdo.natural_presentation_stream.v1';

const EVENT_SCHEMA =
  'sdo.natural_presentation_event.v1';

const EVENT_TYPES = Object.freeze({
  ACKNOWLEDGED:
    'ACKNOWLEDGED',

  PROGRESS:
    'PROGRESS',

  CONTENT_DELTA:
    'CONTENT_DELTA',

  COMPLETED:
    'COMPLETED',

  FAILED:
    'FAILED'
});

const TERMINAL_TYPES =
  new Set([
    EVENT_TYPES.COMPLETED,
    EVENT_TYPES.FAILED
  ]);

const DEFAULT_LIMITS = Object.freeze({
  maxEvents:
    256,

  maxPresentedCharacters:
    12000,

  maxEventTextCharacters:
    2000
});

const FAILURE_CODES = Object.freeze({
  INTERRUPTED:
    'INTERRUPTED',

  MALFORMED_EVENT:
    'MALFORMED_EVENT',

  EVENT_LIMIT_EXCEEDED:
    'EVENT_LIMIT_EXCEEDED',

  PRESENTATION_LIMIT_EXCEEDED:
    'PRESENTATION_LIMIT_EXCEEDED'
});

const FORBIDDEN_KEYS =
  new Set([
    'authorization',
    'approval',
    'capabilityGrant',
    'command',
    'credential',
    'execution',
    'grant',
    'mutation',
    'patch',
    'privateKey',
    'shell',
    'write'
  ]);

function deepFreeze(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function exactKeys(value, expected, name) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${name} must be an object.`
    );
  }

  const actual =
    Object.keys(value).sort();

  const canonical =
    [...expected].sort();

  if (
    actual.length !== canonical.length ||
    actual.some(
      (key, index) =>
        key !== canonical[index]
    )
  ) {
    throw new Error(
      `${name} contains an unexpected field.`
    );
  }
}

function requiredText(value, name, limit = 256) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > limit
  ) {
    throw new Error(
      `${name} is invalid.`
    );
  }

  return value;
}

function nonNegativeInteger(value, name) {
  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(
      `${name} must be a non-negative safe integer.`
    );
  }

  return value;
}

function positiveInteger(value, name) {
  if (
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throw new Error(
      `${name} must be a positive safe integer.`
    );
  }

  return value;
}

function rejectAuthorityKeys(value, depth = 0) {
  if (depth > 6) {
    throw new Error(
      'Presentation event nesting exceeds the canonical bound.'
    );
  }

  if (
    !value ||
    typeof value !== 'object'
  ) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(
        `Presentation event contains forbidden authority field: ${key}.`
      );
    }

    rejectAuthorityKeys(
      child,
      depth + 1
    );
  }
}

function normalizeLimits(value = {}) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(
      'Presentation stream limits are invalid.'
    );
  }

  for (const key of Object.keys(value)) {
    if (!(key in DEFAULT_LIMITS)) {
      throw new Error(
        'Presentation stream limits contain an unexpected field.'
      );
    }
  }

  return deepFreeze({
    maxEvents:
      positiveInteger(
        value.maxEvents ??
          DEFAULT_LIMITS.maxEvents,
        'maxEvents'
      ),

    maxPresentedCharacters:
      positiveInteger(
        value.maxPresentedCharacters ??
          DEFAULT_LIMITS.maxPresentedCharacters,
        'maxPresentedCharacters'
      ),

    maxEventTextCharacters:
      positiveInteger(
        value.maxEventTextCharacters ??
          DEFAULT_LIMITS.maxEventTextCharacters,
        'maxEventTextCharacters'
      )
  });
}

function streamFingerprint(
  streamId,
  taskId,
  limits
) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        schema:
          STREAM_SCHEMA,
        streamId,
        taskId,
        limits
      })
    )
    .digest('hex');
}

function createNaturalPresentationStream(
  {
    streamId,
    taskId,
    limits
  } = {}
) {
  const canonicalStreamId =
    requiredText(
      streamId,
      'streamId'
    );

  const canonicalTaskId =
    requiredText(
      taskId,
      'taskId'
    );

  const canonicalLimits =
    normalizeLimits(limits);

  return deepFreeze({
    schema:
      STREAM_SCHEMA,

    streamId:
      canonicalStreamId,

    taskId:
      canonicalTaskId,

    streamFingerprint:
      streamFingerprint(
        canonicalStreamId,
        canonicalTaskId,
        canonicalLimits
      ),

    status:
      'OPEN',

    nextSequence:
      0,

    lastMonotonicMs:
      null,

    eventCount:
      0,

    presentedText:
      '',

    finalResultFingerprint:
      null,

    failureCode:
      null,

    limits:
      canonicalLimits,

    presentationOnly:
      true,

    canonicalResultAccepted:
      false,

    operationalAuthority:
      false,

    mutationAuthority:
      false
  });
}

function payloadFor(type, payload, limits) {
  rejectAuthorityKeys(payload);

  if (type === EVENT_TYPES.ACKNOWLEDGED) {
    exactKeys(
      payload,
      ['message'],
      'Acknowledgement payload'
    );

    return deepFreeze({
      message:
        requiredText(
          payload.message,
          'message',
          limits.maxEventTextCharacters
        )
    });
  }

  if (type === EVENT_TYPES.PROGRESS) {
    exactKeys(
      payload,
      ['detail', 'stage'],
      'Progress payload'
    );

    return deepFreeze({
      stage:
        requiredText(
          payload.stage,
          'stage',
          128
        ),

      detail:
        payload.detail === null
          ? null
          : requiredText(
              payload.detail,
              'detail',
              limits.maxEventTextCharacters
            )
    });
  }

  if (type === EVENT_TYPES.CONTENT_DELTA) {
    exactKeys(
      payload,
      ['text'],
      'Content delta payload'
    );

    return deepFreeze({
      text:
        requiredText(
          payload.text,
          'text',
          limits.maxEventTextCharacters
        )
    });
  }

  if (type === EVENT_TYPES.COMPLETED) {
    exactKeys(
      payload,
      [
        'canonicalResultFingerprint',
        'canonicalResultStatus'
      ],
      'Completion payload'
    );

    if (
      payload.canonicalResultStatus !==
        'VALIDATED' ||
      typeof payload.canonicalResultFingerprint !==
        'string' ||
      !/^[a-f0-9]{64}$/.test(
        payload.canonicalResultFingerprint
      )
    ) {
      throw new Error(
        'Completion requires one validated canonical result fingerprint.'
      );
    }

    return deepFreeze({
      canonicalResultStatus:
        'VALIDATED',

      canonicalResultFingerprint:
        payload.canonicalResultFingerprint
    });
  }

  if (type === EVENT_TYPES.FAILED) {
    exactKeys(
      payload,
      ['reasonCode'],
      'Failure payload'
    );

    return deepFreeze({
      reasonCode:
        requiredText(
          payload.reasonCode,
          'reasonCode',
          128
        )
    });
  }

  throw new Error(
    'Unknown presentation event type.'
  );
}

function createNaturalPresentationEvent(
  {
    stream,
    sequence,
    type,
    monotonicMs,
    payload
  } = {}
) {
  validateStream(stream);

  if (
    !Object.values(EVENT_TYPES)
      .includes(type)
  ) {
    throw new Error(
      'Presentation event type is invalid.'
    );
  }

  return deepFreeze({
    schema:
      EVENT_SCHEMA,

    streamId:
      stream.streamId,

    streamFingerprint:
      stream.streamFingerprint,

    sequence:
      nonNegativeInteger(
        sequence,
        'sequence'
      ),

    type,

    monotonicMs:
      nonNegativeInteger(
        monotonicMs,
        'monotonicMs'
      ),

    payload:
      payloadFor(
        type,
        payload,
        stream.limits
      ),

    presentationOnly:
      true,

    operationalAuthority:
      false,

    mutationAuthority:
      false
  });
}

function validateStream(stream) {
  if (
    !stream ||
    stream.schema !== STREAM_SCHEMA ||
    Object.isFrozen(stream) !== true ||
    stream.presentationOnly !== true ||
    stream.operationalAuthority !== false ||
    stream.mutationAuthority !== false
  ) {
    throw new Error(
      'Immutable canonical presentation stream is required.'
    );
  }
}

function failedStream(stream, failureCode) {
  return deepFreeze({
    ...stream,
    status:
      'FAILED',
    failureCode,
    canonicalResultAccepted:
      false,
    finalResultFingerprint:
      null,
    operationalAuthority:
      false,
    mutationAuthority:
      false
  });
}

function consumeNaturalPresentationEvent(
  stream,
  event
) {
  validateStream(stream);

  if (stream.status !== 'OPEN') {
    return stream;
  }

  try {
    if (
      !event ||
      event.schema !== EVENT_SCHEMA ||
      Object.isFrozen(event) !== true ||
      event.streamId !== stream.streamId ||
      event.streamFingerprint !== stream.streamFingerprint ||
      event.sequence !== stream.nextSequence ||
      event.presentationOnly !== true ||
      event.operationalAuthority !== false ||
      event.mutationAuthority !== false ||
      !Number.isSafeInteger(event.monotonicMs) ||
      event.monotonicMs < 0 ||
      (
        stream.lastMonotonicMs !== null &&
        event.monotonicMs < stream.lastMonotonicMs
      )
    ) {
      throw new Error(
        'Presentation event binding is invalid.'
      );
    }

    const first =
      stream.eventCount === 0;

    if (
      (first && event.type !== EVENT_TYPES.ACKNOWLEDGED) ||
      (!first && event.type === EVENT_TYPES.ACKNOWLEDGED)
    ) {
      throw new Error(
        'Presentation event order is invalid.'
      );
    }

    const canonicalPayload =
      payloadFor(
        event.type,
        event.payload,
        stream.limits
      );

    const nextEventCount =
      stream.eventCount + 1;

    if (
      nextEventCount >
        stream.limits.maxEvents
    ) {
      return failedStream(
        stream,
        FAILURE_CODES.EVENT_LIMIT_EXCEEDED
      );
    }

    const delta =
      event.type === EVENT_TYPES.CONTENT_DELTA
        ? canonicalPayload.text
        : '';

    const presentedText =
      stream.presentedText + delta;

    if (
      presentedText.length >
        stream.limits.maxPresentedCharacters
    ) {
      return failedStream(
        stream,
        FAILURE_CODES.PRESENTATION_LIMIT_EXCEEDED
      );
    }

    const terminal =
      TERMINAL_TYPES.has(event.type);

    return deepFreeze({
      ...stream,
      status:
        event.type === EVENT_TYPES.COMPLETED
          ? 'COMPLETED'
          : event.type === EVENT_TYPES.FAILED
            ? 'FAILED'
            : 'OPEN',
      nextSequence:
        event.sequence + 1,
      lastMonotonicMs:
        event.monotonicMs,
      eventCount:
        nextEventCount,
      presentedText,
      finalResultFingerprint:
        event.type === EVENT_TYPES.COMPLETED
          ? canonicalPayload.canonicalResultFingerprint
          : null,
      failureCode:
        event.type === EVENT_TYPES.FAILED
          ? canonicalPayload.reasonCode
          : null,
      canonicalResultAccepted:
        event.type === EVENT_TYPES.COMPLETED,
      presentationOnly:
        true,
      operationalAuthority:
        false,
      mutationAuthority:
        false,
      terminal
    });
  } catch {
    return failedStream(
      stream,
      FAILURE_CODES.MALFORMED_EVENT
    );
  }
}

function interruptNaturalPresentationStream(
  stream
) {
  validateStream(stream);

  if (stream.status !== 'OPEN') {
    return stream;
  }

  return failedStream(
    stream,
    FAILURE_CODES.INTERRUPTED
  );
}

module.exports = Object.freeze({
  EVENT_TYPES,
  FAILURE_CODES,
  createNaturalPresentationStream,
  createNaturalPresentationEvent,
  consumeNaturalPresentationEvent,
  interruptNaturalPresentationStream
});
