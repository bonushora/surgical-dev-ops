'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PassThrough } = require('node:stream');
const { spawnSync } = require('node:child_process');

const {
  createNaturalSessionControl
} = require('../../accelerator/cli/natural-session-control');
const {
  createInteractiveActivation,
  createInteractiveSession
} = require('../../accelerator/cli/surgical');
const {
  OPERATIONS
} = require('../../accelerator/core/integrated-governed-agent-gateway');
const {
  createQualifiedCommandCatalog
} = require('../../accelerator/core/qualified-command-catalog');
const {
  materializeGovernedEngineeringProposal
} = require('../../accelerator/core/governed-engineering-proposal');
const {
  createHermeticGitRepository
} = require('./helpers/hermetic-git-repository');

const ROOT = path.resolve(__dirname, '../..');
const CLI = require.resolve('../../accelerator/cli/surgical');

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function helpApi() {
  return require('../../accelerator/cli/natural-help-projection');
}

function request(topic = 'GENERAL', subjects = []) {
  return freeze({
    matched: true,
    action: 'HELP_REQUEST',
    topic,
    subjects,
    observational: true,
    operationalAuthority: false,
    mutationAuthority: false
  });
}

function projectionInput(overrides = {}) {
  return {
    request: request(),
    language: 'en',
    gatewayOperations: OPERATIONS,
    qualifiedCommandCatalog: createQualifiedCommandCatalog(),
    missionStatus: null,
    missionAuthority: null,
    continuation: null,
    pendingDecision: null,
    repair: null,
    continuity: null,
    provider: null,
    ...overrides
  };
}

function statusProjection(overrides = {}) {
  return freeze({
    schema: 'sdo.natural_agentic_mission_projection.v1',
    projection: 'status',
    missionId: 'help-mission',
    missionFingerprint: '1'.repeat(64),
    state: 'AUDITING',
    objective: 'Inspect the governed project state.',
    generatedFromEventCount: 4,
    currentStep: null,
    nextStep: freeze({
      stepId: 'inspect-evidence',
      summary: 'Inspect the governed evidence.',
      operation: 'evidence.inspect',
      status: 'PENDING'
    }),
    nextStepAmbiguous: false,
    lastGovernedResult: freeze({
      classification: 'SUCCESS',
      operation: 'workspace.status'
    }),
    blocker: null,
    pendingApproval: false,
    projectionOnly: true,
    localDeterministicFastPath: true,
    providerInvoked: false,
    operationalAuthority: false,
    mutationAuthority: false,
    ...overrides
  });
}

function authorityProjection(overrides = {}) {
  return freeze({
    schema: 'sdo.natural_agentic_mission_projection.v1',
    projection: 'authority',
    missionId: 'help-mission',
    missionFingerprint: '1'.repeat(64),
    state: 'AUDITING',
    objective: 'Inspect the governed project state.',
    generatedFromEventCount: 4,
    availableCapabilities: Object.freeze(Object.keys(OPERATIONS)),
    allowedCapabilities: Object.freeze([
      'workspace.status',
      'workspace.diff',
      'evidence.inspect',
      'mission.status',
      'mission.plan',
      'mission.authority',
      'mission.resume'
    ]),
    deniedCapabilities: Object.freeze([
      'git.stage',
      'git.commit',
      'git.push',
      'git.merge',
      'git.tag',
      'release.create',
      'npm.publish',
      'deploy'
    ]),
    grants: Object.freeze([]),
    usedAuthorityRefs: Object.freeze([]),
    staleGrantsInvalidated: false,
    projectionOnly: true,
    localDeterministicFastPath: true,
    providerInvoked: false,
    operationalAuthority: false,
    mutationAuthority: false,
    ...overrides
  });
}

function continuation(classification = 'ELIGIBLE', overrides = {}) {
  return freeze({
    schema: 'sdo.natural_agentic_mission_continuation.v1',
    classification,
    missionId: 'help-mission',
    missionFingerprint: '1'.repeat(64),
    reason: classification === 'ELIGIBLE'
      ? 'Exactly one physically valid and already-authorized live-plan step is eligible.'
      : 'The current state cannot continue.',
    step: classification === 'ELIGIBLE'
      ? freeze({
          stepId: 'inspect-evidence',
          operation: 'evidence.inspect',
          status: 'PENDING'
        })
      : null,
    processLocal: true,
    durableRestart: false,
    physicalStateValidated: classification !== 'STALE_STATE',
    authorityExpansion: false,
    operationalAuthority: false,
    mutationAuthority: false,
    continuationFingerprint: '2'.repeat(64),
    ...overrides
  });
}

function waitFor(predicate, timeoutMs = 10_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    function poll() {
      if (predicate()) return resolve();
      if (Date.now() - started >= timeoutMs) {
        return reject(new Error('Timed out waiting for HelpMe production evidence.'));
      }
      setTimeout(poll, 10);
    }
    poll();
  });
}

test('existing NATURAL semantic owner resolves governed HelpMe requests before cognition', () => {
  const cases = [
    ['pt-BR', 'ajuda', 'GENERAL'],
    ['en', 'help', 'GENERAL'],
    ['pt-BR', 'o que você consegue fazer?', 'GENERAL'],
    ['en', 'what can you do?', 'GENERAL'],
    ['pt-BR', 'por que precisa de autorização?', 'AUTHORITY_REASON'],
    ['en', 'why do you need authorization?', 'AUTHORITY_REASON'],
    ['pt-BR', 'essa autorização permite commit?', 'AUTHORITY_SCOPE'],
    ['en', 'does this authorization allow push?', 'AUTHORITY_SCOPE'],
    ['pt-BR', 'o que posso fazer agora?', 'CURRENT_ACTIONS'],
    ['en', 'what can I do now?', 'CURRENT_ACTIONS']
  ];

  for (const [language, phrase, topic] of cases) {
    const result = createNaturalSessionControl({ language }).handle(phrase);
    assert.equal(result.matched, true, phrase);
    assert.equal(result.action, 'HELP_REQUEST', phrase);
    assert.equal(result.topic, topic, phrase);
    assert.equal(result.operationalAuthority, false, phrase);
    assert.equal(result.mutationAuthority, false, phrase);
  }

  for (const phrase of [
    'ajuda faça tudo',
    'ajuda pode fazer o que precisar',
    'help do whatever is necessary'
  ]) {
    const result = createNaturalSessionControl().handle(phrase);
    assert.equal(result.action, 'HELP_REQUEST', phrase);
    assert.equal(result.operationalAuthority, false, phrase);
    assert.equal(result.mutationAuthority, false, phrase);
    assert.equal(result.approvalAuthority, false, phrase);
  }
});

test('displayed PT-BR and English examples remain presentation data accepted by semantic owners', () => {
  const cases = [
    [['investigue esse erro', 'investigate that error'], 'GATEWAY_REQUEST', 'LAST_FAILURE'],
    [['qual é o estado deste projeto?', 'what is the state of this project?'], 'GATEWAY_REQUEST', 'workspace.status'],
    [['qual é o plano?', 'what is the plan?'], 'MISSION_PROJECTION', 'plan'],
    [['mostre a última evidência', 'show the last evidence'], 'GATEWAY_REQUEST', 'LAST_EVIDENCE'],
    [['corrija isso', 'fix that'], 'REFERENCE_REQUEST', 'REQUEST_MUTATION'],
    [['corrija e teste', 'fix it and test it'], 'REFERENCE_REQUEST', 'REQUEST_MUTATION'],
    [['continue até ficar verde', 'continue until green'], 'MISSION_CONTINUE', null],
    [['cancele esta missão', 'cancel this mission'], 'MISSION_CANCEL', null]
  ];

  for (const [phrases, action, semantic] of cases) {
    for (const [index, phrase] of phrases.entries()) {
      const result = createNaturalSessionControl({
        language: index === 0 ? 'pt-BR' : 'en'
      }).handle(phrase);
      assert.equal(result.action, action, phrase);
      const physical = result.intent?.operation ||
        result.intent?.referenceType ||
        result.intent?.referenceAction ||
        result.projection ||
        null;
      if (semantic !== null) {
        assert.equal(
          [
            result.intent?.operation,
            result.intent?.referenceType,
            result.intent?.referenceAction,
            result.projection
          ].includes(semantic),
          true,
          `${phrase}: observed ${physical}`
        );
      }
    }
  }
});

test('PT-BR and English projections preserve identical physical and authority truth', () => {
  const { createNaturalHelpProjection } = helpApi();
  const english = createNaturalHelpProjection(projectionInput({ language: 'en' }));
  const portuguese = createNaturalHelpProjection(projectionInput({ language: 'pt-BR' }));

  assert.deepEqual(
    portuguese.capabilities.map(({ id, operations }) => ({ id, operations })),
    english.capabilities.map(({ id, operations }) => ({ id, operations }))
  );
  assert.deepEqual(portuguese.executableOperations, english.executableOperations);
  assert.deepEqual(portuguese.negativeCapabilities, english.negativeCapabilities);
  assert.deepEqual(portuguese.authority, english.authority);
});

test('HelpMe projection is deeply immutable zero-authority and excludes invented executability', () => {
  const {
    createNaturalHelpProjection,
    formatNaturalHelpProjection
  } = helpApi();
  const projection = createNaturalHelpProjection(projectionInput({
    missionStatus: statusProjection(),
    missionAuthority: authorityProjection(),
    continuation: continuation()
  }));
  const output = formatNaturalHelpProjection(projection);

  assert.equal(Object.isFrozen(projection), true);
  assert.equal(Object.isFrozen(projection.capabilities), true);
  assert.equal(projection.context.mission?.objective, undefined);
  assert.equal(projection.context.mission?.lastGovernedResult, undefined);
  assert.equal(projection.context.continuation.step?.evidenceRef, undefined);
  assert.equal(projection.authority.mission?.usedAuthorityRefs, undefined);
  for (const field of [
    'operationalAuthority',
    'mutationAuthority',
    'approvalAuthority',
    'dispatchAuthority',
    'shellAuthority',
    'gitAuthority',
    'networkAuthority',
    'publicationAuthority',
    'deploymentAuthority'
  ]) {
    assert.equal(projection[field], false, field);
  }
  assert.equal(projection.providerInvoked, false);
  assert.equal(projection.presentationOnly, true);

  assert.equal(projection.executableOperations.includes('workspace.status'), true);
  assert.equal(projection.executableOperations.includes('evidence.inspect'), true);
  assert.equal(projection.executableOperations.includes('git.stage'), false);
  assert.equal(projection.executableOperations.includes('git.commit'), false);

  const negative = Object.fromEntries(
    projection.negativeCapabilities.map((item) => [item.operation, item])
  );
  assert.equal(negative['git.stage'].registered, true);
  assert.equal(negative['git.stage'].physicallyDispatched, false);
  assert.equal(negative['git.commit'].registered, true);
  assert.equal(negative['git.commit'].physicallyDispatched, false);
  for (const operation of [
    'git.push', 'git.merge', 'git.tag', 'release.create', 'npm.publish', 'deploy'
  ]) {
    assert.equal(negative[operation].executable, false, operation);
  }
  assert.match(output, /do not need to memorize commands/i);
  assert.match(
    output,
    /not executable.*git\.stage.*git\.commit.*git\.push.*deploy/i
  );
  assert.doesNotMatch(output, /git\.commit.*available|git\.push.*available/i);
});

test('current-actions help without a mission shows general truth and no implied continuation', () => {
  const {
    createNaturalHelpProjection,
    formatNaturalHelpProjection
  } = helpApi();
  const projection = createNaturalHelpProjection(projectionInput({
    request: request('CURRENT_ACTIONS')
  }));
  const output = formatNaturalHelpProjection(projection);

  assert.match(output, /What is possible now/i);
  assert.match(output, /inspect the physical project status/i);
  assert.match(output, /No active governed mission/i);
  assert.doesNotMatch(output, /eligible for the single governed step/i);
});

test('capability never becomes current authority and exact pending decisions remain unchanged', () => {
  const {
    createNaturalHelpProjection,
    formatNaturalHelpProjection
  } = helpApi();
  const missionStatus = statusProjection({
    state: 'BLOCKED',
    pendingApproval: true,
    blocker: 'Exact human authority is required.'
  });
  const missionAuthority = authorityProjection();
  const pendingDecision = freeze({
    kind: 'REPAIR',
    state: 'AUTHORITY_REQUIRED',
    proposalFingerprint: 'a'.repeat(64),
    reusableApproval: false
  });
  const before = JSON.stringify({ missionStatus, missionAuthority, pendingDecision });

  const projection = createNaturalHelpProjection(projectionInput({
    request: request('AUTHORITY_SCOPE', ['git.commit', 'git.push']),
    missionStatus,
    missionAuthority,
    continuation: continuation('AUTHORITY_REQUIRED'),
    pendingDecision
  }));
  const output = formatNaturalHelpProjection(projection);

  assert.equal(JSON.stringify({ missionStatus, missionAuthority, pendingDecision }), before);
  assert.equal(projection.context.pendingDecision.proposalFingerprint, 'a'.repeat(64));
  assert.equal(projection.context.pendingDecision.reusableApproval, false);
  assert.equal(projection.authority.commit.executable, false);
  assert.equal(projection.authority.commit.authorized, false);
  assert.equal(projection.authority.push.executable, false);
  assert.equal(projection.authority.push.authorized, false);
  assert.match(output, /does not allow commit/i);
  assert.match(output, /does not allow push/i);
  assert.match(output, /exact decision is pending/i);
});

test('contextual projection explains active blocked GREEN CANCELLED and physical RED without transitions', () => {
  const {
    createNaturalHelpProjection,
    formatNaturalHelpProjection
  } = helpApi();
  const cases = [
    {
      status: statusProjection(),
      continuation: continuation('ELIGIBLE'),
      pattern: /eligible.*evidence\.inspect/i
    },
    {
      status: statusProjection({
        state: 'BLOCKED',
        blocker: 'Physical evidence became stale.',
        nextStep: null
      }),
      continuation: continuation('STALE_STATE'),
      pattern: /blocked.*Physical evidence became stale/i
    },
    {
      status: statusProjection({ state: 'GREEN', nextStep: null }),
      continuation: continuation('NO_NEXT_STEP'),
      pattern: /GREEN.*historical/i
    },
    {
      status: statusProjection({ state: 'CANCELLED', nextStep: null }),
      continuation: continuation('NO_NEXT_STEP'),
      pattern: /CANCELLED.*terminal/i
    }
  ];

  for (const current of cases) {
    const fingerprint = current.status.missionFingerprint;
    const count = current.status.generatedFromEventCount;
    const projection = createNaturalHelpProjection(projectionInput({
      missionStatus: current.status,
      missionAuthority: authorityProjection({ state: current.status.state }),
      continuation: current.continuation
    }));
    assert.match(formatNaturalHelpProjection(projection), current.pattern);
    assert.equal(current.status.missionFingerprint, fingerprint);
    assert.equal(current.status.generatedFromEventCount, count);
  }

  const red = createNaturalHelpProjection(projectionInput({
    missionStatus: statusProjection({ state: 'REPAIRING' }),
    repair: freeze({
      state: 'READY_FOR_REPAIR',
      lastTestClassification: 'FAILED',
      stopReason: 'TEST_FAILED',
      durableRestart: false
    })
  }));
  assert.equal(red.context.repair.physicalRed, true);
  assert.doesNotMatch(JSON.stringify(red.context.mission), /"state":"RED"/);
  assert.match(formatNaturalHelpProjection(red), /FAILED.*RED/i);
});

test('R6 help distinguishes valid reconstruction from stale invalidation without restoring authority', () => {
  const {
    createNaturalHelpProjection,
    formatNaturalHelpProjection
  } = helpApi();
  const resumed = createNaturalHelpProjection(projectionInput({
    missionStatus: statusProjection(),
    missionAuthority: authorityProjection({ staleGrantsInvalidated: true }),
    continuation: continuation('ELIGIBLE', {
      processLocal: false,
      durableRestart: true
    }),
    continuity: freeze({
      classification: 'RESUMED',
      revalidationDecision: 'VALID',
      continuationEligible: true,
      authorityRevalidated: false,
      providerMemoryUsed: false,
      historicalEventCount: 4
    })
  }));
  const resumedOutput = formatNaturalHelpProjection(resumed);
  assert.match(resumedOutput, /reconstructed.*physically revalidated/i);
  assert.match(resumedOutput, /previous authority was not restored/i);
  assert.equal(resumed.context.continuity.authorityRevalidated, false);

  const stale = createNaturalHelpProjection(projectionInput({
    missionStatus: statusProjection({
      state: 'BLOCKED',
      blocker: 'Repository HEAD changed while offline.',
      nextStep: null
    }),
    missionAuthority: authorityProjection({
      state: 'BLOCKED',
      staleGrantsInvalidated: true
    }),
    continuation: continuation('STALE_STATE'),
    continuity: freeze({
      classification: 'STATE_INVALIDATED',
      revalidationDecision: 'INVALIDATED',
      continuationEligible: false,
      authorityRevalidated: false,
      providerMemoryUsed: false,
      historicalEventCount: 4
    })
  }));
  const staleOutput = formatNaturalHelpProjection(stale);
  assert.match(staleOutput, /stale|diverged|invalidated/i);
  assert.match(staleOutput, /continuation.*not executable/i);
  assert.equal(stale.context.continuation.executable, false);
});

test('provider unavailability changes no deterministic HelpMe capability or governance truth', () => {
  const { createNaturalHelpProjection } = helpApi();
  const unavailable = createNaturalHelpProjection(projectionInput({
    provider: freeze({
      state: 'UNAVAILABLE',
      available: false,
      active: false,
      operationalAuthority: false,
      mutationAuthority: false
    })
  }));
  const notConsulted = createNaturalHelpProjection(projectionInput());

  assert.deepEqual(unavailable.executableOperations, notConsulted.executableOperations);
  assert.deepEqual(
    unavailable.capabilities.map((item) => item.id),
    notConsulted.capabilities.map((item) => item.id)
  );
  assert.equal(unavailable.providerInvoked, false);
  assert.equal(unavailable.provider.available, false);
  assert.equal(unavailable.deterministicTruthAvailable, true);
});

test('production HelpMe reaches projection without provider or mission transition', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let observed = '';
  let providerCalls = 0;
  output.on('data', (chunk) => { observed += chunk.toString(); });

  createInteractiveSession(
    createInteractiveActivation(ROOT, 'NATURAL', 'en'),
    {
      input,
      output,
      terminal: false,
      cognitiveSession: freeze({
        async ask() {
          providerCalls += 1;
          return 'PROVIDER_MUST_NOT_OWN_HELP\n';
        }
      })
    }
  );

  input.end(
    'what is the state of this project?\n' +
    'help\n' +
    'what can I do now?\n' +
    'exit\n'
  );
  await waitFor(() => /Surgical session closed/.test(observed));

  assert.equal(providerCalls, 0);
  assert.doesNotMatch(observed, /PROVIDER_MUST_NOT_OWN_HELP/);
  assert.equal((observed.match(/Governed HelpMe/g) || []).length, 2);
  const fingerprints = [...observed.matchAll(/Mission fingerprint: ([a-f0-9]{64})/g)]
    .map((match) => match[1]);
  assert.equal(fingerprints.length, 2);
  assert.equal(new Set(fingerprints).size, 1);
  const eventCounts = [...observed.matchAll(/Mission evidence events: (\d+)/g)]
    .map((match) => match[1]);
  assert.equal(new Set(eventCounts).size, 1);
  assert.doesNotMatch(observed, /mutation\.applyConditional.*SUCCESS/);
});

test('help preserves a pending bounded decision and cannot consume approval-shaped text', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let observed = '';
  output.on('data', (chunk) => { observed += chunk.toString(); });

  createInteractiveSession(
    createInteractiveActivation(ROOT, 'NATURAL', 'en'),
    {
      input,
      output,
      terminal: false,
      cognitiveSession: freeze({
        async ask() {
          throw new Error('Provider cannot own deterministic help.');
        }
      })
    }
  );

  input.end(
    'list the files in this directory\n' +
    `help approve repair ${'a'.repeat(64)} commit push\n` +
    'no\n' +
    'exit\n'
  );
  await waitFor(() => /Surgical session closed/.test(observed));

  assert.match(observed, /exact decision is pending/i);
  assert.match(observed, /operation was cancelled/i);
  assert.doesNotMatch(observed, /authority.*granted/i);
  assert.doesNotMatch(observed, /operation completed.*mutation/i);
});

function repairFixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-help-r5-')));
  const repository = path.join(root, 'repository');
  fs.mkdirSync(repository);
  fs.writeFileSync(path.join(repository, 'impl.js'), "'use strict';\nmodule.exports = false;\n");
  const testSource =
    "'use strict';\n" +
    "const test = require('node:test');\n" +
    "const assert = require('node:assert/strict');\n" +
    "test('repair', () => {\n" +
    "  delete require.cache[require.resolve('./impl')];\n" +
    "  assert.equal(require('./impl'), true);\n" +
    "});\n";
  fs.writeFileSync(path.join(repository, 'repair.test.js'), testSource);
  fs.writeFileSync(path.join(repository, 'qualification.test.js'), testSource);
  for (const args of [
    ['init', '-q'],
    ['config', 'user.email', 'help@example.invalid'],
    ['config', 'user.name', 'Help Test'],
    ['add', '.'],
    ['commit', '-qm', 'help fixture']
  ]) {
    const result = spawnSync('git', args, { cwd: repository, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  return {
    root,
    repository: fs.realpathSync(repository),
    cleanup() { fs.rmSync(root, { recursive: true, force: true }); }
  };
}

test('production help cannot approve an exact pending R5 repair fingerprint', async (t) => {
  const fixture = repairFixture();
  t.after(fixture.cleanup);
  const input = new PassThrough();
  const output = new PassThrough();
  let observed = '';
  let evidenceDecision = 0;
  let helpProviderCalls = 0;
  const before = fs.readFileSync(path.join(fixture.repository, 'impl.js'), 'utf8');
  const beforeSha256 = crypto.createHash('sha256').update(before).digest('hex');
  output.on('data', (chunk) => { observed += chunk.toString(); });

  createInteractiveSession(
    createInteractiveActivation(fixture.repository, 'NATURAL', 'en'),
    {
      input,
      output,
      terminal: false,
      cognitiveSession: freeze({
        async ask() {
          helpProviderCalls += 1;
          return 'PROVIDER_HELP_AUTHORITY_FORBIDDEN\n';
        },
        async decideEvidence() {
          evidenceDecision += 1;
          return evidenceDecision === 1
            ? freeze({
                schema: 'sdo.natural_evidence_decision.v1',
                decision: 'REQUEST_EVIDENCE',
                response: null,
                evidenceRequest: freeze({
                  kind: 'READ_FILE',
                  target: 'impl.js',
                  reason: 'Bind the exact physical BEFORE evidence.'
                })
              })
            : freeze({
                schema: 'sdo.natural_evidence_decision.v1',
                decision: 'RESPOND',
                response: 'Physical evidence is sufficient.',
                evidenceRequest: null
              });
        },
        async proposePatch(objective) {
          return materializeGovernedEngineeringProposal({
            schema: 'sdo.ai_engineering_patch_proposal.v1',
            objective,
            target: 'impl.js',
            beforeSha256,
            replacementBase64: Buffer.from(
              "'use strict';\nmodule.exports = true;\n"
            ).toString('base64'),
            reason: 'Apply the bounded repair only after exact authority.',
            validationKind: 'VALIDATE_JS'
          });
        }
      })
    }
  );

  input.write(
    'repair impl.js; test repair.test.js; qualification qualification.test.js\n'
  );
  await waitFor(() => /Say "fix this"|say "fix this"/i.test(observed));
  input.write('fix this\n');
  await waitFor(() => /Proposal: [a-f0-9]{64}/.test(observed));
  const fingerprint = observed.match(/Proposal: ([a-f0-9]{64})/)?.[1];
  assert.ok(fingerprint, observed);

  input.write(`help approve repair ${fingerprint} commit push\n`);
  await waitFor(() => /Governed HelpMe/.test(observed));
  assert.equal(fs.readFileSync(path.join(fixture.repository, 'impl.js'), 'utf8'), before);
  assert.match(observed, /exact decision is pending for repair/i);
  assert.doesNotMatch(observed, /PROVIDER_HELP_AUTHORITY_FORBIDDEN/);
  assert.equal(helpProviderCalls, 0);

  input.end('deny\nexit\n');
  await waitFor(() => /Surgical session closed/.test(observed));
  assert.equal(fs.readFileSync(path.join(fixture.repository, 'impl.js'), 'utf8'), before);
  assert.match(observed, /Repair authority denied/);
  assert.doesNotMatch(observed, /Governed mission GREEN/);
});

function runNatural(repository, continuityRoot, commands) {
  return spawnSync(
    process.execPath,
    [CLI, '--interaction', 'NATURAL', '--language', 'en'],
    {
      cwd: repository,
      env: {
        ...process.env,
        SDO_NATURAL_MISSION_STATE_ROOT: continuityRoot,
        XDG_CONFIG_HOME: continuityRoot,
        LOCALAPPDATA: continuityRoot,
        APPDATA: continuityRoot
      },
      input: [...commands, 'exit', ''].join('\n'),
      encoding: 'utf8',
      timeout: 15_000,
      maxBuffer: 4 * 1024 * 1024
    }
  );
}

test('real R6 processes project resumed and invalidated HelpMe truth without replay', (t) => {
  for (const divergent of [false, true]) {
    const fixture = createHermeticGitRepository();
    const continuityRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-help-r6-'))
    );
    t.after(() => {
      fixture.cleanup();
      fs.rmSync(continuityRoot, { recursive: true, force: true });
    });

    const first = runNatural(fixture.repository, continuityRoot, [
      'what is the state of this project?'
    ]);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    if (divergent) {
      fs.writeFileSync(
        path.join(fixture.repository, 'package-lock.json'),
        '{"help":"offline-divergence"}\n'
      );
    }

    const second = runNatural(fixture.repository, continuityRoot, ['help']);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.match(second.stdout, /Durable governed mission reconstructed/);
    assert.match(second.stdout, /Governed HelpMe/);
    assert.match(second.stdout, /previous authority was not restored/i);
    if (divergent) {
      assert.match(second.stdout, /STATE_INVALIDATED|stale|diverged/i);
      assert.match(second.stdout, /continuation.*not executable/i);
      assert.doesNotMatch(second.stdout, /Governed operation completed: SUCCESS/);
    } else {
      assert.match(second.stdout, /reconstructed.*physically revalidated/i);
    }
  }
});

test('HelpMe module contains no executor provider persistence or second-parser surface', () => {
  helpApi();
  const source = fs.readFileSync(
    require.resolve('../../accelerator/cli/natural-help-projection'),
    'utf8'
  );
  assert.doesNotMatch(
    source,
    /node:fs|child_process|spawn|execSync|node:http|node:https|fetch\(|orchestrate\(|dispatchGateway|createGatewayRequest|writeFile|renameSync|materialize[A-Z]\w*\(/i
  );
  assert.doesNotMatch(source, /interpretNaturalIntent|resolveNaturalGatewayIntent|RegExp|\.match\(/);
  assert.doesNotMatch(source, /CAPABILITY_REGISTRY|SECOND_PARSER|MISSION_STATES\s*=/);
});
