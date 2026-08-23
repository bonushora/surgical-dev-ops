'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

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

function cognitiveResult(
  output
) {
  return deepFreeze({
    schema:
      'sdo.ai_cognitive_result.v1',

    requestId:
      'req-materialize-1',

    requestFingerprint:
      'a'.repeat(64),

    providerId:
      'test:cognitive',

    capability:
      'PLAN',

    status:
      'COMPLETED',

    output
  });
}

function proposal(
  intent = {
    capabilityType:
      'GIT_READ',

    action:
      'WORKTREE_STATUS'
  }
) {
  return createGovernedCognitiveProposal({
    humanIntent:
      'Inspect the current repository state.',

    cognitiveResult:
      cognitiveResult({
        intent,

        rationale:
          'Repository state should be observed before any further action.'
      })
  });
}

test(
  'materializes only GIT_READ WORKTREE_STATUS as immutable candidate intent',
  () => {
    const candidate =
      materializeCandidateIntent(
        proposal()
      );

    assert.equal(
      candidate.schema,
      'sdo.materialized_candidate_intent.v1'
    );

    assert.equal(
      candidate.classification,
      'DETERMINISTIC_CANDIDATE_ONLY'
    );

    assert.deepEqual(
      candidate.intent,
      {
        capabilityType:
          'GIT_READ',

        action:
          'WORKTREE_STATUS'
      }
    );

    assert.equal(
      candidate.nextBoundary,
      'GOVERNANCE_REQUIRED'
    );

    assert.ok(
      Object.isFrozen(candidate)
    );

    assert.ok(
      Object.isFrozen(
        candidate.intent
      )
    );

    assert.ok(
      Object.isFrozen(
        candidate.authority
      )
    );
  }
);

test(
  'candidate remains bound to human intent and source proposal fingerprint',
  () => {
    const source =
      proposal();

    const candidate =
      materializeCandidateIntent(
        source
      );

    assert.equal(
      candidate.humanIntent,
      source.humanIntent
    );

    assert.equal(
      candidate
        .sourceProposalFingerprint,
      source.fingerprint
    );

    assert.match(
      candidate.fingerprint,
      /^[a-f0-9]{64}$/
    );
  }
);

test(
  'materialization is deterministic for identical governed proposal',
  () => {
    const source =
      proposal();

    const first =
      materializeCandidateIntent(
        source
      );

    const second =
      materializeCandidateIntent(
        source
      );

    assert.deepEqual(
      first,
      second
    );

    assert.equal(
      first.fingerprint,
      second.fingerprint
    );
  }
);

test(
  'all other capabilities and actions fail closed',
  () => {
    for (
      const intent
      of [
        {
          capabilityType:
            'FILESYSTEM_READ',

          action:
            'READ_FILE'
        },
        {
          capabilityType:
            'PROCESS_VALIDATION',

          action:
            'NODE_SYNTAX_CHECK'
        },
        {
          capabilityType:
            'GIT_READ',

          action:
            'HEAD_COMMIT'
        },
        {
          capabilityType:
            'GIT_READ',

          action:
            'TRACKED_FILES'
        },
        {
          capabilityType:
            'FILESYSTEM_PATCH',

          action:
            'PATCH_FILE'
        }
      ]
    ) {
      assert.throws(
        () =>
          materializeCandidateIntent(
            proposal(intent)
          ),
        /only git_read \/ worktree_status/i
      );
    }
  }
);

test(
  'candidate intent vocabulary rejects extra fields and authority smuggling',
  () => {
    for (
      const intent
      of [
        {
          capabilityType:
            'GIT_READ',

          action:
            'WORKTREE_STATUS',

          target:
            '/tmp'
        },
        {
          capabilityType:
            'GIT_READ',

          action:
            'WORKTREE_STATUS',

          workspace:
            '/trusted'
        },
        {
          capabilityType:
            'GIT_READ',

          action:
            'WORKTREE_STATUS',

          authorizeExecution:
            true
        },
        {
          capabilityType:
            'GIT_READ',

          action:
            'WORKTREE_STATUS',

          grantEvaluation: {}
        }
      ]
    ) {
      assert.throws(
        () =>
          materializeCandidateIntent(
            proposal(intent)
          ),
        /unsupported|ambiguous field|operational authority field/i
      );
    }
  }
);

test(
  'forged or mutable proposal fails closed before materialization',
  () => {
    const valid =
      proposal();

    const forged =
      deepFreeze({
        ...valid,

        fingerprint:
          'f'.repeat(64)
      });

    assert.throws(
      () =>
        materializeCandidateIntent(
          forged
        ),
      /fingerprint binding/i
    );

    const mutable =
      {
        ...valid
      };

    assert.throws(
      () =>
        materializeCandidateIntent(
          mutable
        ),
      /mutable|malformed/i
    );
  }
);

test(
  'materialized candidate exposes zero operational authority',
  () => {
    const candidate =
      materializeCandidateIntent(
        proposal()
      );

    for (
      const forbidden
      of [
        'repositoryPath',
        'workspace',
        'operationId',
        'observedAt',
        'expiresAt',
        'execution',
        'grant',
        'grantEvaluation',
        'operationRecord',
        'lifecycle',
        'policy',
        'approvalAuthority',
        'rawIdentityAssertion',
        'mutationProvider',
        'replacement',
        'command',
        'args',
        'executable'
      ]
    ) {
      assert.equal(
        Object.prototype
          .hasOwnProperty
          .call(
            candidate,
            forbidden
          ),
        false,
        `${forbidden} must not cross deterministic materialization boundary`
      );
    }

    for (
      const value
      of Object.values(
        candidate.authority
      )
    ) {
      assert.equal(
        value,
        false
      );
    }
  }
);

test(
  'materializer has no orchestrator CLI adapter provider filesystem network or process dependency',
  () => {
    const source =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/core/deterministic-materialization'
        ),
        'utf8'
      );

    for (
      const forbidden
      of [
        'surgical-orchestrator',
        'governed-readonly-dispatch',
        'capability-grant',
        'operation-record',
        'state-boundary',
        'repository-discovery',
        'filesystem-read-adapter',
        'git-read-adapter',
        'process-validation-adapter',
        'filesystem-patch-adapter',
        'production-mutation-runtime',
        'child_process',
        'node:http',
        'node:https',
        'fetch(',
        'process.env',
        'ollama',
        'codex',
        'openai'
      ]
    ) {
      assert.equal(
        source
          .toLowerCase()
          .includes(
            forbidden.toLowerCase()
          ),
        false,
        `forbidden dependency: ${forbidden}`
      );
    }
  }
);
