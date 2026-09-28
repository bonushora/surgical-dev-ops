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

test(
  'package exposes telemetry server and read-only metrics CLI',
  () => {
    const pkg =
      JSON.parse(
        fs.readFileSync(
          path.join(
            ROOT,
            'package.json'
          ),
          'utf8'
        )
      );

    assert.equal(
      pkg.bin['surgical-metrics'],
      'accelerator/cli/surgical-metrics.js'
    );

    assert.equal(
      pkg.bin['surgical-telemetry-server'],
      'accelerator/cli/surgical-telemetry-server.js'
    );

    assert.ok(
      Array.isArray(
        pkg.files
      )
    );

    for (const required of [
      'accelerator/cli/',
      'accelerator/core/',
      'accelerator/telemetry/'
    ]) {
      assert.equal(
        pkg.files.includes(required),
        true
      );
    }

    assert.equal(
      pkg.files.includes('accelerator/ci/'),
      false
    );
  }
);

test(
  'metrics CLI contains no embedded administrative credential',
  () => {
    const source =
      fs.readFileSync(
        path.join(
          ROOT,
          'accelerator/cli/surgical-metrics.js'
        ),
        'utf8'
      );

    assert.match(
      source,
      /SDO_TELEMETRY_ADMIN_TOKEN/
    );

    assert.doesNotMatch(
      source,
      /Bearer [A-Za-z0-9_-]{24,}/
    );
  }
);

test(
  'session telemetry is explicitly best effort and outside operational authority',
  () => {
    const source =
      fs.readFileSync(
        path.join(
          ROOT,
          'accelerator/telemetry/session-telemetry.js'
        ),
        'utf8'
      );

    assert.match(
      source,
      /outside Surgical Orchestrator authority/
    );

    assert.match(
      source,
      /No telemetry condition may authorize, deny/
    );
  }
);
