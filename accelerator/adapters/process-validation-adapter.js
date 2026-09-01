'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { openVerifiedRegularRead } = require('./filesystem-safe-read-adapter');
const {
  createPathIdentityAuthority,
  canonicalizeAuthorizedRoot,
  resolveInspectedFile
} = require('../core/workspace-boundary');
const {
  createQualifiedCommandCatalog,
  admitQualifiedCommand
} = require('../core/qualified-command-catalog');

const MAX_INPUT_BYTES = 1024 * 1024;
const REQUEST_KEYS = new Set([
  'operationId', 'workspace', 'selector', 'target', 'grantEvaluation', 'observedAt'
]);
const PROJECTION_REQUEST_KEYS = new Set([
  ...REQUEST_KEYS,
  'projectionEvidence'
]);
const SELECTOR_PROFILES = Object.freeze({
  NODE_SYNTAX_CHECK: Object.freeze({
    targetExtensions: Object.freeze(['.js']),
    timeoutMs: 2000,
    maxOutputBytes: 32 * 1024,
    arguments(target) {
      return ['--check', '-'];
    },
    stdin(source) {
      return source;
    }
  }),
  NODE_TEST_FILE: Object.freeze({
    targetExtensions: Object.freeze(['.js']),
    timeoutMs: 30000,
    maxOutputBytes: 256 * 1024,
    arguments(target) {
      return ['--test', target];
    },
    stdin() {
      return Buffer.alloc(0);
    }
  })
});

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

function validateRequest(request, allowedKeys = REQUEST_KEYS) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new Error('Validation request is missing or malformed.');
  }
  if (Object.keys(request).some((key) => !allowedKeys.has(key))) {
    throw new Error('Caller-controlled executable, arguments or environment are forbidden.');
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function validateGrant(evaluation) {
  if (!evaluation || typeof evaluation !== 'object' ||
      evaluation.schema !== 'sdo.capability_grant_evaluation.v1' ||
      evaluation.decision !== 'ALLOWED' || !evaluation.grant ||
      !isDeepFrozen(evaluation)) {
    throw new Error('A valid immutable ALLOWED process-validation grant is required.');
  }
  const grant = evaluation.grant;
  if (grant.capabilityType !== 'PROCESS_VALIDATION' ||
      grant.policyDecision !== 'ALLOWED' || grant.lifecycleState !== 'PENDING' ||
      grant.idempotency !== 'IDEMPOTENT' || !grant.scope ||
      !Array.isArray(grant.scope.selectors) || !Array.isArray(grant.scope.paths)) {
    throw new Error('Capability grant does not permit bounded process validation.');
  }
  return grant;
}

function readBoundedSource(canonicalTarget) {
  let opened;
  try {
    opened = openVerifiedRegularRead(canonicalTarget, { maxBytes: MAX_INPUT_BYTES });
    return fs.readFileSync(opened.descriptor);
  } catch (error) {
    if (/exceeds protected read size bound/.test(error.message)) {
      throw new Error('Validation target exceeds input limit.');
    }
    throw new Error('Validation target read failed closed.');
  } finally {
    if (opened) fs.closeSync(opened.descriptor);
  }
}

function sanitizedEnvironment() {
  return {
    LANG: 'C',
    LC_ALL: 'C',
    NO_PROXY: '*',
    no_proxy: '*',
    NODE_NO_WARNINGS: '1'
  };
}

function selectorProfile(selector) {
  const profile = SELECTOR_PROFILES[selector];
  if (!profile) throw new Error(`Unknown or unauthorized validation selector: ${selector}`);
  return profile;
}

function authorizeJavaScriptValidation(request, allowedKeys = REQUEST_KEYS) {
  validateRequest(request, allowedKeys);
  const grant = validateGrant(request.grantEvaluation);
  const operationId = requireText(request.operationId, 'operationId');
  if (operationId !== grant.operationId) throw new Error('Validation operationId mismatch.');

  const pathIdentity = createPathIdentityAuthority(process.platform);
  if (!pathIdentity.isCanonicalAbsoluteIdentity(request.workspace)) {
    throw new Error('Validation workspace mismatch.');
  }
  const workspace = canonicalizeAuthorizedRoot(request.workspace);
  if (workspace !== grant.workspace) {
    throw new Error('Validation workspace mismatch.');
  }
  if (grant.lifecycleState !== 'PENDING' || grant.policyDecision !== 'ALLOWED' ||
      !/^R[0-3]$/.test(grant.riskLevel)) {
    throw new Error('Validation policy, risk or lifecycle binding is invalid.');
  }

  const observedAt = requireTimestamp(request.observedAt, 'observedAt');
  const expiresAt = requireTimestamp(grant.expiresAt, 'grant.expiresAt');
  if (Date.parse(observedAt) >= Date.parse(expiresAt)) {
    throw new Error('Process-validation grant is expired.');
  }

  const selector = requireText(request.selector, 'selector').toUpperCase();
  const profile = selectorProfile(selector);
  if (!grant.scope.selectors.includes(selector)) {
    throw new Error(`Unknown or unauthorized validation selector: ${selector}`);
  }
  const target = requireText(request.target, 'target');
  if (!profile.targetExtensions.includes(path.extname(target).toLowerCase())) {
    throw new Error(
      selector === 'NODE_SYNTAX_CHECK'
        ? 'NODE_SYNTAX_CHECK requires a .js target.'
        : `${selector} requires a qualified target extension.`
    );
  }
  const resolved = resolveInspectedFile(workspace, target);
  const authorized = grant.scope.paths.find((entry) => entry.path === target);
  if (!authorized || authorized.canonicalPath !== resolved.canonicalTarget) {
    throw new Error('Validation target is outside the authorized capability scope.');
  }

  const commandAdmission = admitQualifiedCommand(
    createQualifiedCommandCatalog(),
    {
      selector,
      workspace,
      target,
      environmentKeys: Object.keys(sanitizedEnvironment())
    }
  );

  return { operationId, workspace, observedAt, selector, target, resolved, commandAdmission };
}

function parseNodeTestSummary(output) {
  const summary = {};
  for (const [key, field] of [
    ['tests', 'tests'],
    ['suites', 'suites'],
    ['pass', 'passed'],
    ['fail', 'failed'],
    ['cancelled', 'cancelled'],
    ['skipped', 'skipped'],
    ['todo', 'todo']
  ]) {
    const match = output.match(new RegExp(`(?:^|\\n)(?:#|\\u2139)\\s+${key}\\s+(\\d+)`));
    if (match) summary[field] = Number(match[1]);
  }
  const duration = output.match(/(?:^|\n)(?:#|\u2139)\s+duration_ms\s+([0-9]+(?:\.[0-9]+)?)/);
  if (duration) summary.durationMs = Number(duration[1]);
  return Object.keys(summary).length === 0
    ? null
    : deepFreeze(summary);
}

function executeNodeProcess(binding, source) {
  const profile = selectorProfile(binding.selector);
  const args = profile.arguments(binding.target);
  const result = childProcess.spawnSync(process.execPath, args, {
    cwd: binding.workspace,
    shell: false,
    input: profile.stdin(source),
    encoding: 'utf8',
    timeout: profile.timeoutMs,
    maxBuffer: profile.maxOutputBytes,
    windowsHide: true,
    env: sanitizedEnvironment()
  });

  if (result.error) {
    if (result.error.code === 'ETIMEDOUT') throw new Error('Validation process timed out.');
    if (result.error.code === 'ENOBUFS') throw new Error('Validation output exceeded limit.');
    throw new Error('Validation process failed closed.');
  }
  if (result.signal) throw new Error(`Validation process terminated by signal: ${result.signal}`);
  if (!Number.isInteger(result.status)) throw new Error('Validation process returned malformed status.');
  const stdout = typeof result.stdout === 'string' ? result.stdout : '';
  const stderr = typeof result.stderr === 'string' ? result.stderr : '';
  if (Buffer.byteLength(stdout) > profile.maxOutputBytes || Buffer.byteLength(stderr) > profile.maxOutputBytes) {
    throw new Error('Validation output exceeded limit.');
  }

  return { args, result, stdout, stderr, profile };
}

function validationResult(binding, source, projection = null) {
  const { args, result, stdout, stderr, profile } =
    executeNodeProcess(binding, source);
  const passed = result.status === 0;
  const combinedOutput = `${stdout}\n${stderr}`;
  const testSummary = binding.selector === 'NODE_TEST_FILE'
    ? parseNodeTestSummary(combinedOutput)
    : null;

  return deepFreeze({
    schema: 'sdo.process_validation_result.v1',
    operationId: binding.operationId,
    workspace: binding.workspace,
    selector: binding.selector,
    target: {
      requested: binding.target,
      canonical: binding.resolved.canonicalTarget,
      ...(projection ? { authoritativeProjection: projection } : {})
    },
    observedAt: binding.observedAt,
    validation: {
      status: passed ? 'PASSED' : 'FAILED',
      successfulCompletionEligible: passed,
      exitCode: result.status,
      stdout,
      stderr,
      testSummary
    },
    execution: {
      executable: process.execPath,
      arguments: [...args],
      shell: false,
      cwd: binding.workspace,
      qualifiedCommandAdmissionFingerprint:
        binding.commandAdmission.admissionFingerprint,
      timeoutMs: profile.timeoutMs,
      maxInputBytes: MAX_INPUT_BYTES,
      maxOutputBytes: profile.maxOutputBytes,
      environmentKeys: Object.keys(sanitizedEnvironment()).sort()
    }
  });
}

function validateJavaScriptWithGrant(request) {
  const binding = authorizeJavaScriptValidation(request);

  return validationResult(
    binding,
    readBoundedSource(binding.resolved.canonicalTarget)
  );
}

function validateJavaScriptProjectionWithGrant(request) {
  const binding = authorizeJavaScriptValidation(
    request,
    PROJECTION_REQUEST_KEYS
  );
  if (binding.selector !== 'NODE_SYNTAX_CHECK') {
    throw new Error('Projection validation is limited to NODE_SYNTAX_CHECK.');
  }
  const evidence = request.projectionEvidence;

  if (
    !evidence ||
    !Object.isFrozen(evidence) ||
    evidence.schema !== 'sdo.natural_development_r3_composition_result.v1' ||
    evidence.status !== 'COMPLETED' ||
    evidence.target !== binding.target ||
    evidence.ordinaryWorktreeAuthoritative !== false ||
    typeof evidence.managedProjection !== 'string' ||
    !path.isAbsolute(evidence.managedProjection) ||
    !/^[a-f0-9]{64}$/.test(evidence.afterSha256 || '')
  ) {
    throw new Error('Qualified Manifest CAS projection evidence is required.');
  }

  const projection = path.normalize(evidence.managedProjection);
  let stat;

  try {
    stat = fs.lstatSync(projection);
  } catch {
    throw new Error('Authoritative validation projection is unavailable.');
  }

  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    fs.realpathSync(projection) !== projection
  ) {
    throw new Error('Authoritative validation projection is unsafe.');
  }

  const source = readBoundedSource(projection);

  if (sha256(source) !== evidence.afterSha256) {
    throw new Error('Authoritative validation projection hash mismatch.');
  }

  return validationResult(binding, source, projection);
}

module.exports = {
  validateJavaScriptWithGrant,
  validateJavaScriptProjectionWithGrant
};
