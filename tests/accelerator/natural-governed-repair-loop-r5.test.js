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
  createGatewayRequest,
  dispatchGatewayRequest
} = require('../../accelerator/core/integrated-governed-agent-gateway');
const {
  bootstrapManifestAuthority,
  compareAndSwapManifest
} = require('../../accelerator/core/git-manifest-cas');
const {
  recoverAuthoritativeMaterialization
} = require('../../accelerator/core/git-manifest-materializer');
const {
  prepareInteractiveNaturalDevelopment
} = require('../../accelerator/cli/natural-development-interactive');
const {
  createNaturalGovernedRepairLoop,
  investigateNaturalGovernedRepairFailure,
  proposeNaturalGovernedRepair,
  authorizeAndContinueNaturalGovernedRepair,
  denyNaturalGovernedRepairAuthority,
  cancelNaturalGovernedRepairLoop
} = require('../../accelerator/cli/natural-governed-repair-loop');
const {
  createNaturalSessionControl
} = require('../../accelerator/cli/natural-session-control');
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-r5-loop-'));
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
  git(repository, ['config', 'user.name', 'R5 Test']);
  git(repository, ['config', 'user.email', 'r5@surgical.invalid']);
  git(repository, ['add', '.']);
  git(repository, ['commit', '-m', 'R5 fixture']);
  provisionLocalOfflineHumanAuthority({
    authorityRoot,
    issuer: 'local:r5-test',
    subjectId: 'r5-human'
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
  const session = createDeterministicWorkspaceSession({
    authorizedRoot: state.repository,
    humanSubject: 'r5-human',
    authorizedAt: at
  });
  return createNaturalGovernedRepairLoop({
    objective: OBJECTIVE,
    session,
    allowedTargets: ['first.js', 'second.js'],
    testTarget: 'repair.test.js',
    qualificationTarget: 'qualification.test.js',
    attemptCeiling,
    createdAt: at
  });
}

async function prepare(state, loop, target, replacement) {
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
              reason: 'Bind the exact physical BEFORE evidence.'
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
        replacementBase64: Buffer.from(replacement).toString('base64'),
        reason: `Repair only the physically failing ${target} implementation.`,
        validationKind: 'VALIDATE_JS'
      });
    }
  });
  return prepareInteractiveNaturalDevelopment({
    request: { objective: loop.objective, target },
    activation: {
      workspace: 'r5-fixture',
      repositoryPath: state.repository,
      interactionMode: { mode: 'NATURAL' },
      language: 'en'
    },
    cognitiveSession,
    workMode: 'SUPERVISED_MICROTASKS',
    patchAttempt: loop.attempts.length + 1
  });
}

function start(loop) {
  return investigateNaturalGovernedRepairFailure(loop, { at: now() });
}

async function propose(state, loop, target) {
  const pending = await prepare(
    state,
    loop,
    target,
    "'use strict';\nmodule.exports = true;\n"
  );
  return proposeNaturalGovernedRepair(loop, { pending, at: now() });
}

function approve(state, loop) {
  return authorizeAndContinueNaturalGovernedRepair(loop, {
    approvedProposalFingerprint: loop.pending.patchProposal.proposalFingerprint,
    authorityRoot: state.authorityRoot,
    journalStorageRoot: state.journalStorageRoot,
    tenantId: 'r5-test',
    projectId: 'repair-loop',
    at: now()
  });
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

test('investigation and proposal establish physical RED then stop at exact authority', async () => {
  const state = fixture();
  try {
    const initialHash = sha(fs.readFileSync(path.join(state.repository, 'first.js')));
    let loop = start(createLoop(state));
    assert.equal(loop.state, 'READY_FOR_REPAIR');
    assert.equal(loop.mission.tests.targeted.at(-1).classification, 'FAILED');
    assert.equal(loop.mission.changes.length, 0);
    assert.equal(loop.lastDispatch.result.providerInvoked, false);

    loop = await propose(state, loop, 'first.js');
    assert.equal(loop.state, 'AUTHORITY_REQUIRED');
    assert.equal(loop.stopReason, 'AUTHORITY_REQUIRED');
    assert.equal(loop.mission.changes.length, 0);
    assert.equal(sha(fs.readFileSync(path.join(state.repository, 'first.js'))), initialHash);
    assert.deepEqual(
      loop.mission.events.slice(-1).map((event) => event.type),
      ['AUTHORITY_REQUIRED']
    );
    assert.equal(loop.approvalRequest.boundedScope.target, 'first.js');
    assert.equal(loop.approvalRequest.operationalAuthority, false);
  } finally {
    state.cleanup();
  }
});

test('first authorized repair remains RED and second exact repair reaches qualified mission GREEN', async () => {
  const state = fixture();
  try {
    const focusedBefore = sha(fs.readFileSync(path.join(state.repository, 'repair.test.js')));
    const qualificationBefore = sha(fs.readFileSync(path.join(state.repository, 'qualification.test.js')));
    let loop = start(createLoop(state));
    loop = await propose(state, loop, 'first.js');
    loop = approve(state, loop);

    assert.equal(loop.state, 'READY_FOR_REPAIR');
    assert.equal(loop.attempts.length, 1);
    assert.equal(loop.attempts[0].testClassification, 'FAILED');
    assert.equal(loop.mission.state === 'GREEN', false);
    assert.equal(loop.mission.tests.canonical, null);
    assert.equal(loop.mission.changes.length, 1);
    assert.deepEqual(loop.mission.authority.usedAuthorityRefs, [
      loop.attempts[0].authorizationFingerprint
    ]);

    loop = await propose(state, loop, 'second.js');
    loop = approve(state, loop);

    assert.equal(loop.state, 'GREEN');
    assert.equal(loop.mission.state, 'GREEN');
    assert.equal(loop.attempts.length, 2);
    assert.deepEqual(loop.attempts.map((item) => item.testClassification), [
      'FAILED',
      'PASSED'
    ]);
    assert.equal(loop.mission.tests.canonical.classification, 'PASSED');
    assert.equal(loop.mission.tests.canonical.failed, 0);
    assert.equal(loop.mission.changes.length, 2);
    assert.ok(loop.mission.plan.every((step) => !['PENDING', 'ACTIVE'].includes(step.status)));
    assert.equal(loop.mission.events.at(-1).type, 'MISSION_GREEN');
    assert.ok(loop.mission.events.some((event) => event.type === 'QUALIFICATION_STARTED'));
    const eventTypes = loop.mission.events.map((event) => event.type);
    const firstRepair = eventTypes.indexOf('REPAIR_STARTED');
    const firstFailure = eventTypes.indexOf('TEST_FAILED', firstRepair);
    const secondRepair = eventTypes.indexOf('REPAIR_STARTED', firstRepair + 1);
    const qualification = eventTypes.indexOf('QUALIFICATION_STARTED');
    assert.ok(firstRepair >= 0 && firstRepair < firstFailure);
    assert.ok(firstFailure < secondRepair && secondRepair < qualification);
    assert.ok(qualification < eventTypes.lastIndexOf('MISSION_GREEN'));
    assert.equal(eventTypes.filter((item) => item === 'AUTHORITY_REQUIRED').length, 2);
    assert.equal(eventTypes.filter((item) => item === 'AUTHORITY_GRANTED').length, 2);
    assert.notEqual(
      loop.attempts[0].authorizationFingerprint,
      loop.attempts[1].authorizationFingerprint
    );
    assert.equal(
      loop.mission.authority.usedAuthorityRefs.includes(loop.qualificationAuthorityRef),
      false
    );
    assert.equal(sha(fs.readFileSync(path.join(state.repository, 'repair.test.js'))), focusedBefore);
    assert.equal(sha(fs.readFileSync(path.join(state.repository, 'qualification.test.js'))), qualificationBefore);
    assert.equal(git(state.repository, ['status', '--porcelain']), '');
    assert.match(
      fs.readFileSync(loop.attempts[0].composition.managedProjection, 'utf8'),
      /module\.exports = true/
    );
    assert.match(
      fs.readFileSync(loop.attempts[1].composition.managedProjection, 'utf8'),
      /module\.exports = true/
    );

    const commitRequest = createGatewayRequest({
      requestId: 'r5-commit-non-transitivity',
      mission: loop.mission,
      operation: 'git.commit',
      args: {},
      requestedAt: loop.mission.updatedAt
    });
    const commit = dispatchGatewayRequest({
      request: commitRequest,
      mission: loop.mission,
      options: { now: () => loop.mission.updatedAt }
    });
    assert.equal(commit.result.classification, 'DENIED');
    assert.equal(commit.result.successful, false);
  } finally {
    state.cleanup();
  }
});

test('authority denial blocks mutation test and GREEN while preserving physical state', async () => {
  const state = fixture();
  try {
    let loop = start(createLoop(state));
    loop = await propose(state, loop, 'first.js');
    const before = sha(fs.readFileSync(path.join(state.repository, 'first.js')));
    const testEventsBefore = loop.mission.events.filter((event) => event.type === 'TEST_STARTED').length;
    loop = denyNaturalGovernedRepairAuthority(loop, { at: now() });
    assert.equal(loop.state, 'BLOCKED');
    assert.equal(loop.stopReason, 'AUTHORITY_DENIED');
    assert.equal(sha(fs.readFileSync(path.join(state.repository, 'first.js'))), before);
    assert.equal(loop.mission.changes.length, 0);
    assert.equal(
      loop.mission.events.filter((event) => event.type === 'TEST_STARTED').length,
      testEventsBefore
    );
    assert.equal(loop.mission.events.some((event) => event.type === 'MISSION_GREEN'), false);
  } finally {
    state.cleanup();
  }
});

test('external authoritative CAS race preserves state Y and rejects stale authorized proposal X', async () => {
  const state = fixture();
  try {
    let loop = start(createLoop(state));
    loop = await propose(state, loop, 'first.js');
    const before = loop.pending.patchProposal.beforeSha256;
    const external = "'use strict';\nmodule.exports = 'external-state-y';\n";
    const bootstrap = bootstrapManifestAuthority({
      workspace: state.repository,
      target: path.join(state.repository, 'first.js'),
      expectedBeforeSha256: before
    });
    const race = compareAndSwapManifest({
      workspace: state.repository,
      target: path.join(state.repository, 'first.js'),
      expectedManifestOid: bootstrap.manifestOid,
      expectedBeforeSha256: before,
      replacement: external
    });
    assert.equal(race.decision, 'APPLIED');

    loop = approve(state, loop);
    assert.equal(loop.state, 'BLOCKED');
    assert.equal(
      loop.stopReason,
      'CAS_MISMATCH',
      loop.lastDispatch.result.reason
    );
    assert.equal(loop.mission.changes.length, 0);
    const preserved = recoverAuthoritativeMaterialization({
      workspace: state.repository,
      target: path.join(state.repository, 'first.js'),
      expectedManifestOid: race.afterManifestOid
    });
    assert.match(fs.readFileSync(preserved.projection, 'utf8'), /external-state-y/);
    assert.equal(loop.mission.events.some((event) => event.type === 'MISSION_GREEN'), false);
  } finally {
    state.cleanup();
  }
});

test('cancellation is terminal for the process-local loop and cannot start the next mutation', async () => {
  const state = fixture();
  try {
    let loop = start(createLoop(state));
    loop = await propose(state, loop, 'first.js');
    loop = approve(state, loop);
    assert.equal(loop.state, 'READY_FOR_REPAIR');
    const changes = loop.mission.changes.length;
    const testStarts = loop.mission.events.filter(
      (event) => event.type === 'TEST_STARTED'
    ).length;
    loop = cancelNaturalGovernedRepairLoop(loop, { at: now() });
    assert.equal(loop.state, 'CANCELLED');
    assert.equal(loop.mission.state, 'CANCELLED');
    const secondPending = await prepare(
      state,
      loop,
      'second.js',
      "'use strict';\nmodule.exports = true;\n"
    );
    assert.throws(
      () => proposeNaturalGovernedRepair(loop, {
        pending: secondPending,
        at: now()
      }),
      /not ready/
    );
    assert.equal(loop.mission.changes.length, changes);
    assert.equal(
      loop.mission.events.filter((event) => event.type === 'TEST_STARTED').length,
      testStarts
    );
    assert.equal(loop.mission.events.at(-1).type, 'MISSION_CANCELLED');
  } finally {
    state.cleanup();
  }
});

test('test and qualification authority stay distinct and test manipulation is outside repair scope', async () => {
  const state = fixture();
  try {
    const loop = start(createLoop(state));
    const testBefore = sha(
      fs.readFileSync(path.join(state.repository, 'repair.test.js'))
    );
    const malicious = await prepare(
      state,
      loop,
      'repair.test.js',
      "'use strict';\nconst test = require('node:test');\ntest('hidden', { skip: true }, () => {});\n"
    );
    assert.throws(
      () => proposeNaturalGovernedRepair(loop, {
        pending: malicious,
        at: now()
      }),
      /Exact evidence-bound R5 repair proposal/
    );
    assert.equal(
      sha(fs.readFileSync(path.join(state.repository, 'repair.test.js'))),
      testBefore
    );
    assert.equal(loop.mission.changes.length, 0);

    const wrongQualification = createGatewayRequest({
      requestId: 'r5-wrong-qualification-scope',
      mission: loop.mission,
      operation: 'tests.runCanonical',
      args: {
        target: 'repair.test.js',
        scope: { target: 'repair.test.js' }
      },
      authorityRef: loop.qualificationAuthorityRef,
      requestedAt: loop.mission.updatedAt
    });
    const denied = dispatchGatewayRequest({
      request: wrongQualification,
      mission: loop.mission,
      options: { now: () => loop.mission.updatedAt }
    });
    assert.equal(denied.result.classification, 'AUTHORITY_REQUIRED');
    assert.equal(denied.result.successful, false);
    assert.equal(
      loop.mission.authority.allowedCapabilities.includes('git.commit'),
      false
    );
  } finally {
    state.cleanup();
  }
});

test('semantic R5 requests and evidence questions remain bounded and provider-independent', () => {
  for (const [language, request, repairPhrases, continuation] of [
    [
      'pt-BR',
      'repare first.js e second.js; teste repair.test.js; qualifique qualification.test.js',
      ['corrija isso', 'tente corrigir', 'corrija e teste'],
      'continue até ficar verde'
    ],
    [
      'en',
      'repair first.js and second.js; test repair.test.js; qualification qualification.test.js',
      ['fix this', 'try to fix it', 'fix it and test it'],
      'continue until green'
    ]
  ]) {
    const control = createNaturalSessionControl({ language, workspace: '/tmp/r5' });
    const startIntent = control.handle(request);
    assert.equal(startIntent.action, 'REPAIR_LOOP_START');
    assert.deepEqual(startIntent.request.allowedTargets, ['first.js', 'second.js']);
    assert.equal(startIntent.request.operationalAuthority, false);
    assert.equal(startIntent.request.mutationAuthority, false);
    for (const phrase of repairPhrases) {
      const repairIntent = control.handle(phrase);
      assert.equal(repairIntent.action, 'REFERENCE_REQUEST', phrase);
      assert.equal(repairIntent.intent.referenceAction, 'REQUEST_MUTATION', phrase);
      assert.equal(repairIntent.intent.authorityExpansion, false, phrase);
    }
    const continuationIntent = control.handle(continuation);
    assert.equal(continuationIntent.action, 'MISSION_CONTINUE');
    assert.equal(continuationIntent.authorityExpansion, false);
    assert.equal(control.handle(language === 'en' ? 'what did you change?' : 'o que você mudou?').projection, 'changes');
    assert.equal(control.handle(language === 'en' ? 'why did the test fail?' : 'por que o teste falhou?').projection, 'tests');
    assert.equal(control.handle(language === 'en' ? 'what is still red?' : 'o que ainda está vermelho?').projection, 'plan');
  }
});

test('production NATURAL session visibly completes the two-attempt governed R5 experience', async () => {
  const state = fixture();
  const input = new PassThrough();
  const output = new PassThrough();
  let observed = '';
  let proposalCount = 0;
  const evidenceDecisions = [0, 0];
  output.on('data', (chunk) => {
    observed += chunk.toString();
  });
  const targets = ['first.js', 'second.js'];
  const cognitiveSession = Object.freeze({
    async decideEvidence() {
      const selected = targets[proposalCount];
      evidenceDecisions[proposalCount] += 1;
      return evidenceDecisions[proposalCount] > 1
        ? Object.freeze({
            schema: 'sdo.natural_evidence_decision.v1',
            decision: 'RESPOND',
            response: 'The exact bounded evidence is sufficient.',
            evidenceRequest: null
          })
        : Object.freeze({
            schema: 'sdo.natural_evidence_decision.v1',
            decision: 'REQUEST_EVIDENCE',
            response: null,
            evidenceRequest: Object.freeze({
              kind: 'READ_FILE',
              target: selected,
              reason: 'Bind the exact physical BEFORE state.'
            })
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
        reason: `Repair only ${selected} from physical failure evidence.`,
        validationKind: 'VALIDATE_JS'
      });
    }
  });
  try {
    createInteractiveSession(
      Object.freeze({
        repositoryPath: state.repository,
        workspace: 'r5-production-fixture',
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
          tenantId: 'r5-experience',
          projectId: 'r5-production-fixture'
        }
      }
    );

    input.write(
      'repare first.js e second.js; teste repair.test.js; qualifique qualification.test.js\n'
    );
    await waitForOutput(() => observed, /Falha física delimitada e registrada/);
    input.write('corrija isso\n');
    let view = await waitForOutput(() => observed, /aprovar reparo [a-f0-9]{64}/);
    const firstProposal = view.match(/aprovar reparo ([a-f0-9]{64})/)[1];
    const firstBeforeMalformedApproval = sha(
      fs.readFileSync(path.join(state.repository, 'first.js'))
    );
    const malformedProposal = firstProposal === '0'.repeat(64)
      ? '1'.repeat(64)
      : '0'.repeat(64);
    input.write(`aprovar reparo ${malformedProposal}\n`);
    await waitForOutput(() => observed, /Um reparo exato aguarda decisão/);
    assert.equal(
      sha(fs.readFileSync(path.join(state.repository, 'first.js'))),
      firstBeforeMalformedApproval
    );
    assert.equal(proposalCount, 1);
    input.write(`aprovar reparo ${firstProposal}\n`);
    await waitForOutput(() => observed, /teste físico continua RED/);
    input.write('continue até ficar verde\n');
    view = await waitForOutput(
      () => observed,
      new RegExp(`aprovar reparo (?!${firstProposal})[a-f0-9]{64}`)
    );
    const proposals = [...view.matchAll(/aprovar reparo ([a-f0-9]{64})/g)];
    const secondProposal = proposals.at(-1)[1];
    assert.notEqual(secondProposal, firstProposal);
    input.write(`aprovar reparo ${secondProposal}\n`);
    await waitForOutput(() => observed, /Missão governada GREEN/);
    input.write('o que você mudou?\n');
    input.write('/plan\n');
    input.write('/status\n');
    input.write('exit\n');
    input.end();
    await waitForOutput(() => observed, /State: GREEN/);

    const started = observed.indexOf('Operação governada iniciada: tests.run');
    const initialResult = observed.indexOf('Falha física delimitada e registrada');
    assert.ok(started >= 0 && started < initialResult, observed);
    assert.equal((observed.match(/Reparo governado iniciado:/g) || []).length, 2);
    assert.equal((observed.match(/Autoridade governada requerida:/g) || []).length, 2);
    assert.equal((observed.match(/Qualificação governada iniciada:/g) || []).length, 1);
    assert.equal((observed.match(/Missão governada GREEN:/g) || []).length, 1);
    assert.match(observed, /first\.js: Conditional governed mutation completed/);
    assert.match(observed, /second\.js: Conditional governed mutation completed/);
    assert.match(observed, /Plan: \d+ completed, 0 active, 0 pending/);
    assert.equal(proposalCount, 2);
    assert.doesNotMatch(observed, /git\.commit.*SUCCESS|push.*SUCCESS/i);
    assert.equal(git(state.repository, ['status', '--porcelain']), '');
  } finally {
    input.destroy();
    output.destroy();
    state.cleanup();
  }
});
