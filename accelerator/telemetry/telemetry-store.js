'use strict';

const fs =
  require('node:fs');

const path =
  require('node:path');

const {
  validateTelemetryEvent
} = require(
  './event-contract'
);

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

function validateStorageRoot(root) {
  if (
    typeof root !== 'string' ||
    !root ||
    !path.isAbsolute(root)
  ) {
    throw new Error(
      'Telemetry storage root must be absolute.'
    );
  }

  fs.mkdirSync(
    root,
    {
      recursive: true,
      mode: 0o700
    }
  );

  const stat =
    fs.lstatSync(root);

  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink()
  ) {
    throw new Error(
      'Telemetry storage root is unsafe.'
    );
  }

  return fs.realpathSync(root);
}

function countMap(values) {
  const counts =
    Object.create(null);

  for (const value of values) {
    counts[value] =
      (counts[value] || 0) + 1;
  }

  return counts;
}

function createTelemetryStore(
  {
    storageRoot
  }
) {
  const root =
    validateStorageRoot(
      storageRoot
    );

  const eventsFile =
    path.join(
      root,
      'events.jsonl'
    );

  function append(input) {
    const event =
      validateTelemetryEvent(
        input
      );

    fs.appendFileSync(
      eventsFile,
      JSON.stringify(event) + '\n',
      {
        encoding: 'utf8',
        mode: 0o600
      }
    );

    return deepFreeze({
      schema:
        'sdo.telemetry_store_receipt.v1',

      accepted:
        true,

      eventId:
        event.eventId
    });
  }

  function readAll() {
    if (!fs.existsSync(eventsFile)) {
      return [];
    }

    const stat =
      fs.lstatSync(eventsFile);

    if (
      !stat.isFile() ||
      stat.isSymbolicLink()
    ) {
      throw new Error(
        'Telemetry event store is unsafe.'
      );
    }

    const text =
      fs.readFileSync(
        eventsFile,
        'utf8'
      );

    if (!text.trim()) {
      return [];
    }

    return text
      .split('\n')
      .filter(Boolean)
      .map(
        (line) =>
          validateTelemetryEvent(
            JSON.parse(line)
          )
      );
  }

  function metrics(
    now =
      new Date()
  ) {
    const events =
      readAll();

    const nowMs =
      now instanceof Date
        ? now.getTime()
        : Date.parse(now);

    if (!Number.isFinite(nowMs)) {
      throw new Error(
        'Metrics clock is invalid.'
      );
    }

    const installations =
      new Map();

    for (const event of events) {
      const timestamp =
        Date.parse(
          event.occurredAt
        );

      const previous =
        installations.get(
          event.installationId
        );

      if (
        !previous ||
        timestamp > previous
      ) {
        installations.set(
          event.installationId,
          timestamp
        );
      }
    }

    function activeSince(
      milliseconds
    ) {
      let count =
        0;

      for (
        const timestamp
        of installations.values()
      ) {
        if (
          timestamp >=
          nowMs - milliseconds
        ) {
          count += 1;
        }
      }

      return count;
    }

    return deepFreeze({
      schema:
        'sdo.telemetry_metrics.v1',

      generatedAt:
        new Date(nowMs).toISOString(),

      installations: {
        total:
          installations.size,

        active24h:
          activeSince(
            24 * 60 * 60 * 1000
          ),

        active7d:
          activeSince(
            7 * 24 * 60 * 60 * 1000
          ),

        active30d:
          activeSince(
            30 * 24 * 60 * 60 * 1000
          )
      },

      sessions:
        events.filter(
          (event) =>
            event.eventType ===
            'SESSION_STARTED'
        ).length,

      interactionModes:
        countMap(
          events.map(
            (event) =>
              event.interactionMode
          )
        ),

      platforms:
        countMap(
          events.map(
            (event) =>
              event.platform
          )
        ),

      versions:
        countMap(
          events.map(
            (event) =>
              event.version
          )
        )
    });
  }

  return Object.freeze({
    append,
    metrics
  });
}

module.exports = {
  createTelemetryStore
};
