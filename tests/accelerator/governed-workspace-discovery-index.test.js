'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { createGovernedWorkspaceDiscoveryIndex, searchGovernedWorkspaceDiscovery, MAX_FILES } = require('../../accelerator/core/governed-workspace-discovery-index');

const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const binding = Object.freeze({ physicalWorkspaceIdentity: sha('workspace'), repositoryHead: sha('head'), worktreeFingerprint: sha('worktree') });
const gitSha1Binding = Object.freeze({ ...binding, repositoryHead: '1'.repeat(40) });

test('discovery inventory is deterministic sorted deduplicated and excludes sensitive segments', () => {
  const index = createGovernedWorkspaceDiscoveryIndex({ ...binding, files: ['src/z.js', '.git/config', 'src/a.js', 'src/z.js', 'node_modules/x.js'] });
  assert.deepEqual(index.files, ['src/a.js', 'src/z.js']);
  assert.equal(index.observedFiles, 5);
  assert.equal(index.admittedFiles, 2);
  assert.ok(Object.isFrozen(index));
});

test('bounded discovery search is reproducible and reports exhaustion', () => {
  const index = createGovernedWorkspaceDiscoveryIndex({ ...binding, files: ['src/a.test.js', 'src/a.js', 'src/b.test.js'] });
  const first = searchGovernedWorkspaceDiscovery(index, { query: 'src test', limit: 1, currentBinding: binding });
  const second = searchGovernedWorkspaceDiscovery(index, { query: 'src test', limit: 1, currentBinding: binding });
  assert.deepEqual(first, second);
  assert.deepEqual(first.results, ['src/a.test.js']);
  assert.equal(first.totalMatches, 2);
  assert.equal(first.exhausted, true);
});

test('discovery binding accepts the physical Git HEAD object id used by current repositories', () => {
  const index = createGovernedWorkspaceDiscoveryIndex({ ...gitSha1Binding, files: ['README.md'] });
  const result = searchGovernedWorkspaceDiscovery(index, { query: 'README', currentBinding: gitSha1Binding });
  assert.equal(index.binding.repositoryHead, '1'.repeat(40));
  assert.equal(result.status, 'COMPLETED');
  assert.deepEqual(result.results, ['README.md']);
});

test('stale repository physical or worktree binding requires fresh discovery', () => {
  const index = createGovernedWorkspaceDiscoveryIndex({ ...binding, files: ['README.md'] });
  for (const key of Object.keys(binding)) {
    const result = searchGovernedWorkspaceDiscovery(index, { query: '', currentBinding: { ...binding, [key]: sha(`changed-${key}`) } });
    assert.equal(result.status, 'STALE');
    assert.equal(result.requiresFreshDiscovery, true);
    assert.deepEqual(result.results, []);
  }
});

test('traversal absolute input result overflow and inventory exhaustion fail closed', () => {
  assert.throws(() => createGovernedWorkspaceDiscoveryIndex({ ...binding, files: ['../x'] }), /canonical/);
  assert.throws(() => createGovernedWorkspaceDiscoveryIndex({ ...binding, files: ['/tmp/x'] }), /canonical/);
  assert.throws(() => createGovernedWorkspaceDiscoveryIndex({ ...binding, files: Array.from({ length: MAX_FILES + 1 }, (_, index) => `x/${index}`) }), /bounded/i);
  const index = createGovernedWorkspaceDiscoveryIndex({ ...binding, files: ['x'] });
  assert.throws(() => searchGovernedWorkspaceDiscovery(index, { query: '', limit: 129, currentBinding: binding }), /ceiling/);
});

test('discovery index carries no execution or mutation authority', () => {
  const api = require('../../accelerator/core/governed-workspace-discovery-index');
  assert.deepEqual(Object.keys(api).filter((key) => typeof api[key] === 'function').sort(), ['createGovernedWorkspaceDiscoveryIndex', 'searchGovernedWorkspaceDiscovery']);
});
