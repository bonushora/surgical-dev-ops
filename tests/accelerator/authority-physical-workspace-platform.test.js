'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  canonicalizeAuthorizedRoot
} = require('../../accelerator/core/workspace-boundary');

const {
  evaluateVerifiedHumanIdentityAssertion
} = require('../../accelerator/core/human-identity-assertion');

const {
  evaluateR3ApprovalAuthority
} = require('../../accelerator/core/risk-classification');

const {
  evaluateCapabilityGrant
} = require('../../accelerator/core/capability-grant');

const {
  createOperationRecord
} = require('../../accelerator/core/operation-record');

const ISSUED = '2026-08-20T11:55:00.000Z';
const CREATED = '2026-08-20T11:59:00.000Z';
const EXPIRY = '2026-08-20T13:00:00.000Z';

function fixture(t) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdo-authority-alias-')
  );

  const physical = path.join(root, 'physical');
  const alias = path.join(root, 'alias');

  fs.mkdirSync(physical);

  try {
    fs.symlinkSync(
      physical,
      alias,
      process.platform === 'win32' ? 'junction' : 'dir'
    );
  } catch (error) {
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }

  const canonicalPhysical =
    canonicalizeAuthorizedRoot(physical);

  const canonicalAlias =
    canonicalizeAuthorizedRoot(alias);

  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  return {
    root,
    physical,
    alias,
    canonicalPhysical,
    canonicalAlias
  };
}

function assertion(workspace) {
  return {
    schema: 'sdo.verified_human_identity_assertion.v1',
    verification: 'VERIFIED',
    assertionId: 'assertion-physical-alias',
    subject: {
      id: 'human-1',
      type: 'HUMAN'
    },
    issuer: 'issuer:test',
    authentication: {
      method: 'PASSKEY',
      context: 'MFA'
    },
    issuedAt: ISSUED,
    expiresAt: EXPIRY,
    audience: ['surgical-devops'],
    operationId: 'op-physical-alias',
    workspace,
    tenantId: 'tenant-1',
    projectId: 'project-1',
    revocationStatus: 'NOT_REVOKED',
    verifiedAt: CREATED
  };
}

test(
  'filesystem evidence converges lexical alias and physical workspace',
  (t) => {
    const {
      alias,
      physical,
      canonicalAlias,
      canonicalPhysical
    } = fixture(t);

    assert.notEqual(alias, physical);

    assert.equal(
      canonicalAlias,
      canonicalPhysical
    );
  }
);

test(
  'human identity materializes physical workspace before fingerprinting',
  (t) => {
    const {
      alias,
      canonicalPhysical
    } = fixture(t);

    const evaluation =
      evaluateVerifiedHumanIdentityAssertion(
        assertion(alias)
      );

    assert.equal(
      evaluation.decision,
      'VERIFIED'
    );

    assert.equal(
      evaluation.assertion.workspace,
      canonicalPhysical
    );
  }
);

test(
  'R3 approval materializes the same physical workspace identity',
  (t) => {
    const {
      alias,
      canonicalPhysical
    } = fixture(t);

    const identity =
      evaluateVerifiedHumanIdentityAssertion(
        assertion(alias)
      );

    assert.equal(
      identity.decision,
      'VERIFIED'
    );

    const scope = {
      target: {
        path: 'target.js',
        beforeSha256: 'a'.repeat(64),
        replacementSha256: 'b'.repeat(64)
      }
    };

    const approval =
      evaluateR3ApprovalAuthority({
        approvalAuthorityId: 'approval-r3-alias',
        operationId: 'op-physical-alias',
        approver: {
          id: 'human-1',
          type: 'HUMAN'
        },
        decision: 'APPROVED',
        riskLevel: 'R3',
        capabilityType: 'FILESYSTEM_PATCH',
        action: 'PATCH_FILE',
        workspace: alias,
        scope,
        tenantId: 'tenant-1',
        projectId: 'project-1',
        verifiedIdentityAssertion: identity.assertion,
        policyDecision: 'APPROVAL_REQUIRED',
        timestamp: CREATED,
        expiresAt: EXPIRY
      });

    assert.equal(
      approval.decision,
      'ALLOWED'
    );

    assert.equal(
      approval.authority.workspace,
      canonicalPhysical
    );
  }
);

test(
  'non-R3 capability materializes physical workspace before grant fingerprinting',
  (t) => {
    const {
      alias,
      canonicalPhysical
    } = fixture(t);

    const common = {
      operationId: 'op-physical-alias',
      workspace: alias,
      policyDecision: 'ALLOWED',
      riskLevel: 'R1',
      lifecycleState: 'PENDING',
      capabilityType: 'GIT_READ',
      scope: {
        operations: ['rev-parse']
      },
      idempotency: 'IDEMPOTENT'
    };

    const evaluation =
      evaluateCapabilityGrant(
        {
          ...common,
          expiresAt: EXPIRY
        },
        {
          ...common,
          evaluatedAt: CREATED
        }
      );

    assert.equal(
      evaluation.decision,
      'ALLOWED'
    );

    assert.equal(
      evaluation.grant.workspace,
      canonicalPhysical
    );
  }
);

test(
  'operation record persists physical workspace rather than lexical alias',
  (t) => {
    const {
      alias,
      canonicalPhysical
    } = fixture(t);

    const evaluation =
      createOperationRecord({
        operationId: 'op-physical-alias',
        requester: {
          id: 'requester-1',
          type: 'HUMAN'
        },
        workspace: alias,
        objective: 'Prove physical workspace materialization.',
        policyDecision: 'ALLOWED',
        riskLevel: 'R1',
        idempotency: 'IDEMPOTENT',
        events: [
          {
            type: 'intent',
            operationId: 'op-physical-alias',
            timestamp: CREATED,
            objective:
              'Prove physical workspace materialization.'
          },
          {
            type: 'policy',
            operationId: 'op-physical-alias',
            timestamp: CREATED,
            policyDecision: 'ALLOWED',
            riskLevel: 'R1'
          },
          {
            type: 'state',
            operationId: 'op-physical-alias',
            timestamp: CREATED,
            status: 'PENDING'
          }
        ]
      });

    assert.equal(
      evaluation.decision,
      'ALLOWED'
    );

    assert.equal(
      evaluation.record.workspace,
      canonicalPhysical
    );
  }
);
