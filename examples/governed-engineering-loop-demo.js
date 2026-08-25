#!/usr/bin/env node
'use strict';

/*
 * Reproducible zero-mutation demonstration of the single-agent boundary.
 * Cognitive decisions and governed evidence are fixed fixtures so reviewers
 * can inspect the authority transition without Ollama or repository writes.
 */

const path = require('node:path');

const {
  materializeGovernedEngineeringProposal
} = require(
  '../accelerator/core/governed-engineering-proposal'
);

const {
  runGovernedEngineeringAgentLoop
} = require(
  '../accelerator/cli/governed-engineering-agent-loop'
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

const objective =
  'Propose one bounded correction for accelerator/example.js.';

const task =
  deepFreeze({
    schema:
      'sdo.natural_governed_task.v1',
    kind:
      'PROJECT_ANALYSIS',
    objective,
    mutating:
      false,
    operations:
      []
  });

const activation =
  deepFreeze({
    repositoryPath:
      path.resolve(process.cwd()),
    workspace:
      path.basename(
        path.resolve(process.cwd())
      ),
    interactionMode: {
      mode:
        'ENGINEER'
    }
  });

const beforeSha256 =
  'a'.repeat(64);

const decisions = [
  deepFreeze({
    schema:
      'sdo.natural_evidence_decision.v1',
    decision:
      'REQUEST_EVIDENCE',
    response:
      null,
    evidenceRequest: {
      kind:
        'READ_FILE',
      target:
        'accelerator/example.js',
      reason:
        'Bind the proposal to the observed BEFORE state.'
    }
  }),
  deepFreeze({
    schema:
      'sdo.natural_evidence_decision.v1',
    decision:
      'RESPOND',
    response:
      'The governed evidence is sufficient for a proposal.',
    evidenceRequest:
      null
  })
];

const cognitiveSession =
  deepFreeze({
    async decideEvidence() {
      return decisions.shift();
    },

    async proposePatch() {
      return materializeGovernedEngineeringProposal({
        schema:
          'sdo.ai_engineering_patch_proposal.v1',
        objective,
        target:
          'accelerator/example.js',
        beforeSha256,
        replacementBase64:
          Buffer.from(
            "'use strict';\nmodule.exports = {};\n"
          ).toString('base64'),
        reason:
          'One exact replacement bound to governed evidence.',
        validationKind:
          'VALIDATE_JS'
      });
    }
  });

function dispatchEvidence() {
  return deepFreeze({
    orchestration: {
      status:
        'COMPLETED'
    },
    execution: {
      schema:
        'sdo.filesystem_read_result.v1',
      target: {
        requested:
          'accelerator/example.js'
      },
      evidence: {
        bytes:
          14,
        sha256:
          beforeSha256,
        content:
          "'use strict';\n"
      }
    }
  });
}

runGovernedEngineeringAgentLoop({
  task,
  activation,
  cognitiveSession,
  dispatchEvidence
}).then((result) => {
  const proposal =
    result.proposal;

  process.stdout.write(
    JSON.stringify(
      {
        schema:
          result.schema,
        status:
          result.status,
        evidenceCount:
          result.analysis.evidence.length,
        target:
          proposal && proposal.target,
        beforeSha256:
          proposal && proposal.beforeSha256,
        afterSha256:
          proposal && proposal.replacementSha256,
        validationKind:
          proposal && proposal.validationKind,
        operationalAuthority:
          result.operationalAuthority,
        mutationAuthority:
          result.mutationAuthority,
        approvalAuthority:
          result.approvalAuthority
      },
      null,
      2
    ) +
    '\n'
  );
}).catch(() => {
  process.stderr.write(
    'Governed engineering-loop demo failed closed.\n'
  );
  process.exitCode = 1;
});
