'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PassThrough } = require('node:stream');
const test = require('node:test');

const cli = require('../../accelerator/cli/surgical');

const {
  createNaturalSessionControl
} = require('../../accelerator/cli/natural-session-control');

const root = path.resolve(__dirname, '../..');

test('RUNNER_START changes the same work-mode seam consumed by the runtime', () => {
  const control = createNaturalSessionControl({
    workspace: 'surgical-dev-ops',
    language: 'pt-BR'
  });

  const started = control.handle('runner');

  assert.equal(started.matched, true);
  assert.equal(started.action, 'RUNNER_START');
  assert.equal(started.intent, 'AUTONOMOUS_UNTIL_GREEN');
  assert.equal(started.authorityExpansion, false);
  assert.equal(started.publicationAuthority, false);
  assert.equal(started.workMode, control.currentWorkMode());
});

test('surgical.js routes human input through session control and consumes its current work mode', async () => {
  const source = fs.readFileSync(
    path.join(root, 'accelerator/cli/surgical.js'),
    'utf8'
  );
  const input = new PassThrough();
  const output = new PassThrough();
  const handledLines = [];
  const control = createNaturalSessionControl({
    workspace: 'surgical-dev-ops',
    workspaceRoot: root,
    language: 'pt-BR'
  });
  const sessionControl = Object.freeze({
    ...control,
    handle(line) {
      handledLines.push(line);
      return control.handle(line);
    }
  });
  const session = cli.createInteractiveSession(
    Object.freeze({
      repositoryPath: root,
      workspace: 'surgical-dev-ops',
      language: 'pt-BR',
      protocols: Object.freeze({
        bhSep: '2.3',
        bhSdp: '2.3'
      }),
      interactionMode: Object.freeze({ mode: 'NATURAL' })
    }),
    {
      input,
      output,
      terminal: false,
      sessionControl
    }
  );
  const closed = new Promise((resolve) => session.once('close', resolve));

  input.end('runner status\n');
  await closed;

  assert.match(
    source,
    /getWorkMode:\s*\(\)\s*=>\s*sessionControl\.currentWorkMode\(\)/m
  );

  assert.deepEqual(handledLines, ['runner status']);

  assert.match(
    source,
    /prepareInteractiveNaturalDevelopment\(\{[\s\S]*?workMode:\s*sessionControl\.currentWorkMode\(\)/m
  );
});

test('exact patch fingerprint remains the only visible interactive mutation approval seam', () => {
  const source = fs.readFileSync(
    path.join(root, 'accelerator/cli/surgical.js'),
    'utf8'
  );

  assert.match(
    source,
    /\^\(\?:aprovar\|approve\) patch \(\[a-f0-9\]\{64\}\)\$/m
  );

  assert.match(
    source,
    /approval\s*&&\s*approval\[1\]\.toLowerCase\(\)\s*===\s*fingerprint/m
  );

  assert.match(
    source,
    /approvedProposalFingerprint:\s*fingerprint/m
  );
});

test('RUNNER_STATUS is read-only and RUNNER_STOP returns to supervised mode', () => {
  const control = createNaturalSessionControl();

  control.handle('runner');
  const activeMode = control.currentWorkMode();

  const status = control.handle('runner status');
  assert.equal(status.action, 'RUNNER_STATUS');
  assert.equal(status.readOnly, true);
  assert.equal(status.workMode, activeMode);
  assert.equal(status.authorityExpansion, false);
  assert.equal(status.publicationAuthority, false);

  const stopped = control.handle('runner stop');
  assert.equal(stopped.action, 'RUNNER_STOP');
  assert.equal(stopped.safeStopRequested, true);
  assert.notEqual(control.currentWorkMode(), activeMode);
  assert.equal(stopped.authorityExpansion, false);
  assert.equal(stopped.publicationAuthority, false);
});
