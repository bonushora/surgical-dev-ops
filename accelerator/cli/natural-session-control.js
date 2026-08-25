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

function naturalHelpMessage() {
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
    'Quando uma ação exigir nova autorização, mudança de escopo ou uma decisão sua, eu paro e explico antes de prosseguir.\n' +
    'Se quiser ver informações internas do modo atual, diga "detalhes técnicos".\n'
  );
}

function providerSetupOverview() {
  return (
    'Posso ajudá-lo a trocar ou configurar a IA passo a passo.\n\n' +
    'Provider local padrão:\n' +
    '  Llama 3 via Ollama, quando disponível e qualificado.\n' +
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
    'Nenhuma alteração foi realizada.\n'
  );
}

function codexSetupGuide() {
  return (
    'Configuração guiada: Codex / OpenAI\n\n' +
    'Nesta versão, a integração remota Codex/OpenAI ainda não está qualificada para ativação automática.\n' +
    'Por isso nenhuma credencial será solicitada ou armazenada agora.\n\n' +
    'Quando o adapter correspondente estiver qualificado, seguirei estas etapas:\n' +
    '  1. confirmar se você quer Codex por conta/plano compatível ou OpenAI via API;\n' +
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
    'FRONTEIRA ATUAL: adapter remoto + credential boundary + commercial-information boundary ainda precisam ser qualificados.\n' +
    'Nenhuma alteração foi realizada.\n'
  );
}

function formatProviderStatus(
  discovery
) {
  if (
    discovery &&
    discovery.available === true
  ) {
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

  return (
    'Assistente cognitivo local: indisponível ou não qualificado.\n' +
    'O modo determinístico continua disponível.\n' +
    'Nenhum provider externo será selecionado automaticamente.\n'
  );
}

function createNaturalSessionControl(
  options = {}
) {
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

          output:
            'Tudo bem. A operação foi cancelada e nenhuma autoridade nova foi materializada.\n'
        });
      }

      return Object.freeze({
        matched: true,

        action:
          'CONTINUE',

        output:
          'Há uma operação aguardando sua decisão. Responda "sim" para autorizar ou "não" para cancelar.\n'
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
            workspace
          )
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
          'como posso usar o surgical devops'
        ]
      )
    ) {
      return Object.freeze({
        matched: true,
        action:
          'CONTINUE',
        output:
          naturalHelpMessage()
      });
    }

    if (
      text === 'detalhes tecnicos' ||
      text === 'mostrar detalhes tecnicos' ||
      text === 'ver detalhes tecnicos'
    ) {
      return Object.freeze({
        matched: true,
        action:
          'TECHNICAL_STATUS'
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
          'qual e a ia atual'
        ]
      )
    ) {
      return Object.freeze({
        matched: true,
        action:
          'PROVIDER_STATUS'
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
          'quais providers posso usar'
        ]
      )
    ) {
      return Object.freeze({
        matched: true,
        action:
          'CONTINUE',
        output:
          providerSetupOverview()
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
          'quero usar openai'
        ]
      )
    ) {
      return Object.freeze({
        matched: true,
        action:
          'CONTINUE',
        output:
          codexSetupGuide()
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
          'modo autonomo'
        ]
      )
    ) {
      workMode =
        WORK_MODES.AUTONOMY;

      return Object.freeze({
        matched: true,
        action:
          'CONTINUE',
        output:
          'Modo de assistência: AUTONOMIA LIMITADA ATÉ A FRONTEIRA.\n' +
          'Vou manter continuidade apenas dentro do workspace, capabilities e autoridade já válidos.\n' +
          'Pararei diante de nova decisão arquitetural, expansão de escopo, nova autoridade, aprovação humana necessária, ambiguidade material ou estado não qualificado.\n' +
          'Este modo não amplia minha autoridade.\n'
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
          'trabalhe passo a passo'
        ]
      )
    ) {
      workMode =
        WORK_MODES.SUPERVISED;

      return Object.freeze({
        matched: true,
        action:
          'CONTINUE',
        output:
          'Modo de assistência: MICROTAREFAS SUPERVISIONADAS.\n' +
          'Vou trabalhar em unidades pequenas e devolver o controle entre etapas relevantes.\n' +
          'A governança e a autoridade permanecem inalteradas.\n'
      });
    }

    if (
      includesAny(
        text,
        [
          'qual e o modo de trabalho',
          'qual o modo de trabalho',
          'como estamos trabalhando',
          'modo de assistencia'
        ]
      )
    ) {
      return Object.freeze({
        matched: true,
        action:
          'CONTINUE',
        output:
          `Modo de assistência atual: ${workMode}.\n`
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
