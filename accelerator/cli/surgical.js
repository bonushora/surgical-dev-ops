#!/usr/bin/env node
'use strict';

const readline = require('node:readline');

const {
  orchestrate
} = require('../core/surgical-orchestrator');

const {
  discover
} = require('../core/repository-discovery');

const VERSION = '2.3.0';

function printVersion() {
  process.stdout.write(`Surgical DevOps v${VERSION}\n`);
}

function printHelp() {
  process.stdout.write(
`Surgical DevOps v${VERSION}

Usage:
  surgical [options]

Options:
  --help       Show this help
  --version    Show the Surgical DevOps version
`
  );
}

function createInteractiveActivation(repositoryPath = process.cwd()) {
  const discovery = discover(repositoryPath);

  return {
    workspace: discovery.repository.name,
    branch: discovery.repository.branch,
    commit: discovery.repository.shortCommit,
    worktreeClean: discovery.worktree.clean,
    packageManager: discovery.project.packageManager,
    mode: 'DETERMINISTIC',
    strategy: 'PATCH',
    orchestrator: 'ACTIVE',
    providers: 'none',
    protocols: {
      bhSep: '2.2',
      bhSdp: '2.2'
    }
  };
}

function formatInteractiveActivation(activation) {
  return (
`Surgical DevOps v${VERSION}
BH-SEP v${activation.protocols.bhSep} E BH-SDP v${activation.protocols.bhSdp} ATIVADOS 🚀

Workspace: ${activation.workspace}
Branch: ${activation.branch || 'detached'}
Mode: ${activation.mode}
Strategy: ${activation.strategy}
Orchestrator: ${activation.orchestrator}
Providers: ${activation.providers}

surgical> `
  );
}

function formatInteractiveStatus(activation) {
  return (
`Workspace: ${activation.workspace}
Branch: ${activation.branch || 'detached'}
Mode: ${activation.mode}
Strategy: ${activation.strategy}
Orchestrator: ${activation.orchestrator}
Providers: ${activation.providers}
`
  );
}

function formatSessionHelp() {
  return (
`Available commands:
  help        Show bounded Level 1 commands
  status      Show deterministic session status
  providers   Show provider state
  exit        Close the Surgical session
  quit        Close the Surgical session
`
  );
}

function handleInteractiveCommand(input, activation) {
  if (!activation || typeof activation !== 'object') {
    throw new Error('Explicit activation state is required.');
  }

  const command =
    typeof input === 'string'
      ? input.trim().toLowerCase()
      : '';

  if (command === '') {
    return {
      action: 'CONTINUE',
      output: ''
    };
  }

  if (command === 'help') {
    return {
      action: 'CONTINUE',
      output: formatSessionHelp()
    };
  }

  if (command === 'status') {
    return {
      action: 'CONTINUE',
      output: formatInteractiveStatus(activation)
    };
  }

  if (command === 'providers') {
    return {
      action: 'CONTINUE',
      output:
        `Providers: ${activation.providers}\n` +
        'Provider is not required for the Level 1 human session.\n'
    };
  }

  if (command === 'exit' || command === 'quit') {
    return {
      action: 'EXIT',
      output: 'Surgical session closed.\n'
    };
  }

  return {
    action: 'CONTINUE',
    output: `Unknown command: ${input.trim()}\n`
  };
}

function createInteractiveSession(
  activation,
  options = {}
) {
  if (!activation || typeof activation !== 'object') {
    throw new Error('Explicit activation state is required.');
  }

  const input =
    options.input || process.stdin;

  const output =
    options.output || process.stdout;

  const terminal =
    options.terminal === undefined
      ? Boolean(input.isTTY && output.isTTY)
      : Boolean(options.terminal);

  const rl = readline.createInterface({
    input,
    output,
    terminal,
    prompt: 'surgical> '
  });

  rl.on('line', (line) => {
    const result =
      handleInteractiveCommand(line, activation);

    if (result.output) {
      output.write(result.output);
    }

    if (result.action === 'EXIT') {
      rl.close();
      return;
    }

    rl.prompt();
  });

  rl.on('close', () => {
    if (terminal) {
      output.write('\n');
    }
  });

  return rl;
}

function activateInteractive(repositoryPath = process.cwd()) {
  const activation =
    createInteractiveActivation(repositoryPath);

  const output =
    formatInteractiveActivation(activation);

  process.stdout.write(output);

  return activation;
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--version')) {
    printVersion();
    return;
  }

  if (argv.includes('--help')) {
    printHelp();
    return;
  }

  const activation =
    createInteractiveActivation(process.cwd());

  process.stdout.write(
    formatInteractiveActivation(activation)
  );

  createInteractiveSession(activation);
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
  orchestrate,
  createInteractiveActivation,
  formatInteractiveActivation,
  activateInteractive,
  handleInteractiveCommand,
  createInteractiveSession
};
