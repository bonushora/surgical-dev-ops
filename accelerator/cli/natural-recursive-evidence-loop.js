'use strict';

/*
 * NATURAL recursive governed evidence loop.
 *
 * Cognitive provider:
 *   - decides whether more evidence is needed;
 *   - never dispatches an operation.
 *
 * Task authority envelope:
 *   - evaluates containment only;
 *   - never grants operational authority.
 *
 * Canonical governed dispatcher:
 *   - is the only physical evidence execution boundary used here;
 *   - still materializes its own capability/grant and crosses the
 *     Surgical DevOps Orchestrator.
 *
 * This loop introduces:
 *   - no generic shell;
 *   - no arbitrary process;
 *   - no mutation capability;
 *   - no provider-created authority;
 *   - no implicit scope expansion.
 */

const crypto =
  require('node:crypto');

const {
  createGovernedReadOnlyRequest
} = require(
  './governed-readonly-dispatch'
);

const {
  executeGovernedMachineAccess
} = require(
  '../core/machine-access-governed-composition'
);

const {
  createNaturalTaskAuthorityEnvelope,
  evaluateNaturalEvidenceRequest
} = require(
  './natural-task-authority'
);

const LOOP_SCHEMA =
  'sdo.natural_recursive_evidence_loop.v1';

const MAX_HISTORY_ITEM_CHARS =
  5000;

const PROJECT_GROUNDING_TARGETS =
  Object.freeze([
    'README.md',
    'README_EN.md',
    'README_PT-BR.md'
  ]);

function deepFreeze(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (
    const child
    of Object.values(value)
  ) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function boundedText(
  value,
  maxLength
) {
  const text =
    String(value ?? '');

  if (text.length <= maxLength) {
    return text;
  }

  return (
    text.slice(
      0,
      maxLength
    ) +
    '\n[TRUNCATED_BY_SURGICAL_DEVOPS]'
  );
}

function evidenceRequestFingerprint(
  request
) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        kind:
          request.kind,

        target:
          request.target,

        reason:
          request.reason
      }),
      'utf8'
    )
    .digest('hex');
}

function extractRecursiveEvidence(
  result,
  intent
) {
  if (
    !result ||
    typeof result !== 'object' ||
    !intent ||
    typeof intent !== 'object'
  ) {
    throw new Error(
      'Governed recursive evidence result is required.'
    );
  }

  const orchestration =
    result.orchestration;

  if (
    !orchestration ||
    orchestration.status !==
      'COMPLETED'
  ) {
    throw new Error(
      'Governed evidence operation did not complete.'
    );
  }

  const execution =
    result.execution;

  if (
    intent.capabilityType ===
      'GIT_READ' &&
    intent.target ===
      'workspace-files'
  ) {
    if (
      !execution ||
      execution.schema !==
        'sdo.git_read_result.v1' ||
      execution.selector !==
        'WORKSPACE_FILES' ||
      !execution.result ||
      !Array.isArray(
        execution.result.files
      )
    ) {
      throw new Error(
        'Governed workspace inventory evidence is malformed.'
      );
    }

    return deepFreeze({
      schema:
        'sdo.natural_recursive_evidence.v1',

      kind:
        'WORKSPACE_FILES',

      target:
        null,

      files:
        [...execution.result.files],

      summary:
        boundedText(
          JSON.stringify({
            files:
              execution.result.files
          }),
          MAX_HISTORY_ITEM_CHARS
        )
    });
  }

  if (
    intent.capabilityType ===
      'FILESYSTEM_READ'
  ) {
    if (
      !execution ||
      execution.schema !==
        'sdo.filesystem_read_result.v1' ||
      !execution.target ||
      execution.target.requested !==
        intent.target ||
      !execution.evidence ||
      typeof execution.evidence.content !==
        'string'
    ) {
      throw new Error(
        'Governed filesystem evidence is malformed.'
      );
    }

    return deepFreeze({
      schema:
        'sdo.natural_recursive_evidence.v1',

      kind:
        'READ_FILE',

      target:
        execution.target.requested,

      sha256:
        execution.evidence.sha256,

      bytes:
        execution.evidence.bytes,

      summary:
        boundedText(
          execution.evidence.content,
          MAX_HISTORY_ITEM_CHARS
        )
    });
  }

  if (
    intent.capabilityType ===
      'PROCESS_VALIDATION'
  ) {
    if (
      !execution ||
      execution.schema !==
        'sdo.process_validation_result.v1'
    ) {
      throw new Error(
        'Governed validation evidence is malformed.'
      );
    }

    return deepFreeze({
      schema:
        'sdo.natural_recursive_evidence.v1',

      kind:
        'VALIDATE_JS',

      target:
        intent.target,

      validationStatus:
        execution.status,

      summary:
        boundedText(
          JSON.stringify({
            status:
              execution.status,

            selector:
              execution.selector,

            target:
              intent.target
          }),
          MAX_HISTORY_ITEM_CHARS
        )
    });
  }

  throw new Error(
    'Unsupported governed recursive evidence result.'
  );
}

function formatEvidenceForCognition(
  evidence
) {
  if (
    !evidence ||
    evidence.schema !==
      'sdo.natural_recursive_evidence.v1'
  ) {
    throw new Error(
      'Canonical recursive evidence is required.'
    );
  }

  if (
    evidence.kind ===
      'WORKSPACE_FILES'
  ) {
    return (
      'TYPE: WORKSPACE_FILES\n' +
      'SOURCE: Surgical DevOps governed Orchestrator evidence\n' +
      evidence.summary
    );
  }

  if (
    evidence.kind ===
      'READ_FILE'
  ) {
    return (
      'TYPE: READ_FILE\n' +
      `TARGET: ${evidence.target}\n` +
      `SHA256: ${evidence.sha256}\n` +
      `BYTES: ${evidence.bytes}\n` +
      'SOURCE: Surgical DevOps governed Orchestrator evidence\n\n' +
      evidence.summary
    );
  }

  return (
    'TYPE: VALIDATE_JS\n' +
    `TARGET: ${evidence.target}\n` +
    `STATUS: ${evidence.validationStatus}\n` +
    'SOURCE: Surgical DevOps governed Orchestrator evidence\n' +
    evidence.summary
  );
}

function finalResult(
  {
    status,
    envelope,
    steps,
    evidence,
    response = null,
    reason = null,
    pendingRequest = null
  }
) {
  return deepFreeze({
    schema:
      LOOP_SCHEMA,

    status,

    taskAuthorityFingerprint:
      envelope.bindingFingerprint,

    steps,

    evidence,

    response,

    reason,

    pendingRequest,

    operationalAuthority:
      false,

    mutationAuthority:
      false
  });
}

function dispatchGovernedMachineEvidence(
  intent,
  repositoryPath
) {
  const governedRequest =
    createGovernedReadOnlyRequest({
      repositoryPath,
      capabilityType:
        intent.capabilityType,
      target:
        intent.target
    });

  return executeGovernedMachineAccess(
    governedRequest
  );
}

function deterministicProjectGroundingDecision(
  task,
  evidence
) {
  if (
    task.kind !==
      'PROJECT_ANALYSIS'
  ) {
    return null;
  }

  if (evidence.length === 0) {
    return deepFreeze({
      schema:
        'sdo.natural_evidence_decision.v1',

      decision:
        'REQUEST_EVIDENCE',

      response:
        null,

      evidenceRequest: {
        kind:
          'WORKSPACE_FILES',

        target:
          null,

        reason:
          'Canonical project grounding begins with the authorized workspace inventory.'
      }
    });
  }

  if (
    evidence.length !== 1 ||
    evidence[0].kind !==
      'WORKSPACE_FILES' ||
    !Array.isArray(
      evidence[0].files
    )
  ) {
    return null;
  }

  const target =
    PROJECT_GROUNDING_TARGETS.find(
      (candidate) =>
        evidence[0].files.includes(
          candidate
        )
    );

  if (!target) {
    return null;
  }

  return deepFreeze({
    schema:
      'sdo.natural_evidence_decision.v1',

    decision:
      'REQUEST_EVIDENCE',

    response:
      null,

    evidenceRequest: {
      kind:
        'READ_FILE',

      target,

      reason:
        'Canonical project grounding requires one real project description file.'
    }
  });
}

async function runNaturalRecursiveEvidenceLoop(
  {
    task,
    activation,
    cognitiveSession,
    dispatchEvidence =
      dispatchGovernedMachineEvidence,
    onProgress = null
  } = {}
) {
  if (
    !task ||
    typeof task !== 'object' ||
    Object.isFrozen(task) !== true
  ) {
    throw new Error(
      'Immutable authorized NATURAL task is required.'
    );
  }

  if (
    !activation ||
    typeof activation !== 'object' ||
    typeof activation.repositoryPath !==
      'string' ||
    !activation.repositoryPath
  ) {
    throw new Error(
      'Canonical active repository is required.'
    );
  }

  if (
    !cognitiveSession ||
    typeof cognitiveSession.decideEvidence !==
      'function'
  ) {
    throw new Error(
      'NATURAL cognitive evidence planner is required.'
    );
  }

  if (
    typeof dispatchEvidence !==
      'function'
  ) {
    throw new Error(
      'Canonical governed evidence dispatcher is required.'
    );
  }

  if (
    onProgress !== null &&
    typeof onProgress !== 'function'
  ) {
    throw new Error(
      'Optional NATURAL progress observer must be a function.'
    );
  }

  function report(stage, step, detail = null) {
    if (!onProgress) {
      return;
    }

    try {
      onProgress(Object.freeze({
        schema: 'sdo.natural_progress.v1',
        stage,
        step,
        detail,
        operationalAuthority: false
      }));
    } catch {
      /* Presentation observers never affect governed execution. */
    }
  }

  const envelope =
    createNaturalTaskAuthorityEnvelope({
      task,

      workspaceRoot:
        activation.repositoryPath
    });

  const history = [];
  const evidence = [];
  const seenRequests =
    new Set();

  for (
    let step = 0;
    step <
      envelope.authority
        .maxEvidenceSteps;
    step += 1
  ) {
    report('PLANNING_EVIDENCE', step);

    let decision =
      deterministicProjectGroundingDecision(
        task,
        evidence
      );

    if (!decision) {
      try {
        decision =
          await cognitiveSession
            .decideEvidence(
              task.objective,
              activation,
              history
            );
      } catch {
        return finalResult({
          status:
            'FAILED',

          envelope,

          steps:
            step,

          evidence,

          reason:
            'Cognitive evidence planning failed safely.'
        });
      }
    }

    if (
      decision.decision ===
        'RESPOND'
    ) {
      if (
        task.kind ===
          'PROJECT_ANALYSIS' &&
        !evidence.some(
          (item) =>
            item.kind ===
              'READ_FILE'
        )
      ) {
        return finalResult({
          status:
            'FAILED',

          envelope,

          steps:
            step,

          evidence,

          reason:
            'Project analysis cannot respond without governed file evidence.'
        });
      }

      report('COMPLETED', step);

      return finalResult({
        status:
          'COMPLETED',

        envelope,

        steps:
          step,

        evidence,

        response:
          decision.response
      });
    }

    if (
      decision.decision !==
        'REQUEST_EVIDENCE' ||
      !decision.evidenceRequest
    ) {
      return finalResult({
        status:
          'FAILED',

        envelope,

        steps:
          step,

        evidence,

        reason:
          'Cognitive evidence decision was not actionable.'
      });
    }

    const requestFingerprint =
      evidenceRequestFingerprint(
        decision.evidenceRequest
      );

    if (
      seenRequests.has(
        requestFingerprint
      )
    ) {
      return finalResult({
        status:
          'FAILED',

        envelope,

        steps:
          step,

        evidence,

        reason:
          'Repeated identical cognitive evidence request was stopped.'
      });
    }

    seenRequests.add(
      requestFingerprint
    );

    const containment =
      evaluateNaturalEvidenceRequest(
        envelope,
        decision.evidenceRequest,
        {
          evidenceStep:
            step
        }
      );

    if (
      containment.decision !==
        'CONTAINED'
    ) {
      return finalResult({
        status:
          'HUMAN_AUTHORITY_REQUIRED',

        envelope,

        steps:
          step,

        evidence,

        reason:
          containment.reason,

        pendingRequest:
          decision.evidenceRequest
      });
    }

    let governed;

    try {
      governed =
        dispatchEvidence(
          containment.governedIntent,
          activation.repositoryPath
        );
    } catch {
      return finalResult({
        status:
          'FAILED',

        envelope,

        steps:
          step,

        evidence,

        reason:
          'Governed evidence dispatch failed safely.'
      });
    }

    let observed;

    try {
      observed =
        extractRecursiveEvidence(
          governed,
          containment.governedIntent
        );
    } catch {
      return finalResult({
        status:
          'FAILED',

        envelope,

        steps:
          step + 1,

        evidence,

        reason:
          'Governed evidence could not be qualified for cognition.'
      });
    }

    evidence.push(
      observed
    );

    report(
      'EVIDENCE_OBTAINED',
      step + 1,
      observed.kind
    );

    history.push(
      formatEvidenceForCognition(
        observed
      )
    );
  }

  return finalResult({
    status:
      'HUMAN_AUTHORITY_REQUIRED',

    envelope,

    steps:
      envelope.authority
        .maxEvidenceSteps,

    evidence,

    reason:
      'Authorized recursive evidence-step bound was reached.'
  });
}

module.exports =
  Object.freeze({
    runNaturalRecursiveEvidenceLoop
  });
