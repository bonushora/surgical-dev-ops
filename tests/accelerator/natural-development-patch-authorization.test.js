'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

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
  createAuthoritativeClock
} = require('../../accelerator/core/authoritative-clock');

const workspace = fs.mkdtempSync(
  path.join(os.tmpdir(), 'sdo-natural-g4-')
);

test.after(() => {
  fs.rmSync(workspace, { recursive: true, force: true });
});

const sha = (value) => crypto
  .createHash('sha256')
  .update(value)
  .digest('hex');

const objective = 'Change one exact governed JavaScript target.';
const target = 'accelerator/example.js';
const before = "'use strict';\nmodule.exports = 1;\n";
const after = "'use strict';\nmodule.exports = 2;\n";

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function patchProposal() {
  const contract = createNaturalDevelopmentTaskContract({
    objective,
    physicalWorkspaceIdentity: sha(workspace),
    repositoryHead: '114bee4e3c4117b4f76cfde7eede4c1746c6765d',
    allowedTargets: [target]
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
    response: 'One exact change is ready for review.',
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

  return materializeNaturalDevelopmentPatchProposal({
    contract,
    planningResult,
    governedProposal
  });
}

function assertion(proposal, overrides = {}) {
  return {
    schema: 'sdo.verified_human_identity_assertion.v1',
    verification: 'VERIFIED',
    assertionId: 'g4-human-assertion-1',
    subject: { id: 'human-1', type: 'HUMAN' },
    issuer: 'local-qualified-human-verifier',
    authentication: { method: 'PUBLIC_KEY', context: 'LOCAL_OFFLINE' },
    issuedAt: '2026-08-28T03:59:00.000Z',
    expiresAt: '2026-08-28T04:10:00.000Z',
    audience: [AUTHORIZATION_AUDIENCE],
    operationId:
      `natural-development-patch:${proposal.proposalFingerprint}`,
    workspace,
    tenantId: null,
    projectId: 'surgical-dev-ops',
    revocationStatus: 'NOT_REVOKED',
    verifiedAt: '2026-08-28T04:00:00.000Z',
    ...overrides
  };
}

function decision(proposal, overrides = {}) {
  return deepFreeze({
    schema: HUMAN_DECISION_SCHEMA,
    decision: 'APPROVE_EXACT_PATCH',
    approved: true,
    proposalFingerprint: proposal.proposalFingerprint,
    diffFingerprint: proposal.exactDiff.diffFingerprint,
    target: proposal.target,
    beforeSha256: proposal.beforeSha256,
    afterSha256: proposal.replacementSha256,
    humanSubject: 'human-1',
    authorizedAt: '2026-08-28T04:00:00.000Z',
    expiresAt: '2026-08-28T04:10:00.000Z',
    ...overrides
  });
}

function temporal(wallTime = '2026-08-28T04:01:00.000Z') {
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

function authorize(proposal = patchProposal(), overrides = {}) {
  return materializeNaturalDevelopmentPatchAuthorization({
    patchProposal: proposal,
    humanDecision: decision(proposal),
    verifiedHumanIdentityAssertion: assertion(proposal),
    temporalAuthority: temporal(),
    ...overrides
  });
}

test('G4 binds exact G1 G2 G3 content to verified human identity', () => {
  const proposal = patchProposal();
  const result = authorize(proposal);

  assert.equal(result.contractFingerprint, proposal.contractFingerprint);
  assert.equal(result.planningFingerprint, proposal.planningFingerprint);
  assert.equal(result.proposalFingerprint, proposal.proposalFingerprint);
  assert.equal(result.diffFingerprint, proposal.exactDiff.diffFingerprint);
  assert.equal(result.beforeSha256, proposal.beforeSha256);
  assert.equal(result.afterSha256, proposal.replacementSha256);
  assert.equal(result.humanSubject, 'human-1');
  assert.match(result.humanIdentityFingerprint, /^[a-f0-9]{64}$/);
  assert.match(result.authorizationFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(result), true);
});

test('G4 authorization is short-lived single-use R3 evidence with zero execution authority', () => {
  const result = authorize();

  assert.equal(result.state, 'AUTHORIZED_FOR_R3_COMPOSITION');
  assert.equal(result.singleUse, true);
  assert.equal(result.reusableApproval, false);
  assert.equal(result.consumed, false);
  assert.equal(result.requiresR3Composition, true);

  for (const field of [
    'operationalAuthority',
    'mutationAuthority',
    'approvalAuthority',
    'dispatchAuthority'
  ]) assert.equal(result[field], false);
});

test('blanket mutable or implicit approval fails closed', () => {
  const proposal = patchProposal();

  for (const humanDecision of [
    Object.freeze({ approved: true }),
    { ...decision(proposal) },
    decision(proposal, { decision: 'APPROVE_FUTURE_CHANGES' }),
    decision(proposal, { approved: false })
  ]) {
    assert.throws(
      () => authorize(proposal, { humanDecision }),
      /Exact immutable human patch decision/i
    );
  }
});

test('content target and proposal substitution fail closed', () => {
  const proposal = patchProposal();

  for (const humanDecision of [
    decision(proposal, { proposalFingerprint: '0'.repeat(64) }),
    decision(proposal, { diffFingerprint: '1'.repeat(64) }),
    decision(proposal, { target: 'accelerator/other.js' }),
    decision(proposal, { beforeSha256: '2'.repeat(64) }),
    decision(proposal, { afterSha256: '3'.repeat(64) })
  ]) {
    assert.throws(
      () => authorize(proposal, { humanDecision }),
      /Exact immutable human patch decision/i
    );
  }
});

test('identity subject audience operation and expiry substitution fail closed', () => {
  const proposal = patchProposal();

  for (const verifiedHumanIdentityAssertion of [
    assertion(proposal, { subject: { id: 'other', type: 'HUMAN' } }),
    assertion(proposal, { audience: ['other'] }),
    assertion(proposal, { operationId: 'future-or-blanket-operation' })
  ]) {
    assert.throws(
      () => authorize(proposal, { verifiedHumanIdentityAssertion }),
      /Verified human identity is required/i
    );
  }

  assert.throws(
    () => authorize(proposal, {
      temporalAuthority: temporal('2026-08-28T04:10:00.000Z')
    }),
    /Verified human identity is required/i
  );
});

test('authorization interval must be identity-contained and at most ten minutes', () => {
  const proposal = patchProposal();

  assert.throws(
    () => authorize(proposal, {
      humanDecision: decision(proposal, {
        expiresAt: '2026-08-28T04:10:00.001Z'
      })
    }),
    /10 minutes/i
  );

  assert.throws(
    () => authorize(proposal, {
      humanDecision: decision(proposal, {
        authorizedAt: '2026-08-28T04:00:01.000Z',
        expiresAt: '2026-08-28T04:09:00.000Z'
      })
    }),
    /contained by verified human identity/i
  );
});

test('G4 exports no execution mutation dispatch grant or consumption surface', () => {
  const api = require(
    '../../accelerator/cli/natural-development-patch-authorization'
  );

  assert.deepEqual(
    Object.keys(api).filter((key) => typeof api[key] === 'function'),
    ['materializeNaturalDevelopmentPatchAuthorization']
  );

  for (const forbidden of [
    'execute', 'mutate', 'dispatch', 'grant', 'consume', 'filesystem', 'shell'
  ]) {
    assert.equal(
      Object.keys(api).some((key) => key.toLowerCase().includes(forbidden)),
      false
    );
  }
});

test('ADR-028 preserves equivalent English and Portuguese G4 claims', () => {
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
      'G1–G4',
      'sdo.natural_development_patch_authorization.v1',
      'APPROVE_EXACT_PATCH',
      'surgical-devops:natural-development-r3',
      'AUTHORIZED_FOR_R3_COMPOSITION'
    ]) assert.match(source, new RegExp(marker));
  }

  assert.match(english, /at most ten minutes/i);
  assert.match(portuguese, /no máximo dez\s+minutos/i);
});
