'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  createPathIdentityAuthority,
  canonicalizeAuthorizedRoot
} = require('../core/workspace-boundary');

const TIMEOUT_MS = 5000;
const MAX_OUTPUT_BYTES = 64 * 1024;
const REQUEST_KEYS = new Set([
  'operationId', 'workspace', 'selector', 'grantEvaluation', 'observedAt'
]);
const SELECTORS = Object.freeze({
  REPOSITORY_ROOT: Object.freeze({ operation: 'rev-parse', args: ['rev-parse', '--show-toplevel'] }),
  CURRENT_BRANCH: Object.freeze({ operation: 'rev-parse', args: ['rev-parse', '--abbrev-ref', 'HEAD'] }),
  HEAD_COMMIT: Object.freeze({ operation: 'rev-parse', args: ['rev-parse', '--verify', 'HEAD'] }),
  WORKTREE_STATUS: Object.freeze({ operation: 'status', args: ['status', '--porcelain=v1', '-z', '--untracked-files=all'] }),
  TRACKED_FILES: Object.freeze({ operation: 'ls-files', args: ['ls-files', '-z'] })
});
function createGitPlatformIsolation(platform = process.platform) {
  if (!['linux', 'darwin', 'win32'].includes(platform)) {
    throw new Error(`Git platform is unsupported: ${platform}`);
  }

  const nullDevice = platform === 'win32'
    ? 'NUL'
    : '/dev/null';

  const fixedConfig = Object.freeze([
    '-c', 'credential.helper=',
    '-c', 'core.fsmonitor=false',
    '-c', `core.hooksPath=${nullDevice}`,
    '-c', 'diff.external=',
    '-c', 'diff.trustExitCode=false',
    '-c', 'pager.status=false',
    '-c', 'pager.diff=false',
    '-c', 'pager.show=false'
  ]);

  const environment = Object.freeze({
    GIT_CONFIG_GLOBAL: nullDevice,
    GIT_CONFIG_SYSTEM: nullDevice
  });

  return deepFreeze({
    platform,
    nullDevice,
    fixedConfig,
    environment
  });
}
const PREflightSelectors = Object.freeze(new Set(Object.keys(SELECTORS)));

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isDeepFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  seen.add(value);
  return Object.values(value).every((child) => isDeepFrozen(child, seen));
}

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function requireTimestamp(value, name) {
  const timestamp = requireText(value, name);
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== timestamp) {
    throw new Error(`${name} must be a canonical ISO timestamp.`);
  }
  return timestamp;
}

function validateRequestShape(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new Error('Git read request is missing or malformed.');
  }
  if (Object.keys(request).some((key) => !REQUEST_KEYS.has(key))) {
    throw new Error('Caller-controlled Git arguments, options or environment are forbidden.');
  }
}

function validateGrant(evaluation) {
  if (!evaluation || typeof evaluation !== 'object' ||
      evaluation.schema !== 'sdo.capability_grant_evaluation.v1' ||
      evaluation.decision !== 'ALLOWED' || !evaluation.grant ||
      !isDeepFrozen(evaluation)) {
    throw new Error('A valid immutable ALLOWED Git-read grant is required.');
  }
  const grant = evaluation.grant;
  if (grant.capabilityType !== 'GIT_READ' || grant.policyDecision !== 'ALLOWED' ||
      grant.lifecycleState !== 'PENDING' || grant.idempotency !== 'IDEMPOTENT' ||
      !grant.scope || !Array.isArray(grant.scope.operations) ||
      grant.scope.operations.length === 0) {
    throw new Error('Capability grant does not permit bounded Git read.');
  }
  return grant;
}

function sanitizedEnvironment(platform = process.platform) {
  const isolation = createGitPlatformIsolation(platform);

  return {
    PATH: platform === 'win32'
      ? 'C:\\Windows\\System32;C:\\Program Files\\Git\\cmd'
      : '/usr/local/bin:/usr/bin:/bin',
    LANG: 'C',
    LC_ALL: 'C',
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: isolation.environment.GIT_CONFIG_GLOBAL,
    GIT_PAGER: 'cat',
    PAGER: 'cat',
    NO_PROXY: '*',
    no_proxy: '*',
    GIT_DIR: undefined,
    GIT_WORK_TREE: undefined,
    GIT_INDEX_FILE: undefined,
    GIT_SSH: undefined,
    GIT_SSH_COMMAND: undefined,
    GIT_PROXY_COMMAND: undefined,
    GIT_CONFIG_SYSTEM: isolation.environment.GIT_CONFIG_SYSTEM
  };
}

function safeWorkspace(value) {
  const workspace = canonicalizeAuthorizedRoot(value);
  if (!fs.existsSync(path.join(workspace, '.git')) ||
      !fs.statSync(path.join(workspace, '.git')).isDirectory()) {
    throw new Error('Authorized workspace is not a supported local Git repository.');
  }
  return workspace;
}

function rejectUnsafeText(value, label) {
  if (typeof value !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u001b]/u.test(value) ||
      value.includes('\r') || value.includes('\n')) {
    throw new Error(`Git preflight ${label} is malformed.`);
  }
  return value;
}

function normalizeOutput(selector, stdout, workspace) {
  if (selector === 'WORKTREE_STATUS' || selector === 'TRACKED_FILES') {
    const entries = stdout.split('\0').filter(Boolean).map((entry) => rejectUnsafeText(entry, 'path output'));
    if (entries.some((entry) => {
      const filename = selector === 'WORKTREE_STATUS' && entry.length >= 3
        ? entry.slice(3) : entry;
      return entry.includes('\0') || path.isAbsolute(filename) || filename === '..' ||
        filename.startsWith(`..${path.sep}`) || filename.startsWith('../');
    })) {
      throw new Error('Git produced malformed NUL-delimited output.');
    }
    return selector === 'TRACKED_FILES' ? Object.freeze({ count: entries.length }) : entries;
  }
  const value = stdout.trim();
  if (!value || value.includes('\0') || /[\r\n\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u001b]/u.test(value)) {
    throw new Error('Git produced malformed scalar output.');
  }
  if (selector === 'REPOSITORY_ROOT') {
    let repositoryRoot;

    try {
      repositoryRoot = canonicalizeAuthorizedRoot(value);
    } catch {
      throw new Error('Git repository root does not match the authorized workspace.');
    }

    const pathIdentity =
      createPathIdentityAuthority(process.platform);

    let samePhysicalRoot = false;

    try {
      const repositoryStat = fs.statSync(repositoryRoot, { bigint: true });
      const workspaceStat = fs.statSync(workspace, { bigint: true });

      samePhysicalRoot =
        repositoryStat.isDirectory() &&
        workspaceStat.isDirectory() &&
        repositoryStat.dev === workspaceStat.dev &&
        repositoryStat.ino === workspaceStat.ino;
    } catch {
      samePhysicalRoot = false;
    }

    if (!samePhysicalRoot && !pathIdentity.sameIdentity(repositoryRoot, workspace)) {
      throw new Error('Git repository root does not match the authorized workspace.');
    }

    return workspace;
  }
  if (selector === 'HEAD_COMMIT' && !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value)) {
    throw new Error('Git produced a malformed HEAD object ID.');
  }
  return value;
}

function runTrustedGitRead(workspaceInput, selectorInput) {
  const workspace = safeWorkspace(workspaceInput);
  const selector = requireText(selectorInput, 'selector').toUpperCase();
  const template = SELECTORS[selector];
  if (!template || !PREflightSelectors.has(selector)) {
    throw new Error('Git preflight command is unapproved.');
  }
  const isolation = createGitPlatformIsolation();
  const args = [...isolation.fixedConfig, ...template.args];
  const result = childProcess.spawnSync('git', args, {
    cwd: workspace, shell: false, input: Buffer.alloc(0), encoding: 'utf8',
    timeout: TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true,
    env: Object.fromEntries(Object.entries(sanitizedEnvironment()).filter(([, value]) => value !== undefined))
  });
  if (result.error) {
    if (result.error.code === 'ETIMEDOUT') throw new Error('Git preflight timed out.');
    if (result.error.code === 'ENOBUFS') throw new Error('Git read exceeded output limit.');
    throw new Error('Git read process failed closed.');
  }
  if (result.signal) throw new Error(`Git read terminated by signal: ${result.signal}`);
  if (result.status !== 0) throw new Error('Git read returned a nonzero exit status.');
  const stdout = typeof result.stdout === 'string' ? result.stdout : '';
  const stderr = typeof result.stderr === 'string' ? result.stderr : '';
  if (Buffer.byteLength(stdout) > MAX_OUTPUT_BYTES || Buffer.byteLength(stderr) > MAX_OUTPUT_BYTES) {
    throw new Error('Git preflight output exceeded limit.');
  }
  if (stderr.trim()) throw new Error('Git read produced unexpected stderr output.');
  return deepFreeze({ workspace, selector, result: normalizeOutput(selector, stdout, workspace) });
}

function readGitWithGrant(request) {
  validateRequestShape(request);
  const grant = validateGrant(request.grantEvaluation);
  const operationId = requireText(request.operationId, 'operationId');
  if (operationId !== grant.operationId) throw new Error('Git capability operationId mismatch.');

  const pathIdentity = createPathIdentityAuthority(process.platform);
  if (!pathIdentity.isCanonicalAbsoluteIdentity(request.workspace)) {
    throw new Error('Git capability workspace mismatch.');
  }
  const workspace = canonicalizeAuthorizedRoot(request.workspace);
  if (workspace !== grant.workspace) {
    throw new Error('Git capability workspace mismatch.');
  }
  safeWorkspace(workspace);

  const observedAt = requireTimestamp(request.observedAt, 'observedAt');
  const expiresAt = requireTimestamp(grant.expiresAt, 'grant.expiresAt');
  if (Date.parse(observedAt) >= Date.parse(expiresAt)) throw new Error('Git capability grant is expired.');

  const selector = requireText(request.selector, 'selector').toUpperCase();
  const template = SELECTORS[selector];
  if (!template) throw new Error(`Unknown or forbidden Git selector: ${selector}`);
  if (!grant.scope.operations.includes(template.operation)) {
    throw new Error('Git selector is outside the authorized capability scope.');
  }

  const trustedResult = runTrustedGitRead(workspace, selector);
  const isolation = createGitPlatformIsolation();
  const args = [...isolation.fixedConfig, ...template.args];

  return deepFreeze({
    schema: 'sdo.git_read_result.v1',
    operationId,
    workspace,
    selector,
    observedAt,
    result: trustedResult.result,
    execution: {
      executable: 'git',
      arguments: [...args],
      shell: false,
      exitCode: 0,
      signal: null,
      timeoutMs: TIMEOUT_MS,
      maxOutputBytes: MAX_OUTPUT_BYTES,
      environmentKeys: Object.keys(sanitizedEnvironment()).sort()
    }
  });
}

module.exports = {
  createGitPlatformIsolation,
  readGitWithGrant,
  runTrustedGitRead
};
