'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const {
  providerBoundary
} = require(
  '../../accelerator/core/content-addressed-mutation-provider'
);

const {
  projectQualifiedWorkspaceCasEvidence,
  describeQualifiedWorkspaceCasProjection
} = require(
  '../../accelerator/reconstruction/v3/adapters/' +
  'qualified-workspace-cas-projection'
);

function digest(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

function git(repo, args) {
  return cp.execFileSync(
    'git',
    ['-C', repo, ...args],
    { encoding: 'utf8' }
  ).trim();
}

function fixture(t) {
  const repo = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdo-r3-2-')
  );

  git(repo, ['init', '-b', 'main']);
  git(repo, [
    'config',
    'user.email',
    'r3@example.invalid'
  ]);
  git(repo, [
    'config',
    'user.name',
    'R3 Projection'
  ]);

  const target =
    path.join(repo, 'target.txt');

  fs.writeFileSync(target, 'before\n');
  git(repo, ['add', 'target.txt']);
  git(repo, ['commit', '-m', 'baseline']);

  t.after(() => {
    fs.rmSync(repo, {
      recursive: true,
      force: true
    });
  });

  return Object.freeze({
    repo: fs.realpathSync(repo),
    target: fs.realpathSync(target)
  });
}

function request(repo, target) {
  const replacement = 'after\n';

  return Object.freeze({
    schema:
      'sdo.compare_and_replace_request.v1',
    operation:
      'COMPARE_AND_REPLACE',
    phase:
      'AUTHORIZED_PATCH',
    transactionId:
      digest('r3.2-transaction'),
    operationId:
      'r3.2-operation',
    workspace:
      repo,
    target,
    beforeSha256:
      digest('before\n'),
    replacementSha256:
      digest(replacement),
    replacementBase64:
      Buffer.from(replacement).toString('base64'),
    commitAuthorityFingerprint:
      digest('r3.2-commit-authority')
  });
}

test(
  'R3.2 exposes immutable zero-authority projection metadata',
  () => {
    const description =
      describeQualifiedWorkspaceCasProjection();

    assert.equal(
      description.defaultDecision,
      'DENIED'
    );
    assert.equal(
      description.sourceProviderId,
      'sdo:git-manifest-cas-v1'
    );
    assert.equal(
      description.requiredOperation,
      'COMPARE_AND_REPLACE'
    );

    for (const key of [
      'filesystemAuthority',
      'gitAuthority',
      'processAuthority',
      'shellAuthority',
      'providerSelectionAuthority',
      'providerQualificationAuthority',
      'mutationAuthority',
      'productionConsumerMigrated'
    ]) {
      assert.equal(description[key], false);
    }

    assert.ok(Object.isFrozen(description));
  }
);

test(
  'R3.2 projects one real qualified production CAS result',
  (t) => {
    const { repo, target } = fixture(t);
    const inputRequest = request(repo, target);

    const providerResult =
      providerBoundary.compareAndReplace(
        inputRequest
      );

    const first =
      projectQualifiedWorkspaceCasEvidence({
        request:
          inputRequest,
        result:
          providerResult
      });

    const second =
      projectQualifiedWorkspaceCasEvidence({
        request:
          inputRequest,
        result:
          providerResult
      });

    assert.equal(first.decision, 'ALLOWED');
    assert.deepEqual(second, first);
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.binding));

    assert.equal(
      first.binding.physicalRoot,
      repo
    );
    assert.equal(
      first.binding.physicalTarget,
      target
    );
    assert.equal(
      first.binding.providerId,
      'sdo:git-manifest-cas-v1'
    );
    assert.equal(
      first.binding.replacementSha256,
      inputRequest.replacementSha256
    );
    assert.equal(
      first.binding.afterManifestOid,
      providerResult.durability
        .authority.afterManifestOid
    );
    assert.equal(
      first.binding
        .ordinaryWorktreeAuthoritative,
      false
    );

    assert.equal(
      fs.readFileSync(target, 'utf8'),
      'before\n'
    );
  }
);

test(
  'R3.2 rejects stale and non-applied provider results',
  (t) => {
    const { repo, target } = fixture(t);
    const inputRequest = request(repo, target);

    const applied =
      providerBoundary.compareAndReplace(
        inputRequest
      );

    const stale =
      providerBoundary.compareAndReplace(
        inputRequest
      );

    assert.equal(applied.outcome, 'APPLIED');
    assert.equal(stale.outcome, 'MISMATCH');

    const projected =
      projectQualifiedWorkspaceCasEvidence({
        request:
          inputRequest,
        result:
          stale
      });

    assert.equal(projected.decision, 'DENIED');
    assert.equal(projected.binding, null);
  }
);

test(
  'R3.2 rejects mutable cloned production evidence',
  (t) => {
    const { repo, target } = fixture(t);
    const inputRequest = request(repo, target);

    const providerResult =
      providerBoundary.compareAndReplace(
        inputRequest
      );

    const clone = {
      ...providerResult
    };

    const projected =
      projectQualifiedWorkspaceCasEvidence({
        request:
          inputRequest,
        result:
          clone
      });

    assert.equal(projected.decision, 'DENIED');
    assert.equal(projected.binding, null);
  }
);

test(
  'R3.2 rejects request and result substitution',
  (t) => {
    const { repo, target } = fixture(t);
    const inputRequest = request(repo, target);

    const providerResult =
      providerBoundary.compareAndReplace(
        inputRequest
      );

    const substitutedRequest =
      Object.freeze({
        ...inputRequest,
        transactionId:
          digest('substituted-transaction')
      });

    const projected =
      projectQualifiedWorkspaceCasEvidence({
        request:
          substitutedRequest,
        result:
          providerResult
      });

    assert.equal(projected.decision, 'DENIED');
    assert.equal(projected.binding, null);
  }
);

test(
  'R3.2 rejects malformed extra and incomplete input',
  () => {
    for (const input of [
      null,
      {},
      {
        request: null,
        result: null
      },
      {
        request: null,
        result: null,
        provider: providerBoundary
      }
    ]) {
      const projected =
        projectQualifiedWorkspaceCasEvidence(
          input
        );

      assert.equal(
        projected.decision,
        'DENIED'
      );
      assert.equal(projected.binding, null);
      assert.ok(Object.isFrozen(projected));
    }
  }
);

test(
  'R3.2 projection invokes no filesystem Git process shell or mutation',
  () => {
    const source = fs.readFileSync(
      require.resolve(
        '../../accelerator/reconstruction/v3/adapters/' +
        'qualified-workspace-cas-projection'
      ),
      'utf8'
    );

    assert.doesNotMatch(
      source,
      /require\(['"](?:node:)?(?:fs|path|child_process)/
    );
    assert.doesNotMatch(
      source,
      /providerBoundary\.compareAndReplace\s*\(/
    );
    assert.doesNotMatch(
      source,
      /\b(?:spawn|exec|writeFile|rename|unlink)\s*\(/
    );
  }
);
