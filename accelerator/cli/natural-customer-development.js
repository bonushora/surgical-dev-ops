'use strict';

/*
 * Customer NATURAL development front door.
 *
 * This composition discovers only a fixed project-native Node test shape,
 * executes that test through the existing native read-only sandbox, supplies
 * bounded evidence to cognition, and then re-enters the qualified G1-G3
 * proposal path. It owns no approval or mutation authority.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { discover } = require('../core/repository-discovery');
const { orchestrate } = require('../core/surgical-orchestrator');
const {
  createSensitiveContentPolicy,
  inspectSensitiveContent
} = require('../core/sensitive-content-boundary');
const {
  materializeGovernedEngineeringProposal
} = require('../core/governed-engineering-proposal');
const {
  createGovernedReadOnlyRequest
} = require('./governed-readonly-dispatch');
const {
  prepareInteractiveNaturalDevelopment,
  approveInteractiveNaturalDevelopment
} = require('./natural-development-interactive');

const RESULT_SCHEMA = 'sdo.natural_customer_development_diagnostic.v1';
const MAX_DEPENDENCIES = 8;
const MAX_PROVIDER_CONTEXT_BYTES = 96 * 1024;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function governedExecution(repositoryPath, capabilityType, target, selector = null) {
  const request = createGovernedReadOnlyRequest({
    repositoryPath,
    capabilityType,
    target,
    ...(selector ? { selector } : {})
  });
  const result = orchestrate(request);
  const boundedFailedValidation =
    capabilityType === 'PROCESS_VALIDATION' &&
    result && result.execution &&
    result.execution.schema === 'sdo.process_validation_result.v1' &&
    result.execution.validation &&
    result.execution.validation.status === 'FAILED' &&
    result.execution.validation.successfulCompletionEligible === false;
  if (
    !result || !result.orchestration ||
    (
      result.orchestration.status !== 'COMPLETED' &&
      !boundedFailedValidation
    ) ||
    !result.execution
  ) {
    const status = result && result.orchestration
      ? result.orchestration.status
      : 'MALFORMED';
    const reason = result && result.execution && result.execution.reason
      ? `: ${result.execution.reason}`
      : '';
    throw new Error(
      `Governed customer diagnostic ${capabilityType}/${selector || target} failed closed (${status})${reason}`
    );
  }
  return result.execution;
}

function readProviderSafeFile(repositoryPath, target, policy) {
  const execution = governedExecution(
    repositoryPath,
    'FILESYSTEM_READ',
    target
  );
  if (
    execution.schema !== 'sdo.filesystem_read_result.v1' ||
    !execution.evidence ||
    execution.target.requested !== target
  ) {
    throw new Error('Governed customer file evidence is malformed.');
  }
  const inspected = inspectSensitiveContent(policy, {
    target,
    content: execution.evidence.content,
    source: 'GOVERNED_WORKSPACE_READ'
  });
  if (!inspected.providerSafe || inspected.egressAuthorized !== true) {
    throw new Error('Customer development evidence was blocked by sensitive-content policy.');
  }
  return deepFreeze({
    kind: 'READ_FILE',
    target,
    sha256: execution.evidence.sha256,
    bytes: execution.evidence.bytes,
    content: inspected.content,
    sensitiveDecision: inspected.decision
  });
}

function parseFixedNodeTestScript(packageEvidence) {
  let manifest;
  try {
    manifest = JSON.parse(packageEvidence.content);
  } catch {
    throw new Error('package.json is not valid JSON.');
  }
  const script = manifest && manifest.scripts && manifest.scripts.test;
  if (typeof script !== 'string') {
    throw new Error('A package.json test script is required.');
  }
  const match = script.trim().match(/^node(?:\s+--test)?\s+([A-Za-z0-9_.\/-]+\.js)$/);
  if (!match) {
    throw new Error('The project test script is outside the fixed Node test contract.');
  }
  const target = match[1];
  if (
    path.posix.isAbsolute(target) ||
    path.win32.isAbsolute(target) ||
    target.includes('\\') ||
    target.split('/').some((part) => !part || part === '.' || part === '..') ||
    path.posix.normalize(target) !== target
  ) {
    throw new Error('The project test target escapes the repository boundary.');
  }
  return deepFreeze({ script: script.trim(), target });
}

function relativeJavaScriptDependencies(testTarget, source, trackedFiles) {
  const base = path.posix.dirname(testTarget);
  const candidates = [];
  const expression = /require\(\s*['"](\.\.?\/[A-Za-z0-9_.\/-]+)['"]\s*\)/g;
  for (const match of source.matchAll(expression)) {
    const raw = path.posix.normalize(path.posix.join(base, match[1]));
    if (raw.startsWith('../') || raw === '..' || raw.startsWith('/')) continue;
    for (const candidate of [raw, `${raw}.js`, `${raw}/index.js`]) {
      if (trackedFiles.has(candidate) && candidate.endsWith('.js')) {
        candidates.push(candidate);
        break;
      }
    }
  }
  return [...new Set(candidates)].sort().slice(0, MAX_DEPENDENCIES);
}

function diagnosticContext(diagnostic) {
  const serialized = JSON.stringify(diagnostic);
  if (Buffer.byteLength(serialized) > MAX_PROVIDER_CONTEXT_BYTES) {
    throw new Error('Customer development evidence exceeds the cognitive context bound.');
  }
  return `GOVERNED_CUSTOMER_DIAGNOSTIC:\n${serialized}`;
}

function classifiedDevelopmentFailure(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function prepareNaturalCustomerDevelopment({
  objective,
  activation,
  cognitiveSession,
  workMode = 'SUPERVISED_MICROTASKS'
} = {}) {
  if (
    typeof objective !== 'string' || !objective.trim() ||
    !activation || typeof activation.repositoryPath !== 'string' ||
    !cognitiveSession || typeof cognitiveSession.proposePatch !== 'function'
  ) {
    throw new Error('A bounded customer development objective is required.');
  }

  const repository = discover(activation.repositoryPath);
  if (!repository.worktree.clean) {
    throw new Error('Customer development requires a clean worktree.');
  }
  const inventory = governedExecution(
    repository.repository.path,
    'GIT_READ',
    'workspace-files'
  );
  const tracked = new Set(inventory.result.files);
  if (!tracked.has('package.json')) {
    throw new Error('A tracked package.json is required for project-native test discovery.');
  }

  const policy = createSensitiveContentPolicy({
    authorizedEgressSources: [
      'GOVERNED_PROCESS_OUTPUT',
      'GOVERNED_WORKSPACE_READ'
    ]
  });
  const packageEvidence = readProviderSafeFile(
    repository.repository.path,
    'package.json',
    policy
  );
  const test = parseFixedNodeTestScript(packageEvidence);
  if (!tracked.has(test.target)) {
    throw new Error('The project test target is not tracked in the active repository.');
  }
  const testEvidence = readProviderSafeFile(
    repository.repository.path,
    test.target,
    policy
  );
  const dependencyTargets = relativeJavaScriptDependencies(
    test.target,
    testEvidence.content,
    tracked
  );
  if (dependencyTargets.length === 0) {
    throw new Error('No bounded tracked JavaScript dependency was discovered from the failing test.');
  }
  const dependencyEvidence = dependencyTargets.map((target) =>
    readProviderSafeFile(repository.repository.path, target, policy)
  );
  const validation = governedExecution(
    repository.repository.path,
    'PROCESS_VALIDATION',
    test.target,
    'NODE_TEST_FILE'
  );
  if (
    validation.schema !== 'sdo.process_validation_result.v1' ||
    !validation.validation ||
    validation.validation.status !== 'FAILED'
  ) {
    throw new Error('The project-native test did not produce bounded RED evidence.');
  }

  const failureText = `${validation.validation.stdout}\n${validation.validation.stderr}`;
  const safeFailure = inspectSensitiveContent(policy, {
    target: test.target,
    content: failureText.slice(0, policy.maxInspectionBytes),
    source: 'GOVERNED_PROCESS_OUTPUT'
  });
  if (!safeFailure.providerSafe || safeFailure.egressAuthorized !== true) {
    throw new Error('Project test output was blocked by sensitive-content policy.');
  }
  const diagnostic = deepFreeze({
    schema: RESULT_SCHEMA,
    objective: objective.trim(),
    repository: repository.repository.path,
    branch: repository.repository.branch,
    head: repository.repository.commit,
    clean: true,
    projectTest: {
      manifest: 'package.json',
      script: test.script,
      resolvedSelector: 'NODE_TEST_FILE',
      target: test.target,
      status: 'FAILED',
      exitCode: validation.validation.exitCode,
      stdout: safeFailure.content,
      evidenceSha256: sha256(failureText)
    },
    inspectedFiles: [packageEvidence, testEvidence, ...dependencyEvidence],
    operationalAuthority: false,
    mutationAuthority: false,
    approvalAuthority: false,
    genericShell: false
  });

  const governedProposal = await cognitiveSession.proposePatch(
    objective.trim(),
    activation,
    diagnosticContext(diagnostic),
    deepFreeze({
      schema: 'sdo.evidence_bound_proposal_boundary.v1',
      governedEvidence: dependencyEvidence.map((item) => ({
        target: item.target,
        sha256: item.sha256
      }))
    })
  );
  const selected = dependencyEvidence.find((item) =>
    item.target === governedProposal.target
  );
  if (!selected) {
    throw classifiedDevelopmentFailure(
      'COGNITIVE_TARGET_OUTSIDE_GOVERNED_EVIDENCE',
      'Cognitive proposal target is outside governed evidence.'
    );
  }
  const evidenceBoundProposal = materializeGovernedEngineeringProposal({
    schema: 'sdo.ai_engineering_patch_proposal.v1',
    objective: objective.trim(),
    target: governedProposal.target,
    beforeSha256: selected.sha256,
    replacementBase64: governedProposal.replacementBase64,
    reason: governedProposal.reason,
    validationKind: governedProposal.validationKind
  });

  let planningStep = 0;
  const boundedCognition = Object.freeze({
    async decideEvidence() {
      planningStep += 1;
      return planningStep === 1
        ? deepFreeze({
            schema: 'sdo.natural_evidence_decision.v1',
            decision: 'REQUEST_EVIDENCE',
            response: null,
            evidenceRequest: {
              kind: 'READ_FILE',
              target: selected.target,
              reason: 'Re-observe the exact proposed BEFORE through the qualified G2 boundary.'
            }
          })
        : deepFreeze({
            schema: 'sdo.natural_evidence_decision.v1',
            decision: 'RESPOND',
            response: 'The exact proposed target was independently re-observed.',
            evidenceRequest: null
          });
    },
    async proposePatch() {
      return evidenceBoundProposal;
    }
  });

  const pending = await prepareInteractiveNaturalDevelopment({
    request: deepFreeze({ objective: objective.trim(), target: selected.target }),
    activation,
    cognitiveSession: boundedCognition,
    workMode
  });
  return deepFreeze({
    ...pending,
    diagnostic,
    approval: {
      operation: 'mutation.applyConditional',
      risk: 'R3',
      authorityOwner: 'Surgical DevOps / exact local human decision',
      duration: 'single governed execution',
      scope: 'ONE_SHOT exact full-file replacement',
      excludedPowers: [
        'arbitrary shell', 'arbitrary filesystem access', 'push', 'merge',
        'release', 'publish', 'deploy'
      ]
    }
  });
}

function writeQualificationProjection(root, evidence, proposal) {
  for (const item of evidence) {
    const target = path.join(root, ...item.target.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
      target,
      item.target === proposal.target
        ? Buffer.from(proposal.replacementBase64, 'base64')
        : item.content,
      { flag: 'wx' }
    );
  }
  for (const args of [
    ['init', '-q'],
    ['config', 'user.email', 'qualification@surgical.invalid'],
    ['config', 'user.name', 'Surgical Qualification'],
    ['add', '.'],
    ['commit', '-qm', 'bounded post-approval qualification projection']
  ]) {
    execFileSync('git', args, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
  }
}

function qualifyApprovedCustomerDevelopment(pending) {
  if (
    !pending.diagnostic ||
    !pending.diagnostic.projectTest ||
    !Array.isArray(pending.diagnostic.inspectedFiles)
  ) {
    throw new Error('Bounded customer diagnostic evidence is required after approval.');
  }
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-customer-qualification-'))
  );
  try {
    writeQualificationProjection(
      root,
      pending.diagnostic.inspectedFiles,
      pending.patchProposal
    );
    const validation = governedExecution(
      root,
      'PROCESS_VALIDATION',
      pending.diagnostic.projectTest.target,
      'NODE_TEST_FILE'
    );
    if (
      validation.schema !== 'sdo.process_validation_result.v1' ||
      !validation.validation ||
      validation.validation.status !== 'PASSED'
    ) {
      throw new Error('The approved customer change did not make the project test GREEN.');
    }
    return deepFreeze({
      schema: 'sdo.natural_customer_post_approval_qualification.v1',
      status: 'GREEN',
      selector: 'NODE_TEST_FILE',
      target: pending.diagnostic.projectTest.target,
      exitCode: validation.validation.exitCode,
      testSummary: validation.validation.testSummary,
      disposableProjection: true,
      liveWorkspaceMutationDuringQualification: false,
      operationalAuthority: false,
      mutationAuthority: false
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function approveNaturalCustomerDevelopment(options = {}) {
  const completed = await approveInteractiveNaturalDevelopment(options);
  const customerQualification = qualifyApprovedCustomerDevelopment(options.pending);
  return deepFreeze({
    ...completed,
    customerQualification
  });
}

module.exports = Object.freeze({
  RESULT_SCHEMA,
  prepareNaturalCustomerDevelopment,
  approveNaturalCustomerDevelopment
});
