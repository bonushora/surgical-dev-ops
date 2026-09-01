'use strict';

const crypto = require('node:crypto');

const surgicalOrchestrator = require('./surgical-orchestrator');
const readOnlyDispatch = require('../cli/governed-readonly-dispatch');
const {
  revalidateDeterministicWorkspaceSession
} = require('../adapters/deterministic-workspace-session-adapter');
const {
  openNaturalGovernedWorkspaceExperience,
  searchNaturalGovernedWorkspace
} = require('../cli/natural-governed-workspace-experience');
const {
  createSensitiveContentPolicy,
  inspectSensitiveContent
} = require('./sensitive-content-boundary');
const {
  materializeGovernedEngineeringProposal
} = require('./governed-engineering-proposal');
const {
  EVENT_TYPES,
  DEFAULT_DENIED_CAPABILITIES,
  validateNaturalAgenticMission,
  transitionNaturalAgenticMission,
  recordNaturalAgenticMissionTestResult,
  consumeMissionAuthorityGrant,
  projectMissionView,
  projectMissionAuthority,
  resumeNaturalAgenticMission,
  missionExpectedState
} = require('./natural-agentic-mission');

const REQUEST_SCHEMA = 'sdo.integrated_governed_agent_gateway_request.v1';
const RESULT_SCHEMA = 'sdo.integrated_governed_agent_gateway_result.v1';
const DISPATCH_SCHEMA = 'sdo.integrated_governed_agent_gateway_dispatch.v1';
const APPROVAL_REQUEST_SCHEMA = 'sdo.integrated_governed_agent_gateway_approval_request.v1';
const STREAM_EVENT_SCHEMA = 'sdo.integrated_governed_agent_gateway_stream_event.v1';
const PROTOCOL_VERSION = 'sdo.integrated_governed_agent_gateway.v1';

const RESULT_CLASSES = Object.freeze([
  'SUCCESS',
  'FAILURE',
  'DENIED',
  'AUTHORITY_REQUIRED',
  'STALE_STATE',
  'CAS_MISMATCH',
  'UNSUPPORTED',
  'ENVIRONMENT_ERROR',
  'INCOMPLETE_EVIDENCE'
]);

const OPERATIONS = Object.freeze({
  'workspace.status': Object.freeze({
    capability: 'workspace.status',
    state: 'AUDITING',
    physical: true,
    eventStarted: EVENT_TYPES.OPERATION_STARTED,
    eventCompleted: EVENT_TYPES.OPERATION_COMPLETED,
    dispatch: Object.freeze({ capabilityType: 'GIT_READ', target: 'status' })
  }),
  'workspace.search': Object.freeze({
    capability: 'workspace.search',
    state: 'AUDITING',
    physical: true,
    eventStarted: EVENT_TYPES.OPERATION_STARTED,
    eventCompleted: EVENT_TYPES.EVIDENCE_DISCOVERED
  }),
  'workspace.read': Object.freeze({
    capability: 'workspace.read',
    state: 'AUDITING',
    physical: true,
    eventStarted: EVENT_TYPES.OPERATION_STARTED,
    eventCompleted: EVENT_TYPES.EVIDENCE_DISCOVERED,
    dispatch: Object.freeze({ capabilityType: 'FILESYSTEM_READ' })
  }),
  'workspace.diff': Object.freeze({
    capability: 'workspace.diff',
    state: 'AUDITING',
    physical: true,
    eventStarted: EVENT_TYPES.OPERATION_STARTED,
    eventCompleted: EVENT_TYPES.EVIDENCE_DISCOVERED,
    dispatch: Object.freeze({ capabilityType: 'GIT_READ', target: 'diff' })
  }),
  'evidence.inspect': Object.freeze({
    capability: 'evidence.inspect',
    state: 'AUDITING',
    physical: true,
    eventStarted: EVENT_TYPES.OPERATION_STARTED,
    eventCompleted: EVENT_TYPES.EVIDENCE_DISCOVERED
  }),
  'evidence.microread': Object.freeze({
    capability: 'evidence.microread',
    state: 'AUDITING',
    physical: true,
    eventStarted: EVENT_TYPES.OPERATION_STARTED,
    eventCompleted: EVENT_TYPES.EVIDENCE_DISCOVERED
  }),
  'tests.run': Object.freeze({
    capability: 'tests.run',
    state: 'TESTING',
    physical: true,
    eventStarted: EVENT_TYPES.TEST_STARTED,
    eventCompleted: EVENT_TYPES.TEST_PASSED,
    eventFailed: EVENT_TYPES.TEST_FAILED,
    dispatch: Object.freeze({
      capabilityType: 'PROCESS_VALIDATION',
      selector: 'NODE_TEST_FILE'
    })
  }),
  'tests.runCanonical': Object.freeze({
    capability: 'tests.runCanonical',
    state: 'QUALIFYING',
    physical: false,
    requiresAuthority: true
  }),
  'mutation.propose': Object.freeze({
    capability: 'mutation.propose',
    state: 'IMPLEMENTING',
    physical: false,
    eventStarted: EVENT_TYPES.OPERATION_STARTED,
    eventCompleted: EVENT_TYPES.OPERATION_COMPLETED
  }),
  'mutation.applyConditional': Object.freeze({
    capability: 'mutation.applyConditional',
    state: 'IMPLEMENTING',
    physical: true,
    requiresAuthority: true,
    eventStarted: EVENT_TYPES.OPERATION_STARTED,
    eventCompleted: EVENT_TYPES.OPERATION_COMPLETED
  }),
  'git.status': Object.freeze({
    capability: 'git.status',
    alias: 'workspace.status'
  }),
  'git.diff': Object.freeze({
    capability: 'git.diff',
    alias: 'workspace.diff'
  }),
  'git.stage': Object.freeze({
    capability: 'git.stage',
    state: 'CHECKPOINTING',
    physical: false,
    requiresAuthority: true
  }),
  'git.commit': Object.freeze({
    capability: 'git.commit',
    state: 'CHECKPOINTING',
    physical: false,
    requiresAuthority: true
  }),
  'journal.inspect': Object.freeze({
    capability: 'journal.inspect',
    projection: 'journal',
    localFastPath: true
  }),
  'mission.status': Object.freeze({
    capability: 'mission.status',
    projection: 'status',
    localFastPath: true
  }),
  'mission.plan': Object.freeze({
    capability: 'mission.plan',
    projection: 'plan',
    localFastPath: true
  }),
  'mission.changes': Object.freeze({
    capability: 'mission.changes',
    projection: 'changes',
    localFastPath: true
  }),
  'mission.tests': Object.freeze({
    capability: 'mission.tests',
    projection: 'tests',
    localFastPath: true
  }),
  'mission.authority': Object.freeze({
    capability: 'mission.authority',
    projection: 'authority',
    localFastPath: true
  }),
  'mission.journal': Object.freeze({
    capability: 'mission.journal',
    projection: 'journal',
    localFastPath: true
  }),
  'mission.resume': Object.freeze({
    capability: 'mission.resume',
    localFastPath: true
  }),
  'authority.inspect': Object.freeze({
    capability: 'authority.inspect',
    localFastPath: true
  }),
  'authority.request': Object.freeze({
    capability: 'authority.request',
    localFastPath: true
  })
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function fingerprint(label, value) {
  return crypto
    .createHash('sha256')
    .update(`${label}\0${JSON.stringify(canonicalize(value))}`, 'utf8')
    .digest('hex');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function requireText(value, label, maximum = 4096) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value !== value.trim() ||
    value.length > maximum ||
    value.includes('\0')
  ) {
    throw new Error(`${label} is malformed.`);
  }
  return value;
}

function requireTimestamp(value, label) {
  const timestamp = requireText(value, label, 64);
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== timestamp) {
    throw new Error(`${label} is malformed.`);
  }
  return timestamp;
}

function requireDigest(value, label) {
  const digest = requireText(value, label, 64);
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error(`${label} is malformed.`);
  return digest;
}

function requireOperation(value) {
  const operation = requireText(value, 'Gateway operation', 128);
  if (!OPERATIONS[operation]) throw new Error('Gateway operation is unsupported.');
  return operation;
}

function normalizeArgs(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Gateway arguments are malformed.');
  }
  return deepFreeze(canonicalize(value));
}

function now(options = {}) {
  const timestamp =
    typeof options.now === 'function'
      ? options.now()
      : new Date().toISOString();
  return requireTimestamp(timestamp, 'Gateway timestamp');
}

function monotonicMs(options = {}) {
  if (typeof options.monotonicMs === 'function') {
    const value = options.monotonicMs();
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('Gateway monotonic clock is malformed.');
    }
    return value;
  }
  return Date.now();
}

function createLatencyTrace(options = {}) {
  const marks = [];
  return {
    mark(stage) {
      marks.push(deepFreeze({
        stage,
        monotonicMs: monotonicMs(options)
      }));
    },
    snapshot() {
      const first = marks[0] || null;
      const named = Object.fromEntries(
        marks.map((mark) => [mark.stage, mark.monotonicMs])
      );
      return deepFreeze({
        schema: 'sdo.integrated_gateway_latency_trace.v1',
        marks: [...marks],
        acknowledgementLatencyMs: first ? 0 : null,
        firstProgressLatencyMs:
          first && named.firstProgress !== undefined
            ? named.firstProgress - first.monotonicMs
            : null,
        dispatchOverheadMs:
          named.dispatchStarted !== undefined &&
          named.firstEvidence !== undefined
            ? named.firstEvidence - named.dispatchStarted
            : null,
        normalizationLatencyMs:
          named.firstEvidence !== undefined &&
          named.normalized !== undefined
            ? named.normalized - named.firstEvidence
            : null,
        providerInvoked: false
      });
    }
  };
}

function requestBody(input) {
  const mission = validateNaturalAgenticMission(input.mission);
  const operation = requireOperation(input.operation);
  const requestedAt = requireTimestamp(input.requestedAt, 'Gateway requestedAt');
  return {
    schema: REQUEST_SCHEMA,
    protocolVersion: PROTOCOL_VERSION,
    requestId: requireText(input.requestId, 'Gateway request id', 256),
    missionId: mission.missionId,
    operation,
    workspace: mission.binding.repositoryPath,
    repository: {
      physicalWorkspaceIdentity: mission.binding.physicalWorkspaceIdentity,
      repositoryHead: mission.binding.repositoryHead,
      worktreeFingerprint: mission.binding.worktreeFingerprint
    },
    expectedState: input.expectedState || missionExpectedState(mission),
    args: normalizeArgs(input.args || {}),
    authorityRef: input.authorityRef === undefined || input.authorityRef === null
      ? null
      : requireText(input.authorityRef, 'Gateway authority reference', 256),
    requestedAt,
    cognitiveProviderId: input.cognitiveProviderId
      ? requireText(input.cognitiveProviderId, 'Cognitive provider id', 128)
      : mission.provider.providerId,
    modelDirectFilesystem: false,
    modelDirectShell: false,
    modelDirectGit: false,
    modelDirectNetwork: false
  };
}

function createGatewayRequest(input = {}) {
  const body = requestBody(input);
  return deepFreeze({
    ...body,
    requestFingerprint: fingerprint(REQUEST_SCHEMA, body)
  });
}

function validateGatewayRequest(request) {
  if (!request || request.schema !== REQUEST_SCHEMA || !Object.isFrozen(request)) {
    throw new Error('Immutable gateway request is required.');
  }
  const { requestFingerprint, ...body } = request;
  if (
    request.protocolVersion !== PROTOCOL_VERSION ||
    !/^[a-f0-9]{64}$/.test(requestFingerprint || '') ||
    fingerprint(REQUEST_SCHEMA, body) !== requestFingerprint
  ) {
    throw new Error('Gateway request fingerprint mismatch.');
  }
  requireOperation(request.operation);
  return request;
}

function resolveOperation(operation) {
  const definition = OPERATIONS[operation];
  if (!definition) return null;
  return definition.alias
    ? OPERATIONS[definition.alias]
    : definition;
}

function operationCapability(operation) {
  const definition = OPERATIONS[operation];
  if (!definition) return null;
  return definition.capability;
}

function ensureRequestBoundToMission(request, mission) {
  const expected = missionExpectedState(mission);
  if (
    request.missionId !== mission.missionId ||
    request.workspace !== mission.binding.repositoryPath ||
    request.repository.physicalWorkspaceIdentity !== mission.binding.physicalWorkspaceIdentity ||
    request.repository.repositoryHead !== mission.binding.repositoryHead ||
    request.repository.worktreeFingerprint !== mission.binding.worktreeFingerprint
  ) {
    return 'DENIED';
  }
  if (JSON.stringify(request.expectedState) !== JSON.stringify(expected)) {
    return 'STALE_STATE';
  }
  return 'SUCCESS';
}

function checkCas(args, mission) {
  if (!args.expectedCas) return 'SUCCESS';
  const cas = args.expectedCas;
  if (!cas || typeof cas !== 'object' || Array.isArray(cas)) {
    return 'CAS_MISMATCH';
  }
  for (const [field, value] of [
    ['repositoryHead', mission.binding.repositoryHead],
    ['worktreeFingerprint', mission.binding.worktreeFingerprint],
    ['physicalWorkspaceIdentity', mission.binding.physicalWorkspaceIdentity]
  ]) {
    if (cas[field] !== undefined && cas[field] !== value) {
      return 'CAS_MISMATCH';
    }
  }
  return 'SUCCESS';
}

function capabilityAllowed(mission, operation) {
  const capability = operationCapability(operation);
  return Boolean(
    capability &&
    mission.authority.allowedCapabilities.includes(capability)
  );
}

function activeAuthorityGrant(mission, operation, authorityRef, at) {
  if (!authorityRef) return null;
  const capability = operationCapability(operation);
  const grant = mission.authority.grants.find((entry) =>
    entry.authorityRef === authorityRef &&
    entry.capability === capability
  );
  if (!grant) return null;
  if (mission.authority.usedAuthorityRefs.includes(authorityRef)) return null;
  if (Date.parse(at) >= Date.parse(grant.expiresAt)) return null;
  return grant;
}

function createContextualApprovalRequest({
  mission,
  operation,
  reason,
  scope = {},
  requestedAt,
  lifetime = 'ONE_SHOT'
}) {
  const current = validateNaturalAgenticMission(mission);
  const selected = requireOperation(operation);
  const operationDefinition = OPERATIONS[selected];
  const body = {
    schema: APPROVAL_REQUEST_SCHEMA,
    operation: selected,
    capability: operationDefinition.capability,
    reason: requireText(reason, 'Approval request reason', 512),
    boundedScope: normalizeArgs(scope),
    missionId: current.missionId,
    workspaceBinding: {
      repositoryPath: current.binding.repositoryPath,
      physicalWorkspaceIdentity: current.binding.physicalWorkspaceIdentity
    },
    repositoryBinding: {
      repositoryHead: current.binding.repositoryHead,
      worktreeFingerprint: current.binding.worktreeFingerprint
    },
    expectedState: missionExpectedState(current),
    lifetime: requireText(lifetime, 'Approval request lifetime', 32).toUpperCase(),
    authorityNotGranted: DEFAULT_DENIED_CAPABILITIES,
    localCommitDoesNotGrantPush: true,
    testExecutionDoesNotGrantArbitraryShell: true,
    readDoesNotGrantMutation: true,
    providerConnectionDoesNotGrantNetworkMutation: true,
    requestedAt: requireTimestamp(requestedAt, 'Approval request timestamp'),
    operationalAuthority: false,
    mutationAuthority: false
  };
  return deepFreeze({
    ...body,
    approvalRequestFingerprint: fingerprint(APPROVAL_REQUEST_SCHEMA, body)
  });
}

function resultEnvelope({
  request = null,
  mission,
  operation = request && request.operation,
  classification,
  reason,
  data = null,
  approvalRequest = null,
  latency,
  missionBeforeEventCount = 0,
  updatedMission = mission
}) {
  if (!RESULT_CLASSES.includes(classification)) {
    throw new Error('Gateway result class is unsupported.');
  }
  const current = updatedMission ? validateNaturalAgenticMission(updatedMission) : null;
  const events = current
    ? current.events.slice(missionBeforeEventCount)
    : [];
  const body = {
    schema: RESULT_SCHEMA,
    requestId: request ? request.requestId : null,
    missionId: current ? current.missionId : null,
    operation: operation || null,
    classification,
    successful: classification === 'SUCCESS',
    reason: requireText(reason, 'Gateway result reason', 1024),
    data,
    approvalRequest,
    events,
    evidenceDigest: fingerprint('sdo.integrated_gateway_result_evidence.v1', {
      classification,
      data,
      approvalRequest
    }),
    latency,
    copyPasteRequired: false,
    providerInvoked: false,
    modelDirectFilesystem: false,
    modelDirectShell: false,
    modelDirectGit: false,
    modelDirectNetwork: false,
    operationalAuthority: false,
    mutationAuthority: false
  };
  const result = deepFreeze({
    ...body,
    resultFingerprint: fingerprint(RESULT_SCHEMA, body)
  });
  return deepFreeze({
    schema: DISPATCH_SCHEMA,
    result,
    mission: current
  });
}

function malformedResult(reason, options = {}) {
  const latency = createLatencyTrace(options);
  latency.mark('acknowledged');
  latency.mark('normalized');
  return resultEnvelope({
    mission: null,
    updatedMission: null,
    operation: null,
    classification: 'DENIED',
    reason,
    latency: latency.snapshot()
  });
}

function physicalRevalidation(mission, options = {}) {
  const revalidate =
    typeof options.revalidateSession === 'function'
      ? options.revalidateSession
      : revalidateDeterministicWorkspaceSession;
  return revalidate(mission.session);
}

function dispatchReadOnly({ mission, intent, options }) {
  const request = readOnlyDispatch.createGovernedReadOnlyRequest(
    {
      repositoryPath: mission.binding.repositoryPath,
      capabilityType: intent.capabilityType,
      target: intent.target,
      ...(intent.selector ? { selector: intent.selector } : {})
    },
    { now: () => options.observedAt }
  );
  return surgicalOrchestrator.orchestrate(request, options.runtime || {});
}

function normalizeGitStatus(orchestration) {
  if (orchestration.orchestration.status !== 'COMPLETED') {
    return {
      classification: 'FAILURE',
      reason: orchestration.nextStep || 'Governed workspace status failed.',
      data: { orchestratorStatus: orchestration.orchestration.status }
    };
  }
  const entries = Array.isArray(orchestration.execution.result)
    ? orchestration.execution.result
    : [];
  return {
    classification: 'SUCCESS',
    reason: 'Governed workspace status completed through the Surgical Orchestrator.',
    data: deepFreeze({
      kind: 'WORKSPACE_STATUS',
      repository: {
        path: orchestration.repository.path,
        branch: orchestration.repository.branch,
        commit: orchestration.repository.commit
      },
      clean: entries.length === 0,
      changedEntries: entries,
      orchestratorStatus: orchestration.orchestration.status,
      structuredResult: true
    })
  };
}

function normalizeGitDiff(orchestration) {
  if (orchestration.orchestration.status !== 'COMPLETED') {
    return {
      classification: 'FAILURE',
      reason: orchestration.nextStep || 'Governed workspace diff failed.',
      data: { orchestratorStatus: orchestration.orchestration.status }
    };
  }
  const patch = orchestration.execution.result.patch || '';
  return {
    classification: 'SUCCESS',
    reason: 'Governed workspace diff completed with content-minimized evidence.',
    data: deepFreeze({
      kind: 'WORKSPACE_DIFF',
      bytes: orchestration.execution.result.bytes,
      patchSha256: sha256(patch),
      rawPatchOmittedFromCognition: true,
      rawEvidenceReference: orchestration.governed.operationRecord.adapterEvidence[0].evidenceId,
      orchestratorStatus: orchestration.orchestration.status
    })
  };
}

function normalizeRead(orchestration) {
  if (orchestration.orchestration.status !== 'COMPLETED') {
    return {
      classification: 'FAILURE',
      reason: orchestration.nextStep || 'Governed workspace read failed.',
      data: { orchestratorStatus: orchestration.orchestration.status }
    };
  }
  const execution = orchestration.execution;
  const sensitive = inspectSensitiveContent(
    createSensitiveContentPolicy(),
    {
      target: execution.target.requested,
      content: execution.evidence.content
    }
  );
  if (!sensitive.providerSafe) {
    return {
      classification: 'DENIED',
      reason: 'Governed evidence was blocked by the sensitive-content boundary.',
      data: deepFreeze({
        kind: 'WORKSPACE_READ',
        target: execution.target.requested,
        bytes: execution.evidence.bytes,
        sha256: execution.evidence.sha256,
        sensitiveDecision: sensitive.decision,
        providerSafe: false,
        content: null
      })
    };
  }
  return {
    classification: 'SUCCESS',
    reason: 'Governed workspace read completed with sensitive-content mediation.',
    data: deepFreeze({
      kind: 'WORKSPACE_READ',
      target: execution.target.requested,
      bytes: execution.evidence.bytes,
      sha256: execution.evidence.sha256,
      sensitiveDecision: sensitive.decision,
      sensitiveRules: sensitive.rules,
      providerSafe: true,
      content: sensitive.content,
      originalContentSha256: sensitive.contentSha256,
      orchestratorStatus: orchestration.orchestration.status
    })
  };
}

function normalizeTest(orchestration) {
  if (
    orchestration.orchestration.status !== 'COMPLETED' &&
    orchestration.orchestration.status !== 'FAILED'
  ) {
    return {
      classification: 'FAILURE',
      reason: orchestration.nextStep || 'Governed test invocation failed.',
      data: { orchestratorStatus: orchestration.orchestration.status }
    };
  }
  const validation = orchestration.execution.validation;
  const summary = validation.testSummary || {};
  const passed = validation.status === 'PASSED';
  return {
    classification: passed ? 'SUCCESS' : 'FAILURE',
    reason: passed
      ? 'Governed Node test file passed.'
      : 'Governed Node test file failed.',
    data: deepFreeze({
      kind: 'TEST_RUN',
      selector: orchestration.execution.selector,
      target: orchestration.execution.target.requested,
      status: validation.status,
      exitCode: validation.exitCode,
      testsDiscovered: Number.isSafeInteger(summary.tests) ? summary.tests : null,
      passed: Number.isSafeInteger(summary.passed) ? summary.passed : null,
      failed: Number.isSafeInteger(summary.failed) ? summary.failed : null,
      skipped: Number.isSafeInteger(summary.skipped) ? summary.skipped : null,
      stdoutSha256: sha256(validation.stdout || ''),
      stderrSha256: sha256(validation.stderr || ''),
      rawOutputOmittedFromCognition: true,
      orchestratorStatus: orchestration.orchestration.status
    })
  };
}

function searchWorkspace({ mission, request, revalidation, options }) {
  const inventory = dispatchReadOnly({
    mission,
    intent: { capabilityType: 'GIT_READ', target: 'workspace-files' },
    options
  });
  if (inventory.orchestration.status !== 'COMPLETED') {
    return {
      classification: 'INCOMPLETE_EVIDENCE',
      reason: 'Governed workspace inventory was unavailable.',
      data: { orchestratorStatus: inventory.orchestration.status }
    };
  }
  const experience = openNaturalGovernedWorkspaceExperience({
    session: mission.session,
    revalidation,
    governedInventory: inventory,
    observedAt: options.observedAt
  });
  const result = searchNaturalGovernedWorkspace(experience, {
    query: requireText(request.args.query, 'Workspace search query', 256),
    limit: request.args.limit || 32
  });
  if (result.status !== 'COMPLETED') {
    return {
      classification: 'STALE_STATE',
      reason: result.reason,
      data: result
    };
  }
  return {
    classification: 'SUCCESS',
    reason: 'Governed workspace search completed through the discovery index.',
    data: result
  };
}

function evidenceMicroreadOperation(request) {
  const kind = request.args.kind || request.args.evidenceKind;
  if (kind === 'READ_FILE') return 'workspace.read';
  if (kind === 'WORKSPACE_FILES' || kind === 'SEARCH') return 'workspace.search';
  throw new Error('Gateway microread kind is unsupported.');
}

function performOperation({ mission, request, definition, revalidation, options }) {
  const originalDefinition = OPERATIONS[request.operation];
  const operation = originalDefinition.alias || request.operation;
  if (operation === 'workspace.status') {
    return normalizeGitStatus(dispatchReadOnly({
      mission,
      intent: { capabilityType: 'GIT_READ', target: 'status' },
      options
    }));
  }
  if (operation === 'workspace.diff') {
    return normalizeGitDiff(dispatchReadOnly({
      mission,
      intent: { capabilityType: 'GIT_READ', target: 'diff' },
      options
    }));
  }
  if (operation === 'workspace.read') {
    return normalizeRead(dispatchReadOnly({
      mission,
      intent: {
        capabilityType: 'FILESYSTEM_READ',
        target: requireText(request.args.target, 'Workspace read target', 2048)
      },
      options
    }));
  }
  if (operation === 'workspace.search') {
    return searchWorkspace({ mission, request, revalidation, options });
  }
  if (operation === 'evidence.inspect' || operation === 'evidence.microread') {
    const nestedOperation = operation === 'evidence.inspect'
      ? requireOperation(request.args.operation || 'workspace.status')
      : evidenceMicroreadOperation(request);
    const nestedDefinition = resolveOperation(nestedOperation);
    const nestedRequest = deepFreeze({
      ...request,
      operation: nestedOperation,
      args: operation === 'evidence.microread' && nestedOperation === 'workspace.read'
        ? { target: request.args.target }
        : request.args
    });
    return performOperation({
      mission,
      request: nestedRequest,
      definition: nestedDefinition,
      revalidation,
      options
    });
  }
  if (operation === 'tests.run') {
    return normalizeTest(dispatchReadOnly({
      mission,
      intent: {
        capabilityType: 'PROCESS_VALIDATION',
        selector: 'NODE_TEST_FILE',
        target: requireText(request.args.target, 'Test target', 2048)
      },
      options
    }));
  }
  if (operation === 'mutation.propose') {
    const proposal = materializeGovernedEngineeringProposal(request.args.proposal);
    return {
      classification: 'SUCCESS',
      reason: 'Authority-free governed mutation proposal materialized for human review.',
      data: proposal
    };
  }
  if (operation === 'mutation.applyConditional') {
    if (!request.args.orchestratorInput || typeof request.args.orchestratorInput !== 'object') {
      return {
        classification: 'AUTHORITY_REQUIRED',
        reason: 'Conditional mutation requires an exact governed orchestrator input and authority reference.',
        data: null
      };
    }
    const orchestration = surgicalOrchestrator.orchestrate(
      request.args.orchestratorInput,
      options.runtime || {}
    );
    const success = orchestration.orchestration.status === 'COMPLETED';
    return {
      classification: success ? 'SUCCESS' : 'FAILURE',
      reason: success
        ? 'Conditional governed mutation completed through the Surgical Orchestrator.'
        : orchestration.nextStep || 'Conditional governed mutation failed closed.',
      data: deepFreeze({
        orchestratorStatus: orchestration.orchestration.status,
        executionAttempted: orchestration.orchestration.executionAttempted,
        executionSchema: orchestration.execution && orchestration.execution.schema,
        operationRecordVersion:
          orchestration.governed &&
          orchestration.governed.operationRecord &&
          orchestration.governed.operationRecord.version
      })
    };
  }
  return {
    classification: 'UNSUPPORTED',
    reason: 'Gateway operation has no physical dispatcher.',
    data: null
  };
}

function dispatchGatewayRequest({ request, mission, options = {} } = {}) {
  const latency = createLatencyTrace(options);
  latency.mark('acknowledged');
  let current;
  let validatedRequest;
  try {
    current = validateNaturalAgenticMission(mission);
    validatedRequest = validateGatewayRequest(request);
  } catch (error) {
    return malformedResult(error.message || 'Malformed gateway request.', options);
  }

  const eventStart = current.events.length;
  const requestedAt = now(options);
  const operation = validatedRequest.operation;
  const definition = resolveOperation(operation);
  if (!definition) {
    return resultEnvelope({
      request: validatedRequest,
      mission: current,
      updatedMission: current,
      classification: 'UNSUPPORTED',
      reason: 'Gateway operation is unsupported.',
      latency: latency.snapshot(),
      missionBeforeEventCount: eventStart
    });
  }

  const bindingStatus = ensureRequestBoundToMission(validatedRequest, current);
  if (bindingStatus !== 'SUCCESS') {
    return resultEnvelope({
      request: validatedRequest,
      mission: current,
      updatedMission: current,
      classification: bindingStatus,
      reason: bindingStatus === 'STALE_STATE'
        ? 'Gateway request expected stale mission state.'
        : 'Gateway request is not bound to this mission and workspace.',
      latency: latency.snapshot(),
      missionBeforeEventCount: eventStart
    });
  }

  const casStatus = checkCas(validatedRequest.args, current);
  if (casStatus !== 'SUCCESS') {
    return resultEnvelope({
      request: validatedRequest,
      mission: current,
      updatedMission: current,
      classification: casStatus,
      reason: 'Gateway request CAS mismatched the current mission binding.',
      latency: latency.snapshot(),
      missionBeforeEventCount: eventStart
    });
  }

  if (current.state === 'CANCELLED' && !definition.localFastPath) {
    return resultEnvelope({
      request: validatedRequest,
      mission: current,
      updatedMission: current,
      classification: 'STALE_STATE',
      reason: 'Cancelled mission cannot execute a queued continuation.',
      latency: latency.snapshot(),
      missionBeforeEventCount: eventStart
    });
  }

  if (!capabilityAllowed(current, operation)) {
    const denied = transitionNaturalAgenticMission(current, {
      type: EVENT_TYPES.OPERATION_DENIED,
      state: current.state,
      summary: 'Gateway operation denied by mission authority.',
      at: requestedAt,
      resultClass: 'DENIED'
    });
    return resultEnvelope({
      request: validatedRequest,
      mission: current,
      updatedMission: denied,
      classification: 'DENIED',
      reason: 'Tool is registered but not authorized for the current mission.',
      latency: latency.snapshot(),
      missionBeforeEventCount: eventStart
    });
  }

  if (definition.requiresAuthority) {
    const grant = activeAuthorityGrant(current, operation, validatedRequest.authorityRef, requestedAt);
    if (!grant) {
      const approvalRequest = createContextualApprovalRequest({
        mission: current,
        operation,
        reason: 'Additional bounded human authority is required before this operation can execute.',
        scope: validatedRequest.args.scope || validatedRequest.args,
        requestedAt
      });
      const waiting = transitionNaturalAgenticMission(current, {
        type: EVENT_TYPES.AUTHORITY_REQUIRED,
        state: definition.state || current.state,
        summary: 'Gateway created a contextual authority request.',
        at: requestedAt,
        resultClass: 'AUTHORITY_REQUIRED',
        evidenceRef: {
          kind: 'APPROVAL_REQUEST',
          fingerprint: approvalRequest.approvalRequestFingerprint
        }
      });
      return resultEnvelope({
        request: validatedRequest,
        mission: current,
        updatedMission: waiting,
        classification: 'AUTHORITY_REQUIRED',
        reason: 'Contextual human authority is required.',
        approvalRequest,
        latency: latency.snapshot(),
        missionBeforeEventCount: eventStart
      });
    }
  }

  if (definition.localFastPath) {
    latency.mark('firstProgress');
    let projectedMission = current;
    let data;
    if (operation === 'mission.resume') {
      const revalidation = physicalRevalidation(current, options);
      projectedMission = resumeNaturalAgenticMission({
        mission: current,
        revalidation,
        resumedAt: requestedAt
      });
      data = projectMissionView(projectedMission, 'status');
      const resumeClassification = projectedMission.state === 'BLOCKED'
        ? 'STALE_STATE'
        : 'SUCCESS';
      latency.mark('normalized');
      return resultEnvelope({
        request: validatedRequest,
        mission: current,
        updatedMission: projectedMission,
        classification: resumeClassification,
        reason: resumeClassification === 'SUCCESS'
          ? 'Mission resumed after deterministic physical revalidation.'
          : 'Mission resume failed closed on stale physical state.',
        data,
        latency: latency.snapshot(),
        missionBeforeEventCount: eventStart
      });
    } else if (operation === 'authority.inspect') {
      data = projectMissionAuthority(current);
    } else if (operation === 'authority.request') {
      const requestedOperation = requireOperation(validatedRequest.args.operation);
      const approvalRequest = createContextualApprovalRequest({
        mission: current,
        operation: requestedOperation,
        reason: validatedRequest.args.reason || 'Human authority was requested by the mission.',
        scope: validatedRequest.args.scope || {},
        requestedAt
      });
      projectedMission = transitionNaturalAgenticMission(current, {
        type: EVENT_TYPES.AUTHORITY_REQUIRED,
        state: current.state,
        summary: 'Gateway created a contextual authority request.',
        at: requestedAt,
        resultClass: 'AUTHORITY_REQUIRED',
        evidenceRef: {
          kind: 'APPROVAL_REQUEST',
          fingerprint: approvalRequest.approvalRequestFingerprint
        }
      });
      latency.mark('normalized');
      return resultEnvelope({
        request: validatedRequest,
        mission: current,
        updatedMission: projectedMission,
        classification: 'AUTHORITY_REQUIRED',
        reason: 'Contextual human authority is required.',
        approvalRequest,
        latency: latency.snapshot(),
        missionBeforeEventCount: eventStart
      });
    } else {
      data = projectMissionView(current, definition.projection);
    }
    latency.mark('normalized');
    return resultEnvelope({
      request: validatedRequest,
      mission: current,
      updatedMission: projectedMission,
      classification: 'SUCCESS',
      reason: 'Deterministic local fast-path projection completed without provider invocation.',
      data,
      latency: latency.snapshot(),
      missionBeforeEventCount: eventStart
    });
  }

  let executing = transitionNaturalAgenticMission(current, {
    type: definition.eventStarted || EVENT_TYPES.OPERATION_STARTED,
    state: definition.state || current.state,
    summary: 'Gateway accepted operation for governed dispatch.',
    at: requestedAt,
    resultClass: 'SUCCESS'
  });
  latency.mark('firstProgress');

  let revalidation = null;
  if (definition.physical) {
    revalidation = physicalRevalidation(executing, options);
    if (revalidation.decision !== 'VALID') {
      const invalidated = transitionNaturalAgenticMission(executing, {
        type: EVENT_TYPES.STATE_INVALIDATED,
        state: 'BLOCKED',
        summary: 'Gateway physical revalidation failed closed.',
        at: requestedAt,
        resultClass: 'STALE_STATE'
      });
      return resultEnvelope({
        request: validatedRequest,
        mission: current,
        updatedMission: invalidated,
        classification: 'STALE_STATE',
        reason: 'Physical workspace state is stale or unavailable.',
        latency: latency.snapshot(),
        missionBeforeEventCount: eventStart
      });
    }
  }

  latency.mark('dispatchStarted');
  let normalized;
  try {
    normalized = performOperation({
      mission: executing,
      request: validatedRequest,
      definition,
      revalidation,
      options: {
        ...options,
        observedAt: requestedAt
      }
    });
  } catch (error) {
    latency.mark('firstEvidence');
    const failed = transitionNaturalAgenticMission(executing, {
      type: EVENT_TYPES.OPERATION_DENIED,
      state: executing.state,
      summary: 'Gateway operation failed closed during governed dispatch.',
      at: requestedAt,
      resultClass: 'FAILURE'
    });
    latency.mark('normalized');
    return resultEnvelope({
      request: validatedRequest,
      mission: current,
      updatedMission: failed,
      classification: 'FAILURE',
      reason: error.message || 'Gateway operation failed closed.',
      latency: latency.snapshot(),
      missionBeforeEventCount: eventStart
    });
  }
  latency.mark('firstEvidence');

  let completed = executing;
  if (operation === 'tests.run') {
    completed = recordNaturalAgenticMissionTestResult(executing, {
      testEvidence: {
        selector: 'NODE_TEST_FILE',
        target: normalized.data && normalized.data.target,
        classification: normalized.classification === 'SUCCESS' ? 'PASSED' : 'FAILED',
        testsDiscovered: normalized.data && normalized.data.testsDiscovered,
        passed: normalized.data && normalized.data.passed,
        failed: normalized.data && normalized.data.failed,
        skipped: normalized.data && normalized.data.skipped,
        canonical: false,
        evidenceDigest: fingerprint('sdo.integrated_gateway_test_result.v1', normalized.data)
      },
      at: requestedAt,
      state: 'TESTING'
    });
  } else {
    completed = transitionNaturalAgenticMission(executing, {
      type: normalized.classification === 'SUCCESS'
        ? (definition.eventCompleted || EVENT_TYPES.OPERATION_COMPLETED)
        : EVENT_TYPES.OPERATION_DENIED,
      state: executing.state,
      summary: normalized.reason,
      at: requestedAt,
      resultClass: normalized.classification,
      evidenceRef: {
        kind: operation,
        fingerprint: fingerprint('sdo.integrated_gateway_operation_result.v1', normalized.data || {})
      }
    });
  }

  if (
    operation === 'mutation.applyConditional' &&
    normalized.classification === 'SUCCESS' &&
    validatedRequest.authorityRef
  ) {
    completed = consumeMissionAuthorityGrant(completed, validatedRequest.authorityRef, {
      at: requestedAt
    });
  }

  latency.mark('normalized');
  return resultEnvelope({
    request: validatedRequest,
    mission: current,
    updatedMission: completed,
    classification: normalized.classification,
    reason: normalized.reason,
    data: normalized.data,
    latency: latency.snapshot(),
    missionBeforeEventCount: eventStart
  });
}

function createGatewayStreamEvent({ request, sequence, type, summary, classification = null, monotonicMs }) {
  const body = {
    schema: STREAM_EVENT_SCHEMA,
    requestId: request.requestId,
    missionId: request.missionId,
    operation: request.operation,
    sequence,
    type: requireText(type, 'Gateway stream event type', 64),
    summary: requireText(summary, 'Gateway stream event summary', 512),
    classification,
    monotonicMs,
    contentRecorded: false,
    presentationOnly: true,
    operationalAuthority: false,
    mutationAuthority: false
  };
  return deepFreeze({
    ...body,
    eventFingerprint: fingerprint(STREAM_EVENT_SCHEMA, body)
  });
}

async function* streamGatewayRequest({ request, mission, options = {}, execute = null } = {}) {
  const validated = validateGatewayRequest(request);
  const first = createGatewayStreamEvent({
    request: validated,
    sequence: 1,
    type: 'OPERATION_STARTED',
    summary: 'Gateway accepted operation for governed dispatch.',
    monotonicMs: monotonicMs(options)
  });
  yield deepFreeze({
    schema: 'sdo.integrated_governed_agent_gateway_stream_item.v1',
    event: first,
    dispatch: null,
    done: false
  });

  const dispatch = await Promise.resolve(
    execute
      ? execute()
      : dispatchGatewayRequest({ request: validated, mission, options })
  );
  const second = createGatewayStreamEvent({
    request: validated,
    sequence: 2,
    type: 'OPERATION_COMPLETED',
    summary: dispatch.result.reason,
    classification: dispatch.result.classification,
    monotonicMs: monotonicMs(options)
  });
  yield deepFreeze({
    schema: 'sdo.integrated_governed_agent_gateway_stream_item.v1',
    event: second,
    dispatch,
    done: true
  });
}

module.exports = Object.freeze({
  REQUEST_SCHEMA,
  RESULT_SCHEMA,
  DISPATCH_SCHEMA,
  APPROVAL_REQUEST_SCHEMA,
  STREAM_EVENT_SCHEMA,
  PROTOCOL_VERSION,
  RESULT_CLASSES,
  OPERATIONS,
  createGatewayRequest,
  validateGatewayRequest,
  dispatchGatewayRequest,
  createContextualApprovalRequest,
  streamGatewayRequest
});
