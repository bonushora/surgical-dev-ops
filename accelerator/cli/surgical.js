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

const {
  interpretNaturalIntent,
  naturalUnknownMessage
} = require('./natural-intent');

const {
  formatNaturalPresentation
} = require('./natural-presentation');

const {
  createNaturalCognitiveSession
} = require('./natural-cognitive-session');

const {
  createNaturalAssistanceContext
} = require('./natural-assistance-context');

const {
  createNaturalSessionControl,
  formatProviderStatus
} = require('./natural-session-control');

const {
  formatWorkspaceFiles,
  extractFilesystemEvidence,
  formatFileReadEvidence
} = require('./natural-governed-task');

const {
  runNaturalRecursiveEvidenceLoop
} = require(
  './natural-recursive-evidence-loop'
);

const {
  runGovernedEngineeringAgentLoop
} = require(
  './governed-engineering-agent-loop'
);

const VERSION = '2.5.1';

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
    providers:
      ['NATURAL', 'ENGINEER'].includes(
        interaction.mode
      )
        ? 'auto-discovery'
        : 'none',
    protocols: {
      bhSep: '2.2',
      bhSdp: '2.2'
    }
  };
}

function formatInteractiveActivation(activation) {
  const naturalMode =
    Boolean(
      activation.interactionMode &&
      ['NATURAL', 'ENGINEER'].includes(
        activation.interactionMode.mode
      )
    );

  if (naturalMode) {
    return (
      `Surgical DevOps v${VERSION}

Olá. Estou conectado ao projeto "${activation.workspace}".

Você pode conversar comigo normalmente sobre este projeto.
Posso ajudá-lo a compreender o código, analisar evidências do projeto,
explicar problemas, planejar alterações e conduzir o desenvolvimento
dentro das permissões governadas pelo Surgical DevOps.

O assistente cognitivo padrão é o Qwen 3 8B via Ollama quando disponível localmente.
A proteção determinística do projeto está ativa.
O modo inicial de trabalho é microtarefas supervisionadas.

Quando uma ação exigir sua autorização, ampliar o escopo do projeto
ou envolver uma nova decisão arquitetural, eu paro e explico antes de prosseguir.

Digite "ajuda" para ver exemplos ou simplesmente diga o que você quer fazer.

surgical> `
    );
  }

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

  if (
    activation.interactionMode &&
    ['NATURAL', 'ENGINEER'].includes(
      activation.interactionMode.mode
    )
  ) {
    const natural =
      interpretNaturalIntent(raw);

    if (natural.matched) {
      return {
        action: 'DISPATCH',
        output: '',
        intent: natural.intent,
        presentation:
          natural.presentation
      };
    }

    return {
      action: 'COGNITIVE',
      output: '',
      cognitiveInput: raw
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

  /*
   * readline may close because of explicit EXIT or because a
   * non-interactive input reaches EOF while an asynchronous
   * cognitive request is still pending.
   *
   * Once closed, the session must never attempt resume/prompt.
   */
  let interfaceClosed =
    false;

  function resumeAndPrompt() {
    if (interfaceClosed) {
      return;
    }

    rl.resume();

    if (!interfaceClosed) {
      rl.prompt();
    }
  }

  const cognitiveMode =
    Boolean(
      activation.interactionMode &&
      ['NATURAL', 'ENGINEER'].includes(
        activation.interactionMode.mode
      )
    );

  const assistanceContext =
    cognitiveMode
      ? (
          options.assistanceContext ||
          createNaturalAssistanceContext(
            activation
          )
        )
      : null;

  const sessionControl =
    cognitiveMode
      ? (
          options.sessionControl ||
          createNaturalSessionControl({
            workspace:
              activation.workspace
          })
        )
      : null;

  const cognitiveSession =
    options.cognitiveSession ||
    (
      cognitiveMode
        ? createNaturalCognitiveSession({
            fetchImplementation:
              options.fetchImplementation,

            assistanceContext,

            getWorkMode:
              () =>
                sessionControl.currentWorkMode()
          })
        : null
    );

  let processing =
    Promise.resolve();

  rl.on('line', (line) => {
    rl.pause();

    processing =
      processing
        .then(async () => {
          if (sessionControl) {
            const controlled =
              sessionControl.handle(
                line
              );

            if (controlled.matched) {
              if (
                controlled.action ===
                  'AUTHORIZED_GOVERNED_TASK'
              ) {
                try {
                  const task =
                    controlled.task;

                  if (
                    task &&
                    task.kind ===
                      'PROJECT_ANALYSIS'
                  ) {
                    if (!cognitiveSession) {
                      throw new Error(
                        'NATURAL cognitive evidence planner is unavailable.'
                      );
                    }

                    if (
                      activation.interactionMode.mode ===
                        'ENGINEER'
                    ) {
                      output.write(
                        'Consultando evidências governadas e preparando a análise local...\n'
                      );

                      const engineering =
                        await runGovernedEngineeringAgentLoop({
                          task,
                          activation,
                          cognitiveSession,
                          dispatchEvidence:
                            options.dispatchEvidence
                        });

                      if (
                        engineering.status !==
                          'HUMAN_AUTHORITY_REQUIRED' ||
                        !engineering.proposal
                      ) {
                        throw new Error(
                          'Governed engineering proposal failed safely.'
                        );
                      }

                      const proposal =
                        engineering.proposal;

                      output.write(
                        'Proposta de engenharia qualificada; nenhuma alteração foi executada.\n\n' +
                        `Target: ${proposal.target}\n` +
                        `BEFORE SHA256: ${proposal.beforeSha256}\n` +
                        `AFTER SHA256: ${proposal.replacementSha256}\n` +
                        `Validation: ${proposal.validationKind}\n` +
                        `Reason: ${proposal.reason}\n\n` +
                        'Para materializar autoridade R3 separadamente, revise o conteúdo e use o comando exato:\n' +
                        `patch ${proposal.target} --content-base64 ${proposal.replacementBase64}\n`
                      );

                      resumeAndPrompt();
                      return;
                    }

                    output.write(
                      'Consultando evidências governadas e processando a resposta local...\n'
                    );

                    const analysisStartedAt =
                      Date.now();

                    const recursive =
                      await runNaturalRecursiveEvidenceLoop({
                        task,
                        activation,
                        cognitiveSession,
                        dispatchEvidence:
                          options.dispatchEvidence,
                        onProgress(progress) {
                          if (
                            progress.stage ===
                              'EVIDENCE_OBTAINED'
                          ) {
                            const evidenceLabel =
                              progress.detail === 'WORKSPACE_FILES'
                                ? 'estrutura do projeto obtida'
                                : progress.detail === 'READ_FILE'
                                  ? 'conteúdo de arquivo obtido'
                                  : 'validação obtida';

                            output.write(
                              `Etapa ${progress.step}: ${evidenceLabel}; continuando...\n`
                            );
                          }
                        }
                      });

                    if (
                      recursive.status ===
                        'HUMAN_AUTHORITY_REQUIRED'
                    ) {
                      output.write(
                        'A análise encontrou uma necessidade fora da autorização atual. ' +
                        'Nenhuma operação adicional foi executada. Reformule o pedido ou autorize um novo escopo explicitamente.\n'
                      );
                      resumeAndPrompt();
                      return;
                    }

                    if (
                      recursive.status !== 'COMPLETED' ||
                      !Array.isArray(
                        recursive.evidence
                      ) ||
                      recursive.evidence.length === 0 ||
                      typeof recursive.response !==
                        'string' ||
                      !recursive.response.trim()
                    ) {
                      output.write(
                        'Não consegui concluir a análise com as evidências qualificadas disponíveis. ' +
                        'A governança permanece ativa e nenhum arquivo foi alterado.\n'
                      );
                      resumeAndPrompt();
                      return;
                    }

                    const elapsedSeconds =
                      Math.max(
                        0.1,
                        (Date.now() - analysisStartedAt) / 1000
                      ).toFixed(1);

                    output.write(
                      recursive.response.trim() +
                      '\n\nA resposta foi fundamentada em evidências governadas do projeto. ' +
                      `Concluída em ${elapsedSeconds}s. Nenhum arquivo foi alterado.\n`
                    );

                    if (
                      typeof cognitiveSession.rememberExchange ===
                        'function'
                    ) {
                      cognitiveSession.rememberExchange(
                        task.objective,
                        recursive.response
                      );
                    }

                    resumeAndPrompt();
                    return;
                  }

                  if (
                    !task ||
                    !Array.isArray(
                      task.operations
                    ) ||
                    task.operations.length !== 1
                  ) {
                    throw new Error(
                      'Authorized NATURAL task is malformed.'
                    );
                  }

                  const governed =
                    dispatchGovernedReadOnly(
                      task.operations[0],
                      activation.repositoryPath
                    );

                  if (
                    task.kind ===
                      'WORKSPACE_LIST'
                  ) {
                    output.write(
                      formatWorkspaceFiles(
                        governed
                      )
                    );
                  } else {
                    const evidence =
                      extractFilesystemEvidence(
                        governed
                      );

                    if (
                      task.kind ===
                        'READ_AND_EXPLAIN_FILE'
                    ) {
                      if (!cognitiveSession) {
                        output.write(
                          formatFileReadEvidence(
                            evidence
                          )
                        );
                      } else {
                        const explanationStartedAt =
                          Date.now();

                        output.write(
                          'Arquivo lido. Processando a explicação no modelo local...\n'
                        );

                        const cognitiveOutput =
                          await cognitiveSession.ask(
                            task.objective,
                            activation,
                            (
                              `Arquivo: ${evidence.target}\n` +
                              `SHA256: ${evidence.sha256}\n` +
                              `Conteúdo:\n${evidence.content}`
                            )
                          );

                        output.write(
                          cognitiveOutput +
                          `Explicação concluída em ${Math.max(0.1, (Date.now() - explanationStartedAt) / 1000).toFixed(1)}s.\n`
                        );
                      }
                    } else {
                      output.write(
                        formatFileReadEvidence(
                          evidence
                        )
                      );
                    }
                  }
                } catch {
                  output.write(
                    'A operação autorizada foi negada pelo Surgical DevOps e falhou de forma segura.\n'
                  );
                }
              } else if (
                controlled.action ===
                  'TECHNICAL_STATUS'
              ) {
                output.write(
                  formatInteractiveStatus(
                    activation
                  )
                );
              } else if (
                controlled.action ===
                  'PROVIDER_STATUS'
              ) {
                if (!cognitiveSession) {
                  output.write(
                    'Assistente cognitivo: indisponível.\n'
                  );
                } else {
                  const discovery =
                    await cognitiveSession.describe();

                  output.write(
                    formatProviderStatus(
                      discovery
                    )
                  );
                }
              } else if (
                controlled.action ===
                  'LOCAL_MODEL_SELECTION'
              ) {
                if (
                  !cognitiveSession ||
                  typeof cognitiveSession.selectLocalModel !==
                    'function'
                ) {
                  output.write(
                    'A seleção de modelo local está indisponível. Nenhuma alteração foi realizada.\n'
                  );
                } else {
                  const selected =
                    await cognitiveSession.selectLocalModel(
                      controlled.model
                    );

                  if (selected.available) {
                    output.write(
                      `Modelo local ativado nesta sessão: ${selected.model}.\n` +
                      'A memória e o cache cognitivo temporários foram reiniciados.\n' +
                      'A autoridade operacional da IA permanece inexistente.\n'
                    );
                  } else {
                    output.write(
                      `Não foi possível ativar ${controlled.model}: ${selected.reason}\n` +
                      'O modelo anterior e a governança foram preservados.\n'
                    );
                  }
                }
              } else if (
                controlled.action ===
                  'CONVERSATION_RESET'
              ) {
                if (
                  cognitiveSession &&
                  typeof cognitiveSession.resetConversation ===
                    'function'
                ) {
                  cognitiveSession.resetConversation();
                }

                output.write(
                  'Conversa reiniciada. A memória e o cache temporários desta sessão foram limpos. A governança e o projeto ativo permanecem inalterados.\n'
                );
              } else if (
                controlled.action ===
                  'CONVERSATION_STATUS'
              ) {
                const state =
                  cognitiveSession &&
                  typeof cognitiveSession.conversationState ===
                    'function'
                    ? cognitiveSession.conversationState()
                    : null;

                output.write(
                  state
                    ? (
                        'Estado da conversa:\n' +
                        `  Interações lembradas: ${state.turnCount}\n` +
                        `  Decisões cognitivas em cache: ${state.decisionCacheEntries}\n` +
                        `  Reutilizações do cache: ${state.decisionCacheHits}\n` +
                        '  Persistência: não\n' +
                        '  Autoridade operacional: nenhuma\n'
                      )
                    : 'Memória conversacional indisponível.\n'
                );
              } else if (
                controlled.output
              ) {
                output.write(
                  controlled.output
                );
              }

              resumeAndPrompt();
              return;
            }
          }

          const result =
            handleInteractiveCommand(
              line,
              activation
            );

          if (result.output) {
            output.write(result.output);
          }

          if (result.action === 'DISPATCH') {
            try {
              const governedOutput =
                dispatchInteractiveIntent(
                  result.intent,
                  activation,
                  options
                );

              output.write(
                result.presentation
                  ? formatNaturalPresentation(
                      result.presentation,
                      governedOutput
                    )
                  : governedOutput
              );
            } catch {
              output.write(
                'Governed request denied: operation failed closed.\n'
              );
            }
          }

          if (result.action === 'COGNITIVE') {
            if (!cognitiveSession) {
              output.write(
                naturalUnknownMessage()
              );
            } else {
              const cognitiveOutput =
                await cognitiveSession.ask(
                  result.cognitiveInput,
                  activation
                );

              output.write(
                cognitiveOutput
              );
            }
          }

          if (result.action === 'EXIT') {
            if (!interfaceClosed) {
              rl.close();
            }

            return;
          }

          resumeAndPrompt();
        })
        .catch(() => {
          output.write(
            'Surgical session failed closed while processing the request.\n'
          );

          resumeAndPrompt();
        });
  });

  rl.on('close', () => {
    interfaceClosed =
      true;

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
