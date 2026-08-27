'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const {
  CONTRACT_SCHEMA,
  describeAuthorityBindingContract,
  evaluateAuthorityBinding
} =
  require(
    '../../accelerator/reconstruction/v3/core/authority-binding-contract'
  );

const A =
  'a'.repeat(64);
const B =
  'b'.repeat(64);
const C =
  'c'.repeat(64);
const D =
  'd'.repeat(64);

function evidence() {
  return {
    identity: {
      decision:
        'VERIFIED',
      subjectId:
        'human-1',
      operationId:
        'operation-r2',
      workspace:
        '/qualified/workspace',
      tenantId:
        'tenant-1',
      projectId:
        'project-1',
      assertionFingerprint:
        A,
      verificationEvidenceFingerprint:
        B
    },
    approval: {
      decision:
        'ALLOWED',
      approverId:
        'human-1',
      operationId:
        'operation-r2',
      workspace:
        '/qualified/workspace',
      tenantId:
        'tenant-1',
      projectId:
        'project-1',
      riskLevel:
        'R3',
      policyDecision:
        'APPROVAL_REQUIRED',
      capabilityType:
        'FILESYSTEM_PATCH',
      action:
        'PATCH_FILE',
      scopeFingerprint:
        C,
      assertionFingerprint:
        A,
      approvalAuthorityFingerprint:
        D
    },
    grant: {
      decision:
        'ALLOWED',
      subjectId:
        'human-1',
      operationId:
        'operation-r2',
      workspace:
        '/qualified/workspace',
      tenantId:
        'tenant-1',
      projectId:
        'project-1',
      riskLevel:
        'R3',
      policyDecision:
        'ALLOWED',
      underlyingPolicyDecision:
        'APPROVAL_REQUIRED',
      capabilityType:
        'FILESYSTEM_PATCH',
      action:
        'PATCH_FILE',
      scopeFingerprint:
        C,
      assertionFingerprint:
        A,
      verificationEvidenceFingerprint:
        B,
      approvalAuthorityFingerprint:
        D
    }
  };
}

test(
  'R2.1 exposes one immutable provider-neutral human authority chain',
  () => {
    const description =
      describeAuthorityBindingContract();

    assert.equal(
      description.schema,
      CONTRACT_SCHEMA
    );

    assert.deepEqual(
      description.authorityStages,
      [
        'VERIFIED_HUMAN_IDENTITY',
        'R3_APPROVAL_AUTHORITY',
        'CAPABILITY_GRANT'
      ]
    );

    assert.equal(
      description.authenticationImpliesAuthorization,
      false
    );

    assert.equal(
      description.providerSpecific,
      false
    );

    assert.deepEqual(
      description.cognitiveAuthority,
      {
        identity: false,
        approval: false,
        grant: false,
        operational: false,
        mutation: false
      }
    );

    assert.equal(
      Object.isFrozen(description),
      true
    );

    assert.equal(
      Object.isFrozen(
        description.cognitiveAuthority
      ),
      true
    );
  }
);

test(
  'R2.1 allows only an exact complete verified human authority binding',
  () => {
    const result =
      evaluateAuthorityBinding(
        evidence()
      );

    assert.equal(
      result.decision,
      'ALLOWED'
    );

    assert.equal(
      result.binding.subjectId,
      'human-1'
    );

    assert.equal(
      result.binding.riskLevel,
      'R3'
    );

    assert.equal(
      Object.isFrozen(result),
      true
    );

    assert.equal(
      Object.isFrozen(result.binding),
      true
    );

    assert.equal(
      Object.isFrozen(result.binding.stages),
      true
    );
  }
);

test(
  'R2.1 authentication alone never becomes authorization',
  () => {
    const input =
      evidence();

    delete input.approval;
    delete input.grant;

    const result =
      evaluateAuthorityBinding(input);

    assert.equal(
      result.decision,
      'DENIED'
    );

    assert.equal(
      result.binding,
      null
    );
  }
);

test(
  'R2.1 fails closed for every authority-chain binding mismatch',
  () => {
    const cases = [
      ['identity', 'subjectId', 'human-2'],
      ['approval', 'approverId', 'human-2'],
      ['grant', 'subjectId', 'human-2'],
      ['approval', 'operationId', 'operation-other'],
      ['grant', 'workspace', '/other/workspace'],
      ['grant', 'tenantId', 'tenant-2'],
      ['approval', 'projectId', 'project-2'],
      ['approval', 'assertionFingerprint', B],
      ['grant', 'assertionFingerprint', B],
      ['grant', 'verificationEvidenceFingerprint', C],
      ['grant', 'approvalAuthorityFingerprint', A],
      ['grant', 'capabilityType', 'GIT_READ'],
      ['grant', 'action', 'READ_FILE'],
      ['grant', 'scopeFingerprint', D]
    ];

    for (const [
      stage,
      field,
      value
    ] of cases) {
      const input =
        evidence();

      input[stage][field] =
        value;

      const result =
        evaluateAuthorityBinding(input);

      assert.equal(
        result.decision,
        'DENIED',
        stage + '.' + field
      );

      assert.equal(
        result.binding,
        null,
        stage + '.' + field
      );
    }
  }
);

test(
  'R2.1 rejects boolean approval extra authority and malformed evidence',
  () => {
    const booleanApproval =
      evidence();

    booleanApproval.approval =
      true;

    assert.equal(
      evaluateAuthorityBinding(
        booleanApproval
      ).decision,
      'DENIED'
    );

    const extraAuthority =
      evidence();

    extraAuthority.providerAuthority =
      true;

    assert.equal(
      evaluateAuthorityBinding(
        extraAuthority
      ).decision,
      'DENIED'
    );

    const mutableShape =
      evidence();

    mutableShape.grant.shellAuthority =
      true;

    assert.equal(
      evaluateAuthorityBinding(
        mutableShape
      ).decision,
      'DENIED'
    );

    assert.equal(
      evaluateAuthorityBinding(
        null
      ).decision,
      'DENIED'
    );
  }
);

test(
  'R2.1 result is deterministic and introduces no operational authority',
  () => {
    assert.deepEqual(
      evaluateAuthorityBinding(
        evidence()
      ),
      evaluateAuthorityBinding(
        evidence()
      )
    );

    const source =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/reconstruction/v3/core/authority-binding-contract'
        ),
        'utf8'
      );

    assert.doesNotMatch(
      source,
      /child_process|node:crypto|node:fs|node:path|node:net|node:http|node:https|writeFile|readFile|unlink|rename|exec|spawn|privateKey|publicKey|signature/
    );

    assert.deepEqual(
      Object.keys(
        require(
          '../../accelerator/reconstruction/v3/core/authority-binding-contract'
        )
      ).sort(),
      [
        'CONTRACT_SCHEMA',
        'describeAuthorityBindingContract',
        'evaluateAuthorityBinding'
      ]
    );
  }
);
