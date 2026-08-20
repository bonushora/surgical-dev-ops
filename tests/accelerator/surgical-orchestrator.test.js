'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const { execFileSync } = childProcess;
const repositoryDiscovery = require('../../accelerator/core/repository-discovery');
const declarativeInspection = require('../../accelerator/core/declarative-inspection');
const filesystemReadAdapter = require('../../accelerator/adapters/filesystem-read-adapter');
const gitReadAdapter = require('../../accelerator/adapters/git-read-adapter');
const processValidationAdapter = require('../../accelerator/adapters/process-validation-adapter');
const { evaluateCapabilityGrant } = require('../../accelerator/core/capability-grant');
const { createOperationRecord } = require('../../accelerator/core/operation-record');
const { createLifecycle } = require('../../accelerator/core/state-boundary');
const { orchestrate } = require('../../accelerator/core/surgical-orchestrator');
const { execute } = require('../../accelerator/core/surgical-execution');

const CREATED = '2026-08-20T11:59:00.000Z';
const NOW = '2026-08-20T12:00:00.000Z';
const EXPIRY = '2026-08-20T13:00:00.000Z';

function runGit(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function fixture() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-orchestrator-'));
  runGit(repo, ['init']);
  runGit(repo, ['config', 'user.email', 'sdo@example.invalid']);
  runGit(repo, ['config', 'user.name', 'SDO Test']);
  fs.writeFileSync(path.join(repo, 'target.js'), 'const value = 1;\n');
  fs.writeFileSync(path.join(repo, 'invalid.js'), 'const = ;\n');
  runGit(repo, ['add', 'target.js', 'invalid.js']);
  runGit(repo, ['commit', '-m', 'fixture']);
  return fs.realpathSync(repo);
}

function physical(repo) {
  const commit = runGit(repo, ['rev-parse', 'HEAD']);
  return {
    path: repo, branch: runGit(repo, ['branch', '--show-current']) || null,
    commit, shortCommit: runGit(repo, ['rev-parse', '--short', 'HEAD']),
    clean: true, changedFiles: []
  };
}

function operationRecord(repo) {
  return createOperationRecord({
    operationId: 'op-1', requester: { id: 'requester-1', type: 'HUMAN' },
    workspace: repo, objective: 'Govern one bounded adapter action.',
    policyDecision: 'ALLOWED', riskLevel: 'R1', idempotency: 'IDEMPOTENT',
    events: [
      { type: 'intent', operationId: 'op-1', timestamp: CREATED,
        objective: 'Govern one bounded adapter action.' },
      { type: 'policy', operationId: 'op-1', timestamp: CREATED,
        policyDecision: 'ALLOWED', riskLevel: 'R1' },
      { type: 'state', operationId: 'op-1', timestamp: CREATED, status: 'PENDING' }
    ]
  }).record;
}

function lifecycle(repo) {
  return createLifecycle({
    operationId: 'op-1', initialState: 'PENDING', before: physical(repo), createdAt: CREATED
  });
}

function issue(repo, adapter, target = 'target.js', overrides = {}) {
  const capabilityType = adapter;
  const scope = adapter === 'FILESYSTEM_READ' ? { paths: [target] }
    : adapter === 'GIT_READ' ? { operations: ['rev-parse'] }
      : { selectors: ['NODE_SYNTAX_CHECK'], paths: [target] };
  const common = {
    operationId: 'op-1', workspace: repo, policyDecision: 'ALLOWED', riskLevel: 'R1',
    lifecycleState: 'PENDING', capabilityType, scope, idempotency: 'IDEMPOTENT'
  };
  return evaluateCapabilityGrant(
    { ...common, expiresAt: EXPIRY, ...overrides.request },
    { ...common, evaluatedAt: CREATED, ...overrides.authority }
  );
}

function execution(repo, adapter, overrides = {}) {
  const target = overrides.target || 'target.js';
  const action = adapter === 'FILESYSTEM_READ' ? 'READ_FILE'
    : adapter === 'GIT_READ' ? 'HEAD_COMMIT' : 'NODE_SYNTAX_CHECK';
  return {
    adapter, action, operationId: 'op-1', workspace: repo, target,
    observedAt: NOW, grantEvaluation: issue(repo, adapter, target),
    operationRecord: operationRecord(repo), lifecycle: lifecycle(repo), ...overrides
  };
}

function input(repo, executionRequest, overrides = {}) {
  return {
    repositoryPath: repo, description: 'Govern adapter dispatch', files: ['target.js'],
    mode: 'PATCH', risk: 'BAIXO', authorizeExecution: true, estimatedDiffLines: 1,
    architecturalChange: false, execution: executionRequest, ...overrides
  };
}

function withFixture(assertion) {
  const repo = fixture();
  try { assertion(repo); } finally { fs.rmSync(repo, { recursive: true, force: true }); }
}

function assertNoDispatch(context, repo, request, pattern) {
  let calls = 0;
  for (const [adapter, method] of [
    [filesystemReadAdapter, 'readFileWithGrant'], [gitReadAdapter, 'readGitWithGrant'],
    [processValidationAdapter, 'validateJavaScriptWithGrant']
  ]) context.mock.method(adapter, method, () => { calls += 1; throw new Error('must not run'); });
  const result = orchestrate(input(repo, request));
  assert.equal(result.orchestration.status, 'DENIED');
  assert.match(result.execution.reason, pattern);
  assert.equal(calls, 0);
}

test('governed filesystem read succeeds with bound evidence', () => withFixture((repo) => {
  const result = orchestrate(input(repo, execution(repo, 'FILESYSTEM_READ')));
  assert.equal(result.orchestration.status, 'COMPLETED', JSON.stringify(result.execution));
  assert.equal(result.execution.evidence.content, 'const value = 1;\n');
  assert.equal(result.governed.operationRecord.adapterEvidence[0].operationId, 'op-1');
  assert.equal(result.governed.operationRecord.adapterEvidence[0].workspace, repo);
}));

test('governed Git read succeeds', (context) => withFixture((repo) => {
  const head = runGit(repo, ['rev-parse', 'HEAD']);
  context.mock.method(childProcess, 'spawnSync', () => ({
    status: 0, signal: null, stdout: `${head}\n`, stderr: ''
  }));
  const result = orchestrate(input(repo, execution(repo, 'GIT_READ')));
  assert.equal(result.orchestration.status, 'COMPLETED', JSON.stringify(result.execution));
  assert.equal(result.execution.result, head);
}));

test('governed process validation PASSED completes', (context) => withFixture((repo) => {
  context.mock.method(childProcess, 'spawnSync', () => ({
    status: 0, signal: null, stdout: '', stderr: ''
  }));
  const result = orchestrate(input(repo, execution(repo, 'PROCESS_VALIDATION')));
  assert.equal(result.execution.validation && result.execution.validation.status, 'PASSED',
    JSON.stringify(result.execution));
  assert.equal(result.governed.lifecycle.status, 'COMPLETED');
}));

test('governed process validation FAILED cannot complete successfully', (context) => withFixture((repo) => {
  context.mock.method(childProcess, 'spawnSync', () => ({
    status: 1, signal: null, stdout: '', stderr: 'syntax error'
  }));
  const request = execution(repo, 'PROCESS_VALIDATION', {
    target: 'invalid.js', grantEvaluation: issue(repo, 'PROCESS_VALIDATION', 'invalid.js')
  });
  const result = orchestrate(input(repo, request));
  assert.equal(result.orchestration.status, 'FAILED');
  assert.equal(result.governed.lifecycle.status, 'FAILED');
  assert.equal(result.governed.operationRecord.finalization.successfulCompletionEligible, false);
}));

test('missing grant prevents dispatch', (context) => withFixture((repo) => {
  assertNoDispatch(context, repo, execution(repo, 'FILESYSTEM_READ', { grantEvaluation: null }),
    /capability context/);
}));

test('expired grant prevents dispatch', (context) => withFixture((repo) => {
  assertNoDispatch(context, repo, execution(repo, 'GIT_READ', { observedAt: EXPIRY }), /expired/);
}));

test('operationId mismatch prevents dispatch', (context) => withFixture((repo) => {
  assertNoDispatch(context, repo, execution(repo, 'FILESYSTEM_READ', { operationId: 'op-2' }),
    /operationId mismatch/);
}));

test('workspace mismatch prevents dispatch', (context) => withFixture((repo) => {
  assertNoDispatch(context, repo, execution(repo, 'FILESYSTEM_READ', {
    workspace: fs.realpathSync(os.tmpdir())
  }), /workspace mismatch/);
}));

test('capability and action mismatch prevents dispatch', (context) => withFixture((repo) => {
  const request = execution(repo, 'FILESYSTEM_READ', {
    grantEvaluation: issue(repo, 'GIT_READ')
  });
  assertNoDispatch(context, repo, request, /type mismatch/);
}));

test('scope mismatch prevents dispatch', (context) => withFixture((repo) => {
  const request = execution(repo, 'FILESYSTEM_READ', { target: 'invalid.js' });
  request.grantEvaluation = issue(repo, 'FILESYSTEM_READ', 'target.js');
  assertNoDispatch(context, repo, request, /scope mismatch/);
}));

test('invalid lifecycle prevents dispatch', (context) => withFixture((repo) => {
  const pending = lifecycle(repo);
  const invalid = Object.freeze({ ...pending, status: 'NOT_EXECUTABLE' });
  assertNoDispatch(context, repo, execution(repo, 'GIT_READ', { lifecycle: invalid }), /Lifecycle/);
}));

test('policy and risk mismatches prevent dispatch', (context) => withFixture((repo) => {
  const request = execution(repo, 'GIT_READ', {
    grantEvaluation: issue(repo, 'GIT_READ', 'target.js', {
      request: { riskLevel: 'R2' }, authority: { riskLevel: 'R2' }
    })
  });
  assertNoDispatch(context, repo, request, /risk/);
}));

test('non-ALLOWED policy grant prevents dispatch', (context) => withFixture((repo) => {
  const deniedGrant = issue(repo, 'GIT_READ', 'target.js', {
    request: { policyDecision: 'DENIED' }, authority: { policyDecision: 'DENIED' }
  });
  assertNoDispatch(context, repo, execution(repo, 'GIT_READ', {
    grantEvaluation: deniedGrant
  }), /capability context/);
}));

test('unknown action is denied before preflight and dispatch', (context) => {
  let discoveryCalls = 0;
  context.mock.method(repositoryDiscovery, 'discover', () => { discoveryCalls += 1; });
  const result = orchestrate(input('/not/a/repo', { adapter: 'GIT_READ', action: 'PUSH' }));
  assert.equal(result.state.status, 'NOT_EXECUTABLE');
  assert.equal(discoveryCalls, 0);
});

test('FILESYSTEM_PATCH remains denied and disconnected', (context) => {
  let calls = 0;
  context.mock.method(filesystemReadAdapter, 'readFileWithGrant', () => { calls += 1; });
  const result = orchestrate(input('/not/a/repo', { adapter: 'FILESYSTEM_PATCH', action: 'PATCH_FILE' }));
  assert.equal(result.orchestration.status, 'DENIED');
  assert.equal(calls, 0);
});

test('legacy execution reaches zero governed dispatch', (context) => {
  let calls = 0;
  context.mock.method(processValidationAdapter, 'validateJavaScriptWithGrant', () => { calls += 1; });
  const result = orchestrate({ command: process.execPath, args: ['-e', 'x'] });
  assert.equal(result.state.status, 'NOT_EXECUTABLE');
  assert.equal(calls, 0);
  assert.throws(() => execute({ command: process.execPath }), /Legacy generic/);
});

test('preflight is explicitly not governed evidence', () => withFixture((repo) => {
  const result = orchestrate(input(repo, execution(repo, 'FILESYSTEM_READ')));
  assert.equal(result.pipeline.preAuthorizationPreflight.classification,
    'PRE_AUTHORIZATION_PREFLIGHT');
  assert.equal(result.pipeline.preAuthorizationPreflight.governedAdapterEvidence, false);
  assert.equal(result.governed.operationRecord.adapterEvidence.length, 1);
}));

test('grant fingerprint is internally derived', () => withFixture((repo) => {
  const request = execution(repo, 'FILESYSTEM_READ');
  const result = orchestrate(input(repo, request));
  const expected = crypto.createHash('sha256')
    .update(JSON.stringify(request.grantEvaluation)).digest('hex');
  assert.equal(result.governed.operationRecord.adapterEvidence[0].grantFingerprint, expected);
}));

test('caller-supplied grant fingerprint is rejected before preflight', () => {
  const result = orchestrate(input('/not/a/repo', {
    adapter: 'GIT_READ', action: 'HEAD_COMMIT', grantFingerprint: 'a'.repeat(64)
  }));
  assert.equal(result.state.status, 'NOT_EXECUTABLE');
});

test('identical replay avoids duplicate physical execution', (context) => withFixture((repo) => {
  const request = execution(repo, 'FILESYSTEM_READ');
  const first = orchestrate(input(repo, request));
  let calls = 0;
  context.mock.method(filesystemReadAdapter, 'readFileWithGrant', () => { calls += 1; });
  const replay = orchestrate(input(repo, {
    ...request,
    operationRecord: first.governed.operationRecord,
    lifecycle: first.governed.lifecycle
  }));
  assert.equal(replay.governed.replay, true);
  assert.equal(replay.orchestration.executionAttempted, false);
  assert.equal(calls, 0);
}));

test('conflicting replay fails closed without dispatch', (context) => withFixture((repo) => {
  const request = execution(repo, 'FILESYSTEM_READ');
  const first = orchestrate(input(repo, request));
  const changedGrant = issue(repo, 'FILESYSTEM_READ', 'target.js', {
    request: { expiresAt: '2026-08-20T14:00:00.000Z' }
  });
  assertNoDispatch(context, repo, {
    ...request, grantEvaluation: changedGrant,
    operationRecord: first.governed.operationRecord, lifecycle: first.governed.lifecycle
  }, /Conflicting governed adapter replay/);
}));

test('adapter failure cannot become successful completion', (context) => withFixture((repo) => {
  context.mock.method(gitReadAdapter, 'readGitWithGrant', () => { throw new Error('adapter failed'); });
  const result = orchestrate(input(repo, execution(repo, 'GIT_READ')));
  assert.equal(result.orchestration.status, 'FAILED');
  assert.equal(result.governed.lifecycle.status, 'FAILED');
}));

test('valid non-execution orchestration remains unchanged', () => withFixture((repo) => {
  const requestless = input(repo, undefined);
  delete requestless.execution;
  const result = orchestrate(requestless);
  assert.equal(result.orchestration.status, 'AUTHORIZED');
  assert.equal(result.execution, null);
}));

test('missing required input is rejected', () => {
  assert.throws(() => orchestrate({ repositoryPath: '/tmp/x', description: 'x', files: [] }),
    /At least one target file/);
});
