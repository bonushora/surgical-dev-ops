'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const path =
  require('node:path');

const {
  EVENT_TYPES,
  FAILURE_CODES,
  createNaturalPresentationStream,
  createNaturalPresentationEvent,
  consumeNaturalPresentationEvent,
  interruptNaturalPresentationStream
} = require(
  '../../accelerator/cli/natural-presentation-stream'
);

function stream(limits) {
  return createNaturalPresentationStream({
    streamId:
      'stream-024-b',
    taskId:
      'task-024-b',
    limits
  });
}

function event(
  current,
  sequence,
  type,
  monotonicMs,
  payload
) {
  return createNaturalPresentationEvent({
    stream:
      current,
    sequence,
    type,
    monotonicMs,
    payload
  });
}

function consume(
  current,
  sequence,
  type,
  monotonicMs,
  payload
) {
  return consumeNaturalPresentationEvent(
    current,
    event(
      current,
      sequence,
      type,
      monotonicMs,
      payload
    )
  );
}

test(
  'canonical stream accepts acknowledgement progress content and validated completion',
  () => {
    let current = stream();

    current = consume(
      current,
      0,
      EVENT_TYPES.ACKNOWLEDGED,
      10,
      {
        message:
          'Solicitação recebida.'
      }
    );

    current = consume(
      current,
      1,
      EVENT_TYPES.PROGRESS,
      20,
      {
        stage:
          'READING_EVIDENCE',
        detail:
          'README.md'
      }
    );

    current = consume(
      current,
      2,
      EVENT_TYPES.CONTENT_DELTA,
      30,
      {
        text:
          'O projeto '
      }
    );

    current = consume(
      current,
      3,
      EVENT_TYPES.CONTENT_DELTA,
      40,
      {
        text:
          'é governado.'
      }
    );

    current = consume(
      current,
      4,
      EVENT_TYPES.COMPLETED,
      50,
      {
        canonicalResultStatus:
          'VALIDATED',
        canonicalResultFingerprint:
          'a'.repeat(64)
      }
    );

    assert.equal(
      current.status,
      'COMPLETED'
    );

    assert.equal(
      current.presentedText,
      'O projeto é governado.'
    );

    assert.equal(
      current.finalResultFingerprint,
      'a'.repeat(64)
    );

    assert.equal(
      current.canonicalResultAccepted,
      true
    );

    assert.equal(
      Object.isFrozen(current),
      true
    );
  }
);

test(
  'partial streamed text is presentation only and never carries operational authority',
  () => {
    let current = stream();

    current = consume(
      current,
      0,
      EVENT_TYPES.ACKNOWLEDGED,
      1,
      {
        message:
          'Working.'
      }
    );

    const delta = event(
      current,
      1,
      EVENT_TYPES.CONTENT_DELTA,
      2,
      {
        text:
          'Untrusted partial text.'
      }
    );

    current =
      consumeNaturalPresentationEvent(
        current,
        delta
      );

    assert.equal(
      delta.presentationOnly,
      true
    );
    assert.equal(
      delta.operationalAuthority,
      false
    );
    assert.equal(
      delta.mutationAuthority,
      false
    );
    assert.equal(
      current.canonicalResultAccepted,
      false
    );
    assert.equal(
      current.status,
      'OPEN'
    );
  }
);

test(
  'completion without one validated canonical fingerprint is rejected before event creation',
  () => {
    const current = stream();

    assert.throws(
      () => event(
        current,
        0,
        EVENT_TYPES.COMPLETED,
        1,
        {
          canonicalResultStatus:
            'PARTIAL',
          canonicalResultFingerprint:
            'a'.repeat(64)
        }
      ),
      /validated canonical result fingerprint/i
    );
  }
);

test(
  'interrupted stream fails closed and cannot later become completed',
  () => {
    let current = stream();

    current = consume(
      current,
      0,
      EVENT_TYPES.ACKNOWLEDGED,
      1,
      {
        message:
          'Working.'
      }
    );

    current =
      interruptNaturalPresentationStream(
        current
      );

    const completed =
      consumeNaturalPresentationEvent(
        current,
        event(
          current,
          1,
          EVENT_TYPES.COMPLETED,
          2,
          {
            canonicalResultStatus:
              'VALIDATED',
            canonicalResultFingerprint:
              'b'.repeat(64)
          }
        )
      );

    assert.equal(
      completed.status,
      'FAILED'
    );
    assert.equal(
      completed.failureCode,
      FAILURE_CODES.INTERRUPTED
    );
    assert.equal(
      completed.canonicalResultAccepted,
      false
    );
  }
);

test(
  'out-of-order mutable mismatched and non-monotonic events fail closed',
  () => {
    const initial = stream();

    const outOfOrder =
      event(
        initial,
        1,
        EVENT_TYPES.ACKNOWLEDGED,
        1,
        {
          message:
            'Working.'
        }
      );

    assert.equal(
      consumeNaturalPresentationEvent(
        initial,
        outOfOrder
      ).failureCode,
      FAILURE_CODES.MALFORMED_EVENT
    );

    const mutable = {
      ...event(
        initial,
        0,
        EVENT_TYPES.ACKNOWLEDGED,
        1,
        {
          message:
            'Working.'
        }
      )
    };

    assert.equal(
      consumeNaturalPresentationEvent(
        initial,
        mutable
      ).failureCode,
      FAILURE_CODES.MALFORMED_EVENT
    );

    let current = consume(
      initial,
      0,
      EVENT_TYPES.ACKNOWLEDGED,
      10,
      {
        message:
          'Working.'
      }
    );

    const staleClock =
      event(
        current,
        1,
        EVENT_TYPES.PROGRESS,
        9,
        {
          stage:
            'READING',
          detail:
            null
        }
      );

    current =
      consumeNaturalPresentationEvent(
        current,
        staleClock
      );

    assert.equal(
      current.failureCode,
      FAILURE_CODES.MALFORMED_EVENT
    );
  }
);

test(
  'event and aggregate presentation bounds fail closed without accepting a result',
  () => {
    let current = stream({
      maxEvents:
        3,
      maxPresentedCharacters:
        5,
      maxEventTextCharacters:
        5
    });

    current = consume(
      current,
      0,
      EVENT_TYPES.ACKNOWLEDGED,
      1,
      {
        message:
          'start'
      }
    );

    current = consume(
      current,
      1,
      EVENT_TYPES.CONTENT_DELTA,
      2,
      {
        text:
          '12345'
      }
    );

    current = consume(
      current,
      2,
      EVENT_TYPES.CONTENT_DELTA,
      3,
      {
        text:
          '6'
      }
    );

    assert.equal(
      current.status,
      'FAILED'
    );
    assert.equal(
      current.failureCode,
      FAILURE_CODES.PRESENTATION_LIMIT_EXCEEDED
    );
    assert.equal(
      current.canonicalResultAccepted,
      false
    );
  }
);

test(
  'authority-bearing payload fields are rejected before entering the stream',
  () => {
    const current = stream();

    assert.throws(
      () => event(
        current,
        0,
        EVENT_TYPES.ACKNOWLEDGED,
        1,
        {
          message:
            'Working.',
          authorization: {
            approved:
              true
          }
        }
      ),
      /forbidden authority field|unexpected field/i
    );
  }
);

test(
  'Portuguese and English presentation text cross the same zero-authority contract',
  () => {
    for (const text of [
      'Analisando evidências.',
      'Analyzing evidence.'
    ]) {
      let current = stream();

      current = consume(
        current,
        0,
        EVENT_TYPES.ACKNOWLEDGED,
        1,
        {
          message:
            text
        }
      );

      assert.equal(
        current.status,
        'OPEN'
      );
      assert.equal(
        current.operationalAuthority,
        false
      );
    }
  }
);

test(
  'stream contract has no filesystem network process provider or mutation dependency',
  () => {
    const source = fs.readFileSync(
      path.join(
        __dirname,
        '../../accelerator/cli/natural-presentation-stream.js'
      ),
      'utf8'
    );

    for (const dependency of [
      "require('node:fs')",
      "require('node:http')",
      "require('node:https')",
      "require('node:child_process')",
      'ollama',
      'provider-adapter',
      'orchestrator'
    ]) {
      assert.equal(
        source.includes(dependency),
        false
      );
    }

    const surface = require(
      '../../accelerator/cli/natural-presentation-stream'
    );

    for (const forbidden of [
      'execute',
      'authorize',
      'approve',
      'grant',
      'write',
      'patch',
      'spawn'
    ]) {
      assert.equal(
        forbidden in surface,
        false
      );
    }
  }
);
