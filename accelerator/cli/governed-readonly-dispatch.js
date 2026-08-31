'use strict';

const crypto = require('node:crypto');

const {
  orchestrate
} = require('../core/surgical-orchestrator');

const {
  discover
} = require('../core/repository-discovery');

const {
  evaluateCapabilityGrant
} = require('../core/capability-grant');

const {
  createOperationRecord
} = require('../core/operation-record');

const {
  createLifecycle
} = require('../core/state-boundary');

const CONTRACTS = Object.freeze({
  FILESYSTEM_READ: Object.freeze({
    adapter: 'FILESYSTEM_READ',
    action: 'READ_FILE',
    objective(target) {
      return `Governed filesystem read: ${target}`;
    },
    scope(target) {
      return { paths: [target] };
    }
  }),

  PROCESS_VALIDATION: Object.freeze({
    adapter: 'PROCESS_VALIDATION',
    defaultAction: 'NODE_SYNTAX_CHECK',
    actions: Object.freeze({
      syntax: 'NODE_SYNTAX_CHECK',
      test: 'NODE_TEST_FILE'
    }),
    objective(target, selector = 'NODE_SYNTAX_CHECK') {
      return selector === 'NODE_TEST_FILE'
        ? `Governed Node.js test execution: ${target}`
        : `Governed Node.js syntax validation: ${target}`;
    },
    scope(target, selector = 'NODE_SYNTAX_CHECK') {
      return {
        selectors: [selector],
        paths: [target]
      };
    }
  }),

  GIT_READ: Object.freeze({
    adapter: 'GIT_READ',
    actions: Object.freeze({
      root: 'REPOSITORY_ROOT',
      branch: 'CURRENT_BRANCH',
      head: 'HEAD_COMMIT',
      status: 'WORKTREE_STATUS',
      diff: 'WORKTREE_DIFF',
      tracked: 'TRACKED_FILES',
      'workspace-files': 'WORKSPACE_FILES'
    }),
    objective(selector) {
      return `Governed Git repository read: ${selector}`;
    },
    scope(selector) {
      const operation = {
        REPOSITORY_ROOT: 'rev-parse',
        CURRENT_BRANCH: 'rev-parse',
        HEAD_COMMIT: 'rev-parse',
        WORKTREE_STATUS: 'status',
        WORKTREE_DIFF: 'diff',
        TRACKED_FILES: 'ls-files',
        WORKSPACE_FILES: 'ls-files'
      }[selector];

      if (!operation) {
        throw new Error('Unknown governed Git selector.');
      }

      return {
        operations: [operation]
      };
    }
  })
});

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value.trim();
}

function canonicalTimestamp(value) {
  const timestamp =
    requireText(value, 'Timestamp');

  const parsed =
    Date.parse(timestamp);

  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString() !== timestamp
  ) {
    throw new Error(
      'Timestamp must be canonical ISO-8601.'
    );
  }

  return timestamp;
}

function physicalEvidence(discovery) {
  return {
    path: discovery.repository.path,
    branch: discovery.repository.branch,
    commit: discovery.repository.commit,
    shortCommit: discovery.repository.shortCommit,
    clean: discovery.worktree.clean,
    changedFiles: discovery.worktree.changedFiles
  };
}

function operationIdFor({
  workspace,
  capabilityType,
  target,
  observedAt
}) {
  return (
    'cli-' +
    crypto
      .createHash('sha256')
      .update(
        [
          'sdo.governed_human_cli.v1',
          workspace,
          capabilityType,
          target,
          observedAt
        ].join('\0')
      )
      .digest('hex')
  );
}

function createGovernedReadOnlyRequest(
  {
    repositoryPath,
    capabilityType,
    target,
    selector = null
  },
  options = {}
) {
  const contract =
    CONTRACTS[capabilityType];

  if (!contract) {
    throw new Error(
      'Unsupported governed human CLI capability.'
    );
  }

  const requestedTarget =
    requireText(target, 'Target');

  const requestedAction =
    capabilityType === 'GIT_READ'
      ? (
          contract.actions &&
          contract.actions[requestedTarget.toLowerCase()]
        )
      : capabilityType === 'PROCESS_VALIDATION'
        ? (
            selector
              ? requireText(selector, 'Validation selector').toUpperCase()
              : contract.defaultAction
          )
        : contract.action;

  if (
    !requestedAction ||
    (
      capabilityType === 'PROCESS_VALIDATION' &&
      !Object.values(contract.actions).includes(requestedAction)
    )
  ) {
    throw new Error(
      'Unknown governed read-only action.'
    );
  }

  const repository =
    discover(
      requireText(
        repositoryPath,
        'Repository path'
      )
    );

  const workspace =
    repository.repository.path;

  const observedAt =
    canonicalTimestamp(
      typeof options.now === 'function'
        ? options.now()
        : new Date().toISOString()
    );

  const expiresAt =
    new Date(
      Date.parse(observedAt) + 60_000
    ).toISOString();

  const operationId =
    operationIdFor({
      workspace,
      capabilityType,
      target: requestedTarget,
      observedAt
    });

  const scope =
    capabilityType === 'PROCESS_VALIDATION'
      ? contract.scope(requestedTarget, requestedAction)
      : contract.scope(
          capabilityType === 'GIT_READ'
            ? requestedAction
            : requestedTarget
        );

  const authorityRiskLevel =
    capabilityType === 'GIT_READ'
      ? 'R0'
      : 'R1';

  const common = {
    operationId,
    workspace,
    policyDecision: 'ALLOWED',
    riskLevel: authorityRiskLevel,
    lifecycleState: 'PENDING',
    capabilityType,
    action: requestedAction,
    scope,
    idempotency: 'IDEMPOTENT'
  };

  const grantEvaluation =
    evaluateCapabilityGrant(
      {
        ...common,
        expiresAt
      },
      {
        ...common,
        evaluatedAt: observedAt
      }
    );

  if (
    !grantEvaluation ||
    grantEvaluation.decision !== 'ALLOWED' ||
    !grantEvaluation.grant
  ) {
    throw new Error(
      'Governed read-only capability was denied.'
    );
  }

  const objective =
    capabilityType === 'PROCESS_VALIDATION'
      ? contract.objective(requestedTarget, requestedAction)
      : contract.objective(
          capabilityType === 'GIT_READ'
            ? requestedAction
            : requestedTarget
        );

  const operationRecordEvaluation =
    createOperationRecord({
      operationId,

      requester: {
        id: 'surgical-cli-local-session',
        type: 'HUMAN'
      },

      workspace,
      objective,
      policyDecision: 'ALLOWED',
      riskLevel: authorityRiskLevel,
      idempotency: 'IDEMPOTENT',

      events: [
        {
          type: 'intent',
          operationId,
          timestamp: observedAt,
          objective
        },
        {
          type: 'policy',
          operationId,
          timestamp: observedAt,
          policyDecision: 'ALLOWED',
          riskLevel: authorityRiskLevel
        },
        {
          type: 'state',
          operationId,
          timestamp: observedAt,
          status: 'PENDING'
        }
      ]
    });

  if (
    !operationRecordEvaluation ||
    operationRecordEvaluation.decision !== 'ALLOWED' ||
    !operationRecordEvaluation.record
  ) {
    throw new Error(
      'Governed operation record was denied.'
    );
  }

  const lifecycle =
    createLifecycle({
      operationId,
      initialState: 'PENDING',
      before: physicalEvidence(repository),
      createdAt: observedAt
    });

  const execution = Object.freeze({
    adapter: contract.adapter,
    action: requestedAction,
    operationId,
    workspace,
    ...(capabilityType === 'GIT_READ'
      ? {}
      : { target: requestedTarget }),
    observedAt,
    grantEvaluation,
    operationRecord:
      operationRecordEvaluation.record,
    lifecycle
  });

  return Object.freeze({
    repositoryPath: workspace,
    description: objective,
    files: Object.freeze(
      capabilityType === 'GIT_READ'
        ? []
        : [requestedTarget]
    ),
    mode:
      (
        capabilityType === 'GIT_READ' ||
        capabilityType === 'FILESYSTEM_READ'
      )
        ? 'OBSERVE'
        : 'PATCH',
    risk: 'BAIXO',
    authorizeExecution: true,
    estimatedDiffLines: 0,
    architecturalChange: false,
    execution
  });
}

function dispatchGovernedReadOnly(
  intent,
  repositoryPath,
  options = {}
) {
  if (
    !intent ||
    typeof intent !== 'object' ||
    Array.isArray(intent)
  ) {
    throw new Error(
      'Explicit governed CLI intent is required.'
    );
  }

  const request =
    createGovernedReadOnlyRequest(
      {
        repositoryPath,
        capabilityType:
          requireText(
            intent.capabilityType,
            'Capability type'
          ),
        target:
          requireText(
            intent.target,
            'Target'
          )
      },
      options
    );

  return orchestrate(request);
}

function formatGovernedReadOnlyResult(result) {
  if (
    !result ||
    typeof result !== 'object' ||
    !result.orchestration
  ) {
    return (
      'Governed request denied: malformed result.\n'
    );
  }

  if (
    result.orchestration.status !== 'COMPLETED'
  ) {
    const reason =
      result.execution &&
      typeof result.execution.reason === 'string'
        ? result.execution.reason
        : result.nextStep ||
          'Operation did not complete.';

    return (
      `Governed request: ${result.orchestration.status}\n` +
      `Reason: ${reason}\n`
    );
  }

  if (
    result.execution &&
    result.execution.schema ===
      'sdo.filesystem_read_result.v1'
  ) {
    const content =
      result.execution.evidence.content;

    return (
      'Governed filesystem read: COMPLETED\n' +
      `Target: ${result.execution.target.requested}\n` +
      `Bytes: ${result.execution.evidence.bytes}\n` +
      `SHA256: ${result.execution.evidence.sha256}\n` +
      '----- CONTENT -----\n' +
      content +
      (
        content.endsWith('\n')
          ? ''
          : '\n'
      ) +
      '----- END CONTENT -----\n'
    );
  }

  if (
    result.execution &&
    result.execution.schema ===
      'sdo.git_read_result.v1'
  ) {
    const value =
      typeof result.execution.result === 'string'
        ? result.execution.result
        : JSON.stringify(
            result.execution.result,
            null,
            2
          );

    return (
      'Governed Git read: COMPLETED\n' +
      `Selector: ${result.execution.selector}\n` +
      `${value}\n`
    );
  }

  if (
    result.execution &&
    result.execution.schema ===
      'sdo.process_validation_result.v1'
  ) {
    return (
      'Governed JavaScript validation: COMPLETED\n' +
      `Target: ${result.execution.target.requested}\n` +
      `Validation: ${result.execution.validation.status}\n` +
      `Exit code: ${result.execution.validation.exitCode}\n`
    );
  }

  return 'Governed request: COMPLETED\n';
}

module.exports = {
  createGovernedReadOnlyRequest,
  dispatchGovernedReadOnly,
  formatGovernedReadOnlyResult
};
