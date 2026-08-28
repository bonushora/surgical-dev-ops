'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  createNaturalDevelopmentTaskContract
} = require(
  '../../accelerator/cli/natural-development-task-contract'
);

const {
  materializeGovernedEngineeringProposal
} = require(
  '../../accelerator/core/governed-engineering-proposal'
);

const {
  materializeNaturalDevelopmentPatchProposal
} = require(
  '../../accelerator/cli/natural-development-patch-proposal'
);

const identity = crypto
  .createHash('sha256')
  .update('g3-physical-workspace')
  .digest('hex');

const head =
  '114bee4e3c4117b4f76cfde7eede4c1746c6765d';

const objective =
  'Correct one exact JavaScript target from governed evidence.';

const target =
  'accelerator/example.js';

const beforeContent =
  "'use strict';\nmodule.exports = 1;\n";

const afterContent =
  "'use strict';\nmodule.exports = 2;\n";

const sha = (value) => crypto
  .createHash('sha256')
  .update(value)
  .digest('hex');

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

function contract(overrides = {}) {
  return createNaturalDevelopmentTaskContract({
    objective,
    physicalWorkspaceIdentity: identity,
    repositoryHead: head,
    allowedTargets: [target],
    patchAttemptCeiling: 2,
    ...overrides
  });
}

function planning(activeContract = contract(), overrides = {}) {
  const binding = deepFreeze({
    schema: 'sdo.natural_development_planning_loop.v1',
    status: 'COMPLETED',
    contractFingerprint:
      activeContract.contractFingerprint,
    analysis: {
      status: 'COMPLETED'
    },
    evidence: [
      {
        schema: 'sdo.natural_recursive_evidence.v1',
        kind: 'READ_FILE',
        target,
        sha256: sha(beforeContent),
        bytes: Buffer.byteLength(beforeContent),
        summary: beforeContent
      }
    ],
    response: 'An exact correction can be proposed.',
    reason: null,
    pendingRequest: null,
    requiresNewHumanAuthority: false,
    reusableApproval: false,
    operationalAuthority: false,
    mutationAuthority: false,
    approvalAuthority: false,
    dispatchAuthority: false,
    ...overrides
  });

  return deepFreeze({
    ...binding,
    planningFingerprint:
      sha(JSON.stringify(binding))
  });
}

function proposal(overrides = {}) {
  return materializeGovernedEngineeringProposal({
    schema: 'sdo.ai_engineering_patch_proposal.v1',
    objective,
    target,
    beforeSha256: sha(beforeContent),
    replacementBase64:
      Buffer.from(afterContent).toString('base64'),
    reason: 'Replace one observed value.',
    validationKind: 'VALIDATE_JS',
    ...overrides
  });
}

test(
  'G3 binds one exact immutable patch and diff to G1 and G2 evidence',
  () => {
    const activeContract = contract();
    const result =
      materializeNaturalDevelopmentPatchProposal({
        contract: activeContract,
        planningResult: planning(activeContract),
        governedProposal: proposal(),
        patchAttempt: 1
      });

    assert.equal(
      result.contractFingerprint,
      activeContract.contractFingerprint
    );
    assert.equal(result.target, target);
    assert.equal(result.beforeSha256, sha(beforeContent));
    assert.equal(result.replacementSha256, sha(afterContent));
    assert.equal(
      result.exactDiff.representation,
      'FULL_FILE_REPLACEMENT'
    );
    assert.equal(result.exactDiff.before.bytes, 34);
    assert.equal(result.exactDiff.after.bytes, 34);
    assert.match(result.planningFingerprint, /^[a-f0-9]{64}$/);
    assert.match(result.proposalFingerprint, /^[a-f0-9]{64}$/);
    assert.match(result.exactDiff.diffFingerprint, /^[a-f0-9]{64}$/);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.exactDiff.before), true);
  }
);

test(
  'G3 remains human-review-only with zero operational authority',
  () => {
    const activeContract = contract();
    const result = materializeNaturalDevelopmentPatchProposal({
      contract: activeContract,
      planningResult: planning(activeContract),
      governedProposal: proposal()
    });

    assert.equal(result.state, 'HUMAN_REVIEW_REQUIRED');
    assert.equal(result.requiresExactR3Authority, true);
    assert.equal(result.reusableApproval, false);
    assert.equal(result.operationalAuthority, false);
    assert.equal(result.mutationAuthority, false);
    assert.equal(result.approvalAuthority, false);
    assert.equal(result.dispatchAuthority, false);
  }
);

test(
  'objective target BEFORE and contract substitution fail closed',
  () => {
    const activeContract = contract();
    const cases = [
      proposal({ objective: 'Different objective.' }),
      proposal({ target: 'tests/example.test.js' }),
      proposal({ beforeSha256: 'b'.repeat(64) })
    ];

    for (const governedProposal of cases) {
      assert.throws(
        () => materializeNaturalDevelopmentPatchProposal({
          contract: activeContract,
          planningResult: planning(activeContract),
          governedProposal
        }),
        /objective|BEFORE|contract/i
      );
    }

    assert.throws(
      () => materializeNaturalDevelopmentPatchProposal({
        contract: activeContract,
        planningResult: planning(activeContract, {
          contractFingerprint: '0'.repeat(64)
        }),
        governedProposal: proposal()
      }),
      /G2 planning result/i
    );
  }
);

test(
  'failed mutable or authority-bearing G2 and proposal evidence is rejected',
  () => {
    const activeContract = contract();

    for (const invalidPlanning of [
      planning(activeContract, { status: 'FAILED' }),
      { ...planning(activeContract) }
    ]) {
      assert.throws(
        () => materializeNaturalDevelopmentPatchProposal({
          contract: activeContract,
          planningResult: invalidPlanning,
          governedProposal: proposal()
        }),
        /G2 planning result/i
      );
    }

    const governedProposal = proposal();
    assert.throws(
      () => materializeNaturalDevelopmentPatchProposal({
        contract: activeContract,
        planningResult: planning(activeContract),
        governedProposal: Object.freeze({
          ...governedProposal,
          mutationAuthority: true
        })
      }),
      /authority-free/i
    );
  }
);

test(
  'no-op replacement and patch-attempt overflow fail closed',
  () => {
    const activeContract = contract();

    assert.throws(
      () => materializeNaturalDevelopmentPatchProposal({
        contract: activeContract,
        planningResult: planning(activeContract),
        governedProposal: proposal({
          replacementBase64:
            Buffer.from(beforeContent).toString('base64')
        })
      }),
      /No-op replacement/i
    );

    assert.throws(
      () => materializeNaturalDevelopmentPatchProposal({
        contract: activeContract,
        planningResult: planning(activeContract),
        governedProposal: proposal(),
        patchAttempt: 3
      }),
      /exceeds the development contract/i
    );
  }
);

test(
  'exact diff fingerprints are deterministic and content-sensitive',
  () => {
    const activeContract = contract();
    const input = {
      contract: activeContract,
      planningResult: planning(activeContract),
      governedProposal: proposal()
    };
    const first =
      materializeNaturalDevelopmentPatchProposal(input);
    const second =
      materializeNaturalDevelopmentPatchProposal(input);
    const changed =
      materializeNaturalDevelopmentPatchProposal({
        ...input,
        governedProposal: proposal({
          replacementBase64:
            Buffer.from(
              "'use strict';\nmodule.exports = 3;\n"
            ).toString('base64')
        })
      });

    assert.equal(
      first.proposalFingerprint,
      second.proposalFingerprint
    );
    assert.notEqual(
      first.exactDiff.diffFingerprint,
      changed.exactDiff.diffFingerprint
    );
  }
);

test(
  'G3 exports only authority-free proposal materialization',
  () => {
    const api = require(
      '../../accelerator/cli/natural-development-patch-proposal'
    );

    assert.deepEqual(
      Object.keys(api)
        .filter((key) => typeof api[key] === 'function'),
      ['materializeNaturalDevelopmentPatchProposal']
    );

    for (const forbidden of [
      'dispatch',
      'execute',
      'authorize',
      'approve',
      'grant',
      'shell',
      'filesystem'
    ]) {
      assert.equal(
        Object.keys(api).some(
          (key) => key.toLowerCase().includes(forbidden)
        ),
        false
      );
    }
  }
);

test(
  'ADR-028 preserves equivalent English and Portuguese G3 claims',
  () => {
    const root = path.resolve(__dirname, '../..');
    const english = fs.readFileSync(
      path.join(
        root,
        'docs/adr/ADR-028-natural-governed-development-execution-loop.md'
      ),
      'utf8'
    );
    const portuguese = fs.readFileSync(
      path.join(
        root,
        'docs/adr/ADR-028-natural-governed-development-execution-loop_PT-BR.md'
      ),
      'utf8'
    );

    for (const fact of [
      'sdo.natural_development_patch_proposal.v1',
      'sdo.natural_development_exact_diff.v1',
      'FULL_FILE_REPLACEMENT',
      'HUMAN_REVIEW_REQUIRED'
    ]) {
      assert.match(english, new RegExp(fact));
      assert.match(portuguese, new RegExp(fact));
    }
  }
);
