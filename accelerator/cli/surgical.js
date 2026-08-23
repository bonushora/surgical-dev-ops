#!/usr/bin/env node
'use strict';

const readline = require('node:readline');

const {
  orchestrate
} = require('../core/surgical-orchestrator');

const {
  discover
} = require('../core/repository-discovery');

const {
  createInteractionMode
} = require('../core/interaction-mode');

const {
  dispatchGovernedReadOnly,
  formatGovernedReadOnlyResult
} = require('./governed-readonly-dispatch');

const {
  dispatchGovernedPatch,
  formatGovernedPatchResult
} = require('./governed-patch-dispatch');

const {
  recordSessionStarted
} = require('../telemetry/session-telemetry');

const VERSION = '2.5.0';

function printVersion() {
  process.stdout.write(`Surgical DevOps v${VERSION}\n`);
}

function printHelp() {
  process.stdout.write(
`Surgical DevOps v${VERSION}

Usage:
  surgical [options]

Options:
  --help                 Show this help
  --version              Show the Surgical DevOps version
  --interaction <mode>   Select NATURAL, ENGINEER or EXPERT
`
  );
}

function createInteractiveActivation(
  repositoryPath = process.cwd(),
  interactionMode = 'EXPERT'
) {
  const discovery = discover(repositoryPath);

  const interaction =
    createInteractionMode(interactionMode);

  return {
    repositoryPath: discovery.repository.path,
    workspace: discovery.repository.name,
    branch: discovery.repository.branch,
    commit: discovery.repository.shortCommit,
    worktreeClean: discovery.worktree.clean,
    packageManager: discovery.project.packageManager,
    mode: 'DETERMINISTIC',
    interactionMode: interaction,
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
Interaction: ${
  activation.interactionMode
    ? activation.interactionMode.mode
    : 'EXPERT'
}
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
Interaction: ${
  activation.interactionMode
    ? activation.interactionMode.mode
    : 'EXPERT'
}
Strategy: ${activation.strategy}
Orchestrator: ${activation.orchestrator}
Providers: ${activation.providers}
`
  );
}

function formatSessionHelp() {
  return (
`Available commands:
  help                   Show bounded Level 1 commands
  status                 Show deterministic session status
  providers              Show provider state
  read <file>            Governed bounded filesystem read
  validate <file.js>     Governed Node.js syntax validation
  git root               Governed repository-root read
  git branch             Governed current-branch read
  git head               Governed HEAD commit read
  git status             Governed worktree-status read
  git tracked            Governed tracked-files read
  patch <file> --content-base64 <data>
                         Governed R3 single-file patch
  exit                   Close the Surgical session
  quit                   Close the Surgical session
`
  );
}

function handleInteractiveCommand(input, activation) {
  if (!activation || typeof activation !== 'object') {
    throw new Error('Explicit activation state is required.');
  }

  const raw =
    typeof input === 'string'
      ? input.trim()
      : '';

  const separator =
    raw.search(/\s/);

  const command =
    (
      separator === -1
        ? raw
        : raw.slice(0, separator)
    ).toLowerCase();

  const argument =
    separator === -1
      ? ''
      : raw.slice(separator).trim();

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

  if (command === 'read') {
    if (!argument) {
      return {
        action: 'CONTINUE',
        output: 'Usage: read <file>\n'
      };
    }

    return {
      action: 'DISPATCH',
      output: '',
      intent: Object.freeze({
        capabilityType: 'FILESYSTEM_READ',
        target: argument
      })
    };
  }

  if (command === 'validate') {
    if (!argument) {
      return {
        action: 'CONTINUE',
        output: 'Usage: validate <file.js>\n'
      };
    }

    return {
      action: 'DISPATCH',
      output: '',
      intent: Object.freeze({
        capabilityType: 'PROCESS_VALIDATION',
        target: argument
      })
    };
  }

  if (command === 'git') {
    const selector =
      argument.toLowerCase();

    if (
      ![
        'root',
        'branch',
        'head',
        'status',
        'tracked'
      ].includes(selector)
    ) {
      return {
        action: 'CONTINUE',
        output:
          'Usage: git <root|branch|head|status|tracked>\n'
      };
    }

    return {
      action: 'DISPATCH',
      output: '',
      intent: Object.freeze({
        capabilityType: 'GIT_READ',
        target: selector
      })
    };
  }

  if (command === 'patch') {
    const option =
      ' --content-base64 ';

    const optionIndex =
      argument.indexOf(option);

    if (
      optionIndex <= 0 ||
      argument.indexOf(
        option,
        optionIndex + option.length
      ) !== -1
    ) {
      return {
        action: 'CONTINUE',
        output:
          'Usage: patch <file> --content-base64 <data>\n'
      };
    }

    const target =
      argument
        .slice(0, optionIndex)
        .trim();

    const replacementBase64 =
      argument
        .slice(
          optionIndex + option.length
        )
        .trim();

    if (
      !target ||
      !replacementBase64 ||
      /\s/.test(replacementBase64)
    ) {
      return {
        action: 'CONTINUE',
        output:
          'Usage: patch <file> --content-base64 <data>\n'
      };
    }

    return {
      action: 'DISPATCH',
      output: '',
      intent: Object.freeze({
        capabilityType:
          'FILESYSTEM_PATCH',
        target,
        replacementBase64
      })
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
    output: `Unknown command: ${raw}\n`
  };
}

function decodeCanonicalBase64(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value
    )
  ) {
    throw new Error(
      'Patch replacement Base64 is malformed.'
    );
  }

  const bytes =
    Buffer.from(
      value,
      'base64'
    );

  if (
    bytes.toString('base64') !== value
  ) {
    throw new Error(
      'Patch replacement Base64 is non-canonical.'
    );
  }

  return bytes.toString('utf8');
}

function patchOptionsFromEnvironment(
  environment = process.env
) {
  return Object.freeze({
    authorityRoot:
      environment
        .SDO_HUMAN_AUTHORITY_ROOT,

    journalStorageRoot:
      environment
        .SDO_MUTATION_JOURNAL_ROOT,

    tenantId:
      environment.SDO_TENANT_ID ||
      null,

    projectId:
      environment.SDO_PROJECT_ID ||
      null
  });
}

function dispatchInteractiveIntent(
  intent,
  activation,
  options = {}
) {
  if (
    !intent ||
    typeof intent !== 'object' ||
    !activation ||
    typeof activation !== 'object'
  ) {
    throw new Error(
      'Explicit interactive dispatch context is required.'
    );
  }

  if (
    intent.capabilityType ===
      'FILESYSTEM_PATCH'
  ) {
    const governed =
      dispatchGovernedPatch(
        {
          target:
            intent.target,

          replacement:
            decodeCanonicalBase64(
              intent.replacementBase64
            )
        },

        activation.repositoryPath,

        options.patchOptions || {}
      );

    return formatGovernedPatchResult(
      governed
    );
  }

  const governed =
    dispatchGovernedReadOnly(
      intent,
      activation.repositoryPath
    );

  return formatGovernedReadOnlyResult(
    governed
  );
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

    if (result.action === 'DISPATCH') {
      try {
        output.write(
          dispatchInteractiveIntent(
            result.intent,
            activation,
            options
          )
        );
      } catch {
        output.write(
          'Governed request denied: operation failed closed.\n'
        );
      }
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

  const interactionIndexes =
    argv.reduce(
      (indexes, argument, index) => {
        if (argument === '--interaction') {
          indexes.push(index);
        }

        return indexes;
      },
      []
    );

  if (interactionIndexes.length > 1) {
    throw new Error(
      'Interaction mode selector cannot be repeated.'
    );
  }

  let interactionMode =
    'EXPERT';

  if (interactionIndexes.length === 1) {
    const interactionIndex =
      interactionIndexes[0];

    if (
      interactionIndex + 1 >= argv.length ||
      argv[interactionIndex + 1].startsWith('--')
    ) {
      throw new Error(
        'Explicit interaction mode is required.'
      );
    }

    interactionMode =
      argv[interactionIndex + 1];
  }

  const activation =
    createInteractiveActivation(
      process.cwd(),
      interactionMode
    );

  /*
   * Best-effort privacy-preserving telemetry.
   * Delivery outcome never participates in
   * Surgical operational authority.
   */
  recordSessionStarted({
    activation,
    version: VERSION
  }).catch(() => {});

  process.stdout.write(
    formatInteractiveActivation(activation)
  );

  createInteractiveSession(
    activation,
    {
      patchOptions:
        patchOptionsFromEnvironment()
    }
  );
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
  createInteractiveSession,
  dispatchInteractiveIntent,
  patchOptionsFromEnvironment
};
