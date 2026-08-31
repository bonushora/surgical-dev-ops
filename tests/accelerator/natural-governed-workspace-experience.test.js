'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const {
  openNaturalGovernedWorkspaceExperience,
  searchNaturalGovernedWorkspace,
  planNaturalGovernedWorkspaceMicroread,
  projectNaturalWorkspaceMutationReview,
  qualifyNaturalWorkspaceFileEvidenceForCognition
} = require('../../accelerator/cli/natural-governed-workspace-experience');
const { createNaturalTaskEnvelopeProposal, authorizeNaturalTaskEnvelope } = require('../../accelerator/cli/natural-task-envelope-authorization');

const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }

function fixtures() {
  const session = freeze({ schema: 'sdo.deterministic_workspace_session.v1', physical: { root: '/project' }, physicalWorkspaceIdentity: sha('workspace'), repositoryHead: sha('head'), worktreeFingerprint: sha('tree'), sessionFingerprint: sha('session'), operationalAuthority: false, mutationAuthority: false });
  const revalidation = freeze({ schema: 'sdo.deterministic_workspace_session_revalidation.v1', decision: 'VALID', sessionFingerprint: session.sessionFingerprint, operationalAuthority: false, mutationAuthority: false });
  const governedInventory = freeze({ orchestration: { status: 'COMPLETED' }, execution: { schema: 'sdo.git_read_result.v1', selector: 'WORKSPACE_FILES', result: { files: ['README.md', 'src/app.js', '.git/config'] } } });
  return { session, revalidation, governedInventory };
}

function experience() {
  return openNaturalGovernedWorkspaceExperience({ ...fixtures(), observedAt: '2026-08-30T12:00:00.000Z' });
}

test('NATURAL experience opens only from fresh session and governed inventory evidence', () => {
  const result = experience();
  assert.deepEqual(result.discoveryIndex.files, ['README.md', 'src/app.js']);
  assert.equal(result.providerDirectFilesystem, false);
  assert.equal(result.providerDirectShell, false);
  assert.equal(result.readImpliesMutation, false);
  assert.equal(result.audit.events.length, 2);
  assert.ok(Object.isFrozen(result));
});

test('stale session and forged inventory fail closed before experience activation', () => {
  const base = fixtures();
  assert.throws(() => openNaturalGovernedWorkspaceExperience({ ...base, revalidation: freeze({ ...base.revalidation, decision: 'INVALIDATED' }), observedAt: '2026-08-30T12:00:00.000Z' }), /fresh valid/i);
  assert.throws(() => openNaturalGovernedWorkspaceExperience({ ...base, governedInventory: freeze({ orchestration: { status: 'COMPLETED' }, execution: { selector: 'WORKSPACE_FILES', result: { files: [] } } }), observedAt: '2026-08-30T12:00:00.000Z' }), /canonical governed/i);
});

test('experience search remains commit and physical-state bound', () => {
  const result = searchNaturalGovernedWorkspace(experience(), { query: 'src', limit: 10 });
  assert.equal(result.status, 'COMPLETED');
  assert.deepEqual(result.results, ['src/app.js']);
});

test('one exact human task authorization contains repeated microreads without dispatch authority', () => {
  const current = experience();
  const proposal = createNaturalTaskEnvelopeProposal({ task: freeze({ schema: 'sdo.natural_governed_task.v1', kind: 'PROJECT_ANALYSIS', objective: 'Analyze project.', mutating: false, operations: [] }), workspaceRoot: '/project', physicalWorkspaceIdentity: current.binding.physicalWorkspaceIdentity, riskCeiling: 'R1', validFrom: '2026-08-30T12:00:00.000Z', expiresAt: '2026-08-30T12:10:00.000Z' });
  const authorization = authorizeNaturalTaskEnvelope(proposal, freeze({ approved: true, proposalFingerprint: proposal.proposalFingerprint, humanSubject: 'human:test', authorizedAt: '2026-08-30T12:00:00.000Z' }));
  for (let step = 1; step <= 2; step += 1) {
    const plan = planNaturalGovernedWorkspaceMicroread(current, authorization, freeze({ evidenceRequest: { kind: 'READ_FILE', target: step === 1 ? 'README.md' : 'src/app.js', reason: 'Analyze.' }, evidenceStep: step, risk: 'R1', mutating: false }), { now: '2026-08-30T12:01:00.000Z' });
    assert.equal(plan.decision, 'CONTAINED');
    assert.equal(plan.dispatchAuthority, false);
    assert.equal(plan.requiresNewHumanAuthority, false);
  }
});

test('microreads outside the governed discovery index stop before dispatch', () => {
  const current = experience();
  const proposal = createNaturalTaskEnvelopeProposal({ task: freeze({ schema: 'sdo.natural_governed_task.v1', kind: 'PROJECT_ANALYSIS', objective: 'Analyze project.', mutating: false, operations: [] }), workspaceRoot: '/project', physicalWorkspaceIdentity: current.binding.physicalWorkspaceIdentity, riskCeiling: 'R1', validFrom: '2026-08-30T12:00:00.000Z', expiresAt: '2026-08-30T12:10:00.000Z' });
  const authorization = authorizeNaturalTaskEnvelope(proposal, freeze({ approved: true, proposalFingerprint: proposal.proposalFingerprint, humanSubject: 'human:test', authorizedAt: '2026-08-30T12:00:00.000Z' }));
  const plan = planNaturalGovernedWorkspaceMicroread(current, authorization, freeze({ evidenceRequest: { kind: 'READ_FILE', target: 'secrets/runtime.js', reason: 'Analyze.' }, evidenceStep: 1, risk: 'R1', mutating: false }), { now: '2026-08-30T12:01:00.000Z' });
  assert.equal(plan.decision, 'STOPPED');
  assert.equal(plan.governedIntent, null);
  assert.equal(plan.requiresNewHumanAuthority, true);
  assert.equal(plan.requiresFreshDiscovery, true);
});

test('validation microreads remain bound to the qualified command catalog', () => {
  const current = experience();
  const proposal = createNaturalTaskEnvelopeProposal({ task: freeze({ schema: 'sdo.natural_governed_task.v1', kind: 'PROJECT_ANALYSIS', objective: 'Analyze project.', mutating: false, operations: [] }), workspaceRoot: '/project', physicalWorkspaceIdentity: current.binding.physicalWorkspaceIdentity, riskCeiling: 'R1', validFrom: '2026-08-30T12:00:00.000Z', expiresAt: '2026-08-30T12:10:00.000Z' });
  const authorization = authorizeNaturalTaskEnvelope(proposal, freeze({ approved: true, proposalFingerprint: proposal.proposalFingerprint, humanSubject: 'human:test', authorizedAt: '2026-08-30T12:00:00.000Z' }));
  const plan = planNaturalGovernedWorkspaceMicroread(current, authorization, freeze({ evidenceRequest: { kind: 'VALIDATE_JS', target: 'src/app.js', reason: 'Validate.' }, evidenceStep: 1, risk: 'R1', mutating: false }), { now: '2026-08-30T12:01:00.000Z' });
  assert.equal(plan.decision, 'CONTAINED');
  assert.equal(plan.qualifiedCommandSelector, 'NODE_SYNTAX_CHECK');
  assert.equal(plan.dispatchAuthority, false);
});

test('read-to-write shell network credentials and risk expansion require new authority', () => {
  const current = experience();
  const proposal = createNaturalTaskEnvelopeProposal({ task: freeze({ schema: 'sdo.natural_governed_task.v1', kind: 'PROJECT_ANALYSIS', objective: 'Analyze project.', mutating: false, operations: [] }), workspaceRoot: '/project', physicalWorkspaceIdentity: current.binding.physicalWorkspaceIdentity, riskCeiling: 'R1', validFrom: '2026-08-30T12:00:00.000Z', expiresAt: '2026-08-30T12:10:00.000Z' });
  const authorization = authorizeNaturalTaskEnvelope(proposal, freeze({ approved: true, proposalFingerprint: proposal.proposalFingerprint, humanSubject: 'human:test', authorizedAt: '2026-08-30T12:00:00.000Z' }));
  const base = { evidenceRequest: { kind: 'READ_FILE', target: 'README.md', reason: 'Analyze.' }, evidenceStep: 1, risk: 'R1', mutating: false };
  for (const expansion of [{ mutating: true }, { credentialUse: true }, { externalSideEffect: true }, { risk: 'R3' }]) {
    const plan = planNaturalGovernedWorkspaceMicroread(current, authorization, freeze({ ...base, ...expansion }), { now: '2026-08-30T12:01:00.000Z' });
    assert.equal(plan.decision, 'STOPPED');
    assert.equal(plan.requiresNewHumanAuthority, true);
  }
});

test('provider file evidence is redacted through the governed sensitive boundary', () => {
  const qualified = qualifyNaturalWorkspaceFileEvidenceForCognition(
    experience(),
    freeze({
      target: 'src/app.js',
      bytes: 54,
      sha256: sha('client_secret=must-never-reach-provider-123456789\n'),
      content: 'client_secret=must-never-reach-provider-123456789\n'
    })
  );
  assert.equal(qualified.providerSafe, true);
  assert.equal(qualified.sensitiveDecision, 'REDACTED');
  assert.doesNotMatch(qualified.content, /must-never-reach-provider/);
  assert.match(qualified.content, /REDACTED_BY_SURGICAL_DEVOPS/);
  assert.equal(qualified.operationalAuthority, false);
});

test('blocked provider file evidence never returns content for cognition', () => {
  assert.throws(
    () => qualifyNaturalWorkspaceFileEvidenceForCognition(
      experience(),
      freeze({
        target: 'src/app.js',
        bytes: 36,
        sha256: sha('-----BEGIN PRIVATE KEY-----\nsecret\n'),
        content: '-----BEGIN PRIVATE KEY-----\nsecret\n'
      })
    ),
    /blocked by sensitive-content policy/i
  );
});

test('mutation review is comprehensible data and never reusable authority', () => {
  const proposal = freeze({ schema: 'sdo.natural_development_patch_proposal.v1', state: 'HUMAN_REVIEW_REQUIRED', objective: 'Update exact file.', target: 'src/app.js', beforeSha256: sha('before'), replacementSha256: sha('after'), exactDiff: { diffFingerprint: sha('diff') }, operationalAuthority: false, mutationAuthority: false });
  const review = projectNaturalWorkspaceMutationReview(experience(), proposal);
  assert.deepEqual(review.affectedPaths, ['src/app.js']);
  assert.deepEqual(review.validationSelectors, ['NODE_SYNTAX_CHECK']);
  assert.equal(review.requiresExactHumanAuthorization, true);
  assert.equal(review.authorizationSingleUse, true);
  assert.equal(review.conditionalCASRequired, true);
  assert.equal(review.dispatchAuthority, false);
});

test('experience composition has no direct filesystem process or network dependency', () => {
  const source = require('node:fs').readFileSync(require.resolve('../../accelerator/cli/natural-governed-workspace-experience'), 'utf8');
  assert.doesNotMatch(source, /child_process|node:http|node:https|fetch\(|require\(['"]node:fs/);
});
