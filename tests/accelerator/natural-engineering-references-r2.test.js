'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { spawn, spawnSync } = require('node:child_process');

const {
  createDeterministicWorkspaceSession,
  revalidateDeterministicWorkspaceSession
} = require('../../accelerator/adapters/deterministic-workspace-session-adapter');
const {
  createNaturalAgenticMission
} = require('../../accelerator/core/natural-agentic-mission');
const {
  createGatewayRequest,
  dispatchGatewayRequest
} = require('../../accelerator/core/integrated-governed-agent-gateway');
const {
  createNaturalEngineeringReferent,
  createNaturalEngineeringReferenceContext,
  recordNaturalEngineeringGatewayResult,
  resolveNaturalEngineeringReference,
  projectNaturalEngineeringReferenceContext
} = require('../../accelerator/core/natural-engineering-reference-context');
const {
  createNaturalSessionControl,
  resolveNaturalEngineeringReferenceIntent
} = require('../../accelerator/cli/natural-session-control');
const {
  createHermeticGitRepository
} = require('./helpers/hermetic-git-repository');

const CLI = require.resolve('../../accelerator/cli/surgical');
const NOW = '2099-01-01T00:00:00.000Z';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function missionFor(repository) {
  const session = createDeterministicWorkspaceSession({
    authorizedRoot: repository,
    humanSubject: 'r2-test-human',
    authorizedAt: NOW
  });
  return createNaturalAgenticMission({
    missionId: `r2-${session.sessionFingerprint.slice(0, 32)}`,
    objective: 'Inspect recent governed engineering state.',
    session,
    createdAt: NOW,
    plan: [{
      stepId: 'inspect-diff',
      summary: 'Inspect the governed workspace diff.',
      status: 'COMPLETED'
    }],
    authority: {
      allowedCapabilities: [
        'workspace.status',
        'workspace.diff',
        'evidence.inspect'
      ]
    }
  });
}

function processEnvironment(repository) {
  const stateRoot = path.dirname(repository);
  return {
    ...process.env,
    XDG_CONFIG_HOME: stateRoot,
    LOCALAPPDATA: stateRoot,
    APPDATA: stateRoot
  };
}

function runNatural(repository, lines, language = 'pt-BR') {
  return spawnSync(
    process.execPath,
    [CLI, '--interaction', 'NATURAL', '--language', language],
    {
      cwd: repository,
      env: processEnvironment(repository),
      input: [...lines, ''].join('\n'),
      encoding: 'utf8',
      timeout: 15_000,
      maxBuffer: 4 * 1024 * 1024
    }
  );
}

function waitForOutput(read, pattern, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const inspect = () => {
      if (pattern.test(read())) return resolve();
      if (Date.now() - started >= timeoutMs) {
        return reject(new Error(`Timed out waiting for ${pattern}.\n${read()}`));
      }
      setTimeout(inspect, 10);
    };
    inspect();
  });
}

test('typed engineering referents are bounded immutable mission projections', () => {
  const fixture = createHermeticGitRepository();
  try {
    const mission = missionFor(fixture.repository);
    const referent = createNaturalEngineeringReferent({
      mission,
      type: 'LAST_EVIDENCE',
      operation: 'workspace.diff',
      evidenceDigest: 'a'.repeat(64),
      resultFingerprint: 'b'.repeat(64),
      resultClassification: 'SUCCESS',
      createdAt: NOW,
      sequence: 1
    });

    assert.equal(referent.type, 'LAST_EVIDENCE');
    assert.equal(referent.missionId, mission.missionId);
    assert.equal(referent.binding.repositoryHead, mission.binding.repositoryHead);
    assert.equal(Object.isFrozen(referent), true);
    assert.equal(referent.persistent, false);
    assert.equal(referent.operationalAuthority, false);
    assert.equal(referent.mutationAuthority, false);
    assert.equal('content' in referent, false);

    assert.throws(() => createNaturalEngineeringReferent({
      mission,
      type: 'PROVIDER_GUESS',
      operation: 'workspace.diff',
      evidenceDigest: 'a'.repeat(64),
      resultFingerprint: 'b'.repeat(64),
      resultClassification: 'SUCCESS',
      createdAt: NOW,
      sequence: 1
    }), /reference type/i);

    assert.throws(() => createNaturalEngineeringReferent({
      mission,
      type: 'LAST_EVIDENCE',
      operation: 'workspace.diff',
      evidenceDigest: 'not-a-digest',
      resultFingerprint: 'b'.repeat(64),
      resultClassification: 'SUCCESS',
      createdAt: NOW,
      sequence: 1
    }), /digest|SHA-256/i);

    assert.throws(() => createNaturalEngineeringReferent({
      mission,
      type: 'LAST_EVIDENCE',
      operation: 'workspace.diff',
      evidenceDigest: 'a'.repeat(64),
      resultFingerprint: 'b'.repeat(64),
      resultClassification: 'SUCCESS',
      createdAt: NOW,
      sequence: 1,
      providerProse: 'The model thinks this is probably package.json.'
    }), /unexpected|provider|field/i);
  } finally {
    fixture.cleanup();
  }
});

test('reference context records only structured gateway results and revalidates physical state', () => {
  const fixture = createHermeticGitRepository();
  try {
    const mission = missionFor(fixture.repository);
    const empty = createNaturalEngineeringReferenceContext({
      mission,
      createdAt: NOW
    });
    const dispatch = dispatchGatewayRequest({
      mission,
      request: createGatewayRequest({
        requestId: 'r2-unit-diff',
        mission,
        operation: 'workspace.diff',
        args: {},
        requestedAt: NOW
      }),
      options: { now: () => NOW }
    });
    const context = recordNaturalEngineeringGatewayResult(empty, {
      mission: dispatch.mission,
      gatewayOperation: 'workspace.diff',
      sourceOperation: 'workspace.diff',
      result: dispatch.result,
      createdAt: NOW
    });
    const projection = projectNaturalEngineeringReferenceContext(context);

    assert.deepEqual(projection.types, [
      'CURRENT_DIFF',
      'LAST_EVIDENCE',
      'LAST_OPERATION'
    ]);
    assert.equal(projection.persistent, false);
    assert.equal(projection.operationalAuthority, false);

    const resolution = resolveNaturalEngineeringReference({
      context,
      mission: dispatch.mission,
      requestedType: 'LAST_EVIDENCE',
      revalidation: revalidateDeterministicWorkspaceSession(mission.session)
    });
    assert.equal(resolution.classification, 'RESOLVED');
    assert.equal(resolution.reference.type, 'LAST_EVIDENCE');
    assert.equal(resolution.physicalState, 'VALID');

    assert.throws(() => recordNaturalEngineeringGatewayResult(empty, {
      mission: dispatch.mission,
      gatewayOperation: 'workspace.diff',
      sourceOperation: 'workspace.diff',
      result: freeze({
        ...dispatch.result,
        evidenceDigest: 'malformed'
      }),
      createdAt: NOW
    }), /digest|integrity|SHA-256/i);
  } finally {
    fixture.cleanup();
  }
});

test('PT-BR and English semantic references produce the same bounded concepts', () => {
  const cases = [
    [['mostre a última evidência', 'show the last evidence'], 'LAST_EVIDENCE', 'INSPECT_EVIDENCE'],
    [['e as mudanças?', 'what about those changes?'], 'CURRENT_DIFF', 'REPEAT_OPERATION'],
    [['e o último resultado?', 'what was the last result?'], 'LAST_OPERATION', 'INSPECT_EVIDENCE'],
    [['mostre novamente', 'show it again'], 'LAST_OPERATION', 'REPEAT_OPERATION'],
    [['qual foi o último teste?', 'what was the last test?'], 'LAST_TEST', 'INSPECT_EVIDENCE'],
    [['qual é a etapa atual?', 'what is the current step?'], 'CURRENT_PLAN_STEP', 'PROJECT_REFERENCE'],
    [['mostre isso', 'show that'], 'DEICTIC', 'INSPECT_EVIDENCE']
  ];

  for (const [phrases, referenceType, referenceAction] of cases) {
    for (const phrase of phrases) {
      const result = createNaturalSessionControl({
        workspace: 'surgical-dev-ops',
        language: phrase === phrases[1] ? 'en' : 'pt-BR'
      }).handle(phrase);
      assert.equal(result.matched, true, phrase);
      assert.equal(result.intent.referenceType, referenceType, phrase);
      assert.equal(result.intent.referenceAction, referenceAction, phrase);
      assert.equal(result.intent.authorityExpansion, false, phrase);
    }
  }

  for (const phrase of ['corrija isso', 'fix that']) {
    const result = createNaturalSessionControl({ language: phrase === 'fix that' ? 'en' : 'pt-BR' }).handle(phrase);
    assert.equal(result.action, 'REFERENCE_REQUEST');
    assert.equal(result.intent.referenceType, 'DEICTIC');
    assert.equal(result.intent.referenceAction, 'REQUEST_MUTATION');
    assert.equal(result.intent.mutationAuthority, false);
  }
});

test('weak deictics remain references while explicit engineering objects retain semantic ownership', () => {
  for (const phrase of [
    'explain this',
    'what about this?',
    'mostre isso'
  ]) {
    assert.equal(
      resolveNaturalEngineeringReferenceIntent(phrase).referenceType,
      'DEICTIC',
      phrase
    );
  }

  for (const phrase of [
    'explain this project',
    'explain this architecture',
    'explique este projeto',
    'explique esse arquivo'
  ]) {
    assert.equal(
      resolveNaturalEngineeringReferenceIntent(phrase),
      null,
      phrase
    );
  }
});

test('production conversation resolves evidence and current diff but refuses an ambiguous weak referent', () => {
  const fixture = createHermeticGitRepository();
  try {
    fs.writeFileSync(
      path.join(fixture.repository, 'package-lock.json'),
      '{"r2":true}\n',
      'utf8'
    );
    const outcome = runNatural(fixture.repository, [
      'quais arquivos mudaram?',
      'mostre a evidência',
      'e as mudanças?',
      'mostre isso',
      '/status',
      'exit'
    ]);

    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal((outcome.stdout.match(/Operação governada iniciada: workspace\.diff/g) || []).length, 2);
    assert.equal((outcome.stdout.match(/Operação governada iniciada: evidence\.inspect/g) || []).length, 1);
    assert.match(outcome.stdout, /Bytes do diff governado: [1-9][0-9]*/);
    assert.match(outcome.stdout, /Referência governada resolvida: LAST_EVIDENCE/);
    assert.match(outcome.stdout, /Referência governada resolvida: CURRENT_DIFF/);
    assert.match(outcome.stdout, /Referência: AMBIGUOUS_REFERENT/);
    assert.match(outcome.stdout, /Candidatos: .*CURRENT_DIFF.*LAST_EVIDENCE|Candidatos: .*LAST_EVIDENCE.*CURRENT_DIFF/);
    assert.match(outcome.stdout, /Referências delimitadas: CURRENT_DIFF, LAST_EVIDENCE, LAST_OPERATION/);
    assert.doesNotMatch(outcome.stdout, /Processando com o provider cognitivo local/);
  } finally {
    fixture.cleanup();
  }
});

test('fresh production session distinguishes absent and unsupported referents', () => {
  const fixture = createHermeticGitRepository();
  try {
    const outcome = runNatural(fixture.repository, [
      'mostre a última evidência',
      'qual foi a última recomendação?',
      'exit'
    ]);

    assert.equal(outcome.status, 0, outcome.stderr);
    assert.match(outcome.stdout, /Referência: NO_REFERENT/);
    assert.match(outcome.stdout, /Referência: UNSUPPORTED_REFERENT/);
    assert.doesNotMatch(outcome.stdout, /Operação governada iniciada/);
  } finally {
    fixture.cleanup();
  }
});

test('production reference becomes stale after the physical worktree changes', async () => {
  const fixture = createHermeticGitRepository();
  const child = spawn(
    process.execPath,
    [CLI, '--interaction', 'NATURAL', '--language', 'pt-BR'],
    {
      cwd: fixture.repository,
      env: processEnvironment(fixture.repository),
      stdio: ['pipe', 'pipe', 'pipe']
    }
  );
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  try {
    child.stdin.write('quais arquivos mudaram?\n');
    await waitForOutput(() => stdout, /Resultado: SUCCESS/);

    fs.writeFileSync(
      path.join(fixture.repository, 'package-lock.json'),
      '{"physical":"changed"}\n',
      'utf8'
    );

    child.stdin.end('mostre novamente\nexit\n');
    const [code] = await once(child, 'close');

    assert.equal(code, 0, stderr);
    assert.match(stdout, /Referência: STALE_REFERENT/);
    assert.match(stdout, /estado físico mudou|physical state changed/i);
    assert.equal((stdout.match(/Operação governada iniciada/g) || []).length, 1);
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM');
    fixture.cleanup();
  }
});

test('resolved conversational target does not authorize mutation or depend on a provider', () => {
  const fixture = createHermeticGitRepository();
  try {
    const before = fs.readFileSync(
      path.join(fixture.repository, 'package-lock.json'),
      'utf8'
    );
    const outcome = runNatural(fixture.repository, [
      'quais arquivos mudaram?',
      'corrija isso',
      'exit'
    ]);

    assert.equal(outcome.status, 0, outcome.stderr);
    assert.match(outcome.stdout, /Referência governada resolvida:/);
    assert.match(outcome.stdout, /HUMAN_AUTHORITY_REQUIRED/);
    assert.match(outcome.stdout, /resolver a referência não autorizou mutação/i);
    assert.doesNotMatch(outcome.stdout, /mutation\.applyConditional/);
    assert.doesNotMatch(outcome.stdout, /Processando com o provider cognitivo local/);
    assert.equal(
      fs.readFileSync(path.join(fixture.repository, 'package-lock.json'), 'utf8'),
      before
    );
  } finally {
    fixture.cleanup();
  }
});
