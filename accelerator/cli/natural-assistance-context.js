'use strict';

const path =
  require('node:path');

const WORK_MODES =
  Object.freeze({
    SUPERVISED:
      'SUPERVISED_MICROTASKS',

    AUTONOMY:
      'BOUNDED_AUTONOMY_TO_BOUNDARY'
  });

function deepFreeze(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function createNaturalAssistanceContext(
  activation
) {
  if (
    !activation ||
    typeof activation !== 'object' ||
    !activation.interactionMode ||
    !['NATURAL', 'ENGINEER'].includes(
      activation.interactionMode.mode
    )
  ) {
    throw new Error(
      'NATURAL or ENGINEER activation is required.'
    );
  }

  if (
    typeof activation.repositoryPath !==
      'string' ||
    !path.isAbsolute(
      activation.repositoryPath
    )
  ) {
    throw new Error(
      'Canonical absolute repository workspace is required.'
    );
  }

  return deepFreeze({
    schema:
      'sdo.governed_development_assistance_context.v1',

    providerIndependent:
      true,

    product: {
      name:
        'Surgical DevOps',

      version:
        '2.6.0-rc.1',

      purpose:
        (
          'Ambiente de desenvolvimento assistido por IA com ' +
          'governança determinística, autoridade humana soberana ' +
          'e execução operacional mediada pelo Orchestrator.'
        ),

      conversationalExperience:
        true,

      userMustKnowInternalCommands:
        false,

      userMustKnowGovernanceTerminology:
        false
    },

    workspace: {
      repositoryPath:
        activation.repositoryPath,

      workspaceName:
        activation.workspace,

      allowedRoots: [
        activation.repositoryPath
      ],

      implicitParentAccess:
        false,

      implicitSiblingAccess:
        false,

      implicitHomeAccess:
        false,

      commonAncestorExpansion:
        false,

      explicitExpansionRequired:
        true
    },

    governance: {
      mode:
        'DETERMINISTIC',

      strategy:
        'PATCH',

      bhSep:
        activation.protocols.bhSep,

      bhSdp:
        activation.protocols.bhSdp,

      orchestrator:
        'SOVEREIGN_OPERATIONAL_AUTHORITY',

      human:
        'SOVEREIGN_DECISION_AUTHORITY',

      ai:
        'DELEGATED_COGNITIVE_ONLY',

      failClosed:
        true
    },

    assistance: {
      defaultWorkMode:
        WORK_MODES.SUPERVISED,

      availableWorkModes: [
        WORK_MODES.SUPERVISED,
        WORK_MODES.AUTONOMY
      ],

      autonomyExpandsAuthority:
        false,

      autonomyExpandsWorkspace:
        false,

      autonomyGrantsR3:
        false,

      architecturalBoundaryStopsWork:
        true
    },

    method: [
      'INSPECT_BEFORE_CHANGE',
      'PATCH_FIRST',
      'PRESERVE_STATE',
      'EXACT_SCOPE',
      'MECHANICAL_GATES',
      'NO_ARTIFICIAL_GREEN',
      'EVIDENCE_BEFORE_CLAIM',
      'FAIL_CLOSED',
      'HUMAN_SOVEREIGNTY'
    ],

    providerRules: {
      replaceable:
        true,

      providerChangeMayChangeGovernance:
        false,

      credentialCreatesOperationalAuthority:
        false,

      unsupportedProviderMayWeakenContract:
        false
    }
  });
}

function formatNaturalProviderInstruction(
  context,
  workMode
) {
  if (
    !context ||
    context.schema !==
      'sdo.governed_development_assistance_context.v1' ||
    !Object.isFrozen(context)
  ) {
    throw new Error(
      'Trusted governed assistance context is required.'
    );
  }

  if (
    !Object.values(WORK_MODES)
      .includes(workMode)
  ) {
    throw new Error(
      'Canonical NATURAL work mode is required.'
    );
  }

  return [
    'SURGICAL GOVERNED DEVELOPMENT ASSISTANCE CONTEXT',
    '',
    'Identidade do produto:',
    '- você é o assistente cognitivo integrado ao Surgical DevOps;',
    '- Surgical DevOps é um ambiente de desenvolvimento assistido por IA com governança determinística;',
    '- BH-SEP e BH-SDP definem o método governado de evolução e continuidade;',
    '- o humano permanece soberano;',
    '- o Orchestrator é a autoridade operacional;',
    '- a IA ajuda a compreender, planejar, explicar e propor, mas não adquire autoridade operacional;',
    '- o usuário NATURAL deve poder conversar normalmente, sem precisar conhecer comandos internos, R0/R1/R3, capabilities ou terminologia técnica;',
    '- quando explicar o próprio Surgical DevOps, descreva estas características específicas; não responda com uma definição genérica de DevOps.',
    '',
    'Relação com arquivos e evidências:',
    '- não diga de forma absoluta que você não consegue analisar arquivos;',
    '- você não acessa o filesystem diretamente;',
    '- o Surgical DevOps pode fornecer a você evidências obtidas por operações governadas dentro do workspace autorizado;',
    '- você pode analisar essas evidências cognitivamente sem ganhar autoridade sobre o filesystem;',
    '- outro diretório exige solicitação explícita do usuário e nova governança;',
    '',
    `Workspace autorizado: ${context.workspace.workspaceName}`,
    `Raiz autorizada: ${context.workspace.repositoryPath}`,
    `Modo de trabalho: ${workMode}`,
    '',
    'Regras obrigatórias:',
    '- trabalhe cognitivamente apenas com evidência do workspace explicitamente autorizado;',
    '- não presuma acesso a diretórios pais, irmãos, HOME ou outros projetos;',
    '- outro diretório exige solicitação explícita do usuário e nova governança;',
    '- conhecer ou sugerir um comando não concede autoridade para executá-lo;',
    '- BH-SEP exige inspeção antes de alteração e PATCH como estratégia padrão;',
    '- BH-SDP preserva continuidade por estado/snapshot qualificado;',
    '- nunca invente execução, evidência, teste verde ou alteração de arquivo;',
    '- o Orchestrator é a autoridade operacional;',
    '- o humano permanece soberano sobre decisões e aprovações;',
    '- a IA é somente camada cognitiva delegada;',
    '- autonomia significa continuidade dentro da autoridade existente;',
    '- pare diante de decisão arquitetural, expansão de escopo, nova capability, aprovação humana necessária, ambiguidade material ou evidência não qualificada.',
    '',
    'A substituição do provider não altera nenhuma dessas regras.'
  ].join('\n');
}

module.exports =
  Object.freeze({
    WORK_MODES,
    createNaturalAssistanceContext,
    formatNaturalProviderInstruction
  });
