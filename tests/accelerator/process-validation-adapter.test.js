'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { evaluateCapabilityGrant } = require('../../accelerator/core/capability-grant');
const {
  validateJavaScriptWithGrant
} = require('../../accelerator/adapters/process-validation-adapter');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-validation-'));
const workspace = path.join(root, 'workspace');
const sibling = path.join(root, 'workspace-secret');
fs.mkdirSync(workspace);
fs.mkdirSync(sibling);
fs.writeFileSync(path.join(workspace, 'valid.js'), 'const value = 1;\n');
fs.writeFileSync(path.join(workspace, 'invalid.js'), 'const = ;\n');
fs.writeFileSync(path.join(workspace, 'other.js'), 'const other = true;\n');
fs.writeFileSync(
  path.join(workspace, 'sample.test.js'),
  "'use strict';\n" +
    "const test = require('node:test');\n" +
    "const assert = require('node:assert/strict');\n" +
    "test('adapter fixture passes', () => assert.equal(1, 1));\n"
);
fs.writeFileSync(
  path.join(workspace, 'sandbox-adversarial.test.js'),
  "'use strict';\n" +
    "const test = require('node:test');\n" +
    "const assert = require('node:assert/strict');\n" +
    "const childProcess = require('node:child_process');\n" +
    "const fs = require('node:fs');\n" +
    "const net = require('node:net');\n" +
    "const os = require('node:os');\n" +
    "const path = require('node:path');\n" +
    "test('native isolation is physically enforced', async () => {\n" +
    "  assert.match(fs.readFileSync(__filename, 'utf8'), /physically enforced/);\n" +
    "  assert.equal(process.env.SDO_VALIDATION_SECRET_MARKER, undefined);\n" +
    "  for (const target of [path.join(process.cwd(), 'forbidden-write'), path.join(os.tmpdir(), 'forbidden-write')]) {\n" +
    "    assert.throws(() => fs.writeFileSync(target, 'forbidden'), /permission|access|denied/i);\n" +
    "  }\n" +
    "  let child;\n" +
    "  try { child = childProcess.spawnSync(process.execPath, ['-e', 'process.exit(0)']); }\n" +
    "  catch (error) { child = { error }; }\n" +
    "  assert.ok(child.error || child.status !== 0);\n" +
    "  const network = await new Promise((resolve) => {\n" +
    "    const socket = net.createConnection({ host: '1.1.1.1', port: 53 });\n" +
    "    const timer = setTimeout(() => { socket.destroy(); resolve('DENIED'); }, 500);\n" +
    "    socket.once('connect', () => { clearTimeout(timer); socket.destroy(); resolve('CONNECTED'); });\n" +
    "    socket.once('error', () => { clearTimeout(timer); resolve('DENIED'); });\n" +
    "  });\n" +
    "  assert.equal(network, 'DENIED');\n" +
    "});\n"
);
fs.writeFileSync(path.join(sibling, 'secret.js'), 'const secret = true;\n');
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

const NOW = '2026-08-20T12:00:00.000Z';
const EXPIRY = '2026-08-20T13:00:00.000Z';

function issue(paths = ['valid.js'], overrides = {}) {
  const common = {
    operationId: 'op-1', workspace, policyDecision: 'ALLOWED', riskLevel: 'R1',
    lifecycleState: 'PENDING', capabilityType: 'PROCESS_VALIDATION',
    scope: { selectors: ['NODE_SYNTAX_CHECK'], paths }, idempotency: 'IDEMPOTENT'
  };
  return evaluateCapabilityGrant(
    { ...common, expiresAt: EXPIRY, ...overrides.request },
    { ...common, evaluatedAt: NOW, ...overrides.authority }
  );
}

function validate(overrides = {}) {
  return validateJavaScriptWithGrant({
    operationId: 'op-1', workspace, selector: 'NODE_SYNTAX_CHECK',
    target: 'valid.js', grantEvaluation: issue(), observedAt: NOW, ...overrides
  });
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function grantWith(overrides) {
  const issued = issue();
  return freeze({
    schema: issued.schema,
    decision: issued.decision,
    reason: issued.reason,
    grant: { ...issued.grant, ...overrides }
  });
}

test('valid syntax check returns PASSED evidence', () => {
  const result = validate();
  assert.equal(result.validation.status, 'PASSED');
  assert.equal(result.validation.successfulCompletionEligible, true);
});

test('syntax error returns FAILED evidence', () => {
  const result = validate({ target: 'invalid.js', grantEvaluation: issue(['invalid.js']) });
  assert.equal(result.validation.status, 'FAILED');
  assert.equal(result.validation.successfulCompletionEligible, false);
  assert.notEqual(result.validation.exitCode, 0);
});

test('fixed Node test-file selector returns normalized PASSED evidence', () => {
  const result = validate({
    selector: 'NODE_TEST_FILE',
    target: 'sample.test.js',
    grantEvaluation: issue(['sample.test.js'], {
      request: {
        action: 'NODE_TEST_FILE',
        scope: { selectors: ['NODE_TEST_FILE'], paths: ['sample.test.js'] }
      },
      authority: {
        action: 'NODE_TEST_FILE',
        scope: { selectors: ['NODE_TEST_FILE'], paths: ['sample.test.js'] }
      }
    })
  });
  assert.equal(result.validation.status, 'PASSED');
  assert.equal(result.validation.successfulCompletionEligible, true);
  assert.equal(result.execution.shell, false);
  assert.equal(result.execution.timeoutMs, 30000);
  assert.equal(result.validation.testSummary.tests, 1);
  assert.equal(result.validation.testSummary.failed, 0);
  if (process.platform === 'linux') {
    assert.equal(result.execution.executable, '/usr/bin/unshare');
    assert.deepEqual(result.execution.arguments.slice(0, 5), [
      '--user', '--map-current-user', '--net', '--', '/usr/bin/bwrap'
    ]);
    assert.equal(result.execution.arguments.includes('--unshare-net'), false);
  } else if (process.platform === 'darwin') {
    assert.match(result.execution.executable, /sdo-seatbelt-probe$/);
  } else {
    assert.match(result.execution.executable, /sdo-node-test-sandbox\.exe$/i);
  }
  assert.equal(result.execution.environmentKeys.length, 0);
  assert.equal(result.execution.sandboxEvidence.operationId, 'op-1');
  assert.equal(result.execution.sandboxEvidence.workspace, workspace);
  assert.equal(result.execution.sandboxEvidence.controls.workspaceReadOnly, true);
  assert.equal(result.execution.sandboxEvidence.controls.networkDenied, true);
  assert.equal(result.execution.sandboxEvidence.controls.genericProcessDenied, true);
  assert.equal(result.execution.sandboxEvidence.controls.secretAccessDenied, true);
});

test('physical native sandbox denies writes secrets network and unauthorized subprocesses', () => {
  process.env.SDO_VALIDATION_SECRET_MARKER = 'parent-only-marker';
  try {
    const result = validate({
      selector: 'NODE_TEST_FILE',
      target: 'sandbox-adversarial.test.js',
      grantEvaluation: issue(['sandbox-adversarial.test.js'], {
        request: {
          action: 'NODE_TEST_FILE',
          scope: {
            selectors: ['NODE_TEST_FILE'],
            paths: ['sandbox-adversarial.test.js']
          }
        },
        authority: {
          action: 'NODE_TEST_FILE',
          scope: {
            selectors: ['NODE_TEST_FILE'],
            paths: ['sandbox-adversarial.test.js']
          }
        }
      })
    });
    assert.equal(result.validation.status, 'PASSED', result.validation.stderr);
    assert.equal(result.validation.testSummary.failed, 0);
    assert.equal(result.execution.sandboxEvidence.sandboxKind,
      process.platform === 'linux'
        ? 'linux-bubblewrap-user-namespace'
        : process.platform === 'darwin'
          ? 'macos-seatbelt-deny-default'
          : 'windows-appcontainer-job-node');
  } finally {
    delete process.env.SDO_VALIDATION_SECRET_MARKER;
  }
});

test('unavailable native sandbox fails closed without direct-process fallback', (context) => {
  if (!['linux', 'darwin'].includes(process.platform)) return;
  const originalExists = fs.existsSync.bind(fs);
  context.mock.method(fs, 'existsSync', (candidate) =>
    (process.platform === 'linux' && candidate === '/usr/bin/bwrap') ||
    (process.platform === 'darwin' && /sdo-seatbelt-probe$/.test(candidate))
      ? false
      : originalExists(candidate));
  assert.throws(() => validate({
    selector: 'NODE_TEST_FILE',
    target: 'sample.test.js',
    grantEvaluation: issue(['sample.test.js'], {
      request: {
        action: 'NODE_TEST_FILE',
        scope: { selectors: ['NODE_TEST_FILE'], paths: ['sample.test.js'] }
      },
      authority: {
        action: 'NODE_TEST_FILE',
        scope: { selectors: ['NODE_TEST_FILE'], paths: ['sample.test.js'] }
      }
    })
  }), /Bubblewrap executable is unavailable|Seatbelt runtime is unavailable/);
});

test('Win32 NODE_TEST_FILE uses only the dedicated native containment adapter', () => {
  const source = fs.readFileSync(require.resolve(
    '../../accelerator/adapters/process-validation-adapter'), 'utf8');
  const windowsAdapter = fs.readFileSync(require.resolve(
    '../../accelerator/adapters/windows-node-test-sandbox-adapter'), 'utf8');
  assert.match(source, /win32: executeWindowsNodeTest/);
  assert.match(windowsAdapter, /Qualified native Win32 Node test helper is unavailable/);
  assert.doesNotMatch(source, /win32[\s\S]{0,160}spawnSync\(process\.execPath/);
});

test('Win32 helper unavailable blocks NODE_TEST_FILE before execution', {
  skip: process.platform !== 'win32'
}, () => {
  const helper = path.resolve(__dirname, '../../accelerator/native/windows/sdo-node-test-sandbox.exe');
  if (fs.existsSync(helper)) return;
  assert.throws(() => validate({
    selector: 'NODE_TEST_FILE',
    target: 'sandbox-adversarial.test.js',
    grantEvaluation: issue(['sandbox-adversarial.test.js'], {
      request: {
        action: 'NODE_TEST_FILE',
        scope: { selectors: ['NODE_TEST_FILE'], paths: ['sandbox-adversarial.test.js'] }
      },
      authority: {
        action: 'NODE_TEST_FILE',
        scope: { selectors: ['NODE_TEST_FILE'], paths: ['sandbox-adversarial.test.js'] }
      }
    })
  }), /Qualified Win32 NODE_TEST_FILE sandbox is unavailable/);
});

test('missing grant fails closed', () => {
  assert.throws(() => validate({ grantEvaluation: undefined }), /valid immutable ALLOWED/);
});

test('expired grant fails closed', () => {
  assert.throws(() => validate({ observedAt: EXPIRY }), /expired/);
});

test('operationId mismatch fails closed', () => {
  assert.throws(() => validate({ operationId: 'op-2' }), /operationId mismatch/);
});

test('workspace mismatch fails closed', () => {
  assert.throws(() => validate({ workspace: fs.realpathSync(os.tmpdir()) }), /workspace mismatch/);
});

test('invalid lifecycle state fails closed', () => {
  assert.throws(
    () => validate({ grantEvaluation: grantWith({ lifecycleState: 'COMPLETED' }) }),
    /does not permit bounded process validation/
  );
});

test('target outside granted scope fails closed', () => {
  assert.throws(() => validate({ target: 'other.js' }), /outside the authorized/);
});

test('parent traversal fails closed', () => {
  assert.throws(
    () => validate({ target: '../workspace-secret/secret.js' }),
    /escapes authorized workspace/
  );
});

test('symlink escape after grant issuance fails closed', () => {
  const link = path.join(workspace, 'link.js');
  fs.symlinkSync(path.join(workspace, 'valid.js'), link);
  const grantEvaluation = issue(['link.js']);
  fs.unlinkSync(link);
  fs.symlinkSync(path.join(sibling, 'secret.js'), link);
  assert.throws(
    () => validate({ target: 'link.js', grantEvaluation }),
    /escapes authorized workspace/
  );
});

test('unknown selector fails closed', () => {
  assert.throws(() => validate({ selector: 'PACKAGE_TEST' }), /Unknown or unauthorized/);
});

test('arbitrary executable injection attempt fails closed', () => {
  assert.throws(
    () => validateJavaScriptWithGrant({
      operationId: 'op-1', workspace, selector: 'NODE_SYNTAX_CHECK', target: 'valid.js',
      grantEvaluation: issue(), observedAt: NOW, executable: '/bin/sh'
    }),
    /executable, arguments or environment are forbidden/
  );
});

test('arbitrary argument injection attempt fails closed', () => {
  assert.throws(
    () => validateJavaScriptWithGrant({
      operationId: 'op-1', workspace, selector: 'NODE_SYNTAX_CHECK', target: 'valid.js',
      grantEvaluation: issue(), observedAt: NOW, args: ['-e', 'process.exit()']
    }),
    /executable, arguments or environment are forbidden/
  );
});

test('shell metacharacter target attempt fails closed', () => {
  assert.throws(() => validate({ target: 'valid.js; rm -rf x' }), /requires a \.js target/);
});

test('general process and shell capabilities remain denied', () => {
  for (const capabilityType of ['PROCESS_EXECUTE', 'SHELL_EXECUTE']) {
    assert.equal(issue(['valid.js'], {
      request: { capabilityType }, authority: { capabilityType }
    }).decision, 'DENIED');
  }
});

test('network credentials and package installation remain denied', () => {
  for (const capabilityType of ['NETWORK_ACCESS', 'CREDENTIAL_ACCESS', 'PACKAGE_INSTALL']) {
    assert.equal(issue(['valid.js'], {
      request: { capabilityType }, authority: { capabilityType }
    }).decision, 'DENIED');
  }
});

test('timeout fails closed', (context) => {
  context.mock.method(childProcess, 'spawnSync', () => ({
    error: Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
  }));
  assert.throws(() => validate(), /timed out/);
});

test('output overflow fails closed', (context) => {
  context.mock.method(childProcess, 'spawnSync', () => ({
    error: Object.assign(new Error('overflow'), { code: 'ENOBUFS' })
  }));
  assert.throws(() => validate(), /exceeded limit/);
});

test('validation evidence is deeply immutable', () => {
  const result = validate();
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.validation));
  assert.ok(Object.isFrozen(result.execution));
  assert.throws(() => { result.validation.status = 'PASSED'; }, TypeError);
});

test('FAILED result cannot become successful completion', () => {
  const result = validate({ target: 'invalid.js', grantEvaluation: issue(['invalid.js']) });
  assert.equal(result.validation.status, 'FAILED');
  assert.equal(result.validation.successfulCompletionEligible, false);
  assert.throws(() => { result.validation.successfulCompletionEligible = true; }, TypeError);
});
