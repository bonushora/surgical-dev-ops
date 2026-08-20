#!/usr/bin/env node

'use strict';

const path = require('path');

const repositoryDiscovery = require('./repository-discovery');

const {
  prepareTask
} = require('./task-preparation');

const declarativeInspection = require('./declarative-inspection');

const {
  classifyScope
} = require('./risk-classification');

const {
  buildChangePlan
} = require('./change-plan');

const {
  createStateBoundary,
  assertTransition
} = require('./state-boundary');

const CONTROLLED_ACTIONS = Object.freeze({
  PROCESS_VALIDATION: Object.freeze({
    action: 'VALIDATE_JAVASCRIPT', capabilityType: 'PROCESS_VALIDATION'
  }),
  FILESYSTEM_PATCH: Object.freeze({
    action: 'PATCH_FILE', capabilityType: 'FILESYSTEM_PATCH'
  })
});

function executionDenial(reason) {
  return Object.freeze({
    schema: 'sdo.execution_denial.v1', decision: 'DENIED', reason
  });
}

function deniedAtBoundary(reason) {
  const execution = executionDenial(reason);
  return Object.freeze({
    schema: 'sdo.orchestration.v1',
    orchestration: Object.freeze({
      status: 'DENIED', executionAttempted: false, executionAllowed: false
    }),
    execution,
    state: Object.freeze({ status: 'NOT_EXECUTABLE' }),
    nextStep: reason
  });
}

function rejectUnsafeRequestShape(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const forbidden = ['command', 'args', 'executable'];
  if (forbidden.some((key) => Object.prototype.hasOwnProperty.call(input, key))) {
    return deniedAtBoundary('Legacy generic executable, command and arguments are denied.');
  }
  if (Object.prototype.hasOwnProperty.call(input, 'executionMode') ||
      Object.prototype.hasOwnProperty.call(input, 'executionAction')) {
    return deniedAtBoundary('Legacy execution mode or action is denied.');
  }
  if (!Object.prototype.hasOwnProperty.call(input, 'execution')) return null;
  const request = input.execution;
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return deniedAtBoundary('Unknown or malformed controlled adapter/action.');
  }
  const contract = CONTROLLED_ACTIONS[request.adapter];
  if (!contract || request.action !== contract.action) {
    return deniedAtBoundary('Unknown controlled adapter or action.');
  }
  if (['command', 'args', 'executable'].some(
    (key) => Object.prototype.hasOwnProperty.call(request, key)
  )) {
    return deniedAtBoundary('Generic execution fields are forbidden in controlled requests.');
  }
  return null;
}

function validateControlledRequest(request, repositoryPath) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return executionDenial('Missing or malformed capability context.');
  }
  const contract = CONTROLLED_ACTIONS[request.adapter];
  if (!contract || request.action !== contract.action) {
    return executionDenial('Unknown controlled adapter or action.');
  }
  const evaluation = request.grantEvaluation;
  const grant = evaluation && evaluation.grant;
  if (!evaluation || evaluation.schema !== 'sdo.capability_grant_evaluation.v1' ||
      evaluation.decision !== 'ALLOWED' || !grant ||
      !Object.isFrozen(evaluation) || !Object.isFrozen(grant)) {
    return executionDenial('Missing or malformed capability context.');
  }
  if (request.operationId !== grant.operationId) {
    return executionDenial('Capability operationId mismatch.');
  }
  if (request.workspace !== repositoryPath || grant.workspace !== repositoryPath) {
    return executionDenial('Capability workspace mismatch.');
  }
  const observed = Date.parse(request.observedAt);
  const expires = Date.parse(grant.expiresAt);
  if (!Number.isFinite(observed) || !Number.isFinite(expires) || observed >= expires) {
    return executionDenial('Capability grant is stale or expired.');
  }
  if (grant.policyDecision !== 'ALLOWED' || !/^R[0-3]$/.test(grant.riskLevel) ||
      grant.lifecycleState !== 'PENDING') {
    return executionDenial('Capability policy, risk or lifecycle state is invalid.');
  }
  if (grant.capabilityType !== contract.capabilityType) {
    return executionDenial('Capability scope or type mismatch.');
  }
  if (request.adapter === 'PROCESS_VALIDATION') {
    const paths = grant.scope && grant.scope.paths;
    const selectors = grant.scope && grant.scope.selectors;
    if (!Array.isArray(paths) || !paths.some((entry) => entry.path === request.target) ||
        !Array.isArray(selectors) || !selectors.includes(request.selector)) {
      return executionDenial('Capability scope mismatch.');
    }
  } else if (!grant.scope || !grant.scope.target ||
      grant.scope.target.path !== request.target) {
    return executionDenial('Capability scope mismatch.');
  }
  return executionDenial(
    'Controlled adapters are authoritative but disconnected from the orchestrator.'
  );
}

function validateInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Orchestrator input must be an object.');
  }

  if (
    typeof input.repositoryPath !== 'string' ||
    !input.repositoryPath.trim()
  ) {
    throw new Error('repositoryPath is required.');
  }

  if (
    typeof input.description !== 'string' ||
    !input.description.trim()
  ) {
    throw new Error('Task description is required.');
  }

  if (!Array.isArray(input.files) || input.files.length === 0) {
    throw new Error('At least one target file is required.');
  }
}

function orchestrate(input) {
  const boundaryDenial = rejectUnsafeRequestShape(input);
  if (boundaryDenial) return boundaryDenial;

  validateInput(input);

  const repositoryPath = path.resolve(
    input.repositoryPath
  );

  /*
   * PHASE 1
   * Physical repository discovery.
   */
  const discovery = repositoryDiscovery.discover(
    repositoryPath
  );

  /*
   * PHASE 2
   * Deterministic task preparation.
   */
  const task = prepareTask(
    input.description,
    {
      mode: input.mode || 'PATCH',
      risk: input.risk || 'BAIXO',
      authorizeExecution:
        input.authorizeExecution === true
    }
  );

  /*
   * PHASE 3
   * Declarative inspection.
   */
  const inspection = declarativeInspection.inspect(
    repositoryPath,
    {
      files: input.files,
      hypothesis:
        input.hypothesis ||
        'Inspecionar fisicamente o escopo antes de qualquer alteração.',
      objective:
        input.objective ||
        'Validar o estado real dos arquivos envolvidos antes da execução.',
      diffEstimate:
        input.diffEstimate ||
        'Não estimado',
      risk:
        task.task.risk,
      mode:
        task.task.mode
    }
  );

  /*
   * PHASE 4
   * Risk classification.
   */
  const classification = classifyScope({
    files: inspection.inspection.files,
    mode: task.task.mode,
    risk: task.task.risk,
    estimatedDiffLines:
      Number(input.estimatedDiffLines || 0),
    architecturalChange:
      input.architecturalChange === true,
    worktreeClean:
      discovery.worktree.clean,
    facts: input.facts || {
      readOnly: false,
      externalEffect: false,
      reversible: true,
      sensitive: false,
      critical: false,
      irreversible: false
    },
    policy: input.policy || {
      decision: input.authorizeExecution === true ? 'ALLOW' : 'DENY'
    }
  });

  /*
   * PHASE 5
   * Change authorization.
   */
  const changePlan = buildChangePlan({
    discovery,
    task,
    inspection,
    classification
  });

  /*
   * Deterministic gate.
   *
   * Nothing may reach the executor unless the
   * change plan is explicitly AUTHORIZED.
   */
  if (!changePlan.decision.executionAllowed) {
    return {
      schema: 'sdo.orchestration.v1',

      orchestration: {
        status: 'BLOCKED',
        executionAttempted: false,
        executionAllowed: false
      },

      repository: discovery.repository,

      worktree: discovery.worktree,

      pipeline: {
        discovery,
        task,
        inspection,
        classification,
        changePlan
      },

      execution: null,

      nextStep:
        changePlan.nextStep
    };
  }

  /*
   * PHASE 6
   * Immutable state boundary before mutation.
   *
   * No execution may occur without a physical
   * before-state snapshot.
   */
  const stateBoundary = createStateBoundary({
    before: {
      path: discovery.repository.path,
      branch: discovery.repository.branch,
      commit: discovery.repository.commit,
      shortCommit: discovery.repository.shortCommit,
      clean: discovery.worktree.clean,
      changedFiles: discovery.worktree.changedFiles
    },

    operation: {
      description: task.task.description,
      mode: changePlan.decision.mode,
      risk: changePlan.decision.risk,
      authorizationStatus:
        changePlan.decision.status
    }
  });

  const pendingTransition =
    assertTransition(stateBoundary);

  const controlledRequested =
    Object.prototype.hasOwnProperty.call(input, 'execution');

  if (!controlledRequested) {
    return {
      schema: 'sdo.orchestration.v1',

      orchestration: {
        status: 'AUTHORIZED',
        executionAttempted: false,
        executionAllowed: true
      },

      repository: discovery.repository,

      worktree: discovery.worktree,

      pipeline: {
        discovery,
        task,
        inspection,
        classification,
        changePlan
      },

      execution: null,

      state: {
        boundary: stateBoundary,
        transition: pendingTransition
      },

      nextStep:
        'Provide an explicit controlled-adapter capability request.'
    };
  }

  const execution = validateControlledRequest(input.execution, repositoryPath);

  return {
    schema: 'sdo.orchestration.v1',

    orchestration: {
      status: 'DENIED',
      executionAttempted: false,
      executionAllowed: false
    },

    repository: discovery.repository,

    worktree: discovery.worktree,

    pipeline: {
      discovery,
      task,
      inspection,
      classification,
      changePlan
    },

    execution,

    state: {
      boundary: stateBoundary,
      transition: pendingTransition
    },

    nextStep: execution.reason
  };
}

function main() {
  const repositoryPath =
    process.argv[2] || process.cwd();

  const description =
    process.argv[3] ||
    'Orchestrator validation';

  const files =
    process.argv.slice(4);

  if (files.length === 0) {
    console.error(
      'SDO ORCHESTRATOR ERROR: At least one target file is required.'
    );

    process.exit(1);
  }

  try {
    const result = orchestrate({
      repositoryPath,
      description,
      files,
      mode: 'PATCH',
      risk: 'BAIXO',
      estimatedDiffLines: 0,
      architecturalChange: false
    });

    process.stdout.write(
      `${JSON.stringify(result, null, 2)}\n`
    );
  } catch (error) {
    console.error(
      `SDO ORCHESTRATOR ERROR: ${error.message}`
    );

    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  orchestrate,
  validateInput,
  validateControlledRequest,
  rejectUnsafeRequestShape
};
