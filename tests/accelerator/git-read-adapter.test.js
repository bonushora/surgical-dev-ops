'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { evaluateCapabilityGrant } = require('../../accelerator/core/capability-grant');
const {
  createGitPlatformIsolation,
  readGitWithGrant
} = require('../../accelerator/adapters/git-read-adapter');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-git-adapter-'));
const workspace = path.join(root, 'repo');
const nonRepository = path.join(root, 'plain');
fs.mkdirSync(workspace);
fs.mkdirSync(nonRepository);

function git(args) {
  return childProcess.execFileSync('git', args, {
    cwd: workspace, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

git(['init', '-b', 'main']);
git(['config', 'user.email', 'sdo-test@example.invalid']);
git(['config', 'user.name', 'Surgical DevOps Test']);
fs.writeFileSync(path.join(workspace, 'tracked.txt'), 'tracked\n');
git(['add', 'tracked.txt']);
git(['commit', '-m', 'fixture baseline']);
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

const NOW = '2026-08-20T12:00:00.000Z';
const EXPIRY = '2026-08-20T13:00:00.000Z';
const OPERATIONS = ['rev-parse', 'status', 'ls-files'];

function issue(targetWorkspace = workspace, operations = OPERATIONS) {
  const common = {
    operationId: 'op-1', workspace: targetWorkspace, policyDecision: 'ALLOWED',
    riskLevel: 'R0', lifecycleState: 'PENDING', capabilityType: 'GIT_READ',
    scope: { operations }, idempotency: 'IDEMPOTENT'
  };
  return evaluateCapabilityGrant(
    { ...common, expiresAt: EXPIRY },
    { ...common, evaluatedAt: NOW }
  );
}

function read(selector, overrides = {}) {
  return readGitWithGrant({
    operationId: 'op-1', workspace, selector,
    grantEvaluation: issue(), observedAt: NOW, ...overrides
  });
}

test('valid repository-root read', () => {
  assert.equal(read('REPOSITORY_ROOT').result, fs.realpathSync(workspace));
});

test('valid current-branch read', () => {
  assert.equal(read('CURRENT_BRANCH').result, 'main');
});

test('valid HEAD read', () => {
  assert.match(read('HEAD_COMMIT').result, /^[0-9a-f]{40}$/);
});

test('valid worktree-status read', () => {
  fs.writeFileSync(path.join(workspace, 'untracked.txt'), 'untracked\n');
  assert.ok(read('WORKTREE_STATUS').result.some((entry) => entry.includes('untracked.txt')));
});

test('missing grant fails closed', () => {
  assert.throws(() => read('HEAD_COMMIT', { grantEvaluation: undefined }), /valid immutable ALLOWED/);
});

test('expired grant fails closed', () => {
  assert.throws(() => read('HEAD_COMMIT', { observedAt: EXPIRY }), /expired/);
});

test('operation mismatch fails closed', () => {
  assert.throws(() => read('HEAD_COMMIT', { operationId: 'op-2' }), /operationId mismatch/);
});

test('workspace mismatch fails closed', () => {
  assert.throws(() => read('HEAD_COMMIT', { workspace: nonRepository }), /workspace mismatch/);
});

test('unknown selector fails closed', () => {
  assert.throws(() => read('UNKNOWN'), /Unknown or forbidden/);
});

test('arbitrary argument injection attempt fails closed', () => {
  assert.throws(
    () => readGitWithGrant({
      operationId: 'op-1', workspace, selector: 'HEAD_COMMIT',
      grantEvaluation: issue(), observedAt: NOW, args: ['push', 'origin']
    }),
    /arguments, options or environment are forbidden/
  );
});

test('non-repository workspace fails closed', () => {
  assert.throws(
    () => read('HEAD_COMMIT', {
      workspace: nonRepository,
      grantEvaluation: issue(nonRepository)
    }),
    /not a supported local Git repository/
  );
});

test('mutation selector is rejected', () => {
  assert.throws(() => read('COMMIT'), /Unknown or forbidden/);
});

test('network and remote selector is rejected', () => {
  assert.throws(() => read('REMOTE'), /Unknown or forbidden/);
});

test('timeout fails closed', (context) => {
  context.mock.method(childProcess, 'spawnSync', () => ({
    error: Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
  }));
  assert.throws(() => read('HEAD_COMMIT'), /timed out/);
});

test('output overflow fails closed', (context) => {
  context.mock.method(childProcess, 'spawnSync', () => ({
    error: Object.assign(new Error('overflow'), { code: 'ENOBUFS' })
  }));
  assert.throws(() => read('HEAD_COMMIT'), /exceeded output limit/);
});

test('nonzero exit fails closed', (context) => {
  context.mock.method(childProcess, 'spawnSync', () => ({
    status: 128, signal: null, stdout: '', stderr: 'fatal'
  }));
  assert.throws(() => read('HEAD_COMMIT'), /nonzero exit status/);
});

test('returned Git evidence is deeply immutable', () => {
  const result = read('HEAD_COMMIT');
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.execution));
  assert.ok(Object.isFrozen(result.execution.arguments));
  assert.throws(() => { result.selector = 'REMOTE'; }, TypeError);
});

test('Git is invoked directly without a shell', (context) => {
  let invocation;
  context.mock.method(childProcess, 'spawnSync', (executable, args, options) => {
    invocation = { executable, args, options };
    return { status: 0, signal: null, stdout: `${git(['rev-parse', 'HEAD'])}\n`, stderr: '' };
  });
  read('HEAD_COMMIT');
  assert.equal(invocation.executable, 'git');
  assert.equal(invocation.options.shell, false);
  assert.ok(invocation.args.includes('credential.helper='));
});

test('credential-bearing, token, SSH, ANSI and multiline Git output never escapes', (context) => {
  for (const secret of [
    'https://user:password@host/repo.git',
    'https://token@host/repo.git',
    'ssh://user@host/repo.git',
    '\u001b[31mSECRET\u001b[0m',
    'safe\nINJECTED'
  ]) {
    context.mock.method(childProcess, 'spawnSync', () => ({
      status: 0, signal: null, stdout: `${secret}\n`, stderr: ''
    }));
    assert.throws(() => read('HEAD_COMMIT'), (error) =>
      /malformed/.test(error.message) && !error.message.includes(secret));
    context.mock.restoreAll();
  }
});

test('stderr secrets, unavailable Git and forged execution inputs fail closed without disclosure', (context) => {
  context.mock.method(childProcess, 'spawnSync', () => ({
    status: 1, signal: null, stdout: '', stderr: 'TOKEN=super-secret'
  }));
  assert.throws(() => read('HEAD_COMMIT'), (error) =>
    /nonzero|stderr/.test(error.message) && !error.message.includes('super-secret'));
  context.mock.restoreAll();
  context.mock.method(childProcess, 'spawnSync', () => ({
    error: Object.assign(new Error('TOKEN=super-secret'), { code: 'ENOENT' })
  }));
  assert.throws(() => read('HEAD_COMMIT'), (error) =>
    /process failed closed/.test(error.message) && !error.message.includes('super-secret'));
  context.mock.restoreAll();
  assert.throws(() => readGitWithGrant({ operationId: 'op-1', workspace, selector: 'HEAD_COMMIT',
    grantEvaluation: issue(), observedAt: NOW, executable: 'sh', argv: ['push'],
    env: { GIT_DIR: '/escape' } }), /arguments, options or environment/);
});

test('CURRENT_BRANCH fails closed for detached HEAD', (context) => {
  context.mock.method(
    childProcess,
    'spawnSync',
    () => ({
      status: 0,
      signal: null,
      stdout: 'HEAD\n',
      stderr: ''
    })
  );

  assert.throws(
    () => read('CURRENT_BRANCH'),
    /detached HEAD state/
  );
});

test(
  'fsmonitor isolation never names an auxiliary executable',
  () => {
    const isolation =
      createGitPlatformIsolation('linux');

    assert.ok(
      isolation.fixedConfig.includes(
        'core.fsmonitor='
      )
    );

    assert.equal(
      isolation.fixedConfig.includes(
        'core.fsmonitor=false'
      ),
      false
    );
  }
);
