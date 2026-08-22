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
    action: 'NODE_SYNTAX_CHECK',
    objective(target) {
      return `Governed Node.js syntax validation: ${target}`;
    },
    scope(target) {
      return {
        selectors: ['NODE_SYNTAX_CHECK'],
        paths: [target]
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
    target
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
    contract.scope(requestedTarget);

  const common = {
    operationId,
    workspace,
    policyDecision: 'ALLOWED',
    riskLevel: 'R1',
    lifecycleState: 'PENDING',
    capabilityType,
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
    contract.objective(requestedTarget);

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
      riskLevel: 'R1',
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
          riskLevel: 'R1'
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
    action: contract.action,
    operationId,
    workspace,
    target: requestedTarget,
    observedAt,
    grantEvaluation,
    operationRecord:
      operationRecordEvaluation.record,
    lifecycle
  });

  return Object.freeze({
    repositoryPath: workspace,
    description: objective,
    files: Object.freeze([
      requestedTarget
    ]),
    mode: 'PATCH',
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
