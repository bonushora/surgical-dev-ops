'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PassThrough } = require('node:stream');
const test = require('node:test');

const {
  createInteractiveActivation,
  createInteractiveSession
} = require('../../accelerator/cli/surgical');
const {
  provisionLocalOfflineHumanAuthority
} = require('../../accelerator/core/local-offline-human-authority-store');

const BEFORE =
  "// Manual acceptance fixture\nconst version = 'before';\n";
const APPROVED =
  "// Manual acceptance fixture\nconst version = 'approved';\n";
const SECOND =
  "// Manual acceptance fixture\nconst version = 'second';\n";

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function git(repository, args) {
  return childProcess.execFileSync('git', args, {
    cwd: repository,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function codexContainment() {
  let disposed = false;
  return Object.freeze({
    schema: 'sdo.codex_cognitive_containment.v1',
    state: 'ENFORCED',
    platform: 'linux',
    launcherPath: '/isolated/control/codex-contained-launcher',
    sdkWorkingDirectory: '/cognitive/workspace',
    providerBaseUrl: 'http://127.0.0.1:43127',
    attestation: Object.freeze({
      schema: 'sdo.codex_cognitive_containment_attestation.v1',
      decision: 'ENFORCED',
      controls: Object.freeze({
        originalWorkspaceDenied: true,
        networkDenied: false,
        genericNetworkDenied: true,
        cognitiveServiceNetworkQualified: true,
        providerOnlyTransport: true,
        hostNetworkShared: false
      })
    }),
    dispose() { disposed = true; },
    isDisposed: () => disposed
  });
}

function codexSDK({ beforeSha256, replacement, threadId, evidenceSink }) {
  let planCalls = 0;
  const thread = {
    async runStreamed(prompt) {
      const request = JSON.parse(prompt);
      if (request.capability === 'PLAN' && planCalls > 0 && evidenceSink) {
        evidenceSink.value = request.context.qualifiedGovernedEvidence;
      }
      let output;
      if (request.capability === 'PLAN') {
        planCalls += 1;
        output = planCalls === 1
          ? {
              decision: 'REQUEST_EVIDENCE',
              response: null,
              evidenceRequest: {
                kind: 'READ_FILE',
                target: 'demo.js',
                reason: 'Bind the exact authoritative BEFORE evidence.'
              }
            }
          : {
              decision: 'RESPOND',
              response: 'The authoritative evidence is sufficient.',
              evidenceRequest: null
            };
      } else {
        output = {
          schema: 'sdo.ai_engineering_patch_proposal.v1',
          objective: 'Provider descriptive echo is not authoritative.',
          target: 'demo.js',
          beforeSha256,
          replacementBase64: Buffer.from(replacement).toString('base64'),
          reason: 'Apply the exact next governed generation.',
          validationKind: 'VALIDATE_JS'
        };
      }
      return {
        events: (async function* () {
          yield { type: 'thread.started', thread_id: threadId };
          yield { type: 'turn.started' };
          yield {
            type: 'item.completed',
            item: {
              type: 'agent_message',
              text: JSON.stringify(output)
            }
          };
          yield { type: 'turn.completed', usage: null };
        })()
      };
    }
  };
  return {
    Codex: class {
      startThread() { return thread; }
      resumeThread() { return thread; }
    }
  };
}

async function waitFor(predicate, failure, observed) {
  const deadline = Date.now() + 30_000;
  while (!predicate()) {
    if (failure()) {
      assert.fail(`Development failed: ${failure().code}\n${observed()}`);
    }
    if (Date.now() >= deadline) {
      assert.fail(`Timed out waiting for development boundary.\n${observed()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function session(repository, patchOptions, sdk) {
  const input = new PassThrough();
  const output = new PassThrough();
  let observed = '';
  let failure = null;
  output.on('data', (chunk) => { observed += chunk.toString(); });
  createInteractiveSession(
    createInteractiveActivation(repository, 'NATURAL', 'en'),
    {
      input,
      output,
      terminal: false,
      codex: true,
      codexOptions: {
        authenticationMode: 'API_KEY',
        containmentFactory: codexContainment,
        sdkLoader: async () => sdk
      },
      codexCredentialProvider: async () => 'test-only-credential',
      patchOptions,
      onDevelopmentFailure(value) { failure = value; }
    }
  );
  return {
    input,
    observed: () => observed,
    failure: () => failure
  };
}

test(
  'Scenario 5 derives a fresh proposal from the latest authoritative CAS generation',
  { timeout: 90_000 },
  async (t) => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'sdo-scenario5-sequential-')
    );
    const repository = path.join(root, 'repository');
    const authorityRoot = path.join(root, 'authority');
    const journalStorageRoot = path.join(root, 'journal');
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    fs.mkdirSync(repository);
    fs.mkdirSync(journalStorageRoot);
    fs.writeFileSync(path.join(repository, 'demo.js'), BEFORE);
    git(repository, ['init', '-q']);
    git(repository, ['config', 'user.email', 'scenario5@example.invalid']);
    git(repository, ['config', 'user.name', 'Scenario 5 Regression']);
    git(repository, ['add', 'demo.js']);
    git(repository, ['commit', '-qm', 'scenario 5 fixture']);
    provisionLocalOfflineHumanAuthority({
      authorityRoot,
      issuer: 'local:scenario-5-regression',
      subjectId: 'scenario-5-human'
    });

    const patchOptions = {
      authorityRoot,
      journalStorageRoot,
      tenantId: 'local-acceptance',
      projectId: 'scenario-5-regression'
    };
    const first = session(
      repository,
      patchOptions,
      codexSDK({
        beforeSha256: sha256(BEFORE),
        replacement: APPROVED,
        threadId: 'scenario-5-first'
      })
    );
    first.input.write('Change demo.js to version approved\n');
    await waitFor(
      () => /Exact proposal ready for human review/.test(first.observed()),
      first.failure,
      first.observed
    );
    const firstFingerprint = first.observed()
      .match(/Proposal: ([a-f0-9]{64})/)?.[1];
    assert.ok(firstFingerprint, first.observed());
    first.input.write(`approve patch ${firstFingerprint}\n`);
    await waitFor(
      () => /The authorization was consumed/.test(first.observed()),
      first.failure,
      first.observed
    );
    const managedProjection = first.observed()
      .match(/Managed projection: (.+)/)?.[1];
    assert.ok(managedProjection, first.observed());
    first.input.write('exit\n');
    first.input.end();

    assert.equal(fs.readFileSync(path.join(repository, 'demo.js'), 'utf8'), BEFORE);
    assert.equal(fs.readFileSync(managedProjection, 'utf8'), APPROVED);
    assert.equal(git(repository, ['status', '--porcelain']), '');

    const consumptionRoot = path.join(
      journalStorageRoot,
      '.natural-development-authorization-consumption'
    );
    const consumedBefore = fs.readdirSync(consumptionRoot)
      .filter((name) => name.endsWith('.json'));
    assert.equal(consumedBefore.length, 1);
    const consumedRecord = JSON.parse(fs.readFileSync(
      path.join(consumptionRoot, consumedBefore[0]),
      'utf8'
    ));
    assert.equal(consumedRecord.state, 'CONSUMED');
    const authoritativeRefBefore = git(repository, [
      'rev-parse',
      '--verify',
      `refs/surgical-devops/workspace/${sha256('demo.js')}`
    ]);

    const evidenceSink = { value: null };
    const second = session(
      repository,
      patchOptions,
      codexSDK({
        beforeSha256: sha256(APPROVED),
        replacement: SECOND,
        threadId: 'scenario-5-second',
        evidenceSink
      })
    );
    second.input.write('Change demo.js to version second\n');
    await waitFor(
      () => /Exact proposal ready for human review/.test(second.observed()),
      second.failure,
      second.observed
    );

    const secondFingerprint = second.observed()
      .match(/Proposal: ([a-f0-9]{64})/)?.[1];
    assert.ok(secondFingerprint, second.observed());
    assert.notEqual(secondFingerprint, firstFingerprint);
    assert.match(
      second.observed(),
      new RegExp(`BEFORE SHA256: ${sha256(APPROVED)}`)
    );
    assert.match(second.observed(), /approve patch [a-f0-9]{64}/);
    assert.equal(evidenceSink.value.status, 'AVAILABLE');
    assert.match(evidenceSink.value.normalizedContext, /version = 'approved'/);

    assert.equal(fs.readFileSync(path.join(repository, 'demo.js'), 'utf8'), BEFORE);
    assert.equal(fs.readFileSync(managedProjection, 'utf8'), APPROVED);
    assert.equal(
      git(repository, [
        'rev-parse',
        '--verify',
        `refs/surgical-devops/workspace/${sha256('demo.js')}`
      ]),
      authoritativeRefBefore
    );
    assert.deepEqual(
      fs.readdirSync(consumptionRoot).filter((name) => name.endsWith('.json')),
      consumedBefore
    );
    assert.equal(git(repository, ['status', '--porcelain']), '');

    second.input.write('exit\n');
    second.input.end();
  }
);
