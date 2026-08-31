'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const { canonicalizeAuthorizedRoot } = require('../core/workspace-boundary');
const { runTrustedGitRead } = require('./git-read-adapter');

const SESSION_SCHEMA = 'sdo.deterministic_workspace_session.v1';
const REVALIDATION_SCHEMA = 'sdo.deterministic_workspace_session_revalidation.v1';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function timestamp(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error('Canonical workspace-session timestamp is required.');
  }
  return value;
}

function observe(rootInput) {
  const root = canonicalizeAuthorizedRoot(rootInput);
  const lexical = fs.lstatSync(root);
  const stat = fs.statSync(root, { bigint: true });
  if (lexical.isSymbolicLink() || !stat.isDirectory()) throw new Error('Authorized workspace root must be a physical directory.');
  const repositoryRoot = runTrustedGitRead(root, 'REPOSITORY_ROOT').result;
  if (repositoryRoot !== root) throw new Error('Authorized workspace must be the exact physical repository root.');
  const repositoryHead = runTrustedGitRead(root, 'HEAD_COMMIT').result;
  const worktree = runTrustedGitRead(root, 'WORKTREE_STATUS').result;
  const physical = { root, device: String(stat.dev), inode: String(stat.ino), birthtimeNs: String(stat.birthtimeNs), ctimeNs: String(stat.ctimeNs) };
  const physicalWorkspaceIdentity = crypto.createHash('sha256').update(JSON.stringify(physical)).digest('hex');
  const worktreeFingerprint = crypto.createHash('sha256').update(JSON.stringify(worktree)).digest('hex');
  return deepFreeze({ physical, physicalWorkspaceIdentity, repositoryHead, worktreeFingerprint });
}

function createDeterministicWorkspaceSession({ authorizedRoot, humanSubject, authorizedAt } = {}) {
  if (typeof humanSubject !== 'string' || !humanSubject.trim()) throw new Error('Human workspace authorizer is required.');
  const observation = observe(authorizedRoot);
  const binding = { humanSubject: humanSubject.trim(), authorizedAt: timestamp(authorizedAt), ...observation };
  return deepFreeze({ schema: SESSION_SCHEMA, ...binding, sessionFingerprint: crypto.createHash('sha256').update(JSON.stringify(binding)).digest('hex'), active: true, reusableWithoutRevalidation: false, operationalAuthority: false, mutationAuthority: false });
}

function revalidateDeterministicWorkspaceSession(session) {
  if (!session || session.schema !== SESSION_SCHEMA || !Object.isFrozen(session)) throw new Error('Immutable deterministic workspace session is required.');
  let current;
  try { current = observe(session.physical.root); } catch {
    return deepFreeze({ schema: REVALIDATION_SCHEMA, decision: 'INVALIDATED', reason: 'Workspace identity is unavailable.', sessionFingerprint: session.sessionFingerprint, current: null, operationalAuthority: false, mutationAuthority: false });
  }
  const samePhysical = current.physicalWorkspaceIdentity === session.physicalWorkspaceIdentity;
  const sameRepository = current.repositoryHead === session.repositoryHead;
  const sameWorktree = current.worktreeFingerprint === session.worktreeFingerprint;
  const valid = samePhysical && sameRepository && sameWorktree;
  return deepFreeze({ schema: REVALIDATION_SCHEMA, decision: valid ? 'VALID' : 'INVALIDATED', reason: valid ? null : 'Workspace physical or repository state changed.', sessionFingerprint: session.sessionFingerprint, current, samePhysical, sameRepository, sameWorktree, operationalAuthority: false, mutationAuthority: false });
}

module.exports = Object.freeze({ SESSION_SCHEMA, REVALIDATION_SCHEMA, createDeterministicWorkspaceSession, revalidateDeterministicWorkspaceSession });
