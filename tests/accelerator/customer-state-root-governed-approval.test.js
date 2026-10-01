'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { PassThrough } = require('node:stream');
const test = require('node:test');

const surgical = require('../../accelerator/cli/surgical');
const {
  materializeGovernedEngineeringProposal
} = require('../../accelerator/core/governed-engineering-proposal');
const {
  runCustomerCommand
} = require('../../accelerator/product/customer-cli');
const {
  endpointFor
} = require('../../accelerator/product/customer-lifecycle');

const EXTERNAL_IPC_DENIALS = new Set([
  'EACCES',
  'EAFNOSUPPORT',
  'ENOTSUP',
  'EPERM'
]);

const INTERNAL_PATCH_ENVIRONMENT = Object.freeze([
  'SDO_HUMAN_AUTHORITY_ROOT',
  'SDO_MUTATION_JOURNAL_ROOT',
  'SDO_TENANT_ID',
  'SDO_PROJECT_ID'
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function physicalSnapshot(root) {
  const records = [];
  function visit(directory, prefix = '') {
    for (const name of fs.readdirSync(directory).sort()) {
      const target = path.join(directory, name);
      const relative = path.join(prefix, name);
      const stat = fs.lstatSync(target, { bigint: true });
      if (stat.isDirectory()) {
        records.push({ relative, type: 'directory' });
        visit(target, relative);
      } else {
        records.push({
          relative,
          type: 'file',
          bytes: stat.size,
          mtimeNs: stat.mtimeNs,
          sha256: sha256(fs.readFileSync(target))
        });
      }
    }
  }
  visit(root);
  return records;
}

function git(repository, args) {
  return execFileSync('git', args, {
    cwd: repository,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function createCalculatorFixture() {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-csa-'))
  );
  const repository = path.join(root, 'repository');
  const stateRoot = path.join(root, 's');
  fs.mkdirSync(repository);
  fs.writeFileSync(
    path.join(repository, 'package.json'),
    `${JSON.stringify({ scripts: { test: 'node calculator.test.js' } }, null, 2)}\n`
  );
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
    ['config', 'user.name', 'Customer State Root Fixture'],
    ['add', '.'],
    ['commit', '-qm', 'failing calculator fixture']
  ]) git(repository, args);
  return Object.freeze({
    root,
    repository: fs.realpathSync(repository),
    stateRoot,
    before: fs.readFileSync(path.join(repository, 'calculator.js')),
    replacement: Buffer.from(
      'function add(a, b) {\n  return a + b;\n}\n\nmodule.exports = { add };\n'
    )
  });
}

function classifyRuntimeIpcCapability(stateRoot) {
  const endpoint = endpointFor(stateRoot);
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (error) => {
      if (EXTERNAL_IPC_DENIALS.has(error.code)) {
        resolve(Object.freeze({
          available: false,
          classification: 'EXTERNAL_PLATFORM_RUNTIME_IPC_UNAVAILABLE',
          code: error.code
        }));
        return;
      }
      reject(error);
    });
    server.listen(endpoint, () => {
      if (process.platform !== 'win32') {
        const stat = fs.lstatSync(endpoint);
        if (!stat.isSocket() || stat.isSymbolicLink()) {
          server.close();
          reject(new Error('Runtime IPC capability endpoint is not a physical socket'));
          return;
        }
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        if (process.platform !== 'win32' && fs.existsSync(endpoint)) {
          reject(new Error('Runtime IPC capability endpoint cleanup is incomplete'));
          return;
        }
        resolve(Object.freeze({ available: true, classification: 'AVAILABLE' }));
      });
    });
  });
}

async function waitFor(predicate, observed, timeoutMs = 10_000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for customer NATURAL workflow.\n${observed()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test('normal customer state root supplies local authority and journal only after exact approval', async (t) => {
  const fixture = createCalculatorFixture();
  const head = git(fixture.repository, ['rev-parse', 'HEAD']);
  const savedEnvironment = Object.fromEntries(
    INTERNAL_PATCH_ENVIRONMENT.map((name) => [name, process.env[name]])
  );
  const commandOutput = new PassThrough();
  commandOutput.resume();
  let runtimeStarted = false;

  t.after(async () => {
    for (const name of INTERNAL_PATCH_ENVIRONMENT) {
      if (savedEnvironment[name] === undefined) delete process.env[name];
      else process.env[name] = savedEnvironment[name];
    }
    if (runtimeStarted) {
      try {
        await runCustomerCommand(
          ['stop', '--state-root', fixture.stateRoot, '--json'],
          { stdout: commandOutput }
        );
      } catch {}
    }
    commandOutput.destroy();
    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  for (const name of INTERNAL_PATCH_ENVIRONMENT) delete process.env[name];
  await runCustomerCommand(
    ['init', '--profile', 'developer', '--state-root', fixture.stateRoot, '--json'],
    { stdout: commandOutput }
  );
  const ipcCapability = await classifyRuntimeIpcCapability(fixture.stateRoot);
  if (!ipcCapability.available) {
    t.skip(`${ipcCapability.classification} (${ipcCapability.code})`);
    return;
  }
  await runCustomerCommand(
    [
      'configure', 'provider', '--kind', 'ollama',
      '--endpoint', 'http://127.0.0.1:11434',
      '--state-root', fixture.stateRoot, '--json'
    ],
    { stdout: commandOutput }
  );
  await runCustomerCommand(
    ['open', fixture.repository, '--state-root', fixture.stateRoot, '--json'],
    { stdout: commandOutput }
  );
  await runCustomerCommand(
    ['start', '--state-root', fixture.stateRoot, '--json'],
    { stdout: commandOutput }
  );
  runtimeStarted = true;
  assert.deepEqual(fs.readdirSync(path.join(fixture.stateRoot, 'journal')), []);
  assert.equal(
    JSON.parse(
      fs.readFileSync(path.join(fixture.stateRoot, 'installation.json'), 'utf8')
    ).authorityCreated,
    true
  );

  const cognitiveSession = Object.freeze({
    async ask() {
      throw new Error('Free-form cognition is outside this regression.');
    },
    async proposePatch(objective) {
      return materializeGovernedEngineeringProposal({
        schema: 'sdo.ai_engineering_patch_proposal.v1',
        objective,
        target: 'calculator.js',
        beforeSha256: sha256(fixture.before),
        replacementBase64: fixture.replacement.toString('base64'),
        reason: 'Correct the evidence-bound arithmetic defect.',
        validationKind: 'VALIDATE_JS'
      });
    }
  });
  const input = new PassThrough();
  const output = new PassThrough();
  let observed = '';
  let developmentFailure = null;
  output.on('data', (chunk) => { observed += chunk.toString(); });
  t.after(() => {
    input.destroy();
    output.destroy();
  });

  await surgical.main(
    [
      '--interaction', 'NATURAL', '--language', 'pt-BR',
      '--state-root', fixture.stateRoot
    ],
    {
      input,
      output,
      cognitiveSession,
      onDevelopmentFailure(error) { developmentFailure = error; }
    }
  );
  input.write('Corrija os testes que estão falhando.\n');
  await waitFor(() => /Proposal: [a-f0-9]{64}/.test(observed), () => observed);
  const proposalFingerprint = /Proposal: ([a-f0-9]{64})/.exec(observed)[1];

  assert.match(observed, /Proposta exata pronta para revisão humana/);
  assert.match(observed, new RegExp(`Repository HEAD: ${head}`));
  assert.match(observed, new RegExp(`BEFORE SHA256: ${sha256(fixture.before)}`));
  assert.equal(git(fixture.repository, ['status', '--porcelain']), '');

  input.write(`aprovar patch ${proposalFingerprint}\n`);
  await waitFor(
    () => /Qualificação do teste do projeto: GREEN|A execução governada falhou/.test(observed),
    () => observed
  );
  assert.doesNotMatch(
    observed,
    /A execução governada falhou/,
    developmentFailure && developmentFailure.stack
  );
  assert.match(observed, /Qualificação do teste do projeto: GREEN/);
  assert.match(observed, /A autorização foi consumida e não pode ser reutilizada/);
  const projection = /Projeção gerenciada: (.+)/.exec(observed)[1].trim();
  assert.equal(fs.readFileSync(projection, 'utf8'), fixture.replacement.toString());
  assert.deepEqual(fs.readFileSync(path.join(fixture.repository, 'calculator.js')), fixture.before);
  assert.equal(git(fixture.repository, ['rev-parse', 'HEAD']), head);
  assert.equal(git(fixture.repository, ['status', '--porcelain']), '');
  assert.ok(fs.readdirSync(path.join(fixture.stateRoot, 'journal')).length > 0);

  const journalBeforeReplay = physicalSnapshot(path.join(fixture.stateRoot, 'journal'));
  const projectionBeforeReplay = fs.readFileSync(projection);
  const projectionStatBeforeReplay = fs.statSync(projection, { bigint: true });
  const observedBeforeReplay = observed.length;
  input.write(`aprovar patch ${proposalFingerprint}\n`);
  await waitFor(
    () => observed.length > observedBeforeReplay,
    () => observed
  );
  assert.deepEqual(
    physicalSnapshot(path.join(fixture.stateRoot, 'journal')),
    journalBeforeReplay
  );
  assert.deepEqual(fs.readFileSync(projection), projectionBeforeReplay);
  assert.equal(
    fs.statSync(projection, { bigint: true }).mtimeNs,
    projectionStatBeforeReplay.mtimeNs
  );
  assert.deepEqual(fs.readFileSync(path.join(fixture.repository, 'calculator.js')), fixture.before);
  input.end('sair\n');
});
