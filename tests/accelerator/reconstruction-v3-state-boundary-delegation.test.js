'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

const SOURCE = path.join(
  ROOT,
  'accelerator/core/state-boundary.js'
);

test(
  'R1.2 production state boundary delegates lifecycle resolution to the canonical contract',
  () => {
    const source = fs.readFileSync(
      SOURCE,
      'utf8'
    );

    assert.match(
      source,
      /resolveLifecycleTransition/
    );

    assert.match(
      source,
      /require\('\.\.\/reconstruction\/v3\/core\/operation-state-contract'\)/
    );

    assert.match(
      source,
      /currentStatus:\s*lifecycle\.status/
    );

    assert.match(
      source,
      /transitionType:\s*normalized\.type/
    );

    assert.doesNotMatch(
      source,
      /normalized\.type\s*===\s*'COMPLETE'\s*\?\s*'COMPLETED'\s*:\s*'FAILED'/
    );
  }
);
