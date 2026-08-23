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

function result(
  overrides = {}
) {
  return deepFreeze({
    schema:
      'sdo.ai_cognitive_result.v1',

    requestId:
      'req-proposal-1',

    requestFingerprint:
      'a'.repeat(64),

    providerId:
      'test:cognitive',

    capability:
      'PLAN',

    status:
      'COMPLETED',

    output: {
      summary:
        'Inspect the target and propose the smallest safe change.',

      suggestedFiles: [
        'target.js'
      ],

      rationale:
        'Human intent requires a bounded engineering proposal.'
    },

    ...overrides
  });
}

test(
  'completed cognitive evidence becomes immutable non-executable proposal',
  () => {
    const proposal =
      createGovernedCognitiveProposal({
        humanIntent:
          'Improve the target safely.',

        cognitiveResult:
          result()
      });

    assert.equal(
      proposal.schema,
      'sdo.governed_cognitive_proposal.v1'
    );

    assert.equal(
      proposal.classification,
      'COGNITIVE_EVIDENCE_ONLY'
    );

    assert.equal(
      proposal.humanIntent,
      'Improve the target safely.'
    );

    assert.equal(
      proposal.source.providerId,
      'test:cognitive'
    );

    assert.equal(
      proposal.source.capability,
      'PLAN'
    );

    assert.equal(
      proposal.authority.executable,
      false
    );

    assert.equal(
      proposal.authority.dispatchAllowed,
      false
    );

    assert.equal(
      proposal.nextBoundary,
      'DETERMINISTIC_MATERIALIZATION_REQUIRED'
    );

    assert.ok(
      Object.isFrozen(proposal)
    );

    assert.ok(
      Object.isFrozen(
        proposal.proposal
      )
    );

    assert.ok(
      Object.isFrozen(
        proposal.authority
      )
    );
  }
);

test(
  'proposal fingerprint is deterministic and binds human intent',
  () => {
    const first =
      createGovernedCognitiveProposal({
        humanIntent:
          'Inspect safely.',

        cognitiveResult:
          result()
      });

    const second =
      createGovernedCognitiveProposal({
        humanIntent:
          'Inspect safely.',

        cognitiveResult:
          result()
      });

    const changed =
      createGovernedCognitiveProposal({
        humanIntent:
          'Different human intent.',

        cognitiveResult:
          result()
      });

    assert.equal(
      first.fingerprint,
      second.fingerprint
    );

    assert.notEqual(
      first.fingerprint,
      changed.fingerprint
    );
  }
);

test(
  'failed cognitive evidence cannot become a proposal',
  () => {
    assert.throws(
      () =>
        createGovernedCognitiveProposal({
          humanIntent:
            'Do something safely.',

          cognitiveResult:
            result({
              status:
                'FAILED'
            })
        }),
      /completed cognitive evidence/i
    );
  }
);

test(
  'mutable or malformed cognitive evidence fails closed',
  () => {
    assert.throws(
      () =>
        createGovernedCognitiveProposal({
          humanIntent:
            'Do something safely.',

          cognitiveResult: {
            schema:
              'sdo.ai_cognitive_result.v1',

            requestId:
              'req',

            requestFingerprint:
              'a'.repeat(64),

            providerId:
              'test:cognitive',

            capability:
              'PLAN',

            status:
              'COMPLETED',

            output: {}
          }
        }),
      /mutable|malformed/i
    );

    assert.throws(
      () =>
        createGovernedCognitiveProposal({
          humanIntent:
            'Do something safely.',

          cognitiveResult:
            null
        }),
      /cognitive result/i
    );
  }
);

test(
  'authority-bearing AI output is denied recursively',
  () => {
    const forbiddenCases = [
      {
        command:
          'rm -rf x'
      },

      {
        nested: {
          authorizeExecution:
            true
        }
      },

      {
        proposal: {
          grantEvaluation: {}
        }
      },

      {
        operation: {
          rawIdentityAssertion: {}
        }
      },

      {
        mutation: {
          mutationProvider: {}
        }
      },

      {
        privileged: {
          approvalAuthority: {}
        }
      },

      {
        nested: [
          {
            shell:
              '/bin/sh'
          }
        ]
      }
    ];

    for (
      const output
      of forbiddenCases
    ) {
      assert.throws(
        () =>
          createGovernedCognitiveProposal({
            humanIntent:
              'Produce evidence only.',

            cognitiveResult:
              result({
                output:
                  deepFreeze(output)
              })
          }),
        /operational authority field/i
      );
    }
  }
);

test(
  'proposal exposes no operational authority',
  () => {
    const proposal =
      createGovernedCognitiveProposal({
        humanIntent:
          'Produce a bounded proposal.',

        cognitiveResult:
          result()
      });

    for (const field of [
      'execution',
      'authorizeExecution',
      'grant',
      'grantEvaluation',
      'capabilityGrant',
      'approvalAuthority',
      'rawIdentityAssertion',
      'identityVerification',
      'mutationProvider',
      'compareAndReplace',
      'command',
      'args',
      'executable',
      'shell',
      'spawn',
      'exec',
      'write',
      'patch',
      'sign',
      'privateKey'
    ]) {
      assert.equal(
        Object.prototype
          .hasOwnProperty
          .call(
            proposal,
            field
          ),
        false,
        `${field} must not cross cognitive proposal boundary`
      );
    }
  }
);

test(
  'proposal creation has no orchestrator mutation shell network or provider dependency',
  () => {
    const source =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/core/governed-cognitive-proposal'
        ),
        'utf8'
      );

    for (const forbidden of [
      'surgical-orchestrator',
      'production-mutation-runtime',
      'mutation-provider',
      'filesystem-patch-adapter',
      'child_process',
      'node:http',
      'node:https',
      'fetch(',
      'ollama',
      'codex',
      'openai',
      'process.env'
    ]) {
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

test(
  'human intent is mandatory and cannot be replaced by model output',
  () => {
    assert.throws(
      () =>
        createGovernedCognitiveProposal({
          humanIntent:
            '',

          cognitiveResult:
            result()
        }),
      /human intent/i
    );

    const proposal =
      createGovernedCognitiveProposal({
        humanIntent:
          'Human-authored objective.',

        cognitiveResult:
          result({
            output:
              deepFreeze({
                summary:
                  'Model suggestion.'
              })
          })
      });

    assert.equal(
      proposal.humanIntent,
      'Human-authored objective.'
    );

    assert.equal(
      proposal.proposal.summary,
      'Model suggestion.'
    );
  }
);
