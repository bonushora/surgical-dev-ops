'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { PassThrough } = require('node:stream');
const test = require('node:test');

const {
  createInteractiveActivation,
  createInteractiveSession
} = require('../../accelerator/cli/surgical');
const {
  materializeGovernedEngineeringProposal
} = require('../../accelerator/core/governed-engineering-proposal');
const {
  provisionLocalOfflineHumanAuthority
} = require('../../accelerator/core/local-offline-human-authority-store');
const {
  prepareNaturalCustomerDevelopment,
  approveNaturalCustomerDevelopment
} = require('../../accelerator/cli/natural-customer-development');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createFailingCalculatorRepository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-natural-customer-red-'));
  const repository = path.join(root, 'repository');
  fs.mkdirSync(repository);
  fs.writeFileSync(path.join(repository, 'package.json'), JSON.stringify({
    scripts: { test: 'node calculator.test.js' }
  }, null, 2) + '\n');
  fs.writeFileSync(
    path.join(repository, 'calculator.js'),
    'function add(a, b) {\n  return a - b;\n}\n\nmodule.exports = { add };\n'
  );
  fs.writeFileSync(
    path.join(repository, 'calculator.test.js'),
    "const assert = require('node:assert/strict');\n" +
      "const { add } = require('./calculator');\n\n" +
      'assert.equal(add(2, 3), 5);\n'
  );
  for (const args of [
    ['init', '-q'],
    ['config', 'user.email', 'customer@example.invalid'],
    ['config', 'user.name', 'Customer Fixture'],
    ['add', '.'],
    ['commit', '-qm', 'failing calculator fixture']
  ]) execFileSync('git', args, { cwd: repository });

  const npmCli = process.env.npm_execpath;
  const npmExecutable = npmCli
    ? process.execPath
    : process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const npmArguments = npmCli ? [npmCli, 'test'] : ['test'];
  const failing = spawnSync(npmExecutable, npmArguments, {
    cwd: repository,
    encoding: 'utf8',
    timeout: 10_000,
    shell: !npmCli && process.platform === 'win32'
  });
  assert.equal(failing.error, undefined);
  assert.notEqual(failing.status, 0);
  assert.match((failing.stderr || '') + (failing.stdout || ''), /-1[\s\S]*5|actual: -1[\s\S]*expected: 5/);

  return {
    root,
    repository: fs.realpathSync(repository),
    cleanup() { fs.rmSync(root, { recursive: true, force: true }); }
  };
}

function proposalSession(before, replacement = null) {
  let context = '';
  const session = Object.freeze({
    async ask() {
      return 'I cannot execute tests or changes.';
    },
    async proposePatch(objective, _activation, suppliedContext) {
      context = suppliedContext;
      return materializeGovernedEngineeringProposal({
        schema: 'sdo.ai_engineering_patch_proposal.v1',
        objective,
        target: 'calculator.js',
        beforeSha256: sha256(before),
        replacementBase64: Buffer.from(replacement ||
          'function add(a, b) {\n  return a + b;\n}\n\nmodule.exports = { add };\n'
        ).toString('base64'),
        reason: 'Correct the evidence-bound arithmetic defect.',
        validationKind: 'VALIDATE_JS'
      });
    }
  });
  return { session, context: () => context };
}

async function waitFor(predicate, timeoutMs = 3000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for NATURAL workflow.');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

test('ordinary Portuguese repair objective enters governed workflow and gathers its own failing-test evidence', async (t) => {
  const fixture = createFailingCalculatorRepository();
  t.after(fixture.cleanup);
  const before = fs.readFileSync(path.join(fixture.repository, 'calculator.js'));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: fixture.repository,
    encoding: 'utf8'
  }).trim();
  const input = new PassThrough();
  const output = new PassThrough();
  let observed = '';
  let freeformCalls = 0;
  let evidenceCalls = 0;
  let proposalContext = '';
  let developmentFailure = null;
  output.on('data', (chunk) => { observed += chunk.toString(); });

  const cognitiveSession = Object.freeze({
    async ask() {
      freeformCalls += 1;
      return 'Não posso executar alterações ou testes diretamente.\n';
    },
    async decideEvidence(_objective, _activation, history) {
      evidenceCalls += 1;
      const serialized = JSON.stringify(history);
      if (!serialized.includes('calculator.js')) {
        return Object.freeze({
          schema: 'sdo.natural_evidence_decision.v1',
          decision: 'REQUEST_EVIDENCE',
          response: null,
          evidenceRequest: Object.freeze({
            kind: 'READ_FILE', target: 'calculator.js', reason: 'Observe the bounded implementation BEFORE.'
          })
        });
      }
      return Object.freeze({
        schema: 'sdo.natural_evidence_decision.v1',
        decision: 'RESPOND', response: 'The bounded evidence identifies the defect.', evidenceRequest: null
      });
    },
    async proposePatch(objective, _activation, context) {
      proposalContext = context;
      return materializeGovernedEngineeringProposal({
        schema: 'sdo.ai_engineering_patch_proposal.v1',
        objective,
        target: 'calculator.js',
        beforeSha256: sha256(before),
        replacementBase64: Buffer.from(
          'function add(a, b) {\n  return a + b;\n}\n\nmodule.exports = { add };\n'
        ).toString('base64'),
        reason: 'Correct the evidence-bound arithmetic defect.',
        validationKind: 'VALIDATE_JS'
      });
    }
  });

  createInteractiveSession(
    createInteractiveActivation(fixture.repository, 'NATURAL', 'pt-BR'),
    {
      input, output, terminal: false, cognitiveSession,
      onDevelopmentFailure(value) { developmentFailure = value; }
    }
  );
  input.write('Corrija os testes que estão falhando.\n');

  await waitFor(() => /Proposal: [a-f0-9]{64}/.test(observed)).catch((error) => {
    error.message += `\n${observed}\n${JSON.stringify(developmentFailure)}`;
    throw error;
  });
  assert.equal(freeformCalls, 0, observed);
  assert.equal(evidenceCalls, 0, observed);
  assert.match(proposalContext, /calculator\.test\.js/);
  assert.match(proposalContext, /actual|ERR_ASSERTION|-1/i);
  assert.match(observed, /Nenhuma alteração foi executada/);
  assert.equal(fs.readFileSync(path.join(fixture.repository, 'calculator.js'), 'utf8'), before.toString());
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fixture.repository, encoding: 'utf8' }).trim(), head);
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: fixture.repository, encoding: 'utf8' }), '');
  input.end('não\nexit\n');
  await waitFor(() => /cancelada|cancelled/i.test(observed));
  assert.match(observed, /Nenhuma autoridade foi materializada/);
  assert.equal(fs.readFileSync(path.join(fixture.repository, 'calculator.js'), 'utf8'), before.toString());
});

test('exact approval produces one governed effect, GREEN project qualification, and zero replay effect', async (t) => {
  const fixture = createFailingCalculatorRepository();
  t.after(fixture.cleanup);
  const authorityRoot = path.join(fixture.root, 'authority');
  const journalStorageRoot = path.join(fixture.root, 'journal');
  fs.mkdirSync(journalStorageRoot);
  provisionLocalOfflineHumanAuthority({
    authorityRoot,
    issuer: 'local:natural-customer-corrective',
    subjectId: 'corrective-human'
  });
  const before = fs.readFileSync(path.join(fixture.repository, 'calculator.js'));
  const provider = proposalSession(before);
  const pending = await prepareNaturalCustomerDevelopment({
    objective: 'Fix the failing project tests.',
    activation: createInteractiveActivation(fixture.repository, 'NATURAL', 'en'),
    cognitiveSession: provider.session
  });

  assert.equal(pending.state, 'EXACT_HUMAN_REVIEW_REQUIRED');
  assert.equal(pending.diagnostic.projectTest.status, 'FAILED');
  assert.match(provider.context(), /ERR_ASSERTION|-1|actual/i);
  assert.equal(fs.readFileSync(path.join(fixture.repository, 'calculator.js'), 'utf8'), before.toString());

  const approval = {
    pending,
    approvedProposalFingerprint: pending.patchProposal.proposalFingerprint,
    authorityRoot,
    journalStorageRoot,
    tenantId: 'corrective',
    projectId: 'natural-customer'
  };
  const completed = await approveNaturalCustomerDevelopment(approval);
  assert.equal(completed.status, 'COMPLETED');
  assert.equal(completed.customerQualification.status, 'GREEN');
  assert.equal(completed.customerQualification.disposableProjection, true);
  assert.equal(completed.reusableApproval, false);
  assert.equal(completed.operationalAuthority, false);
  assert.equal(
    fs.readFileSync(completed.validation.authoritativeProjection, 'utf8'),
    'function add(a, b) {\n  return a + b;\n}\n\nmodule.exports = { add };\n'
  );
  assert.equal(fs.readFileSync(path.join(fixture.repository, 'calculator.js'), 'utf8'), before.toString());

  await assert.rejects(
    approveNaturalCustomerDevelopment(approval),
    /already claimed|already consumed|replay|denied|requires completed R3 journal|Prepared R3 authority differs/i
  );
  assert.equal(fs.readFileSync(path.join(fixture.repository, 'calculator.js'), 'utf8'), before.toString());
});

test('equivalent engineering objective is classified without phrase or filename special-casing', async (t) => {
  const fixture = createFailingCalculatorRepository();
  t.after(fixture.cleanup);
  const before = fs.readFileSync(path.join(fixture.repository, 'calculator.js'));
  const provider = proposalSession(before);
  const input = new PassThrough();
  const output = new PassThrough();
  let observed = '';
  output.on('data', (chunk) => { observed += chunk.toString(); });
  createInteractiveSession(
    createInteractiveActivation(fixture.repository, 'NATURAL', 'en'),
    { input, output, terminal: false, cognitiveSession: provider.session }
  );
  input.write('Fix the failing project tests.\n');
  await waitFor(() => /Proposal: [a-f0-9]{64}/.test(observed));
  assert.match(observed, /Exact proposal ready for human review/);
  assert.match(observed, /Excluded powers:.*push.*merge.*release.*publish.*deploy/);
  input.end('cancel\nexit\n');
});

test('widened target, traversal, and nonconforming provider output fail closed', async (t) => {
  const fixture = createFailingCalculatorRepository();
  t.after(fixture.cleanup);
  const activation = createInteractiveActivation(fixture.repository, 'NATURAL', 'en');
  const before = fs.readFileSync(path.join(fixture.repository, 'calculator.js'));
  const proposal = (target, beforeSha256) => Object.freeze({
    async proposePatch(objective) {
      return materializeGovernedEngineeringProposal({
        schema: 'sdo.ai_engineering_patch_proposal.v1',
        objective,
        target,
        beforeSha256,
        replacementBase64: Buffer.from('module.exports = {};\n').toString('base64'),
        reason: 'Adversarial proposal.',
        validationKind: 'VALIDATE_JS'
      });
    }
  });

  await assert.rejects(
    prepareNaturalCustomerDevelopment({
      objective: 'Fix the failing tests.', activation,
      cognitiveSession: proposal('calculator.test.js', sha256(fs.readFileSync(path.join(fixture.repository, 'calculator.test.js'))))
    }),
    /outside governed evidence/
  );
  await assert.rejects(
    prepareNaturalCustomerDevelopment({
      objective: 'Fix the failing tests.', activation,
      cognitiveSession: proposal('../calculator.js', sha256(before))
    }),
    /target must be one relative path|non-canonical|travers/i
  );
  await assert.rejects(
    prepareNaturalCustomerDevelopment({
      objective: 'Fix the failing tests.', activation,
      cognitiveSession: Object.freeze({ async proposePatch() { return 'I refuse to run tests.'; } })
    }),
    /widened or lost|proposal/i
  );
  assert.equal(fs.readFileSync(path.join(fixture.repository, 'calculator.js'), 'utf8'), before.toString());
});

test('interactive failure seam classifies governed target scope without exposing evidence', async (t) => {
  const fixture = createFailingCalculatorRepository();
  t.after(fixture.cleanup);
  const before = fs.readFileSync(path.join(fixture.repository, 'calculator.js'));
  const input = new PassThrough();
  const output = new PassThrough();
  let failure = null;
  const cognitiveSession = Object.freeze({
    async proposePatch(objective) {
      return materializeGovernedEngineeringProposal({
        schema: 'sdo.ai_engineering_patch_proposal.v1',
        objective,
        target: 'calculator.test.js',
        beforeSha256: sha256(fs.readFileSync(path.join(fixture.repository, 'calculator.test.js'))),
        replacementBase64: Buffer.from(
          'function add(a, b) {\n  return a + b;\n}\n\nmodule.exports = { add };\n'
        ).toString('base64'),
        reason: 'Correct the bounded arithmetic defect.',
        validationKind: 'VALIDATE_JS'
      });
    }
  });

  createInteractiveSession(
    createInteractiveActivation(fixture.repository, 'NATURAL', 'pt-BR'),
    {
      input, output, terminal: false, cognitiveSession,
      onDevelopmentFailure(value) { failure = value; }
    }
  );
  input.write('Corrija os testes que estão falhando.\n');
  await waitFor(() => failure !== null);

  assert.deepEqual(Object.keys(failure).sort(), [
    'code', 'mutationAuthority', 'operationalAuthority', 'reason', 'schema'
  ]);
  assert.equal(failure.code, 'COGNITIVE_TARGET_OUTSIDE_GOVERNED_EVIDENCE');
  assert.equal(failure.reason, 'Cognitive proposal target is outside governed evidence.');
  assert.equal(failure.operationalAuthority, false);
  assert.equal(failure.mutationAuthority, false);
  assert.doesNotMatch(JSON.stringify(failure), /calculator|[a-f0-9]{64}|function add/);
  assert.equal(fs.readFileSync(path.join(fixture.repository, 'calculator.js'), 'utf8'), before.toString());
  assert.equal(execFileSync('git', ['status', '--porcelain'], {
    cwd: fixture.repository, encoding: 'utf8'
  }), '');
  input.end('exit\n');
});

test('customer boundary owns authoritative BEFORE identity instead of trusting the provider echo', async (t) => {
  const fixture = createFailingCalculatorRepository();
  t.after(fixture.cleanup);
  const before = fs.readFileSync(path.join(fixture.repository, 'calculator.js'));
  const pending = await prepareNaturalCustomerDevelopment({
    objective: 'Corrija os testes que estão falhando.',
    activation: createInteractiveActivation(fixture.repository, 'NATURAL', 'pt-BR'),
    cognitiveSession: Object.freeze({
      async proposePatch(objective) {
        return materializeGovernedEngineeringProposal({
          schema: 'sdo.ai_engineering_patch_proposal.v1',
          objective,
          target: 'calculator.js',
          beforeSha256: '0'.repeat(64),
          replacementBase64: Buffer.from(
            'function add(a, b) {\n  return a + b;\n}\n\nmodule.exports = { add };\n'
          ).toString('base64'),
          reason: 'Correct the bounded arithmetic defect.',
          validationKind: 'VALIDATE_JS'
        });
      }
    })
  });

  assert.equal(pending.state, 'EXACT_HUMAN_REVIEW_REQUIRED');
  assert.equal(pending.patchProposal.beforeSha256, sha256(before));
  assert.notEqual(pending.patchProposal.beforeSha256, '0'.repeat(64));
  assert.equal(pending.patchProposal.operationalAuthority, false);
  assert.equal(pending.patchProposal.mutationAuthority, false);
  assert.equal(fs.readFileSync(path.join(fixture.repository, 'calculator.js'), 'utf8'), before.toString());
  assert.equal(execFileSync('git', ['status', '--porcelain'], {
    cwd: fixture.repository, encoding: 'utf8'
  }), '');
});
