'use strict';

const SCHEMA = 'sdo.natural_runner_runtime.v1';
const STATES = Object.freeze([
  'INACTIVE',
  'CONTINUING',
  'EXACT_HUMAN_REVIEW_REQUIRED',
  'AUTHORIZED_EFFECT_COMPLETED',
  'FAILED_CLOSED',
  'SAFE_STOPPED'
]);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function base(state, boundary, detail = null) {
  return freeze({
    schema: SCHEMA,
    state,
    boundary,
    detail,
    intent: 'AUTONOMOUS_UNTIL_GREEN',
    continuationAuthority: false,
    operationalAuthority: false,
    mutationAuthority: false,
    approvalAuthority: false,
    publicationAuthority: false,
    authorityExpansion: false
  });
}

function createNaturalRunnerRuntime() {
  let current = base('INACTIVE', 'NONE');

  function requirePending(pending) {
    if (
      !pending ||
      pending.state !== 'EXACT_HUMAN_REVIEW_REQUIRED' ||
      !Object.isFrozen(pending) ||
      !pending.patchProposal ||
      !/^[a-f0-9]{64}$/.test(pending.patchProposal.proposalFingerprint || '')
    ) {
      throw new Error('Exact immutable pending development proposal is required.');
    }
    return pending.patchProposal.proposalFingerprint;
  }

  return Object.freeze({
    start() {
      current = base(
        'CONTINUING',
        'AUTHORIZED_BOUNDED_CONTINUITY',
        'RUNNER may continue planning and qualified read-only evidence, but cannot mint mutation authority.'
      );
      return current;
    },

    exactHumanReviewRequired(pending) {
      const proposalFingerprint = requirePending(pending);
      current = base(
        'EXACT_HUMAN_REVIEW_REQUIRED',
        'HUMAN_AUTHORITY_REQUIRED',
        proposalFingerprint
      );
      return current;
    },

    authorizedEffectCompleted(completed) {
      if (
        !completed ||
        typeof completed !== 'object' ||
        typeof completed.target !== 'string' ||
        !completed.target ||
        !/^[a-f0-9]{64}$/.test(completed.beforeSha256 || '') ||
        !/^[a-f0-9]{64}$/.test(completed.afterSha256 || '')
      ) {
        throw new Error('Qualified completed governed effect is required.');
      }
      current = base(
        'AUTHORIZED_EFFECT_COMPLETED',
        'NEXT_DETERMINISTIC_STEP',
        completed.target
      );
      return current;
    },

    failClosed(reason = 'Governed continuation failed safely.') {
      current = base('FAILED_CLOSED', 'FAIL_CLOSED', String(reason));
      return current;
    },

    cancelPending() {
      current = base(
        'SAFE_STOPPED',
        'HUMAN_CANCELLED',
        'Exact proposal cancelled without materializing authority.'
      );
      return current;
    },

    stop() {
      current = base(
        'SAFE_STOPPED',
        'USER_SAFE_STOP',
        'Continuation revoked at a deterministic safe boundary.'
      );
      return current;
    },

    status() {
      return current;
    }
  });
}

module.exports = Object.freeze({
  SCHEMA,
  STATES,
  createNaturalRunnerRuntime
});
