'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { PassThrough } = require('node:stream');
const test = require('node:test');

const {
  provisionLocalOfflineHumanAuthority
} = require('../../accelerator/core/local-offline-human-authority-store');
const {
  materializeGovernedEngineeringProposal
} = require('../../accelerator/core/governed-engineering-proposal');
const {
  createDeterministicWorkspaceSession
} = require('../../accelerator/adapters/deterministic-workspace-session-adapter');
const {
  prepareInteractiveNaturalDevelopment
} = require('../../accelerator/cli/natural-development-interactive');
const {
  deriveLocalNaturalDevelopmentAuthorizationFromRepairMission
} = require('../../accelerator/cli/natural-development-local-authorization');
const {
  createNaturalGovernedRepairLoop,
  investigateNaturalGovernedRepairFailure,
  proposeNaturalGovernedRepair,
  authorizeNaturalGovernedRepairMission,
  continueNaturalGovernedRepairWithMissionAuthority
} = require('../../accelerator/cli/natural-governed-repair-loop');
const {
  createInteractiveSession
} = require('../../accelerator/cli/surgical');

const OBJECTIVE =
  'Repair first.js and second.js, test repair.test.js, and qualify qualification.test.js.';

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

function now() {
  return new Date().toISOString();
}

function waitForOutput(read, pattern, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const inspect = () => {
      const value = read();
      if (pattern.test(value)) return resolve(value);
      if (Date.now() - started >= timeoutMs) {
        return reject(new Error(`Timed out waiting for ${pattern}.\n${value}`));
      }
      setTimeout(inspect, 10);
    };
    inspect();
  });
}

function testSource(label) {
  return (
    "'use strict';\n" +
    "const assert = require('node:assert/strict');\n" +
    "const crypto = require('node:crypto');\n" +
    "const fs = require('node:fs');\n" +
    "const path = require('node:path');\n" +
    "const test = require('node:test');\n" +
    "function authoritative(relative) {\n" +
    "  const key = crypto.createHash('sha256').update(relative).digest('hex');\n" +
    "  const ref = path.join(process.cwd(), '.git', 'refs', 'surgical-devops', 'workspace', key);\n" +
    "  if (!fs.existsSync(ref)) return path.join(process.cwd(), relative);\n" +
    "  const oid = fs.readFileSync(ref, 'utf8').trim();\n" +
    "  return path.join(process.cwd(), '.git', 'surgical-devops', 'materialized', key, oid + '.blob');\n" +
    "}\n" +
    "function exported(relative) {\n" +
    "  const source = fs.readFileSync(authoritative(relative), 'utf8');\n" +
    "  const match = source.match(/module\\.exports\\s*=\\s*(true|false)/);\n" +
    "  return match && match[1] === 'true';\n" +
    "}\n" +
    `test(${JSON.stringify(label)}, () => {\n` +
    "  assert.equal(exported('first.js'), true);\n" +
    "  assert.equal(exported('second.js'), true);\n" +
    "});\n"
  );
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-mission-authority-'));
  const repository = path.join(root, 'repository');
  const authorityRoot = path.join(root, 'authority');
  const journalStorageRoot = path.join(root, 'journal');
  fs.mkdirSync(repository);
  fs.mkdirSync(journalStorageRoot);
  fs.writeFileSync(path.join(repository, 'first.js'), "'use strict';\nmodule.exports = false;\n");
  fs.writeFileSync(path.join(repository, 'second.js'), "'use strict';\nmodule.exports = false;\n");
  fs.writeFileSync(path.join(repository, 'repair.test.js'), testSource('focused repair contract'));
  fs.writeFileSync(path.join(repository, 'qualification.test.js'), testSource('bounded qualification contract'));
  git(repository, ['init', '-b', 'main']);
  git(repository, ['config', 'user.name', 'Mission Authority Test']);
  git(repository, ['config', 'user.email', 'mission-authority@surgical.invalid']);
  git(repository, ['add', '.']);
  git(repository, ['commit', '-m', 'mission authority fixture']);
  provisionLocalOfflineHumanAuthority({
    authorityRoot,
    issuer: 'local:mission-authority-test',
    subjectId: 'mission-authority-human'
  });
  return {
    root,
    repository: fs.realpathSync(repository),
    authorityRoot: fs.realpathSync(authorityRoot),
    journalStorageRoot: fs.realpathSync(journalStorageRoot),
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
}

function createLoop(state, attemptCeiling = 2) {
  const at = now();
  return createNaturalGovernedRepairLoop({
    objective: OBJECTIVE,
    session: createDeterministicWorkspaceSession({
      authorizedRoot: state.repository,
      humanSubject: 'mission-authority-human',
      authorizedAt: at
    }),
    allowedTargets: ['first.js', 'second.js'],
    testTarget: 'repair.test.js',
    qualificationTarget: 'qualification.test.js',
    attemptCeiling,
    createdAt: at
  });
}

async function pendingRepair(state, loop, target) {
  const before = fs.readFileSync(path.join(state.repository, target));
  let evidenceDecision = 0;
  const cognitiveSession = Object.freeze({
    async decideEvidence() {
      evidenceDecision += 1;
      return evidenceDecision === 1
        ? Object.freeze({
            schema: 'sdo.natural_evidence_decision.v1',
            decision: 'REQUEST_EVIDENCE',
            response: null,
            evidenceRequest: Object.freeze({
              kind: 'READ_FILE',
              target,
              reason: 'Bind the current physical BEFORE evidence.'
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
        target,
        beforeSha256: sha(before),
        replacementBase64: Buffer.from(
          "'use strict';\nmodule.exports = true;\n"
        ).toString('base64'),
        reason: `Repair only ${target} from current physical evidence.`,
        validationKind: 'VALIDATE_JS'
      });
    }
  });
  return prepareInteractiveNaturalDevelopment({
    request: { objective: loop.objective, target },
    activation: {
      workspace: 'mission-authority-fixture',
      repositoryPath: state.repository,
      interactionMode: { mode: 'NATURAL' },
      language: 'en'
    },
    cognitiveSession,
    workMode: 'BOUNDED_AUTONOMY_TO_BOUNDARY',
    patchAttempt: loop.attempts.length + 1
  });
}

test('one bounded human mission authorization permits two independently checked repairs until GREEN', async (t) => {
  const state = fixture();
  t.after(state.cleanup);

  let loop = investigateNaturalGovernedRepairFailure(
    createLoop(state),
    { at: now() }
  );
  assert.equal(loop.state, 'READY_FOR_REPAIR');
  assert.equal(loop.mission.tests.lastResult.classification, 'FAILED');
  assert.equal(loop.missionAuthorityRequest.operationalAuthority, false);

  loop = authorizeNaturalGovernedRepairMission(loop, {
    approvedAuthorityRequestFingerprint:
      loop.missionAuthorityRequest.authorityRequestFingerprint,
    authorityRoot: state.authorityRoot,
    journalStorageRoot: state.journalStorageRoot,
    tenantId: 'mission-authority-test',
    projectId: 'acceptance-a',
    at: now()
  });
  const missionAuthorityFingerprint =
    loop.missionMutationAuthority.authorityFingerprint;
  const capturedMissionAuthority = loop.missionMutationAuthority;
  const capturedAuthorizedMission = loop.mission;
  const unconsumedPostGreenProposal = (
    await pendingRepair(state, loop, 'second.js')
  ).patchProposal;

  for (const target of ['first.js', 'second.js']) {
    const pending = await pendingRepair(state, loop, target);
    loop = proposeNaturalGovernedRepair(loop, { pending, at: now() });
    assert.equal(loop.state, 'MISSION_AUTHORITY_READY');
    loop = continueNaturalGovernedRepairWithMissionAuthority(loop, {
      authorityRoot: state.authorityRoot,
      journalStorageRoot: state.journalStorageRoot,
      tenantId: 'mission-authority-test',
      projectId: 'acceptance-a',
      at: now()
    });
  }

  assert.equal(loop.state, 'GREEN');
  assert.equal(loop.mission.state, 'GREEN');
  assert.equal(loop.attempts.length, 2);
  assert.deepEqual(
    loop.attempts.map((attempt) => attempt.testClassification),
    ['FAILED', 'PASSED']
  );
  assert.equal(
    new Set(loop.attempts.map((attempt) => attempt.authorizationFingerprint)).size,
    2
  );
  assert.equal(
    loop.attempts.every(
      (attempt) => attempt.missionAuthorityFingerprint === missionAuthorityFingerprint
    ),
    true
  );
  assert.equal(loop.missionMutationAuthority, null);
  assert.equal(loop.missionAuthorityRequest, null);
  assert.equal(loop.approvalRequest, null);
  assert.throws(
    () => continueNaturalGovernedRepairWithMissionAuthority(loop, {
      authorityRoot: state.authorityRoot,
      journalStorageRoot: state.journalStorageRoot,
      at: now()
    }),
    /No bounded mission-authorized/
  );
  assert.throws(
    () => deriveLocalNaturalDevelopmentAuthorizationFromRepairMission({
      missionAuthority: capturedMissionAuthority,
      mission: capturedAuthorizedMission,
      patchProposal: unconsumedPostGreenProposal,
      authorityRoot: state.authorityRoot,
      journalStorageRoot: state.journalStorageRoot,
      tenantId: 'mission-authority-test',
      projectId: 'acceptance-a'
    }),
    /process-local/
  );
  assert.equal(
    loop.mission.events.filter((event) => event.type === 'AUTHORITY_REQUIRED').length,
    0
  );
  assert.equal(
    loop.mission.events.some((event) => event.type === 'MISSION_GREEN'),
    true
  );
  assert.equal(git(state.repository, ['status', '--porcelain']), '');
});

test('production NATURAL performs RED repair RED repair GREEN after one mission authorization', async (t) => {
  const state = fixture();
  t.after(state.cleanup);
  const input = new PassThrough();
  const output = new PassThrough();
  t.after(() => {
    input.destroy();
    output.destroy();
  });
  let observed = '';
  let proposalCount = 0;
  const evidenceDecisions = [0, 0];
  const targets = ['first.js', 'second.js'];
  output.on('data', (chunk) => {
    observed += chunk.toString();
  });
  const cognitiveSession = Object.freeze({
    async decideEvidence() {
      const selected = targets[proposalCount];
      evidenceDecisions[proposalCount] += 1;
      return evidenceDecisions[proposalCount] === 1
        ? Object.freeze({
            schema: 'sdo.natural_evidence_decision.v1',
            decision: 'REQUEST_EVIDENCE',
            response: null,
            evidenceRequest: Object.freeze({
              kind: 'READ_FILE',
              target: selected,
              reason: 'Bind the current physical BEFORE evidence.'
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
      const selected = targets[proposalCount];
      const before = fs.readFileSync(path.join(state.repository, selected));
      proposalCount += 1;
      return materializeGovernedEngineeringProposal({
        schema: 'sdo.ai_engineering_patch_proposal.v1',
        objective,
        target: selected,
        beforeSha256: sha(before),
        replacementBase64: Buffer.from(
          "'use strict';\nmodule.exports = true;\n"
        ).toString('base64'),
        reason: `Repair only ${selected} from current physical evidence.`,
        validationKind: 'VALIDATE_JS'
      });
    }
  });
  createInteractiveSession(
    Object.freeze({
      repositoryPath: state.repository,
      workspace: 'mission-authority-production-fixture',
      protocols: Object.freeze({ bhSep: '2.2', bhSdp: '2.2' }),
      interactionMode: Object.freeze({ mode: 'NATURAL' }),
      language: 'pt-BR'
    }),
    {
      input,
      output,
      terminal: false,
      cognitiveSession,
      patchOptions: {
        authorityRoot: state.authorityRoot,
        journalStorageRoot: state.journalStorageRoot,
        tenantId: 'mission-authority-experience',
        projectId: 'acceptance-a-production'
      }
    }
  );

  input.write(
    'repare first.js e second.js; teste repair.test.js; qualifique qualification.test.js\n'
  );
  let view = await waitForOutput(
    () => observed,
    /autorizar missão [a-f0-9]{64}/
  );
  const missionFingerprint =
    view.match(/autorizar missão ([a-f0-9]{64})/)[1];
  input.write('help\n');
  await waitForOutput(
    () => observed,
    /Autoridade delimitada de missão pendente:/
  );
  assert.equal(proposalCount, 0);
  input.write(`autorizar missão ${missionFingerprint}\n`);
  await waitForOutput(() => observed, /Missão governada GREEN:/);
  input.write('exit\n');
  input.end();

  assert.equal(proposalCount, 2);
  assert.equal((observed.match(/Reparo governado iniciado:/g) || []).length, 2);
  assert.equal((observed.match(/aprovar reparo [a-f0-9]{64}/g) || []).length, 0);
  assert.equal((observed.match(/Missão governada GREEN:/g) || []).length, 1);
  assert.match(observed, /mesmo envelope/);
  assert.match(observed, /autoridade de missão expirou/i);
  assert.doesNotMatch(observed, /git\.commit.*SUCCESS|push.*SUCCESS/i);
  assert.equal(git(state.repository, ['status', '--porcelain']), '');
});
