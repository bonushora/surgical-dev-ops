'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');

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
  composeAndDispatchNaturalDevelopmentPatch
} = require(
  '../../accelerator/cli/natural-development-r3-composition'
);

const before = 'const value = 1;\n';
const after = 'const value = 2;\n';
const target = 'target.js';
const objective = 'Change one exact governed JavaScript target.';

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

function git(repo, args) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function fixture() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdo-natural-g5-')
  );
  const repo = path.join(root, 'repo');
  const authorityRoot = path.join(root, 'authority');
  const journalStorageRoot = path.join(root, 'journal');

  fs.mkdirSync(repo);
  fs.mkdirSync(journalStorageRoot);
  git(repo, ['init', '-b', 'main']);
  git(repo, ['config', 'user.email', 'sdo@example.invalid']);
  git(repo, ['config', 'user.name', 'Surgical DevOps Test']);
  fs.writeFileSync(path.join(repo, target), before);
  git(repo, ['add', target]);
  git(repo, ['commit', '-m', 'fixture']);

  provisionLocalOfflineHumanAuthority({
    authorityRoot,
    issuer: 'local:test-human',
    subjectId: 'human-test'
  });

  return {
    root,
    repo: fs.realpathSync(repo),
    authorityRoot: fs.realpathSync(authorityRoot),
    journalStorageRoot: fs.realpathSync(journalStorageRoot)
  };
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

function artifacts(state, {
  humanSubject = 'human-test',
  issuer = 'local:test-human',
  authorizedAt = new Date().toISOString(),
  expiresAt = null
} = {}) {
  const expiry = expiresAt || new Date(
    Date.parse(authorizedAt) + 5 * 60_000
  ).toISOString();
  const physicalWorkspaceIdentity = sha(state.repo);
  const contract = createNaturalDevelopmentTaskContract({
    objective,
    physicalWorkspaceIdentity,
    repositoryHead: git(state.repo, ['rev-parse', 'HEAD']),
    allowedTargets: [target],
    patchAttemptCeiling: 2
  });

  const planningBinding = deepFreeze({
    schema: 'sdo.natural_development_planning_loop.v1',
    status: 'COMPLETED',
    contractFingerprint: contract.contractFingerprint,
    analysis: { status: 'COMPLETED' },
    evidence: [{
      schema: 'sdo.natural_recursive_evidence.v1',
      kind: 'READ_FILE',
      target,
      sha256: sha(before),
      bytes: Buffer.byteLength(before),
      summary: before
    }],
    response: 'One exact patch is ready.',
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
    objective,
    target,
    beforeSha256: sha(before),
    replacementBase64: Buffer.from(after).toString('base64'),
    reason: 'Apply the exact reviewed correction.',
    validationKind: 'VALIDATE_JS'
  });

  const patchProposal = materializeNaturalDevelopmentPatchProposal({
    contract,
    planningResult,
    governedProposal
  });

  const humanDecision = deepFreeze({
    schema: HUMAN_DECISION_SCHEMA,
    decision: 'APPROVE_EXACT_PATCH',
    approved: true,
    proposalFingerprint: patchProposal.proposalFingerprint,
    diffFingerprint: patchProposal.exactDiff.diffFingerprint,
    target,
    beforeSha256: patchProposal.beforeSha256,
    afterSha256: patchProposal.replacementSha256,
    humanSubject,
    authorizedAt,
    expiresAt: expiry
  });

  const identityAssertion = {
    schema: 'sdo.verified_human_identity_assertion.v1',
    verification: 'VERIFIED',
    assertionId: `g5-${humanSubject}-assertion`,
    subject: { id: humanSubject, type: 'HUMAN' },
    issuer,
    authentication: { method: 'PUBLIC_KEY', context: 'LOCAL_OFFLINE' },
    issuedAt: new Date(Date.parse(authorizedAt) - 60_000).toISOString(),
    expiresAt: expiry,
    audience: [AUTHORIZATION_AUDIENCE],
    operationId:
      `natural-development-patch:${patchProposal.proposalFingerprint}`,
    workspace: state.repo,
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

  return {
    contract,
    patchProposal,
    patchAuthorization,
    physicalWorkspaceIdentity
  };
}

function dispatch(state, values) {
  return composeAndDispatchNaturalDevelopmentPatch({
    ...values,
    repositoryPath: state.repo,
    authorityRoot: state.authorityRoot,
    journalStorageRoot: state.journalStorageRoot,
    tenantId: 'tenant-1',
    projectId: 'project-1'
  });
}

test('G5 composes G1-G4 through existing R3 journal and Manifest CAS', () => {
  const state = fixture();

  try {
    const values = artifacts(state);
    const result = dispatch(state, values);

    assert.equal(result.status, 'COMPLETED');
    assert.equal(
      result.authorizationFingerprint,
      values.patchAuthorization.authorizationFingerprint
    );
    assert.match(result.transactionId, /^[a-f0-9]{64}$/);
    assert.match(result.journalId, /^[a-f0-9]{64}$/);
    assert.match(result.afterManifestOid, /^[a-f0-9]{40,64}$/);
    assert.equal(result.ordinaryWorktreeAuthoritative, false);
    assert.equal(result.authorizationUseRecorded, true);
    assert.equal(result.durableAntiReplayQualified, false);
    assert.equal(Object.isFrozen(result), true);

    assert.equal(
      fs.readFileSync(path.join(state.repo, target), 'utf8'),
      before
    );
    assert.equal(fs.readFileSync(result.managedProjection, 'utf8'), after);
  } finally {
    fs.rmSync(state.root, { recursive: true, force: true });
  }
});

test('G5 rejects stale HEAD before R3 dispatch', () => {
  const state = fixture();

  try {
    const values = artifacts(state);
    fs.writeFileSync(path.join(state.repo, 'other.txt'), 'new commit\n');
    git(state.repo, ['add', 'other.txt']);
    git(state.repo, ['commit', '-m', 'advance HEAD']);

    assert.throws(
      () => dispatch(state, values),
      /HEAD is stale/i
    );
    assert.deepEqual(fs.readdirSync(state.journalStorageRoot), []);
  } finally {
    fs.rmSync(state.root, { recursive: true, force: true });
  }
});

test('G5 rejects identity mismatch and expired G4 before orchestration', () => {
  const mismatch = fixture();

  try {
    const values = artifacts(mismatch, {
      humanSubject: 'other-human',
      issuer: 'other-issuer'
    });

    assert.throws(
      () => dispatch(mismatch, values),
      /G4 authorization denied R3 composition/i
    );
    assert.deepEqual(fs.readdirSync(mismatch.journalStorageRoot), []);
  } finally {
    fs.rmSync(mismatch.root, { recursive: true, force: true });
  }

  const expired = fixture();

  try {
    const authorizedAt = new Date(Date.now() - 20 * 60_000).toISOString();
    const values = artifacts(expired, {
      authorizedAt,
      expiresAt: new Date(
        Date.parse(authorizedAt) + 5 * 60_000
      ).toISOString()
    });

    assert.throws(
      () => dispatch(expired, values),
      /expired/i
    );
    assert.deepEqual(fs.readdirSync(expired.journalStorageRoot), []);
  } finally {
    fs.rmSync(expired.root, { recursive: true, force: true });
  }
});

test('G5 exposes one fixed composition function and no generic process surface', () => {
  const api = require(
    '../../accelerator/cli/natural-development-r3-composition'
  );

  assert.deepEqual(
    Object.keys(api).filter((key) => typeof api[key] === 'function'),
    ['composeAndDispatchNaturalDevelopmentPatch']
  );

  const source = fs.readFileSync(
    require.resolve(
      '../../accelerator/cli/natural-development-r3-composition'
    ),
    'utf8'
  );

  assert.doesNotMatch(source, /child_process|execFile|spawn|shell:/);
  assert.match(source, /createGovernedPatchRequest/);
  assert.match(source, /orchestrate/);
});

test('ADR-028 preserves equivalent English and Portuguese G5 claims', () => {
  const english = fs.readFileSync(
    path.join(
      __dirname,
      '../../docs/adr/ADR-028-natural-governed-development-execution-loop.md'
    ),
    'utf8'
  );
  const portuguese = fs.readFileSync(
    path.join(
      __dirname,
      '../../docs/adr/ADR-028-natural-governed-development-execution-loop_PT-BR.md'
    ),
    'utf8'
  );

  for (const source of [english, portuguese]) {
    for (const marker of [
      'G1–G5',
      'sdo.natural_development_r3_composition_result.v1',
      'createGovernedPatchRequest',
      'Manifest CAS',
      'G7'
    ]) assert.match(source, new RegExp(marker));
  }

  assert.match(english, /does not\s+claim durable cross-process anti-replay/i);
  assert.match(portuguese, /não alega\s+qualificação anti-replay durável/i);
});
