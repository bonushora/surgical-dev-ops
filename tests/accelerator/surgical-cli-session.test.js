'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const cli = require('../../accelerator/cli/surgical');

function activation(interactionMode = 'EXPERT') {
  return Object.freeze({
    repositoryPath: '/tmp/surgical-dev-ops',
    workspace: 'surgical-dev-ops',
    branch: 'main',
    commit: 'f8e319a',
    worktreeClean: false,
    packageManager: 'npm',
    mode: 'DETERMINISTIC',
    interactionMode:
      Object.freeze({
        mode: interactionMode
      }),
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
  assert.match(result.output, /read/);
  assert.match(result.output, /validate/);
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

test('bounded read and validate commands produce structured dispatch intent only', () => {
  const read =
    cli.handleInteractiveCommand(
      'read README.md',
      activation()
    );

  assert.equal(read.action, 'DISPATCH');
  assert.deepEqual(read.intent, {
    capabilityType: 'FILESYSTEM_READ',
    target: 'README.md'
  });

  const validate =
    cli.handleInteractiveCommand(
      'validate accelerator/cli/surgical.js',
      activation()
    );

  assert.equal(validate.action, 'DISPATCH');
  assert.deepEqual(validate.intent, {
    capabilityType: 'PROCESS_VALIDATION',
    target: 'accelerator/cli/surgical.js'
  });

  assert.ok(Object.isFrozen(read.intent));
  assert.ok(Object.isFrozen(validate.intent));
});


test('bounded Git commands produce repository-scoped governed intents', () => {
  const expected = {
    root: 'root',
    branch: 'branch',
    head: 'head',
    status: 'status',
    tracked: 'tracked'
  };

  for (const [command, target] of Object.entries(expected)) {
    const result =
      cli.handleInteractiveCommand(
        `git ${command}`,
        activation()
      );

    assert.equal(result.action, 'DISPATCH');
    assert.deepEqual(result.intent, {
      capabilityType: 'GIT_READ',
      target
    });
    assert.ok(Object.isFrozen(result.intent));
  }
});

test('arbitrary Git commands remain outside Level 1 authority', () => {
  for (const command of [
    'git push',
    'git commit',
    'git remote',
    'git reset',
    'git checkout'
  ]) {
    const result =
      cli.handleInteractiveCommand(
        command,
        activation()
      );

    assert.equal(result.action, 'CONTINUE');
    assert.match(result.output, /Usage: git/);
    assert.equal('intent' in result, false);
  }
});

test('read and validate require one explicit target', () => {
  assert.deepEqual(
    cli.handleInteractiveCommand(
      'read',
      activation()
    ),
    {
      action: 'CONTINUE',
      output: 'Usage: read <file>\n'
    }
  );

  assert.deepEqual(
    cli.handleInteractiveCommand(
      'validate',
      activation()
    ),
    {
      action: 'CONTINUE',
      output: 'Usage: validate <file.js>\n'
    }
  );
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

test('bounded patch command produces structured R3 dispatch intent only', () => {
  const replacement =
    Buffer.from(
      'const value = 2;\n',
      'utf8'
    ).toString('base64');

  const result =
    cli.handleInteractiveCommand(
      `patch target.js --content-base64 ${replacement}`,
      activation()
    );

  assert.equal(
    result.action,
    'DISPATCH'
  );

  assert.deepEqual(
    result.intent,
    {
      capabilityType:
        'FILESYSTEM_PATCH',
      target:
        'target.js',
      replacementBase64:
        replacement
    }
  );

  assert.ok(
    Object.isFrozen(
      result.intent
    )
  );

  for (const forbidden of [
    'provider',
    'providerId',
    'mutationProvider',
    'privateKey',
    'command',
    'args',
    'executable'
  ]) {
    assert.equal(
      forbidden in result.intent,
      false
    );
  }
});

test('patch command rejects incomplete or ambiguous syntax without dispatch authority', () => {
  for (const command of [
    'patch',
    'patch target.js',
    'patch target.js --content-base64',
    'patch --content-base64 YQ==',
    'patch target.js --content-base64 YQ== --content-base64 Yg=='
  ]) {
    const result =
      cli.handleInteractiveCommand(
        command,
        activation()
      );

    assert.equal(
      result.action,
      'CONTINUE'
    );

    assert.match(
      result.output,
      /Usage: patch/
    );

    assert.equal(
      'intent' in result,
      false
    );
  }
});

test('session help exposes governed patch without exposing generic execution', () => {
  const result =
    cli.handleInteractiveCommand(
      'help',
      activation()
    );

  assert.match(
    result.output,
    /patch <file> --content-base64/
  );

  assert.doesNotMatch(
    result.output,
    /\bshell\b|\bbash\b|\bexec\b/i
  );
});

test('NATURAL does not terminate a broad repository-state question on Git status', () => {
  const state =
    activation('NATURAL');

  const result =
    cli.handleInteractiveCommand(
      'Qual é o estado atual deste repositório?',
      state
    );

  assert.equal(
    result.action,
    'COGNITIVE'
  );

  assert.equal(result.cognitiveInput, 'Qual é o estado atual deste repositório?');
  assert.equal('intent' in result, false);
});

test('NATURAL maps bounded branch question without changing governance authority', () => {
  const state =
    activation('NATURAL');

  for (const input of [
    'Qual é a branch atual?',
    'What is the current branch?'
  ]) {
    const result =
      cli.handleInteractiveCommand(
        input,
        state
      );

    assert.equal(result.action, 'DISPATCH');
    assert.deepEqual(result.intent, {
      capabilityType: 'GIT_READ',
      target: 'branch'
    });
  }
});

test('NATURAL maps bounded commit question without provider or shell authority', () => {
  const state =
    activation('NATURAL');

  for (const input of [
    'Qual é o commit atual?',
    'What is the current commit?'
  ]) {
    const result =
      cli.handleInteractiveCommand(
        input,
        state
      );

    assert.equal(result.action, 'DISPATCH');
    assert.deepEqual(result.intent, {
      capabilityType: 'GIT_READ',
      target: 'head'
    });
    assert.equal('command' in result.intent, false);
    assert.equal('shell' in result.intent, false);
  }
});

test('NATURAL unsupported deterministic language becomes cognitive-only input with zero operational intent', () => {
  const state =
    activation('NATURAL');

  const result =
    cli.handleInteractiveCommand(
      'Explique este projeto para mim.',
      state
    );

  assert.equal(
    result.action,
    'COGNITIVE'
  );

  assert.equal(
    result.cognitiveInput,
    'Explique este projeto para mim.'
  );

  assert.equal(
    'intent' in result,
    false
  );

  assert.equal(
    result.output,
    ''
  );
});

test('EXPERT preserves deterministic unknown-command behavior', () => {
  const state =
    activation('EXPERT');

  const result =
    cli.handleInteractiveCommand(
      'Qual é o estado atual deste repositório?',
      state
    );

  assert.equal(
    result.action,
    'CONTINUE'
  );

  assert.match(
    result.output,
    /Unknown command/i
  );

  assert.equal(
    'intent' in result,
    false
  );
});
