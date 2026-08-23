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

const {
  admitGovernedCandidate
} = require(
  '../../accelerator/core/governed-candidate-admission'
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

function cognitiveResult() {
  return deepFreeze({
    schema:
      'sdo.ai_cognitive_result.v1',

    requestId:
      'req-admission-1',

    requestFingerprint:
      'a'.repeat(64),

    providerId:
      'test:cognitive',

    capability:
      'PLAN',

    status:
      'COMPLETED',

    output: {
      intent: {
        capabilityType:
          'GIT_READ',

        action:
          'WORKTREE_STATUS'
      },

      rationale:
        'Observe repository state before further action.'
    }
  });
}

function candidate() {
  const proposal =
    createGovernedCognitiveProposal({
      humanIntent:
        'Inspect the repository worktree state.',

      cognitiveResult:
        cognitiveResult()
    });

  return materializeCandidateIntent(
    proposal
  );
}

test(
  'admits only canonical GIT_READ WORKTREE_STATUS candidate',
  () => {
    const source =
      candidate();

    const admission =
      admitGovernedCandidate(
        source
      );

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

    assert.ok(
      Object.isFrozen(admission)
    );

    assert.ok(
      Object.isFrozen(
        admission.admittedIntent
      )
    );
  }
);

test(
  'admits canonical GIT_READ HEAD_COMMIT candidate without new authority',
  () => {
    const proposal =
      createGovernedCognitiveProposal({
        humanIntent:
          'Identify the repository HEAD commit.',

        cognitiveResult:
          deepFreeze({
            ...cognitiveResult(),

            output: {
              intent: {
                capabilityType:
                  'GIT_READ',

                action:
                  'HEAD_COMMIT'
              },

              rationale:
                'Identify the exact repository revision.'
            }
          })
      });

    const source =
      materializeCandidateIntent(
        proposal
      );

    const admission =
      admitGovernedCandidate(
        source
      );

    assert.deepEqual(
      admission.admittedIntent,
      {
        capabilityType:
          'GIT_READ',

        target:
          'rev-parse',

        canonicalAction:
          'HEAD_COMMIT'
      }
    );

    assert.equal(
      admission.authority.executable,
      false
    );

    assert.equal(
      admission.authority.dispatchAllowed,
      false
    );
  }
);

test(
  'admission preserves candidate proposal and human-intent provenance',
  () => {
    const source =
      candidate();

    const admission =
      admitGovernedCandidate(
        source
      );

    assert.equal(
      admission
        .sourceCandidateFingerprint,
      source.fingerprint
    );

    assert.equal(
      admission
        .sourceProposalFingerprint,
      source.sourceProposalFingerprint
    );

    assert.equal(
      admission.humanIntent,
      source.humanIntent
    );

    assert.equal(
      admission.provenance.origin,
      'COGNITIVE_CANDIDATE'
    );

    assert.equal(
      admission
        .provenance
        .humanRequesterAsserted,
      false
    );

    assert.equal(
      admission
        .provenance
        .humanAuthorityAsserted,
      false
    );
  }
);

test(
  'admission vocabulary translation is deterministic',
  () => {
    const source =
      candidate();

    const first =
      admitGovernedCandidate(
        source
      );

    const second =
      admitGovernedCandidate(
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

    assert.equal(
      first.admittedIntent.target,
      'status'
    );

    assert.equal(
      first.admittedIntent
        .canonicalAction,
      'WORKTREE_STATUS'
    );
  }
);

test(
  'mutable forged or broadened candidate fails closed',
  () => {
    const source =
      candidate();

    assert.throws(
      () =>
        admitGovernedCandidate({
          ...source
        }),
      /mutable|malformed/i
    );

    const forged =
      deepFreeze({
        ...source,

        fingerprint:
          'f'.repeat(64)
      });

    assert.throws(
      () =>
        admitGovernedCandidate(
          forged
        ),
      /fingerprint binding/i
    );

    const broadened =
      deepFreeze({
        ...source,

        intent: {
          ...source.intent,

          target:
            '/tmp'
        }
      });

    assert.throws(
      () =>
        admitGovernedCandidate(
          broadened
        ),
      /unsupported|ambiguous|fingerprint/i
    );
  }
);

test(
  'candidate cannot assert human requester or authority through admission',
  () => {
    const admission =
      admitGovernedCandidate(
        candidate()
      );

    assert.equal(
      admission.provenance
        .humanRequesterAsserted,
      false
    );

    assert.equal(
      admission.provenance
        .humanAuthorityAsserted,
      false
    );

    assert.equal(
      admission.authority
        .humanAuthority,
      false
    );
  }
);

test(
  'admission creates no repository workspace operation grant record lifecycle or execution authority',
  () => {
    const admission =
      admitGovernedCandidate(
        candidate()
      );

    for (
      const forbidden
      of [
        'repositoryPath',
        'workspace',
        'operationId',
        'observedAt',
        'expiresAt',
        'grant',
        'grantEvaluation',
        'operationRecord',
        'lifecycle',
        'execution',
        'authorizeExecution',
        'policyDecision',
        'riskLevel',
        'scope',
        'requester'
      ]
    ) {
      assert.equal(
        Object.prototype
          .hasOwnProperty
          .call(
            admission,
            forbidden
          ),
        false,
        `${forbidden} must not cross admission boundary`
      );
    }

    for (
      const value
      of Object.values(
        admission.authority
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
  'admission does not reuse human CLI authority composition or dispatch',
  () => {
    const source =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/core/governed-candidate-admission'
        ),
        'utf8'
      );

    for (
      const forbidden
      of [
        'governed-readonly-dispatch',
        'createGovernedReadOnlyRequest',
        'dispatchGovernedReadOnly',
        'surgical-orchestrator',
        'repository-discovery',
        'capability-grant',
        'operation-record',
        'state-boundary',
        'git-read-adapter',
        'child_process',
        'fetch(',
        'process.env',
        'sdo.governed_human_cli.v1'
      ]
    ) {
      assert.equal(
        source.includes(forbidden),
        false,
        `forbidden admission dependency: ${forbidden}`
      );
    }
  }
);

test(
  'admission module exposes exactly one bounded function',
  () => {
    const surface =
      require(
        '../../accelerator/core/governed-candidate-admission'
      );

    assert.deepEqual(
      Object.keys(surface).sort(),
      [
        'admitGovernedCandidate'
      ]
    );

    assert.ok(
      Object.isFrozen(surface)
    );
  }
);
