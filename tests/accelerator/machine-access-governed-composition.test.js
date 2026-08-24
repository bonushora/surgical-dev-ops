'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const { createGovernedReadOnlyRequest } =
  require('../../accelerator/cli/governed-readonly-dispatch');
const { composeGovernedMachineAccess, executeGovernedMachineAccess } =
  require('../../accelerator/core/machine-access-governed-composition');

const NOW = '2099-01-01T00:00:00.000Z';

function git(cwd, args) {
  const result = childProcess.spawnSync('git', args, { cwd, shell: false, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-machine-composition-'));
  fs.writeFileSync(path.join(root, 'valid.js'), 'const value = 1;\n');
  git(root, ['init']);
  git(root, ['config', 'user.email', 'tests@example.invalid']);
  git(root, ['config', 'user.name', 'Surgical Tests']);
  git(root, ['add', 'valid.js']);
  git(root, ['commit', '-m', 'fixture']);
  return root;
}

function governed(repositoryPath, capabilityType, target) {
  return createGovernedReadOnlyRequest(
    { repositoryPath, capabilityType, target },
    { now: () => NOW }
  );
}

test('governed grants compose deterministically into machine authority', () => {
  const root = fixture();
  try {
    const request = governed(root, 'FILESYSTEM_READ', 'valid.js');
    const first = composeGovernedMachineAccess(request);
    const second = composeGovernedMachineAccess(request);
    assert.deepEqual(first, second);
    assert.equal(first.request.operationType, 'READ_FILE');
    assert.equal(first.authority.grantFingerprint,
      request.execution.grantEvaluation.grant.fingerprint);
    assert.equal(Object.isFrozen(first), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('composition executes the recursive evidence vocabulary through the broker', () => {
  const root = fixture();
  try {
    const cases = [
      ['GIT_READ', 'workspace-files', 'LIST_DIRECTORY'],
      ['FILESYSTEM_READ', 'valid.js', 'READ_FILE'],
      ['PROCESS_VALIDATION', 'valid.js', 'RUN_FIXED_VALIDATION']
    ];
    for (const [capabilityType, target, operationType] of cases) {
      const result = executeGovernedMachineAccess(governed(root, capabilityType, target));
      assert.equal(result.orchestration.status, 'COMPLETED', result.execution.reason);
      assert.equal(result.machineAccess.operationType, operationType);
      assert.equal(result.machineAccess.evidence.adapterEvidence, result.execution);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('composition rejects a governed grant without action binding', () => {
  const root = fixture();
  try {
    const valid = governed(root, 'FILESYSTEM_READ', 'valid.js');
    const grant = valid.execution.grantEvaluation.grant;
    const invalid = Object.freeze({
      ...valid,
      execution: Object.freeze({
        ...valid.execution,
        grantEvaluation: Object.freeze({
          ...valid.execution.grantEvaluation,
          grant: Object.freeze(Object.fromEntries(
            Object.entries(grant).filter(([key]) => key !== 'action')
          ))
        })
      })
    });
    assert.throws(() => composeGovernedMachineAccess(invalid), /not action-bound/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('composition source introduces no shell network or mutation authority', () => {
  const source = fs.readFileSync(
    require.resolve('../../accelerator/core/machine-access-governed-composition'), 'utf8'
  );
  assert.doesNotMatch(source, /child_process|spawn|execSync|https?|node:net|writeFile|unlink|rename/);
});
