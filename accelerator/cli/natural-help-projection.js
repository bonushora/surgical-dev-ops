'use strict';

/*
 * Governed HelpMe projection.
 *
 * This module receives existing semantic, Gateway, mission, continuity and
 * provider projections. It only derives bounded presentation data. It owns no
 * interpretation, execution, authority, state transition or persistence.
 */

const HELP_SCHEMA = 'sdo.natural_help_projection.v1';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireObject(value, label, nullable = false) {
  if (nullable && value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function implementedGatewayOperation(definition) {
  return Boolean(
    definition &&
    typeof definition === 'object' &&
    (
      typeof definition.alias === 'string' ||
      definition.localFastPath === true ||
      typeof definition.eventStarted === 'string' ||
      (
        definition.dispatch &&
        typeof definition.dispatch === 'object'
      )
    )
  );
}

function presentationFamily({
  id,
  title,
  example,
  operations = [],
  implemented = true,
  providerDependent = false,
  exactAuthorityRequired = false
}) {
  return deepFreeze({
    id,
    title,
    example,
    operations: [...operations],
    implemented,
    providerDependent,
    exactAuthorityRequired,
    presentationOnly: true,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function capabilityFamilies(language, executable, commands) {
  const english = language === 'en';
  const families = [];

  families.push(presentationFamily({
    id: 'PROJECT_ANALYSIS',
    title: english
      ? 'understand or investigate the authorized project from governed evidence'
      : 'compreender ou investigar o projeto autorizado com evidência governada',
    example: english ? 'investigate that error' : 'investigue esse erro',
    providerDependent: true
  }));

  if (executable.has('workspace.status')) {
    families.push(presentationFamily({
      id: 'workspace.status',
      title: english
        ? 'inspect the physical project status'
        : 'inspecionar o estado físico do projeto',
      example: english
        ? 'what is the state of this project?'
        : 'qual é o estado deste projeto?',
      operations: ['workspace.status']
    }));
  }

  if (executable.has('mission.status') && executable.has('mission.plan')) {
    families.push(presentationFamily({
      id: 'mission.status+mission.plan',
      title: english
        ? 'inspect the current mission status, plan and blockers'
        : 'inspecionar estado, plano e bloqueios da missão atual',
      example: english ? 'what is the plan?' : 'qual é o plano?',
      operations: ['mission.status', 'mission.plan']
    }));
  }

  if (executable.has('evidence.inspect')) {
    families.push(presentationFamily({
      id: 'evidence.inspect',
      title: english
        ? 'inspect governed evidence and prior results through bounded references'
        : 'inspecionar evidências e resultados governados por referências delimitadas',
      example: english ? 'show the last evidence' : 'mostre a última evidência',
      operations: ['evidence.inspect']
    }));
  }

  if (
    executable.has('mutation.propose') &&
    executable.has('mutation.applyConditional')
  ) {
    families.push(presentationFamily({
      id: 'mutation.propose+mutation.applyConditional',
      title: english
        ? 'prepare a bounded correction and stop for exact human authority'
        : 'preparar uma correção delimitada e parar para autoridade humana exata',
      example: english ? 'fix that' : 'corrija isso',
      operations: ['mutation.propose', 'mutation.applyConditional'],
      providerDependent: true,
      exactAuthorityRequired: true
    }));
  }

  if (
    executable.has('tests.run') &&
    executable.has('tests.runCanonical') &&
    executable.has('mutation.applyConditional') &&
    commands.has('NODE_TEST_FILE')
  ) {
    families.push(presentationFamily({
      id: 'R5_REPAIR_UNTIL_GREEN',
      title: english
        ? 'correct and test through the bounded governed repair-until-GREEN loop'
        : 'corrigir e testar pelo loop governado e delimitado até GREEN',
      example: english ? 'fix it and test it' : 'corrija e teste',
      operations: [
        'tests.run',
        'mutation.propose',
        'mutation.applyConditional',
        'tests.runCanonical'
      ],
      providerDependent: true,
      exactAuthorityRequired: true
    }));
  }

  families.push(presentationFamily({
    id: 'MISSION_CONTROL',
    title: english
      ? 'approve or deny an exact pending decision, cancel a mission, or continue one eligible step'
      : 'aprovar ou negar uma decisão exata pendente, cancelar a missão ou continuar uma etapa elegível',
    example: english ? 'continue until green' : 'continue até ficar verde'
  }));

  if (executable.has('mission.resume')) {
    families.push(presentationFamily({
      id: 'mission.resume',
      title: english
        ? 'reconstruct a durable mission after physical revalidation when continuity is configured'
        : 'reconstruir missão durável após revalidação física quando a continuidade está configurada',
      example: '/resume',
      operations: ['mission.resume']
    }));
  }

  return deepFreeze(families);
}

function negativeCapability(operation, gatewayOperations) {
  const definition = gatewayOperations[operation] || null;
  const registered = definition !== null;
  const physicallyDispatched = registered && implementedGatewayOperation(definition);
  return deepFreeze({
    operation,
    registered,
    physicallyDispatched,
    executable: false,
    reason: registered && !physicallyDispatched
      ? 'REGISTERED_WITHOUT_QUALIFIED_GATEWAY_DISPATCH'
      : 'NO_QUALIFIED_NATURAL_PRODUCTION_OPERATION',
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function boundedMission(status) {
  if (status === null) return null;
  requireObject(status, 'Mission status projection');
  if (
    status.schema !== 'sdo.natural_agentic_mission_projection.v1' ||
    status.projection !== 'status' ||
    status.operationalAuthority !== false ||
    status.mutationAuthority !== false
  ) {
    throw new Error('Authority-free mission status projection is required.');
  }
  return deepFreeze({
    missionId: status.missionId,
    missionFingerprint: status.missionFingerprint,
    state: status.state,
    generatedFromEventCount: status.generatedFromEventCount,
    blocker: status.blocker || null,
    pendingApproval: status.pendingApproval === true
  });
}

function boundedAuthority(authority) {
  if (authority === null) return null;
  requireObject(authority, 'Mission authority projection');
  if (
    authority.schema !== 'sdo.natural_agentic_mission_projection.v1' ||
    authority.projection !== 'authority' ||
    authority.operationalAuthority !== false ||
    authority.mutationAuthority !== false
  ) {
    throw new Error('Authority-free mission authority projection is required.');
  }
  return deepFreeze({
    availableCapabilities: [...authority.availableCapabilities],
    allowedCapabilities: [...authority.allowedCapabilities],
    deniedCapabilities: [...authority.deniedCapabilities],
    recordedGrantCount: authority.grants.length,
    staleGrantsInvalidated: authority.staleGrantsInvalidated === true
  });
}

function boundedContinuation(value, mission, continuity) {
  if (value === null) {
    return deepFreeze({
      classification: null,
      reason: null,
      step: null,
      physicalStateValidated: null,
      executable: false
    });
  }
  requireObject(value, 'Mission continuation projection');
  if (
    value.schema !== 'sdo.natural_agentic_mission_continuation.v1' ||
    value.operationalAuthority !== false ||
    value.mutationAuthority !== false ||
    value.authorityExpansion !== false
  ) {
    throw new Error('Authority-free mission continuation projection is required.');
  }
  const terminal = mission && ['GREEN', 'CANCELLED'].includes(mission.state);
  const continuityInvalid = continuity && continuity.classification === 'STATE_INVALIDATED';
  return deepFreeze({
    classification: value.classification,
    step: value.step
      ? deepFreeze({
          stepId: value.step.stepId,
          operation: value.step.operation,
          status: value.step.status
        })
      : null,
    physicalStateValidated: value.physicalStateValidated,
    executable:
      value.classification === 'ELIGIBLE' &&
      !terminal &&
      !continuityInvalid
  });
}

function boundedPending(value) {
  if (value === null) return null;
  requireObject(value, 'Pending HelpMe decision');
  return deepFreeze({
    kind: String(value.kind || 'GOVERNED_TASK'),
    state: String(value.state || 'PENDING'),
    proposalFingerprint:
      typeof value.proposalFingerprint === 'string'
        ? value.proposalFingerprint
        : null,
    reusableApproval: value.reusableApproval === true
  });
}

function boundedRepair(value) {
  if (value === null) return null;
  requireObject(value, 'R5 HelpMe projection');
  return deepFreeze({
    state: value.state,
    lastTestClassification: value.lastTestClassification || null,
    stopReason: value.stopReason || null,
    durableRestart: value.durableRestart === true,
    physicalRed:
      value.lastTestClassification === 'FAILED' &&
      ['READY_FOR_REPAIR', 'AUTHORITY_REQUIRED', 'TESTING'].includes(value.state)
  });
}

function boundedContinuity(value) {
  if (value === null) return null;
  requireObject(value, 'R6 HelpMe projection');
  return deepFreeze({
    classification: value.classification,
    revalidationDecision: value.revalidationDecision,
    continuationEligible: value.continuationEligible === true,
    authorityRevalidated: value.authorityRevalidated === true,
    providerMemoryUsed: value.providerMemoryUsed === true,
    historicalEventCount: value.historicalEventCount
  });
}

function boundedProvider(value) {
  if (value === null) {
    return deepFreeze({
      evaluated: false,
      state: null,
      available: null,
      active: null,
      operationalAuthority: false,
      mutationAuthority: false
    });
  }
  requireObject(value, 'Provider availability projection');
  if (
    value.operationalAuthority !== false ||
    value.mutationAuthority !== false
  ) {
    throw new Error('Authority-free provider availability is required.');
  }
  return deepFreeze({
    evaluated: true,
    state: value.state || null,
    available: value.available === true,
    active: value.active === true,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function operationAuthority(operation, executable, authority) {
  const available = authority
    ? authority.availableCapabilities.includes(operation)
    : false;
  const allowed = authority
    ? authority.allowedCapabilities.includes(operation)
    : false;
  const denied = authority
    ? authority.deniedCapabilities.includes(operation)
    : false;
  return deepFreeze({
    operation,
    implemented: executable.has(operation),
    available,
    allowed,
    denied,
    executable: executable.has(operation) && allowed && !denied,
    authorized: false,
    reason:
      executable.has(operation) && allowed && !denied
        ? 'EXACT_RUNTIME_AUTHORITY_STILL_REQUIRED'
        : 'NOT_EXECUTABLE_IN_CURRENT_NATURAL_CONTEXT'
  });
}

function validateHelpRequest(value) {
  requireObject(value, 'Governed HelpMe request');
  if (
    value.action !== 'HELP_REQUEST' ||
    value.observational !== true ||
    value.operationalAuthority !== false ||
    value.mutationAuthority !== false
  ) {
    throw new Error('Authority-free governed HelpMe request is required.');
  }
  return value;
}

function createNaturalHelpProjection({
  request,
  language = 'pt-BR',
  gatewayOperations,
  qualifiedCommandCatalog,
  missionStatus = null,
  missionAuthority = null,
  continuation = null,
  pendingDecision = null,
  repair = null,
  continuity = null,
  provider = null
} = {}) {
  const helpRequest = validateHelpRequest(request);
  const operations = requireObject(gatewayOperations, 'Gateway operations');
  const commandCatalog = requireObject(
    qualifiedCommandCatalog,
    'Qualified command catalog'
  );
  if (
    commandCatalog.schema !== 'sdo.qualified_command_catalog.v1' ||
    commandCatalog.arbitraryShell !== false ||
    commandCatalog.network !== false ||
    commandCatalog.credentials !== false ||
    commandCatalog.mutationAuthority !== false
  ) {
    throw new Error('Authority-free qualified command catalog is required.');
  }

  const executable = new Set(
    Object.entries(operations)
      .filter(([, definition]) => implementedGatewayOperation(definition))
      .map(([operation]) => operation)
  );
  const commands = new Set(Object.keys(commandCatalog.commands));
  const currentContinuity = boundedContinuity(continuity);
  const currentMission = boundedMission(missionStatus);
  const currentAuthority = boundedAuthority(missionAuthority);
  const currentContinuation = boundedContinuation(
    continuation,
    currentMission,
    currentContinuity
  );
  const capabilities = capabilityFamilies(
    language,
    executable,
    commands
  );
  const negativeCapabilities = [
    'git.stage',
    'git.commit',
    'git.push',
    'git.merge',
    'git.tag',
    'release.create',
    'npm.publish',
    'deploy'
  ].map((operation) => negativeCapability(operation, operations));

  const body = {
    schema: HELP_SCHEMA,
    language: language === 'en' ? 'en' : 'pt-BR',
    topic: helpRequest.topic || 'GENERAL',
    subjects: Array.isArray(helpRequest.subjects)
      ? [...helpRequest.subjects]
      : [],
    semanticOwner: 'sdo.natural_session_control.v1',
    capabilities,
    executableOperations: [...executable].sort(),
    negativeCapabilities,
    authority: {
      capabilityIsPermission: false,
      mission: currentAuthority,
      commit: operationAuthority('git.commit', executable, currentAuthority),
      push: operationAuthority('git.push', executable, currentAuthority),
      approvalMaterialized: false,
      approvalConsumed: false,
      reusableApproval: false
    },
    context: {
      mission: currentMission,
      continuation: currentContinuation,
      pendingDecision: boundedPending(pendingDecision),
      repair: boundedRepair(repair),
      continuity: currentContinuity
    },
    provider: boundedProvider(provider),
    deterministicTruthAvailable: true,
    presentationOnly: true,
    providerInvoked: false,
    orchestratorInvoked: false,
    gatewayInvoked: false,
    operationalAuthority: false,
    mutationAuthority: false,
    approvalAuthority: false,
    dispatchAuthority: false,
    shellAuthority: false,
    gitAuthority: false,
    networkAuthority: false,
    publicationAuthority: false,
    deploymentAuthority: false
  };

  return deepFreeze(body);
}

function contextLinesEnglish(projection) {
  const lines = [];
  const { mission, continuation, pendingDecision, repair, continuity } = projection.context;

  if (mission) {
    lines.push(
      '',
      'Current governed context:',
      `Mission: ${mission.missionId}`,
      `Mission fingerprint: ${mission.missionFingerprint}`,
      `Mission evidence events: ${mission.generatedFromEventCount}`
    );
    if (mission.state === 'GREEN') {
      lines.push('State: GREEN — historical completion; HelpMe advertises no new execution.');
    } else if (mission.state === 'CANCELLED') {
      lines.push('State: CANCELLED — terminal cancellation; resume is not available.');
    } else if (mission.state === 'BLOCKED') {
      lines.push(`State: BLOCKED — ${mission.blocker || 'a governed blocker is active.'}`);
    } else {
      lines.push(`State: ${mission.state}`);
    }
  }

  if (pendingDecision) {
    lines.push(
      pendingDecision.kind === 'REPAIR'
        ? 'An exact decision is pending for repair; HelpMe did not approve, deny or consume it.'
        : 'An exact decision is pending; HelpMe did not approve, deny or consume it.'
    );
    if (pendingDecision.proposalFingerprint) {
      lines.push(`Pending proposal: ${pendingDecision.proposalFingerprint}`);
    }
  }

  if (repair && repair.physicalRed) {
    lines.push('Physical test evidence: FAILED (RED is presentation, not a canonical mission state).');
  }

  if (continuity) {
    if (continuity.classification === 'RESUMED') {
      lines.push(
        'R6: mission reconstructed and physically revalidated; previous authority was not restored.'
      );
    } else if (continuity.classification === 'STATE_INVALIDATED') {
      lines.push(
        'R6: physical state is stale or diverged and continuity was invalidated; continuation is not executable. Previous authority was not restored.'
      );
    } else if (continuity.classification === 'HISTORICAL_GREEN') {
      lines.push('R6: GREEN is historical and was not replayed. Previous authority was not restored.');
    } else if (continuity.classification === 'HISTORICAL_CANCELLED') {
      lines.push('R6: CANCELLED is historical and terminal. Previous authority was not restored.');
    }
  }

  if (continuation.classification === 'ELIGIBLE' && continuation.executable) {
    lines.push(
      `Current continuation: eligible for ${continuation.step?.operation || 'the single governed step'}; HelpMe did not execute it.`
    );
  } else if (continuation.classification) {
    lines.push(
      `Current continuation: ${continuation.classification}; continuation is not executable by HelpMe.`
    );
  }

  return lines;
}

function contextLinesPortuguese(projection) {
  const lines = [];
  const { mission, continuation, pendingDecision, repair, continuity } = projection.context;

  if (mission) {
    lines.push(
      '',
      'Contexto governado atual:',
      `Missão: ${mission.missionId}`,
      `Fingerprint da missão: ${mission.missionFingerprint}`,
      `Eventos de evidência da missão: ${mission.generatedFromEventCount}`
    );
    if (mission.state === 'GREEN') {
      lines.push('Estado: GREEN — conclusão histórica; o HelpMe não anuncia nova execução.');
    } else if (mission.state === 'CANCELLED') {
      lines.push('Estado: CANCELLED — cancelamento terminal; retomada indisponível.');
    } else if (mission.state === 'BLOCKED') {
      lines.push(`Estado: BLOCKED — ${mission.blocker || 'há um bloqueio governado ativo.'}`);
    } else {
      lines.push(`Estado: ${mission.state}`);
    }
  }

  if (pendingDecision) {
    lines.push(
      pendingDecision.kind === 'REPAIR'
        ? 'Há uma decisão exata de reparo pendente; o HelpMe não a aprovou, negou ou consumiu.'
        : 'Há uma decisão exata pendente; o HelpMe não a aprovou, negou ou consumiu.'
    );
    if (pendingDecision.proposalFingerprint) {
      lines.push(`Proposta pendente: ${pendingDecision.proposalFingerprint}`);
    }
  }

  if (repair && repair.physicalRed) {
    lines.push('Evidência física de teste: FAILED (RED é apresentação, não estado canônico da missão).');
  }

  if (continuity) {
    if (continuity.classification === 'RESUMED') {
      lines.push(
        'R6: missão reconstruída e revalidada fisicamente; a autoridade anterior não foi restaurada.'
      );
    } else if (continuity.classification === 'STATE_INVALIDATED') {
      lines.push(
        'R6: o estado físico está stale ou divergente e a continuidade foi invalidada; a continuação não é executável. A autoridade anterior não foi restaurada.'
      );
    } else if (continuity.classification === 'HISTORICAL_GREEN') {
      lines.push('R6: GREEN é histórico e não foi repetido. A autoridade anterior não foi restaurada.');
    } else if (continuity.classification === 'HISTORICAL_CANCELLED') {
      lines.push('R6: CANCELLED é histórico e terminal. A autoridade anterior não foi restaurada.');
    }
  }

  if (continuation.classification === 'ELIGIBLE' && continuation.executable) {
    lines.push(
      `Continuação atual: elegível para ${continuation.step?.operation || 'a única etapa governada'}; o HelpMe não a executou.`
    );
  } else if (continuation.classification) {
    lines.push(
      `Continuação atual: ${continuation.classification}; a continuação não é executável pelo HelpMe.`
    );
  }

  return lines;
}

function formatNaturalHelpProjection(projection) {
  if (
    !projection ||
    projection.schema !== HELP_SCHEMA ||
    !Object.isFrozen(projection) ||
    projection.operationalAuthority !== false ||
    projection.mutationAuthority !== false
  ) {
    throw new Error('Immutable authority-free HelpMe projection is required.');
  }
  const english = projection.language === 'en';
  const lines = [
    english ? 'Governed HelpMe' : 'HelpMe governado',
    english
      ? 'You do not need to memorize commands. Speak naturally; NATURAL interprets, Surgical decides, and the Orchestrator executes only governed operations.'
      : 'Você não precisa memorizar comandos. Fale naturalmente; NATURAL interpreta, Surgical decide e o Orchestrator executa somente operações governadas.',
    english
      ? 'HelpMe explains current physical truth. It grants no authority and executes nothing.'
      : 'O HelpMe explica a verdade física atual. Ele não concede autoridade e não executa nada.'
  ];

  if (projection.topic === 'AUTHORITY_REASON') {
    const blocker = projection.context.mission?.blocker;
    lines.push(
      '',
      english ? 'Why authority is required:' : 'Por que a autoridade é necessária:',
      blocker || (
        english
          ? 'A physical mutation or separately governed operation requires one exact, bounded human decision before execution.'
          : 'Uma mutação física ou operação governada separadamente exige uma decisão humana exata e delimitada antes da execução.'
      )
    );
  } else if (projection.topic === 'AUTHORITY_SCOPE') {
    lines.push(
      '',
      english ? 'Authority scope:' : 'Escopo da autoridade:',
      english
        ? 'This context does not allow commit.'
        : 'Este contexto não permite commit.',
      english
        ? 'This context does not allow push.'
        : 'Este contexto não permite push.'
    );
  } else if (projection.topic === 'CURRENT_ACTIONS') {
    lines.push(
      '',
      english ? 'What is possible now:' : 'O que é possível agora:'
    );
    for (const family of projection.capabilities) {
      lines.push(`- ${family.title}. “${family.example}”`);
    }
  } else {
    lines.push(
      '',
      english
        ? 'Qualified NATURAL capability families:'
        : 'Famílias qualificadas de capability NATURAL:'
    );
    for (const family of projection.capabilities) {
      lines.push(`- ${family.title}. “${family.example}”`);
    }
  }

  if (['GENERAL', 'CURRENT_ACTIONS'].includes(projection.topic)) {
    lines.push(
      '',
      english
        ? `Not executable through the qualified NATURAL path: ${projection.negativeCapabilities.map((item) => item.operation).join(', ')}.`
        : `Não executável pelo caminho NATURAL qualificado: ${projection.negativeCapabilities.map((item) => item.operation).join(', ')}.`
    );
  }

  lines.push(
    ...(english
      ? contextLinesEnglish(projection)
      : contextLinesPortuguese(projection))
  );

  if (!projection.context.mission) {
    lines.push(
      '',
      english
        ? 'No active governed mission exists. General capabilities are available, but no mission-specific continuation or authority is implied.'
        : 'Não há missão governada ativa. As capabilities gerais estão disponíveis, mas isso não implica continuação ou autoridade específica.'
    );
  }

  if (projection.provider.evaluated && projection.provider.available === false) {
    lines.push(
      english
        ? 'Cognitive provider: unavailable. Deterministic governance and HelpMe truth remain available.'
        : 'Provider cognitivo: indisponível. A governança determinística e a verdade do HelpMe permanecem disponíveis.'
    );
  } else if (!projection.provider.evaluated) {
    lines.push(
      english
        ? 'Cognitive provider availability was not consulted for this deterministic projection.'
        : 'A disponibilidade do provider cognitivo não foi consultada para esta projeção determinística.'
    );
  }

  lines.push(
    english
      ? 'Capability is not permission. This Help request granted or consumed no approval.'
      : 'Capability não é permissão. Esta solicitação de ajuda não concedeu nem consumiu aprovação.'
  );

  return `${lines.join('\n')}\n`;
}

module.exports = Object.freeze({
  HELP_SCHEMA,
  createNaturalHelpProjection,
  formatNaturalHelpProjection
});
