'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');
const {
  createGitFlowAuthorization,
  classifyGitFlowRisk,
  createGitFlowEvidenceIdentity,
  canReuseGitFlowEvidence
} = require('../../accelerator/core/git-flow-contract');
const {
  createGovernedGitFlowRunner
} = require('../../accelerator/adapters/governed-git-flow-runner');

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-git-flow-')));
  const repository = path.join(root, 'repository');
  const remote = path.join(root, 'remote.git');
  fs.mkdirSync(repository);
  git(repository, ['init', '-b', 'main']);
  git(repository, ['config', 'user.name', 'Git Flow Test']);
  git(repository, ['config', 'user.email', 'git-flow@surgical.invalid']);
  fs.writeFileSync(path.join(repository, 'authorized.txt'), 'baseline\n');
  git(repository, ['add', 'authorized.txt']);
  git(repository, ['commit', '-m', 'baseline']);
  git(root, ['init', '--bare', remote]);
  git(repository, ['remote', 'add', 'origin', remote]);
  git(repository, ['push', '-u', 'origin', 'main']);
  const baseline = git(repository, ['rev-parse', 'HEAD']);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, repository: fs.realpathSync(repository), remote, baseline };
}

function authorization(fx, overrides = {}) {
  const authorityOverrides = overrides.authorities || {};
  return createGitFlowAuthorization({
    authorizationId: overrides.authorizationId || `test-${crypto.randomUUID()}`,
    objective: 'Commit and publish one explicitly selected fixture file.',
    workspace: fx.repository,
    environment: overrides.environment || 'localhost',
    risk: overrides.risk || 'MÉDIO',
    authorizedFiles: overrides.authorizedFiles || ['authorized.txt'],
    validation: overrides.validation || [
      [process.execPath, '-e', 'process.exit(0)'],
      [process.execPath, '-e', 'process.exit(0)']
    ],
    remote: {
      name: 'origin',
      url: overrides.remoteUrl || fx.remote,
      branch: overrides.branch || 'main',
      expectedSha: overrides.expectedRemoteSha || fx.baseline
    },
    expectedHead: overrides.expectedHead || fx.baseline,
    authorities: {
      COMMIT_AUTHORIZED: authorityOverrides.COMMIT_AUTHORIZED ?? true,
      PUSH_AUTHORIZED: authorityOverrides.PUSH_AUTHORIZED ?? true,
      DISCLOSURE_AUTHORIZED: authorityOverrides.DISCLOSURE_AUTHORIZED ?? true
    }
  });
}

function commitChange(fx, auth = authorization(fx)) {
  fs.writeFileSync(path.join(fx.repository, 'authorized.txt'), 'authorized change\n');
  return createGovernedGitFlowRunner().commit({
    authorization: auth,
    message: 'test(git-flow): authorized change'
  });
}

test('risk classification is proportional for BAIXO, MÉDIO and ALTO', () => {
  assert.equal(classifyGitFlowRisk({ operation: 'OBSERVE' }).risk, 'BAIXO');
  assert.equal(classifyGitFlowRisk({ operation: 'COMMIT' }).risk, 'MÉDIO');
  assert.equal(classifyGitFlowRisk({ operation: 'PUSH', environment: 'Production' }).risk, 'ALTO');
});

test('authorized commit selects only declared files and protected push confirms remote readback', (t) => {
  const fx = fixture(t);
  fs.writeFileSync(path.join(fx.repository, 'preexisting-untracked.txt'), 'preserve me\n');
  const auth = authorization(fx);
  const committed = commitChange(fx, auth);
  assert.equal(committed.state, 'GREEN');
  assert.equal(committed.phase, 'COMMIT');
  assert.deepEqual(committed.changedPaths, ['authorized.txt']);
  assert.equal(git(fx.repository, ['show', '--format=', '--name-only', committed.commitSha]), 'authorized.txt');
  assert.equal(fs.readFileSync(path.join(fx.repository, 'preexisting-untracked.txt'), 'utf8'), 'preserve me\n');
  assert.match(git(fx.repository, ['status', '--porcelain']), /^\?\? preexisting-untracked\.txt$/m);

  const published = createGovernedGitFlowRunner().push({
    authorization: auth,
    commitSha: committed.commitSha
  });
  assert.equal(published.state, 'GREEN');
  assert.equal(published.phase, 'PUBLISHED');
  assert.equal(published.observedRemoteSha, committed.commitSha);
  assert.equal(git(fx.root, ['--git-dir', fx.remote, 'rev-parse', 'refs/heads/main']), committed.commitSha);
  assert.equal(published.report.remote.observedSha, committed.commitSha);
});

test('commit without COMMIT_AUTHORIZED fails closed before staging', (t) => {
  const fx = fixture(t);
  fs.writeFileSync(path.join(fx.repository, 'authorized.txt'), 'change\n');
  const auth = authorization(fx, { authorities: { COMMIT_AUTHORIZED: false } });
  const observed = createGovernedGitFlowRunner().commit({ authorization: auth, message: 'blocked' });
  assert.equal(observed.state, 'BLOCKED');
  assert.match(observed.reason, /COMMIT_AUTHORIZED/);
  assert.equal(git(fx.repository, ['diff', '--cached', '--name-only']), '');
  assert.equal(git(fx.repository, ['rev-parse', 'HEAD']), fx.baseline);
});

test('push requires independent PUSH_AUTHORIZED and DISCLOSURE_AUTHORIZED', (t) => {
  const fx = fixture(t);
  const commitAuth = authorization(fx);
  const committed = commitChange(fx, commitAuth);
  assert.equal(committed.state, 'GREEN');
  for (const authorities of [
    { PUSH_AUTHORIZED: false, DISCLOSURE_AUTHORIZED: true },
    { PUSH_AUTHORIZED: true, DISCLOSURE_AUTHORIZED: false }
  ]) {
    const auth = authorization(fx, { authorities });
    const observed = createGovernedGitFlowRunner().push({
      authorization: auth,
      commitSha: committed.commitSha
    });
    assert.equal(observed.state, 'BLOCKED');
    assert.match(observed.reason, /AUTHORIZED/);
  }
  assert.equal(git(fx.root, ['--git-dir', fx.remote, 'rev-parse', 'refs/heads/main']), fx.baseline);
});

test('preexisting unauthorized staging is preserved and blocks commit', (t) => {
  const fx = fixture(t);
  fs.writeFileSync(path.join(fx.repository, 'unrelated.txt'), 'unrelated\n');
  git(fx.repository, ['add', 'unrelated.txt']);
  fs.writeFileSync(path.join(fx.repository, 'authorized.txt'), 'change\n');
  const observed = createGovernedGitFlowRunner().commit({
    authorization: authorization(fx),
    message: 'blocked scope'
  });
  assert.equal(observed.state, 'BLOCKED');
  assert.deepEqual(observed.stagedPaths, ['unrelated.txt']);
  assert.equal(git(fx.repository, ['diff', '--cached', '--name-only']), 'unrelated.txt');
  assert.equal(git(fx.repository, ['rev-parse', 'HEAD']), fx.baseline);
});

test('remote CAS divergence blocks normal push without rewriting history', (t) => {
  const fx = fixture(t);
  const auth = authorization(fx);
  const committed = commitChange(fx, auth);
  assert.equal(committed.state, 'GREEN');

  const competitor = path.join(fx.root, 'competitor');
  git(fx.root, ['clone', '-b', 'main', fx.remote, competitor]);
  git(competitor, ['config', 'user.name', 'Competitor']);
  git(competitor, ['config', 'user.email', 'competitor@surgical.invalid']);
  fs.writeFileSync(path.join(competitor, 'competitor.txt'), 'concurrent\n');
  git(competitor, ['add', 'competitor.txt']);
  git(competitor, ['commit', '-m', 'concurrent advance']);
  git(competitor, ['push', 'origin', 'main']);
  const concurrentSha = git(competitor, ['rev-parse', 'HEAD']);

  const observed = createGovernedGitFlowRunner().push({
    authorization: auth,
    commitSha: committed.commitSha
  });
  assert.equal(observed.state, 'BLOCKED');
  assert.match(observed.reason, /CAS mismatch/);
  assert.equal(observed.observedRemoteSha, concurrentSha);
  assert.equal(git(fx.root, ['--git-dir', fx.remote, 'rev-parse', 'refs/heads/main']), concurrentSha);
});

test('push independently rejects a commit containing an unauthorized file', (t) => {
  const fx = fixture(t);
  fs.writeFileSync(path.join(fx.repository, 'outside-scope.txt'), 'outside\n');
  git(fx.repository, ['add', 'outside-scope.txt']);
  git(fx.repository, ['commit', '-m', 'unauthorized local commit']);
  const commitSha = git(fx.repository, ['rev-parse', 'HEAD']);
  const observed = createGovernedGitFlowRunner().push({
    authorization: authorization(fx),
    commitSha
  });
  assert.equal(observed.state, 'BLOCKED');
  assert.match(observed.reason, /single authorized fast-forward commit/);
  assert.deepEqual(observed.changedPaths, ['outside-scope.txt']);
  assert.equal(git(fx.root, ['--git-dir', fx.remote, 'rev-parse', 'refs/heads/main']), fx.baseline);
});

test('push independently rejects a credential pattern in a manually created commit', (t) => {
  const fx = fixture(t);
  fs.writeFileSync(
    path.join(fx.repository, 'authorized.txt'),
    ['auth', 'token=not-a-real-token-value\n'].join('_')
  );
  git(fx.repository, ['add', 'authorized.txt']);
  git(fx.repository, ['commit', '-m', 'unsafe local commit']);
  const commitSha = git(fx.repository, ['rev-parse', 'HEAD']);
  const observed = createGovernedGitFlowRunner().push({
    authorization: authorization(fx),
    commitSha
  });
  assert.equal(observed.state, 'BLOCKED');
  assert.match(observed.reason, /Credential pattern/);
  assert.equal(git(fx.root, ['--git-dir', fx.remote, 'rev-parse', 'refs/heads/main']), fx.baseline);
});

test('wrong remote URL or branch identity is rejected before mutation', (t) => {
  const fx = fixture(t);
  const runner = createGovernedGitFlowRunner();
  const wrongUrl = runner.inspect(authorization(fx, { remoteUrl: `${fx.remote}-other` }));
  assert.equal(wrongUrl.state, 'BLOCKED');
  assert.match(wrongUrl.reason, /remote URL/i);
  const wrongBranch = runner.inspect(authorization(fx, { branch: 'release' }));
  assert.equal(wrongBranch.state, 'BLOCKED');
  assert.match(wrongBranch.reason, /branch/i);
});

test('credential pattern in selected staged content blocks commit and recovers index', (t) => {
  const fx = fixture(t);
  fs.writeFileSync(
    path.join(fx.repository, 'authorized.txt'),
    ['api', 'key=not-a-real-secret-value\n'].join('_')
  );
  const observed = createGovernedGitFlowRunner().commit({
    authorization: authorization(fx),
    message: 'must not commit secret'
  });
  assert.equal(observed.state, 'BLOCKED');
  assert.match(observed.reason, /Credential pattern/);
  assert.equal(observed.recovery.restored, true);
  assert.equal(git(fx.repository, ['diff', '--cached', '--name-only']), '');
  assert.equal(git(fx.repository, ['rev-parse', 'HEAD']), fx.baseline);
});

test('failing validation blocks commit and leaves working change recoverable', (t) => {
  const fx = fixture(t);
  fs.writeFileSync(path.join(fx.repository, 'authorized.txt'), 'change\n');
  const auth = authorization(fx, { validation: [
    [process.execPath, '-e', 'process.exit(0)'],
    [process.execPath, '-e', 'process.exit(7)']
  ] });
  const observed = createGovernedGitFlowRunner().commit({ authorization: auth, message: 'blocked tests' });
  assert.equal(observed.state, 'BLOCKED');
  assert.match(observed.reason, /validation failed/);
  assert.deepEqual(observed.validations.map((item) => item.state), ['GREEN', 'BLOCKED']);
  assert.equal(observed.recovery.restored, true);
  assert.equal(git(fx.repository, ['diff', '--cached', '--name-only']), '');
  assert.equal(fs.readFileSync(path.join(fx.repository, 'authorized.txt'), 'utf8'), 'change\n');
});

test('publication failure is read back, remains BLOCKED, and succeeds after recovery with fresh CAS', (t) => {
  const fx = fixture(t);
  const auth = authorization(fx);
  const committed = commitChange(fx, auth);
  assert.equal(committed.state, 'GREEN');
  const hook = path.join(fx.remote, 'hooks', 'pre-receive');
  fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n');
  fs.chmodSync(hook, 0o755);

  const runner = createGovernedGitFlowRunner();
  const failed = runner.push({ authorization: auth, commitSha: committed.commitSha });
  assert.equal(failed.state, 'BLOCKED');
  assert.match(failed.reason, /Push failed/);
  assert.equal(failed.observedRemoteSha, fx.baseline);
  assert.equal(failed.recovery.retryAllowedOnlyAfterFreshCas, true);

  fs.rmSync(hook);
  const recovered = runner.push({ authorization: auth, commitSha: committed.commitSha });
  assert.equal(recovered.state, 'GREEN');
  assert.equal(recovered.observedRemoteSha, committed.commitSha);
});

test('evidence reuse requires exact workspace, environment, HEAD, remote identity and validation', (t) => {
  const fx = fixture(t);
  const base = {
    workspace: fx.repository,
    environment: 'localhost',
    head: fx.baseline,
    remote: { url: fx.remote, branch: 'main', sha: fx.baseline },
    authorizedFiles: ['authorized.txt'],
    validationFingerprint: 'a'.repeat(64)
  };
  const evidence = createGitFlowEvidenceIdentity(base);
  assert.match(evidence.evidenceFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(canReuseGitFlowEvidence(base, { ...base }), true);
  assert.equal(canReuseGitFlowEvidence(base, { ...base, environment: 'Preview' }), false);
  assert.equal(canReuseGitFlowEvidence(base, { ...base, head: 'b'.repeat(40) }), false);
  assert.equal(canReuseGitFlowEvidence(base, {
    ...base,
    remote: { ...base.remote, sha: 'c'.repeat(40) }
  }), false);
  assert.equal(canReuseGitFlowEvidence(base, { ...base, validationFingerprint: 'd'.repeat(64) }), false);
});

test('BH-SDP snapshot distinguishes code, operation and publication GREEN', (t) => {
  const fx = fixture(t);
  const auth = authorization(fx);
  const committed = commitChange(fx, auth);
  const published = createGovernedGitFlowRunner().push({
    authorization: auth,
    commitSha: committed.commitSha
  });
  const snapshot = createGovernedGitFlowRunner().snapshot({
    authorization: auth,
    result: published,
    components: ['contract', 'runner', 'remote readback'],
    gates: 2
  });
  assert.equal(snapshot.versao_do_protocolo, 'BH-SDP v2.3');
  assert.equal(snapshot.estado_green.codigo, 'PASSOU');
  assert.equal(snapshot.estado_green.operacao, 'PASSOU');
  assert.equal(snapshot.estado_green.publicacao, 'PASSOU');
  assert.equal(snapshot.destino_fisico.sha_depois, committed.commitSha);
  assert.equal(snapshot.contagem_de_gates, 2);
});
