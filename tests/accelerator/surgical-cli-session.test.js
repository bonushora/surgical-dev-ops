'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const cli = require('../../accelerator/cli/surgical');

function activation() {
  return Object.freeze({
    workspace: 'surgical-dev-ops',
    branch: 'main',
    commit: 'f8e319a',
    worktreeClean: false,
    packageManager: 'npm',
    mode: 'DETERMINISTIC',
    strategy: 'PATCH',
    orchestrator: 'ACTIVE',
    providers: 'none',
    protocols: Object.freeze({
      bhSep: '2.2',
      bhSdp: '2.2'
    })
  });
}

test('CLI exposes persistent session command surface', () => {
  assert.equal(typeof cli.handleInteractiveCommand, 'function');
  assert.equal(typeof cli.createInteractiveSession, 'function');
});

test('empty interactive input is deterministic no-op', () => {
  assert.equal(typeof cli.handleInteractiveCommand, 'function');

  const result = cli.handleInteractiveCommand('', activation());

  assert.deepEqual(result, {
    action: 'CONTINUE',
    output: ''
  });
});

test('help command exposes bounded Level 1 session commands', () => {
  assert.equal(typeof cli.handleInteractiveCommand, 'function');

  const result = cli.handleInteractiveCommand('help', activation());

  assert.equal(result.action, 'CONTINUE');
  assert.match(result.output, /help/);
  assert.match(result.output, /status/);
  assert.match(result.output, /providers/);
  assert.match(result.output, /exit/);
  assert.match(result.output, /quit/);

  assert.doesNotMatch(result.output, /\bexec\b/i);
  assert.doesNotMatch(result.output, /\bshell\b/i);
  assert.doesNotMatch(result.output, /\bbash\b/i);
});

test('status reports deterministic activation state without orchestration', () => {
  assert.equal(typeof cli.handleInteractiveCommand, 'function');

  const state = activation();
  const result = cli.handleInteractiveCommand('status', state);

  assert.equal(result.action, 'CONTINUE');

  assert.match(result.output, /Workspace:\s+surgical-dev-ops/);
  assert.match(result.output, /Branch:\s+main/);
  assert.match(result.output, /Mode:\s+DETERMINISTIC/);
  assert.match(result.output, /Strategy:\s+PATCH/);
  assert.match(result.output, /Orchestrator:\s+ACTIVE/);
  assert.match(result.output, /Providers:\s+none/);
});

test('providers reports provider-independent activation state', () => {
  assert.equal(typeof cli.handleInteractiveCommand, 'function');

  const result =
    cli.handleInteractiveCommand('providers', activation());

  assert.equal(result.action, 'CONTINUE');
  assert.match(result.output, /Providers:\s+none/);
  assert.match(
    result.output,
    /provider.*not required|not required.*provider/i
  );
});

test('exit and quit terminate only the human session', () => {
  assert.equal(typeof cli.handleInteractiveCommand, 'function');

  for (const command of ['exit', 'quit']) {
    const result =
      cli.handleInteractiveCommand(command, activation());

    assert.deepEqual(result, {
      action: 'EXIT',
      output: 'Surgical session closed.\n'
    });
  }
});

test('command parsing is whitespace tolerant and case insensitive', () => {
  assert.equal(typeof cli.handleInteractiveCommand, 'function');

  const help =
    cli.handleInteractiveCommand('   HELP   ', activation());

  const status =
    cli.handleInteractiveCommand(' Status ', activation());

  const providers =
    cli.handleInteractiveCommand(' PROVIDERS ', activation());

  assert.equal(help.action, 'CONTINUE');
  assert.equal(status.action, 'CONTINUE');
  assert.equal(providers.action, 'CONTINUE');
});

test('unknown command fails closed without orchestration authority', () => {
  assert.equal(typeof cli.handleInteractiveCommand, 'function');

  const result =
    cli.handleInteractiveCommand(
      'rm -rf /',
      activation()
    );

  assert.equal(result.action, 'CONTINUE');
  assert.match(result.output, /Unknown command/i);

  assert.doesNotMatch(result.output, /executed/i);
  assert.doesNotMatch(result.output, /authorized/i);
});

test('session constructor requires explicit activation state', () => {
  assert.equal(typeof cli.createInteractiveSession, 'function');

  assert.throws(
    () => cli.createInteractiveSession(),
    /activation/i
  );
});

test('session command surface does not expose orchestration dispatch', () => {
  assert.equal(typeof cli.handleInteractiveCommand, 'function');

  const source =
    cli.handleInteractiveCommand.toString();

  assert.doesNotMatch(source, /\borchestrate\s*\(/);
  assert.doesNotMatch(source, /child_process/);
  assert.doesNotMatch(source, /\bspawn\s*\(/);
  assert.doesNotMatch(source, /\bexec\s*\(/);
});

test('persistent session contract does not mutate activation state', () => {
  assert.equal(typeof cli.handleInteractiveCommand, 'function');

  const state = activation();

  cli.handleInteractiveCommand('status', state);
  cli.handleInteractiveCommand('providers', state);
  cli.handleInteractiveCommand('help', state);

  assert.deepEqual(state, activation());
});
