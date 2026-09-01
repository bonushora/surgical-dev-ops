'use strict';

const crypto = require('node:crypto');

const INDEX_SCHEMA = 'sdo.governed_workspace_discovery_index.v1';
const QUERY_SCHEMA = 'sdo.governed_workspace_discovery_query.v1';
const MAX_FILES = 4096;
const MAX_RESULTS = 128;
const DEFAULT_EXCLUDED_SEGMENTS = Object.freeze(['.git', 'node_modules', '.npm', '.ssh']);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function digest(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error(`${label} must be canonical SHA-256.`);
  return value;
}

function gitObjectId(value, label) {
  if (typeof value !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value)) throw new Error(`${label} must be a canonical Git object id.`);
  return value;
}

function canonicalTarget(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Discovery target is required.');
  const target = value.trim().replace(/\\/g, '/');
  if (target.startsWith('/') || target.length > 1024 || target.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Discovery target must be canonical and workspace-relative.');
  }
  return target;
}

function createGovernedWorkspaceDiscoveryIndex({ physicalWorkspaceIdentity, repositoryHead, worktreeFingerprint, files, excludedSegments = DEFAULT_EXCLUDED_SEGMENTS } = {}) {
  if (!Array.isArray(files) || files.length > MAX_FILES) throw new Error('Bounded governed workspace inventory is required.');
  if (!Array.isArray(excludedSegments) || excludedSegments.some((item) => typeof item !== 'string' || !item.trim() || item.includes('/'))) {
    throw new Error('Discovery exclusions must be canonical path segments.');
  }
  const excluded = [...new Set(excludedSegments.map((item) => item.trim()))].sort();
  const canonical = [...new Set(files.map(canonicalTarget))]
    .filter((target) => !target.split('/').some((segment) => excluded.includes(segment)))
    .sort((left, right) => left.localeCompare(right, 'en'));
  const binding = deepFreeze({
    physicalWorkspaceIdentity: digest(physicalWorkspaceIdentity, 'Physical workspace identity'),
    repositoryHead: gitObjectId(repositoryHead, 'Repository HEAD'),
    worktreeFingerprint: digest(worktreeFingerprint, 'Worktree fingerprint')
  });
  const indexFingerprint = crypto.createHash('sha256').update(JSON.stringify({ binding, canonical, excluded })).digest('hex');
  return deepFreeze({ schema: INDEX_SCHEMA, binding, indexFingerprint, files: canonical, excludedSegments: excluded, admittedFiles: canonical.length, observedFiles: files.length, truncated: false, maxFiles: MAX_FILES, maxResults: MAX_RESULTS, operationalAuthority: false, mutationAuthority: false });
}

function searchGovernedWorkspaceDiscovery(index, { query, limit = 32, currentBinding } = {}) {
  if (!index || index.schema !== INDEX_SCHEMA || !Object.isFrozen(index)) throw new Error('Immutable governed discovery index is required.');
  if (!currentBinding || digest(currentBinding.physicalWorkspaceIdentity, 'Physical workspace identity') !== index.binding.physicalWorkspaceIdentity || gitObjectId(currentBinding.repositoryHead, 'Repository HEAD') !== index.binding.repositoryHead || digest(currentBinding.worktreeFingerprint, 'Worktree fingerprint') !== index.binding.worktreeFingerprint) {
    return deepFreeze({ schema: QUERY_SCHEMA, status: 'STALE', results: [], reason: 'Workspace state binding changed.', requiresFreshDiscovery: true, operationalAuthority: false, mutationAuthority: false });
  }
  if (typeof query !== 'string' || query.length > 256 || query.includes('\0') || /[\r\n]/.test(query)) throw new Error('Bounded deterministic discovery query is required.');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_RESULTS) throw new Error('Discovery result ceiling is invalid.');
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = index.files.filter((target) => terms.every((term) => target.toLowerCase().includes(term)));
  return deepFreeze({ schema: QUERY_SCHEMA, status: 'COMPLETED', results: matches.slice(0, limit), totalMatches: matches.length, exhausted: matches.length > limit, reason: null, requiresFreshDiscovery: false, operationalAuthority: false, mutationAuthority: false });
}

module.exports = Object.freeze({ INDEX_SCHEMA, QUERY_SCHEMA, MAX_FILES, MAX_RESULTS, createGovernedWorkspaceDiscoveryIndex, searchGovernedWorkspaceDiscovery });
