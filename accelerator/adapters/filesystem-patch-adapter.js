'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { openVerifiedRegularRead } = require('./filesystem-safe-read-adapter');
const {
  createPathIdentityAuthority,
  canonicalizeAuthorizedRoot,
  resolveInspectedFile
} = require('../core/workspace-boundary');
const { deriveCapabilityGrantFingerprint } = require('../core/capability-grant');
const { evaluateMutationAuthority } = require('../core/authoritative-clock');
const { durabilityClaims } = require('../core/mutation-durability');
const {
  requireQualifiedMutationProvider,
  validateMutationProviderResult
} = require('../core/mutation-provider');

const {
  projectQualifiedWorkspaceCasEvidence
} = require(
  '../reconstruction/v3/adapters/' +
  'qualified-workspace-cas-projection'
);

const MAX_BYTES = 1024 * 1024;

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

function hash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

function requireTimestamp(value, name) {
  const result = requireText(value, name);
  const parsed = Date.parse(result);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== result) {
    throw new Error(`${name} must be a canonical ISO timestamp.`);
  }
  return result;
}

function validateGrant(evaluation) {
  if (!evaluation || evaluation.schema !== 'sdo.capability_grant_evaluation.v1' ||
      evaluation.decision !== 'ALLOWED' || !evaluation.grant || !isDeepFrozen(evaluation)) {
    throw new Error('A valid immutable ALLOWED capability grant is required.');
  }
  const grant = evaluation.grant;
  const target = grant.scope && grant.scope.target;
  if (grant.capabilityType !== 'FILESYSTEM_PATCH' || grant.policyDecision !== 'ALLOWED' ||
      grant.underlyingPolicyDecision !== 'APPROVAL_REQUIRED' || grant.riskLevel !== 'R3' ||
      !/^[a-f0-9]{64}$/.test(grant.approvalAuthorityFingerprint || '') ||
      !/^[a-f0-9]{64}$/.test(grant.verifiedIdentityAssertionFingerprint || '') ||
      !/^[a-f0-9]{64}$/.test(grant.identityVerificationEvidenceFingerprint || '') ||
      !/^[a-f0-9]{64}$/.test(grant.fingerprint || '') ||
      deriveCapabilityGrantFingerprint(grant) !== grant.fingerprint ||
      !grant.temporalAuthority ||
      grant.lifecycleState !== 'PENDING' ||
      grant.idempotency !== 'IDEMPOTENT' || !target ||
      typeof target.path !== 'string' || !target.path ||
      typeof target.canonicalPath !== 'string' ||
      !/^[a-f0-9]{64}$/.test(target.beforeSha256) ||
      !/^[a-f0-9]{64}$/.test(target.replacementSha256)) {
    throw new Error('Capability grant does not permit a bounded single-file patch.');
  }
  return grant;
}

function readRegularNoFollow(target) {
  let opened;
  try {
    opened = openVerifiedRegularRead(target, { maxBytes: MAX_BYTES });
    const content = fs.readFileSync(opened.descriptor);
    return { content, stat: opened.stat };
  } catch (error) {
    if (/exceeds protected read size bound/.test(error.message)) {
      throw new Error('Target exceeds the bounded patch size.');
    }
    throw error;
  } finally {
    if (opened) fs.closeSync(opened.descriptor);
  }
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

function filesystemIdentity(stat) {
  return {
    dev: String(stat.dev),
    ino: String(stat.ino),
    size: String(stat.size),
    mtimeNs: String(stat.mtimeNs),
    ctimeNs: String(stat.ctimeNs)
  };
}

function directoryIdentity(stat) {
  return {
    dev: String(stat.dev),
    ino: String(stat.ino)
  };
}

function captureAncestorIdentityChain(workspace, target) {
  const parent = path.dirname(target);
  const relative = path.relative(workspace, parent);
  const chain = [];
  let current = workspace;

  const capture = (candidate) => {
    const stat = fs.statSync(candidate, { bigint: true });
    if (!stat.isDirectory()) throw new Error('Mutation ancestor is not a directory.');
    chain.push({
      path: candidate,
      identity: directoryIdentity(stat)
    });
  };

  capture(current);

  if (relative) {
    for (const segment of relative.split(path.sep)) {
      current = path.join(current, segment);
      capture(current);
    }
  }

  return deepFreeze(chain);
}

function transactionEvidence(context) {
  const state = context && context.current();
  if (!state || !Object.isFrozen(state.transaction) || !state.journal ||
      state.transaction.transactionId !== state.journal.identity.transactionId ||
      state.transaction.stage !== state.journal.transaction.stage) {
    throw new Error('Mutation transaction/journal context is malformed or inconsistent.');
  }
  return deepFreeze({
    transactionId: state.transaction.transactionId,
    journalId: state.journal.journalId,
    stage: state.transaction.stage,
    lockId: state.transaction.lock && state.transaction.lock.lockId,
    commitAuthorityFingerprint: state.transaction.commitAuthority &&
      state.transaction.commitAuthority.fingerprint,
    classification: state.transaction.stage === 'RECOVERY_REQUIRED'
      ? 'RECOVERY_REQUIRED' : 'IN_PROGRESS'
  });
}

function evidence({ operationId, workspace, requested, canonical, beforeHash, afterHash,
  outcome, recovery, observedAt, temporalAuthority, commitAuthority, transaction,
  durability = null, mutationProvider = null, workspaceCasBinding = null }) {
  return deepFreeze({
    schema: 'sdo.filesystem_patch_result.v1', operationId, workspace,
    target: { requested, canonical }, beforeSha256: beforeHash, afterSha256: afterHash,
    outcome, recovery, observedAt, temporalAuthority, commitAuthority: commitAuthority || null,
    transaction, durability, mutationProvider, workspaceCasBinding
  });
}

function authorityBounds(grant) {
  const temporal = grant.temporalAuthority;
  return {
    identity: temporal.identity,
    approval: temporal.approval,
    grant: { ...temporal.grant, fingerprint: grant.fingerprint }
  };
}

function observeAuthority(clock, grant, previousReading = null) {
  try {
    return evaluateMutationAuthority(clock, authorityBounds(grant), previousReading);
  } catch {
    return null;
  }
}

function denyBeforeCommit(context, temporalAuthority, reason, transactionContext) {
  const error = new Error(reason);
  if (!temporalAuthority || !temporalAuthority.reading) throw error;
  const reading = temporalAuthority && temporalAuthority.reading;
  error.evidence = evidence({ ...context, afterHash: null, outcome: 'FAILED',
    recovery: 'NOT_STARTED_AUTHORITY_DENIED',
    observedAt: reading ? reading.wallTime : context.observedAt,
    temporalAuthority: deepFreeze({
      schema: 'sdo.mutation_commit_authority.v1',
      commitBoundary: 'IMMEDIATELY_BEFORE_ATOMIC_REPLACEMENT',
      physicalCommit: 'NOT_STARTED',
      decision: 'DENIED',
      evaluation: temporalAuthority
    }),
    transaction: transactionEvidence(transactionContext)
  });
  throw error;
}


function contentAddressedDurability(providerEvidence) {
  const durability = providerEvidence && providerEvidence.durability;
  return durability &&
    durability.schema === 'sdo.content_addressed_provider_evidence.v1'
    ? durability
    : null;
}

function verifyPersistedWorkspaceCasBinding({
  priorEvidence,
  providerEvidence,
  workspace,
  target,
  expectedSha256
}) {
  const schema =
    'sdo.workspace_cas_replay_binding_verification.v1';

  if (
    !Object.prototype.hasOwnProperty.call(
      priorEvidence,
      'workspaceCasBinding'
    )
  ) {
    return deepFreeze({
      schema,
      decision:
        'HISTORICAL_EVIDENCE',
      bindingRequired:
        false
    });
  }

  const projected =
    priorEvidence.workspaceCasBinding;

  if (
    !projected ||
    typeof projected !== 'object' ||
    !Object.isFrozen(projected) ||
    projected.schema !==
      'sdo.reconstruction.workspace_cas_binding.v1' ||
    projected.decision !== 'ALLOWED' ||
    !projected.binding ||
    typeof projected.binding !== 'object' ||
    !Object.isFrozen(projected.binding)
  ) {
    throw new Error(
      'Persisted workspace/CAS binding is missing, mutable or denied.'
    );
  }

  const canonicalWorkspace =
    canonicalizeAuthorizedRoot(workspace);

  const resolved =
    resolveInspectedFile(
      canonicalWorkspace,
      requireText(target, 'target')
    );

  const binding =
    projected.binding;

  const durability =
    contentAddressedDurability(providerEvidence);

  const authority =
    durability &&
    durability.authority;

  const expectedKeys = [
    'requestedRoot',
    'physicalRoot',
    'requestedTarget',
    'physicalTarget',
    'providerId',
    'qualificationFingerprint',
    'operation',
    'beforeSha256',
    'replacementSha256',
    'beforeManifestOid',
    'afterManifestOid',
    'ordinaryWorktreeAuthoritative'
  ].sort();

  const actualKeys =
    Object.keys(binding).sort();

  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some(
      (key, index) =>
        key !== expectedKeys[index]
    ) ||
    !authority ||
    binding.requestedRoot !==
      canonicalWorkspace ||
    binding.physicalRoot !==
      canonicalWorkspace ||
    binding.requestedTarget !==
      resolved.canonicalTarget ||
    binding.physicalTarget !==
      resolved.canonicalTarget ||
    binding.providerId !==
      providerEvidence.providerId ||
    binding.qualificationFingerprint !==
      providerEvidence.qualificationFingerprint ||
    binding.operation !==
      'COMPARE_AND_REPLACE' ||
    binding.beforeSha256 !==
      providerEvidence.beforeSha256 ||
    binding.replacementSha256 !==
      expectedSha256 ||
    binding.replacementSha256 !==
      providerEvidence.replacementSha256 ||
    binding.beforeManifestOid !==
      authority.beforeManifestOid ||
    binding.afterManifestOid !==
      authority.afterManifestOid ||
    binding.ordinaryWorktreeAuthoritative !==
      false
  ) {
    throw new Error(
      'Persisted workspace/CAS binding conflicts with authoritative replay evidence.'
    );
  }

  return deepFreeze({
    schema,
    decision:
      'PROVEN_BOUND',
    bindingRequired:
      true,
    afterManifestOid:
      binding.afterManifestOid,
    replacementSha256:
      binding.replacementSha256,
    ordinaryWorktreeAuthoritative:
      false
  });
}

function verifyContentAddressedProjection(providerEvidence, expectedSha256) {
  if (!/^[a-f0-9]{64}$/.test(expectedSha256 || '')) {
    throw new Error('Content-addressed expected SHA-256 is malformed.');
  }

  const durability = contentAddressedDurability(providerEvidence);
  if (!durability ||
      durability.ordinaryWorktreeAuthoritative !== false ||
      !durability.authority ||
      !durability.materialization) {
    throw new Error('Content-addressed provider evidence is incomplete.');
  }

  const authority = durability.authority;
  const materialization = durability.materialization;

  const manifestOid =
    authority.afterManifestOid ||
    authority.manifestOid ||
    authority.currentManifestOid;

  if (authority.decision !== 'APPLIED' ||
      authority.replacementSha256 !== expectedSha256 ||
      !/^[a-f0-9]{40,64}$/.test(manifestOid || '')) {
    throw new Error('Content-addressed authority evidence is not bound to AFTER.');
  }

  if (!['MATERIALIZED', 'ALREADY_MATERIALIZED'].includes(
        materialization.decision
      ) ||
      materialization.contentSha256 !== expectedSha256 ||
      materialization.expectedManifestOid !== manifestOid ||
      materialization.observedManifestOid !== manifestOid ||
      typeof materialization.projection !== 'string' ||
      !path.isAbsolute(materialization.projection)) {
    throw new Error('Managed materialization evidence is not bound to authority.');
  }

  const projection = path.normalize(materialization.projection);

  let lexical;
  try {
    lexical = fs.lstatSync(projection);
  } catch {
    throw new Error('Managed authoritative projection is unavailable.');
  }

  if (lexical.isSymbolicLink() || !lexical.isFile()) {
    throw new Error('Managed authoritative projection is unsafe.');
  }

  const opened = readRegularNoFollow(projection);
  const observedSha256 = hash(opened.content);

  if (observedSha256 !== expectedSha256) {
    throw new Error('Managed authoritative projection hash mismatch.');
  }

  return deepFreeze({
    schema: 'sdo.content_addressed_after_verification.v1',
    decision: 'PROVEN_APPLIED',
    manifestOid,
    projection,
    expectedSha256,
    observedSha256,
    ordinaryWorktreeAuthoritative: false
  });
}

function patchFileWithGrant({
  operationId, workspace, target, replacement, grantEvaluation
}, temporalRuntime = {}) {
  const qualifiedProvider = requireQualifiedMutationProvider(temporalRuntime.mutationProvider);
  const grant = validateGrant(grantEvaluation);
  const normalizedOperationId = requireText(operationId, 'operationId');
  if (normalizedOperationId !== grant.operationId) throw new Error('Capability operationId mismatch.');
  const pathIdentity = createPathIdentityAuthority(process.platform);
  if (!pathIdentity.isCanonicalAbsoluteIdentity(workspace)) {
    throw new Error('Capability workspace mismatch.');
  }
  const canonicalWorkspace = canonicalizeAuthorizedRoot(workspace);
  if (canonicalWorkspace !== grant.workspace) {
    throw new Error('Capability workspace mismatch.');
  }
  const transactionContext = temporalRuntime.mutationTransaction;
  const initialTransaction = transactionContext && transactionContext.current();
  if (!initialTransaction || initialTransaction.transaction.stage !== 'LOCKED' ||
      !initialTransaction.transaction.lock) {
    throw new Error('Exact-target mutation lock and journaled LOCKED transaction are required.');
  }
  const entryAuthority = observeAuthority(
    temporalRuntime.authoritativeClock, grant, temporalRuntime.previousReading || null
  );
  if (!entryAuthority || entryAuthority.decision !== 'ALLOWED') {
    denyBeforeCommit({ operationId: normalizedOperationId, workspace: canonicalWorkspace,
      requested: target, canonical: grant.scope.target.canonicalPath,
      beforeHash: grant.scope.target.beforeSha256,
      observedAt: entryAuthority && entryAuthority.reading.wallTime }, entryAuthority,
    'Mutation authority is invalid before preparation.', transactionContext);
  }
  const requested = requireText(target, 'target');
  if (Array.isArray(replacement) || !(typeof replacement === 'string' || Buffer.isBuffer(replacement))) {
    throw new Error('Structured replacement content must be a string or Buffer.');
  }
  const replacementBytes = Buffer.from(replacement);
  if (replacementBytes.byteLength > MAX_BYTES) throw new Error('Replacement exceeds the bounded patch size.');
  const replacementHash = hash(replacementBytes);
  if (replacementHash !== grant.scope.target.replacementSha256) {
    throw new Error('Replacement content does not match the exact authorized SHA-256.');
  }

  const resolved = resolveInspectedFile(canonicalWorkspace, requested);
  const lexicalTarget = path.resolve(canonicalWorkspace, requested);
  let lexicalStat;
  try {
    lexicalStat = fs.lstatSync(lexicalTarget);
  } catch {
    throw new Error('Requested target cannot be resolved as an existing file.');
  }
  if (lexicalStat.isSymbolicLink()) {
    throw new Error('Symlink targets are forbidden.');
  }
  if (!lexicalStat.isFile()) {
    throw new Error('Requested target is not a regular file.');
  }
  const authorized = grant.scope.target;
  if (requested !== authorized.path || resolved.canonicalTarget !== authorized.canonicalPath) {
    throw new Error('Requested target is outside the exact authorized capability scope.');
  }
  const before = readRegularNoFollow(resolved.canonicalTarget);
  const beforeHash = hash(before.content);
  const afterHash = replacementHash;
  if (beforeHash !== authorized.beforeSha256) {
    if (beforeHash === afterHash) {
      throw new Error('ALREADY_APPLIED requires a previously FINALIZED_SUCCESS journal.');
    }
    throw new Error('BEFORE hash mismatch; target is stale or conflicting.');
  }

  const checked = readRegularNoFollow(resolved.canonicalTarget);
  if (!sameIdentity(before.stat, checked.stat) || hash(checked.content) !== beforeHash) {
    throw new Error('Target changed concurrently before replacement.');
  }
  transactionContext.advance('BEFORE_VERIFIED');

  const preparationAuthority = observeAuthority(
    temporalRuntime.authoritativeClock, grant, entryAuthority.reading
  );
  const commitContext = { operationId: normalizedOperationId, workspace: canonicalWorkspace,
    requested, canonical: resolved.canonicalTarget, beforeHash,
    observedAt: preparationAuthority && preparationAuthority.reading.wallTime };
  if (!preparationAuthority || preparationAuthority.decision !== 'ALLOWED') {
    denyBeforeCommit(commitContext, preparationAuthority,
      'Mutation authority expired or became anomalous before physical commit.', transactionContext);
  }
  transactionContext.advance('MUTATION_STARTED');
  const commitAuthority = observeAuthority(
    temporalRuntime.authoritativeClock, grant, preparationAuthority.reading
  );
  if (!commitAuthority || commitAuthority.decision !== 'ALLOWED') {
    denyBeforeCommit(commitContext, commitAuthority,
      'Mutation authority expired or became anomalous at physical commit.', transactionContext);
  }
  const commitEvidence = deepFreeze({
    schema: 'sdo.mutation_commit_authority.v1',
    commitBoundary: 'IMMEDIATELY_BEFORE_ATOMIC_REPLACEMENT',
    physicalCommit: 'APPLIED', decision: 'ALLOWED', evaluation: commitAuthority
  });
  const durableCommitAuthority = transactionContext.verifyCommitAuthority({
    policyDecision: grant.policyDecision,
    riskLevel: grant.riskLevel,
    capabilityType: grant.capabilityType,
    action: 'PATCH_FILE',
    scope: grant.scope,
    authoritativeEvaluation: commitAuthority
  });
  const committedTransaction = transactionContext.current();
  if (committedTransaction.transaction.stage !== 'COMMIT_AUTHORITY_VERIFIED' ||
      committedTransaction.transaction.commitAuthority !== durableCommitAuthority ||
      committedTransaction.journal.transaction.stage !== 'COMMIT_AUTHORITY_VERIFIED' ||
      !committedTransaction.journal.transaction.commitAuthority ||
      committedTransaction.journal.transaction.commitAuthority.fingerprint !==
        durableCommitAuthority.fingerprint) {
    throw new Error('Durable commit-authority journal proof is required before replacement.');
  }
  let physicalDurability;
  let providerEvidence;
  let workspaceCasBinding = null;
  try {
    const providerRequest = deepFreeze({
      schema: 'sdo.compare_and_replace_request.v1',
      operation: 'COMPARE_AND_REPLACE', phase: 'AUTHORIZED_PATCH',
      transactionId: committedTransaction.transaction.transactionId,
      operationId: normalizedOperationId, workspace: canonicalWorkspace,
      target: resolved.canonicalTarget,
      expectedIdentity: filesystemIdentity(before.stat),
      expectedAncestorIdentityChain:
        captureAncestorIdentityChain(canonicalWorkspace, resolved.canonicalTarget),
      beforeSha256: beforeHash, replacementSha256: afterHash,
      replacementBase64: replacementBytes.toString('base64'),
      mode: Number(before.stat.mode),
      commitAuthorityFingerprint: durableCommitAuthority.fingerprint
    });
    providerEvidence = validateMutationProviderResult(
      qualifiedProvider.boundary.compareAndReplace(providerRequest, {
        durabilityAdapter: temporalRuntime.durabilityAdapter
      }), providerRequest, qualifiedProvider.decision
    );
    if (providerEvidence.outcome !== 'APPLIED') {
      const providerError = new Error(`Qualified compare-and-replace ${providerEvidence.outcome}.`);
      providerError.physicalCommitOccurred = providerEvidence.outcome === 'AMBIGUOUS_POSTCOMMIT';
      throw providerError;
    }
    physicalDurability = providerEvidence.durability || null;

    if (contentAddressedDurability(providerEvidence)) {
      workspaceCasBinding =
        projectQualifiedWorkspaceCasEvidence({
          request: providerRequest,
          result: providerEvidence
        });

      if (
        workspaceCasBinding.decision !== 'ALLOWED' ||
        !workspaceCasBinding.binding
      ) {
        const projectionError = new Error(
          'Qualified workspace/CAS projection was denied after provider APPLIED.'
        );

        projectionError.physicalCommitOccurred = true;
        projectionError.authoritativeProjectionDenied = true;
        throw projectionError;
      }
    }
  } catch (commitError) {
    if (!commitError.physicalCommitOccurred) throw commitError;
    try { transactionContext.requireRecovery(); } catch {}
    const error = new Error(`Physical replacement durability is ambiguous: ${commitError.message}`);
    error.evidence = evidence({ operationId: normalizedOperationId,
      workspace: canonicalWorkspace, requested, canonical: resolved.canonicalTarget,
      beforeHash, afterHash, outcome: 'FAILED',
      recovery: commitError.authoritativeProjectionDenied
        ? 'RECOVERY_REQUIRED_AUTHORITATIVE_PROJECTION'
        : 'RECOVERY_REQUIRED_JOURNAL_AMBIGUITY',
      observedAt: commitAuthority.reading.wallTime, temporalAuthority: commitEvidence,
      commitAuthority: durableCommitAuthority,
      transaction: transactionEvidence(transactionContext),
      durability: deepFreeze({
        classification: commitError.authoritativeProjectionDenied
          ? 'AUTHORITATIVE_PROJECTION_DENIED'
          : 'POST_RENAME_AMBIGUOUS',
        claims: durabilityClaims()
      }),
      mutationProvider: providerEvidence,
      workspaceCasBinding });
    throw error;
  }
  try {
    transactionContext.advance('PHYSICAL_APPLIED');
  } catch (stageError) {
    try { transactionContext.requireRecovery(); } catch {}
    const error = new Error(`Physical mutation applied but PHYSICAL_APPLIED journal failed: ${stageError.message}`);
    error.evidence = evidence({ operationId: normalizedOperationId, workspace: canonicalWorkspace,
      requested, canonical: resolved.canonicalTarget, beforeHash, afterHash,
      outcome: 'FAILED', recovery: 'RECOVERY_REQUIRED_JOURNAL_AMBIGUITY',
      observedAt: commitAuthority.reading.wallTime, temporalAuthority: commitEvidence,
      commitAuthority: durableCommitAuthority,
      transaction: transactionEvidence(transactionContext), durability: physicalDurability });
    throw error;
  }
  const contentAddressed = contentAddressedDurability(providerEvidence);
  let afterResolved;
  let after;
  try {
    if (contentAddressed) {
      verifyContentAddressedProjection(providerEvidence, afterHash);
    } else {
      afterResolved = resolveInspectedFile(canonicalWorkspace, requested);
      after = readRegularNoFollow(afterResolved.canonicalTarget);
      if (afterResolved.canonicalTarget !== resolved.canonicalTarget ||
          hash(after.content) !== afterHash || !after.content.equals(replacementBytes)) {
        throw new Error('AFTER verification failed.');
      }
    }
  } catch (verificationError) {
    try { transactionContext.requireRecovery(); } catch {}

    if (contentAddressed) {
      const error = new Error(
        `Content-addressed AFTER verification failed: ${verificationError.message}`
      );
      error.evidence = evidence({
        operationId: normalizedOperationId,
        workspace: canonicalWorkspace,
        requested,
        canonical: resolved.canonicalTarget,
        beforeHash,
        afterHash,
        outcome: 'FAILED',
        recovery: 'RECOVERY_REQUIRED_AUTHORITATIVE_PROJECTION',
        observedAt: commitAuthority.reading.wallTime,
        temporalAuthority: commitEvidence,
        commitAuthority: durableCommitAuthority,
        transaction: transactionEvidence(transactionContext),
        durability: physicalDurability,
        mutationProvider: providerEvidence
      });
      throw error;
    }

    let owned = false;
    try {
      const current = readRegularNoFollow(resolved.canonicalTarget);
      owned = hash(current.content) === afterHash && current.content.equals(replacementBytes);
    } catch {}
    if (owned) {
      try {
        const current = readRegularNoFollow(resolved.canonicalTarget);
        const restoreRequest = deepFreeze({
          schema: 'sdo.compare_and_replace_request.v1', operation: 'COMPARE_AND_REPLACE',
          phase: 'BOUNDED_COMPENSATING_RESTORE',
          transactionId: committedTransaction.transaction.transactionId,
          operationId: normalizedOperationId, workspace: canonicalWorkspace,
          target: resolved.canonicalTarget,
          expectedIdentity: filesystemIdentity(current.stat),
          expectedAncestorIdentityChain:
            captureAncestorIdentityChain(canonicalWorkspace, resolved.canonicalTarget),
          beforeSha256: afterHash, replacementSha256: beforeHash,
          replacementBase64: before.content.toString('base64'), mode: Number(before.stat.mode),
          commitAuthorityFingerprint: durableCommitAuthority.fingerprint
        });
        const restoredResult = validateMutationProviderResult(
          qualifiedProvider.boundary.compareAndReplace(restoreRequest, {
            durabilityAdapter: temporalRuntime.durabilityAdapter
          }), restoreRequest, qualifiedProvider.decision
        );
        if (restoredResult.outcome !== 'APPLIED') throw new Error('Restore compare-and-replace failed.');
        const restored = readRegularNoFollow(resolved.canonicalTarget);
        if (hash(restored.content) !== beforeHash) throw new Error('Restore verification failed.');
        try { transactionContext.advance('RECOVERED'); } catch {}
        const error = new Error('AFTER verification failed; original content was restored.');
        error.evidence = evidence({ operationId: normalizedOperationId, workspace: canonicalWorkspace,
          requested, canonical: resolved.canonicalTarget, beforeHash, afterHash,
          outcome: 'FAILED', recovery: 'RESTORED',
          observedAt: commitAuthority.reading.wallTime, temporalAuthority: commitEvidence,
          commitAuthority: durableCommitAuthority,
          transaction: transactionEvidence(transactionContext), durability: physicalDurability });
        throw error;
      } catch (restoreError) {
        if (restoreError.evidence) throw restoreError;
      }
    }
    const error = new Error('AFTER verification failed; target ownership is unproven and was not restored.');
    error.evidence = evidence({ operationId: normalizedOperationId, workspace: canonicalWorkspace,
      requested, canonical: resolved.canonicalTarget, beforeHash, afterHash,
      outcome: 'FAILED', recovery: 'NOT_ATTEMPTED_UNPROVEN_OWNERSHIP',
      observedAt: commitAuthority.reading.wallTime, temporalAuthority: commitEvidence,
      commitAuthority: durableCommitAuthority,
      transaction: transactionEvidence(transactionContext), durability: physicalDurability });
    throw error;
  }
  try {
    transactionContext.advance('AFTER_VERIFIED');
  } catch (stageError) {
    try { transactionContext.requireRecovery(); } catch {}
    const error = new Error(`AFTER verified but journal append failed: ${stageError.message}`);
    error.evidence = evidence({ operationId: normalizedOperationId, workspace: canonicalWorkspace,
      requested, canonical: resolved.canonicalTarget, beforeHash, afterHash,
      outcome: 'FAILED', recovery: 'RECOVERY_REQUIRED_JOURNAL_AMBIGUITY',
      observedAt: commitAuthority.reading.wallTime, temporalAuthority: commitEvidence,
      commitAuthority: durableCommitAuthority,
      transaction: transactionEvidence(transactionContext), durability: physicalDurability });
    throw error;
  }
  return evidence({ operationId: normalizedOperationId, workspace: canonicalWorkspace,
    requested, canonical: resolved.canonicalTarget, beforeHash, afterHash,
    outcome: 'APPLIED', recovery: 'NOT_REQUIRED',
    observedAt: commitAuthority.reading.wallTime, temporalAuthority: commitEvidence,
    commitAuthority: durableCommitAuthority,
    transaction: transactionEvidence(transactionContext), durability: physicalDurability,
    mutationProvider: providerEvidence, workspaceCasBinding });
}

function verifyAppliedFile({ workspace, target, expectedSha256 }) {
  const canonicalWorkspace = canonicalizeAuthorizedRoot(workspace);
  if (canonicalWorkspace !== workspace || !/^[a-f0-9]{64}$/.test(expectedSha256 || '')) {
    throw new Error('Completed mutation verification input is malformed.');
  }
  const resolved = resolveInspectedFile(canonicalWorkspace, requireText(target, 'target'));
  const current = readRegularNoFollow(resolved.canonicalTarget);
  const currentSha256 = hash(current.content);
  return deepFreeze({
    schema: 'sdo.filesystem_patch_replay_verification.v1',
    workspace: canonicalWorkspace,
    target: resolved.canonicalTarget,
    expectedSha256,
    currentSha256,
    decision: currentSha256 === expectedSha256 ? 'PROVEN_APPLIED' : 'CONFLICT'
  });
}


function verifyAppliedMutation({
  workspace,
  target,
  expectedSha256,
  evidence: priorEvidence = null
}) {
  const providerEvidence =
    priorEvidence &&
    priorEvidence.mutationProvider
      ? priorEvidence.mutationProvider
      : null;

  if (contentAddressedDurability(providerEvidence)) {
    const persistedBinding =
      verifyPersistedWorkspaceCasBinding({
        priorEvidence,
        providerEvidence,
        workspace,
        target,
        expectedSha256
      });

    const verification =
      verifyContentAddressedProjection(
        providerEvidence,
        expectedSha256
      );

    return deepFreeze({
      schema: 'sdo.filesystem_patch_replay_verification.v1',
      workspace: canonicalizeAuthorizedRoot(workspace),
      target: requireText(target, 'target'),
      expectedSha256,
      currentSha256: verification.observedSha256,
      authority: 'CONTENT_ADDRESSED_MANIFEST',
      manifestOid: verification.manifestOid,
      projection: verification.projection,
      workspaceCasBinding:
        persistedBinding,
      ordinaryWorktreeAuthoritative: false,
      decision: 'PROVEN_APPLIED'
    });
  }

  return verifyAppliedFile({
    workspace,
    target,
    expectedSha256
  });
}

function inspectMutationTarget({ transaction }) {
  if (!transaction || !Object.isFrozen(transaction) ||
      !/^[a-f0-9]{64}$/.test(transaction.transactionId || '')) {
    throw new Error('Immutable mutation transaction is required for physical recovery inspection.');
  }
  try {
    const relativeTarget = path.relative(transaction.workspace, transaction.target);
    const resolved = resolveInspectedFile(transaction.workspace, relativeTarget);
    const current = readRegularNoFollow(resolved.canonicalTarget);
    const sha256 = hash(current.content);
    return deepFreeze({ schema: 'sdo.mutation_recovery_physical_observation.v1',
      transactionId: transaction.transactionId, workspace: transaction.workspace,
      target: transaction.target, sha256,
      classification: sha256 === transaction.beforeSha256 ? 'BEFORE'
        : sha256 === transaction.replacementSha256 ? 'REPLACEMENT' : 'OTHER' });
  } catch (error) {
    return deepFreeze({ schema: 'sdo.mutation_recovery_physical_observation.v1',
      transactionId: transaction.transactionId, workspace: transaction.workspace,
      target: transaction.target, sha256: null, classification: 'UNAVAILABLE',
      reason: error.message });
  }
}

module.exports = {
  patchFileWithGrant,
  verifyAppliedFile,
  verifyAppliedMutation,
  inspectMutationTarget
};
