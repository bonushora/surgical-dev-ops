'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const {
  classifyNaturalTerminalInput,
  formatNaturalTerminalBoundary
} = require('../../accelerator/cli/natural-terminal-boundary');

const {
  createNaturalSessionControl
} = require('../../accelerator/cli/natural-session-control');

test('system shell commands are identified as presentation-only terminal boundaries', () => {
  for (const input of [
    'git status -sb',
    'git diff --check',
    'npm test',
    'node accelerator/cli/surgical.js',
    'cd "$HOME/project"',
    'printf "snapshot"',
    'HEAD_SHA="abc"',
    'gh run list | head -n 1'
  ]) {
    const result = classifyNaturalTerminalInput(input);
    assert.equal(result.boundary, 'SYSTEM_TERMINAL', input);
    assert.match(formatNaturalTerminalBoundary(result), /Nada foi executado/);
  }
});

test('canonical Surgical Git reads and natural conversation remain available', () => {
  for (const input of [
    'git status',
    'git branch',
    'Explique este projeto para mim.',
    'sim',
    'exit'
  ]) {
    assert.equal(classifyNaturalTerminalInput(input).boundary, 'NONE', input);
  }
});

test('shell-looking input cannot approve or cancel a pending governed task', () => {
  const control = createNaturalSessionControl({ workspace: 'example-project' });
  control.handle('Explique este projeto para mim.');

  const shell = control.handle('git status -sb');
  assert.equal(shell.action, 'CONTINUE');
  assert.match(shell.output, /terminal do sistema/);
  assert.equal(control.hasPendingAuthorization(), true);

  const approval = control.handle('sim');
  assert.equal(approval.action, 'AUTHORIZED_GOVERNED_TASK');
});

test('multiline programmatic input is rejected as one ambiguous decision', () => {
  const result = classifyNaturalTerminalInput('sim\ngit status -sb');
  assert.equal(result.boundary, 'MULTILINE');
  assert.match(formatNaturalTerminalBoundary(result), /várias linhas/);
  assert.match(formatNaturalTerminalBoundary(result), /nenhuma autorização foi concedida/i);
});

test('terminal boundary module exposes no execution surface', () => {
  const api = require('../../accelerator/cli/natural-terminal-boundary');
  assert.deepEqual(Object.keys(api).sort(), [
    'classifyNaturalTerminalInput',
    'formatNaturalTerminalBoundary'
  ]);

  const source = fs.readFileSync(
    require.resolve('../../accelerator/cli/natural-terminal-boundary'),
    'utf8'
  );
  assert.doesNotMatch(
    source,
    /child_process|node:fs|node:http|node:https|spawn|execFile|writeFile|dispatch/
  );
});
