'use strict';

/*
 * Single-agent engineering composition.
 *
 * Evidence acquisition remains delegated to the existing read-only recursive
 * loop. The cognitive provider may then produce one proposal, but this module
 * deliberately stops before approval, grant creation or mutation dispatch.
 */

const {
  runNaturalRecursiveEvidenceLoop
} = require(
  './natural-recursive-evidence-loop'
);

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

function finalResult({
  status,
  analysis,
  proposal = null,
  reason = null
}) {
  return deepFreeze({
    schema:
      'sdo.governed_engineering_agent_loop.v1',

    status,

    analysis,

    proposal,

    reason,

    operationalAuthority:
      false,

    mutationAuthority:
      false,

    approvalAuthority:
      false
  });
}

function proposalEvidence(evidence) {
  return evidence
    .map((item, index) =>
      `EVIDENCE_${index + 1}:\n` +
      JSON.stringify(item)
    )
    .join('\n\n')
    .slice(0, 96000);
}

async function runGovernedEngineeringAgentLoop({
  task,
  activation,
  cognitiveSession,
  dispatchEvidence
} = {}) {
  if (
    !cognitiveSession ||
    typeof cognitiveSession.decideEvidence !==
      'function' ||
    typeof cognitiveSession.proposePatch !==
      'function'
  ) {
    throw new Error(
      'Qualified single-agent cognitive session is required.'
    );
  }

  const analysis =
    await runNaturalRecursiveEvidenceLoop({
      task,
      activation,
      cognitiveSession,
      ...(dispatchEvidence
        ? { dispatchEvidence }
        : {})
    });

  if (
    analysis.status !== 'COMPLETED' ||
    !Array.isArray(analysis.evidence) ||
    analysis.evidence.length === 0
  ) {
    return finalResult({
      status:
        'FAILED',

      analysis,

      reason:
        analysis.reason ||
        'Engineering analysis completed without governed evidence.'
    });
  }

  let proposal;

  try {
    proposal =
      await cognitiveSession.proposePatch(
        task.objective,
        activation,
        proposalEvidence(
          analysis.evidence
        )
      );
  } catch {
    return finalResult({
      status:
        'FAILED',

      analysis,

      reason:
        'Cognitive patch proposal failed safely.'
    });
  }

  const boundRead =
    analysis.evidence.find(
      (item) =>
        item.kind === 'READ_FILE' &&
        item.target === proposal.target &&
        item.sha256 === proposal.beforeSha256
    );

  if (
    proposal.objective !== task.objective ||
    !boundRead
  ) {
    return finalResult({
      status:
        'FAILED',

      analysis,

      reason:
        'Patch proposal is not bound to the authorized objective and observed BEFORE state.'
    });
  }

  return finalResult({
    status:
      'HUMAN_AUTHORITY_REQUIRED',

    analysis,

    proposal,

    reason:
      'A bounded patch proposal is ready for explicit human review; no mutation was dispatched.'
  });
}

module.exports =
  Object.freeze({
    runGovernedEngineeringAgentLoop
  });
