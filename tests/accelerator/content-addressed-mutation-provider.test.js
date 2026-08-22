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
} = require('../../accelerator/core/content-addressed-mutation-provider');

const {
  evaluateMutationProvider,
  validateMutationProviderResult
} = require('../../accelerator/core/mutation-provider');

const digest = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');

function git(repo, args) {
  return cp.execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8'
  }).trim();
}

function fixture(t) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-provider-g-'));

  git(repo, ['init', '-b', 'main']);
  git(repo, ['config', 'user.email', 'g@example.invalid']);
  git(repo, ['config', 'user.name', 'Provider G']);

  const target = path.join(repo, 'target.txt');
  fs.writeFileSync(target, 'before\n');

  git(repo, ['add', 'target.txt']);
  git(repo, ['commit', '-m', 'baseline']);

  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));

  return { repo: fs.realpathSync(repo), target: fs.realpathSync(target) };
}

function request(repo, target, replacement = 'after\n') {
  return Object.freeze({
    schema: 'sdo.compare_and_replace_request.v1',
    operation: 'COMPARE_AND_REPLACE',
    phase: 'AUTHORIZED_PATCH',
    transactionId: digest('transaction'),
    operationId: 'op-g',
    workspace: repo,
    target,
    beforeSha256: digest('before\n'),
    replacementSha256: digest(replacement),
    replacementBase64: Buffer.from(replacement).toString('base64'),
    commitAuthorityFingerprint: digest('commit-authority')
  });
}

test('production candidate is trusted QUALIFIED compare-and-replace authority', () => {
  const decision = evaluateMutationProvider(providerBoundary);

  assert.equal(decision.decision, 'ALLOWED');
  assert.equal(decision.qualificationState, 'QUALIFIED');
  assert.equal(decision.zeroDispatch, false);
  assert.equal(providerBoundary.qualification.providerId, 'sdo:git-manifest-cas-v1');
});

test('provider commits manifest authority and materializes managed generation', (t) => {
  const { repo, target } = fixture(t);
  const req = request(repo, target);

  const decision = evaluateMutationProvider(providerBoundary);
  const result = providerBoundary.compareAndReplace(req);

  validateMutationProviderResult(result, req, decision);

  assert.equal(result.outcome, 'APPLIED');
  assert.equal(result.durability.ordinaryWorktreeAuthoritative, false);
  assert.equal(fs.readFileSync(target, 'utf8'), 'before\n');

  const projection = result.durability.materialization.projection;

  assert.equal(fs.readFileSync(projection, 'utf8'), 'after\n');
});

test('stale repeated writer fails closed without redefining authority', (t) => {
  const { repo, target } = fixture(t);
  const req = request(repo, target);

  const first = providerBoundary.compareAndReplace(req);
  const stale = providerBoundary.compareAndReplace(req);

  assert.equal(first.outcome, 'APPLIED');
  assert.equal(stale.outcome, 'MISMATCH');
  assert.equal(fs.readFileSync(target, 'utf8'), 'before\n');
});

test('replacement hash mismatch fails before authoritative CAS', (t) => {
  const { repo, target } = fixture(t);

  const req = {
    ...request(repo, target),
    replacementSha256: digest('different\n')
  };

  const result = providerBoundary.compareAndReplace(req);

  assert.equal(result.outcome, 'FAILED_PRECOMMIT');
  assert.equal(fs.readFileSync(target, 'utf8'), 'before\n');
});

test('provider surface exposes no authority factory or generic command', () => {
  const surface = require(
    '../../accelerator/core/content-addressed-mutation-provider'
  );

  assert.deepEqual(Object.keys(surface), ['providerBoundary']);
  assert.equal(typeof surface.providerBoundary.compareAndReplace, 'function');

  const source = fs.readFileSync(
    require.resolve(
      '../../accelerator/core/content-addressed-mutation-provider'
    ),
    'utf8'
  );

  assert.doesNotMatch(source, /execSync|spawnSync|shell:\s*true/);
  assert.doesNotMatch(source, /git\s+push|git\s+reset|git\s+checkout/);
});
