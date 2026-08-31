'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const gateway = require('../../accelerator/core/integrated-governed-agent-gateway');
const surgicalOrchestrator = require('../../accelerator/core/surgical-orchestrator');
const {
  createDeterministicWorkspaceSession
} = require('../../accelerator/adapters/deterministic-workspace-session-adapter');
const {
  createNaturalAgenticMission,
  updateNaturalAgenticMissionPlan,
  cancelNaturalAgenticMission
} = require('../../accelerator/core/natural-agentic-mission');
const {
  createNaturalSessionControl
} = require('../../accelerator/cli/natural-session-control');

const NOW = '2099-01-01T00:00:00.000Z';
const LATER = '2099-01-01T00:01:00.000Z';
const EXPIRY = '2099-01-01T00:10:00.000Z';

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function git(cwd, args) {
  const result = childProcess.spawnSync('git', args, {
    cwd,
    shell: false,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-gateway-'));
  fs.writeFileSync(path.join(root, 'safe.js'), 'module.exports = 1;\n');
  fs.writeFileSync(
    path.join(root, 'sample.test.js'),
    "'use strict';\n" +
      "const test = require('node:test');\n" +
      "const assert = require('node:assert/strict');\n" +
      "test('gateway fixture passes', () => assert.equal(1, 1));\n"
  );
  fs.writeFileSync(
    path.join(root, 'secret.txt'),
    'client_secret=must-never-reach-provider-123456789\n'
  );
  fs.writeFileSync(
    path.join(root, 'private-key.txt'),
    '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----\n'
  );
  git(root, ['init']);
  git(root, ['config', 'user.email', 'tests@example.invalid']);
  git(root, ['config', 'user.name', 'Surgical Tests']);
  git(root, ['add', 'safe.js', 'sample.test.js', 'secret.txt', 'private-key.txt']);
  git(root, ['commit', '-m', 'fixture']);
  return fs.realpathSync(root);
}

function mission(root, overrides = {}) {
  const session = createDeterministicWorkspaceSession({
    authorizedRoot: root,
    humanSubject: 'gateway-test-human',
    authorizedAt: NOW
  });
  return createNaturalAgenticMission({
    missionId: overrides.missionId || 'gateway-mission',
    objective: 'Exercise integrated governed gateway.',
    session,
    createdAt: NOW,
    plan: [
      { stepId: 'audit', summary: 'Audit workspace through gateway.', status: 'ACTIVE' },
      { stepId: 'qualify', summary: 'Run governed qualification.', status: 'PENDING' }
    ],
    authority: overrides.authority || {},
    provider: overrides.provider || {}
  });
}

function request(current, operation, args = {}, extra = {}) {
  return gateway.createGatewayRequest({
    requestId: `${operation}-${sha(JSON.stringify(args)).slice(0, 12)}`,
    mission: current,
    operation,
    args,
    requestedAt: NOW,
    ...extra
  });
}

function dispatch(current, operation, args = {}, options = {}, extra = {}) {
  return gateway.dispatchGatewayRequest({
    request: request(current, operation, args, extra),
    mission: current,
    options: {
      now: () => LATER,
      ...options
    }
  });
}

test('structured request accepts a valid registered tool and malformed requests fail closed', () => {
  const root = fixture();
  try {
    const current = mission(root);
    const valid = request(current, 'workspace.status');
    assert.equal(valid.schema, gateway.REQUEST_SCHEMA);
    assert.equal(valid.operation, 'workspace.status');
    assert.equal(valid.modelDirectFilesystem, false);

    const malformed = gateway.dispatchGatewayRequest({
      request: freeze({}),
      mission: current,
      options: { now: () => LATER }
    });
    assert.equal(malformed.result.classification, 'DENIED');

    assert.throws(
      () => request(current, 'workspace.destroy'),
      /unsupported/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('known but unauthorized tools missing mission binding stale state and CAS mismatch fail closed', () => {
  const root = fixture();
  try {
    const limited = mission(root, {
      authority: {
        allowedCapabilities: ['mission.status', 'authority.inspect']
      }
    });
    const denied = dispatch(limited, 'workspace.read', { target: 'safe.js' });
    assert.equal(denied.result.classification, 'DENIED');
    assert.equal(denied.result.events.at(-1).type, 'OPERATION_DENIED');

    const otherMission = mission(root, { missionId: 'other-mission' });
    const wrongMission = gateway.dispatchGatewayRequest({
      request: request(limited, 'mission.status'),
      mission: otherMission,
      options: { now: () => LATER }
    });
    assert.equal(wrongMission.result.classification, 'DENIED');

    const staleRequest = request(limited, 'mission.status');
    const changed = updateNaturalAgenticMissionPlan(limited, {
      at: LATER,
      plan: [
        { stepId: 'audit', summary: 'Audit workspace through gateway.', status: 'COMPLETED' }
      ]
    });
    const stale = gateway.dispatchGatewayRequest({
      request: staleRequest,
      mission: changed,
      options: { now: () => '2099-01-01T00:02:00.000Z' }
    });
    assert.equal(stale.result.classification, 'STALE_STATE');

    const cas = dispatch(limited, 'workspace.status', {
      expectedCas: { repositoryHead: '0'.repeat(40) }
    });
    assert.equal(cas.result.classification, 'CAS_MISMATCH');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('workspace.status vertical slice reaches the Surgical Orchestrator without copy paste', () => {
  const root = fixture();
  try {
    const current = mission(root);
    const result = dispatch(current, 'workspace.status');
    assert.equal(result.result.classification, 'SUCCESS', result.result.reason);
    assert.equal(result.result.copyPasteRequired, false);
    assert.equal(result.result.modelDirectFilesystem, false);
    assert.equal(result.result.data.kind, 'WORKSPACE_STATUS');
    assert.equal(result.result.data.orchestratorStatus, 'COMPLETED');
    assert.deepEqual(result.result.events.map((event) => event.type), [
      'OPERATION_STARTED',
      'OPERATION_COMPLETED'
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('governed search read diff and aliases normalize evidence before cognition', () => {
  const root = fixture();
  try {
    const current = mission(root);
    const search = dispatch(current, 'workspace.search', { query: 'safe', limit: 10 });
    assert.equal(search.result.classification, 'SUCCESS');
    assert.deepEqual(search.result.data.results, ['safe.js']);

    const read = dispatch(current, 'workspace.read', { target: 'safe.js' });
    assert.equal(read.result.classification, 'SUCCESS');
    assert.equal(read.result.data.providerSafe, true);
    assert.match(read.result.data.content, /module\.exports/);

    fs.appendFileSync(path.join(root, 'safe.js'), 'const changed = true;\n');
    const changedMission = mission(root, { missionId: 'changed-worktree' });
    const diff = dispatch(changedMission, 'git.diff');
    assert.equal(diff.result.classification, 'SUCCESS', diff.result.reason);
    assert.equal(diff.result.data.rawPatchOmittedFromCognition, true);
    assert.equal(typeof diff.result.data.patchSha256, 'string');

    const status = dispatch(changedMission, 'git.status');
    assert.equal(status.result.classification, 'SUCCESS');
    assert.equal(status.result.data.kind, 'WORKSPACE_STATUS');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('sensitive governed reads redact or block before provider exposure', () => {
  const root = fixture();
  try {
    const current = mission(root);
    const redacted = dispatch(current, 'workspace.read', { target: 'secret.txt' });
    assert.equal(redacted.result.classification, 'SUCCESS');
    assert.equal(redacted.result.data.sensitiveDecision, 'REDACTED');
    assert.doesNotMatch(redacted.result.data.content, /must-never-reach-provider/);
    assert.match(redacted.result.data.content, /REDACTED_BY_SURGICAL_DEVOPS/);

    const blocked = dispatch(current, 'workspace.read', { target: 'private-key.txt' });
    assert.equal(blocked.result.classification, 'DENIED');
    assert.equal(blocked.result.data.providerSafe, false);
    assert.equal(blocked.result.data.content, null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('tests.run invokes a real governed Node test file and records mission test state', () => {
  const root = fixture();
  try {
    const current = mission(root);
    const result = dispatch(current, 'tests.run', { target: 'sample.test.js' });
    assert.equal(result.result.classification, 'SUCCESS', result.result.reason);
    assert.equal(result.result.data.selector, 'NODE_TEST_FILE');
    assert.equal(result.result.data.status, 'PASSED');
    assert.equal(result.result.data.rawOutputOmittedFromCognition, true);
    assert.equal(result.mission.state, 'TESTING');
    assert.equal(result.mission.tests.lastResult.classification, 'PASSED');
    assert.deepEqual(result.result.events.map((event) => event.type), [
      'TEST_STARTED',
      'TEST_PASSED'
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('contextual approval preserves local commit push and mutation boundaries', () => {
  const root = fixture();
  try {
    const current = mission(root);
    const approval = dispatch(current, 'authority.request', {
      operation: 'git.commit',
      reason: 'Create the local checkpoint after green qualification.',
      scope: { paths: ['safe.js'] }
    });
    assert.equal(approval.result.classification, 'AUTHORITY_REQUIRED');
    assert.equal(approval.result.approvalRequest.operation, 'git.commit');
    assert.ok(approval.result.approvalRequest.authorityNotGranted.includes('git.push'));
    assert.equal(approval.result.approvalRequest.localCommitDoesNotGrantPush, true);
    assert.equal(approval.result.approvalRequest.testExecutionDoesNotGrantArbitraryShell, true);

    const directCommit = dispatch(current, 'git.commit', { message: 'checkpoint' });
    assert.equal(directCommit.result.classification, 'DENIED');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('mutation.applyConditional remains routed through existing orchestrator and consumes one-shot authority', (context) => {
  const root = fixture();
  try {
    const current = mission(root, {
      authority: {
        allowedCapabilities: [
          'mutation.applyConditional',
          'mission.status',
          'authority.inspect'
        ],
        grants: [
          {
            authorityRef: 'exact-r3-once',
            capability: 'mutation.applyConditional',
            issuedAt: NOW,
            expiresAt: EXPIRY,
            lifetime: 'ONE_SHOT',
            authorityNotGranted: ['git.push', 'npm.publish']
          }
        ]
      }
    });
    let calls = 0;
    context.mock.method(surgicalOrchestrator, 'orchestrate', () => {
      calls += 1;
      return freeze({
        schema: 'sdo.orchestration.v1',
        orchestration: {
          status: 'COMPLETED',
          executionAttempted: true,
          executionAllowed: true
        },
        execution: {
          schema: 'sdo.filesystem_patch_result.v1'
        },
        governed: {
          operationRecord: { version: 2 }
        }
      });
    });

    const args = {
      expectedCas: {
        repositoryHead: current.binding.repositoryHead,
        worktreeFingerprint: current.binding.worktreeFingerprint
      },
      orchestratorInput: {
        repositoryPath: root,
        description: 'Existing exact R3 orchestrator input.',
        files: ['safe.js']
      }
    };
    const applied = gateway.dispatchGatewayRequest({
      request: request(current, 'mutation.applyConditional', args, {
        authorityRef: 'exact-r3-once'
      }),
      mission: current,
      options: { now: () => LATER }
    });
    assert.equal(applied.result.classification, 'SUCCESS');
    assert.equal(calls, 1);
    assert.ok(applied.mission.authority.usedAuthorityRefs.includes('exact-r3-once'));

    const replay = gateway.dispatchGatewayRequest({
      request: request(applied.mission, 'mutation.applyConditional', args, {
        authorityRef: 'exact-r3-once'
      }),
      mission: applied.mission,
      options: { now: () => '2099-01-01T00:02:00.000Z' }
    });
    assert.equal(replay.result.classification, 'AUTHORITY_REQUIRED');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resume revalidates physical state and cancelled missions reject stale continuations', () => {
  const root = fixture();
  try {
    const current = mission(root);
    const resumed = dispatch(current, 'mission.resume');
    assert.equal(resumed.result.classification, 'SUCCESS');
    assert.equal(resumed.mission.resumeCount, 1);
    assert.equal(resumed.result.events.at(-1).type, 'WORKSPACE_VALIDATED');

    const invalid = dispatch(current, 'mission.resume', {}, {
      revalidateSession() {
        return freeze({
          schema: 'sdo.deterministic_workspace_session_revalidation.v1',
          decision: 'INVALIDATED',
          sessionFingerprint: current.binding.sessionFingerprint,
          operationalAuthority: false,
          mutationAuthority: false
        });
      }
    });
    assert.equal(invalid.result.classification, 'STALE_STATE');
    assert.equal(invalid.mission.state, 'BLOCKED');

    const cancelled = cancelNaturalAgenticMission(current, {
      reason: 'Human cancelled mission.',
      at: LATER
    });
    const stale = gateway.dispatchGatewayRequest({
      request: request(cancelled, 'workspace.status'),
      mission: cancelled,
      options: { now: () => '2099-01-01T00:02:00.000Z' }
    });
    assert.equal(stale.result.classification, 'STALE_STATE');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('local deterministic fast path avoids provider calls and keeps deterministic state intact', () => {
  const root = fixture();
  try {
    const current = mission(root, {
      provider: { providerId: 'failing-provider', providerKind: 'REMOTE' }
    });
    let providerCalls = 0;
    const result = dispatch(current, 'mission.status', {}, {
      provider: {
        ask() {
          providerCalls += 1;
          throw new Error('provider should not run');
        }
      },
      monotonicMs: (() => {
        const values = [10, 20, 30];
        return () => values.shift() || 30;
      })()
    });
    assert.equal(result.result.classification, 'SUCCESS');
    assert.equal(result.result.providerInvoked, false);
    assert.equal(result.result.data.localDeterministicFastPath, true);
    assert.equal(providerCalls, 0);
    assert.equal(result.mission.missionFingerprint, current.missionFingerprint);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('streaming emits first useful progress before long operation completion', async () => {
  const root = fixture();
  try {
    const current = mission(root);
    const currentRequest = request(current, 'mission.status');
    let resolveOperation;
    let operationCompleted = false;
    const pending = new Promise((resolve) => {
      resolveOperation = resolve;
    }).then((value) => {
      operationCompleted = true;
      return value;
    });
    const values = [1, 2];
    const iterator = gateway.streamGatewayRequest({
      request: currentRequest,
      mission: current,
      options: { monotonicMs: () => values.shift() || 2 },
      execute: () => pending
    });
    const first = await iterator.next();
    assert.equal(first.value.done, false);
    assert.equal(first.value.event.type, 'OPERATION_STARTED');
    assert.equal(operationCompleted, false);

    resolveOperation(dispatch(current, 'mission.status'));
    const second = await iterator.next();
    assert.equal(second.value.done, true);
    assert.equal(second.value.event.type, 'OPERATION_COMPLETED');
    assert.equal(second.value.dispatch.result.classification, 'SUCCESS');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('NATURAL control surface exposes projection commands without granting authority', () => {
  const control = createNaturalSessionControl({ workspace: 'gateway-test', language: 'en' });
  for (const [input, projection] of [
    ['/status', 'status'],
    ['/plan', 'plan'],
    ['/changes', 'changes'],
    ['/tests', 'tests'],
    ['/authority', 'authority'],
    ['/journal', 'journal']
  ]) {
    const result = control.handle(input);
    assert.equal(result.action, 'MISSION_PROJECTION');
    assert.equal(result.projection, projection);
    assert.equal(result.authorityExpansion, false);
  }
  const resume = control.handle('/resume');
  assert.equal(resume.action, 'MISSION_RESUME');
  assert.equal(resume.authorityExpansion, false);
});

test('gateway source contains no direct filesystem shell network or push authority', () => {
  const source = fs.readFileSync(
    require.resolve('../../accelerator/core/integrated-governed-agent-gateway'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"]node:fs|child_process|spawn|execSync|fetch\(|node:http|node:https|git push|npm publish/);
});
