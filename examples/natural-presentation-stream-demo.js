'use strict';

const {
  EVENT_TYPES,
  createNaturalPresentationStream,
  createNaturalPresentationEvent,
  consumeNaturalPresentationEvent
} = require(
  '../accelerator/cli/natural-presentation-stream'
);

let stream =
  createNaturalPresentationStream({
    streamId:
      'adr-024-b-demo',
    taskId:
      'project-explanation-demo'
  });

function emit(type, monotonicMs, payload) {
  const event =
    createNaturalPresentationEvent({
      stream,
      sequence:
        stream.nextSequence,
      type,
      monotonicMs,
      payload
    });

  stream =
    consumeNaturalPresentationEvent(
      stream,
      event
    );
}

emit(
  EVENT_TYPES.ACKNOWLEDGED,
  10,
  {
    message:
      'Request received.'
  }
);

emit(
  EVENT_TYPES.PROGRESS,
  20,
  {
    stage:
      'READING_EVIDENCE',
    detail:
      'README.md'
  }
);

emit(
  EVENT_TYPES.CONTENT_DELTA,
  30,
  {
    text:
      'Surgical DevOps keeps streamed text '
  }
);

emit(
  EVENT_TYPES.CONTENT_DELTA,
  40,
  {
    text:
      'outside operational authority.'
  }
);

emit(
  EVENT_TYPES.COMPLETED,
  50,
  {
    canonicalResultStatus:
      'VALIDATED',
    canonicalResultFingerprint:
      'a'.repeat(64)
  }
);

process.stdout.write(
  JSON.stringify(
    {
      schema:
        'sdo.natural_presentation_stream_demo.v1',
      status:
        stream.status,
      eventCount:
        stream.eventCount,
      canonicalResultAccepted:
        stream.canonicalResultAccepted,
      presentationOnly:
        stream.presentationOnly,
      operationalAuthority:
        stream.operationalAuthority,
      mutationAuthority:
        stream.mutationAuthority
    },
    null,
    2
  ) + '\n'
);

if (
  stream.status !== 'COMPLETED' ||
  stream.canonicalResultAccepted !== true ||
  stream.operationalAuthority !== false ||
  stream.mutationAuthority !== false
) {
  process.exitCode = 1;
}
