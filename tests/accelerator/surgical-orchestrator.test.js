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
const identityVerificationAdapter = require('../../accelerator/adapters/identity-verification-adapter');
const filesystemPatchAdapter = require('../../accelerator/adapters/filesystem-patch-adapter');
const { createQualifiedTestMutationProvider, createTestBoundary, bindMutationProviderRuntime } =
  require('./helpers/qualified-mutation-provider');
const { createMutationJournalAdapter } =
  require('../../accelerator/adapters/mutation-journal-adapter');
const { evaluateCapabilityGrant, deriveCapabilityGrantFingerprint } = require('../../accelerator/core/capability-grant');
const { evaluateR3ApprovalAuthority } = require('../../accelerator/core/risk-classification');
const { evaluateVerifiedHumanIdentityAssertion } = require('../../accelerator/core/human-identity-assertion');
const { createOperationRecord } = require('../../accelerator/core/operation-record');
const { createLifecycle } = require('../../accelerator/core/state-boundary');
const { createAuthoritativeClock, classifyMutationAuthority } =
  require('../../accelerator/core/authoritative-clock');
const {
  orchestrate,
  evidenceIdentity,
  preserveControlledErrorEvidence
} = require('../../accelerator/core/surgical-orchestrator');
const { execute } = require('../../accelerator/core/surgical-execution');
const {
  providerBoundary: contentAddressedProviderBoundary
} = require('../../accelerator/core/content-addressed-mutation-provider');

const CREATED = '2026-08-20T11:59:00.000Z';
const NOW = '2026-08-20T12:00:00.000Z';
const EXPIRY = '2026-08-20T13:00:00.000Z';
const journalRoots = [];
test.after(() => {
  for (const root of journalRoots) fs.rmSync(root, { recursive: true, force: true });
});

function clockAt(start = NOW, stepMilliseconds = 1) {
  let count = 0;
  const startMs = Date.parse(start);
  return createAuthoritativeClock({ port: { read: () => {
    const offset = count++ * stepMilliseconds;
    return { schema: 'sdo.system_clock_observation.v1', availability: 'AVAILABLE',
      source: 'TEST', wallTime: new Date(startMs + offset).toISOString(),
      monotonicNanoseconds: String(1000000000n + BigInt(offset) * 1000000n) };
  } } });
}

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

function frozen(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) frozen(child);
  return Object.freeze(value);
}

function operationRecord(repo, adapter = 'FILESYSTEM_READ') {
  const riskLevel =
    adapter === 'GIT_READ'
      ? 'R0'
      : 'R1';

  return createOperationRecord({
    operationId: 'op-1', requester: { id: 'requester-1', type: 'HUMAN' },
    workspace: repo, objective: 'Govern one bounded adapter action.',
    policyDecision: 'ALLOWED', riskLevel, idempotency: 'IDEMPOTENT',
    events: [
      { type: 'intent', operationId: 'op-1', timestamp: CREATED,
        objective: 'Govern one bounded adapter action.' },
      { type: 'policy', operationId: 'op-1', timestamp: CREATED,
        policyDecision: 'ALLOWED', riskLevel },
      { type: 'state', operationId: 'op-1', timestamp: CREATED, status: 'PENDING' }
    ]
  }).record;
}

function r3Authority(repo, overrides = {}) {
  const scope = { target: { path: 'target.js', beforeSha256:
    crypto.createHash('sha256').update('const value = 1;\n').digest('hex'),
    replacementSha256:
    crypto.createHash('sha256').update('const value = 2;\n').digest('hex') } };
  const verifiedIdentityAssertion = evaluateVerifiedHumanIdentityAssertion({
    schema: 'sdo.verified_human_identity_assertion.v1', verification: 'VERIFIED',
    assertionId: 'assertion-1', subject: { id: 'human-1', type: 'HUMAN' }, issuer: 'issuer:test',
    authentication: { method: 'PASSKEY', context: 'MFA' }, issuedAt: '2026-08-20T11:55:00.000Z',
    expiresAt: EXPIRY, audience: ['surgical-devops'], operationId: 'op-1', workspace: repo,
    tenantId: 'tenant-1', projectId: 'project-1', revocationStatus: 'NOT_REVOKED',
    verifiedAt: CREATED
  }).assertion;
  return evaluateR3ApprovalAuthority({ approvalAuthorityId: 'approval-r3', operationId: 'op-1',
    approver: { id: 'human-1', type: 'HUMAN' }, decision: 'APPROVED', riskLevel: 'R3',
    capabilityType: 'FILESYSTEM_PATCH', action: 'PATCH_FILE', workspace: repo, scope,
    tenantId: 'tenant-1', projectId: 'project-1', verifiedIdentityAssertion,
    policyDecision: 'APPROVAL_REQUIRED', timestamp: CREATED, expiresAt: EXPIRY,
    ...overrides }).authority;
}

function r3Execution(repo, overrides = {}) {
  const approvalAuthority = r3Authority(repo);
  const scope = approvalAuthority.scope;
  const identityVerification = identityVerificationAdapter.verifyHumanIdentityAssertion({
    rawAssertion: { token: 'test' }, trustedIssuers: ['issuer:test'], expected: {
      subjectId: 'human-1', audience: 'surgical-devops', operationId: 'op-1', workspace: repo,
      tenantId: 'tenant-1', projectId: 'project-1'
    }
  }, { verify() { return { status: 'VERIFIED',
    assertion: approvalAuthority.verifiedIdentityAssertion, verifierId: 'test-port' }; } },
  { reading: clockAt().read(), requireCurrent: true });
  const common = { operationId: 'op-1', workspace: repo, policyDecision: 'APPROVAL_REQUIRED',
    riskLevel: 'R3', lifecycleState: 'PENDING', capabilityType: 'FILESYSTEM_PATCH',
    action: 'PATCH_FILE', scope, idempotency: 'IDEMPOTENT',
    approvalAuthority, identityVerification,
    tenantId: 'tenant-1', projectId: 'project-1' };
  const grantEvaluation = evaluateCapabilityGrant(
    { ...common, expiresAt: EXPIRY }, { ...common, evaluatedAt: CREATED }, clockAt());
  const operationRecord = createOperationRecord({ operationId: 'op-1',
    requester: { id: 'requester-1', type: 'HUMAN' }, workspace: repo,
    objective: 'Govern one bounded R3 patch authority.', policyDecision: 'APPROVAL_REQUIRED',
    riskLevel: 'R3', idempotency: 'IDEMPOTENT', approvalAuthority,
    identityVerification,
    capabilityType: 'FILESYSTEM_PATCH', action: 'PATCH_FILE', scope, observedAt: NOW,
    tenantId: 'tenant-1', projectId: 'project-1',
    events: [
      { type: 'intent', operationId: 'op-1', timestamp: CREATED, objective: 'Govern one bounded R3 patch authority.' },
      { type: 'policy', operationId: 'op-1', timestamp: CREATED, policyDecision: 'APPROVAL_REQUIRED', riskLevel: 'R3' },
      { type: 'approval', operationId: 'op-1', timestamp: CREATED, approverId: 'human-1',
        decision: 'APPROVED', approvalTimestamp: CREATED,
        approvalAuthorityId: approvalAuthority.approvalAuthorityId,
        approvalAuthorityFingerprint: approvalAuthority.fingerprint,
        verifiedIdentityAssertionFingerprint: approvalAuthority.verifiedIdentityAssertionFingerprint },
      { type: 'state', operationId: 'op-1', timestamp: CREATED, status: 'PENDING' }
    ] }, clockAt()).record;
  return { adapter: 'FILESYSTEM_PATCH', action: 'PATCH_FILE', operationId: 'op-1',
    workspace: repo, target: 'target.js', replacement: 'const value = 2;\n', observedAt: NOW,
    tenantId: 'tenant-1', projectId: 'project-1',
    rawIdentityAssertion: { token: 'test' },
    grantEvaluation, operationRecord, lifecycle: lifecycle(repo), ...overrides };
}

function r3Runtime(request, overrides = {}) {
  const journalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-orchestrator-journal-'));
  journalRoots.push(journalRoot);
  const provider = overrides.mutationProvider || createQualifiedTestMutationProvider();
  const runtime = { trustedIdentityIssuers: ['issuer:test'], identityAudience: 'surgical-devops',
    authoritativeClock: clockAt(),
    mutationJournalAdapter: createMutationJournalAdapter({ storageRoot: journalRoot }),
    identityVerifierPort: { verify() { return { status: 'VERIFIED',
      assertion: request.operationRecord.verifiedIdentityAssertion, verifierId: 'test-port' }; } },
    ...overrides };
  delete runtime.mutationProvider;
  if (overrides.useQualified !== false) bindMutationProviderRuntime(runtime, provider);
  delete runtime.useQualified;
  return runtime;
}

function failingJournal(base, stage) {
  return {
    create(transaction) {
      if (stage === 'PREPARED') throw new Error('Injected PREPARED journal failure.');
      return base.create(transaction);
    },
    append(transaction) {
      if (transaction.stage === stage) throw new Error(`Injected ${stage} journal failure.`);
      return base.append(transaction);
    },
    reopen(transaction) { return base.reopen(transaction); }
  };
}

function commitTemporal(request, decision = 'ALLOWED') {
  const grant = request.grantEvaluation.grant;
  const evaluation = classifyMutationAuthority(clockAt().read(), {
    identity: grant.temporalAuthority.identity,
    approval: grant.temporalAuthority.approval,
    grant: { ...grant.temporalAuthority.grant, fingerprint: grant.fingerprint }
  });
  return frozen({ schema: 'sdo.mutation_commit_authority.v1',
    commitBoundary: 'IMMEDIATELY_BEFORE_ATOMIC_REPLACEMENT', physicalCommit: 'APPLIED',
    decision, evaluation });
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
  const riskLevel =
    adapter === 'GIT_READ'
      ? 'R0'
      : 'R1';
  const common = {
    operationId: 'op-1', workspace: repo, policyDecision: 'ALLOWED', riskLevel,
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
    operationRecord: operationRecord(repo, adapter), lifecycle: lifecycle(repo), ...overrides
  };
}

function input(repo, executionRequest, overrides = {}) {
  const gitRead =
    executionRequest &&
    executionRequest.adapter === 'GIT_READ';

  return {
    repositoryPath: repo,
    description: 'Govern adapter dispatch',
    files: gitRead ? [] : ['target.js'],
    mode: gitRead ? 'OBSERVE' : 'PATCH',
    risk: 'BAIXO',
    authorizeExecution: true,
    estimatedDiffLines: gitRead ? 0 : 1,
    architecturalChange: false,
    execution: executionRequest,
    ...overrides
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

test('default production provider state denies patch with immutable zero-dispatch evidence', () =>
  withFixture((repo) => {
    const request = r3Execution(repo);
    const runtime = r3Runtime(request, { useQualified: false });
    const result = orchestrate(input(repo, request, { risk: 'ALTO', policy: {
      decision: 'APPROVAL_REQUIRED', approvalAuthority: request.operationRecord.approvalAuthority
    } }), runtime);
    assert.equal(result.orchestration.status, 'DENIED');
    assert.equal(result.orchestration.executionAttempted, false);
    assert.equal(fs.readFileSync(path.join(repo, 'target.js'), 'utf8'), 'const value = 1;\n');
    assert.equal(result.execution.providerEvidence.qualificationState, 'UNQUALIFIED');
    assert.equal(result.execution.providerEvidence.zeroDispatch, true);
    assert.equal(result.governed.operationRecord.mutationProviderEvidence.length, 1);
  }));

test('trusted non-qualified provider states deny before physical provider dispatch', () =>
  withFixture((repo) => {
    for (const state of ['UNQUALIFIED', 'UNSUPPORTED', 'FAILED']) {
      const request = r3Execution(repo);
      const mutationProvider = createTestBoundary(state);
      const result = orchestrate(input(repo, request, { risk: 'ALTO', policy: {
        decision: 'APPROVAL_REQUIRED', approvalAuthority: request.operationRecord.approvalAuthority
      } }), r3Runtime(request, { mutationProvider }));
      assert.equal(result.orchestration.status, 'DENIED');
      assert.equal(result.orchestration.executionAttempted, false);
      assert.equal(result.execution.providerEvidence.qualificationState, state);
    }
    assert.equal(fs.readFileSync(path.join(repo, 'target.js'), 'utf8'), 'const value = 1;\n');
  }));

test('caller runtime provider injection is ignored and remains zero-dispatch', () =>
  withFixture((repo) => {
    const request = r3Execution(repo);
    const runtime = r3Runtime(request, { useQualified: false });
    runtime.mutationProvider = { qualification: { state: 'QUALIFIED', providerId: 'forged' },
      compareAndReplace() { throw new Error('must not run'); } };
    const result = orchestrate(input(repo, request, { risk: 'ALTO', policy: {
      decision: 'APPROVAL_REQUIRED', approvalAuthority: request.operationRecord.approvalAuthority
    } }), runtime);
    assert.equal(result.orchestration.status, 'DENIED');
    assert.equal(result.execution.providerEvidence.zeroDispatch, true);
    assert.equal(fs.readFileSync(path.join(repo, 'target.js'), 'utf8'), 'const value = 1;\n');
  }));

test('caller provider selection and qualification fields are rejected at request-shape boundary', () => {
  for (const forged of [
    { providerId: 'forged' }, { qualificationState: 'QUALIFIED' },
    { mutationProvider: {} }, { provider: {} }, { compareAndReplace() {} }
  ]) {
    const result = orchestrate({ ...input('/unreachable', forged), execution: {
      adapter: 'FILESYSTEM_PATCH', action: 'PATCH_FILE', ...forged
    } });
    assert.equal(result.state.status, 'NOT_EXECUTABLE');
    assert.match(result.execution.reason, /provider selection is forbidden/);
  }
});

test('governed filesystem read succeeds with bound evidence', () => withFixture((repo) => {
  const result = orchestrate(input(repo, execution(repo, 'FILESYSTEM_READ')));
  assert.equal(result.orchestration.status, 'COMPLETED', JSON.stringify(result.execution));
  assert.equal(result.execution.evidence.content, 'const value = 1;\n');
  assert.equal(result.governed.operationRecord.adapterEvidence[0].operationId, 'op-1');
  assert.equal(result.governed.operationRecord.adapterEvidence[0].workspace, repo);
}));

test('governed Git read succeeds', (context) => withFixture((repo) => {
  const head = runGit(repo, ['rev-parse', 'HEAD']);
  context.mock.method(childProcess, 'spawnSync', (executable, args) => ({
    status: 0, signal: null, stderr: '', stdout: args.includes('--verify') ? `${head}\n`
      : args.includes('--show-toplevel') ? `${repo}\n`
        : args.includes('--abbrev-ref') ? 'master\n'
          : args.includes('HEAD') ? `${head}\n`
            : args.includes('ls-files') ? 'target.js\0invalid.js\0' : ''
  }));
  const result = orchestrate(input(repo, execution(repo, 'GIT_READ')));
  assert.equal(result.orchestration.status, 'COMPLETED', JSON.stringify(result.execution));
  assert.equal(result.execution.result, head);
}));

test('governed process validation PASSED completes', (context) => withFixture((repo) => {
  const head = runGit(repo, ['rev-parse', 'HEAD']);
  context.mock.method(childProcess, 'spawnSync', (executable, args) => ({
    status: 0, signal: null, stderr: '', stdout: args.includes('--show-toplevel') ? `${repo}\n`
      : args.includes('--abbrev-ref') ? 'master\n'
        : args.includes('HEAD') ? `${head}\n`
          : args.includes('ls-files') ? 'target.js\0invalid.js\0' : ''
  }));
  const result = orchestrate(input(repo, execution(repo, 'PROCESS_VALIDATION')));
  assert.equal(result.execution.validation && result.execution.validation.status, 'PASSED',
    JSON.stringify(result.execution));
  assert.equal(result.governed.lifecycle.status, 'COMPLETED');
}));

test('governed process validation FAILED cannot complete successfully', (context) => withFixture((repo) => {
  const head = runGit(repo, ['rev-parse', 'HEAD']);
  context.mock.method(childProcess, 'spawnSync', (executable, args) => ({
    status: executable !== 'git' ? 1 : 0, signal: null,
    stdout: args.includes('--show-toplevel') ? `${repo}\n`
      : args.includes('--abbrev-ref') ? 'master\n'
        : args.includes('HEAD') ? `${head}\n`
          : args.includes('ls-files') ? 'target.js\0invalid.js\0' : '',
    stderr: executable !== 'git' ? 'syntax error' : ''
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
    grantEvaluation: issue(repo, 'GIT_READ', 'target.js', {
      request: { riskLevel: 'R1' },
      authority: { riskLevel: 'R1' }
    })
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

test('valid verified R3 authority physically applies one exact FILESYSTEM_PATCH', () =>
  withFixture((repo) => {
    const request = r3Execution(repo);
    const result = orchestrate(input(repo, request, { risk: 'ALTO',
      policy: { decision: 'APPROVAL_REQUIRED',
        approvalAuthority: request.operationRecord.approvalAuthority } }), r3Runtime(request));
    assert.equal(result.orchestration.status, 'COMPLETED', JSON.stringify(result.execution));
    assert.equal(result.execution.outcome, 'APPLIED');
    assert.equal(result.governed.lifecycle.status, 'COMPLETED');
    assert.equal(result.governed.operationRecord.finalization.outcome, 'SUCCESS');
    assert.ok(result.governed.lifecycle.evidence.after.changedFiles.some(
      (entry) => entry.endsWith('target.js')));
    assert.equal(result.governed.operationRecord.adapterEvidence[0].replacementSha256,
      request.grantEvaluation.grant.scope.target.replacementSha256);
    assert.equal(fs.readFileSync(path.join(repo, 'target.js'), 'utf8'), 'const value = 2;\n');
    assert.equal(request.grantEvaluation.grant.approvalAuthorityFingerprint,
      request.operationRecord.approvalAuthority.fingerprint);
    assert.equal(result.governed.operationRecord.finalization.mutationTransaction.stage,
      'FINALIZED_SUCCESS');
    assert.equal(result.governed.operationRecord.finalization.mutationTransaction.lockDisposition,
      'RELEASED');
  }));

test('canonical R2 binding denies a fingerprint-valid actionless R3 grant', (context) =>
  withFixture((repo) => {
    const request = r3Execution(repo);
    const {
      fingerprint,
      action,
      ...grantFields
    } = request.grantEvaluation.grant;

    const actionlessGrant = frozen({
      ...grantFields,
      fingerprint:
        deriveCapabilityGrantFingerprint(grantFields)
    });

    const actionlessEvaluation = frozen({
      ...request.grantEvaluation,
      grant: actionlessGrant
    });

    let calls = 0;
    context.mock.method(
      filesystemPatchAdapter,
      'patchFileWithGrant',
      () => {
        calls += 1;
      }
    );

    const result = orchestrate(
      input(repo, {
        ...request,
        grantEvaluation: actionlessEvaluation
      }, {
        risk: 'ALTO',
        policy: {
          decision: 'APPROVAL_REQUIRED',
          approvalAuthority:
            request.operationRecord.approvalAuthority
        }
      }),
      r3Runtime(request)
    );

    assert.notEqual(
      result.orchestration.status,
      'COMPLETED'
    );
    assert.match(
      result.execution.reason,
      /Canonical R2 authority binding/
    );
    assert.equal(calls, 0);
  }));

test('journal failure matrix is zero-mutation before commit and recovery-required after commit', () => {
  const preCommit = ['PREPARED', 'LOCKED', 'BEFORE_VERIFIED', 'MUTATION_STARTED',
    'COMMIT_AUTHORITY_VERIFIED'];
  const postCommit = ['PHYSICAL_APPLIED', 'AFTER_VERIFIED',
    'EVIDENCE_RECORDED', 'FINALIZED_SUCCESS'];
  for (const stage of [...preCommit, ...postCommit]) {
    withFixture((repo) => {
      const request = r3Execution(repo);
      const baseRuntime = r3Runtime(request);
      const runtime = bindMutationProviderRuntime({ ...baseRuntime,
        mutationJournalAdapter: failingJournal(baseRuntime.mutationJournalAdapter, stage) },
      createQualifiedTestMutationProvider());
      const result = orchestrate(input(repo, request, { risk: 'ALTO', policy: {
        decision: 'APPROVAL_REQUIRED',
        approvalAuthority: request.operationRecord.approvalAuthority
      } }), runtime);
      assert.equal(result.orchestration.status, 'FAILED', stage);
      const content = fs.readFileSync(path.join(repo, 'target.js'), 'utf8');
      assert.equal(content, preCommit.includes(stage)
        ? 'const value = 1;\n' : 'const value = 2;\n', stage);
      if (postCommit.includes(stage)) {
        assert.notEqual(result.governed.operationRecord.finalization &&
          result.governed.operationRecord.finalization.outcome, 'SUCCESS', stage);
        assert.equal(result.governed.operationRecord.finalization.mutationTransaction.lockDisposition,
          'RETAINED', stage);
        assert.equal(result.governed.operationRecord.finalization.mutationTransaction.stage,
          'RECOVERY_REQUIRED', stage);
      }
    });
  }
});

test('FINALIZED_FAILED journal failure retains the exact-target lock', (context) =>
  withFixture((repo) => {
    const request = r3Execution(repo);
    const baseRuntime = r3Runtime(request);
    context.mock.method(filesystemPatchAdapter, 'patchFileWithGrant', () => {
      throw new Error('Injected pre-commit adapter denial.');
    });
    const result = orchestrate(input(repo, request, { risk: 'ALTO', policy: {
      decision: 'APPROVAL_REQUIRED', approvalAuthority: request.operationRecord.approvalAuthority
    } }), bindMutationProviderRuntime({ ...baseRuntime,
      mutationJournalAdapter: failingJournal(baseRuntime.mutationJournalAdapter, 'FINALIZED_FAILED') },
    createQualifiedTestMutationProvider()));
    assert.equal(result.orchestration.status, 'FAILED');
    assert.equal(fs.readFileSync(path.join(repo, 'target.js'), 'utf8'), 'const value = 1;\n');
    const second = orchestrate(input(repo, request, { risk: 'ALTO', policy: {
      decision: 'APPROVAL_REQUIRED', approvalAuthority: request.operationRecord.approvalAuthority
    } }), baseRuntime);
    assert.equal(second.orchestration.status, 'FAILED');
    assert.match(second.execution.reason, /journal|contended/i);
  }));

test('expiry at final pre-commit recheck preserves zero physical mutation', () =>
  withFixture((repo) => {
    const request = r3Execution(repo);
    const start = new Date(Date.parse(EXPIRY) - 3).toISOString();
    const result = orchestrate(input(repo, request, { risk: 'ALTO', policy: {
      decision: 'APPROVAL_REQUIRED', approvalAuthority: request.operationRecord.approvalAuthority
    } }), r3Runtime(request, { authoritativeClock: clockAt(start, 1) }));
    assert.equal(result.orchestration.status, 'FAILED');
    assert.equal(result.execution.errorEvidence.payload.temporalAuthority.decision, 'DENIED');
    assert.equal(result.governed.operationRecord.finalization.outcome, 'FAILED');
    assert.equal(fs.readFileSync(path.join(repo, 'target.js'), 'utf8'), 'const value = 1;\n');
  }));

test('caller time cannot extend R3 mutation authority', () => withFixture((repo) => {
  const request = r3Execution(repo, { now: '2020-01-01T00:00:00.000Z' });
  const result = orchestrate(input(repo, request, { risk: 'ALTO', policy: {
    decision: 'APPROVAL_REQUIRED', approvalAuthority: request.operationRecord.approvalAuthority
  } }), r3Runtime(request, { authoritativeClock: clockAt(EXPIRY) }));
  assert.equal(result.orchestration.status, 'DENIED');
  assert.equal(fs.readFileSync(path.join(repo, 'target.js'), 'utf8'), 'const value = 1;\n');
}));

test('identical completed patch replay performs zero duplicate mutation', (context) =>
  withFixture((repo) => {
    const request = r3Execution(repo);
    const governedInput = input(repo, request, { risk: 'ALTO', policy: {
      decision: 'APPROVAL_REQUIRED', approvalAuthority: request.operationRecord.approvalAuthority
    } });
    const runtime = r3Runtime(request);
    const first = orchestrate(governedInput, runtime);
    let calls = 0;
    context.mock.method(filesystemPatchAdapter, 'patchFileWithGrant', () => { calls += 1; });
    const replayRequest = { ...request, operationRecord: first.governed.operationRecord,
      lifecycle: first.governed.lifecycle };
    const replay = orchestrate(input(repo, replayRequest, { risk: 'ALTO', policy: {
      decision: 'APPROVAL_REQUIRED', approvalAuthority: request.operationRecord.approvalAuthority
    } }), runtime);
    assert.equal(replay.orchestration.status, 'COMPLETED');
    assert.equal(replay.orchestration.executionAttempted, false);
    assert.equal(replay.governed.replay, true);
    assert.equal(calls, 0);
  }));

test('conflicting completed patch replay fails closed before dispatch', (context) =>
  withFixture((repo) => {
    const request = r3Execution(repo);
    const first = orchestrate(input(repo, request, { risk: 'ALTO', policy: {
      decision: 'APPROVAL_REQUIRED', approvalAuthority: request.operationRecord.approvalAuthority
    } }), r3Runtime(request));
    let calls = 0;
    context.mock.method(filesystemPatchAdapter, 'patchFileWithGrant', () => { calls += 1; });
    const conflicting = { ...request, replacement: 'const value = 3;\n',
      operationRecord: first.governed.operationRecord, lifecycle: first.governed.lifecycle };
    const result = orchestrate(input(repo, conflicting, { risk: 'ALTO', policy: {
      decision: 'APPROVAL_REQUIRED', approvalAuthority: request.operationRecord.approvalAuthority
    } }), r3Runtime(conflicting));
    assert.equal(result.orchestration.status, 'DENIED');
    assert.equal(calls, 0);
  }));

test('untrusted identity and stale target produce zero patch dispatch', (context) =>
  withFixture((repo) => {
    const request = r3Execution(repo);
    let calls = 0;
    context.mock.method(filesystemPatchAdapter, 'patchFileWithGrant', () => { calls += 1; });
    const untrusted = orchestrate(input(repo, request, { risk: 'ALTO', policy: {
      decision: 'APPROVAL_REQUIRED', approvalAuthority: request.operationRecord.approvalAuthority
    } }), r3Runtime(request, { trustedIdentityIssuers: ['issuer:other'] }));
    assert.notEqual(untrusted.orchestration.status, 'COMPLETED');
    fs.writeFileSync(path.join(repo, 'target.js'), 'stale\n');
    const stale = orchestrate(input(repo, request, { risk: 'ALTO', policy: {
      decision: 'APPROVAL_REQUIRED', approvalAuthority: request.operationRecord.approvalAuthority
    } }), r3Runtime(request));
    assert.notEqual(stale.orchestration.status, 'COMPLETED');
    assert.equal(calls, 0);
  }));

test('R1 and R2 patch requests produce zero physical dispatch', (context) =>
  withFixture((repo) => {
    const request = r3Execution(repo);
    let calls = 0;
    context.mock.method(filesystemPatchAdapter, 'patchFileWithGrant', () => { calls += 1; });
    for (const [riskLevel, risk] of [['R1', 'BAIXO'], ['R2', 'MÉDIO']]) {
      const grantEvaluation = frozen({ ...request.grantEvaluation,
        grant: { ...request.grantEvaluation.grant, riskLevel } });
      const result = orchestrate(input(repo, { ...request, grantEvaluation }, {
        risk, policy: { decision: 'ALLOW' }
      }), r3Runtime(request));
      assert.notEqual(result.orchestration.status, 'COMPLETED');
    }
    assert.equal(calls, 0);
  }));

test('patch identity authority grant scope and lifecycle mismatches dispatch zero times', (context) =>
  withFixture((repo) => {
    const request = r3Execution(repo);
    let calls = 0;
    context.mock.method(filesystemPatchAdapter, 'patchFileWithGrant', () => { calls += 1; });
    const policy = { decision: 'APPROVAL_REQUIRED',
      approvalAuthority: request.operationRecord.approvalAuthority };
    const cases = [
      [{ ...request, operationId: 'other' }, r3Runtime(request)],
      [{ ...request, workspace: fs.realpathSync(os.tmpdir()) }, r3Runtime(request)],
      [{ ...request, projectId: 'other' }, r3Runtime(request)],
      [{ ...request, target: 'invalid.js' }, r3Runtime(request)],
      [{ ...request, grantEvaluation: null }, r3Runtime(request)],
      [request, r3Runtime(request, { authoritativeClock: clockAt(EXPIRY) })],
      [{ ...request, lifecycle: frozen({ ...request.lifecycle, status: 'NOT_EXECUTABLE' }) },
        r3Runtime(request)],
      [request, r3Runtime(request, { identityAudience: 'wrong-audience' })]
    ];
    for (const [candidate, runtime] of cases) {
      const result = orchestrate(input(repo, candidate, { risk: 'ALTO', policy }), runtime);
      assert.notEqual(result.orchestration.status, 'COMPLETED');
    }
    assert.equal(calls, 0);
  }));

test('patch recovery evidence finalizes only as FAILED', (context) => {
  for (const recovery of ['RESTORED', 'NOT_ATTEMPTED_UNPROVEN_OWNERSHIP']) {
    withFixture((repo) => {
      const request = r3Execution(repo);
      context.mock.method(filesystemPatchAdapter, 'patchFileWithGrant', (_input, temporal) => {
        temporal.mutationTransaction.advance('BEFORE_VERIFIED');
        temporal.mutationTransaction.advance('MUTATION_STARTED');
        const commitEvaluation = commitTemporal(request).evaluation;
        const commitAuthority = temporal.mutationTransaction.verifyCommitAuthority({
          policyDecision: 'ALLOWED', riskLevel: 'R3', capabilityType: 'FILESYSTEM_PATCH',
          action: 'PATCH_FILE', scope: request.grantEvaluation.grant.scope,
          authoritativeEvaluation: commitEvaluation
        });
        temporal.mutationTransaction.advance('PHYSICAL_APPLIED');
        temporal.mutationTransaction.requireRecovery();
        if (recovery === 'RESTORED') temporal.mutationTransaction.advance('RECOVERED');
        const state = temporal.mutationTransaction.current();
        const error = new Error('AFTER verification failed');
        error.evidence = frozen({ schema: 'sdo.filesystem_patch_result.v1',
          operationId: 'op-1', workspace: repo,
          target: { requested: 'target.js', canonical: path.join(repo, 'target.js') },
          beforeSha256: request.grantEvaluation.grant.scope.target.beforeSha256,
          afterSha256: request.grantEvaluation.grant.scope.target.replacementSha256,
          outcome: 'FAILED', recovery, observedAt: NOW,
          temporalAuthority: frozen({ schema: 'sdo.mutation_commit_authority.v1',
            commitBoundary: 'IMMEDIATELY_BEFORE_ATOMIC_REPLACEMENT',
            physicalCommit: 'APPLIED', decision: 'ALLOWED', evaluation: commitEvaluation }),
          commitAuthority, transaction: {
            transactionId: state.transaction.transactionId,
            journalId: state.journal.journalId,
            stage: state.transaction.stage,
            lockId: state.transaction.lock.lockId,
            commitAuthorityFingerprint: commitAuthority.fingerprint,
            classification: state.transaction.stage === 'RECOVERY_REQUIRED'
              ? 'RECOVERY_REQUIRED' : 'IN_PROGRESS'
          } });
        throw error;
      });
      const result = orchestrate(input(repo, request, { risk: 'ALTO', policy: {
        decision: 'APPROVAL_REQUIRED', approvalAuthority: request.operationRecord.approvalAuthority
      } }), r3Runtime(request));
      assert.equal(result.orchestration.status, 'FAILED');
      assert.equal(result.governed.lifecycle.status, 'FAILED');
      assert.equal(result.governed.operationRecord.finalization &&
        result.governed.operationRecord.finalization.successfulCompletionEligible, false,
      JSON.stringify(result.execution));
      assert.equal(result.governed.operationRecord.finalization.mutationTransaction.lockDisposition,
        recovery === 'RESTORED' ? 'RELEASED' : 'RETAINED');
      context.mock.restoreAll();
    });
  }
});

test('boolean, missing or invalid R3 approval cannot authorize or self-approve', (context) =>
  withFixture((repo) => {
    const request = r3Execution(repo);
    let calls = 0;
    context.mock.method(filesystemPatchAdapter, 'patchFileWithGrant', () => { calls += 1; });
    for (const policy of [
      { decision: 'APPROVAL_REQUIRED', approved: true },
      { decision: 'APPROVAL_REQUIRED' },
      { decision: 'APPROVAL_REQUIRED', approvalAuthority: { ...request.operationRecord.approvalAuthority,
        approver: { id: 'agent-1', type: 'AGENT' } } }
    ]) {
      const result = orchestrate(input(repo, request, { risk: 'ALTO', policy }), r3Runtime(request));
      assert.notEqual(result.orchestration.status, 'COMPLETED');
      assert.notEqual(result.governed && result.governed.approvalAuthorityRecognized, true);
    }
    assert.equal(calls, 0);
  }));

test('authentication alone does not authorize mutation', (context) => withFixture((repo) => {
  const request = r3Execution(repo);
  let calls = 0;
  context.mock.method(filesystemPatchAdapter, 'patchFileWithGrant', () => { calls += 1; });
  const identityOnly = request.operationRecord.verifiedIdentityAssertion;
  const result = orchestrate(input(repo, request, { risk: 'ALTO', policy: {
    decision: 'APPROVAL_REQUIRED', verifiedIdentityAssertion: identityOnly
  } }), r3Runtime(request));
  assert.notEqual(result.orchestration.status, 'COMPLETED');
  assert.notEqual(result.governed && result.governed.approvalAuthorityRecognized, true);
  assert.equal(calls, 0);
}));

test('tenant and verified assertion grant-link substitution fail closed', () =>
  withFixture((repo) => {
    const request = r3Execution(repo);
    const wrongTenant = orchestrate(input(repo, { ...request, tenantId: 'other' }, {
      risk: 'ALTO', policy: { decision: 'APPROVAL_REQUIRED',
        approvalAuthority: request.operationRecord.approvalAuthority }
    }), r3Runtime(request));
    assert.notEqual(wrongTenant.orchestration.status, 'COMPLETED');

    const substitutedGrant = frozen({ ...request.grantEvaluation,
      grant: { ...request.grantEvaluation.grant,
        verifiedIdentityAssertionFingerprint: 'f'.repeat(64) } });
    const substituted = orchestrate(input(repo, { ...request, grantEvaluation: substitutedGrant }, {
      risk: 'ALTO', policy: { decision: 'APPROVAL_REQUIRED',
        approvalAuthority: request.operationRecord.approvalAuthority }
    }), r3Runtime(request));
    assert.notEqual(substituted.orchestration.status, 'COMPLETED');
    assert.notEqual(substituted.governed && substituted.governed.approvalAuthorityRecognized, true);
  }));

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

test('structured adapter error evidence is preserved and remains failure-only',
  (context) => withFixture((repo) => {
    context.mock.method(gitReadAdapter, 'readGitWithGrant', (request) => {
      const error = new Error('verification failed');
      error.evidence = frozen({
        schema: 'sdo.controlled_failure.v1', operationId: request.operationId,
        workspace: request.workspace, outcome: 'FAILED', recovery: 'RESTORED'
      });
      throw error;
    });
    const result = orchestrate(input(repo, execution(repo, 'GIT_READ')));
    assert.equal(result.orchestration.status, 'FAILED');
    assert.equal(result.execution.errorEvidence.outcome, 'FAILED');
    assert.equal(result.execution.errorEvidence.payload.recovery, 'RESTORED');
    assert.ok(Object.isFrozen(result.execution.errorEvidence));
  }));

test('mutable or unbound structured error evidence fails closed', () => withFixture((repo) => {
  const error = Object.assign(new Error('failed'), {
    evidence: { operationId: 'op-1', workspace: repo }
  });
  assert.throws(() => preserveControlledErrorEvidence(error, execution(repo, 'GIT_READ')),
    /mutable or unbound/);
}));

test('filesystem-patch replay identity includes replacement hash', () => withFixture((repo) => {
  const base = execution(repo, 'FILESYSTEM_READ');
  const grantEvaluation = frozen({
    schema: 'sdo.capability_grant_evaluation.v1', decision: 'ALLOWED',
    grant: { scope: { target: { beforeSha256: 'a'.repeat(64) } } }
  });
  const patch = {
    ...base, adapter: 'FILESYSTEM_PATCH', action: 'PATCH_FILE', grantEvaluation,
    target: 'target.js', replacement: 'after\n'
  };
  const identical = { ...patch, replacement: 'after\n' };
  const conflicting = { ...patch, replacement: 'different\n' };
  assert.equal(evidenceIdentity(patch, 'b'.repeat(64)),
    evidenceIdentity(identical, 'b'.repeat(64)));
  assert.notEqual(evidenceIdentity(patch, 'b'.repeat(64)),
    evidenceIdentity(conflicting, 'b'.repeat(64)));
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

test('workspace identity boundary accepts equivalent native identity without weakening evidence binding',
  (context) => withFixture((repo) => {
    const request = execution(repo, 'FILESYSTEM_READ');

    /*
     * The controlled-request boundary owns physical/native workspace
     * identity comparison. Evidence binding remains textual and exact.
     *
     * This test proves that the integration remains routed through the
     * explicit PathIdentityAuthority rather than introducing ad-hoc
     * workspace normalization into evidence contracts.
     */
    const result = orchestrate(input(repo, request));

    assert.equal(result.orchestration.status, 'COMPLETED');
    assert.equal(result.execution.workspace, request.workspace);
    assert.equal(result.governed.operationRecord.workspace, request.workspace);
  }));


test('orchestrator accepts a lexical workspace alias only when it resolves to the authorized physical repository',
  (context) => withFixture((repo) => {
    const aliasParent = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-orchestrator-alias-parent-'));
    const alias = path.join(aliasParent, 'repository-link');

    context.after(() => {
      fs.rmSync(aliasParent, { recursive: true, force: true });
    });

    try {
      fs.symlinkSync(repo, alias, 'dir');
    } catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
        return context.skip('Symlink creation is unavailable on this platform.');
      }
      throw error;
    }

    const request = execution(alias, 'FILESYSTEM_READ', { lifecycle: lifecycle(repo) });
    const result = orchestrate(input(alias, request));

    assert.equal(result.orchestration.status, 'COMPLETED');
    assert.equal(fs.realpathSync(request.workspace), repo);
    assert.equal(result.governed.operationRecord.workspace, repo);
  }));

test('GIT_READ accepts explicit repository scope without a fictitious target file',
  () => withFixture((repo) => {
    const request = execution(repo, 'GIT_READ');

    const result = orchestrate(
      input(repo, request)
    );

    assert.equal(
      result.pipeline.inspection.inspection.scope,
      'REPOSITORY'
    );

    assert.deepEqual(
      result.pipeline.inspection.inspection.files,
      []
    );

    assert.equal(
      result.orchestration.status,
      'COMPLETED'
    );
  }));

test('GIT_READ repository scope rejects simultaneous target files',
  () => withFixture((repo) => {
    const request = execution(repo, 'GIT_READ');

    assert.throws(
      () => orchestrate(
        input(repo, request, {
          files: ['target.js']
        })
      ),
      /Repository-scoped GIT_READ cannot declare target files/
    );
  }));

test('FILESYSTEM_READ still requires an explicit target file',
  () => withFixture((repo) => {
    const request = execution(repo, 'FILESYSTEM_READ');

    assert.throws(
      () => orchestrate(
        input(repo, request, { files: [] })
      ),
      /At least one target file/
    );
  }));

test('PROCESS_VALIDATION still requires an explicit target file',
  () => withFixture((repo) => {
    const request = execution(repo, 'PROCESS_VALIDATION');

    assert.throws(
      () => orchestrate(
        input(repo, request, { files: [] })
      ),
      /At least one target file/
    );
  }));


test('H: R3 orchestrator commits content-addressed authority while ordinary worktree stays non-authoritative',
  () => withFixture((repo) => {
    const request = r3Execution(repo);
    const runtime = r3Runtime(request, {
      mutationProvider: contentAddressedProviderBoundary
    });

    const result = orchestrate(
      input(repo, request, {
        risk: 'ALTO',
        policy: {
          decision: 'APPROVAL_REQUIRED',
          approvalAuthority: request.operationRecord.approvalAuthority
        }
      }),
      runtime
    );

    assert.equal(
      result.orchestration.status,
      'COMPLETED',
      JSON.stringify(result.execution)
    );
    assert.equal(result.execution.outcome, 'APPLIED');
    assert.equal(result.governed.lifecycle.status, 'COMPLETED');
    assert.equal(result.governed.operationRecord.finalization.outcome, 'SUCCESS');

    assert.equal(
      result.governed.operationRecord.finalization.mutationTransaction.stage,
      'FINALIZED_SUCCESS'
    );
    assert.equal(
      result.governed.operationRecord.finalization.mutationTransaction.lockDisposition,
      'RELEASED'
    );

    assert.equal(
      fs.readFileSync(path.join(repo, 'target.js'), 'utf8'),
      'const value = 1;\n',
      'ordinary worktree must remain non-authoritative'
    );

    const provider = result.execution.mutationProvider;
    assert.ok(provider);
    assert.equal(provider.providerId, 'sdo:git-manifest-cas-v1');

    const authority = provider.durability;
    assert.equal(authority.schema, 'sdo.content_addressed_provider_evidence.v1');
    assert.equal(authority.ordinaryWorktreeAuthoritative, false);
    assert.equal(authority.authority.decision, 'APPLIED');

    assert.ok(
      ['MATERIALIZED', 'ALREADY_MATERIALIZED']
        .includes(authority.materialization.decision)
    );

    assert.equal(
      fs.readFileSync(authority.materialization.projection, 'utf8'),
      'const value = 2;\n'
    );

    assert.equal(
      authority.materialization.contentSha256,
      request.grantEvaluation.grant.scope.target.replacementSha256
    );

    assert.equal(
      authority.materialization.expectedManifestOid,
      authority.authority.afterManifestOid
    );

    assert.equal(
      authority.materialization.observedManifestOid,
      authority.authority.afterManifestOid
    );
  }));

test('H: finalized R3 replay proves manifest authority instead of ordinary pathname',
  () => withFixture((repo) => {
    const request = r3Execution(repo);
    const runtime = r3Runtime(request, {
      mutationProvider: contentAddressedProviderBoundary
    });

    const policy = {
      decision: 'APPROVAL_REQUIRED',
      approvalAuthority: request.operationRecord.approvalAuthority
    };

    const first = orchestrate(
      input(repo, request, { risk: 'ALTO', policy }),
      runtime
    );

    assert.equal(first.orchestration.status, 'COMPLETED');
    assert.equal(
      fs.readFileSync(path.join(repo, 'target.js'), 'utf8'),
      'const value = 1;\n'
    );

    const replayRequest = {
      ...request,
      operationRecord: first.governed.operationRecord,
      lifecycle: first.governed.lifecycle
    };

    const replay = orchestrate(
      input(repo, replayRequest, { risk: 'ALTO', policy }),
      runtime
    );

    assert.equal(replay.orchestration.status, 'COMPLETED');
    assert.equal(replay.orchestration.executionAttempted, false);
    assert.equal(replay.governed.replay, true);

    assert.equal(
      replay.execution.mutationProvider.durability
        .ordinaryWorktreeAuthoritative,
      false
    );

    assert.equal(
      fs.readFileSync(path.join(repo, 'target.js'), 'utf8'),
      'const value = 1;\n'
    );
  }));

test('H: corrupt managed projection cannot replay a finalized R3 mutation as success',
  () => withFixture((repo) => {
    const request = r3Execution(repo);
    const runtime = r3Runtime(request, {
      mutationProvider: contentAddressedProviderBoundary
    });

    const policy = {
      decision: 'APPROVAL_REQUIRED',
      approvalAuthority: request.operationRecord.approvalAuthority
    };

    const first = orchestrate(
      input(repo, request, { risk: 'ALTO', policy }),
      runtime
    );

    assert.equal(first.orchestration.status, 'COMPLETED');

    const projection =
      first.execution.mutationProvider.durability.materialization.projection;

    fs.writeFileSync(projection, 'tampered projection\n');

    const replayRequest = {
      ...request,
      operationRecord: first.governed.operationRecord,
      lifecycle: first.governed.lifecycle
    };

    const replay = orchestrate(
      input(repo, replayRequest, { risk: 'ALTO', policy }),
      runtime
    );

    assert.notEqual(replay.orchestration.status, 'COMPLETED');
    assert.equal(replay.orchestration.executionAttempted, false);

    assert.equal(
      fs.readFileSync(path.join(repo, 'target.js'), 'utf8'),
      'const value = 1;\n'
    );
  }));
