'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const memoryApi = require('../../accelerator/cli/natural-governed-project-memory');
const store = require('../../accelerator/adapters/governed-project-memory-store');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const binding = (head = 'head-a') => Object.freeze({
  physicalWorkspaceIdentity: hash('physical-project'),
  repositoryHead: hash(head)
});

function fact(memory, content = 'README describes governed orchestration.') {
  return memoryApi.createGovernedProjectMemoryRecord(memory, {
    memoryClass: 'REPOSITORY_FACT', content, source: 'governed-read',
    evidenceBinding: { repositoryHead: binding().repositoryHead, target: 'README.md', contentSha256: hash(content) },
    createdAt: '2026-08-25T19:00:00.000Z'
  });
}

test('governed project memory persists across restart and remains project confined', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-memory-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let memory = memoryApi.createGovernedProjectMemory(binding());
  memory = memoryApi.rememberGovernedProjectRecord(memory, fact(memory));
  const receipt = store.saveGovernedProjectMemory({ stateRoot: root, memory });
  const reopened = store.loadGovernedProjectMemory({ stateRoot: root, physicalWorkspaceIdentity: binding().physicalWorkspaceIdentity });
  assert.equal(reopened.records.length, 1);
  assert.equal(Object.isFrozen(reopened), true);
  assert.equal(receipt.operationalAuthority, false);
  assert.equal(store.loadGovernedProjectMemory({ stateRoot: root, physicalWorkspaceIdentity: hash('other') }), null);
});

test('repository fact becomes stale after HEAD change and cannot become authority', () => {
  let memory = memoryApi.createGovernedProjectMemory(binding());
  memory = memoryApi.rememberGovernedProjectRecord(memory, fact(memory));
  const records = memoryApi.inspectGovernedProjectMemory(memory, binding('head-b'));
  assert.equal(records[0].stale, true);
  assert.equal(records[0].reusableAsAuthority, false);
  assert.equal(records[0].approvalAuthority, false);
});

test('cognitive summary is an explicit non-authoritative hypothesis', () => {
  const memory = memoryApi.createGovernedProjectMemory(binding());
  const record = memoryApi.createGovernedProjectMemoryRecord(memory, {
    memoryClass: 'COGNITIVE_SUMMARY', content: 'The project may prefer small patches.',
    source: 'qualified-cognitive-provider', createdAt: '2026-08-25T19:00:00.000Z'
  });
  assert.equal(record.hypothesis, true);
  assert.equal(record.authoritative, false);
  assert.equal(record.operationalAuthority, false);
});

test('facts require evidence and secrets or remembered approvals fail closed', () => {
  const memory = memoryApi.createGovernedProjectMemory(binding());
  assert.throws(() => memoryApi.createGovernedProjectMemoryRecord(memory, {
    memoryClass: 'REPOSITORY_FACT', content: 'fact', source: 'model', createdAt: '2026-08-25T19:00:00.000Z'
  }), /evidence binding/i);
  assert.throws(() => memoryApi.createGovernedProjectMemoryRecord(memory, {
    memoryClass: 'HUMAN_PREFERENCE', content: 'api_key=abcdefghijklmnopqrstuvwxyz', source: 'human', createdAt: '2026-08-25T19:00:00.000Z'
  }), /secret/i);
  assert.throws(() => memoryApi.createGovernedProjectMemoryRecord(memory, {
    memoryClass: 'APPROVAL', content: 'approved forever', source: 'human', createdAt: '2026-08-25T19:00:00.000Z'
  }), /not qualified/i);
});

test('user can inspect export correct and delete bounded project memory', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-memory-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let memory = memoryApi.createGovernedProjectMemory(binding());
  const original = fact(memory);
  memory = memoryApi.rememberGovernedProjectRecord(memory, original);
  memory = memoryApi.deleteGovernedProjectRecord(memory, original.recordId);
  const corrected = fact(memory, 'Corrected governed fact.');
  memory = memoryApi.rememberGovernedProjectRecord(memory, corrected);
  assert.match(memoryApi.exportGovernedProjectMemory(memory), /Corrected governed fact/);
  store.saveGovernedProjectMemory({ stateRoot: root, memory });
  assert.equal(store.deleteGovernedProjectMemory({ stateRoot: root, physicalWorkspaceIdentity: binding().physicalWorkspaceIdentity }), true);
  assert.equal(store.loadGovernedProjectMemory({ stateRoot: root, physicalWorkspaceIdentity: binding().physicalWorkspaceIdentity }), null);
});

test('memory APIs expose no execution provider shell network or approval authority', () => {
  assert.deepEqual(Object.keys(memoryApi).filter((key) => typeof memoryApi[key] === 'function').sort(), [
    'createGovernedProjectMemory', 'createGovernedProjectMemoryRecord',
    'deleteGovernedProjectRecord', 'exportGovernedProjectMemory',
    'inspectGovernedProjectMemory', 'rememberGovernedProjectRecord'
  ]);
  const source = fs.readFileSync(require.resolve('../../accelerator/cli/natural-governed-project-memory'), 'utf8');
  assert.doesNotMatch(source, /child_process|fetch\(|node:http|node:https|approve|authorize/);
});
