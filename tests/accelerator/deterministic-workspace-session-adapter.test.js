'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createDeterministicWorkspaceSession, revalidateDeterministicWorkspaceSession } = require('../../accelerator/adapters/deterministic-workspace-session-adapter');

function repository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-workspace-session-'));
  childProcess.execFileSync('git', ['init', '-q'], { cwd: root });
  childProcess.execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
  childProcess.execFileSync('git', ['config', 'user.name', 'SDO Test'], { cwd: root });
  fs.writeFileSync(path.join(root, 'README.md'), 'initial\n');
  childProcess.execFileSync('git', ['add', 'README.md'], { cwd: root });
  childProcess.execFileSync('git', ['commit', '-qm', 'initial'], { cwd: root });
  return root;
}

test('session binds exact physical repository and revalidates unchanged state', (context) => {
  const root = repository();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const session = createDeterministicWorkspaceSession({ authorizedRoot: root, humanSubject: 'human:test', authorizedAt: '2026-08-30T12:00:00.000Z' });
  const result = revalidateDeterministicWorkspaceSession(session);
  assert.equal(result.decision, 'VALID');
  assert.equal(result.samePhysical, true);
  assert.equal(result.sameRepository, true);
  assert.equal(result.sameWorktree, true);
  assert.equal(session.reusableWithoutRevalidation, false);
  assert.ok(Object.isFrozen(session));
});

test('worktree and HEAD changes invalidate stale session authority', (context) => {
  const root = repository();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const session = createDeterministicWorkspaceSession({ authorizedRoot: root, humanSubject: 'human:test', authorizedAt: '2026-08-30T12:00:00.000Z' });
  fs.writeFileSync(path.join(root, 'README.md'), 'changed\n');
  const dirty = revalidateDeterministicWorkspaceSession(session);
  assert.equal(dirty.decision, 'INVALIDATED');
  assert.equal(dirty.sameWorktree, false);
});

test('repository-root symlink alias and nested root cannot redefine a session', (context) => {
  const root = repository();
  const physicalRoot = fs.realpathSync(root);
  const alias = `${root}-alias`;
  fs.symlinkSync(root, alias, 'dir');
  fs.mkdirSync(path.join(root, 'nested'));
  context.after(() => { fs.rmSync(alias, { force: true }); fs.rmSync(root, { recursive: true, force: true }); });
  assert.throws(() => createDeterministicWorkspaceSession({ authorizedRoot: path.join(root, 'nested'), humanSubject: 'human:test', authorizedAt: '2026-08-30T12:00:00.000Z' }), /repository/i);
  const session = createDeterministicWorkspaceSession({ authorizedRoot: alias, humanSubject: 'human:test', authorizedAt: '2026-08-30T12:00:00.000Z' });
  assert.equal(session.physical.root, physicalRoot);
});

test('workspace replacement invalidates rather than transferring authority', (context) => {
  const root = repository();
  const session = createDeterministicWorkspaceSession({ authorizedRoot: root, humanSubject: 'human:test', authorizedAt: '2026-08-30T12:00:00.000Z' });
  const moved = `${root}-moved`;
  fs.renameSync(root, moved);
  fs.mkdirSync(root);
  context.after(() => { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(moved, { recursive: true, force: true }); });
  const result = revalidateDeterministicWorkspaceSession(session);
  assert.equal(result.decision, 'INVALIDATED');
  assert.equal(result.current, null);
});

test('session adapter exposes bounded create and revalidate operations only', () => {
  const api = require('../../accelerator/adapters/deterministic-workspace-session-adapter');
  assert.deepEqual(Object.keys(api).filter((key) => typeof api[key] === 'function').sort(), ['createDeterministicWorkspaceSession', 'revalidateDeterministicWorkspaceSession']);
});
