'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CLI_FILE = path.join(
  ROOT,
  'accelerator',
  'cli',
  'surgical.js'
);

const cli = require(CLI_FILE);

test('CLI exposes canonical interactive activation surface', () => {
  assert.equal(
    typeof cli.createInteractiveActivation,
    'function'
  );
});

test('interactive activation derives workspace identity from canonical discovery', () => {
  assert.equal(
    typeof cli.createInteractiveActivation,
    'function'
  );

  const activation = cli.createInteractiveActivation(ROOT);

  assert.equal(
    activation.workspace,
    'surgical-dev-ops'
  );

  assert.equal(
    typeof activation.branch,
    'string'
  );

  assert.ok(activation.branch.length > 0);
});

test('interactive activation preserves deterministic governance defaults', () => {
  assert.equal(
    typeof cli.createInteractiveActivation,
    'function'
  );

  const activation = cli.createInteractiveActivation(ROOT);

  assert.equal(
    activation.mode,
    'DETERMINISTIC'
  );

  assert.equal(
    activation.strategy,
    'PATCH'
  );

  assert.equal(
    activation.orchestrator,
    'ACTIVE'
  );

  assert.equal(
    activation.providers,
    'none'
  );
});

test('interactive activation defaults interaction mode to EXPERT without changing deterministic governance', () => {
  const activation =
    cli.createInteractiveActivation(ROOT);

  assert.equal(
    activation.mode,
    'DETERMINISTIC'
  );

  assert.equal(
    activation.interactionMode.mode,
    'EXPERT'
  );

  assert.equal(
    activation.interactionMode.governance.authorityProfile,
    'CANONICAL'
  );

  assert.equal(
    activation.interactionMode.governance.securityInvariantsReduced,
    false
  );

  assert.ok(
    Object.isFrozen(
      activation.interactionMode
    )
  );
});

test('interactive activation accepts bounded NATURAL and ENGINEER selection', () => {
  for (const mode of [
    'NATURAL',
    'ENGINEER'
  ]) {
    const activation =
      cli.createInteractiveActivation(
        ROOT,
        mode
      );

    assert.equal(
      activation.mode,
      'DETERMINISTIC'
    );

    assert.equal(
      activation.interactionMode.mode,
      mode
    );

    assert.equal(
      activation.interactionMode.governance.authorityProfile,
      'CANONICAL'
    );

    assert.equal(
      activation.interactionMode.governance.securityInvariantsReduced,
      false
    );
  }
});

test('interactive activation rejects unknown interaction modes fail closed', () => {
  assert.throws(
    () =>
      cli.createInteractiveActivation(
        ROOT,
        'UNRESTRICTED'
      ),
    /interaction mode/i
  );
});

test('interactive activation identifies the canonical protocols', () => {
  assert.equal(
    typeof cli.createInteractiveActivation,
    'function'
  );

  const activation = cli.createInteractiveActivation(ROOT);

  assert.equal(
    activation.protocols.bhSep,
    '2.2'
  );

  assert.equal(
    activation.protocols.bhSdp,
    '2.2'
  );
});

test('interactive activation formatter exposes the stable human surface', () => {
  assert.equal(
    typeof cli.createInteractiveActivation,
    'function'
  );

  assert.equal(
    typeof cli.formatInteractiveActivation,
    'function'
  );

  const activation = cli.createInteractiveActivation(ROOT);
  const output = cli.formatInteractiveActivation(activation);

  assert.match(
    output,
    /Surgical DevOps v2\.6\.0-rc\.2/
  );

  assert.match(
    output,
    /BH-SEP v2\.2 E BH-SDP v2\.2 ATIVADOS/
  );

  assert.match(
    output,
    /Workspace: surgical-dev-ops/
  );

  assert.match(
    output,
    /Branch:/
  );

  assert.match(
    output,
    /Mode: DETERMINISTIC/
  );

  assert.match(
    output,
    /Strategy: PATCH/
  );

  assert.match(
    output,
    /Orchestrator: ACTIVE/
  );

  assert.match(
    output,
    /Providers: none/
  );

  assert.match(
    output,
    /surgical> /
  );
});

test('interactive activation does not itself invoke orchestration', () => {
  assert.equal(
    typeof cli.createInteractiveActivation,
    'function'
  );

  const activation = cli.createInteractiveActivation(ROOT);

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      activation,
      'execution'
    ),
    false
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      activation,
      'authorization'
    ),
    false
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      activation,
      'grant'
    ),
    false
  );
});
