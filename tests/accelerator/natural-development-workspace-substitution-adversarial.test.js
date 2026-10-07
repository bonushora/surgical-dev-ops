'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');

const {
  createDeterministicWorkspaceSession,
  revalidateDeterministicWorkspaceSession
} = require('../../accelerator/adapters/deterministic-workspace-session-adapter');
const {
  createNaturalAgenticMission,
  selectNaturalAgenticMissionContinuation
} = require('../../accelerator/core/natural-agentic-mission');
const {
  provisionLocalOfflineHumanAuthority
} = require('../../accelerator/core/local-offline-human-authority-store');
const {
  materializeGovernedEngineeringProposal
} = require('../../accelerator/core/governed-engineering-proposal');
const {
  prepareInteractiveNaturalDevelopment
} = require('../../accelerator/cli/natural-development-interactive');
const {
  materializeLocalNaturalDevelopmentAuthorization
} = require('../../accelerator/cli/natural-development-local-authorization');
const {
  composeAndDispatchNaturalDevelopmentPatch
} = require('../../accelerator/cli/natural-development-r3-composition');

const TARGET = 'example.js';
const BEFORE = "'use strict';\nmodule.exports = 1;\n";
const AFTER = "'use strict';\nmodule.exports = 2;\n";
const CREATED_AT = '2099-04-01T00:00:00.000Z';

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function git(repository, args) {
  return execFileSync('git', args, {
    cwd: repository,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function fixture(t) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdo-workspace-substitution-')
  );
  const repository = path.join(root, 'repository');
  const authorityRoot = path.join(root, 'authority');
  const journalStorageRoot = path.join(root, 'journal');

  fs.mkdirSync(repository);
  fs.mkdirSync(journalStorageRoot);
  fs.writeFileSync(path.join(repository, TARGET), BEFORE);
  git(repository, ['init', '-b', 'main']);
  git(repository, ['config', 'user.email', 'substitution@example.invalid']);
  git(repository, ['config', 'user.name', 'Workspace Substitution']);
  git(repository, ['add', TARGET]);
  git(repository, ['commit', '-m', 'repository A']);
  provisionLocalOfflineHumanAuthority({
    authorityRoot,
    issuer: 'local:workspace-substitution',
    subjectId: 'workspace-substitution-human'
  });

  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  return {
    root,
    repository: fs.realpathSync(repository),
    authorityRoot: fs.realpathSync(authorityRoot),
    journalStorageRoot: fs.realpathSync(journalStorageRoot)
  };
}

async function preparePending(state) {
  const before = fs.readFileSync(path.join(state.repository, TARGET));
  const beforeSha256 = sha(before);
  let decisions = 0;
  const pending = await prepareInteractiveNaturalDevelopment({
    request: Object.freeze({
      objective: 'Change the exact workspace-substitution fixture.',
      target: TARGET
    }),
    activation: Object.freeze({
      workspace: 'workspace-substitution',
      repositoryPath: state.repository,
      interactionMode: Object.freeze({ mode: 'NATURAL' })
    }),
    cognitiveSession: Object.freeze({
      async decideEvidence() {
        decisions += 1;
        return decisions === 1
          ? Object.freeze({
              schema: 'sdo.natural_evidence_decision.v1',
              decision: 'REQUEST_EVIDENCE',
              response: null,
              evidenceRequest: Object.freeze({
                kind: 'READ_FILE',
                target: TARGET,
                reason: 'Bind the exact repository A BEFORE content.'
              })
            })
          : Object.freeze({
              schema: 'sdo.natural_evidence_decision.v1',
              decision: 'RESPOND',
              response: 'The bounded evidence is sufficient.',
              evidenceRequest: null
            });
      },
      async proposePatch(objective) {
        return materializeGovernedEngineeringProposal({
          schema: 'sdo.ai_engineering_patch_proposal.v1',
          objective,
          target: TARGET,
          beforeSha256,
          replacementBase64: Buffer.from(AFTER).toString('base64'),
          reason: 'Apply the exact reviewed substitution qualification patch.',
          validationKind: 'VALIDATE_JS'
        });
      }
    }),
    dispatchEvidence() {
      return {
        orchestration: { status: 'COMPLETED' },
        execution: {
          schema: 'sdo.filesystem_read_result.v1',
          target: { requested: TARGET },
          evidence: {
            bytes: before.length,
            sha256: beforeSha256,
            content: before.toString('utf8')
          }
        }
      };
    }
  });

  return pending;
}

function replaceRepositoryAtSamePath(state) {
  const repositoryA = `${state.repository}-repository-a`;
  fs.renameSync(state.repository, repositoryA);
  fs.cpSync(repositoryA, state.repository, {
    recursive: true,
    preserveTimestamps: true
  });
  return {
    repositoryA: fs.realpathSync(repositoryA),
    repositoryB: fs.realpathSync(state.repository)
  };
}

function localAuthorization(state, pending) {
  return materializeLocalNaturalDevelopmentAuthorization({
    patchProposal: pending.patchProposal,
    approvedProposalFingerprint: pending.patchProposal.proposalFingerprint,
    physicalWorkspaceIdentity: pending.physicalWorkspaceIdentity,
    repositoryPath: pending.repositoryPath,
    authorityRoot: state.authorityRoot,
    journalStorageRoot: state.journalStorageRoot,
    tenantId: 'qualification',
    projectId: 'workspace-substitution'
  });
}

test(
  'same pathname with a physically replaced repository invalidates mission and pending G4 continuation',
  async (t) => {
    const state = fixture(t);
    const session = createDeterministicWorkspaceSession({
      authorizedRoot: state.repository,
      humanSubject: 'workspace-substitution-human',
      authorizedAt: CREATED_AT
    });
    const mission = createNaturalAgenticMission({
      missionId: 'workspace-substitution-mission',
      objective: 'Prove physical repository continuity.',
      session,
      createdAt: CREATED_AT,
      plan: [{
        stepId: 'inspect',
        summary: 'Inspect the same physical repository.',
        status: 'PENDING',
        operation: 'workspace.status'
      }],
      authority: { allowedCapabilities: ['workspace.status'] }
    });
    const pending = await preparePending(state);
    assert.equal(
      pending.physicalWorkspaceIdentity,
      session.physicalWorkspaceIdentity,
      'NATURAL and deterministic session use one physical identity vocabulary'
    );
    const originalPath = pending.repositoryPath;
    const replacement = replaceRepositoryAtSamePath(state);
    const repositoryBSession = createDeterministicWorkspaceSession({
      authorizedRoot: state.repository,
      humanSubject: 'workspace-substitution-human',
      authorizedAt: CREATED_AT
    });
    const revalidation = revalidateDeterministicWorkspaceSession(session);
    const continuation = selectNaturalAgenticMissionContinuation({
      mission,
      revalidation
    });

    assert.equal(originalPath, replacement.repositoryB, 'PATH_SAME=YES');
    assert.notEqual(
      session.physicalWorkspaceIdentity,
      repositoryBSession.physicalWorkspaceIdentity,
      'PHYSICAL_REPOSITORY_SAME=NO'
    );
    assert.equal(revalidation.decision, 'INVALIDATED');
    assert.equal(revalidation.samePhysical, false);
    assert.equal(continuation.classification, 'STALE_STATE');
    assert.throws(
      () => localAuthorization(state, pending),
      /physical workspace|repository identity|stale/i
    );
  }
);

test(
  'stale G4 cannot compose R3 or create a physical effect in repository B at the same pathname',
  async (t) => {
    const state = fixture(t);
    const session = createDeterministicWorkspaceSession({
      authorizedRoot: state.repository,
      humanSubject: 'workspace-substitution-human',
      authorizedAt: CREATED_AT
    });
    const pending = await preparePending(state);
    const staleAuthorization = localAuthorization(state, pending);
    const replacement = replaceRepositoryAtSamePath(state);
    const repositoryBSession = createDeterministicWorkspaceSession({
      authorizedRoot: state.repository,
      humanSubject: 'workspace-substitution-human',
      authorizedAt: CREATED_AT
    });

    assert.equal(pending.repositoryPath, replacement.repositoryB, 'PATH_SAME=YES');
    assert.notEqual(
      session.physicalWorkspaceIdentity,
      repositoryBSession.physicalWorkspaceIdentity,
      'PHYSICAL_REPOSITORY_SAME=NO'
    );

    let result = null;
    let failure = null;
    try {
      result = composeAndDispatchNaturalDevelopmentPatch({
        contract: pending.contract,
        patchProposal: pending.patchProposal,
        patchAuthorization: staleAuthorization,
        physicalWorkspaceIdentity: pending.physicalWorkspaceIdentity,
        repositoryPath: pending.repositoryPath,
        authorityRoot: state.authorityRoot,
        journalStorageRoot: state.journalStorageRoot,
        tenantId: 'qualification',
        projectId: 'workspace-substitution'
      });
    } catch (error) {
      failure = error;
    }

    assert.ok(
      failure,
      `SECOND_PHYSICAL_REPOSITORY_EFFECT=YES; stale R3 completed with ${
        result && result.status
      } at ${result && result.managedProjection}`
    );
    assert.match(
      failure.message,
      /physical workspace|repository identity|stale/i
    );
    assert.equal(result, null);
  }
);
