'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const {
  createNaturalDevelopmentEndToEndBoundary
} = require(
  '../../accelerator/cli/natural-development-end-to-end'
);
const {
  prepareInteractiveNaturalDevelopment
} = require('../../accelerator/cli/natural-development-interactive');
const {
  materializeGovernedEngineeringProposal
} = require('../../accelerator/core/governed-engineering-proposal');

function frozen(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') frozen(child);
  }
  return Object.freeze(value);
}

test('canonical application boundary preserves exact G3 G4 G5 G10 G6 order', async () => {
  const calls = [];
  const contract = frozen({ contractFingerprint: 'contract' });
  const planningResult = frozen({ planningFingerprint: 'planning' });
  const governedProposal = frozen({ schema: 'proposal-input' });
  const patchProposal = frozen({
    proposalFingerprint: 'proposal', target: 'example.js',
    beforeSha256: 'a'.repeat(64), replacementSha256: 'b'.repeat(64),
    patchAttempt: 1
  });
  const patchAuthorization = frozen({ authorizationFingerprint: 'authorization' });
  const r3Composition = frozen({
    compositionFingerprint: 'composition', transactionId: 'transaction',
    journalId: 'journal', afterManifestOid: 'manifest'
  });
  const validation = frozen({ status: 'VALIDATED', validationFingerprint: 'validation' });

  const boundary = createNaturalDevelopmentEndToEndBoundary({
    materializeProposal(input) {
      calls.push('G3_PROPOSAL');
      assert.equal(input.contract, contract);
      assert.equal(input.planningResult, planningResult);
      assert.equal(input.governedProposal, governedProposal);
      return patchProposal;
    },
    materializeAuthorization(input) {
      calls.push('G4_AUTHORIZATION');
      assert.equal(input.patchProposal, patchProposal);
      return patchAuthorization;
    },
    dispatchPatch(input) {
      calls.push('G5_G9_G10_DISPATCH');
      assert.equal(input.patchAuthorization, patchAuthorization);
      return r3Composition;
    },
    validatePatch(input) {
      calls.push('G6_VALIDATION');
      assert.equal(input.r3Composition, r3Composition);
      return validation;
    }
  });

  const result = await boundary.execute({
    contract, planningResult, governedProposal,
    humanDecision: frozen({}), verifiedHumanIdentityAssertion: frozen({}),
    temporalAuthority: frozen({}), physicalWorkspaceIdentity: 'workspace',
    repositoryPath: '/repository', authorityRoot: '/authority',
    journalStorageRoot: '/journal'
  });

  assert.deepEqual(calls, [
    'G3_PROPOSAL', 'G4_AUTHORIZATION',
    'G5_G9_G10_DISPATCH', 'G6_VALIDATION'
  ]);
  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.reusableApproval, false);
  assert.equal(result.operationalAuthority, false);
  assert.equal(Object.isFrozen(result), true);
});

test('failed stage stops composition and cannot fall through to dispatch', async () => {
  const calls = [];
  const boundary = createNaturalDevelopmentEndToEndBoundary({
    materializeProposal() { calls.push('G3'); return frozen({}); },
    materializeAuthorization() {
      calls.push('G4');
      throw new Error('exact human authority denied');
    },
    dispatchPatch() { calls.push('DISPATCH'); },
    validatePatch() { calls.push('VALIDATE'); }
  });

  await assert.rejects(
    boundary.execute({ contract: {}, planningResult: {}, governedProposal: {} }),
    /exact human authority denied/
  );
  assert.deepEqual(calls, ['G3', 'G4']);
});

test('end-to-end boundary exports no generic process shell network or credential surface', () => {
  const source = fs.readFileSync(
    require.resolve('../../accelerator/cli/natural-development-end-to-end'),
    'utf8'
  );
  const api = require('../../accelerator/cli/natural-development-end-to-end');

  assert.deepEqual(Object.keys(api).sort(), [
    'RESULT_SCHEMA', 'createNaturalDevelopmentEndToEndBoundary'
  ]);
  assert.doesNotMatch(source, /child_process|execFile|spawn|fetch\(|https?:|apiKey|token/);
});

test('ADR-032 preserves equivalent English and Portuguese interactive closure', () => {
  const english = fs.readFileSync(
    require.resolve('../../docs/adr/ADR-032-natural-interactive-development-closure.md'),
    'utf8'
  );
  const portuguese = fs.readFileSync(
    require.resolve('../../docs/adr/ADR-032-natural-interactive-development-closure_PT-BR.md'),
    'utf8'
  );

  for (const marker of [
    'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G9', 'G10',
    'Ed25519', 'VALIDATE_JS', 'approve patch', 'aprovar patch'
  ]) {
    assert.equal(
      english.includes(marker) || portuguese.includes(marker),
      true,
      `missing bilingual closure marker: ${marker}`
    );
  }
  assert.match(english, /single-use.*anti-replayed/is);
  assert.match(portuguese, /uso único.*replay/is);
});

test('interactive request becomes an exact immutable proposal before authority', async () => {
  const repository = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-interactive-g1-'));
  fs.writeFileSync(path.join(repository, 'example.js'), "'use strict';\nmodule.exports = 1;\n");
  for (const arguments_ of [
    ['init', '-q'], ['config', 'user.email', 'test@example.invalid'],
    ['config', 'user.name', 'Test'], ['add', 'example.js'], ['commit', '-qm', 'fixture']
  ]) execFileSync('git', arguments_, { cwd: repository });

  const before = fs.readFileSync(path.join(repository, 'example.js'));
  const beforeSha256 = require('node:crypto').createHash('sha256').update(before).digest('hex');
  let decisions = 0;
  const cognitiveSession = Object.freeze({
    async decideEvidence() {
      decisions += 1;
      return decisions === 1
        ? Object.freeze({
            schema: 'sdo.natural_evidence_decision.v1',
            decision: 'REQUEST_EVIDENCE', response: null,
            evidenceRequest: Object.freeze({ kind: 'READ_FILE', target: 'example.js', reason: 'Bind BEFORE.' })
          })
        : Object.freeze({
            schema: 'sdo.natural_evidence_decision.v1',
            decision: 'RESPOND', response: 'Exact evidence is sufficient.', evidenceRequest: null
          });
    },
    async proposePatch(objective) {
      return materializeGovernedEngineeringProposal({
        schema: 'sdo.ai_engineering_patch_proposal.v1', objective,
        target: 'example.js', beforeSha256,
        replacementBase64: Buffer.from("'use strict';\nmodule.exports = 2;\n").toString('base64'),
        reason: 'Apply the bounded requested change.', validationKind: 'VALIDATE_JS'
      });
    }
  });
  const activation = Object.freeze({
    workspace: 'fixture', repositoryPath: repository,
    interactionMode: Object.freeze({ mode: 'NATURAL' })
  });
  const pending = await prepareInteractiveNaturalDevelopment({
    request: Object.freeze({ objective: 'change example.js to version 2', target: 'example.js' }),
    activation, cognitiveSession,
    dispatchEvidence(intent) {
      assert.equal(intent.target, 'example.js');
      return {
        orchestration: { status: 'COMPLETED' },
        execution: {
          schema: 'sdo.filesystem_read_result.v1',
          target: { requested: 'example.js' },
          evidence: { bytes: before.length, sha256: beforeSha256, content: before.toString('utf8') }
        }
      };
    }
  });

  assert.equal(pending.state, 'EXACT_HUMAN_REVIEW_REQUIRED');
  assert.equal(pending.patchProposal.target, 'example.js');
  assert.equal(pending.operationalAuthority, false);
  assert.equal(Object.isFrozen(pending), true);
  assert.equal(fs.readFileSync(path.join(repository, 'example.js'), 'utf8'), before.toString('utf8'));
});
