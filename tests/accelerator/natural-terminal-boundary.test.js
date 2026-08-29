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
    'cat /etc/passwd',
    'head -n 20 README.md',
    'tail -n 20 package.json',
    'sed -n "1,20p" README.md',
    'awk "{print $1}" README.md',
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

test('common read-only shell commands are intercepted before cognition in both languages', () => {
  for (const input of [
    'cat /etc/passwd',
    'head README.md',
    'tail package.json',
    'less CHANGELOG.md',
    'more README.md',
    'sed -n 1p README.md',
    'awk {print} README.md',
    'sort README.md',
    'wc -l README.md',
    'cut -d: -f1 /etc/passwd',
    'xargs echo',
    'tee output.txt'
  ]) {
    const result = classifyNaturalTerminalInput(input);
    assert.equal(result.boundary, 'SYSTEM_TERMINAL', input);
    assert.match(
      formatNaturalTerminalBoundary(result, 'pt-BR'),
      /Nada foi executado/
    );
    assert.match(
      formatNaturalTerminalBoundary(result, 'en'),
      /Nothing was executed/
    );
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
