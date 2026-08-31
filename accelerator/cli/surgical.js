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
  detectNaturalResponseLanguage
} = require('./natural-response-language');

const {
  createNaturalSessionControl,
  formatProviderStatus
} = require('./natural-session-control');

const {
  createNaturalExperienceSnapshot,
  formatNaturalTerminalExperience
} = require('./natural-experience-surface');

const {
  createDeterministicWorkspaceSession,
  revalidateDeterministicWorkspaceSession
} = require('../adapters/deterministic-workspace-session-adapter');

const {
  openNaturalGovernedWorkspaceExperience,
  planNaturalGovernedWorkspaceMicroread,
  qualifyNaturalWorkspaceFileEvidenceForCognition
} = require('./natural-governed-workspace-experience');

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

const {
  prepareInteractiveNaturalDevelopment,
  approveInteractiveNaturalDevelopment
} = require('./natural-development-interactive');

const {
  createNaturalRunnerRuntime
} = require('./natural-runner-runtime');

const {
  createNaturalAgenticMission,
  projectMissionView,
  formatMissionProjection,
  resumeNaturalAgenticMission
} = require('../core/natural-agentic-mission');

const {
  createNaturalTaskEnvelopeProposal,
  authorizeNaturalTaskEnvelope
} = require('./natural-task-envelope-authorization');

const {
  createInteractionPreferenceStore
} = require('./interaction-preference-store');

const {
  runUnifiedInteractionOnboarding
} = require('./unified-interaction-onboarding');

const {
  normalizeHumanLanguage,
  isEnglish
} = require('./human-language');

const VERSION = '2.6.0-rc.6';
const NATURAL_WORKSPACE_HUMAN_SUBJECT =
  'surgical-cli-local-session';

function humanText(activation, portuguese, english) {
  return usesEnglish(activation)
    ? english
    : portuguese;
}

function usesEnglish(activation) {
  const legacyFallback =
    activation &&
    activation.interactionMode &&
    ['NATURAL', 'ENGINEER'].includes(
      activation.interactionMode.mode
    )
      ? 'pt-BR'
      : 'en';

  return normalizeHumanLanguage(
    activation && activation.language,
    legacyFallback
  ) === 'en';
}

function canonicalInstant(
  value
) {
  const timestamp =
    String(value || '').trim();

  const parsed =
    Date.parse(timestamp);

  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString() !==
      timestamp
  ) {
    throw new Error(
      'Canonical NATURAL workspace timestamp is required.'
    );
  }

  return timestamp;
}

function currentCanonicalInstant(
  options = {}
) {
  return canonicalInstant(
    typeof options.now === 'function'
      ? options.now()
      : new Date().toISOString()
  );
}

function dispatchNaturalWorkspaceEvidence(
  intent,
  activation,
  options = {},
  dispatchOptions = {}
) {
  if (
    typeof options.dispatchEvidence ===
      'function'
  ) {
    return options.dispatchEvidence(
      intent,
      activation.repositoryPath
    );
  }

  return dispatchGovernedReadOnly(
    intent,
    activation.repositoryPath,
    dispatchOptions
  );
}

function createAuthorizedNaturalWorkspaceContext(
  task,
  activation,
  options = {}
) {
  const observedAt =
    currentCanonicalInstant(
      options
    );

  const session =
    createDeterministicWorkspaceSession({
      authorizedRoot:
        activation.repositoryPath,
      humanSubject:
        NATURAL_WORKSPACE_HUMAN_SUBJECT,
      authorizedAt:
        observedAt
    });

  const revalidation =
    revalidateDeterministicWorkspaceSession(
      session
    );

  const governedInventory =
    dispatchNaturalWorkspaceEvidence(
      Object.freeze({
        capabilityType:
          'GIT_READ',
        target:
          'workspace-files'
      }),
      activation,
      options,
      {
        now:
          () => observedAt
      }
    );

  const experience =
    openNaturalGovernedWorkspaceExperience({
      session,
      revalidation,
      governedInventory,
      observedAt
    });

  const expiresAt =
    new Date(
      Date.parse(observedAt) +
        10 * 60_000
    ).toISOString();

  const proposal =
    createNaturalTaskEnvelopeProposal({
      task,
      workspaceRoot:
        activation.repositoryPath,
      physicalWorkspaceIdentity:
        experience.binding
          .physicalWorkspaceIdentity,
      riskCeiling:
        task.kind === 'WORKSPACE_LIST'
          ? 'R0'
          : 'R1',
      validFrom:
        observedAt,
      expiresAt
    });

  const taskAuthorization =
    authorizeNaturalTaskEnvelope(
      proposal,
      Object.freeze({
        approved:
          true,
        proposalFingerprint:
          proposal.proposalFingerprint,
        humanSubject:
          NATURAL_WORKSPACE_HUMAN_SUBJECT,
        authorizedAt:
          observedAt
      })
    );

  return Object.freeze({
    experience,
    taskAuthorization,
    observedAt
  });
}

function evaluateNaturalWorkspaceMicroread(
  workspaceContext,
  evidenceRequest,
  evidenceStep,
  options = {}
) {
  const zeroBasedStep =
    Math.max(
      0,
      Number(evidenceStep) - 1
    );

  return planNaturalGovernedWorkspaceMicroread(
    workspaceContext.experience,
    workspaceContext.taskAuthorization,
    Object.freeze({
      evidenceRequest,
      evidenceStep:
        zeroBasedStep,
      risk:
        evidenceRequest &&
        evidenceRequest.kind ===
          'WORKSPACE_FILES'
          ? 'R0'
          : 'R1',
      mutating:
        false
    }),
    {
      now:
        currentCanonicalInstant(
          options
        )
    }
  );
}

function formatQualifiedFileEvidenceForCognition(
  evidence,
  language = 'pt-BR'
) {
  return (
    `${language === 'en' ? 'File' : 'Arquivo'}: ${evidence.target}\n` +
    `SHA256: ${evidence.sha256}\n` +
    `${language === 'en' ? 'Sensitive content decision' : 'Decisão de conteúdo sensível'}: ${evidence.sensitiveDecision}\n` +
    `${language === 'en' ? 'Content' : 'Conteúdo'}:\n${evidence.content}`
  );
}

function printVersion() {
  process.stdout.write(`Surgical DevOps v${VERSION}\n`);
}

function printHelp() {
  process.stdout.write(
`Surgical DevOps v${VERSION}

Usage:
  surgical [options]

Options:
  --help                 Show this help / Mostrar esta ajuda
  --version              Show version / Mostrar versão
  --interaction <mode>   Select / Selecionar NATURAL, ENGINEER or EXPERT
  --language <language>  Select / Selecionar en or pt-BR
  --configure            Configure and persist / Configurar e persistir
`
  );
}

function createInteractiveActivation(
  repositoryPath = process.cwd(),
  interactionMode = 'EXPERT',
  language = null
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
    language: normalizeHumanLanguage(
      language,
      ['NATURAL', 'ENGINEER'].includes(interaction.mode)
        ? 'pt-BR'
        : 'en'
    ),
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
  const english = usesEnglish(activation);
  const naturalMode =
    Boolean(
      activation.interactionMode &&
      ['NATURAL', 'ENGINEER'].includes(
        activation.interactionMode.mode
      )
    );

  if (naturalMode) {
    if (english) {
      return (
        `Surgical DevOps v${VERSION}\n\n` +
        `Hello. I am connected to project "${activation.workspace}".\n\n` +
        'You can talk to me normally about this project.\n' +
        'I can help you understand the code, analyze project evidence,\n' +
        'explain problems, plan changes, and conduct development\n' +
        'within Surgical DevOps governed permissions.\n\n' +
        'The default cognitive assistant is Qwen 3 8B via Ollama when available locally.\n' +
        'Deterministic project protection is active.\n' +
        'The initial work mode is supervised microtasks.\n\n' +
        'When an action requires your authorization, expands project scope,\n' +
        'or introduces a new architectural decision, I will stop and explain before proceeding.\n\n' +
        'Type "help" for examples or simply tell me what you want to do.\n\n' +
        'surgical> '
      );
    }

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
BH-SEP v${activation.protocols.bhSep} E BH-SDP v${activation.protocols.bhSdp} ATIVADOS / ACTIVATED 🚀

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
  const english = usesEnglish(activation);
  return (
`${english ? 'Workspace' : 'Workspace'}: ${activation.workspace}
${english ? 'Branch' : 'Branch'}: ${activation.branch || (english ? 'detached' : 'destacada')}
${english ? 'Mode' : 'Modo'}: ${activation.mode}
${english ? 'Interaction' : 'Interação'}: ${
  activation.interactionMode
    ? activation.interactionMode.mode
    : 'EXPERT'
}
${english ? 'Strategy' : 'Estratégia'}: ${activation.strategy}
Orchestrator: ${activation.orchestrator}
Providers: ${activation.providers}
${english ? 'Language' : 'Idioma'}: ${activation.language}
`
  );
}

function formatSessionHelp(language = 'en') {
  if (!isEnglish(language)) {
    return (
`Comandos disponíveis:
  help                   Mostrar comandos delimitados do Nível 1
  status                 Mostrar estado determinístico da sessão
  providers              Mostrar estado dos providers
  read <arquivo>         Leitura governada e delimitada de arquivo
  validate <arquivo.js>  Validação governada de sintaxe Node.js
  git root|branch|head|status|tracked
                         Leitura governada do repositório
  patch <arquivo> --content-base64 <dados>
                         Patch governado R3 de arquivo único
  exit | quit            Encerrar a sessão Surgical
`
    );
  }

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
      output: formatSessionHelp(activation.language)
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
      output: usesEnglish(activation)
        ? `Providers: ${activation.providers}\nProvider is not required for the Level 1 human session.\n`
        : `Providers: ${activation.providers}\nUm provider não é necessário para a sessão humana do Nível 1.\n`
    };
  }

  if (command === 'read') {
    if (!argument) {
      return {
        action: 'CONTINUE',
        output: usesEnglish(activation)
          ? 'Usage: read <file>\n'
          : 'Uso: read <arquivo>\n'
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
        output: usesEnglish(activation)
          ? 'Usage: validate <file.js>\n'
          : 'Uso: validate <arquivo.js>\n'
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
        output: usesEnglish(activation)
          ? 'Usage: git <root|branch|head|status|tracked>\n'
          : 'Uso: git <root|branch|head|status|tracked>\n'
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
        output: usesEnglish(activation)
          ? 'Usage: patch <file> --content-base64 <data>\n'
          : 'Uso: patch <arquivo> --content-base64 <dados>\n'
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
        output: usesEnglish(activation)
          ? 'Usage: patch <file> --content-base64 <data>\n'
          : 'Uso: patch <arquivo> --content-base64 <dados>\n'
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
      output: usesEnglish(activation)
        ? 'Surgical session closed.\n'
        : 'Sessão Surgical encerrada.\n'
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
    output: usesEnglish(activation)
      ? `Unknown command: ${raw}\n`
      : `Comando desconhecido: ${raw}\n`
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

function formatCognitiveProgressMessage(
  input,
  preferredLanguage = null
) {
  if (
    normalizeHumanLanguage(
      preferredLanguage,
      detectNaturalResponseLanguage(input)
    ) ===
      'en'
  ) {
    return (
      'Processing with the local cognitive provider. ' +
      'This attempt is limited to 60 seconds; on failure, deterministic governance remains active.\n'
    );
  }

  return (
    'Processando com o provider cognitivo local. ' +
    'Esta tentativa está limitada a 60 segundos; em caso de falha, a governança determinística permanece ativa.\n'
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

    /*
     * Separate the completed response from the next prompt
     * by one canonical visual blank line.
     */
    output.write('\n');
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
              activation.workspace,
            language:
              activation.language
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

  let pendingDevelopment =
    null;

  let agenticMission =
    null;

  const runnerRuntime =
    cognitiveMode
      ? createNaturalRunnerRuntime()
      : null;

  if (cognitiveMode) {
    try {
      const missionObservedAt =
        currentCanonicalInstant(options);
      const missionSession =
        createDeterministicWorkspaceSession({
          authorizedRoot:
            activation.repositoryPath,
          humanSubject:
            NATURAL_WORKSPACE_HUMAN_SUBJECT,
          authorizedAt:
            missionObservedAt
        });

      agenticMission =
        createNaturalAgenticMission({
          missionId:
            `cli-natural-${missionSession.sessionFingerprint.slice(0, 32)}`,
          objective:
            'Interactive NATURAL governed engineering session.',
          session:
            missionSession,
          createdAt:
            missionObservedAt,
          plan: [
            {
              stepId:
                'session-ready',
              summary:
                'Maintain governed conversational session state.',
              status:
                'ACTIVE'
            }
          ]
        });
    } catch {
      agenticMission =
        null;
    }
  }

  rl.on('line', (line) => {
    rl.pause();

    processing =
      processing
        .then(async () => {
          const normalizedLine = String(line || '').trim();

          if (
            pendingDevelopment &&
            !/^(?:exit|quit)$/i.test(normalizedLine)
          ) {
            const fingerprint =
              pendingDevelopment.patchProposal.proposalFingerprint;
            const approval = normalizedLine.match(
              /^(?:aprovar|approve) patch ([a-f0-9]{64})$/i
            );

            if (approval && approval[1].toLowerCase() === fingerprint) {
              const exactPending = pendingDevelopment;
              pendingDevelopment = null;

              try {
                const patchOptions =
                  options.patchOptions ||
                  patchOptionsFromEnvironment();
                const completed = await approveInteractiveNaturalDevelopment({
                  pending: exactPending,
                  approvedProposalFingerprint: fingerprint,
                  ...patchOptions
                });

                if (
                  runnerRuntime &&
                  sessionControl.currentWorkMode() ===
                    'BOUNDED_AUTONOMY_TO_BOUNDARY'
                ) {
                  runnerRuntime.authorizedEffectCompleted(
                    completed
                  );
                }

                output.write(
                  humanText(
                    activation,
                    'Alteração governada concluída e validada.\n',
                    'Governed change completed and validated.\n'
                  ) +
                  `Target: ${completed.target}\n` +
                  `BEFORE SHA256: ${completed.beforeSha256}\n` +
                  `AFTER SHA256: ${completed.afterSha256}\n` +
                  `Transaction: ${completed.transactionId}\n` +
                  `Journal: ${completed.journalId}\n` +
                  humanText(
                    activation,
                    'A autorização foi consumida e não pode ser reutilizada.\n',
                    'The authorization was consumed and cannot be reused.\n'
                  )
                );
              } catch {
                if (runnerRuntime) {
                  runnerRuntime.failClosed(
                    'Governed mutation or validation failed closed.'
                  );
                }
                output.write(
                  humanText(
                    activation,
                    'A execução governada falhou de forma segura. A proposta foi encerrada e nenhuma autorização reutilizável permaneceu.\n',
                    'Governed execution failed closed. The proposal was closed and no reusable authorization remained.\n'
                  )
                );
              }

              resumeAndPrompt();
              return;
            }

            if (/^(?:nao|não|no|cancelar|cancel)$/i.test(normalizedLine)) {
              pendingDevelopment = null;
              if (runnerRuntime) {
                runnerRuntime.cancelPending();
              }
              output.write(
                humanText(
                  activation,
                  'Proposta de desenvolvimento cancelada. Nenhuma autoridade foi materializada.\n',
                  'Development proposal cancelled. No authority was materialized.\n'
                )
              );
              resumeAndPrompt();
              return;
            }

            output.write(
              humanText(
                activation,
                `Uma proposta exata aguarda decisão. Use "aprovar patch ${fingerprint}" ou "cancelar".\n`,
                `An exact proposal is awaiting a decision. Use "approve patch ${fingerprint}" or "cancel".\n`
              )
            );
            resumeAndPrompt();
            return;
          }

          if (sessionControl) {
            const controlled =
              sessionControl.handle(
                line
              );

            if (controlled.matched) {
              if (controlled.action === 'MISSION_PROJECTION') {
                if (!agenticMission) {
                  output.write(
                    humanText(
                      activation,
                      'Nenhuma missão governada ativa pôde ser projetada. A governança permanece fail-closed.\n',
                      'No active governed mission could be projected. Governance remains fail-closed.\n'
                    )
                  );
                } else {
                  output.write(
                    formatMissionProjection(
                      projectMissionView(
                        agenticMission,
                        controlled.projection
                      )
                    )
                  );
                }
              } else if (controlled.action === 'MISSION_RESUME') {
                if (!agenticMission) {
                  output.write(
                    humanText(
                      activation,
                      'Não há missão governada ativa para retomar.\n',
                      'There is no active governed mission to resume.\n'
                    )
                  );
                } else {
                  const revalidation =
                    revalidateDeterministicWorkspaceSession(
                      agenticMission.session
                    );
                  agenticMission =
                    resumeNaturalAgenticMission({
                      mission:
                        agenticMission,
                      revalidation,
                      resumedAt:
                        currentCanonicalInstant(options)
                    });
                  output.write(
                    formatMissionProjection(
                      projectMissionView(
                        agenticMission,
                        'status'
                      )
                    )
                  );
                }
              } else if (controlled.action === 'RUNNER_START') {
                const runner = runnerRuntime.start();
                output.write(
                  controlled.output + '\n' +
                  `Boundary: ${runner.boundary}\n` +
                  'Mutation approval: EXACT_HUMAN_REVIEW_REQUIRED\n'
                );
              } else if (controlled.action === 'RUNNER_STATUS') {
                const runner = runnerRuntime.status();
                output.write(
                  controlled.output + '\n' +
                  `Runtime state: ${runner.state}\n` +
                  `Boundary: ${runner.boundary}\n`
                );
              } else if (controlled.action === 'RUNNER_STOP') {
                const runner = runnerRuntime.stop();
                output.write(
                  controlled.output + '\n' +
                  `Runtime state: ${runner.state}\n` +
                  `Boundary: ${runner.boundary}\n`
                );
              } else if (controlled.action === 'DEVELOPMENT_REQUEST') {
                try {
                  output.write(
                    humanText(
                      activation,
                      'Coletando evidências governadas e preparando uma proposta exata...\n',
                      'Collecting governed evidence and preparing an exact proposal...\n'
                    )
                  );
                  pendingDevelopment =
                    await prepareInteractiveNaturalDevelopment({
                      request: controlled.request,
                      activation,
                      cognitiveSession,
                      dispatchEvidence: options.dispatchEvidence,
                      workMode: sessionControl.currentWorkMode()
                    });
                  const proposal = pendingDevelopment.patchProposal;
                  if (
                    runnerRuntime &&
                    sessionControl.currentWorkMode() ===
                      'BOUNDED_AUTONOMY_TO_BOUNDARY'
                  ) {
                    runnerRuntime.exactHumanReviewRequired(
                      pendingDevelopment
                    );
                  }
                  output.write(
                    humanText(
                      activation,
                      'Proposta exata pronta para revisão humana. Nenhuma alteração foi executada.\n',
                      'Exact proposal ready for human review. No change was executed.\n'
                    ) +
                    `Target: ${proposal.target}\n` +
                    `BEFORE SHA256: ${proposal.beforeSha256}\n` +
                    `AFTER SHA256: ${proposal.replacementSha256}\n` +
                    `Proposal: ${proposal.proposalFingerprint}\n` +
                    humanText(
                      activation,
                      `Para autorizar somente esta proposta, use: aprovar patch ${proposal.proposalFingerprint}\n`,
                      `To authorize only this proposal, use: approve patch ${proposal.proposalFingerprint}\n`
                    )
                  );
                } catch {
                  pendingDevelopment = null;
                  output.write(
                    humanText(
                      activation,
                      'Não foi possível preparar uma proposta exata com as evidências qualificadas. Nenhuma alteração foi realizada.\n',
                      'An exact proposal could not be prepared from qualified evidence. No change was made.\n'
                    )
                  );
                }
              } else if (
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
                        humanText(
                          activation,
                          'Consultando evidências governadas e preparando a análise local...\n',
                          'Consulting governed evidence and preparing the local analysis...\n'
                        )
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
                        humanText(
                          activation,
                          'Proposta de engenharia qualificada; nenhuma alteração foi executada.\n\n',
                          'Qualified engineering proposal; no change was executed.\n\n'
                        ) +
                        `Target: ${proposal.target}\n` +
                        `BEFORE SHA256: ${proposal.beforeSha256}\n` +
                        `AFTER SHA256: ${proposal.replacementSha256}\n` +
                        `Validation: ${proposal.validationKind}\n` +
                        `Reason: ${proposal.reason}\n\n` +
                        humanText(
                          activation,
                          'Para materializar autoridade R3 separadamente, revise o conteúdo e use o comando exato:\n',
                          'To materialize R3 authority separately, review the content and use the exact command:\n'
                        ) +
                        `patch ${proposal.target} --content-base64 ${proposal.replacementBase64}\n`
                      );

                      resumeAndPrompt();
                      return;
                    }

                    output.write(
                      humanText(
                        activation,
                        'Consultando evidências governadas e processando a resposta local...\n',
                        'Consulting governed evidence and processing the local response...\n'
                      )
                    );

                    let workspaceContext;

                    try {
                      workspaceContext =
                        createAuthorizedNaturalWorkspaceContext(
                          task,
                          activation,
                          options
                        );
                    } catch {
                      output.write(
                        humanText(
                          activation,
                          'Não consegui concluir a análise com as evidências qualificadas disponíveis. A governança permanece ativa e nenhum arquivo foi alterado.\n',
                          'I could not complete the analysis with the available qualified evidence. Governance remains active and no file was changed.\n'
                        )
                      );
                      resumeAndPrompt();
                      return;
                    }

                    const analysisStartedAt =
                      Date.now();

                    const recursive =
                      await runNaturalRecursiveEvidenceLoop({
                        task,
                        activation,
                        cognitiveSession,
                        dispatchEvidence:
                          options.dispatchEvidence,
                        sensitiveContentPolicy:
                          workspaceContext
                            .experience
                            .sensitiveContentPolicy,
                        evaluateEvidenceIntent(
                          _intent,
                          evidenceRequest,
                          evidenceStep
                        ) {
                          return evaluateNaturalWorkspaceMicroread(
                            workspaceContext,
                            evidenceRequest,
                            evidenceStep,
                            options
                          );
                        },
                        onProgress(progress) {
                          if (
                            progress.stage ===
                              'EVIDENCE_OBTAINED'
                          ) {
                            const evidenceLabel =
                              progress.detail === 'WORKSPACE_FILES'
                                ? humanText(
                                    activation,
                                    'estrutura do projeto obtida',
                                    'project structure obtained'
                                  )
                                : progress.detail === 'READ_FILE'
                                  ? humanText(
                                      activation,
                                      'conteúdo de arquivo obtido',
                                      'file content obtained'
                                    )
                                  : humanText(
                                      activation,
                                      'validação obtida',
                                      'validation obtained'
                                    );

                            output.write(
                              humanText(
                                activation,
                                `Etapa ${progress.step}: ${evidenceLabel}; continuando...\n`,
                                `Step ${progress.step}: ${evidenceLabel}; continuing...\n`
                              )
                            );
                          }
                        }
                      });

                    if (
                      recursive.status ===
                        'HUMAN_AUTHORITY_REQUIRED'
                    ) {
                      output.write(
                        humanText(
                          activation,
                          'A análise encontrou uma necessidade fora da autorização atual. Nenhuma operação adicional foi executada. Reformule o pedido ou autorize um novo escopo explicitamente.\n',
                          'The analysis found a need outside the current authorization. No additional operation was executed. Rephrase the request or explicitly authorize a new scope.\n'
                        )
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
                        humanText(
                          activation,
                          'Não consegui concluir a análise com as evidências qualificadas disponíveis. A governança permanece ativa e nenhum arquivo foi alterado.\n',
                          'I could not complete the analysis with the available qualified evidence. Governance remains active and no file was changed.\n'
                        )
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
                      humanText(
                        activation,
                        `\n\nA resposta foi fundamentada em evidências governadas do projeto. Concluída em ${elapsedSeconds}s. Nenhum arquivo foi alterado.\n`,
                        `\n\nThe response was grounded in governed project evidence. Completed in ${elapsedSeconds}s. No file was changed.\n`
                      )
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

                  const workspaceContext =
                    (
                      activation.interactionMode.mode ===
                        'NATURAL'
                    )
                      ? createAuthorizedNaturalWorkspaceContext(
                          task,
                          activation,
                          options
                        )
                      : null;

                  if (
                    task.kind ===
                      'WORKSPACE_LIST'
                  ) {
                    const governed =
                      workspaceContext
                        ? {
                            execution: {
                              schema:
                                'sdo.git_read_result.v1',
                              selector:
                                'WORKSPACE_FILES',
                              result: {
                                files:
                                  workspaceContext
                                    .experience
                                    .discoveryIndex
                                    .files
                              }
                            }
                          }
                        : dispatchGovernedReadOnly(
                            task.operations[0],
                            activation.repositoryPath
                          );

                    output.write(
                      formatWorkspaceFiles(
                        governed,
                        activation.language
                      )
                    );
                  } else {
                    const governed =
                      dispatchNaturalWorkspaceEvidence(
                        task.operations[0],
                        activation,
                        options
                      );

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
                            evidence,
                            activation.language
                          )
                        );
                      } else {
                        const explanationStartedAt =
                          Date.now();

                        const providerEvidence =
                          workspaceContext
                            ? qualifyNaturalWorkspaceFileEvidenceForCognition(
                                workspaceContext
                                  .experience,
                                evidence
                              )
                            : {
                                ...evidence,
                                sensitiveDecision:
                                  'NOT_APPLIED'
                              };

                        output.write(
                          humanText(
                            activation,
                            'Arquivo lido. Processando a explicação no modelo local...\n',
                            'File read. Processing the explanation with the local model...\n'
                          )
                        );

                        const cognitiveOutput =
                          await cognitiveSession.ask(
                            task.objective,
                            activation,
                            formatQualifiedFileEvidenceForCognition(
                              providerEvidence,
                              activation.language
                            )
                          );

                        output.write(
                          cognitiveOutput +
                          humanText(
                            activation,
                            `Explicação concluída em ${Math.max(0.1, (Date.now() - explanationStartedAt) / 1000).toFixed(1)}s.\n`,
                            `Explanation completed in ${Math.max(0.1, (Date.now() - explanationStartedAt) / 1000).toFixed(1)}s.\n`
                          )
                        );
                      }
                    } else {
                      output.write(
                        formatFileReadEvidence(
                          evidence,
                          activation.language
                        )
                      );
                    }
                  }
                } catch {
                  output.write(
                    humanText(
                      activation,
                      'A operação autorizada foi negada pelo Surgical DevOps e falhou de forma segura.\n',
                      'The authorized operation was denied by Surgical DevOps and failed closed.\n'
                    )
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
                    humanText(
                      activation,
                      'Assistente cognitivo: indisponível.\n',
                      'Cognitive assistant: unavailable.\n'
                    )
                  );
                } else {
                  const discovery =
                    await cognitiveSession.describe();

                  output.write(
                    formatProviderStatus(
                      discovery,
                      activation.language
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
                    humanText(
                      activation,
                      'A seleção de modelo local está indisponível. Nenhuma alteração foi realizada.\n',
                      'Local model selection is unavailable. No change was made.\n'
                    )
                  );
                } else {
                  const selected =
                    await cognitiveSession.selectLocalModel(
                      controlled.model
                    );

                  if (selected.available) {
                    output.write(
                      humanText(
                        activation,
                        `Modelo local ativado nesta sessão: ${selected.model}.\nA memória e o cache cognitivo temporários foram reiniciados.\nA autoridade operacional da IA permanece inexistente.\n`,
                        `Local model activated for this session: ${selected.model}.\nTemporary cognitive memory and cache were reset.\nThe AI still has no operational authority.\n`
                      )
                    );
                  } else {
                    output.write(
                      humanText(
                        activation,
                        `Não foi possível ativar ${controlled.model}: ${selected.reason}\nO modelo anterior e a governança foram preservados.\n`,
                        `Could not activate ${controlled.model}: ${selected.reason}\nThe previous model and governance were preserved.\n`
                      )
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
                  humanText(
                    activation,
                    'Conversa reiniciada. A memória e o cache temporários desta sessão foram limpos. A governança e o projeto ativo permanecem inalterados.\n',
                    'Conversation reset. Temporary session memory and cache were cleared. Governance and the active project remain unchanged.\n'
                  )
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
                    ? humanText(
                        activation,
                        'Estado da conversa:\n' +
                          `  Interações lembradas: ${state.turnCount}\n` +
                          `  Decisões cognitivas em cache: ${state.decisionCacheEntries}\n` +
                          `  Reutilizações do cache: ${state.decisionCacheHits}\n` +
                          '  Persistência: não\n' +
                          '  Autoridade operacional: nenhuma\n',
                        'Conversation state:\n' +
                          `  Remembered interactions: ${state.turnCount}\n` +
                          `  Cached cognitive decisions: ${state.decisionCacheEntries}\n` +
                          `  Cache reuses: ${state.decisionCacheHits}\n` +
                          '  Persistence: no\n' +
                          '  Operational authority: none\n'
                      )
                    : humanText(
                        activation,
                        'Memória conversacional indisponível.\n',
                        'Conversation memory unavailable.\n'
                      )
                );
              } else if (
                controlled.action ===
                  'EXPERIENCE_STATUS'
              ) {
                const discovery =
                  cognitiveSession &&
                  typeof cognitiveSession.describe === 'function'
                    ? await cognitiveSession.describe()
                    : null;

                const conversation =
                  cognitiveSession &&
                  typeof cognitiveSession.conversationState === 'function'
                    ? cognitiveSession.conversationState()
                    : null;

                const controlState =
                  sessionControl.experienceState();

                const snapshot =
                  createNaturalExperienceSnapshot({
                    project: activation.workspace,
                    provider: discovery && discovery.available
                      ? `${discovery.provider}/${discovery.model}`
                      : 'deterministic-only',
                    privacyMode: discovery && discovery.available
                      ? 'provider-qualified'
                      : 'local-deterministic',
                    workMode: controlState.workMode,
                    pendingAuthorization: controlState.pendingAuthorization,
                    conversation,
                    history: []
                  });

                output.write(
                  formatNaturalTerminalExperience(
                    snapshot,
                    controlled.language
                  )
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
                      governedOutput,
                      activation.language
                    )
                  : governedOutput
              );
            } catch {
              output.write(
                humanText(
                  activation,
                  'Solicitação governada negada: a operação falhou de forma segura.\n',
                  'Governed request denied: operation failed closed.\n'
                )
              );
            }
          }

          if (result.action === 'COGNITIVE') {
            if (!cognitiveSession) {
              output.write(
                naturalUnknownMessage(
                  activation.language
                )
              );
            } else {
              output.write(
                formatCognitiveProgressMessage(
                  result.cognitiveInput,
                  activation.language
                )
              );

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
            humanText(
              activation,
              'A sessão Surgical falhou de forma segura ao processar a solicitação.\n',
              'Surgical session failed closed while processing the request.\n'
            )
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

async function main(
  argv = process.argv.slice(2),
  options = {}
) {
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
    null;

  const languageIndexes =
    argv.reduce((indexes, argument, index) => {
      if (argument === '--language') indexes.push(index);
      return indexes;
    }, []);

  if (languageIndexes.length > 1) {
    throw new Error('Language selector cannot be repeated.');
  }

  let language = null;

  if (languageIndexes.length === 1) {
    const languageIndex = languageIndexes[0];
    if (
      languageIndex + 1 >= argv.length ||
      argv[languageIndex + 1].startsWith('--')
    ) {
      throw new Error('Explicit human language is required.');
    }

    const requestedLanguage = argv[languageIndex + 1];
    language = normalizeHumanLanguage(requestedLanguage, null);
    if (language === null) {
      throw new Error('Human language must be en or pt-BR.');
    }
  }

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

  const input = options.input || process.stdin;
  const output = options.output || process.stdout;
  const preferenceStore =
    options.preferenceStore ||
    createInteractionPreferenceStore();
  const configure = argv.includes('--configure');

  if (
    configure &&
    interactionIndexes.length === 1
  ) {
    throw new Error(
      '--configure and --interaction cannot be combined.'
    );
  }

  if (configure || interactionMode === null) {
    const savedPreference =
      configure ? null : preferenceStore.load();

    if (savedPreference) {
      interactionMode =
        savedPreference.interactionMode;
      if (language === null) {
        language = savedPreference.language;
      }
    } else if (
      configure ||
      Boolean(input.isTTY && output.isTTY)
    ) {
      const selected =
        await runUnifiedInteractionOnboarding({
          input,
          output,
          preferenceStore
        });

      interactionMode =
        selected.interactionMode;
      language = selected.language;
    } else {
      /*
       * NATURAL is the default non-explicit experience.
       *
       * This selection carries no operational authority.
       * Explicit --interaction and safely persisted human
       * preferences remain sovereign.
       */
      interactionMode = 'NATURAL';
    }
  }

  const activation =
    createInteractiveActivation(
      process.cwd(),
      interactionMode,
      language
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

  output.write(
    formatInteractiveActivation(activation)
  );

  createInteractiveSession(
    activation,
    {
      input,
      output,
      patchOptions:
        patchOptionsFromEnvironment()
    }
  );
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(
      `Surgical initialization failed closed: ${error.message}\n`
    );
    process.exitCode = 1;
  });
}

module.exports = {
  main,
  orchestrate,
  createInteractiveActivation,
  formatInteractiveActivation,
  formatCognitiveProgressMessage,
  activateInteractive,
  handleInteractiveCommand,
  createInteractiveSession,
  dispatchInteractiveIntent,
  patchOptionsFromEnvironment
};
