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
  formatNaturalPresentation,
  formatNaturalGatewayEvent,
  formatNaturalGatewayResult,
  formatNaturalReferenceResolution,
  formatNaturalReferenceContextProjection,
  formatNaturalMissionContinuation
} = require('./natural-presentation');

const {
  createGatewayRequest,
  streamGatewayRequest
} = require(
  '../core/integrated-governed-agent-gateway'
);

const {
  createNaturalEngineeringReferenceContext,
  recordNaturalEngineeringGatewayResult,
  resolveNaturalEngineeringReference,
  projectNaturalEngineeringReferenceContext
} = require(
  '../core/natural-engineering-reference-context'
);

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
  NATURAL_LOCAL_INFERENCE_PROFILE
} = require(
  './natural-local-inference-profile'
);

const {
  createNaturalSessionControl,
  formatProviderStatus,
  formatProviderCatalog,
  isNaturalMissionCancellationRequest
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
  transitionNaturalAgenticMission,
  updateNaturalAgenticMissionPlan,
  updateNaturalAgenticMissionPlanStep,
  recordNaturalAgenticMissionPlanResult,
  selectNaturalAgenticMissionContinuation,
  projectMissionView,
  formatMissionProjection,
  blockNaturalAgenticMission,
  cancelNaturalAgenticMission,
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

const NATURAL_R1_GATEWAY_ALLOWED_CAPABILITIES =
  Object.freeze([
    'workspace.status',
    'workspace.diff',
    'evidence.inspect'
  ]);

const NATURAL_R1_GATEWAY_DENIED_CAPABILITIES =
  Object.freeze([
    'arbitrary.shell',
    'credential.read',
    'network.mutate',
    'workspace.search',
    'workspace.read',
    'evidence.microread',
    'tests.run',
    'tests.runCanonical',
    'mutation.propose',
    'mutation.applyConditional',
    'git.stage',
    'git.commit',
    'git.push',
    'git.merge',
    'git.tag',
    'release.create',
    'npm.publish',
    'deploy'
  ]);

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
  const timeoutSeconds =
    NATURAL_LOCAL_INFERENCE_PROFILE
      .timeoutMs /
    1000;

  if (
    normalizeHumanLanguage(
      preferredLanguage,
      detectNaturalResponseLanguage(input)
    ) ===
      'en'
  ) {
    return (
      'Processing with the local cognitive provider. ' +
      `This attempt is limited to ${timeoutSeconds} seconds; on failure, deterministic governance remains active.\n`
    );
  }

  return (
    'Processando com o provider cognitivo local. ' +
    `Esta tentativa está limitada a ${timeoutSeconds} segundos; em caso de falha, a governança determinística permanece ativa.\n`
  );
}

function formatInteractiveBackpressureMessage(
  activation
) {
  return humanText(
    activation,
    (
      '\nEntrada adicional rejeitada enquanto a solicitação anterior ainda está em processamento.\n' +
      'Nenhuma das linhas adicionais recebidas antes do próximo prompt será executada.\n' +
      'Aguarde o próximo prompt "surgical>" e envie exatamente uma solicitação por vez.\n' +
      'Ctrl+C continua encerrando a sessão CLI inteira com segurança.\n'
    ),
    (
      '\nAdditional input was rejected while the previous request is still processing.\n' +
      'None of the additional lines received before the next prompt will be executed.\n' +
      'Wait for the next "surgical>" prompt and send exactly one request at a time.\n' +
      'Ctrl+C continues to terminate the entire CLI session safely.\n'
    )
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

  let interactiveRequestInFlight =
    false;

  let interactiveBackpressureReported =
    false;

  function resumeAndPrompt() {
    interactiveRequestInFlight =
      false;

    interactiveBackpressureReported =
      false;

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

  let naturalGatewayMissionSequence =
    0;

  let naturalEngineeringReferenceContext =
    null;

  let projectedNaturalMissionId =
    null;

  let projectedNaturalMissionEventSequence =
    0;

  const runnerRuntime =
    cognitiveMode
      ? createNaturalRunnerRuntime()
      : null;

  function projectNaturalMissionEvent(
    event,
    {
      mission = agenticMission,
      operation = null,
      stepId = null
    } = {}
  ) {
    if (!event || typeof event !== 'object') {
      return;
    }
    if (projectedNaturalMissionId !== event.missionId) {
      projectedNaturalMissionId = event.missionId;
      projectedNaturalMissionEventSequence = 0;
    }
    if (event.sequence <= projectedNaturalMissionEventSequence) {
      return;
    }
    const presentation =
      formatNaturalGatewayEvent(
        event,
        activation.language,
        {
          mission,
          operation,
          stepId
        }
      );
    projectedNaturalMissionEventSequence = event.sequence;
    if (presentation) {
      output.write(presentation);
    }
  }

  function projectNaturalMissionEvents(
    mission,
    context = {}
  ) {
    if (!mission || !Array.isArray(mission.events)) {
      return;
    }
    for (const event of mission.events) {
      projectNaturalMissionEvent(
        event,
        {
          ...context,
          mission
        }
      );
    }
  }

  function createNaturalGatewayMission(
    intent,
    observedAt
  ) {
    const session =
      createDeterministicWorkspaceSession({
        authorizedRoot:
          activation.repositoryPath,
        humanSubject:
          NATURAL_WORKSPACE_HUMAN_SUBJECT,
        authorizedAt:
          observedAt
      });

    naturalGatewayMissionSequence += 1;

    return createNaturalAgenticMission({
      missionId:
        `cli-natural-r3-${session.sessionFingerprint.slice(0, 24)}-${naturalGatewayMissionSequence}`,
      objective:
        intent.objective,
      session,
      createdAt:
        observedAt,
      plan: [
        {
          stepId:
            `gateway-${naturalGatewayMissionSequence}-01`,
          summary:
            `Execute ${intent.operation} through the Integrated Governed Agent Gateway.`,
          status:
            'PENDING',
          operation:
            intent.operation
        },
        {
          stepId:
            `gateway-${naturalGatewayMissionSequence}-02`,
          summary:
            `Inspect the governed evidence produced by ${intent.operation}.`,
          status:
            'PENDING',
          operation:
            'evidence.inspect',
          sourceOperation:
            intent.operation
        }
      ],
      authority: {
        allowedCapabilities:
          NATURAL_R1_GATEWAY_ALLOWED_CAPABILITIES,
        deniedCapabilities:
          NATURAL_R1_GATEWAY_DENIED_CAPABILITIES,
        grants: []
      }
    });
  }

  function prepareNaturalGatewayMission(
    intent,
    observedAt
  ) {
    if (intent.continuationStepId) {
      if (!agenticMission) {
        return null;
      }
      const step =
        agenticMission.plan.find(
          (item) =>
            item.stepId === intent.continuationStepId &&
            item.status === 'PENDING' &&
            item.operation === intent.operation
        );
      if (!step) {
        return null;
      }
      agenticMission =
        updateNaturalAgenticMissionPlanStep(
          agenticMission,
          {
            stepId:
              step.stepId,
            status:
              'ACTIVE',
            at:
              observedAt,
            eventSummary:
              'Process-local continuation activated the unambiguous live-plan step.'
          }
        );
      return Object.freeze({
        mission:
          agenticMission,
        stepId:
          step.stepId,
        args:
          intent.args,
        sourceOperation:
          intent.sourceOperation
      });
    }

    if (!intent.typedReference) {
      const mission =
        createNaturalGatewayMission(
          intent,
          observedAt
        );

      const stepId =
        mission.plan[0].stepId;

      const activeMission =
        updateNaturalAgenticMissionPlanStep(
          mission,
          {
            stepId,
            status:
              'ACTIVE',
            at:
              observedAt,
            eventSummary:
              'The governed operation became the active live-plan step.'
          }
        );

      naturalEngineeringReferenceContext =
        createNaturalEngineeringReferenceContext({
          mission:
            activeMission,
          createdAt:
            observedAt
        });

      return Object.freeze({
        mission:
          activeMission,
        stepId,
        args:
          intent.args,
        sourceOperation:
          intent.operation
      });
    }

    if (!agenticMission) {
      return null;
    }

    const pendingStep =
      agenticMission.plan.find(
        (step) =>
          step.status === 'PENDING' &&
          step.operation === intent.operation &&
          (
            !intent.sourceOperation ||
            !step.sourceOperation ||
            step.sourceOperation === intent.sourceOperation
          )
      );
    const stepId =
      pendingStep
        ? pendingStep.stepId
        : `gateway-${naturalGatewayMissionSequence}-${String(agenticMission.plan.length + 1).padStart(2, '0')}`;

    agenticMission = pendingStep
      ? updateNaturalAgenticMissionPlanStep(
          agenticMission,
          {
            stepId,
            status:
              'ACTIVE',
            at:
              observedAt,
            eventSummary:
              'The bounded reference selected the existing live-plan step.'
          }
        )
      : updateNaturalAgenticMissionPlan(
          agenticMission,
          {
            plan: [
              ...agenticMission.plan,
              {
                stepId,
                summary:
                  `Resolve ${intent.referenceType} and execute ${intent.operation} through the Integrated Governed Agent Gateway.`,
                status:
                  'ACTIVE',
                operation:
                  intent.operation,
                sourceOperation:
                  intent.sourceOperation
              }
            ],
            at:
              observedAt,
            summary:
              'Explicit evidence request added to the governed live plan.'
          }
        );

    return Object.freeze({
      mission:
        agenticMission,
      stepId,
      args:
        intent.args,
      sourceOperation:
        intent.sourceOperation
    });
  }

  function resolveNaturalGatewayReferenceIntent(
    intent,
    observedAt
  ) {
    if (!intent.referenceType) {
      return intent;
    }

    if (!agenticMission) {
      const session =
        createDeterministicWorkspaceSession({
          authorizedRoot:
            activation.repositoryPath,
          humanSubject:
            NATURAL_WORKSPACE_HUMAN_SUBJECT,
          authorizedAt:
            observedAt
        });

      naturalGatewayMissionSequence += 1;
      agenticMission =
        createNaturalAgenticMission({
          missionId:
            `cli-natural-r3-${session.sessionFingerprint.slice(0, 24)}-${naturalGatewayMissionSequence}`,
          objective:
            intent.objective,
          session,
          createdAt:
            observedAt,
          plan: [],
          authority: {
            allowedCapabilities:
              NATURAL_R1_GATEWAY_ALLOWED_CAPABILITIES,
            deniedCapabilities:
              NATURAL_R1_GATEWAY_DENIED_CAPABILITIES,
            grants: []
          }
        });
      naturalEngineeringReferenceContext =
        createNaturalEngineeringReferenceContext({
          mission:
            agenticMission,
          createdAt:
            observedAt
        });
    }

    if (!naturalEngineeringReferenceContext) {
      throw new Error(
        'Bounded engineering reference context is unavailable.'
      );
    }

    const revalidation =
      revalidateDeterministicWorkspaceSession(
        agenticMission.session
      );
    const resolution =
      resolveNaturalEngineeringReference({
        context:
          naturalEngineeringReferenceContext,
        mission:
          agenticMission,
        requestedType:
          intent.referenceType,
        requestedAction:
          intent.referenceAction,
        revalidation
      });

    output.write(
      formatNaturalReferenceResolution(
        resolution,
        activation.language,
        intent.referenceAction
      )
    );

    if (
      resolution.classification !==
        'RESOLVED'
    ) {
      const resultClasses = {
        NO_REFERENT:
          'INCOMPLETE_EVIDENCE',
        AMBIGUOUS_REFERENT:
          'INCOMPLETE_EVIDENCE',
        STALE_REFERENT:
          'STALE_STATE',
        UNSUPPORTED_REFERENT:
          'UNSUPPORTED'
      };
      const stepId =
        `reference-${naturalGatewayMissionSequence}-${String(agenticMission.plan.length + 1).padStart(2, '0')}`;
      agenticMission =
        updateNaturalAgenticMissionPlan(
          agenticMission,
          {
            plan: [
              ...agenticMission.plan,
              {
                stepId,
                summary:
                  `Resolve the bounded ${intent.referenceType} engineering reference.`,
                status:
                  'BLOCKED',
                ...(intent.operation
                  ? { operation: intent.operation }
                  : {}),
                resultClass:
                  resultClasses[resolution.classification],
                blocker:
                  resolution.reason
              }
            ],
            at:
              observedAt,
            summary:
              'Bounded engineering reference failed closed.'
          }
        );
      if (
        resolution.classification ===
          'STALE_REFERENT'
      ) {
        agenticMission =
          transitionNaturalAgenticMission(
            agenticMission,
            {
              type:
                'STATE_INVALIDATED',
              state:
                'BLOCKED',
              summary:
                resolution.reason,
              at:
                observedAt,
              resultClass:
                'STALE_STATE'
            }
          );
      }
      if (agenticMission.state !== 'BLOCKED') {
        agenticMission =
          blockNaturalAgenticMission(
            agenticMission,
            {
              reason:
                resolution.reason,
              at:
                observedAt
            }
          );
      }
      return null;
    }

    if (
      [
        'REQUEST_MUTATION',
        'REQUEST_PUBLICATION',
        'PROJECT_REFERENCE'
      ].includes(
        intent.referenceAction
      )
    ) {
      if (
        [
          'REQUEST_MUTATION',
          'REQUEST_PUBLICATION'
        ].includes(intent.referenceAction)
      ) {
        const publication =
          intent.referenceAction === 'REQUEST_PUBLICATION';
        const stepId =
          `authority-${naturalGatewayMissionSequence}-${String(agenticMission.plan.length + 1).padStart(2, '0')}`;
        const blocker = publication
          ? 'An exact governed publication proposal and independent human authority are required.'
          : 'An exact governed mutation proposal and independent human authority are required.';
        agenticMission =
          updateNaturalAgenticMissionPlan(
            agenticMission,
            {
              plan: [
                ...agenticMission.plan,
                {
                  stepId,
                  summary: publication
                    ? 'Request bounded publication authority for the resolved referent.'
                    : 'Request bounded mutation authority for the resolved referent.',
                  status:
                    'BLOCKED',
                  operation: publication
                    ? 'npm.publish'
                    : 'mutation.applyConditional',
                  sourceOperation:
                    resolution.reference.operation,
                  resultClass:
                    'AUTHORITY_REQUIRED',
                  blocker
                }
              ],
              at:
                observedAt,
              summary:
                'Reference resolution recorded an independent authority boundary.'
            }
          );
        agenticMission =
          transitionNaturalAgenticMission(
            agenticMission,
            {
              type:
                'AUTHORITY_REQUIRED',
              state:
                agenticMission.state,
              summary:
                blocker,
              at:
                observedAt,
              resultClass:
                'AUTHORITY_REQUIRED'
            }
          );
        if (agenticMission.state !== 'BLOCKED') {
          agenticMission =
            blockNaturalAgenticMission(
              agenticMission,
              {
                reason:
                  blocker,
                at:
                  observedAt
              }
            );
        }
      }
      return null;
    }

    const reference =
      resolution.reference;
    const repeat =
      intent.referenceAction ===
        'REPEAT_OPERATION';

    return Object.freeze({
      ...intent,
      operation:
        repeat
          ? reference.operation
          : 'evidence.inspect',
      args:
        repeat
          ? Object.freeze({})
          : Object.freeze({
              operation:
                reference.operation
            }),
      sourceOperation:
        reference.operation,
      typedReference:
        reference,
      referenceResolution:
        resolution,
      requiresMissionContext:
        true,
      authorityExpansion:
        false,
      operationalAuthority:
        false,
      mutationAuthority:
        false,
      publicationAuthority:
        false
    });
  }

  async function dispatchNaturalGatewayIntent(
    intent
  ) {
    const observedAt =
      currentCanonicalInstant(
        options
      );

    const resolvedIntent =
      resolveNaturalGatewayReferenceIntent(
        intent,
        observedAt
      );

    if (!resolvedIntent) {
      projectNaturalMissionEvents(
        agenticMission
      );
      return;
    }

    const prepared =
      prepareNaturalGatewayMission(
        resolvedIntent,
        observedAt
      );

    if (!prepared) {
      throw new Error(
        'Task-specific mission is unavailable for the governed reference.'
      );
    }

    agenticMission =
      prepared.mission;

    projectNaturalMissionEvents(
      agenticMission,
      {
        operation:
          resolvedIntent.operation,
        stepId:
          prepared.stepId
      }
    );

    const requestSequence =
      agenticMission.events.length + 1;

    const request =
      createGatewayRequest({
        requestId:
          `${agenticMission.missionId}-request-${requestSequence}`,
        mission:
          agenticMission,
        operation:
          resolvedIntent.operation,
        args:
          prepared.args,
        requestedAt:
          observedAt
      });

    let dispatch =
      null;

    for await (
      const item of streamGatewayRequest({
        request,
        mission:
          agenticMission,
        options: {
          now:
            () => observedAt,
          runtime:
            options.gatewayRuntime || {},
          onMissionEvent:
            (event) =>
              projectNaturalMissionEvent(
                event,
                {
                  mission:
                    agenticMission,
                  operation:
                    resolvedIntent.operation,
                  stepId:
                    prepared.stepId
                }
              )
        }
      })
    ) {
      if (item.event) {
        projectNaturalMissionEvent(
          item.event,
          {
            mission:
              agenticMission,
            operation:
              resolvedIntent.operation,
            stepId:
              prepared.stepId
          }
        );
      }

      if (item.done) {
        dispatch =
          item.dispatch;
      }
    }

    if (!dispatch || !dispatch.result) {
      throw new Error(
        'Integrated Gateway returned no structured dispatch.'
      );
    }

    agenticMission =
      dispatch.mission;
    agenticMission =
      recordNaturalAgenticMissionPlanResult(
        agenticMission,
        {
          stepId:
            prepared.stepId,
          result:
            dispatch.result,
          at:
            observedAt
        }
      );

    projectNaturalMissionEvents(
      agenticMission,
      {
        operation:
          resolvedIntent.operation,
        stepId:
          prepared.stepId
      }
    );

    naturalEngineeringReferenceContext =
      recordNaturalEngineeringGatewayResult(
        naturalEngineeringReferenceContext,
        {
          mission:
            agenticMission,
          gatewayOperation:
            resolvedIntent.operation,
          sourceOperation:
            prepared.sourceOperation,
          result:
            dispatch.result,
          createdAt:
            observedAt
        }
      );

    output.write(
      formatNaturalGatewayResult(
        dispatch,
        activation.language
      )
    );
  }

  async function continueNaturalAgenticMission() {
    if (!agenticMission) {
      output.write(
        'Continuation: NO_MISSION\n' +
        humanText(
          activation,
          'Motivo: nenhuma missão governada existe no processo atual.\nAutoridade da continuação: nenhuma\n',
          'Reason: no governed mission exists in the current process.\nContinuation authority: none\n'
        )
      );
      return;
    }

    const observedAt =
      currentCanonicalInstant(options);
    const revalidation =
      revalidateDeterministicWorkspaceSession(
        agenticMission.session
      );
    const continuation =
      selectNaturalAgenticMissionContinuation({
        mission:
          agenticMission,
        revalidation
      });

    output.write(
      formatNaturalMissionContinuation(
        continuation,
        activation.language
      )
    );

    if (continuation.classification === 'STALE_STATE') {
      const pending =
        agenticMission.plan.filter(
          (step) => step.status === 'PENDING'
        );
      if (pending.length === 1) {
        agenticMission =
          updateNaturalAgenticMissionPlanStep(
            agenticMission,
            {
              stepId:
                pending[0].stepId,
              status:
                'BLOCKED',
              resultClass:
                'STALE_STATE',
              blocker:
                continuation.reason,
              at:
                observedAt,
              eventSummary:
                'Process-local continuation invalidated the stale live-plan step.'
            }
          );
      }
      if (agenticMission.state !== 'BLOCKED') {
        agenticMission =
          transitionNaturalAgenticMission(
            agenticMission,
            {
              type:
                'STATE_INVALIDATED',
              state:
                'BLOCKED',
              summary:
                continuation.reason,
              at:
                observedAt,
              resultClass:
                'STALE_STATE'
            }
          );
      }
      projectNaturalMissionEvents(
        agenticMission
      );
      return;
    }

    if (continuation.classification !== 'ELIGIBLE') {
      return;
    }

    const step =
      continuation.step;
    await dispatchNaturalGatewayIntent(
      Object.freeze({
        operation:
          step.operation,
        args:
          step.operation === 'evidence.inspect'
            ? Object.freeze({
                operation:
                  step.sourceOperation
              })
            : Object.freeze({}),
        objective:
          agenticMission.objective,
        sourceOperation:
          step.sourceOperation || step.operation,
        continuationStepId:
          step.stepId,
        requiresMissionContext:
          true,
        readOnly:
          true,
        authorityExpansion:
          false,
        operationalAuthority:
          false,
        mutationAuthority:
          false,
        publicationAuthority:
          false
      })
    );
  }

  rl.on('line', (line) => {
    if (
      terminal &&
      interactiveRequestInFlight
    ) {
      if (!interactiveBackpressureReported) {
        interactiveBackpressureReported =
          true;

        output.write(
          formatInteractiveBackpressureMessage(
            activation
          )
        );
      }

      return;
    }

    if (terminal) {
      interactiveRequestInFlight =
        true;
    } else {
      rl.pause();
    }

    processing =
      processing
        .then(async () => {
          const normalizedLine = String(line || '').trim();

          if (
            pendingDevelopment &&
            !/^(?:exit|quit)$/i.test(normalizedLine) &&
            !isNaturalMissionCancellationRequest(
              normalizedLine
            )
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
              if (
                controlled.action === 'GATEWAY_REQUEST' ||
                controlled.action === 'REFERENCE_REQUEST'
              ) {
                try {
                  await dispatchNaturalGatewayIntent(
                    controlled.intent
                  );
                } catch (error) {
                  output.write(
                    humanText(
                      activation,
                      `A operação governada falhou de forma segura antes de produzir evidência válida. Motivo: ${error && error.message ? error.message : 'falha de ambiente'}. Nenhuma autoridade foi concedida.\n`,
                      `The governed operation failed closed before producing valid evidence. Reason: ${error && error.message ? error.message : 'environment failure'}. No authority was granted.\n`
                    )
                  );
                }
              } else if (controlled.action === 'MISSION_CONTINUE') {
                try {
                  await continueNaturalAgenticMission();
                } catch (error) {
                  output.write(
                    humanText(
                      activation,
                      `A continuação falhou de forma segura. Motivo: ${error && error.message ? error.message : 'falha de ambiente'}. Nenhuma autoridade foi concedida.\n`,
                      `Continuation failed closed. Reason: ${error && error.message ? error.message : 'environment failure'}. No authority was granted.\n`
                    )
                  );
                }
              } else if (controlled.action === 'MISSION_PROJECTION') {
                if (!agenticMission) {
                  output.write(
                    humanText(
                      activation,
                      'Nenhuma missão governada ativa pôde ser projetada. A governança permanece fail-closed.\n',
                      'No active governed mission could be projected. Governance remains fail-closed.\n'
                    )
                  );
                } else {
                  const revalidation =
                    revalidateDeterministicWorkspaceSession(
                      agenticMission.session
                    );
                  if (
                    revalidation.decision !== 'VALID' &&
                    agenticMission.events.at(-1).type !==
                      'STATE_INVALIDATED'
                  ) {
                    const observedAt =
                      currentCanonicalInstant(options);
                    const pending =
                      agenticMission.plan.filter(
                        (step) => step.status === 'PENDING'
                      );
                    if (pending.length === 1) {
                      agenticMission =
                        updateNaturalAgenticMissionPlanStep(
                          agenticMission,
                          {
                            stepId:
                              pending[0].stepId,
                            status:
                              'BLOCKED',
                            resultClass:
                              'STALE_STATE',
                            blocker:
                              'Mission projection detected stale physical workspace state.',
                            at:
                              observedAt,
                            eventSummary:
                              'Mission projection invalidated the stale live-plan step.'
                          }
                        );
                    }
                    agenticMission =
                      transitionNaturalAgenticMission(
                        agenticMission,
                        {
                          type:
                            'STATE_INVALIDATED',
                          state:
                            'BLOCKED',
                          summary:
                            'Mission projection failed closed because physical workspace state changed.',
                          at:
                            observedAt,
                          resultClass:
                            'STALE_STATE'
                        }
                      );
                  }
                  projectNaturalMissionEvents(
                    agenticMission
                  );
                  output.write(
                    formatMissionProjection(
                      projectMissionView(
                        agenticMission,
                        controlled.projection
                      ),
                      activation.language
                    ) +
                    (
                      controlled.projection === 'status' &&
                      naturalEngineeringReferenceContext
                        ? formatNaturalReferenceContextProjection(
                            projectNaturalEngineeringReferenceContext(
                              naturalEngineeringReferenceContext
                            ),
                            activation.language
                          )
                        : ''
                    )
                  );
                }
              } else if (controlled.action === 'MISSION_CANCEL') {
                pendingDevelopment = null;

                if (runnerRuntime) {
                  runnerRuntime.cancelPending();
                }

                if (!agenticMission) {
                  output.write(
                    humanText(
                      activation,
                      'A missão não foi cancelada porque nenhum estado governado ativo está disponível.\n',
                      'The mission was not cancelled because no active governed state is available.\n'
                    )
                  );
                } else {
                  if (
                    agenticMission.state !==
                      'CANCELLED'
                  ) {
                    agenticMission =
                      cancelNaturalAgenticMission(
                        agenticMission,
                        {
                          reason:
                            'Human cancelled mission through the NATURAL control boundary.',
                          at:
                            currentCanonicalInstant(
                              options
                            )
                        }
                      );
                  }

                  projectNaturalMissionEvents(
                    agenticMission
                  );

                  output.write(
                    humanText(
                      activation,
                      'Missão governada cancelada por solicitação humana. O estado determinístico abaixo comprova a transição.\n',
                      'Governed mission cancelled by human request. The deterministic state below proves the transition.\n'
                    ) +
                    formatMissionProjection(
                      projectMissionView(
                        agenticMission,
                        'status'
                      ),
                      activation.language
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
                } else if (
                  agenticMission.state ===
                    'CANCELLED'
                ) {
                  output.write(
                    humanText(
                      activation,
                      'A missão cancelada é terminal e não foi retomada. O estado determinístico permanece CANCELLED.\n',
                      'The cancelled mission is terminal and was not resumed. Its deterministic state remains CANCELLED.\n'
                    ) +
                    formatMissionProjection(
                      projectMissionView(
                        agenticMission,
                        'status'
                      ),
                      activation.language
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
                  projectNaturalMissionEvents(
                    agenticMission
                  );
                  output.write(
                    formatMissionProjection(
                      projectMissionView(
                        agenticMission,
                        'status'
                      ),
                      activation.language
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
                              'GOVERNED_EVIDENCE_STARTED'
                          ) {
                            output.write(
                              humanText(
                                activation,
                                `Etapa ${progress.step}: obtendo evidência governada pelo Orchestrator (${progress.detail}); aguardando resultado determinístico...\n`,
                                `Step ${progress.step}: obtaining governed evidence through the Orchestrator (${progress.detail}); awaiting deterministic result...\n`
                              )
                            );
                          } else if (
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
                          } else if (
                            progress.stage ===
                              'PROVIDER_COGNITION_STARTED'
                          ) {
                            output.write(
                              humanText(
                                activation,
                                `Evidências governadas disponíveis; aguardando a análise cognitiva do provider. A tentativa local permanece limitada a ${NATURAL_LOCAL_INFERENCE_PROFILE.timeoutMs / 1000} segundos e nenhuma conclusão será afirmada antes da resposta validada.\n`,
                                `Governed evidence is available; awaiting provider cognition. The local attempt remains limited to ${NATURAL_LOCAL_INFERENCE_PROFILE.timeoutMs / 1000} seconds, and no conclusion will be claimed before a validated response.\n`
                              )
                            );
                          } else if (
                            progress.stage ===
                              'SYNTHESIS_COMPLETED'
                          ) {
                            output.write(
                              humanText(
                                activation,
                                'Síntese cognitiva concluída; preparando a resposta delimitada...\n',
                                'Cognitive synthesis completed; preparing the bounded response...\n'
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
                      const acquiredEvidenceCount =
                        Array.isArray(
                          recursive.evidence
                        )
                          ? recursive.evidence.length
                          : 0;

                      output.write(
                        humanText(
                          activation,
                          acquiredEvidenceCount > 0
                            ? `Foram obtidas ${acquiredEvidenceCount} evidências governadas, mas o provider não concluiu o processamento cognitivo. A governança permanece ativa e nenhum arquivo foi alterado.\n`
                            : 'Não foi obtida evidência qualificada suficiente para concluir a análise. A governança permanece ativa e nenhum arquivo foi alterado.\n',
                          acquiredEvidenceCount > 0
                            ? `${acquiredEvidenceCount} governed evidence observations were acquired, but the provider did not complete cognitive processing. Governance remains active and no file was changed.\n`
                            : 'Insufficient qualified evidence was acquired to complete the analysis. Governance remains active and no file was changed.\n'
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
                        `\n\nForam fornecidas à síntese ${recursive.evidence.length} evidências governadas do projeto. Inferências e recomendações permanecem cognitivas. Concluída em ${elapsedSeconds}s. Nenhum arquivo foi alterado.\n`,
                        `\n\nThe synthesis received ${recursive.evidence.length} governed project evidence observations. Inferences and recommendations remain cognitive. Completed in ${elapsedSeconds}s. No file was changed.\n`
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
                  'PROVIDER_LIST'
              ) {
                if (!cognitiveSession || typeof cognitiveSession.describeProviders !== 'function') {
                  output.write(
                    humanText(
                      activation,
                      'A lista de providers está indisponível. Nenhuma alteração foi realizada.\n',
                      'The provider list is unavailable. No change was made.\n'
                    )
                  );
                } else {
                  output.write(
                    formatProviderCatalog(
                      await cognitiveSession.describeProviders(),
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
                        `Não foi possível ativar ${controlled.model}.\nEstado: ${selected.state || 'UNAVAILABLE'}.\nMotivo: ${selected.reason}\nO modelo anterior e a governança foram preservados.\n`,
                        `Could not activate ${controlled.model}.\nState: ${selected.state || 'UNAVAILABLE'}.\nReason: ${selected.reason}\nThe previous model and governance were preserved.\n`
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

    interactiveRequestInFlight =
      false;

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
