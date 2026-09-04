'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const path =
  require('node:path');

const ROOT =
  path.resolve(
    __dirname,
    '../..'
  );

const SURGICAL =
  path.join(
    ROOT,
    'accelerator/cli/surgical.js'
  );

test(
  'real Surgical CLI composes canonical producer HTTP transport from explicit telemetry environment',
  () => {
    const source =
      fs.readFileSync(
        SURGICAL,
        'utf8'
      );

    assert.match(
      source,
      /createTelemetryProducerHttpTransport/
    );

    assert.match(
      source,
      /SDO_TELEMETRY_ENDPOINT/
    );

    assert.match(
      source,
      /SDO_TELEMETRY_PRODUCER_TOKEN/
    );

    assert.match(
      source,
      /createTelemetryProducer\(\{[\s\S]*transport[\s\S]*\}\)/
    );
  }
);

test(
  'runtime campaign binding remains exact local/local until separately changed',
  () => {
    const source =
      fs.readFileSync(
        SURGICAL,
        'utf8'
      );

    assert.match(
      source,
      /tenant:\s*['"]local['"]/
    );

    assert.match(
      source,
      /project:\s*['"]local['"]/
    );
  }
);

test(
  'runtime composition does not embed producer credential material',
  () => {
    const source =
      fs.readFileSync(
        SURGICAL,
        'utf8'
      );

    assert.doesNotMatch(
      source,
      /Bearer\s+[A-Za-z0-9._~+/-]{12,}/
    );

    assert.doesNotMatch(
      source,
      /producer-secret-token-value/
    );
  }
);
