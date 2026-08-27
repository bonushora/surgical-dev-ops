'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  describeWorkspaceCasBindingContract,
  evaluateWorkspaceCasBinding
} = require(
  '../../accelerator/reconstruction/v3/core/' +
  'workspace-cas-binding-contract'
);

const BEFORE_SHA =
  'a'.repeat(64);
const REPLACEMENT_SHA =
  'b'.repeat(64);
const BEFORE_OID =
  'c'.repeat(40);
const AFTER_OID =
  'd'.repeat(40);
const QUALIFICATION =
  'e'.repeat(64);

function evidence(overrides = {}) {
  const base = {
    workspace: {
      decision: 'RESOLVED',
      requestedRoot: '/requested/workspace',
      physicalRoot: '/physical/workspace',
      requestedTarget: 'target.txt',
      physicalTarget:
        '/physical/workspace/target.txt'
    },
    provider: {
      decision: 'ALLOWED',
      providerId:
        'sdo:git-manifest-cas-v1',
      qualificationFingerprint:
        QUALIFICATION,
      operation:
        'COMPARE_AND_REPLACE',
      ordinaryWorktreeAuthoritative:
        false
    },
    cas: {
      decision: 'APPLIED',
      beforeManifestOid:
        BEFORE_OID,
      afterManifestOid:
        AFTER_OID,
      beforeSha256:
        BEFORE_SHA,
      replacementSha256:
        REPLACEMENT_SHA
    },
    materialization: {
      decision: 'MATERIALIZED',
      expectedManifestOid:
        AFTER_OID,
      observedManifestOid:
        AFTER_OID,
      contentSha256:
        REPLACEMENT_SHA
    }
  };

  return {
    ...base,
    ...overrides
  };
}

test(
  'R3.1 exposes one immutable zero-authority contract',
  () => {
    const description =
      describeWorkspaceCasBindingContract();

    assert.equal(
      description.defaultDecision,
      'DENIED'
    );
    assert.equal(
      description.requiredOperation,
      'COMPARE_AND_REPLACE'
    );
    assert.equal(
      description.ordinaryWorktreeAuthoritative,
      false
    );

    for (const key of [
      'filesystemAuthority',
      'gitAuthority',
      'processAuthority',
      'shellAuthority',
      'mutationAuthority'
    ]) {
      assert.equal(description[key], false);
    }

    assert.ok(Object.isFrozen(description));
  }
);

test(
  'R3.1 accepts only one exact complete workspace/CAS chain',
  () => {
    const first =
      evaluateWorkspaceCasBinding(evidence());
    const second =
      evaluateWorkspaceCasBinding(evidence());

    assert.equal(first.decision, 'ALLOWED');
    assert.deepEqual(second, first);
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.binding));

    assert.equal(
      first.binding.physicalRoot,
      '/physical/workspace'
    );
    assert.equal(
      first.binding.afterManifestOid,
      AFTER_OID
    );
    assert.equal(
      first.binding.replacementSha256,
      REPLACEMENT_SHA
    );
    assert.equal(
      first.binding.ordinaryWorktreeAuthoritative,
      false
    );
  }
);

test(
  'R3.1 rejects every CAS to materialization mismatch',
  () => {
    for (const materialization of [
      {
        ...evidence().materialization,
        expectedManifestOid:
          'f'.repeat(40)
      },
      {
        ...evidence().materialization,
        observedManifestOid:
          'f'.repeat(40)
      },
      {
        ...evidence().materialization,
        contentSha256:
          'f'.repeat(64)
      }
    ]) {
      assert.equal(
        evaluateWorkspaceCasBinding({
          ...evidence(),
          materialization
        }).decision,
        'DENIED'
      );
    }
  }
);

test(
  'R3.1 rejects unqualified or semantically incomplete authority',
  () => {
    const candidates = [
      {
        ...evidence(),
        provider: {
          ...evidence().provider,
          decision: 'DENIED'
        }
      },
      {
        ...evidence(),
        provider: {
          ...evidence().provider,
          ordinaryWorktreeAuthoritative:
            true
        }
      },
      {
        ...evidence(),
        cas: {
          ...evidence().cas,
          decision: 'MISMATCH'
        }
      },
      {
        ...evidence(),
        cas: {
          ...evidence().cas,
          afterManifestOid:
            BEFORE_OID
        }
      },
      {
        ...evidence(),
        cas: {
          ...evidence().cas,
          replacementSha256:
            BEFORE_SHA
        }
      },
      {
        ...evidence(),
        materialization: {
          ...evidence().materialization,
          decision: 'FAILED'
        }
      }
    ];

    for (const candidate of candidates) {
      assert.equal(
        evaluateWorkspaceCasBinding(candidate)
          .decision,
        'DENIED'
      );
    }
  }
);

test(
  'R3.1 rejects missing extra and malformed evidence',
  () => {
    assert.equal(
      evaluateWorkspaceCasBinding(null).decision,
      'DENIED'
    );
    assert.equal(
      evaluateWorkspaceCasBinding({}).decision,
      'DENIED'
    );
    assert.equal(
      evaluateWorkspaceCasBinding({
        ...evidence(),
        extraAuthority: true
      }).decision,
      'DENIED'
    );
    assert.equal(
      evaluateWorkspaceCasBinding({
        ...evidence(),
        workspace: {
          ...evidence().workspace,
          unexpected: 'authority'
        }
      }).decision,
      'DENIED'
    );
  }
);

test(
  'R3.1 source imports no filesystem Git process shell or mutation authority',
  () => {
    const source = fs.readFileSync(
      require.resolve(
        '../../accelerator/reconstruction/v3/core/' +
        'workspace-cas-binding-contract'
      ),
      'utf8'
    );

    assert.doesNotMatch(
      source,
      /require\(['"](?:node:)?(?:fs|path|child_process)/
    );
    assert.doesNotMatch(
      source,
      /\b(?:spawn|exec|compareAndReplace)\s*\(/
    );
  }
);
