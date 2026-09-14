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
  createInteractiveSession,
  formatNaturalDevelopmentCompletion
} = require('../../accelerator/cli/surgical');
const {
  provisionLocalOfflineHumanAuthority
} = require('../../accelerator/core/local-offline-human-authority-store');

function git(repository, args) {
  childProcess.execFileSync('git', args, {
    cwd: repository,
    stdio: 'pipe'
  });
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

function codexSDK(beforeSha256) {
  let planCalls = 0;
  const thread = {
    async runStreamed(prompt) {
      const request = JSON.parse(prompt);
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
                reason: 'Bind the exact governed BEFORE evidence.'
              }
            }
          : {
              decision: 'RESPOND',
              response: 'The exact governed evidence is sufficient.',
              evidenceRequest: null
            };
      } else {
        output = {
          schema: 'sdo.ai_engineering_patch_proposal.v1',
          objective: 'Change demo.js to the approved version.',
          target: 'demo.js',
          beforeSha256,
          replacementBase64: Buffer.from(
            "// Manual acceptance fixture\nconst version = 'approved';\n"
          ).toString('base64'),
          reason: 'Apply the exact bounded version change.',
          validationKind: 'VALIDATE_JS'
        };
      }
      return {
        events: (async function* () {
          yield { type: 'thread.started', thread_id: 'scenario-4-thread' };
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

test(
  'Scenario 4 truthfully presents successful Manifest-CAS completion',
  { timeout: 240_000 },
  async (t) => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'sdo-scenario3-regression-')
    );
    const repository = path.join(root, 'repository');
    const authorityRoot = path.join(root, 'authority');
    const journalStorageRoot = path.join(root, 'journal');
    const before =
      "// Manual acceptance fixture\nconst version = 'before';\n";

    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(repository);
    fs.mkdirSync(journalStorageRoot);
    fs.writeFileSync(path.join(repository, 'demo.js'), before);
    git(repository, ['init', '-q']);
    git(repository, ['config', 'user.email', 'scenario3@example.invalid']);
    git(repository, ['config', 'user.name', 'Scenario 4 Regression']);
    git(repository, ['add', 'demo.js']);
    git(repository, ['commit', '-qm', 'scenario 3 fixture']);
    provisionLocalOfflineHumanAuthority({
      authorityRoot,
      issuer: 'local:scenario-4-regression',
      subjectId: 'scenario-4-human'
    });

    const input = new PassThrough();
    const output = new PassThrough();
    const beforeSha256 = crypto.createHash('sha256').update(before).digest('hex');
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
          sdkLoader: async () => codexSDK(beforeSha256)
        },
        codexCredentialProvider: async () => 'test-only-credential',
        patchOptions: {
          authorityRoot,
          journalStorageRoot,
          tenantId: 'local-acceptance',
          projectId: 'scenario-4-regression'
        },
        onDevelopmentFailure(value) { failure = value; }
      }
    );

    input.write('Change demo.js to version approved\n');
    const deadline = Date.now() + 220_000;
    while (
      !/Exact proposal ready for human review/.test(observed) &&
      failure === null
    ) {
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for Scenario 4.\n${observed}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const fingerprint = observed.match(/Proposal: ([a-f0-9]{64})/)?.[1];
    assert.ok(fingerprint, observed);
    assert.equal(
      fs.readFileSync(path.join(repository, 'demo.js'), 'utf8'),
      before
    );

    input.write(`approve patch ${fingerprint}\n`);
    while (!/The authorization was consumed/.test(observed)) {
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for Scenario 4.\n${observed}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    input.write('exit\n');
    input.end();
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.match(
      observed,
      /Exact proposal ready for human review/,
      `bounded failure: ${failure && failure.code}\n${observed}`
    );
    assert.equal(failure, null);
    assert.doesNotMatch(observed, /Governed change completed and validated/);
    assert.match(
      observed,
      /Governed Manifest-CAS authority advanced and its managed projection was validated/
    );
    assert.match(observed, /Logical target: demo\.js/);
    assert.match(observed, /Managed projection: .+/);
    assert.match(observed, new RegExp(`Authoritative BEFORE SHA256: ${beforeSha256}`));
    assert.match(observed, /Authoritative AFTER SHA256: [a-f0-9]{64}/);
    assert.match(observed, /Ordinary worktree path: not modified by this operation/);
    assert.match(observed, /The authorization was consumed and cannot be reused/);
    assert.match(observed, /Ordinary worktree path:.*non-authoritative/);
    const managedProjection = observed.match(/Managed projection: (.+)/)?.[1];
    const afterSha256 = observed.match(
      /Authoritative AFTER SHA256: ([a-f0-9]{64})/
    )?.[1];
    assert.ok(managedProjection, observed);
    assert.ok(afterSha256, observed);
    assert.equal(
      fs.readFileSync(managedProjection, 'utf8'),
      "// Manual acceptance fixture\nconst version = 'approved';\n"
    );

    const portuguese = formatNaturalDevelopmentCompletion(
      {
        target: 'demo.js',
        beforeSha256,
        afterSha256,
        validation: { authoritativeProjection: managedProjection }
      },
      createInteractiveActivation(repository, 'NATURAL', 'pt-BR')
    );
    assert.match(
      portuguese,
      /autoridade governada do Manifest-CAS avançou.*projeção gerenciada foi validada/i
    );
    assert.match(portuguese, /Alvo lógico: demo\.js/);
    assert.match(portuguese, /Projeção gerenciada: .+/);
    assert.match(portuguese, /SHA256 BEFORE autoritativo: [a-f0-9]{64}/);
    assert.match(portuguese, /SHA256 AFTER autoritativo: [a-f0-9]{64}/);
    assert.match(
      portuguese,
      /Caminho comum do worktree: não foi modificado.*não é autoritativo/i
    );
    assert.match(
      portuguese,
      /A autorização foi consumida e não pode ser reutilizada/
    );
    assert.equal(
      fs.readFileSync(path.join(repository, 'demo.js'), 'utf8'),
      before
    );
    assert.equal(
      childProcess.execFileSync('git', ['status', '--short'], {
        cwd: repository,
        encoding: 'utf8'
      }),
      ''
    );
  }
);
