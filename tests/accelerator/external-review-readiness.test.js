'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const sha = (relative) => crypto.createHash('sha256').update(read(relative), 'utf8').digest('hex');

test('ADR-025 manifest binds the public green baseline and immutable protocol bytes', () => {
  const manifest = JSON.parse(read('docs/review/QUALIFICATION_MANIFEST.json'));
  assert.equal(manifest.schema, 'sdo.external_review_qualification_manifest.v1');
  assert.equal(manifest.sourceBaseline.commit, 'a3a4e2941914f14457ed1932ea4024fc495bfff1');
  assert.equal(manifest.sourceBaseline.runId, '33110168939');
  assert.equal(manifest.sourceBaseline.conclusion, 'success');
  assert.deepEqual(manifest.sourceBaseline.platforms, [
    'ubuntu-latest', 'macos-latest', 'windows-latest'
  ]);
  assert.equal(
    manifest.localGovernedWorkspaceBaseline.commit,
    'f56750eba3aa07b0426f56021c072a280468ea98'
  );
  assert.equal(
    manifest.localGovernedWorkspaceBaseline.initialImplementationCommit,
    '2f8d9e1aa40d0d7a127e966a28e475e0f89c4bb0'
  );
  assert.equal(manifest.localGovernedWorkspaceBaseline.testsDiscovered, 1179);
  assert.equal(manifest.localGovernedWorkspaceBaseline.testsPassed, 1174);
  assert.equal(manifest.localGovernedWorkspaceBaseline.testsFailed, 0);
  assert.equal(manifest.localGovernedWorkspaceBaseline.testsSkipped, 5);
  assert.equal(
    manifest.localAgenticGatewayBaseline.naturalDefaultCheckpoint,
    '9ed86a443da18f923b60692d7446f1fd57d0a2da'
  );
  assert.equal(
    manifest.localAgenticGatewayBaseline.adrFreezeCheckpoint,
    'dee764f7ac39ba0de16be6056cc2706ad629e99f'
  );
  assert.equal(manifest.localAgenticGatewayBaseline.testsDiscovered, 1210);
  assert.equal(manifest.localAgenticGatewayBaseline.testsPassed, 1205);
  assert.equal(manifest.localAgenticGatewayBaseline.testsFailed, 0);
  assert.equal(manifest.localAgenticGatewayBaseline.testsSkipped, 5);
  assert.deepEqual(manifest.historicalSemanticRoutingCheckpoint, {
    commit: '4a901069accf4c57f3bbb2f4a46dae26cdee2561',
    testsDiscovered: 1206,
    testsPassed: 1201,
    testsFailed: 0,
    testsSkipped: 5
  });
  assert.deepEqual(manifest.manualCounterexample2Repair, {
    classification: 'latency/observability defect repair',
    startingCommit: '38904d79b61436a23b44eb2432a049415bb30795',
    measuredInputTokens: 2358,
    processedInputTokens: 2048,
    processingDurationMs: 59997,
    derivedQualifiedWorkloadLowerBoundMs: 84078,
    previousTimeoutMs: 60000,
    finalTimeoutMs: 180000,
    payloadEvidenceDuplicated: false,
    payloadSizeChanged: false,
    focusedTestsPassed: 47,
    adjacentTestsPassed: 129,
    adversarialUxTestsPassed: 124,
    canonicalTestsDiscovered: 1210,
    canonicalTestsPassed: 1205,
    canonicalTestsFailed: 0,
    canonicalTestsSkipped: 5,
    packageDryRun: 'surgical-dev-ops@2.6.0-rc.6',
    manualAcceptance: 'REQUIRES_RETEST'
  });
  assert.match(
    manifest.localAgenticGatewayBaseline.scope,
    /ADR-036[\s\S]+ADR-037/
  );
  assert.equal(manifest.protocols['BH-SEP-v2.2-sha256'], sha('protocols/BH-SEP.md'));
  assert.equal(manifest.protocols['BH-SDP-v2.2-sha256'], sha('protocols/BH-SDP.md'));
});

test('review package contains exact reproduction adversarial targets and honest non-claims', () => {
  const challenge = read('docs/review/TRY_TO_BREAK_IT.md');
  const adr = read('docs/adr/ADR-025-external-adversarial-review-reproducible-release.md');
  const evidence = read('docs/ENGINEERING_EVIDENCE.md');
  for (const required of [
    'npm ci', 'npm test', 'workspace', 'credential', 'stale evidence',
    'interrupted', 'PT-BR', 'Windows', 'not mathematical proof'
  ]) assert.match(challenge, new RegExp(required.replace(/\s+/g, '\\s+'), 'i'));
  assert.match(adr, /not an independent audit/i);
  assert.match(evidence, /has not yet been\s+completed independently/i);
  assert.doesNotMatch(challenge, /guaranteed secure|unbreakable|100% secure/i);
});

test('deep adversarial release requires attacks beyond adjacent layers', () => {
  const adr = read(
    'docs/adr/ADR-025-external-adversarial-review-reproducible-release.md'
  );
  const challenge = read(
    'docs/review/TRY_TO_BREAK_IT.md'
  );

  assert.match(
    adr,
    /SHALL NOT be limited to adjacent layers/i
  );
  assert.match(
    adr,
    /internal\s+deterministic core directly/i
  );
  assert.match(
    challenge,
    /Black-box and boundary-only testing are insufficient/i
  );

  for (const required of [
    'white-box',
    'fault injection',
    'mutation testing',
    'structured fuzzing',
    'property-based',
    'concurrency',
    'multiprocess',
    'crash/restart',
    'direct artifact tampering',
    'lifecycle',
    'fingerprint',
    'Manifest CAS',
    'journal',
    'durability',
    'recovery',
    'authoritative time',
    'finalized replay',
    'false success',
    'unauthorized mutation',
    'atomicity loss',
    'logical/physical divergence'
  ]) {
    assert.match(
      challenge,
      new RegExp(
        required.replace(/\s+/g, '\\s+'),
        'i'
      )
    );
  }

  assert.match(
    challenge,
    /Linux, macOS and Windows/i
  );
  assert.match(
    challenge,
    /provider-reported `APPLIED` become success without canonical evidence/i
  );
  assert.doesNotMatch(
    challenge,
    /black-box review is sufficient|adjacent layers are sufficient/i
  );
});

test('public framing is narrow falsifiable and counterexample driven', () => {
  const challenge = read(
    'docs/review/TRY_TO_BREAK_IT.md'
  );

  for (const required of [
    'one narrow, falsifiable claim',
    'untrusted cognitive output',
    'has no operational authority',
    'exact human-authorized evidence',
    'Do not trust the test count',
    'attack the internal implementation directly',
    'smallest reproducible counterexample',
    'A reproducible bypass is a valuable result',
    'turn the affected qualification red',
    'permanent regression test'
  ]) {
    assert.match(
      challenge,
      new RegExp(
        required.replace(/\s+/g, '\\s+'),
        'i'
      )
    );
  }

  assert.doesNotMatch(
    challenge,
    /proven secure|guaranteed secure|unbreakable|mathematically proven|100% secure/i
  );
});

test('public playbook provides safe progressive adversarial review', () => {
  const challenge = read(
    'docs/review/TRY_TO_BREAK_IT.md'
  );
  const playbook = read(
    'docs/review/ADVERSARIAL_PLAYBOOK.md'
  );

  assert.match(
    challenge,
    /\[adversarial review playbook\]\(\.\/ADVERSARIAL_PLAYBOOK\.md\)/i
  );

  for (const required of [
    'Five-minute quick start',
    'Safe laboratory rules',
    'Level 1 — Quick boundary probes',
    'Level 2 — Deep deterministic core',
    'Level 3 — Native platform and failure injection',
    'Property-to-attack matrix',
    'Safe directed demonstrations',
    'What constitutes a valid bypass',
    'Severity guide',
    'Minimal report contract',
    'Responsible handling',
    'disposable checkout',
    'zero-mutation',
    'Critical',
    'High',
    'Medium',
    'Low'
  ]) {
    assert.match(
      playbook,
      new RegExp(
        required.replace(/\s+/g, '\\s+'),
        'i'
      )
    );
  }

  assert.match(
    playbook,
    /node --test[\s\S]+--test-name-pattern/
  );

  assert.doesNotMatch(
    playbook,
    /sudo |guaranteed secure|100% secure/i
  );
});


test('English and Portuguese adversarial packages preserve semantic parity', () => {
  const englishChallenge = read(
    'docs/review/TRY_TO_BREAK_IT.md'
  );
  const portugueseChallenge = read(
    'docs/review/TRY_TO_BREAK_IT_PT-BR.md'
  );
  const englishPlaybook = read(
    'docs/review/ADVERSARIAL_PLAYBOOK.md'
  );
  const portuguesePlaybook = read(
    'docs/review/ADVERSARIAL_PLAYBOOK_PT-BR.md'
  );
  const form = read(
    '.github/ISSUE_TEMPLATE/adversarial-report.yml'
  );

  assert.match(
    englishChallenge,
    /\[TRY_TO_BREAK_IT_PT-BR\.md\]\(\.\/TRY_TO_BREAK_IT_PT-BR\.md\)/
  );
  assert.match(
    portugueseChallenge,
    /\[TRY_TO_BREAK_IT\.md\]\(\.\/TRY_TO_BREAK_IT\.md\)/
  );
  assert.match(
    englishPlaybook,
    /\[ADVERSARIAL_PLAYBOOK_PT-BR\.md\]\(\.\/ADVERSARIAL_PLAYBOOK_PT-BR\.md\)/
  );
  assert.match(
    portuguesePlaybook,
    /\[ADVERSARIAL_PLAYBOOK\.md\]\(\.\/ADVERSARIAL_PLAYBOOK\.md\)/
  );

  const reproductionPattern =
    /^(?:npm ci|npm test|node examples\/governed-engineering-loop-demo\.js|npm pack --dry-run)$/gm;

  assert.deepEqual(
    portugueseChallenge.match(reproductionPattern),
    englishChallenge.match(reproductionPattern)
  );

  const directedCommands = (document) =>
    [...document.matchAll(/```bash\s*([\s\S]*?)```/g)]
      .map((match) =>
        match[1]
          .replace(/\\\r?\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      )
      .filter((command) =>
        command.startsWith('node --test ')
      );

  assert.deepEqual(
    directedCommands(portuguesePlaybook),
    directedCommands(englishPlaybook)
  );

  for (const required of [
    [englishChallenge, 'one narrow, falsifiable claim'],
    [portugueseChallenge, 'afirmação estreita e falsificável'],
    [englishChallenge, 'Mandatory deep white-box campaign'],
    [portugueseChallenge, 'Campanha white-box profunda obrigatória'],
    [englishChallenge, 'Manifest CAS'],
    [portugueseChallenge, 'Manifest CAS'],
    [englishChallenge, 'Linux, macOS and Windows'],
    [portugueseChallenge, 'Linux, macOS e Windows'],
    [englishPlaybook, 'Five-minute quick start'],
    [portuguesePlaybook, 'Acesso rápido em cinco minutos'],
    [englishPlaybook, 'Level 1 — Quick boundary probes'],
    [portuguesePlaybook, 'Nível 1 — Sondagens rápidas de fronteira'],
    [englishPlaybook, 'Level 2 — Deep deterministic core'],
    [portuguesePlaybook, 'Nível 2 — Núcleo determinístico profundo'],
    [englishPlaybook, 'Level 3 — Native platform and failure injection'],
    [portuguesePlaybook, 'Nível 3 — Plataforma nativa e injeção de falhas'],
    [englishPlaybook, 'Critical'],
    [portuguesePlaybook, 'Crítica / Critical'],
    [englishPlaybook, 'High'],
    [portuguesePlaybook, 'Alta / High'],
    [englishPlaybook, 'Medium'],
    [portuguesePlaybook, 'Média / Medium'],
    [englishPlaybook, 'Low'],
    [portuguesePlaybook, 'Baixa / Low']
  ]) {
    assert.match(
      required[0],
      new RegExp(
        required[1].replace(/\s+/g, '\\s+'),
        'i'
      )
    );
  }

  for (const required of [
    'Adversarial boundary report / Relatório adversarial da fronteira',
    'Baseline commit / Commit do baseline',
    'Minimal reproduction / Reprodução mínima',
    'Expected deterministic boundary / Fronteira determinística esperada',
    'Observed result / Resultado observado',
    'Impact class / Classe de impacto',
    'Proposed severity / Severidade proposta',
    'Critical / Crítica',
    'High / Alta',
    'Medium / Média',
    'Low / Baixa',
    'Safety confirmation / Confirmação de segurança'
  ]) {
    assert.match(
      form,
      new RegExp(
        required.replace(/\s+/g, '\\s+'),
        'i'
      )
    );
  }

  assert.doesNotMatch(
    englishChallenge + englishPlaybook,
    /guaranteed secure|unbreakable|100% secure/i
  );
  assert.doesNotMatch(
    portugueseChallenge + portuguesePlaybook,
    /segurança garantida|inquebrável|100% seguro/i
  );
});

test('public adversarial report form requires reproducibility impact and secret hygiene', () => {
  const form = read('.github/ISSUE_TEMPLATE/adversarial-report.yml');
  for (const required of [
    'Baseline commit', 'Platform', 'Runtime', 'Minimal reproduction',
    'Expected deterministic boundary', 'Observed result', 'Impact class',
    'Proposed severity', 'Critical', 'High', 'Medium', 'Low',
    'private keys', 'production secrets'
  ]) assert.match(form, new RegExp(required.replace(/\s+/g, '\\s+'), 'i'));
  assert.doesNotMatch(form, /password:|token:|api[_-]?key:/i);
});

test('review manifest reproduction commands are fixed and non-destructive', () => {
  const manifest = JSON.parse(read('docs/review/QUALIFICATION_MANIFEST.json'));
  assert.deepEqual(manifest.reproduction, [
    'npm ci',
    'npm test',
    'node examples/governed-engineering-loop-demo.js',
    'npm pack --dry-run'
  ]);
  assert.deepEqual(manifest.claims, {
    absoluteSecurity: false,
    independentAuditCompleted: false,
    powerLossValidated: false,
    modelDeterministic: false,
    externalReviewInvited: true
  });
});
