'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const os =
  require('node:os');

const path =
  require('node:path');

const childProcess =
  require('node:child_process');

const {
  createAIProviderPort
} = require(
  '../../accelerator/core/ai-provider'
);

const {
  createAIProviderSelector
} = require(
  '../../accelerator/core/ai-provider-selector'
);

const {
  createAIProviderExecutionSeam
} = require(
  '../../accelerator/core/ai-provider-execution'
);

const {
  createGovernedAIRuntime
} = require(
  '../../accelerator/core/governed-ai-runtime'
);

const {
  createGovernedCognitiveProposal
} = require(
  '../../accelerator/core/governed-cognitive-proposal'
);

const {
  materializeCandidateIntent
} = require(
  '../../accelerator/core/deterministic-materialization'
);

const {
  admitGovernedCandidate
} = require(
  '../../accelerator/core/governed-candidate-admission'
);

const {
  dispatchCognitiveReadOnly
} = require(
  '../../accelerator/core/cognitive-readonly-dispatch'
);

const PROVIDER_ID =
  'test:e2e-cognitive';

const REQUEST_ID =
  'req-governed-ai-e2e-001';

const HUMAN_INTENT =
  'Inspect the repository worktree state.';

const NOW =
  '2026-08-23T12:00:00.000Z';

function git(cwd, args) {
  return childProcess
    .execFileSync(
      'git',
      args,
      {
        cwd,
        encoding: 'utf8',
        stdio: [
          'ignore',
          'pipe',
          'pipe'
        ]
      }
    )
    .trim();
}

function repositoryFixture() {
  const root =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'sdo-governed-ai-e2e-'
      )
    );

  git(root, ['init', '-q']);

  git(
    root,
    [
      'config',
      'user.name',
      'Surgical DevOps Test'
    ]
  );

  git(
    root,
    [
      'config',
      'user.email',
      'sdo-test@example.invalid'
    ]
  );

  fs.writeFileSync(
    path.join(root, 'README.md'),
    '# governed AI E2E fixture\n'
  );

  git(
    root,
    [
      'add',
      'README.md'
    ]
  );

  git(
    root,
    [
      'commit',
      '-q',
      '-m',
      'fixture'
    ]
  );

  return root;
}

function createRuntime() {
  const providerPort =
    createAIProviderPort({
      providerId:
        PROVIDER_ID,

      capabilities: [
        'PLAN'
      ]
    });

  const selector =
    createAIProviderSelector({
      providers: [
        {
          providerId:
            PROVIDER_ID
        }
      ]
    });

  const executionSeam =
    createAIProviderExecutionSeam({
      providerId:
        PROVIDER_ID,

      invoke:
        async (request) =>
          Object.freeze({
            schema:
              'sdo.ai_cognitive_result.v1',

            requestId:
              request.requestId,

            requestFingerprint:
              request.fingerprint,

            providerId:
              request.providerId,

            capability:
              request.capability,

            status:
              'COMPLETED',

            output:
              Object.freeze({
                intent:
                  Object.freeze({
                    capabilityType:
                      'GIT_READ',

                    action:
                      'WORKTREE_STATUS'
                  }),

                rationale:
                  'Inspect repository worktree state.'
              })
          })
    });

  return createGovernedAIRuntime({
    selector,

    providerPorts: {
      [PROVIDER_ID]:
        providerPort
    },

    executionSeams: {
      [PROVIDER_ID]:
        executionSeam
    }
  });
}

test(
  'governed AI E2E qualifies PLAN through canonical R0 orchestrator execution',
  async () => {
    const repo =
      repositoryFixture();

    try {
      const runtime =
        createRuntime();

      /*
       * Cognitive boundary:
       *
       * provider selection
       * -> governed cognitive request
       * -> controlled provider execution seam
       * -> validated cognitive result
       */
      const cognitiveResult =
        await runtime.invoke({
          providerId:
            PROVIDER_ID,

          requestId:
            REQUEST_ID,

          capability:
            'PLAN',

          objective:
            'Determine the governed read-only operation required by the human intent.',

          context: {
            interactionMode:
              'ENGINEER'
          }
        });

      assert.equal(
        cognitiveResult.schema,
        'sdo.ai_cognitive_result.v1'
      );

      assert.equal(
        cognitiveResult.status,
        'COMPLETED'
      );

      assert.equal(
        cognitiveResult.providerId,
        PROVIDER_ID
      );

      assert.equal(
        cognitiveResult.capability,
        'PLAN'
      );

      assert.ok(
        Object.isFrozen(
          cognitiveResult
        )
      );

      assert.ok(
        Object.isFrozen(
          cognitiveResult.output
        )
      );

      /*
       * Planning boundary:
       *
       * cognitive result
       * -> governed proposal
       * -> deterministic materialization
       * -> governed admission
       */
      const proposal =
        createGovernedCognitiveProposal({
          humanIntent:
            HUMAN_INTENT,

          cognitiveResult
        });

      const candidate =
        materializeCandidateIntent(
          proposal
        );

      const admission =
        admitGovernedCandidate(
          candidate
        );

      /*
       * Admission does not expose a generic ADMITTED decision.
       * Its canonical contract is a bounded governance-only
       * admission whose next boundary is authority composition.
       */
      assert.equal(
        admission.schema,
        'sdo.governed_candidate_admission.v1'
      );

      assert.equal(
        admission.classification,
        'GOVERNANCE_ADMISSION_ONLY'
      );

      assert.deepEqual(
        admission.admittedIntent,
        {
          capabilityType:
            'GIT_READ',

          target:
            'status',

          canonicalAction:
            'WORKTREE_STATUS'
        }
      );

      assert.equal(
        admission.nextBoundary,
        'AUTHORITY_COMPOSITION_REQUIRED'
      );

      assert.equal(
        admission.authority.executable,
        false
      );

      assert.equal(
        admission.authority.dispatchAllowed,
        false
      );

      assert.equal(
        admission.authority.humanAuthority,
        false
      );

      /*
       * Operational boundary:
       *
       * admitted cognitive candidate
       * -> R0 authority composition
       * -> canonical Surgical Orchestrator
       * -> governed GIT_READ adapter
       */
      const result =
        dispatchCognitiveReadOnly(
          {
            admission,
            repositoryPath:
              repo
          },
          {
            now: () =>
              NOW
          }
        );

      assert.equal(
        result.orchestration.status,
        'COMPLETED'
      );

      assert.equal(
        result.orchestration
          .executionAllowed,
        true
      );

      assert.equal(
        result.orchestration
          .executionAttempted,
        true
      );

      /*
       * Cognitive provenance must survive the
       * complete governed execution chain.
       */
      assert.equal(
        result.governed
          .operationRecord
          .requester
          .type,
        'COGNITIVE'
      );

      assert.equal(
        result.governed
          .operationRecord
          .riskLevel,
        'R0'
      );

      assert.equal(
        result.governed
          .lifecycle
          .status,
        'COMPLETED'
      );

      /*
       * Physical execution evidence must be the
       * canonical Git read adapter result.
       */
      assert.equal(
        result.execution.schema,
        'sdo.git_read_result.v1'
      );

      assert.equal(
        result.execution.selector,
        'WORKTREE_STATUS'
      );

      const adapterEvidence =
        result.governed
          .operationRecord
          .adapterEvidence;

      assert.equal(
        adapterEvidence.length,
        1
      );

      assert.equal(
        adapterEvidence[0]
          .adapterType,
        'GIT_READ'
      );

      assert.equal(
        adapterEvidence[0]
          .action,
        'WORKTREE_STATUS'
      );

      assert.equal(
        adapterEvidence[0]
          .payload,
        result.execution
      );
    } finally {
      fs.rmSync(
        repo,
        {
          recursive: true,
          force: true
        }
      );
    }
  }
);
