'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  createNaturalTaskEnvelopeProposal,
  authorizeNaturalTaskEnvelope
} = require('../../accelerator/cli/natural-task-envelope-authorization');
const taskApi = require('../../accelerator/cli/natural-durable-task-state');
const store = require('../../accelerator/adapters/natural-durable-task-state-store');

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const workspace = path.resolve('/tmp/sdo-durable-task');
const identity = hash('physical-workspace');

function authorization() {
  const task = Object.freeze({
    schema: 'sdo.natural_governed_task.v1',
    kind: 'PROJECT_ANALYSIS',
    objective: 'Explain this project.',
    mutating: false,
    operations: []
  });
  const proposal = createNaturalTaskEnvelopeProposal({
    task,
    workspaceRoot: workspace,
    physicalWorkspaceIdentity: identity,
    riskCeiling: 'R0',
    validFrom: '2026-08-26T01:00:00.000Z',
    expiresAt: '2026-08-26T01:30:00.000Z'
  });
  return authorizeNaturalTaskEnvelope(proposal, Object.freeze({
    approved: true,
    proposalFingerprint: proposal.proposalFingerprint,
    humanSubject: 'local-human',
    authorizedAt: '2026-08-26T01:00:01.000Z'
  }));
}

function initial() {
  return taskApi.createNaturalDurableTaskState({
    taskId: hash('task-1'),
    authorization: authorization(),
    createdAt: '2026-08-26T01:00:02.000Z'
  });
}

test('durable task survives process-style reopen and resumes exact stopped state', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-task-state-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let state = initial();
  state = taskApi.appendNaturalDurableTaskTransition(state, {
    type: 'PROGRESS', summary: 'Evidence obtained.', at: '2026-08-26T01:01:00.000Z'
  });
  state = taskApi.appendNaturalDurableTaskTransition(state, {
    type: 'STOPPED', summary: 'Process interruption recorded.', at: '2026-08-26T01:02:00.000Z'
  });
  store.saveNaturalDurableTaskState({ stateRoot: root, state });
  const reopened = store.loadNaturalDurableTaskState({
    stateRoot: root, taskId: state.taskId, physicalWorkspaceIdentity: identity
  });
  const resumed = taskApi.resumeNaturalDurableTaskState(reopened, {
    authorization: authorization(), physicalWorkspaceIdentity: identity,
    resumedAt: '2026-08-26T01:03:00.000Z'
  });
  assert.equal(resumed.status, 'ACTIVE');
  assert.equal(resumed.resumeCount, 1);
  assert.equal(resumed.transitions.length, 3);
  assert.equal(Object.isFrozen(resumed), true);
  store.saveNaturalDurableTaskState({ stateRoot: root, state: resumed });
  const reopenedAgain = store.loadNaturalDurableTaskState({
    stateRoot: root, taskId: state.taskId, physicalWorkspaceIdentity: identity
  });
  assert.equal(reopenedAgain.resumeCount, 1);
  assert.equal(reopenedAgain.transitions[2].type, 'RESUMED');
});

test('committed physical effect fingerprint cannot be replayed after reopen', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-task-state-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const effect = hash('exact-physical-effect');
  let state = taskApi.appendNaturalDurableTaskTransition(initial(), {
    type: 'EFFECT_COMMITTED', summary: 'Exact effect already committed.',
    effectFingerprint: effect, at: '2026-08-26T01:01:00.000Z'
  });
  state = taskApi.appendNaturalDurableTaskTransition(state, {
    type: 'STOPPED', summary: 'Stopped after durable receipt.', at: '2026-08-26T01:02:00.000Z'
  });
  store.saveNaturalDurableTaskState({ stateRoot: root, state });
  const reopened = store.loadNaturalDurableTaskState({
    stateRoot: root, taskId: state.taskId, physicalWorkspaceIdentity: identity
  });
  assert.equal(taskApi.hasCommittedNaturalTaskEffect(reopened, effect), true);
  const resumed = taskApi.resumeNaturalDurableTaskState(reopened, {
    authorization: authorization(), physicalWorkspaceIdentity: identity,
    resumedAt: '2026-08-26T01:03:00.000Z'
  });
  assert.throws(() => taskApi.appendNaturalDurableTaskTransition(resumed, {
    type: 'EFFECT_COMMITTED', summary: 'Attempt duplicate effect.',
    effectFingerprint: effect, at: '2026-08-26T01:04:00.000Z'
  }), /duplicate physical effect replay/i);
});

test('expired substituted or cross-workspace authority cannot resume task', () => {
  const stopped = taskApi.appendNaturalDurableTaskTransition(initial(), {
    type: 'STOPPED', summary: 'Awaiting verified resume.', at: '2026-08-26T01:02:00.000Z'
  });
  assert.throws(() => taskApi.resumeNaturalDurableTaskState(stopped, {
    authorization: authorization(), physicalWorkspaceIdentity: identity,
    resumedAt: '2026-08-26T01:30:00.000Z'
  }), /expired/i);
  assert.throws(() => taskApi.resumeNaturalDurableTaskState(stopped, {
    authorization: authorization(), physicalWorkspaceIdentity: hash('other'),
    resumedAt: '2026-08-26T01:03:00.000Z'
  }), /another physical workspace/i);
  const altered = { ...authorization(), authorizationFingerprint: hash('substitution') };
  Object.freeze(altered);
  assert.throws(() => taskApi.resumeNaturalDurableTaskState(stopped, {
    authorization: altered, physicalWorkspaceIdentity: identity,
    resumedAt: '2026-08-26T01:03:00.000Z'
  }), /exact original authorization/i);
});

test('terminal state cannot resume or transition and silence never means success', () => {
  const stopped = taskApi.appendNaturalDurableTaskTransition(initial(), {
    type: 'STOPPED', summary: 'Interrupted without terminal evidence.', at: '2026-08-26T01:02:00.000Z'
  });
  assert.equal(stopped.status, 'STOPPED');
  assert.notEqual(stopped.status, 'COMPLETED');
  const completed = taskApi.appendNaturalDurableTaskTransition(initial(), {
    type: 'COMPLETED', summary: 'Explicit terminal evidence.', at: '2026-08-26T01:02:00.000Z'
  });
  assert.throws(() => taskApi.resumeNaturalDurableTaskState(completed, {
    authorization: authorization(), physicalWorkspaceIdentity: identity,
    resumedAt: '2026-08-26T01:03:00.000Z'
  }), /terminal/i);
  assert.throws(() => taskApi.appendNaturalDurableTaskTransition(completed, {
    type: 'PROGRESS', summary: 'Illegal continuation.', at: '2026-08-26T01:03:00.000Z'
  }), /terminal/i);
});

test('tampering rollback unsafe storage and conflicting replacement fail closed', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-task-state-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let state = taskApi.appendNaturalDurableTaskTransition(initial(), {
    type: 'PROGRESS', summary: 'First observation.', at: '2026-08-26T01:01:00.000Z'
  });
  store.saveNaturalDurableTaskState({ stateRoot: root, state });
  const conflicting = Object.freeze({ ...state, updatedAt: '2026-08-26T01:01:01.000Z' });
  assert.throws(() => store.saveNaturalDurableTaskState({ stateRoot: root, state: conflicting }), /integrity/i);
  const target = path.join(root, `${state.taskId}.json`);
  const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
  parsed.status = 'COMPLETED';
  fs.writeFileSync(target, JSON.stringify(parsed));
  assert.throws(() => store.loadNaturalDurableTaskState({
    stateRoot: root, taskId: state.taskId, physicalWorkspaceIdentity: identity
  }), /integrity/i);
});

test('durable task APIs expose state only and no execution surface', () => {
  assert.deepEqual(Object.keys(taskApi).filter((key) => typeof taskApi[key] === 'function').sort(), [
    'appendNaturalDurableTaskTransition', 'createNaturalDurableTaskState',
    'hasCommittedNaturalTaskEffect', 'resumeNaturalDurableTaskState',
    'validateNaturalDurableTaskState'
  ]);
  const source = fs.readFileSync(require.resolve('../../accelerator/cli/natural-durable-task-state'), 'utf8');
  assert.doesNotMatch(source, /child_process|fetch\(|node:http|node:https|execSync|spawn|writeFileSync/);
});
