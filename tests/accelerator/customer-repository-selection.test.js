'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');
const { PassThrough } = require('node:stream');

const {
  initializeCustomerState,
  inspectCustomerState,
} = require('../../accelerator/product/customer-runtime');
const {
  probeCustomerRuntime,
  startCustomerRuntime,
  stopCustomerRuntime,
  assertCustomerRepositoryBinding,
} = require('../../accelerator/product/customer-lifecycle');
const {
  runCustomerCommand,
} = require('../../accelerator/product/customer-cli');
const {
  main,
  createInteractiveActivation,
} = require('../../accelerator/cli/surgical');
const {
  prepareNaturalCustomerDevelopment,
} = require('../../accelerator/cli/natural-customer-development');
const {
  materializeGovernedEngineeringProposal,
} = require('../../accelerator/core/governed-engineering-proposal');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function git(repository, args) {
  return execFileSync('git', args, {
    cwd: repository,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function repository(root, name) {
  const target = path.join(root, name);
  fs.mkdirSync(target);
  git(target, ['init', '-b', 'main']);
  git(target, ['config', 'user.email', 'selection@example.invalid']);
  git(target, ['config', 'user.name', 'Repository Selection Fixture']);
  fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({
    scripts: { test: 'node identity.test.js' },
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(target, 'identity.js'), 'module.exports = () => -1;\n');
  fs.writeFileSync(
    path.join(target, 'identity.test.js'),
    "const assert = require('node:assert/strict');\n" +
      "const identity = require('./identity');\n" +
      'assert.equal(identity(), 5);\n',
  );
  git(target, ['add', '.']);
  git(target, ['commit', '-m', `${name} fixture`]);
  return fs.realpathSync(target);
}

function sink() {
  return Object.freeze({ write() { return true; } });
}

function proposalProvider(repository, observations = []) {
  const before = fs.readFileSync(path.join(repository, 'identity.js'));
  return Object.freeze({
    async proposePatch(objective, activation, context) {
      observations.push(Object.freeze({
        repositoryPath: activation.repositoryPath,
        context,
      }));
      return materializeGovernedEngineeringProposal({
        schema: 'sdo.ai_engineering_patch_proposal.v1',
        objective,
        target: 'identity.js',
        beforeSha256: sha256(before),
        replacementBase64: Buffer.from('module.exports = () => 5;\n').toString('base64'),
        reason: 'Correct the bounded failing identity fixture.',
        validationKind: 'VALIDATE_JS',
      });
    },
  });
}

async function waitFor(predicate, timeoutMs = 5_000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for NATURAL selection regression');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

test('open selects the exact repository in an already READY runtime without authority or restart', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-selection-')));
  const stateRoot = path.join(root, 'state');
  const repositoryA = repository(root, 'repository-a');
  const repositoryB = repository(root, 'repository-b');
  t.after(async () => {
    try { await stopCustomerRuntime({ stateRoot }); } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  });

  initializeCustomerState({ stateRoot, profile: 'developer' });
  const started = await startCustomerRuntime({ stateRoot });
  assert.equal((await probeCustomerRuntime({ stateRoot })).runtimeStatus, 'READY');

  await runCustomerCommand(['open', repositoryA, '--state-root', stateRoot], { stdout: sink() });
  await runCustomerCommand(['open', repositoryB, '--state-root', stateRoot], { stdout: sink() });

  const inspection = inspectCustomerState({ stateRoot });
  const status = await probeCustomerRuntime({ stateRoot });
  assert.deepEqual(
    inspection.repositories.repositories.map((entry) => entry.path),
    [repositoryA, repositoryB],
  );
  assert.equal(status.startupId, started.startupId, 'repository selection must not restart the runtime');
  assert.equal(status.currentRepository, repositoryB);
  assert.equal(status.authorityState, 'AUTHORITY_UNAVAILABLE');
  assert.equal(inspection.repositories.repositories[0].authorityGranted, false);
  assert.equal(inspection.repositories.repositories[1].authorityGranted, false);
  assert.equal(inspection.repositories.currentRepositoryId, inspection.repositories.repositories[1].id);
});

test('NATURAL composition, governed evidence, and proposal preparation bind only to the selected repository', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-sel-n-')));
  const stateRoot = path.join(root, 'state');
  const repositoryA = repository(root, 'repository-a');
  const repositoryB = repository(root, 'repository-b');
  const input = new PassThrough();
  const output = new PassThrough();
  const observations = [];
  let observed = '';
  output.on('data', (chunk) => { observed += chunk.toString(); });
  t.after(async () => {
    input.end();
    try { await stopCustomerRuntime({ stateRoot }); } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  });

  initializeCustomerState({ stateRoot, profile: 'developer' });
  await startCustomerRuntime({ stateRoot });
  await runCustomerCommand(['open', repositoryA, '--state-root', stateRoot], { stdout: sink() });
  await runCustomerCommand(['open', repositoryB, '--state-root', stateRoot], { stdout: sink() });

  await main(
    ['--interaction', 'NATURAL', '--language', 'en', '--state-root', stateRoot],
    { input, output, cognitiveSession: proposalProvider(repositoryB, observations) },
  );
  input.write('Fix the failing project tests.\n');
  await waitFor(() => /Proposal: [a-f0-9]{64}/.test(observed));

  assert.match(observed, /connected to project "repository-b"/);
  assert.doesNotMatch(observed, /connected to project "repository-a"/);
  assert.ok(observations.length >= 1);
  for (const observation of observations) {
    assert.equal(observation.repositoryPath, repositoryB);
  }
  assert.match(observations[0].context, new RegExp(repositoryB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(observations[0].context, new RegExp(repositoryA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal((await probeCustomerRuntime({ stateRoot })).authorityState, 'AUTHORITY_UNAVAILABLE');
  input.end('cancel\nexit\n');
});

test('switching repositories after proposal preparation makes the repository and HEAD binding stale', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-sel-s-')));
  const stateRoot = path.join(root, 'state');
  const repositoryA = repository(root, 'repository-a');
  const repositoryB = repository(root, 'repository-b');
  t.after(async () => {
    try { await stopCustomerRuntime({ stateRoot }); } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  });

  initializeCustomerState({ stateRoot, profile: 'developer' });
  await startCustomerRuntime({ stateRoot });
  await runCustomerCommand(['open', repositoryA, '--state-root', stateRoot], { stdout: sink() });
  const pendingA = await prepareNaturalCustomerDevelopment({
    objective: 'Fix the failing project tests.',
    activation: createInteractiveActivation(repositoryA, 'NATURAL', 'en'),
    cognitiveSession: proposalProvider(repositoryA),
  });
  assert.equal(pendingA.repositoryPath, repositoryA);
  assert.equal(pendingA.mutationAuthority, false);

  await runCustomerCommand(['open', repositoryB, '--state-root', stateRoot], { stdout: sink() });
  await assert.rejects(
    assertCustomerRepositoryBinding({
      stateRoot,
      repositoryPath: pendingA.repositoryPath,
      repositoryHead: pendingA.contract.repositoryHead,
    }),
    /current repository selection or HEAD differs/i,
  );
  const status = await probeCustomerRuntime({ stateRoot });
  assert.equal(status.currentRepository, repositoryB);
  assert.equal(status.authorityState, 'AUTHORITY_UNAVAILABLE');
  assert.equal(fs.readFileSync(path.join(repositoryA, 'identity.js'), 'utf8'), 'module.exports = () => -1;\n');
  assert.equal(fs.readFileSync(path.join(repositoryB, 'identity.js'), 'utf8'), 'module.exports = () => -1;\n');
});

test('the production NATURAL approval seam closes an A proposal after the runtime selects B', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-sel-a-')));
  const stateRoot = path.join(root, 'state');
  const repositoryA = repository(root, 'repository-a');
  const repositoryB = repository(root, 'repository-b');
  const input = new PassThrough();
  const output = new PassThrough();
  let observed = '';
  output.on('data', (chunk) => { observed += chunk.toString(); });
  t.after(async () => {
    input.end();
    try { await stopCustomerRuntime({ stateRoot }); } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  });

  initializeCustomerState({ stateRoot, profile: 'developer' });
  await startCustomerRuntime({ stateRoot });
  await runCustomerCommand(['open', repositoryA, '--state-root', stateRoot], { stdout: sink() });
  await main(
    ['--interaction', 'NATURAL', '--language', 'en', '--state-root', stateRoot],
    { input, output, cognitiveSession: proposalProvider(repositoryA) },
  );
  input.write('Fix the failing project tests.\n');
  await waitFor(() => /Proposal: [a-f0-9]{64}/.test(observed));
  const fingerprint = observed.match(/Proposal: ([a-f0-9]{64})/)[1];

  await runCustomerCommand(['open', repositoryB, '--state-root', stateRoot], { stdout: sink() });
  input.write(`approve patch ${fingerprint}\n`);
  await waitFor(() => /Governed execution failed closed/.test(observed));

  assert.equal((await probeCustomerRuntime({ stateRoot })).currentRepository, repositoryB);
  assert.equal(fs.readFileSync(path.join(repositoryA, 'identity.js'), 'utf8'), 'module.exports = () => -1;\n');
  assert.equal(fs.readFileSync(path.join(repositoryB, 'identity.js'), 'utf8'), 'module.exports = () => -1;\n');
  assert.match(observed, /no reusable authorization remained/i);
  input.end('exit\n');
});
