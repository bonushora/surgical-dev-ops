'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
  validateGitFlowAuthorization,
  inspectCredentialContent,
  createGitFlowReport,
  createSdpSnapshot
} = require('../core/git-flow-contract');

const TIMEOUT_MS = 30_000;
const NETWORK_TIMEOUT_MS = 60_000;
const VALIDATION_TIMEOUT_MS = 180_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_STAGED_FILE_BYTES = 1024 * 1024;
const AUTHORITY_ENVIRONMENT = Object.freeze([
  'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_CEILING_DIRECTORIES',
  'GIT_COMMON_DIR', 'GIT_SSH', 'GIT_SSH_COMMAND', 'GIT_PROXY_COMMAND'
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function safeEnvironment() {
  const environment = { ...process.env };
  for (const key of AUTHORITY_ENVIRONMENT) delete environment[key];
  return {
    ...environment,
    LANG: 'C',
    LC_ALL: 'C',
    GIT_TERMINAL_PROMPT: '0',
    GIT_PAGER: 'cat',
    PAGER: 'cat'
  };
}

function commandResult(result) {
  const stdout = Buffer.isBuffer(result.stdout)
    ? result.stdout.toString('utf8') : String(result.stdout || '');
  const stderr = Buffer.isBuffer(result.stderr)
    ? result.stderr.toString('utf8') : String(result.stderr || '');
  return {
    status: Number.isInteger(result.status) ? result.status : null,
    signal: result.signal || null,
    error: result.error || null,
    stdout,
    stderr
  };
}

function createGovernedGitFlowRunner({ spawnSync = childProcess.spawnSync } = {}) {
  function execute(program, args, options = {}) {
    const result = commandResult(spawnSync(program, args, {
      cwd: options.cwd,
      shell: false,
      input: options.input || Buffer.alloc(0),
      encoding: options.encoding || 'utf8',
      timeout: options.timeout || TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
      windowsHide: true,
      env: safeEnvironment()
    }));
    if (result.error || result.signal || result.status !== 0) {
      return { ok: false, ...result };
    }
    if (Buffer.byteLength(result.stdout) > MAX_OUTPUT_BYTES ||
        Buffer.byteLength(result.stderr) > MAX_OUTPUT_BYTES) {
      return { ok: false, ...result, error: new Error('Command output exceeded limit.') };
    }
    return { ok: true, ...result };
  }

  function git(workspace, args, options = {}) {
    return execute('git', [
      '-c', 'core.fsmonitor=',
      '-c', 'diff.external=',
      '-c', 'diff.trustExitCode=false',
      '-c', 'pager.status=false',
      '-c', 'pager.diff=false',
      '-c', 'pager.show=false',
      ...args
    ], { cwd: workspace, ...options });
  }

  function result(authorization, state, phase, reason, details = {}) {
    const report = createGitFlowReport({
      authorization,
      state,
      phase,
      commitSha: details.commitSha || null,
      observedRemoteSha: details.observedRemoteSha || null,
      validations: details.validations || [],
      warnings: details.warnings || (reason ? [reason] : []),
      recovery: details.recovery || null
    });
    return deepFreeze({ state, phase, reason, ...details, report });
  }

  function validateWorkspace(authorization) {
    let workspace;
    try {
      workspace = fs.realpathSync(authorization.workspace);
    } catch {
      return { ok: false, reason: 'Authorized workspace is unavailable.' };
    }
    if (workspace !== authorization.workspace || !path.isAbsolute(workspace)) {
      return { ok: false, reason: 'Authorized workspace is not its canonical physical path.' };
    }
    const root = git(workspace, ['rev-parse', '--show-toplevel']);
    if (!root.ok) return { ok: false, reason: 'Workspace is not a readable Git repository.' };
    let observed;
    try {
      observed = fs.realpathSync(root.stdout.trim());
    } catch {
      return { ok: false, reason: 'Git repository root is unavailable.' };
    }
    if (observed !== workspace) {
      return { ok: false, reason: 'Git repository root differs from the authorized workspace.' };
    }
    return { ok: true, workspace };
  }

  function scalar(workspace, args, label) {
    const observed = git(workspace, args);
    if (!observed.ok) return { ok: false, reason: `${label} could not be observed.` };
    const value = observed.stdout.trim();
    if (!value || /[\0\r\n\u001b]/u.test(value)) {
      return { ok: false, reason: `${label} is malformed.` };
    }
    return { ok: true, value };
  }

  function observeLocalIdentity(authorization) {
    const workspaceResult = validateWorkspace(authorization);
    if (!workspaceResult.ok) return workspaceResult;
    const workspace = workspaceResult.workspace;
    const head = scalar(workspace, ['rev-parse', '--verify', 'HEAD'], 'Local HEAD');
    if (!head.ok) return head;
    const branch = scalar(workspace, ['branch', '--show-current'], 'Local branch');
    if (!branch.ok) return branch;
    const remoteUrl = scalar(
      workspace,
      ['remote', 'get-url', '--push', authorization.remote.name],
      'Remote URL'
    );
    if (!remoteUrl.ok) return remoteUrl;
    return { ok: true, workspace, head: head.value, branch: branch.value, remoteUrl: remoteUrl.value };
  }

  function validRemoteName(value) {
    return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
  }

  function remoteUrlHasCredentials(value) {
    try {
      const parsed = new URL(value);
      return Boolean(parsed.username || parsed.password);
    } catch {
      return false;
    }
  }

  function validateBoundIdentity(authorization, { requireExpectedHead = true } = {}) {
    if (!validRemoteName(authorization.remote.name)) {
      return { ok: false, reason: 'Remote name is malformed.' };
    }
    if (remoteUrlHasCredentials(authorization.remote.url)) {
      return { ok: false, reason: 'Credential-bearing remote URLs are forbidden.' };
    }
    const identity = observeLocalIdentity(authorization);
    if (!identity.ok) return identity;
    if (identity.branch !== authorization.remote.branch) {
      return { ...identity, ok: false, reason: 'Local branch differs from the authorized remote branch.' };
    }
    if (identity.remoteUrl !== authorization.remote.url) {
      return { ...identity, ok: false, reason: 'Configured remote URL differs from the authorized physical URL.' };
    }
    if (requireExpectedHead && identity.head !== authorization.expectedHead) {
      return { ...identity, ok: false, reason: 'Local HEAD diverged from the authorized baseline.' };
    }
    const branchFormat = git(identity.workspace, ['check-ref-format', '--branch', identity.branch]);
    if (!branchFormat.ok) return { ...identity, ok: false, reason: 'Authorized branch is malformed.' };
    return identity;
  }

  function parseNulPaths(value) {
    return value.split('\0').filter(Boolean);
  }

  function stagedPaths(workspace) {
    const staged = git(workspace, ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACDMRTUXB']);
    if (!staged.ok) return { ok: false, reason: 'Staged paths could not be observed.' };
    return { ok: true, paths: parseNulPaths(staged.stdout).sort() };
  }

  function resetAuthorizedStaging(workspace, files) {
    const reset = git(workspace, ['reset', '--quiet', 'HEAD', '--', ...files]);
    return deepFreeze({ attempted: true, restored: reset.ok });
  }

  function inspectStagedSecrets(workspace, files) {
    const inspections = [];
    for (const file of files) {
      const size = git(workspace, ['cat-file', '-s', `:${file}`]);
      if (!size.ok) {
        const deleted = git(workspace, ['diff', '--cached', '--quiet', '--diff-filter=D', '--', file]);
        if (!deleted.ok && deleted.status === 1) {
          inspections.push({ target: file, state: 'GREEN', rules: [], bytes: 0,
            contentSha256: null, classificationComplete: false, deleted: true });
          continue;
        }
        return { ok: false, reason: `Staged content is unreadable: ${file}.`, inspections };
      }
      const bytes = Number(size.stdout.trim());
      if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_STAGED_FILE_BYTES) {
        return { ok: false, reason: `Staged content exceeds the bounded secret scan: ${file}.`, inspections };
      }
      const content = git(workspace, ['show', `:${file}`], { encoding: 'buffer' });
      if (!content.ok) {
        return { ok: false, reason: `Staged content is unreadable: ${file}.`, inspections };
      }
      const inspection = inspectCredentialContent({
        target: file,
        content: Buffer.from(content.stdout, 'utf8')
      });
      inspections.push(inspection);
      if (inspection.state === 'BLOCKED') {
        return { ok: false, reason: `Credential pattern detected in authorized file: ${file}.`, inspections };
      }
    }
    return { ok: true, inspections };
  }

  function inspectCommittedSecrets(workspace, commitSha, files) {
    const inspections = [];
    for (const file of files) {
      const size = git(workspace, ['cat-file', '-s', `${commitSha}:${file}`]);
      if (!size.ok) {
        inspections.push({ target: file, state: 'GREEN', rules: [], bytes: 0,
          contentSha256: null, classificationComplete: false, deleted: true });
        continue;
      }
      const bytes = Number(size.stdout.trim());
      if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_STAGED_FILE_BYTES) {
        return { ok: false, reason: `Published content exceeds the bounded secret scan: ${file}.`, inspections };
      }
      const content = git(workspace, ['show', `${commitSha}:${file}`], { encoding: 'buffer' });
      if (!content.ok) {
        return { ok: false, reason: `Published content is unreadable: ${file}.`, inspections };
      }
      const inspection = inspectCredentialContent({
        target: file,
        content: Buffer.from(content.stdout, 'utf8')
      });
      inspections.push(inspection);
      if (inspection.state === 'BLOCKED') {
        return { ok: false, reason: `Credential pattern detected in publishable commit: ${file}.`, inspections };
      }
    }
    return { ok: true, inspections };
  }

  function runValidations(authorization, workspace) {
    const records = [];
    for (const command of authorization.validation) {
      const observed = execute(command[0], command.slice(1), { cwd: workspace, timeout: VALIDATION_TIMEOUT_MS });
      records.push(deepFreeze({
        command: [...command],
        exitCode: observed.status,
        signal: observed.signal,
        state: observed.ok ? 'GREEN' : 'BLOCKED'
      }));
      if (!observed.ok) return { ok: false, records };
    }
    return { ok: true, records };
  }

  function inspect(authorizationInput) {
    let authorization;
    try {
      authorization = validateGitFlowAuthorization(authorizationInput);
    } catch (error) {
      return deepFreeze({ state: 'BLOCKED', phase: 'INSPECT', reason: error.message });
    }
    const identity = validateBoundIdentity(authorization);
    if (!identity.ok) return result(authorization, 'BLOCKED', 'INSPECT', identity.reason);
    const remote = observeRemoteSha(authorization, identity.workspace);
    if (!remote.ok) return result(authorization, 'BLOCKED', 'INSPECT', remote.reason);
    if (remote.sha !== authorization.remote.expectedSha) {
      return result(authorization, 'BLOCKED', 'INSPECT', 'Remote CAS identity differs from authorization.', {
        commitSha: identity.head,
        observedRemoteSha: remote.sha
      });
    }
    return result(authorization, 'GREEN', 'INSPECT', 'Physical Git identity matches authorization.', {
      commitSha: identity.head,
      observedRemoteSha: remote.sha,
      warnings: []
    });
  }

  function commit({ authorization: authorizationInput, message } = {}) {
    let authorization;
    try {
      authorization = validateGitFlowAuthorization(authorizationInput);
    } catch (error) {
      return deepFreeze({ state: 'BLOCKED', phase: 'COMMIT', reason: error.message });
    }
    if (authorization.authorities.COMMIT_AUTHORIZED !== true) {
      return result(authorization, 'BLOCKED', 'COMMIT', 'COMMIT_AUTHORIZED is absent.');
    }
    if (typeof message !== 'string' || !message.trim() || message !== message.trim() ||
        message.length > 256 || /[\0\r\n]/u.test(message)) {
      return result(authorization, 'BLOCKED', 'COMMIT', 'Commit message is malformed.');
    }
    const identity = validateBoundIdentity(authorization);
    if (!identity.ok) return result(authorization, 'BLOCKED', 'COMMIT', identity.reason);
    const before = stagedPaths(identity.workspace);
    if (!before.ok) return result(authorization, 'BLOCKED', 'COMMIT', before.reason);
    if (before.paths.length > 0) {
      return result(authorization, 'BLOCKED', 'COMMIT',
        'The index must be empty so preexisting staged work cannot be captured.', { stagedPaths: before.paths });
    }

    const staged = git(identity.workspace, ['add', '--', ...authorization.authorizedFiles]);
    if (!staged.ok) {
      return result(authorization, 'BLOCKED', 'COMMIT', 'Explicit authorized-file staging failed.', {
        recovery: resetAuthorizedStaging(identity.workspace, authorization.authorizedFiles)
      });
    }
    const after = stagedPaths(identity.workspace);
    if (!after.ok || after.paths.length === 0 ||
        after.paths.some((file) => !authorization.authorizedFiles.includes(file))) {
      return result(authorization, 'BLOCKED', 'COMMIT',
        'Staged scope is empty, unreadable, or exceeds the authorized files.', {
          stagedPaths: after.paths || [],
          recovery: resetAuthorizedStaging(identity.workspace, authorization.authorizedFiles)
        });
    }

    const secrets = inspectStagedSecrets(identity.workspace, after.paths);
    if (!secrets.ok) {
      return result(authorization, 'BLOCKED', 'COMMIT', secrets.reason, {
        secretInspection: secrets.inspections,
        recovery: resetAuthorizedStaging(identity.workspace, authorization.authorizedFiles)
      });
    }
    const validation = runValidations(authorization, identity.workspace);
    if (!validation.ok) {
      return result(authorization, 'BLOCKED', 'COMMIT', 'Risk-proportional validation failed.', {
        validations: validation.records,
        recovery: resetAuthorizedStaging(identity.workspace, authorization.authorizedFiles)
      });
    }

    const committed = git(identity.workspace, [
      'commit', '--only', '-m', message, '--', ...authorization.authorizedFiles
    ]);
    if (!committed.ok) {
      const observedHead = scalar(identity.workspace, ['rev-parse', '--verify', 'HEAD'], 'Local HEAD');
      const recovery = observedHead.ok && observedHead.value === authorization.expectedHead
        ? resetAuthorizedStaging(identity.workspace, authorization.authorizedFiles)
        : { attempted: false, restored: false };
      return result(authorization, 'BLOCKED', 'COMMIT', 'Git commit failed with hooks enabled.', {
        validations: validation.records,
        recovery
      });
    }
    const newHead = scalar(identity.workspace, ['rev-parse', '--verify', 'HEAD'], 'Committed HEAD');
    if (!newHead.ok || newHead.value === authorization.expectedHead) {
      return result(authorization, 'BLOCKED', 'COMMIT', 'Committed HEAD was not physically advanced.', {
        validations: validation.records
      });
    }
    const parent = scalar(identity.workspace, ['rev-parse', `${newHead.value}^`], 'Commit parent');
    const changed = git(identity.workspace, [
      'diff-tree', '--no-commit-id', '--name-only', '-r', '-z', newHead.value
    ]);
    const changedPaths = changed.ok ? parseNulPaths(changed.stdout).sort() : [];
    if (!parent.ok || parent.value !== authorization.expectedHead || !changed.ok ||
        changedPaths.length === 0 ||
        changedPaths.some((file) => !authorization.authorizedFiles.includes(file))) {
      return result(authorization, 'BLOCKED', 'COMMIT',
        'Commit integrity does not match the authorized parent and file scope.', {
          commitSha: newHead.value,
          validations: validation.records,
          changedPaths
        });
    }
    return result(authorization, 'GREEN', 'COMMIT', 'Authorized commit is physically verified.', {
      commitSha: newHead.value,
      observedRemoteSha: authorization.remote.expectedSha,
      validations: validation.records,
      changedPaths,
      secretInspection: secrets.inspections,
      warnings: []
    });
  }

  function observeRemoteSha(authorization, workspace) {
    const observed = git(workspace, [
      'ls-remote', '--heads', authorization.remote.name,
      `refs/heads/${authorization.remote.branch}`
    ], { timeout: NETWORK_TIMEOUT_MS });
    if (!observed.ok) return { ok: false, reason: 'Remote branch could not be read.' };
    const lines = observed.stdout.trim().split('\n').filter(Boolean);
    if (lines.length !== 1) return { ok: false, reason: 'Remote branch identity is missing or ambiguous.' };
    const match = lines[0].match(/^([a-f0-9]{40}|[a-f0-9]{64})\trefs\/heads\/(.+)$/);
    if (!match || match[2] !== authorization.remote.branch) {
      return { ok: false, reason: 'Remote branch identity is malformed.' };
    }
    return { ok: true, sha: match[1] };
  }

  function inspectPublishableCommit(authorization, identity, commitSha) {
    if (identity.head !== commitSha) {
      return { ok: false, reason: 'Local HEAD differs from the authorized commit SHA.' };
    }
    const ancestry = git(identity.workspace, [
      'merge-base', '--is-ancestor', authorization.remote.expectedSha, commitSha
    ]);
    if (!ancestry.ok) {
      return {
        ok: false,
        reason: 'Published commit is not a fast-forward descendant of the expected remote SHA.'
      };
    }
    const rangeCount = scalar(identity.workspace, [
      'rev-list', '--count', `${authorization.remote.expectedSha}..${commitSha}`
    ], 'Publication commit count');
    const parent = scalar(identity.workspace, ['rev-parse', `${commitSha}^`], 'Publication commit parent');
    const changed = git(identity.workspace, [
      'diff-tree', '--no-commit-id', '--name-only', '-r', '-z', commitSha
    ]);
    const changedPaths = changed.ok ? parseNulPaths(changed.stdout).sort() : [];
    if (!rangeCount.ok || rangeCount.value !== '1' || !parent.ok ||
        parent.value !== authorization.remote.expectedSha || !changed.ok ||
        changedPaths.length === 0 ||
        changedPaths.some((file) => !authorization.authorizedFiles.includes(file))) {
      return {
        ok: false,
        reason: 'Publishable history is not the single authorized fast-forward commit.',
        changedPaths
      };
    }
    const secrets = inspectCommittedSecrets(identity.workspace, commitSha, changedPaths);
    if (!secrets.ok) {
      return {
        ok: false,
        reason: secrets.reason,
        changedPaths,
        secretInspection: secrets.inspections
      };
    }
    return {
      ok: true,
      changedPaths,
      secretInspection: secrets.inspections
    };
  }

  function reconcile({ authorization: authorizationInput } = {}) {
    let authorization;
    try {
      authorization = validateGitFlowAuthorization(authorizationInput);
    } catch (error) {
      return deepFreeze({ state: 'BLOCKED', phase: 'RECONCILE', reason: error.message });
    }
    const identity = validateBoundIdentity(authorization, { requireExpectedHead: false });
    if (!identity.ok) return result(authorization, 'BLOCKED', 'RECONCILE', identity.reason);
    const remote = observeRemoteSha(authorization, identity.workspace);
    if (!remote.ok) return result(authorization, 'BLOCKED', 'RECONCILE', remote.reason);

    if (identity.head === authorization.expectedHead) {
      if (remote.sha !== authorization.remote.expectedSha) {
        return result(authorization, 'BLOCKED', 'RECONCILE',
          'Remote CAS identity diverged before an authorized local commit.', {
            observedRemoteSha: remote.sha
          });
      }
      return result(authorization, 'GREEN', 'PREPARED',
        'Mission Git Flow is eligible and no authorized commit exists yet.', {
          commitSha: identity.head,
          observedRemoteSha: remote.sha,
          warnings: []
        });
    }

    const publishable = inspectPublishableCommit(authorization, identity, identity.head);
    if (!publishable.ok) {
      return result(authorization, 'BLOCKED', 'RECONCILE', publishable.reason, {
        commitSha: identity.head,
        observedRemoteSha: remote.sha,
        changedPaths: publishable.changedPaths || [],
        secretInspection: publishable.secretInspection || []
      });
    }
    if (remote.sha === identity.head) {
      return result(authorization, 'GREEN', 'PUBLISHED',
        'Interrupted publication reconciled from exact remote readback.', {
          commitSha: identity.head,
          observedRemoteSha: remote.sha,
          changedPaths: publishable.changedPaths,
          secretInspection: publishable.secretInspection,
          warnings: []
        });
    }
    if (remote.sha === authorization.remote.expectedSha) {
      return result(authorization, 'GREEN', 'LOCAL_GREEN',
        'Interrupted commit reconciled without creating a duplicate commit.', {
          commitSha: identity.head,
          observedRemoteSha: remote.sha,
          changedPaths: publishable.changedPaths,
          secretInspection: publishable.secretInspection,
          warnings: []
        });
    }
    return result(authorization, 'BLOCKED', 'RECONCILE',
      'Remote CAS identity diverged from both baseline and local commit.', {
        commitSha: identity.head,
        observedRemoteSha: remote.sha,
        changedPaths: publishable.changedPaths
      });
  }

  function push({ authorization: authorizationInput, commitSha } = {}) {
    let authorization;
    try {
      authorization = validateGitFlowAuthorization(authorizationInput);
    } catch (error) {
      return deepFreeze({ state: 'BLOCKED', phase: 'PUSH', reason: error.message });
    }
    if (authorization.authorities.PUSH_AUTHORIZED !== true) {
      return result(authorization, 'BLOCKED', 'PUSH', 'PUSH_AUTHORIZED is absent.');
    }
    if (authorization.authorities.DISCLOSURE_AUTHORIZED !== true) {
      return result(authorization, 'BLOCKED', 'PUSH', 'DISCLOSURE_AUTHORIZED is absent.');
    }
    if (typeof commitSha !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commitSha)) {
      return result(authorization, 'BLOCKED', 'PUSH', 'Commit SHA is malformed.');
    }
    const identity = validateBoundIdentity(authorization, { requireExpectedHead: false });
    if (!identity.ok) return result(authorization, 'BLOCKED', 'PUSH', identity.reason);
    const publishable = inspectPublishableCommit(authorization, identity, commitSha);
    if (!publishable.ok) {
      return result(authorization, 'BLOCKED', 'PUSH', publishable.reason, {
        commitSha,
        changedPaths: publishable.changedPaths || [],
        secretInspection: publishable.secretInspection || []
      });
    }

    const before = observeRemoteSha(authorization, identity.workspace);
    if (!before.ok) return result(authorization, 'BLOCKED', 'PUSH', before.reason);
    if (before.sha !== authorization.remote.expectedSha) {
      return result(authorization, 'BLOCKED', 'PUSH', 'Remote CAS mismatch before publication.', {
        commitSha,
        observedRemoteSha: before.sha
      });
    }

    const published = git(identity.workspace, [
      'push', '--porcelain', authorization.remote.name,
      `${commitSha}:refs/heads/${authorization.remote.branch}`
    ], { timeout: NETWORK_TIMEOUT_MS });
    const readback = observeRemoteSha(authorization, identity.workspace);
    if (readback.ok && readback.sha === commitSha) {
      const warnings = published.ok ? [] : [
        'Push process reported failure, but independent remote readback confirmed the exact commit.'
      ];
      return result(authorization, 'GREEN', 'PUBLISHED',
        'Remote SHA physically matches the authorized commit.', {
          commitSha,
          observedRemoteSha: readback.sha,
          changedPaths: publishable.changedPaths,
          secretInspection: publishable.secretInspection,
          warnings
        });
    }
    return result(authorization, 'BLOCKED', 'PUSH',
      published.ok
        ? 'Push returned success but remote readback did not confirm the commit.'
        : 'Push failed and remote readback did not confirm the commit.', {
        commitSha,
        observedRemoteSha: readback.ok ? readback.sha : null,
        recovery: {
          retryAllowedOnlyAfterFreshCas: true,
          remoteReadbackAvailable: readback.ok
        }
      });
  }

  function snapshot({ authorization, result: operationResult, testsStatus = 'PASSOU',
    components = [], gates = 0, attempts = 0, manualActions = [], deferred = [] } = {}) {
    return createSdpSnapshot({
      authorization,
      phase: operationResult.phase,
      state: operationResult.state,
      commitSha: operationResult.commitSha || '',
      remoteSha: operationResult.observedRemoteSha || '',
      testsStatus,
      components,
      gates,
      attempts,
      manualActions,
      deferred,
      nextStep: operationResult.state === 'GREEN' && operationResult.phase === 'PUBLISHED'
        ? 'Nenhuma ação pendente; manter readback remoto como âncora física.'
        : 'Resolver o bloqueio e repetir somente após nova verificação física.'
    });
  }

  return deepFreeze({ inspect, reconcile, commit, push, snapshot });
}

module.exports = deepFreeze({
  TIMEOUT_MS,
  NETWORK_TIMEOUT_MS,
  VALIDATION_TIMEOUT_MS,
  MAX_STAGED_FILE_BYTES,
  createGovernedGitFlowRunner
});
