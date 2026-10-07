'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { execFileSync, spawnSync } = require('node:child_process');

const {
  provisionLocalOfflineHumanAuthority
} = require(
  '../../accelerator/core/local-offline-human-authority-store'
);
const {
  createAuthoritativeClock
} = require('../../accelerator/core/authoritative-clock');
const {
  createNaturalDevelopmentTaskContract
} = require(
  '../../accelerator/cli/natural-development-task-contract'
);
const {
  materializeGovernedEngineeringProposal
} = require(
  '../../accelerator/core/governed-engineering-proposal'
);
const {
  materializeNaturalDevelopmentPatchProposal
} = require(
  '../../accelerator/cli/natural-development-patch-proposal'
);
const {
  AUTHORIZATION_AUDIENCE,
  HUMAN_DECISION_SCHEMA,
  materializeNaturalDevelopmentPatchAuthorization
} = require(
  '../../accelerator/cli/natural-development-patch-authorization'
);
const {
  observeCurrentAuthoritativeTarget
} = require(
  '../../accelerator/core/authoritative-target-observation'
);
const {
  observePhysicalWorkspaceIdentity
} = require('../../accelerator/core/workspace-boundary');
const authorizationStore = require(
  '../../accelerator/adapters/natural-development-authorization-consumption-store'
);
const {
  reconcileNaturalDevelopmentRecovery
} = require(
  '../../accelerator/cli/natural-development-recovery-reconciliation'
);

const CHILD = path.join(
  __dirname,
  'fixtures/natural-development-g9-g10-crash-child.js'
);
const TARGET = 'target.js';
const BEFORE = 'const value = 1;\n';
const AFTER = 'const value = 2;\n';

const sha = (value) => crypto
  .createHash('sha256')
  .update(value)
  .digest('hex');

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function git(repository, args) {
  return execFileSync('git', args, {
    cwd: repository,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function temporal(wallTime) {
  const clock = createAuthoritativeClock({
    port: {
      read: () => ({
        schema: 'sdo.system_clock_observation.v1',
        availability: 'AVAILABLE',
        source: 'TEST',
        wallTime,
        monotonicNanoseconds: '1000000000'
      })
    }
  });
  return { reading: clock.read(), requireCurrent: true };
}

function fixture(t) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdo-g9-g10-crash-window-')
  );
  const repository = path.join(root, 'repo');
  const authorityRoot = path.join(root, 'authority');
  const journalStorageRoot = path.join(root, 'journal');

  fs.mkdirSync(repository);
  fs.mkdirSync(journalStorageRoot);
  git(repository, ['init', '-b', 'main']);
  git(repository, ['config', 'user.email', 'sdo@example.invalid']);
  git(repository, ['config', 'user.name', 'Surgical DevOps Test']);
  fs.writeFileSync(path.join(repository, TARGET), BEFORE);
  git(repository, ['add', TARGET]);
  git(repository, ['commit', '-m', 'fixture']);

  provisionLocalOfflineHumanAuthority({
    authorityRoot,
    issuer: 'local:test-human',
    subjectId: 'human-test'
  });

  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  return {
    root,
    repository: fs.realpathSync(repository),
    authorityRoot: fs.realpathSync(authorityRoot),
    journalStorageRoot: fs.realpathSync(journalStorageRoot)
  };
}

function compositionInput(state) {
  const authorizedAt = new Date().toISOString();
  const expiresAt = new Date(
    Date.parse(authorizedAt) + 5 * 60_000
  ).toISOString();
  const physicalWorkspaceIdentity =
    observePhysicalWorkspaceIdentity(state.repository)
      .physicalWorkspaceIdentity;
  const contract = createNaturalDevelopmentTaskContract({
    objective: 'Qualify the G9/G10 crash window.',
    physicalWorkspaceIdentity,
    repositoryHead: git(state.repository, ['rev-parse', 'HEAD']),
    allowedTargets: [TARGET],
    patchAttemptCeiling: 1
  });
  const planningBinding = deepFreeze({
    schema: 'sdo.natural_development_planning_loop.v1',
    status: 'COMPLETED',
    contractFingerprint: contract.contractFingerprint,
    analysis: { status: 'COMPLETED' },
    evidence: [{
      schema: 'sdo.natural_recursive_evidence.v1',
      kind: 'READ_FILE',
      target: TARGET,
      sha256: sha(BEFORE),
      bytes: Buffer.byteLength(BEFORE),
      summary: BEFORE
    }],
    response: 'One exact crash-window patch is ready.',
    reason: null,
    pendingRequest: null,
    requiresNewHumanAuthority: false,
    reusableApproval: false,
    operationalAuthority: false,
    mutationAuthority: false,
    approvalAuthority: false,
    dispatchAuthority: false
  });
  const planningResult = deepFreeze({
    ...planningBinding,
    planningFingerprint: sha(JSON.stringify(planningBinding))
  });
  const governedProposal = materializeGovernedEngineeringProposal({
    schema: 'sdo.ai_engineering_patch_proposal.v1',
    objective: contract.objective,
    target: TARGET,
    beforeSha256: sha(BEFORE),
    replacementBase64: Buffer.from(AFTER).toString('base64'),
    reason: 'Apply the exact reviewed crash-window correction.',
    validationKind: 'VALIDATE_JS'
  });
  const patchProposal = materializeNaturalDevelopmentPatchProposal({
    contract,
    planningResult,
    governedProposal,
    patchAttempt: 1
  });
  const humanDecision = deepFreeze({
    schema: HUMAN_DECISION_SCHEMA,
    decision: 'APPROVE_EXACT_PATCH',
    approved: true,
    proposalFingerprint: patchProposal.proposalFingerprint,
    diffFingerprint: patchProposal.exactDiff.diffFingerprint,
    target: TARGET,
    beforeSha256: patchProposal.beforeSha256,
    afterSha256: patchProposal.replacementSha256,
    humanSubject: 'human-test',
    authorizedAt,
    expiresAt
  });
  const identityAssertion = {
    schema: 'sdo.verified_human_identity_assertion.v1',
    verification: 'VERIFIED',
    assertionId: 'g9-g10-crash-window-assertion',
    subject: { id: 'human-test', type: 'HUMAN' },
    issuer: 'local:test-human',
    authentication: { method: 'PUBLIC_KEY', context: 'LOCAL_OFFLINE' },
    issuedAt: new Date(Date.parse(authorizedAt) - 60_000).toISOString(),
    expiresAt,
    audience: [AUTHORIZATION_AUDIENCE],
    operationId:
      `natural-development-patch:${patchProposal.proposalFingerprint}`,
    workspace: state.repository,
    tenantId: 'tenant-1',
    projectId: 'project-1',
    revocationStatus: 'NOT_REVOKED',
    verifiedAt: authorizedAt
  };
  const patchAuthorization =
    materializeNaturalDevelopmentPatchAuthorization({
      patchProposal,
      humanDecision,
      verifiedHumanIdentityAssertion: identityAssertion,
      temporalAuthority: temporal(
        new Date(Date.parse(authorizedAt) + 1).toISOString()
      )
    });

  return deepFreeze({
    contract,
    patchProposal,
    patchAuthorization,
    physicalWorkspaceIdentity,
    repositoryPath: state.repository,
    authorityRoot: state.authorityRoot,
    journalStorageRoot: state.journalStorageRoot,
    tenantId: 'tenant-1',
    projectId: 'project-1'
  });
}

function runChild(inputPath, mode, evidencePath) {
  return spawnSync(
    process.execPath,
    [CHILD, inputPath, mode, evidencePath],
    {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
}

function journalRecord(state, journalId) {
  const directory = path.join(state.journalStorageRoot, journalId);
  const records = fs.readdirSync(directory).sort();
  return JSON.parse(
    fs.readFileSync(path.join(directory, records.at(-1)), 'utf8')
  );
}

function effectFingerprint(input, operationId, evidence) {
  return sha(JSON.stringify({
    schema: 'sdo.natural_development_production_effect_binding.v1',
    authorizationFingerprint:
      input.patchAuthorization.authorizationFingerprint,
    authorityDerivation: 'DERIVED_FROM_G4',
    parentAuthorizationFingerprint:
      input.patchAuthorization.authorizationFingerprint,
    parentContractFingerprint:
      input.patchAuthorization.contractFingerprint,
    parentAuthorizationExpiresAt:
      input.patchAuthorization.expiresAt,
    r3ExpiresAt:
      input.patchAuthorization.expiresAt,
    operationId,
    physicalWorkspaceIdentity: input.physicalWorkspaceIdentity,
    target: input.patchProposal.target,
    beforeSha256: input.patchProposal.beforeSha256,
    replacementSha256: input.patchProposal.replacementSha256,
    transactionId: evidence.transactionId,
    journalId: evidence.journalId,
    manifestAfterOid: evidence.manifestAfterOid
  }));
}

test('G9/G10 crash window blocks replay and reconciles only durable evidence', (t) => {
  const state = fixture(t);
  const input = compositionInput(state);
  const inputPath = path.join(state.root, 'composition-input.json');
  const crashEvidencePath = path.join(state.root, 'crash-evidence.json');
  const replayEvidencePath = path.join(state.root, 'replay-evidence.json');
  fs.writeFileSync(inputPath, JSON.stringify(input) + '\n');

  const crash = runChild(
    inputPath,
    'CRASH_AFTER_CAS_BEFORE_G10',
    crashEvidencePath
  );
  assert.equal(crash.status, 86, crash.stderr);
  const crashEvidence = deepFreeze(
    JSON.parse(fs.readFileSync(crashEvidencePath, 'utf8'))
  );
  assert.equal(
    crashEvidence.interruption,
    'AFTER_SUCCESSFUL_CAS_BEFORE_G10'
  );

  const consumptionRoot = path.join(
    state.journalStorageRoot,
    '.natural-development-authorization-consumption'
  );
  const authorizationState =
    authorizationStore.loadNaturalDevelopmentAuthorizationConsumption({
      stateRoot: consumptionRoot,
      authorizationFingerprint:
        input.patchAuthorization.authorizationFingerprint
    });
  assert.equal(authorizationState.state, 'CLAIMED');
  assert.equal(
    authorizationState.schema,
    'sdo.natural_development_authorization_claim.v1'
  );
  assert.equal(authorizationState.operationalAuthority, false);
  assert.equal(authorizationState.mutationAuthority, false);
  assert.equal(authorizationState.dispatchAuthority, false);

  const terminalJournal = journalRecord(state, crashEvidence.journalId);
  assert.equal(terminalJournal.stage, 'FINALIZED_SUCCESS');
  assert.equal(terminalJournal.transactionId, crashEvidence.transactionId);
  const observed = observeCurrentAuthoritativeTarget({
    workspace: state.repository,
    target: TARGET
  });
  assert.equal(observed.source, 'MANIFEST_CAS');
  assert.equal(observed.manifestOid, crashEvidence.manifestAfterOid);
  assert.equal(observed.currentSha256, sha(AFTER));
  assert.equal(fs.readFileSync(observed.managedProjection, 'utf8'), AFTER);
  assert.equal(fs.readFileSync(path.join(state.repository, TARGET), 'utf8'), BEFORE);

  const derivedEffect = effectFingerprint(
    input,
    terminalJournal.operationId,
    crashEvidence
  );
  assert.equal(derivedEffect, crashEvidence.effectFingerprint);

  const journalSnapshot = fs.readdirSync(state.journalStorageRoot).sort();
  const projectionStat = fs.statSync(observed.managedProjection, { bigint: true });
  const replay = runChild(
    inputPath,
    'RESTART_REPLAY_PROBE',
    replayEvidencePath
  );
  assert.equal(replay.status, 0, replay.stderr);
  const replayEvidence = JSON.parse(
    fs.readFileSync(replayEvidencePath, 'utf8')
  );
  assert.equal(replayEvidence.r3PreparationCount, 0);
  assert.match(replayEvidence.error, /durable.*claim|replay denied/i);
  assert.deepEqual(
    fs.readdirSync(state.journalStorageRoot).sort(),
    journalSnapshot
  );
  assert.equal(
    fs.statSync(observed.managedProjection, { bigint: true }).mtimeNs,
    projectionStat.mtimeNs
  );
  assert.equal(
    observeCurrentAuthoritativeTarget({
      workspace: state.repository,
      target: TARGET
    }).manifestOid,
    crashEvidence.manifestAfterOid
  );

  const recoveryInput = {
    authorizationState,
    operationId: authorizationState.operationId,
    physicalWorkspaceIdentity: input.physicalWorkspaceIdentity,
    target: TARGET,
    beforeSha256: sha(BEFORE),
    replacementSha256: sha(AFTER),
    journalEvidence: deepFreeze({
      transactionId: crashEvidence.transactionId,
      journalId: crashEvidence.journalId,
      terminal: true,
      finalized: true,
      applied: true,
      effectFingerprint: derivedEffect
    }),
    manifestEvidence: deepFreeze({
      authoritative: true,
      afterOid: crashEvidence.manifestAfterOid,
      effectFingerprint: derivedEffect
    }),
    physicalEvidence: deepFreeze({
      state: 'AFTER',
      observedSha256: observed.currentSha256
    })
  };
  const recovered = reconcileNaturalDevelopmentRecovery(recoveryInput);
  const recoveredAgain = reconcileNaturalDevelopmentRecovery(recoveryInput);
  assert.equal(recovered.state, 'COMPLETED');
  assert.equal(recovered.sourceAuthorizationState, 'CLAIMED');
  assert.equal(recovered.remutationPermitted, false);
  assert.equal(recovered.authorizationReusable, false);
  assert.equal(recovered.dispatchAuthority, false);
  assert.equal(recovered.mutationAuthority, false);
  assert.equal(recovered.operationalAuthority, false);
  assert.deepEqual(recoveredAgain, recovered);

  const conflicting = reconcileNaturalDevelopmentRecovery({
    ...recoveryInput,
    manifestEvidence: deepFreeze({
      authoritative: true,
      afterOid: crashEvidence.manifestAfterOid,
      effectFingerprint: sha('conflicting-effect')
    })
  });
  assert.equal(conflicting.state, 'RECOVERY_UNRESOLVED');
  assert.equal(conflicting.remutationPermitted, false);
  assert.equal(conflicting.dispatchAuthority, false);

  const incomplete = reconcileNaturalDevelopmentRecovery({
    ...recoveryInput,
    manifestEvidence: deepFreeze({
      authoritative: false,
      afterOid: null,
      effectFingerprint: null
    })
  });
  assert.equal(incomplete.state, 'RECOVERY_UNRESOLVED');
  assert.equal(incomplete.remutationPermitted, false);
  assert.equal(incomplete.authorizationReusable, false);

  for (const result of [recovered, conflicting, incomplete]) {
    for (const forbidden of [
      'shell', 'process', 'network', 'provider', 'command', 'executable'
    ]) {
      assert.equal(Object.prototype.hasOwnProperty.call(result, forbidden), false);
    }
  }
});
