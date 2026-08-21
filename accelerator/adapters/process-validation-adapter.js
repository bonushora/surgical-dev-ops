'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const { openVerifiedRegularRead } = require('./filesystem-safe-read-adapter');
const {
  createPathIdentityAuthority,
  canonicalizeAuthorizedRoot,
  resolveInspectedFile
} = require('../core/workspace-boundary');

const TIMEOUT_MS = 2000;
const MAX_OUTPUT_BYTES = 32 * 1024;
const MAX_INPUT_BYTES = 1024 * 1024;
const REQUEST_KEYS = new Set([
  'operationId', 'workspace', 'selector', 'target', 'grantEvaluation', 'observedAt'
]);

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

function validateRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new Error('Validation request is missing or malformed.');
  }
  if (Object.keys(request).some((key) => !REQUEST_KEYS.has(key))) {
    throw new Error('Caller-controlled executable, arguments or environment are forbidden.');
  }
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

function validateJavaScriptWithGrant(request) {
  validateRequest(request);
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
  if (selector !== 'NODE_SYNTAX_CHECK' || !grant.scope.selectors.includes(selector)) {
    throw new Error(`Unknown or unauthorized validation selector: ${selector}`);
  }
  const target = requireText(request.target, 'target');
  if (path.extname(target).toLowerCase() !== '.js') {
    throw new Error('NODE_SYNTAX_CHECK requires a .js target.');
  }
  const resolved = resolveInspectedFile(workspace, target);
  const authorized = grant.scope.paths.find((entry) => entry.path === target);
  if (!authorized || authorized.canonicalPath !== resolved.canonicalTarget) {
    throw new Error('Validation target is outside the authorized capability scope.');
  }

  const source = readBoundedSource(resolved.canonicalTarget);
  const args = ['--check', '-'];
  const result = childProcess.spawnSync(process.execPath, args, {
    cwd: workspace,
    shell: false,
    input: source,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
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
  if (Buffer.byteLength(stdout) > MAX_OUTPUT_BYTES || Buffer.byteLength(stderr) > MAX_OUTPUT_BYTES) {
    throw new Error('Validation output exceeded limit.');
  }
  const passed = result.status === 0;

  return deepFreeze({
    schema: 'sdo.process_validation_result.v1',
    operationId,
    workspace,
    selector,
    target: { requested: target, canonical: resolved.canonicalTarget },
    observedAt,
    validation: {
      status: passed ? 'PASSED' : 'FAILED',
      successfulCompletionEligible: passed,
      exitCode: result.status,
      stdout,
      stderr
    },
    execution: {
      executable: process.execPath,
      arguments: [...args],
      shell: false,
      cwd: workspace,
      timeoutMs: TIMEOUT_MS,
      maxInputBytes: MAX_INPUT_BYTES,
      maxOutputBytes: MAX_OUTPUT_BYTES,
      environmentKeys: Object.keys(sanitizedEnvironment()).sort()
    }
  });
}

module.exports = { validateJavaScriptWithGrant };
