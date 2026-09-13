'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  createCodexCognitiveContainment
} = require('../../accelerator/adapters/codex-cognitive-containment-adapter');
const {
  createCodexSDKAIProviderAdapter,
  CODEX_SDK_PROVIDER_ID
} = require('../../accelerator/adapters/codex-sdk-ai-provider-adapter');

const PHYSICAL = process.platform === 'linux' && fs.existsSync('/usr/bin/bwrap');

function tempEntries() {
  return new Set(fs.readdirSync(os.tmpdir()).filter((entry) =>
    entry.startsWith('sdo-codex-cognitive-')));
}

function cognitiveRequest(context) {
  return Object.freeze({
    schema: 'sdo.ai_cognitive_request.v1',
    providerId: CODEX_SDK_PROVIDER_ID,
    capability: 'EXPLAIN',
    objective: 'Analyze only the supplied governed evidence.',
    context: Object.freeze(context)
  });
}

function fakeCodexSource({
  repositoryMarkerPath,
  commonPath,
  sensitivePath,
  gitPath,
  externalWritePath
}) {
  return [
    "'use strict';",
    "const fs = require('node:fs');",
    "const net = require('node:net');",
    `const repositoryMarkerPath = ${JSON.stringify(repositoryMarkerPath)};`,
    `const commonPath = ${JSON.stringify(commonPath)};`,
    `const sensitivePath = ${JSON.stringify(sensitivePath)};`,
    `const gitPath = ${JSON.stringify(gitPath)};`,
    `const externalWritePath = ${JSON.stringify(externalWritePath)};`,
    'function readable(target) {',
    "  try { fs.readFileSync(target, 'utf8'); return true; } catch { return false; }",
    '}',
    'function writable(target) {',
    "  try { fs.writeFileSync(target, 'forbidden', { flag: 'wx' }); return true; } catch { return false; }",
    '}',
    'function networkOutcome() {',
    '  return new Promise((resolve) => {',
    "    const socket = net.createConnection({ host: '1.1.1.1', port: 53 });",
    '    let done = false;',
    '    const finish = (value) => { if (done) return; done = true; socket.destroy(); resolve(value); };',
    "    socket.setTimeout(500, () => finish('TIMEOUT'));",
    "    socket.once('connect', () => finish('CONNECTED'));",
    "    socket.once('error', (error) => finish(error.code || 'ERROR'));",
    '  });',
    '}',
    "let prompt = '';",
    "process.stdin.setEncoding('utf8');",
    "process.stdin.on('data', (chunk) => { prompt += chunk; });",
    "process.stdin.on('end', async () => {",
    '  const network = await networkOutcome();',
    '  const observation = {',
    '    args: process.argv.slice(2), prompt,',
    '    repositoryMarkerReadable: readable(repositoryMarkerPath),',
    '    commonReadable: readable(commonPath),',
    '    sensitiveReadable: readable(sensitivePath),',
    '    gitReadable: readable(gitPath),',
    '    externalWritable: writable(externalWritePath),',
    "    network, cwd: process.cwd(), home: process.env.HOME",
    '  };',
    "  fs.appendFileSync('/cognitive/tmp/physical-observations.jsonl', JSON.stringify(observation) + '\\n');",
    "  process.stdout.write(JSON.stringify({ type: 'thread.started', thread_id: 'thread-contained-1' }) + '\\n');",
    "  process.stdout.write(JSON.stringify({ type: 'turn.started' }) + '\\n');",
    "  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { id: 'message-1', type: 'agent_message', text: JSON.stringify({ response: 'SANITIZED_EVIDENCE_ONLY' }) } }) + '\\n');",
    "  process.stdout.write(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 0, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 } }) + '\\n');",
    '});',
    ''
  ].join('\n');
}

test('Linux Codex launcher physically denies original workspace reads writes and network', {
  skip: !PHYSICAL,
  timeout: 15000
}, async (t) => {
  const originalWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-aud-006-original-'));
  const repositoryMarkerPath = path.join(process.cwd(), 'package.json');
  assert.equal(fs.existsSync(repositoryMarkerPath), true);
  t.after(() => fs.rmSync(originalWorkspace, { recursive: true, force: true }));
  const commonPath = path.join(originalWorkspace, 'ordinary-marker.txt');
  const sensitivePath = path.join(originalWorkspace, '.env');
  const externalWritePath = path.join(originalWorkspace, 'cognitive-write-marker.txt');
  const gitPath = path.join(originalWorkspace, '.git', 'HEAD');
  const sensitiveMarker = 'SDO_AUD_006_SECRET_VALUE';
  fs.writeFileSync(commonPath, 'SDO_AUD_006_COMMON_VALUE\n', { mode: 0o600 });
  fs.writeFileSync(sensitivePath, `API_TOKEN=${sensitiveMarker}\n`, { mode: 0o600 });
  fs.mkdirSync(path.dirname(gitPath), { mode: 0o700 });
  fs.writeFileSync(gitPath, 'ref: refs/heads/contained-test\n', { mode: 0o600 });

  const probeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-aud-006-probe-'));
  t.after(() => fs.rmSync(probeRoot, { recursive: true, force: true }));
  const fakeCodex = path.join(probeRoot, 'fake-codex.js');
  fs.writeFileSync(fakeCodex, fakeCodexSource({
    repositoryMarkerPath,
    commonPath,
    sensitivePath,
    gitPath,
    externalWritePath
  }), { mode: 0o600 });

  const containment = createCodexCognitiveContainment({
    codexExecutable: process.execPath,
    codexExecutableArguments: ['/runtime/fake-codex.js'],
    runtimeBindings: [
      { source: fakeCodex, target: '/runtime/fake-codex.js' },
      { source: '/usr/lib', target: '/usr/lib' },
      { source: '/usr/lib64', target: '/usr/lib64' }
    ],
    registerSignalHandlers: false,
    now: () => '2099-01-01T00:00:00.000Z'
  });
  const cognitiveRoot = containment.cognitiveRoot;
  assert.equal((fs.statSync(containment.sessionRoot).mode & 0o777), 0o700);
  assert.equal((fs.statSync(cognitiveRoot).mode & 0o777), 0o700);
  assert.equal((fs.statSync(containment.launcherPath).mode & 0o777), 0o700);
  const launcher = fs.readFileSync(containment.launcherPath, 'utf8');
  assert.equal(launcher.includes(originalWorkspace), false);
  assert.equal(launcher.includes(process.cwd()), false);
  assert.equal(launcher.includes('--unshare-net'), false);
  assert.equal(containment.providerBaseUrl, 'http://127.0.0.1:43127');
  assert.equal(containment.attestation.controls.cognitiveServiceNetworkQualified, true);
  assert.equal(containment.attestation.controls.providerOnlyTransport, true);
  assert.equal(containment.attestation.controls.genericNetworkDenied, true);
  assert.equal(containment.attestation.controls.hostNetworkShared, false);
  assert.equal(containment.attestation.probe.alternateLocalDenied, true);
  assert.deepEqual(fs.readdirSync(path.join(cognitiveRoot, 'workspace')), []);
  assert.deepEqual(fs.readdirSync(path.join(cognitiveRoot, 'home')), []);
  const presentationEvents = [];
  const adapter = createCodexSDKAIProviderAdapter({
    credentialProvider: async () => 'test-only-contained-credential',
    containmentFactory: () => containment,
    onPresentationEvent: (event) => presentationEvents.push(event)
  });

  const governedContext = {
    evidence: 'API_KEY=[REDACTED_BY_SURGICAL_DEVOPS:ASSIGNMENT_SECRET]',
    providerSafe: true
  };
  assert.deepEqual(await adapter.invoke(cognitiveRequest(governedContext)), {
    response: 'SANITIZED_EVIDENCE_ONLY'
  });
  assert.deepEqual(await adapter.invoke(cognitiveRequest(governedContext)), {
    response: 'SANITIZED_EVIDENCE_ONLY'
  });

  const observations = fs.readFileSync(
    path.join(cognitiveRoot, 'tmp', 'physical-observations.jsonl'), 'utf8'
  ).trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(observations.length, 2);
  for (const observation of observations) {
    assert.equal(observation.repositoryMarkerReadable, false);
    assert.equal(observation.commonReadable, false);
    assert.equal(observation.sensitiveReadable, false);
    assert.equal(observation.gitReadable, false);
    assert.equal(observation.externalWritable, false);
    assert.notEqual(observation.network, 'CONNECTED');
    assert.notEqual(observation.network, 'TIMEOUT');
    assert.equal(observation.cwd, '/cognitive/workspace');
    assert.equal(observation.home, '/cognitive/home');
    assert.match(
      observation.prompt,
      /\[REDACTED_BY_SURGICAL_DEVOPS:ASSIGNMENT_SECRET\]/
    );
    assert.doesNotMatch(observation.prompt, new RegExp(sensitiveMarker));
    assert.equal(observation.prompt.includes(originalWorkspace), false);
    assert.equal(observation.prompt.includes(process.cwd()), false);
  }
  assert.equal(observations[0].args.includes('resume'), false);
  const resumeIndex = observations[1].args.indexOf('resume');
  assert.notEqual(resumeIndex, -1);
  assert.equal(observations[1].args[resumeIndex + 1], 'thread-contained-1');
  assert.equal(fs.existsSync(externalWritePath), false);
  assert.equal(JSON.stringify(presentationEvents).includes(sensitiveMarker), false);
  assert.equal(JSON.stringify(presentationEvents).includes(originalWorkspace), false);
  assert.equal(JSON.stringify(presentationEvents).includes(process.cwd()), false);

  adapter.dispose();
  assert.equal(fs.existsSync(containment.sessionRoot), false);
  assert.doesNotThrow(() => adapter.dispose());
});

test('containment absence blocks explicitly without creating an insecure fallback', () => {
  const before = tempEntries();
  for (const platform of ['darwin', 'win32']) {
    assert.throws(() => createCodexCognitiveContainment({
      platform,
      arch: 'x64',
      codexExecutable: process.execPath,
      registerSignalHandlers: false
    }), (error) => error.code === 'CODEX_CONTAINMENT_UNAVAILABLE');
  }
  assert.deepEqual(tempEntries(), before);
});

test('physical launcher failure removes the cognitive session and remains sanitized', {
  skip: !PHYSICAL,
  timeout: 15000
}, async (t) => {
  const probeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-aud-006-failure-'));
  t.after(() => fs.rmSync(probeRoot, { recursive: true, force: true }));
  const failingCodex = path.join(probeRoot, 'failing-codex.js');
  fs.writeFileSync(
    failingCodex,
    "'use strict';\nprocess.stderr.write('contained failure detail\\n');\nprocess.exit(9);\n",
    { mode: 0o600 }
  );
  const containment = createCodexCognitiveContainment({
    codexExecutable: process.execPath,
    codexExecutableArguments: ['/runtime/failing-codex.js'],
    runtimeBindings: [
      { source: failingCodex, target: '/runtime/failing-codex.js' },
      { source: '/usr/lib', target: '/usr/lib' },
      { source: '/usr/lib64', target: '/usr/lib64' }
    ],
    registerSignalHandlers: false,
    now: () => '2099-01-01T00:00:00.000Z'
  });
  const sessionRoot = containment.sessionRoot;
  const adapter = createCodexSDKAIProviderAdapter({
    credentialProvider: async () => 'test-only-contained-credential',
    containmentFactory: () => containment
  });
  await assert.rejects(
    () => adapter.invoke(cognitiveRequest({ providerSafe: true })),
    (error) => error.message === 'Codex SDK cognitive execution failed safely.'
  );
  assert.equal(fs.existsSync(sessionRoot), false);
  assert.equal(containment.isDisposed(), true);
});

test('Linux launcher preserves SDK stderr and exit-code semantics', {
  skip: !PHYSICAL,
  timeout: 15000
}, async (t) => {
  const probeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-aud-006-exit-'));
  t.after(() => fs.rmSync(probeRoot, { recursive: true, force: true }));
  const failingCodex = path.join(probeRoot, 'failing-codex.js');
  const stderrMarker = 'SDO_AUD_006_CONTAINED_STDERR';
  fs.writeFileSync(
    failingCodex,
    `'use strict';\nprocess.stderr.write('${stderrMarker}\\n');\nprocess.exit(23);\n`,
    { mode: 0o600 }
  );
  const containment = createCodexCognitiveContainment({
    codexExecutable: process.execPath,
    codexExecutableArguments: ['/runtime/failing-codex.js'],
    runtimeBindings: [
      { source: failingCodex, target: '/runtime/failing-codex.js' },
      { source: '/usr/lib', target: '/usr/lib' },
      { source: '/usr/lib64', target: '/usr/lib64' }
    ],
    registerSignalHandlers: false,
    now: () => '2099-01-01T00:00:00.000Z'
  });
  try {
    const { Codex } = await import('@openai/codex-sdk');
    const codex = new Codex({
      codexPathOverride: containment.launcherPath,
      env: { LANG: 'C.UTF-8' }
    });
    const thread = codex.startThread({
      workingDirectory: containment.sdkWorkingDirectory,
      sandboxMode: 'read-only',
      approvalPolicy: 'never',
      networkAccessEnabled: false,
      skipGitRepoCheck: true
    });
    const streamed = await thread.runStreamed('bounded failure');
    await assert.rejects(async () => {
      for await (const _event of streamed.events) {
        /* Consume the SDK stream through the contained launcher. */
      }
    }, (error) => error.message.includes('code 23') && error.message.includes(stderrMarker));
  } finally {
    containment.dispose();
  }
});

test('Linux containment installs and removes supported signal cleanup handlers', {
  skip: !PHYSICAL,
  timeout: 15000
}, () => {
  const before = Object.fromEntries(['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) =>
    [signal, process.listenerCount(signal)]));
  const containment = createCodexCognitiveContainment({
    now: () => '2099-01-01T00:00:00.000Z'
  });
  for (const signal of Object.keys(before)) {
    assert.equal(process.listenerCount(signal), before[signal] + 1);
  }
  containment.dispose();
  for (const signal of Object.keys(before)) {
    assert.equal(process.listenerCount(signal), before[signal]);
  }
});
