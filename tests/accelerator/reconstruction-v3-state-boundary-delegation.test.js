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


test(
  'R1.3 production state boundary derives all lifecycle vocabulary from the canonical contract',
  () => {
    const source = fs.readFileSync(
      SOURCE,
      'utf8'
    );

    assert.match(
      source,
      /describeOperationStateContract/
    );

    assert.match(
      source,
      /OPERATION_STATE_CONTRACT\.lifecycleStates/
    );

    assert.match(
      source,
      /OPERATION_STATE_CONTRACT\.initialLifecycleStates/
    );

    assert.match(
      source,
      /OPERATION_STATE_CONTRACT\.terminalLifecycleStates/
    );

    assert.match(
      source,
      /OPERATION_STATE_CONTRACT\.transitionTypes/
    );

    assert.doesNotMatch(
      source,
      /new Set\(\['PENDING', 'COMPLETED', 'FAILED', 'NOT_EXECUTABLE'\]\)/
    );

    assert.doesNotMatch(
      source,
      /state !== 'PENDING' && state !== 'NOT_EXECUTABLE'/
    );

    assert.doesNotMatch(
      source,
      /type !== 'COMPLETE' && type !== 'FAIL'/
    );
  }
);


test(
  'R1.4 production state boundary delegates classification with legacy-compatible inputs',
  () => {
    const source = fs.readFileSync(
      SOURCE,
      'utf8'
    );

    assert.match(
      source,
      /classifyStateBoundary/
    );

    assert.match(
      source,
      /authorizationStatus:[\s\S]*'NOT_AUTHORIZED'/
    );

    assert.match(
      source,
      /outcome:[\s\S]*=== 'FAILED'[\s\S]*\? 'FAILED'[\s\S]*: null/
    );

    assert.match(
      source,
      /afterPresent:[\s\S]*boundary\.state\.after !== null/
    );

    assert.match(
      source,
      /status: classification\.status/
    );

    assert.doesNotMatch(
      source,
      /status: 'UNKNOWN'/
    );

    assert.doesNotMatch(
      source,
      /status: 'PENDING_AFTER_STATE'/
    );
  }
);
