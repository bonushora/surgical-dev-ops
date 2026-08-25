'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  MAX_REPLACEMENT_BYTES,
  materializeGovernedEngineeringProposal
} = require(
  '../../accelerator/core/governed-engineering-proposal'
);

function hash(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

function candidate(overrides = {}) {
  const before =
    Buffer.from('module.exports = 1;\n');

  const replacement =
    Buffer.from('module.exports = 2;\n');

  return {
    schema:
      'sdo.ai_engineering_patch_proposal.v1',
    objective:
      'Atualizar o valor exportado.',
    target:
      'src/example.js',
    beforeSha256:
      hash(before),
    replacementBase64:
      replacement.toString('base64'),
    reason:
      'A alteração mínima satisfaz o objetivo.',
    validationKind:
      'VALIDATE_JS',
    ...overrides
  };
}

test(
  'untrusted AI patch becomes one bounded immutable proposal with zero authority',
  () => {
    const replacement =
      Buffer.from('module.exports = 2;\n');

    const proposal =
      materializeGovernedEngineeringProposal(
        candidate()
      );

    assert.equal(
      proposal.schema,
      'sdo.governed_engineering_proposal.v1'
    );
    assert.equal(
      proposal.target,
      'src/example.js'
    );
    assert.equal(
      proposal.replacementBytes,
      replacement.length
    );
    assert.equal(
      proposal.replacementSha256,
      hash(replacement)
    );
    assert.equal(
      proposal.operationalAuthority,
      false
    );
    assert.equal(
      proposal.mutationAuthority,
      false
    );
    assert.equal(
      proposal.approvalAuthority,
      false
    );
    assert.equal(
      Object.isFrozen(proposal),
      true
    );
  }
);

test(
  'proposal rejects traversal absolute noncanonical and multiline targets',
  () => {
    for (
      const target
      of [
        '../outside.js',
        '/tmp/outside.js',
        'C:\\outside.js',
        'src//example.js',
        'src/./example.js',
        'src/example.js\nother.js'
      ]
    ) {
      assert.throws(
        () =>
          materializeGovernedEngineeringProposal(
            candidate({ target })
          )
      );
    }
  }
);

test(
  'proposal rejects malformed hashes encodings oversized replacements and validation broadening',
  () => {
    const invalid = [
      {
        beforeSha256:
          '0'.repeat(63)
      },
      {
        replacementBase64:
          'not-base64'
      },
      {
        replacementBase64:
          Buffer
            .alloc(
              MAX_REPLACEMENT_BYTES + 1,
              1
            )
            .toString('base64')
      },
      {
        validationKind:
          'RUN_COMMAND'
      },
      {
        target:
          'README.md',
        validationKind:
          'VALIDATE_JS'
      }
    ];

    for (const override of invalid) {
      assert.throws(
        () =>
          materializeGovernedEngineeringProposal(
            candidate(override)
          )
      );
    }
  }
);

test(
  'proposal rejects extra authority fields instead of silently discarding them',
  () => {
    for (
      const extra
      of [
        { approved: true },
        { shell: 'bash' },
        { command: 'npm test' },
        { capabilityType: 'FILESYSTEM_PATCH' },
        { operationalAuthority: true }
      ]
    ) {
      assert.throws(
        () =>
          materializeGovernedEngineeringProposal(
            candidate(extra)
          ),
        /shape is not canonical/
      );
    }
  }
);

test(
  'proposal boundary has no filesystem process shell provider grant or mutation dependency',
  () => {
    const source =
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../accelerator/core/governed-engineering-proposal.js'
        ),
        'utf8'
      );

    assert.doesNotMatch(
      source,
      /require\(['"](?:node:fs|node:child_process|child_process|[^'"]*(?:provider|capability-grant|governed-patch-dispatch|surgical-orchestrator)[^'"]*)['"]\)/
    );
  }
);
