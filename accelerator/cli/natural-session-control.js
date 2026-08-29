'use strict';

const {
  WORK_MODES
} = require(
  './natural-assistance-context'
);

const {
  detectNaturalGovernedTask,
  formatTaskProposal,
  isAffirmative,
  isNegative
} = require(
  './natural-governed-task'
);

const {
  classifyNaturalTerminalInput,
  formatNaturalTerminalBoundary
} = require(
  './natural-terminal-boundary'
);

const {
  normalizeHumanLanguage,
  isEnglish
} = require('./human-language');

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function includesAny(
  text,
  patterns
) {
  return patterns.some(
    (pattern) =>
      text.includes(pattern)
  );
}

function isBlanketFutureApproval(text) {
  return includesAny(
    text,
    [
      'considere que eu ja aprovei todas as alteracoes futuras',
      'considere todas as alteracoes futuras aprovadas',
      'eu aprovo todas as alteracoes futuras',
      'autorizo todas as alteracoes futuras',
      'autorizo tudo daqui para frente',
      'consider all future changes approved',
      'i approve all future changes',
      'i authorize all future changes',
      'assume all future changes are approved'
    ]
  );
}

function formatBlanketApprovalRejection(text, preferredLanguage = null) {
  const english =
    preferredLanguage
      ? isEnglish(preferredLanguage)
      : /\b(?:consider|future|approve|authorize|assume)\b/i.test(text);

  if (english) {
    return (
      'Blanket or future authorization was not accepted.\n' +
      'Human approval cannot be inferred, remembered or reused for unspecified operations.\n' +
      'Each authority-sensitive operation requires an exact pending proposal with bounded target, scope and evidence.\n' +
      'No authority was granted and no change was made.\n'
    );
  }

  return (
    'A autorização abrangente ou futura não foi aceita.\n' +
    'A aprovação humana não pode ser presumida, memorizada ou reutilizada para operações não especificadas.\n' +
    'Cada operação sensível à autoridade exige uma proposta pendente exata, com alvo, escopo e evidências delimitados.\n' +
    'Nenhuma autoridade foi concedida e nenhuma alteração foi realizada.\n'
  );
}

function detectBoundedMutationRequest(text) {
  const portuguese =
    text.match(
      /^(?:altere|mude|atualize) (?:o )?(?:arquivo )?([a-z0-9_./-]+) para (?:a )?(?:versao )?([a-z0-9_.-]+)$/
    );

  if (portuguese) {
    return Object.freeze({
      language: 'pt-BR',
      target: portuguese[1],
      requestedValue: portuguese[2]
    });
  }

  const english =
    text.match(
      /^(?:change|update) (?:the )?(?:file )?([a-z0-9_./-]+) to (?:version )?([a-z0-9_.-]+)$/
    );

  if (!english) {
    return null;
  }

  return Object.freeze({
    language: 'en',
    target: english[1],
    requestedValue: english[2]
  });
}

function formatBoundedMutationBoundary(request, preferredLanguage = null) {
  if (preferredLanguage ? isEnglish(preferredLanguage) : request.language === 'en') {
    return (
      'Mutation proposal detected.\n' +
      'State: HUMAN_AUTHORITY_REQUIRED\n' +
      `Target: ${request.target}\n` +
      `Requested value: ${request.requestedValue}\n` +
      'Next required step: inspect the current file and prepare an exact PATCH with before/after evidence.\n' +
      'This request is not authorization. No mutation was dispatched and no file was changed.\n'
    );
  }

  return (
    'Proposta de mutação detectada.\n' +
    'Estado: HUMAN_AUTHORITY_REQUIRED\n' +
    `Alvo: ${request.target}\n` +
    `Valor solicitado: ${request.requestedValue}\n` +
    'Próxima etapa obrigatória: inspecionar o arquivo atual e preparar um PATCH exato com evidências de antes e depois.\n' +
    'Este pedido não constitui autorização. Nenhuma mutação foi despachada e nenhum arquivo foi alterado.\n'
  );
}

function naturalHelpMessage(language = 'pt-BR') {
  if (isEnglish(language)) {
    return (
      'You can talk to me normally about this project.\n\n' +
      'For example, you can say:\n' +
      '  "Where are we now?"\n' +
      '  "Explain this project to me."\n' +
      '  "Check whether there are pending changes."\n' +
      '  "What is the current branch?"\n' +
      '  "Explain this file."\n' +
      '  "What do you suggest doing next?"\n' +
      '  "Work step by step."\n' +
      '  "Work until the next architectural boundary."\n' +
      '  "I want to switch AI providers."\n\n' +
      'You can also say "conversation status" or "clear conversation".\n\n' +
      'When an action requires new authorization, a scope change, or your decision, I will stop and explain before proceeding.\n' +
      'To see internal details for the current mode, say "technical details".\n'
    );
  }

  return (
    'Você pode conversar comigo normalmente sobre este projeto.\n\n' +
    'Por exemplo, pode dizer:\n' +
    '  "Em que ponto estamos?"\n' +
    '  "Explique este projeto para mim."\n' +
    '  "Veja se há alguma alteração pendente."\n' +
    '  "Qual é a branch atual?"\n' +
    '  "Explique este arquivo."\n' +
    '  "O que você sugere fazer agora?"\n' +
    '  "Trabalhe passo a passo."\n' +
    '  "Trabalhe sozinha até a próxima fronteira arquitetural."\n' +
    '  "Quero trocar de IA."\n\n' +
    'Também pode dizer "estado da conversa" ou "limpar conversa".\n\n' +
    'Quando uma ação exigir nova autorização, mudança de escopo ou uma decisão sua, eu paro e explico antes de prosseguir.\n' +
    'Se quiser ver informações internas do modo atual, diga "detalhes técnicos".\n'
  );
}

function providerSetupOverview(language = 'pt-BR') {
  if (isEnglish(language)) {
    return (
      'I can help you switch or configure the AI step by step.\n\n' +
      'Qualified free local models:\n' +
      '  qwen3:8b  — default bilingual quality profile.\n' +
      '  gemma3:4b — fast bilingual profile.\n' +
      '  Local execution: no Ollama API call charge.\n' +
      '  Local computing resources and applicable licenses remain the user’s responsibility.\n\n' +
      'Other providers may replace the cognitive provider without changing the Orchestrator or governance.\n' +
      'External providers may charge under their own plans and terms.\n' +
      'Surgical DevOps does not receive, intermediate, or retain provider fees or commissions.\n' +
      'Use "use qwen3:8b" or "use gemma3:4b".\n' +
      'Selection applies only to this session and requires the model to be installed already.\n' +
      'No change was made.\n'
    );
  }

  return (
    'Posso ajudá-lo a trocar ou configurar a IA passo a passo.\n\n' +
    'Modelos locais gratuitos qualificados:\n' +
    '  qwen3:8b  — padrão bilíngue de qualidade.\n' +
    '  gemma3:4b — perfil bilíngue rápido.\n' +
    '  Execução local: sem cobrança por chamada de API do Ollama.\n' +
    '  Recursos computacionais locais e licenças aplicáveis continuam sendo responsabilidade do usuário.\n\n' +
    'Outros providers:\n' +
    '  podem substituir o provider cognitivo sem alterar o Orchestrator ou a governança.\n\n' +
    'Para um provider externo, o fluxo será:\n' +
    '  1. identificar provider e forma de acesso;\n' +
    '  2. consultar planos, limites e preços atuais em fonte oficial;\n' +
    '  3. explicar assinatura, API, créditos ou cobrança por uso;\n' +
    '  4. obter sua escolha explícita;\n' +
    '  5. configurar a credencial apenas no boundary do provider;\n' +
    '  6. testar conexão e compatibilidade;\n' +
    '  7. ativar somente após verificação.\n\n' +
    'O Surgical DevOps não recebe, intermedeia ou retém taxas ou comissões do consumo desses providers.\n' +
    'Use "usar qwen3:8b" ou "usar gemma3:4b".\n' +
    'A seleção vale somente para esta sessão e exige que o modelo já esteja instalado.\n' +
    'Nenhuma alteração foi realizada.\n'
  );
}

function codexSetupGuide(language = 'pt-BR') {
  if (isEnglish(language)) {
    return (
      'Guided setup: OpenAI via API\n\n' +
      'The OpenAI Responses adapter is qualified, but it is never activated automatically.\n' +
      'A ChatGPT subscription and API usage are separate commercial relationships.\n\n' +
      'Before activation, Surgical DevOps must confirm current official terms, explain data exposure and costs, obtain explicit authorization, receive credentials only through the provider boundary, and verify compatibility.\n' +
      'Prices are not hardcoded. External charges are made by the provider, and Surgical DevOps receives no commission.\n\n' +
      'CURRENT BOUNDARY: confirm current commercial information and your explicit choice before receiving any credential.\n' +
      'No change was made.\n'
    );
  }

  return (
    'Configuração guiada: OpenAI via API\n\n' +
    'O adapter OpenAI Responses está qualificado, mas nunca é ativado automaticamente.\n' +
    'A assinatura do ChatGPT e o uso da API são relações comerciais distintas.\n\n' +
    'Para ativá-lo, seguirei estas etapas:\n' +
    '  1. confirmar explicitamente que você quer OpenAI via API;\n' +
    '  2. consultar a documentação oficial vigente do provider;\n' +
    '  3. mostrar planos, limites e custos confirmados, com fonte e data;\n' +
    '  4. explicar quais dados poderão ser enviados ao provider;\n' +
    '  5. pedir autorização explícita antes de configurar serviço pago;\n' +
    '  6. receber a credencial somente pelo boundary próprio do provider;\n' +
    '  7. testar autenticação e compatibilidade;\n' +
    '  8. ativar o provider somente se todos os gates passarem.\n\n' +
    'Preços não são hardcoded pelo Surgical DevOps.\n' +
    'Se preços atuais não puderem ser confirmados, o sistema deverá dizer isso explicitamente.\n' +
    'Cobranças externas são feitas pelo próprio provider.\n' +
    'O Surgical DevOps não recebe nem retém comissão desse consumo.\n\n' +
    'FRONTEIRA ATUAL: confirmar informações comerciais atuais e sua escolha explícita antes de receber qualquer credencial.\n' +
    'Nenhuma alteração foi realizada.\n'
  );
}

function formatProviderStatus(
  discovery,
  language = 'pt-BR'
) {
  const english = isEnglish(language);
  if (
    discovery &&
    discovery.available === true
  ) {
    if (english) {
      return (
        'Current cognitive assistant:\n' +
        `  Provider: ${discovery.provider}\n` +
        `  Model: ${discovery.model}\n` +
        '  Execution: local\n' +
        '  State: verified and available\n' +
        '  Operational authority of the AI: none\n\n' +
        'Compatible providers may replace this model without changing governance.\n'
      );
    }

    return (
      'Assistente cognitivo atual:\n' +
      `  Provider: ${discovery.provider}\n` +
      `  Modelo: ${discovery.model}\n` +
      '  Execução: local\n' +
      '  Aceleração: automática pelo Ollama (CPU/GPU)\n' +
      '  Perfil: balanceado, contexto 4096, modelo aquecido por 10 minutos\n' +
      '  Estado: verificado e disponível\n' +
      '  Cobrança por chamada de API do Ollama local: não\n' +
      '  Autoridade operacional da IA: nenhuma\n\n' +
      'Outros providers compatíveis podem substituir este modelo.\n' +
      'Providers externos podem cobrar diretamente conforme seus próprios planos e termos.\n' +
      'O Surgical DevOps não recebe, intermedeia ou retém taxas ou comissões desses providers.\n'
    );
  }

  return english
    ? (
        'Local cognitive assistant: unavailable or unqualified.\n' +
        'Deterministic mode remains available.\n' +
        'No external provider will be selected automatically.\n'
      )
    : (
    'Assistente cognitivo local: indisponível ou não qualificado.\n' +
    'O modo determinístico continua disponível.\n' +
    'Nenhum provider externo será selecionado automaticamente.\n'
      );
}

function createNaturalSessionControl(
  options = {}
) {
  const preferredLanguage =
    typeof options.language === 'string' && options.language.trim()
      ? normalizeHumanLanguage(options.language)
      : null;
  const language = preferredLanguage || 'pt-BR';
  const english = isEnglish(language);
  let workMode =
    WORK_MODES.SUPERVISED;

  const workspace =
    typeof options.workspace === 'string' &&
    options.workspace.trim()
      ? options.workspace.trim()
      : 'current-project';

  let pendingTask =
    null;

  function currentWorkMode() {
    return workMode;
  }

  function handle(input) {
    const text =
      normalize(input);

    if (!text) {
      return Object.freeze({
        matched: false
      });
    }

    if (
      text === 'exit' ||
      text === 'quit'
    ) {
      return Object.freeze({
        matched: false
      });
    }

    const terminalBoundary =
      classifyNaturalTerminalInput(input);

    if (terminalBoundary.boundary !== 'NONE') {
      return Object.freeze({
        matched: true,
        action: 'CONTINUE',
        output: formatNaturalTerminalBoundary(terminalBoundary, language)
      });
    }

    if (isBlanketFutureApproval(text)) {
      return Object.freeze({
        matched: true,
        action: 'CONTINUE',
        output: formatBlanketApprovalRejection(text, preferredLanguage)
      });
    }

    if (!pendingTask) {
      const mutationRequest =
        detectBoundedMutationRequest(text);

      if (mutationRequest) {
        return Object.freeze({
          matched: true,
          action: 'CONTINUE',
          output:
            formatBoundedMutationBoundary(
              mutationRequest,
              preferredLanguage
            )
        });
      }
    }

    if (pendingTask) {
      if (isAffirmative(input)) {
        const authorizedTask =
          pendingTask;

        pendingTask =
          null;

        return Object.freeze({
          matched: true,

          action:
            'AUTHORIZED_GOVERNED_TASK',

          task:
            authorizedTask
        });
      }

      if (isNegative(input)) {
        pendingTask =
          null;

        return Object.freeze({
          matched: true,

          action:
            'CONTINUE',

          output: english
            ? 'All right. The operation was cancelled and no new authority was materialized.\n'
            : 'Tudo bem. A operação foi cancelada e nenhuma autoridade nova foi materializada.\n'
        });
      }

      return Object.freeze({
        matched: true,

        action:
          'CONTINUE',

        output: english
          ? 'An operation is waiting for your decision. Answer "yes" to authorize or "no" to cancel.\n'
          : 'Há uma operação aguardando sua decisão. Responda "sim" para autorizar ou "não" para cancelar.\n'
      });
    }

    const governedTask =
      detectNaturalGovernedTask(
        input
      );

    if (governedTask) {
      pendingTask =
        governedTask;

      return Object.freeze({
        matched: true,

        action:
          'CONTINUE',

        output:
          formatTaskProposal(
            governedTask,
            workspace,
            preferredLanguage
          )
      });
    }

    if (
      text === 'limpar conversa' ||
      text === 'nova conversa' ||
      text === 'esquecer conversa' ||
      text === 'reiniciar conversa' ||
      text === 'clear conversation' ||
      text === 'new conversation' ||
      text === 'reset conversation'
    ) {
      return Object.freeze({
        matched: true,
        action: 'CONVERSATION_RESET'
      });
    }

    if (
      text === 'estado da conversa' ||
      text === 'memoria da conversa' ||
      text === 'contexto da conversa' ||
      text === 'conversation status' ||
      text === 'conversation memory' ||
      text === 'conversation context'
    ) {
      return Object.freeze({
        matched: true,
        action: 'CONVERSATION_STATUS'
      });
    }

    if (
      text === 'estado da experiencia' ||
      text === 'experience status' ||
      text === 'session experience'
    ) {
      return Object.freeze({
        matched: true,
        action: 'EXPERIENCE_STATUS',
        language: text === 'estado da experiencia' ? 'pt-BR' : 'en'
      });
    }

    if (
      text === 'ajuda' ||
      text === 'help' ||
      includesAny(
        text,
        [
          'o que voce pode fazer',
          'como voce pode me ajudar',
          'como posso usar voce',
          'como posso usar o surgical devops',
          'what can you do',
          'how can you help me',
          'how can i use surgical devops'
        ]
      )
    ) {
      return Object.freeze({
        matched: true,
        action:
          'CONTINUE',
        output:
          naturalHelpMessage(language)
      });
    }

    if (
      text === 'detalhes tecnicos' ||
      text === 'mostrar detalhes tecnicos' ||
      text === 'ver detalhes tecnicos' ||
      text === 'technical details' ||
      text === 'show technical details'
    ) {
      return Object.freeze({
        matched: true,
        action:
          'TECHNICAL_STATUS'
      });
    }

    if (
      text === 'listar modelos' ||
      text === 'modelos' ||
      text === 'listar ias' ||
      text === 'list models' ||
      text === 'models' ||
      text === 'list ais'
    ) {
      return Object.freeze({
        matched: true,
        action:
          'CONTINUE',
        output:
          providerSetupOverview(language)
      });
    }

    if (
      text === 'providers' ||
      text === 'provedores' ||
      includesAny(
        text,
        [
          'qual ia esta ativa',
          'qual ia esta sendo usada',
          'qual provider esta ativo',
          'qual provider esta sendo usado',
          'qual e a ia atual',
          'which ai is active',
          'which provider is active',
          'current ai provider'
        ]
      )
    ) {
      return Object.freeze({
        matched: true,
        action:
          'PROVIDER_STATUS'
      });
    }

    const localModelSelection =
      text.match(
        /^(?:usar|use|ativar|ative|selecionar|selecione) (qwen3(?::8b)?|qwen|gemma3(?::4b)?|gemma)$/
      );

    if (localModelSelection) {
      const requested =
        localModelSelection[1]
          .startsWith('qwen')
          ? 'qwen3:8b'
          : 'gemma3:4b';

      return Object.freeze({
        matched: true,
        action:
          'LOCAL_MODEL_SELECTION',
        model:
          requested
      });
    }

    if (
      includesAny(
        text,
        [
          'quero trocar de ia',
          'quero trocar a ia',
          'trocar de ia',
          'trocar a ia',
          'quero outra ia',
          'conectar outra ia',
          'usar outra ia',
          'quais ias posso usar',
          'quais providers posso usar',
          'i want to switch ai providers',
          'switch ai provider',
          'use another ai',
          'which providers can i use'
        ]
      )
    ) {
      return Object.freeze({
        matched: true,
        action:
          'CONTINUE',
        output:
          providerSetupOverview(language)
      });
    }

    if (
      includesAny(
        text,
        [
          'quero usar o codex',
          'quero usar codex',
          'usar o codex',
          'usar codex',
          'conectar codex',
          'usar openai',
          'quero usar openai',
          'i want to use codex',
          'use codex',
          'connect codex',
          'use openai',
          'i want to use openai'
        ]
      )
    ) {
      return Object.freeze({
        matched: true,
        action: 'FRONTIER_PROVIDER_SETUP',
        providerId: 'openai:gpt-5.6',
        output: codexSetupGuide(language)
      });
    }

    if (
      includesAny(
        text,
        [
          'trabalhe sozinha ate a proxima fronteira',
          'trabalhe sozinho ate a proxima fronteira',
          'trabalhe ate a proxima fronteira arquitetural',
          'trabalhe sozinha ate a proxima fronteira arquitetural',
          'trabalhe sozinho ate a proxima fronteira arquitetural',
          'modo autonomia',
          'modo autonomo',
          'work until the next boundary',
          'work until the next architectural boundary',
          'bounded autonomy mode'
        ]
      )
    ) {
      workMode =
        WORK_MODES.AUTONOMY;

      return Object.freeze({
        matched: true,
        action:
          'CONTINUE',
        output: english
          ? (
              'Assistance mode: BOUNDED AUTONOMY UNTIL THE BOUNDARY.\n' +
              'I will preserve continuity only within the already valid workspace, capabilities, and authority.\n' +
              'I will stop at a new architectural decision, scope expansion, new authority, required human approval, material ambiguity, or unqualified state.\n' +
              'This mode does not expand my authority.\n'
            )
          : (
          'Modo de assistência: AUTONOMIA LIMITADA ATÉ A FRONTEIRA.\n' +
          'Vou manter continuidade apenas dentro do workspace, capabilities e autoridade já válidos.\n' +
          'Pararei diante de nova decisão arquitetural, expansão de escopo, nova autoridade, aprovação humana necessária, ambiguidade material ou estado não qualificado.\n' +
          'Este modo não amplia minha autoridade.\n'
            )
      });
    }

    if (
      includesAny(
        text,
        [
          'modo microtarefas',
          'microtarefas supervisionadas',
          'quero supervisionar cada etapa',
          'volte para microtarefas',
          'trabalhe passo a passo',
          'supervised microtasks',
          'work step by step',
          'return to supervised microtasks'
        ]
      )
    ) {
      workMode =
        WORK_MODES.SUPERVISED;

      return Object.freeze({
        matched: true,
        action:
          'CONTINUE',
        output: english
          ? (
              'Assistance mode: SUPERVISED MICROTASKS.\n' +
              'I will work in small units and return control between relevant steps.\n' +
              'Governance and authority remain unchanged.\n'
            )
          : (
          'Modo de assistência: MICROTAREFAS SUPERVISIONADAS.\n' +
          'Vou trabalhar em unidades pequenas e devolver o controle entre etapas relevantes.\n' +
          'A governança e a autoridade permanecem inalteradas.\n'
            )
      });
    }

    if (
      includesAny(
        text,
        [
          'qual e o modo de trabalho',
          'qual o modo de trabalho',
          'como estamos trabalhando',
          'modo de assistencia',
          'what is the work mode',
          'current assistance mode',
          'how are we working'
        ]
      )
    ) {
      return Object.freeze({
        matched: true,
        action:
          'CONTINUE',
        output: english
          ? `Current assistance mode: ${workMode}.\n`
          : `Modo de assistência atual: ${workMode}.\n`
      });
    }

    return Object.freeze({
      matched: false
    });
  }

  return Object.freeze({
    schema:
      'sdo.natural_session_control.v1',

    handle,
    currentWorkMode,

    experienceState() {
      return Object.freeze({
        workMode,
        pendingAuthorization: pendingTask === null
          ? null
          : Object.freeze({
              kind: pendingTask.kind,
              objective: pendingTask.objective
            }),
        operationalAuthority: false,
        mutationAuthority: false
      });
    },

    hasPendingAuthorization() {
      return pendingTask !== null;
    }
  });
}

module.exports =
  Object.freeze({
    normalize,
    naturalHelpMessage,
    providerSetupOverview,
    codexSetupGuide,
    formatProviderStatus,
    createNaturalSessionControl
  });
