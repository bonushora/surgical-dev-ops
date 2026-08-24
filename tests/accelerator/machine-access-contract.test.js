'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const {
  createMachineAccessRequest,
  createMachineAccessAuthority,
  createMachineAccessOperation,
  createMachineAccessEvidence,
  createMachineAccessResult
} = require(
  '../../accelerator/core/machine-access-contract'
);

const WORKSPACE =
  process.cwd();

const NOW =
  '2026-08-24T06:00:00.000Z';

const EXPIRY =
  '2026-08-24T06:05:00.000Z';

function freeze(value) {
  if (
    value &&
    typeof value === 'object' &&
    !Object.isFrozen(value)
  ) {
    for (
      const child
      of Object.values(value)
    ) {
      freeze(child);
    }

    Object.freeze(value);
  }

  return value;
}

function request(
  operationType = 'READ_FILE',
  target = 'package.json'
) {
  return createMachineAccessRequest({
    requestId:
      'request-1',
    operationId:
      'operation-1',
    workspace:
      WORKSPACE,
    operationType,
    target,
    purpose:
      'Collect bounded evidence.',
    requestedAt:
      NOW
  });
}

function grantFor(
  candidate
) {
  const grant =
    freeze({
      operationId:
        candidate.operationId,
      workspace:
        candidate.workspace,
      capabilityType:
        candidate.capabilityType,
      action:
        candidate.action,
      riskLevel:
        candidate.riskLevel,
      policyDecision:
        'ALLOWED',
      lifecycleState:
        'PENDING',
      fingerprint:
        'a'.repeat(64)
    });

  return freeze({
    schema:
      'sdo.capability_grant_evaluation.v1',
    decision:
      'ALLOWED',
    grant
  });
}

function authorityFor(
  candidate
) {
  return createMachineAccessAuthority({
    authorityId:
      'authority-1',
    request:
      candidate,
    grantEvaluation:
      grantFor(candidate),
    issuedAt:
      NOW,
    expiresAt:
      EXPIRY
  });
}

test(
  'machine access request is deterministic and deeply immutable',
  () => {
    const first =
      request();

    const second =
      request();

    assert.deepEqual(
      first,
      second
    );

    assert.equal(
      Object.isFrozen(first),
      true
    );

    assert.match(
      first.fingerprint,
      /^[a-f0-9]{64}$/
    );
  }
);

test(
  'closed vocabulary binds each operation to one capability and action',
  () => {
    const cases = [
      [
        'LIST_DIRECTORY',
        null,
        'GIT_READ',
        'WORKSPACE_FILES'
      ],
      [
        'READ_FILE',
        'package.json',
        'FILESYSTEM_READ',
        'READ_FILE'
      ],
      [
        'GIT_STATUS',
        null,
        'GIT_READ',
        'WORKTREE_STATUS'
      ],
      [
        'GIT_DIFF',
        null,
        'GIT_READ',
        'WORKTREE_DIFF'
      ],
      [
        'RUN_FIXED_VALIDATION',
        'package.json',
        'PROCESS_VALIDATION',
        'NODE_SYNTAX_CHECK'
      ]
    ];

    for (
      const [
        operationType,
        target,
        capabilityType,
        action
      ]
      of cases
    ) {
      const candidate =
        request(
          operationType,
          target
        );

      assert.equal(
        candidate.capabilityType,
        capabilityType
      );

      assert.equal(
        candidate.action,
        action
      );
    }
  }
);

test(
  'unknown operation and broadened targets fail closed',
  () => {
    assert.throws(
      () =>
        request(
          'SHELL',
          null
        ),
      /unsupported/
    );

    assert.throws(
      () =>
        request(
          'READ_FILE',
          '../secret'
        ),
      /canonical relative/
    );

    assert.throws(
      () =>
        request(
          'GIT_STATUS',
          'package.json'
        ),
      /must be null/
    );
  }
);

test(
  'natural language request cannot mint machine authority',
  () => {
    const candidate =
      request();

    assert.equal(
      'authority' in candidate,
      false
    );

    assert.equal(
      'dispatch' in candidate,
      false
    );

    assert.equal(
      'execute' in candidate,
      false
    );
  }
);

test(
  'machine authority requires an existing frozen allowed capability grant',
  () => {
    const candidate =
      request();

    assert.throws(
      () =>
        createMachineAccessAuthority({
          authorityId:
            'authority-1',
          request:
            candidate,
          grantEvaluation:
            {
              schema:
                'sdo.capability_grant_evaluation.v1',
              decision:
                'ALLOWED',
              grant: {}
            },
          issuedAt:
            NOW,
          expiresAt:
            EXPIRY
        }),
      /frozen allowed/
    );
  }
);

test(
  'grant substitution cannot authorize a different capability',
  () => {
    const candidate =
      request();

    const evaluation =
      grantFor(candidate);

    const substituted =
      freeze({
        ...evaluation,
        grant:
          freeze({
            ...evaluation.grant,
            capabilityType:
              'FILESYSTEM_PATCH'
          })
      });

    assert.throws(
      () =>
        createMachineAccessAuthority({
          authorityId:
            'authority-1',
          request:
            candidate,
          grantEvaluation:
            substituted,
          issuedAt:
            NOW,
          expiresAt:
            EXPIRY
        }),
      /does not match/
    );
  }
);

test(
  'operation is exactly request and authority bound',
  () => {
    const candidate =
      request();

    const authority =
      authorityFor(candidate);

    const operation =
      createMachineAccessOperation({
        request:
          candidate,
        authority
      });

    assert.equal(
      operation.requestFingerprint,
      candidate.fingerprint
    );

    assert.equal(
      operation.authorityFingerprint,
      authority.fingerprint
    );

    assert.equal(
      Object.isFrozen(operation),
      true
    );
  }
);

test(
  'adapter evidence must be frozen and context bound',
  () => {
    const candidate =
      request();

    const operation =
      createMachineAccessOperation({
        request:
          candidate,
        authority:
          authorityFor(candidate)
      });

    assert.throws(
      () =>
        createMachineAccessEvidence({
          operation,
          adapterEvidence: {
            schema:
              'sdo.filesystem_read_result.v1',
            operationId:
              operation.operationId,
            workspace:
              operation.workspace
          }
        }),
      /must be frozen/
    );

    assert.throws(
      () =>
        createMachineAccessEvidence({
          operation,
          adapterEvidence:
            freeze({
              schema:
                'sdo.filesystem_read_result.v1',
              operationId:
                'different',
              workspace:
                operation.workspace
            })
        }),
      /context mismatch/
    );
  }
);

test(
  'completed result requires exact bound evidence',
  () => {
    const candidate =
      request();

    const operation =
      createMachineAccessOperation({
        request:
          candidate,
        authority:
          authorityFor(candidate)
      });

    const evidence =
      createMachineAccessEvidence({
        operation,
        adapterEvidence:
          freeze({
            schema:
              'sdo.filesystem_read_result.v1',
            operationId:
              operation.operationId,
            workspace:
              operation.workspace,
            content:
              'bounded'
          })
      });

    const result =
      createMachineAccessResult({
        operation,
        status:
          'COMPLETED',
        evidence
      });

    assert.equal(
      result.status,
      'COMPLETED'
    );

    assert.equal(
      Object.isFrozen(result),
      true
    );

    assert.throws(
      () =>
        createMachineAccessResult({
          operation,
          status:
            'COMPLETED',
          evidence: null
        }),
      /requires bound evidence/
    );
  }
);

test(
  'failure is explicit and cannot carry success evidence',
  () => {
    const candidate =
      request();

    const operation =
      createMachineAccessOperation({
        request:
          candidate,
        authority:
          authorityFor(candidate)
      });

    const result =
      createMachineAccessResult({
        operation,
        status:
          'FAILED',
        reason:
          'Adapter unavailable.'
      });

    assert.equal(
      result.evidence,
      null
    );

    assert.equal(
      result.reason,
      'Adapter unavailable.'
    );
  }
);

test(
  'contract source exposes no filesystem process network shell or mutation authority',
  () => {
    const source =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/core/machine-access-contract'
        ),
        'utf8'
      );

    assert.doesNotMatch(
      source,
      /child_process|spawn|execFile|execSync|shell:\s*true/
    );

    assert.doesNotMatch(
      source,
      /writeFile|appendFile|rmSync|unlink|rename|fetch\(|http|https|net\./
    );

    assert.deepEqual(
      Object.keys(
        require(
          '../../accelerator/core/machine-access-contract'
        )
      ),
      [
        'createMachineAccessRequest',
        'createMachineAccessAuthority',
        'createMachineAccessOperation',
        'createMachineAccessEvidence',
        'createMachineAccessResult'
      ]
    );
  }
);
