'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const test = require('node:test');
const {
  createNaturalTaskEnvelopeProposal,
  authorizeNaturalTaskEnvelope,
  evaluateNaturalTaskEnvelopeOperation
} = require('../../accelerator/cli/natural-task-envelope-authorization');
const { parseNaturalEvidenceDecision } = require('../../accelerator/cli/natural-evidence-request');

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const workspace = path.resolve('/tmp/sdo-task-envelope');
const identity = hash('physical-workspace');

function task() {
  return Object.freeze({
    schema: 'sdo.natural_governed_task.v1', kind: 'PROJECT_ANALYSIS',
    objective: 'Explain this project.', mutating: false, operations: []
  });
}

function evidence(kind = 'READ_FILE', target = 'README.md') {
  return parseNaturalEvidenceDecision({
    schema: 'sdo.ai_cognitive_result.v1', status: 'COMPLETED',
    output: { decision: 'REQUEST_EVIDENCE', response: null,
      evidenceRequest: { kind, target: kind === 'WORKSPACE_FILES' ? null : target, reason: 'Bounded project evidence.' } }
  }).evidenceRequest;
}

function authorized() {
  const proposal = createNaturalTaskEnvelopeProposal({
    task: task(), workspaceRoot: workspace, physicalWorkspaceIdentity: identity,
    riskCeiling: 'R0', validFrom: '2026-08-26T00:00:00.000Z', expiresAt: '2026-08-26T00:30:00.000Z'
  });
  return authorizeNaturalTaskEnvelope(proposal, Object.freeze({
    approved: true, proposalFingerprint: proposal.proposalFingerprint,
    humanSubject: 'local-human', authorizedAt: '2026-08-26T00:00:01.000Z'
  }));
}

function operation(overrides = {}) {
  return Object.freeze({
    physicalWorkspaceIdentity: identity, evidenceRequest: evidence(),
    evidenceStep: 1, risk: 'R0', mutating: false, credentialUse: false,
    externalSideEffect: false, architecturalDecision: false, ...overrides
  });
}

test('one exact human authorization contains repeated bounded microreads', () => {
  const envelope = authorized();
  for (const target of ['README.md', 'package.json', 'accelerator/cli/surgical.js']) {
    const result = evaluateNaturalTaskEnvelopeOperation(
      envelope, operation({ evidenceRequest: evidence('READ_FILE', target) }),
      { now: '2026-08-26T00:01:00.000Z' }
    );
    assert.equal(result.decision, 'CONTAINED');
    assert.equal(result.requiresNewHumanAuthority, false);
    assert.equal(result.operationalAuthority, false);
  }
});

test('proposal fingerprint substitution and implicit approval fail closed', () => {
  const proposal = createNaturalTaskEnvelopeProposal({
    task: task(), workspaceRoot: workspace, physicalWorkspaceIdentity: identity,
    validFrom: '2026-08-26T00:00:00.000Z', expiresAt: '2026-08-26T00:30:00.000Z'
  });
  assert.throws(() => authorizeNaturalTaskEnvelope(proposal, Object.freeze({
    approved: true, proposalFingerprint: hash('other'), humanSubject: 'human', authorizedAt: '2026-08-26T00:00:01.000Z'
  })), /exact explicit human/i);
  assert.throws(() => authorizeNaturalTaskEnvelope(proposal, Object.freeze({
    approved: false, proposalFingerprint: proposal.proposalFingerprint, humanSubject: 'human', authorizedAt: '2026-08-26T00:00:01.000Z'
  })), /exact explicit human/i);
});

test('workspace capability risk mutation credential external and architecture expansion stop', () => {
  const envelope = authorized();
  const expansions = [
    { physicalWorkspaceIdentity: hash('other-workspace') },
    { evidenceRequest: evidence('VALIDATE_JS', 'file.js'), risk: 'R1' },
    { mutating: true },
    { credentialUse: true },
    { externalSideEffect: true },
    { architecturalDecision: true }
  ];
  for (const expansion of expansions) {
    const result = evaluateNaturalTaskEnvelopeOperation(
      envelope, operation(expansion), { now: '2026-08-26T00:01:00.000Z' }
    );
    assert.equal(result.decision, 'STOPPED');
    assert.equal(result.requiresNewHumanAuthority, true);
    assert.equal(result.governedIntent, null);
  }
});

test('expired envelope and evidence-step overflow cannot be resumed', () => {
  const envelope = authorized();
  assert.equal(evaluateNaturalTaskEnvelopeOperation(
    envelope, operation(), { now: '2026-08-26T00:30:00.000Z' }
  ).decision, 'STOPPED');
  assert.equal(evaluateNaturalTaskEnvelopeOperation(
    envelope, operation({ evidenceStep: 8 }), { now: '2026-08-26T00:01:00.000Z' }
  ).decision, 'STOPPED');
});

test('task envelope is immutable and never becomes a grant or dispatch surface', () => {
  const envelope = authorized();
  assert.equal(Object.isFrozen(envelope), true);
  assert.equal(envelope.reusableApproval, false);
  assert.equal(envelope.operationalAuthority, false);
  assert.equal(envelope.mutationAuthority, false);
  const api = require('../../accelerator/cli/natural-task-envelope-authorization');
  assert.deepEqual(Object.keys(api).filter((key) => typeof api[key] === 'function').sort(), [
    'authorizeNaturalTaskEnvelope', 'createNaturalTaskEnvelopeProposal',
    'evaluateNaturalTaskEnvelopeOperation'
  ]);
});
