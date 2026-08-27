'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  projectQualifiedAuthority,
  scopeFingerprint
} = require(
  '../../accelerator/reconstruction/v3/adapters/' +
  'qualified-authority-projection'
);
const {
  evaluateR3ApprovalAuthority
} = require('../../accelerator/core/risk-classification');
const {
  evaluateCapabilityGrant
} = require('../../accelerator/core/capability-grant');
const {
  evaluateVerifiedHumanIdentityAssertion
} = require('../../accelerator/core/human-identity-assertion');
const {
  verifyHumanIdentityAssertion
} = require(
  '../../accelerator/adapters/identity-verification-adapter'
);
const {
  createAuthoritativeClock
} = require('../../accelerator/core/authoritative-clock');

const workspace = fs.mkdtempSync(
  path.join(os.tmpdir(), 'sdo-r2-projection-')
);
fs.writeFileSync(
  path.join(workspace, 'target.txt'),
  'before\n'
);

test.after(() => {
  fs.rmSync(workspace, {
    recursive: true,
    force: true
  });
});

function clock() {
  return createAuthoritativeClock({
    port: {
      read: () => ({
        schema: 'sdo.system_clock_observation.v1',
        availability: 'AVAILABLE',
        source: 'TEST',
        wallTime: '2026-08-20T12:00:00.000Z',
        monotonicNanoseconds: '1000000000'
      })
    }
  });
}

function qualifiedChain() {
  const expectedIdentity = {
    subjectId: 'human-1',
    audience: 'surgical-devops',
    operationId: 'op-r2',
    workspace,
    tenantId: 'tenant-1',
    projectId: 'project-1'
  };

  const assertion =
    evaluateVerifiedHumanIdentityAssertion({
      schema:
        'sdo.verified_human_identity_assertion.v1',
      verification: 'VERIFIED',
      assertionId: 'assertion-r2',
      subject: {
        id: 'human-1',
        type: 'HUMAN'
      },
      issuer: 'issuer:test',
      authentication: {
        method: 'PASSKEY',
        context: 'MFA'
      },
      issuedAt: '2026-08-20T11:55:00.000Z',
      expiresAt: '2026-08-20T13:00:00.000Z',
      audience: ['surgical-devops'],
      operationId: 'op-r2',
      workspace,
      tenantId: 'tenant-1',
      projectId: 'project-1',
      revocationStatus: 'NOT_REVOKED',
      verifiedAt: '2026-08-20T11:59:00.000Z'
    }).assertion;

  const approvalScope = {
    target: {
      path: 'target.txt',
      beforeSha256: crypto
        .createHash('sha256')
        .update('before\n')
        .digest('hex'),
      replacementSha256: crypto
        .createHash('sha256')
        .update('after\n')
        .digest('hex')
    }
  };

  const approval =
    evaluateR3ApprovalAuthority({
      approvalAuthorityId: 'approval-r2',
      operationId: 'op-r2',
      approver: {
        id: 'human-1',
        type: 'HUMAN'
      },
      decision: 'APPROVED',
      riskLevel: 'R3',
      capabilityType: 'FILESYSTEM_PATCH',
      action: 'PATCH_FILE',
      workspace,
      tenantId: 'tenant-1',
      projectId: 'project-1',
      verifiedIdentityAssertion: assertion,
      scope: approvalScope,
      policyDecision: 'APPROVAL_REQUIRED',
      timestamp: '2026-08-20T12:00:00.000Z',
      expiresAt: '2026-08-20T13:00:00.000Z'
    }, {}, {
      reading: clock().read(),
      requireCurrent: true
    }).authority;

  const temporalAuthority = {
    reading: clock().read(),
    requireCurrent: true
  };

  const identityVerification =
    verifyHumanIdentityAssertion({
      rawAssertion: {
        token: 'test'
      },
      trustedIssuers: ['issuer:test'],
      expected: expectedIdentity
    }, {
      verify() {
        return {
          status: 'VERIFIED',
          assertion,
          verifierId: 'test-port'
        };
      }
    }, temporalAuthority);

  const request = {
    operationId: 'op-r2',
    workspace,
    policyDecision: 'APPROVAL_REQUIRED',
    riskLevel: 'R3',
    lifecycleState: 'PENDING',
    capabilityType: 'FILESYSTEM_PATCH',
    action: 'PATCH_FILE',
    scope: approvalScope,
    approvalAuthority: approval,
    identityVerification,
    tenantId: 'tenant-1',
    projectId: 'project-1',
    expiresAt: '2026-08-20T13:00:00.000Z',
    idempotency: 'IDEMPOTENT'
  };

  const authority = {
    ...request,
    evaluatedAt: '2026-08-20T12:00:00.000Z'
  };

  const capabilityGrantEvaluation =
    evaluateCapabilityGrant(
      request,
      authority,
      clock()
    );

  return {
    expectedIdentity,
    temporalAuthority,
    identityVerification,
    approvalAuthority: approval,
    capabilityGrantEvaluation
  };
}

test(
  'R2.2 projects the qualified production authority chain',
  () => {
    const result =
      projectQualifiedAuthority(qualifiedChain());

    assert.equal(
      result.decision,
      'ALLOWED',
      result.reason
    );
    assert.equal(result.binding.subjectId, 'human-1');
    assert.equal(result.binding.operationId, 'op-r2');
    assert.equal(
      result.binding.capabilityType,
      'FILESYSTEM_PATCH'
    );
    assert.equal(result.binding.action, 'PATCH_FILE');
    assert.ok(Object.isFrozen(result));
  }
);

test(
  'R2.2 rejects a grant changed after qualification',
  () => {
    const chain = qualifiedChain();
    chain.capabilityGrantEvaluation = {
      ...chain.capabilityGrantEvaluation,
      grant: {
        ...chain.capabilityGrantEvaluation.grant,
        operationId: 'op-substituted'
      }
    };

    assert.equal(
      projectQualifiedAuthority(chain).decision,
      'DENIED'
    );
  }
);

test(
  'R2.2 logical scope ignores only physical canonicalPath',
  () => {
    const logical = {
      target: {
        path: 'target.txt',
        beforeSha256: 'a',
        replacementSha256: 'b'
      }
    };
    const physical = {
      target: {
        replacementSha256: 'b',
        canonicalPath: '/physical/target.txt',
        beforeSha256: 'a',
        path: 'target.txt'
      }
    };

    assert.equal(
      scopeFingerprint(logical),
      scopeFingerprint(physical)
    );

    assert.notEqual(
      scopeFingerprint(logical),
      scopeFingerprint({
        target: {
          ...logical.target,
          path: 'other.txt'
        }
      })
    );
  }
);
