'use strict';

const {
  createMissionGitFlowClosure,
  validateMissionGitFlowClosure,
  advanceMissionGitFlowClosure
} = require('../core/mission-git-flow-closure');
const {
  validateNaturalAgenticMission
} = require('../core/natural-agentic-mission');
const {
  validateGitFlowAuthorization
} = require('../core/git-flow-contract');
const {
  createGovernedGitFlowRunner
} = require('./governed-git-flow-runner');

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function validateRunner(runner) {
  if (!runner || !Object.isFrozen(runner) ||
      !['reconcile', 'commit', 'push', 'snapshot'].every(
        (method) => typeof runner[method] === 'function'
      )) {
    throw new Error('Immutable governed Git Flow runner is required.');
  }
  return runner;
}

function createGovernedMissionGitFlowOrchestrator({
  runner = createGovernedGitFlowRunner()
} = {}) {
  const gitFlow = validateRunner(runner);

  function context({ closure, mission, authorization }) {
    return {
      closure: validateMissionGitFlowClosure(closure),
      mission: validateNaturalAgenticMission(mission),
      authorization: validateGitFlowAuthorization(authorization)
    };
  }

  function snapshot(authorization, result, components) {
    return gitFlow.snapshot({
      authorization,
      result,
      testsStatus: 'PASSOU',
      components,
      gates: result.phase === 'PUBLISHED' ? 3 : 2,
      attempts: 0,
      manualActions: [],
      deferred: []
    });
  }

  function record(input, operation, result, components) {
    return advanceMissionGitFlowClosure({
      ...input,
      operation,
      result,
      snapshot: snapshot(input.authorization, result, components)
    });
  }

  function prepare({ mission, authorization } = {}) {
    return createMissionGitFlowClosure({ mission, authorization });
  }

  function reconcile(input = {}) {
    const bound = context(input);
    const observed = gitFlow.reconcile({ authorization: bound.authorization });
    return record(bound, 'reconcile', observed, [
      'natural-agentic-mission',
      'git-flow-authorization',
      'physical Git reconciliation'
    ]);
  }

  function commit(input = {}) {
    const bound = context(input);
    const reconciled = reconcile(bound);
    if (reconciled.state !== 'ELIGIBLE') return reconciled;
    const committed = gitFlow.commit({
      authorization: bound.authorization,
      message: input.message
    });
    return record({ ...bound, closure: reconciled }, 'commit', committed, [
      'natural-agentic-mission',
      'git-flow-authorization',
      'authorized local commit'
    ]);
  }

  function publish(input = {}) {
    const bound = context(input);
    const reconciled = reconcile(bound);
    if (reconciled.state === 'REMOTE_GREEN') return reconciled;
    if (reconciled.state !== 'LOCAL_GREEN') return reconciled;
    const published = gitFlow.push({
      authorization: bound.authorization,
      commitSha: reconciled.commitSha
    });
    return record({ ...bound, closure: reconciled }, 'push', published, [
      'natural-agentic-mission',
      'git-flow-authorization',
      'remote CAS',
      'remote readback'
    ]);
  }

  return deepFreeze({ prepare, reconcile, commit, publish });
}

module.exports = deepFreeze({
  createGovernedMissionGitFlowOrchestrator
});
