'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  createNaturalDevelopmentTaskContract,
  evaluateNaturalDevelopmentTaskBoundary
} = require(
  '../../accelerator/cli/natural-development-task-contract'
);

const identity = crypto
  .createHash('sha256')
  .update('physical-workspace')
  .digest('hex');

const head =
  '114bee4e3c4117b4f76cfde7eede4c1746c6765d';

function contract(overrides = {}) {
  return createNaturalDevelopmentTaskContract({
    objective: 'Improve the governed NATURAL development loop.',
    physicalWorkspaceIdentity: identity,
    repositoryHead: head,
    allowedTargets: [
      'accelerator/cli/natural-development-task-contract.js',
      'tests/accelerator/natural-development-task-contract.test.js'
    ],
    ...overrides
  });
}

function step(overrides = {}) {
  return Object.freeze({
    physicalWorkspaceIdentity: identity,
    repositoryHead: head,
    target:
      'accelerator/cli/natural-development-task-contract.js',
    risk: 'R3',
    validationKind: 'VALIDATE_JS',
    evidenceStep: 1,
    patchAttempt: 0,
    mutating: false,
    credentialUse: false,
    externalSideEffect: false,
    architecturalDecision: false,
    genericShell: false,
    conflictOrRecoveryRequired: false,
    ...overrides
  });
}

test(
  'G1 materializes one immutable authority-free development contract',
  () => {
    const value = contract();

    assert.equal(Object.isFrozen(value), true);
    assert.equal(Object.isFrozen(value.allowedTargets), true);
    assert.equal(value.operationalAuthority, false);
    assert.equal(value.mutationAuthority, false);
    assert.equal(value.approvalAuthority, false);
    assert.equal(value.dispatchAuthority, false);
    assert.equal(value.reusableApproval, false);
    assert.match(value.contractFingerprint, /^[a-f0-9]{64}$/);
  }
);

test(
  'equivalent target order produces one canonical fingerprint',
  () => {
    const first = contract();
    const second = contract({
      allowedTargets: [...first.allowedTargets].reverse()
    });

    assert.equal(
      first.contractFingerprint,
      second.contractFingerprint
    );
  }
);

test(
  'contract fingerprint or nested immutability substitution fails closed',
  () => {
    const value = contract();

    assert.throws(
      () => evaluateNaturalDevelopmentTaskBoundary(
        Object.freeze({
          ...value,
          contractFingerprint: '0'.repeat(64)
        }),
        step()
      ),
      /binding is malformed/i
    );

    assert.throws(
      () => evaluateNaturalDevelopmentTaskBoundary(
        Object.freeze({
          ...value,
          allowedTargets: [...value.allowedTargets]
        }),
        step()
      ),
      /binding is malformed/i
    );
  }
);

test(
  'absolute traversal duplicate and non-canonical targets fail closed',
  () => {
    for (const allowedTargets of [
      ['/etc/passwd'],
      ['../package.json'],
      ['a.js', 'a.js'],
      ['folder\\file.js'],
      ['folder//file.js']
    ]) {
      assert.throws(
        () => contract({ allowedTargets }),
        /target|duplicate|scope/i
      );
    }
  }
);

test(
  'unqualified validation and malformed physical anchors fail closed',
  () => {
    assert.throws(
      () => contract({ validationKinds: ['npm test'] }),
      /not qualified/i
    );
    assert.throws(
      () => contract({ physicalWorkspaceIdentity: 'workspace' }),
      /SHA-256/i
    );
    assert.throws(
      () => contract({ repositoryHead: 'main' }),
      /HEAD is malformed/i
    );
  }
);

test(
  'bounded read and mutation proposal remain contained without gaining authority',
  () => {
    const value = contract();

    for (const candidate of [
      step(),
      step({ mutating: true, patchAttempt: 1 })
    ]) {
      const result =
        evaluateNaturalDevelopmentTaskBoundary(
          value,
          candidate
        );

      assert.equal(result.decision, 'CONTAINED');
      assert.equal(result.operationalAuthority, false);
      assert.equal(result.mutationAuthority, false);
      assert.equal(result.dispatchAuthority, false);
      assert.equal(
        result.requiresExactR3Authority,
        candidate.mutating
      );
    }
  }
);

test(
  'workspace target head risk and authority expansion stop explicitly',
  () => {
    const value = contract();
    const expansions = [
      [
        { physicalWorkspaceIdentity: '0'.repeat(64) },
        'WORKSPACE_EXPANSION'
      ],
      [{ target: 'package.json' }, 'TARGET_EXPANSION'],
      [{ repositoryHead: '0'.repeat(40) }, 'EVIDENCE_STALE'],
      [
        { risk: 'R3' },
        'RISK_EXPANSION',
        contract({ riskCeiling: 'R2' })
      ],
      [{ credentialUse: true }, 'CREDENTIAL_REQUIRED'],
      [{ externalSideEffect: true }, 'EXTERNAL_SIDE_EFFECT'],
      [{ architecturalDecision: true }, 'ARCHITECTURAL_DECISION'],
      [{ genericShell: true }, 'UNQUALIFIED_VALIDATION'],
      [{ validationKind: 'npm test' }, 'UNQUALIFIED_VALIDATION'],
      [
        {
          target:
            'docs/adr/ADR-028-natural-governed-development-execution-loop.md',
          validationKind: 'VALIDATE_JS'
        },
        'UNQUALIFIED_VALIDATION',
        contract({
          allowedTargets: [
            'accelerator/cli/natural-development-task-contract.js',
            'docs/adr/ADR-028-natural-governed-development-execution-loop.md'
          ]
        })
      ],
      [{ mutating: true, risk: 'R2' }, 'RISK_EXPANSION']
    ];

    for (const [override, condition, active = value] of expansions) {
      const result = evaluateNaturalDevelopmentTaskBoundary(
        active,
        step(override)
      );

      assert.equal(result.decision, 'STOPPED');
      assert.equal(result.stopCondition, condition);
      assert.equal(result.dispatchAuthority, false);
    }
  }
);

test(
  'step attempt conflict and recovery bounds fail closed',
  () => {
    const value = contract({
      evidenceStepCeiling: 2,
      patchAttemptCeiling: 1
    });
    const expansions = [
      [{ evidenceStep: 3 }, 'STEP_BOUND_REACHED'],
      [{ patchAttempt: 2 }, 'PATCH_ATTEMPT_BOUND_REACHED'],
      [
        { conflictOrRecoveryRequired: true },
        'CONFLICT_OR_RECOVERY_REQUIRED'
      ]
    ];

    for (const [override, condition] of expansions) {
      const result = evaluateNaturalDevelopmentTaskBoundary(
        value,
        step(override)
      );

      assert.equal(result.decision, 'STOPPED');
      assert.equal(result.stopCondition, condition);
    }
  }
);

test(
  'G1 exports no execution approval grant filesystem or shell surface',
  () => {
    const api = require(
      '../../accelerator/cli/natural-development-task-contract'
    );

    assert.deepEqual(
      Object.keys(api)
        .filter((key) => typeof api[key] === 'function')
        .sort(),
      [
        'createNaturalDevelopmentTaskContract',
        'evaluateNaturalDevelopmentTaskBoundary'
      ]
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
  'ADR-028 publishes reciprocal English and Portuguese frozen decisions',
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

    assert.match(
      english,
      /ADR-028-natural-governed-development-execution-loop_PT-BR\.md/
    );
    assert.match(
      portuguese,
      /ADR-028-natural-governed-development-execution-loop\.md/
    );

    for (const fact of [
      'sdo.natural_development_task_contract.v1',
      'VALIDATE_JS',
      'R3',
      'v2.6.0-rc.2'
    ]) {
      assert.match(english, new RegExp(fact));
      assert.match(portuguese, new RegExp(fact));
    }
  }
);
