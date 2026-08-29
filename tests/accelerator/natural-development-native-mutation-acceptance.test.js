'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const {
  provisionLocalOfflineHumanAuthority
} = require('../../accelerator/core/local-offline-human-authority-store');
const {
  materializeGovernedEngineeringProposal
} = require('../../accelerator/core/governed-engineering-proposal');
const {
  prepareInteractiveNaturalDevelopment,
  approveInteractiveNaturalDevelopment
} = require('../../accelerator/cli/natural-development-interactive');

function git(repository, arguments_) {
  return execFileSync('git', arguments_, { cwd: repository, encoding: 'utf8' }).trim();
}

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-native-acceptance-'));
  const repository = path.join(root, 'repository');
  const authorityRoot = path.join(root, 'authority');
  const journalStorageRoot = path.join(root, 'journal');
  fs.mkdirSync(repository);
  fs.mkdirSync(journalStorageRoot);
  fs.writeFileSync(path.join(repository, 'example.js'), "'use strict';\nmodule.exports = 1;\n");
  git(repository, ['init', '-q']);
  git(repository, ['config', 'user.email', 'acceptance@example.invalid']);
  git(repository, ['config', 'user.name', 'Acceptance']);
  git(repository, ['add', 'example.js']);
  git(repository, ['commit', '-qm', 'fixture']);
  provisionLocalOfflineHumanAuthority({
    authorityRoot,
    issuer: 'local:native-acceptance',
    subjectId: 'acceptance-human'
  });
  return { root, repository: fs.realpathSync(repository), authorityRoot, journalStorageRoot };
}

async function pending(state) {
  const before = fs.readFileSync(path.join(state.repository, 'example.js'));
  const beforeSha256 = sha(before);
  let decisions = 0;
  const cognitiveSession = Object.freeze({
    async decideEvidence() {
      decisions += 1;
      return decisions === 1
        ? Object.freeze({
            schema: 'sdo.natural_evidence_decision.v1', decision: 'REQUEST_EVIDENCE', response: null,
            evidenceRequest: Object.freeze({ kind: 'READ_FILE', target: 'example.js', reason: 'Bind exact BEFORE.' })
          })
        : Object.freeze({
            schema: 'sdo.natural_evidence_decision.v1', decision: 'RESPOND',
            response: 'The exact evidence is sufficient.', evidenceRequest: null
          });
    },
    async proposePatch(objective) {
      return materializeGovernedEngineeringProposal({
        schema: 'sdo.ai_engineering_patch_proposal.v1', objective,
        target: 'example.js', beforeSha256,
        replacementBase64: Buffer.from("'use strict';\nmodule.exports = 2;\n").toString('base64'),
        reason: 'Apply the exact bounded acceptance change.', validationKind: 'VALIDATE_JS'
      });
    }
  });
  const activation = Object.freeze({
    workspace: 'native-acceptance', repositoryPath: state.repository,
    interactionMode: Object.freeze({ mode: 'NATURAL' })
  });
  return prepareInteractiveNaturalDevelopment({
    request: Object.freeze({ objective: 'change example.js to version 2', target: 'example.js' }),
    activation,
    cognitiveSession,
    dispatchEvidence() {
      return {
        orchestration: { status: 'COMPLETED' },
        execution: {
          schema: 'sdo.filesystem_read_result.v1', target: { requested: 'example.js' },
          evidence: { bytes: before.length, sha256: beforeSha256, content: before.toString('utf8') }
        }
      };
    }
  });
}

test('real temporary repository completes signed G1-G10 mutation and denies replay', async () => {
  const state = fixture();
  const proposal = await pending(state);
  const approval = {
    pending: proposal,
    approvedProposalFingerprint: proposal.patchProposal.proposalFingerprint,
    authorityRoot: state.authorityRoot,
    journalStorageRoot: state.journalStorageRoot,
    tenantId: 'local-acceptance',
    projectId: 'native-acceptance'
  };
  const completed = await approveInteractiveNaturalDevelopment(approval);

  assert.equal(completed.status, 'COMPLETED');
  assert.equal(completed.validation.status, 'VALIDATED');
  assert.equal(completed.reusableApproval, false);
  assert.equal(completed.operationalAuthority, false);
  assert.equal(fs.readFileSync(completed.validation.authoritativeProjection, 'utf8'),
    "'use strict';\nmodule.exports = 2;\n");
  assert.equal(git(state.repository, ['status', '--porcelain']), '');

  await assert.rejects(
    approveInteractiveNaturalDevelopment(approval),
    /already claimed|already consumed|replay|denied|requires completed R3 journal/i
  );
  assert.equal(git(state.repository, ['status', '--porcelain']), '');
});
