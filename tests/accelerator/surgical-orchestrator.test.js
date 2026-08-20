'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const repositoryDiscovery = require('../../accelerator/core/repository-discovery');
const declarativeInspection = require('../../accelerator/core/declarative-inspection');
const { orchestrate } = require('../../accelerator/core/surgical-orchestrator');
const { execute } = require('../../accelerator/core/surgical-execution');

function runGit(repositoryPath, args) {
  return execFileSync('git', ['-C', repositoryPath, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function fixture() {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-orchestrator-'));
  runGit(repositoryPath, ['init']);
  runGit(repositoryPath, ['config', 'user.email', 'sdo-test@example.invalid']);
  runGit(repositoryPath, ['config', 'user.name', 'Surgical DevOps Test']);
  fs.writeFileSync(path.join(repositoryPath, 'target.js'), 'const value = 1;\n');
  runGit(repositoryPath, ['add', 'target.js']);
  runGit(repositoryPath, ['commit', '-m', 'fixture baseline']);
  return repositoryPath;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function grant(repositoryPath, overrides = {}) {
  return deepFreeze({
    schema: 'sdo.capability_grant_evaluation.v1', decision: 'ALLOWED',
    grant: {
      operationId: 'op-1', workspace: repositoryPath, policyDecision: 'ALLOWED',
      riskLevel: 'R0', lifecycleState: 'PENDING', capabilityType: 'PROCESS_VALIDATION',
      scope: { selectors: ['NODE_SYNTAX_CHECK'], paths: [{ path: 'target.js' }] },
      expiresAt: '2099-01-01T00:00:00.000Z', idempotency: 'IDEMPOTENT', ...overrides
    }
  });
}

function input(repositoryPath, overrides = {}) {
  return {
    repositoryPath, description: 'Contain legacy execution', files: ['target.js'],
    mode: 'PATCH', risk: 'BAIXO', estimatedDiffLines: 1,
    hypothesis: 'Inspect the bounded target before any requested execution.',
    objective: 'Prove that execution requests are denied before dispatch.',
    diffEstimate: 'One bounded fixture file.',
    architecturalChange: false, authorizeExecution: true, ...overrides
  };
}

function controlled(repositoryPath, overrides = {}) {
  return {
    adapter: 'PROCESS_VALIDATION', action: 'VALIDATE_JAVASCRIPT',
    operationId: 'op-1', workspace: repositoryPath, selector: 'NODE_SYNTAX_CHECK',
    target: 'target.js', observedAt: '2026-08-20T12:00:00.000Z',
    grantEvaluation: grant(repositoryPath), ...overrides
  };
}

function withFixture(assertion) {
  const repositoryPath = fixture();
  try { assertion(repositoryPath); } finally {
    fs.rmSync(repositoryPath, { recursive: true, force: true });
  }
}

function denied(repositoryPath, overrides) {
  const result = orchestrate(input(repositoryPath, overrides));
  assert.equal(result.orchestration.status, 'DENIED');
  assert.equal(result.orchestration.executionAttempted, false);
  assert.equal(result.orchestration.executionAllowed, false);
  assert.equal(result.execution.decision, 'DENIED');
  return result;
}

function earlyDenied(context, overrides) {
  let discoveryCalls = 0;
  let inspectionCalls = 0;
  context.mock.method(repositoryDiscovery, 'discover', () => { discoveryCalls += 1; });
  context.mock.method(declarativeInspection, 'inspect', () => { inspectionCalls += 1; });
  const result = orchestrate(input('/definitely/not/a/repository', overrides));
  assert.equal(result.orchestration.status, 'DENIED');
  assert.equal(result.orchestration.executionAttempted, false);
  assert.equal(result.state.status, 'NOT_EXECUTABLE');
  assert.equal(discoveryCalls, 0);
  assert.equal(inspectionCalls, 0);
  return result;
}

test('authorization remains blocked unless explicitly requested', () => withFixture((repo) => {
  const result = orchestrate(input(repo, { authorizeExecution: false }));
  assert.equal(result.orchestration.status, 'BLOCKED');
}));

test('authorization without an execution request dispatches nothing', () => withFixture((repo) => {
  const result = orchestrate(input(repo));
  assert.equal(result.orchestration.status, 'AUTHORIZED');
  assert.equal(result.execution, null);
}));

test('generic command execution is rejected before discovery', (context) => {
  const result = earlyDenied(context, { command: process.execPath });
  assert.match(result.execution.reason, /Legacy generic/);
});

test('arbitrary executable is rejected before discovery', (context) => {
  assert.match(earlyDenied(context, { executable: '/bin/sh' }).execution.reason, /Legacy generic/);
});

test('arbitrary args are rejected before discovery', (context) => {
  assert.match(earlyDenied(context, { args: ['-c', 'anything'] }).execution.reason,
    /arguments are denied/);
});

test('legacy execution mode is rejected with zero physical calls', (context) => {
  assert.match(earlyDenied(context, { executionMode: 'LEGACY' }).execution.reason,
    /Legacy execution mode/);
});

test('legacy executor fails before it can spawn a process', () => {
  assert.throws(() => execute({ command: process.execPath, args: ['-e', 'process.exit()'] }),
    /Legacy generic execution is denied/);
  const source = fs.readFileSync(require.resolve('../../accelerator/core/surgical-execution'), 'utf8');
  assert.doesNotMatch(source, /child_process|execFile|spawn|shell:/);
});

test('unknown adapter or action is rejected before discovery', (context) => {
  const request = controlled('/definitely/not/a/repository', { action: 'RUN_ANYTHING' });
  assert.match(earlyDenied(context, { execution: request })
    .execution.reason, /Unknown controlled adapter or action/);
});

test('generic fields inside a controlled shape are rejected before discovery', (context) => {
  const request = controlled('/definitely/not/a/repository', { executable: '/bin/sh', args: [] });
  assert.match(earlyDenied(context, { execution: request }).execution.reason,
    /Generic execution fields/);
});

test('missing or malformed grant is rejected', () => withFixture((repo) => {
  assert.match(denied(repo, { execution: controlled(repo, { grantEvaluation: null }) })
    .execution.reason, /Missing or malformed capability context/);
}));

test('operationId mismatch is rejected', () => withFixture((repo) => {
  assert.match(denied(repo, { execution: controlled(repo, { operationId: 'op-2' }) })
    .execution.reason, /operationId mismatch/);
}));

test('workspace mismatch is rejected', () => withFixture((repo) => {
  assert.match(denied(repo, { execution: controlled(repo, { workspace: fs.realpathSync(os.tmpdir()) }) })
    .execution.reason, /workspace mismatch/);
}));

test('stale or expired grant is rejected', () => withFixture((repo) => {
  const execution = controlled(repo, {
    observedAt: '2099-01-01T00:00:00.000Z'
  });
  assert.match(denied(repo, { execution }).execution.reason, /stale or expired/);
}));

test('invalid lifecycle state is rejected', () => withFixture((repo) => {
  const execution = controlled(repo, { grantEvaluation: grant(repo, { lifecycleState: 'COMPLETED' }) });
  assert.match(denied(repo, { execution }).execution.reason, /lifecycle state is invalid/);
}));

test('capability scope mismatch is rejected', () => withFixture((repo) => {
  assert.match(denied(repo, { execution: controlled(repo, { target: 'other.js' }) })
    .execution.reason, /scope mismatch/);
}));

test('valid controlled context is denied while adapters are disconnected', () => withFixture((repo) => {
  assert.match(denied(repo, { execution: controlled(repo) }).execution.reason,
    /authoritative but disconnected/);
}));

test('orchestrator has no legacy fallback or controlled-adapter import', () => {
  const source = fs.readFileSync(require.resolve('../../accelerator/core/surgical-orchestrator'), 'utf8');
  assert.doesNotMatch(source, /surgical-execution|process-validation-adapter|filesystem-patch-adapter/);
  assert.doesNotMatch(source, /execFile|spawn|child_process/);
});

test('missing required input is rejected before pipeline work', () => {
  assert.throws(() => orchestrate({ repositoryPath: '/tmp/none', description: 'invalid', files: [] }),
    /At least one target file is required/);
});
