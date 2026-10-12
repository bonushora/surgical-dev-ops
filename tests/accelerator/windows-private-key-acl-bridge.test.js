'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  AUTHORIZED_PRINCIPALS,
  createWindowsPrivateKeyAclBridge
} = require('../../accelerator/adapters/windows-private-key-acl-bridge');

function fakeFs({ helperAvailable = true } = {}) {
  return {
    statSync() {
      if (!helperAvailable) throw new Error('missing');
      return { isFile: () => true };
    },
    lstatSync() {
      return { isFile: () => true, isSymbolicLink: () => false };
    }
  };
}

function evidence(operation, subject) {
  return JSON.stringify({
    schema: 'sdo.windows_private_key_acl_helper.v1',
    decision: 'CONFIRMED',
    operation,
    primitive: operation === 'PROTECT_PRIVATE_KEY_ACL'
      ? 'CreateFileW+SetSecurityInfo+GetSecurityInfo'
      : 'CreateFileW+GetSecurityInfo',
    ownerPolicy: 'CURRENT_PROCESS_USER',
    daclPolicy: 'PROTECTED_AUTHORIZED_PRINCIPALS_ONLY',
    authorizedPrincipalClasses: AUTHORIZED_PRINCIPALS,
    aceCount: 3,
    volumeSerialNumber: 123,
    fileIndex: '456',
    subject
  });
}

test('Windows private-key ACL bridge invokes only fixed helper operations and validates bound evidence', () => {
  const calls = [];
  const processPort = {
    spawnSync(executable, args, options) {
      calls.push({ executable, args, options });
      const operation = args[0] === 'protect-private-key-acl'
        ? 'PROTECT_PRIVATE_KEY_ACL'
        : 'VERIFY_PRIVATE_KEY_ACL';
      return { status: 0, signal: null, stdout: evidence(operation, args[1]), stderr: '' };
    }
  };
  const bridge = createWindowsPrivateKeyAclBridge({
    platform: 'win32', fsPort: fakeFs(), processPort
  });

  assert.equal(bridge.protectPrivateKey('C:\\trusted\\private.pem').decision, 'CONFIRMED');
  assert.equal(bridge.verifyPrivateKey('C:\\trusted\\private.pem').decision, 'CONFIRMED');
  assert.deepEqual(calls.map((call) => call.args), [
    ['protect-private-key-acl', 'C:\\trusted\\private.pem'],
    ['verify-private-key-acl', 'C:\\trusted\\private.pem']
  ]);
  for (const call of calls) {
    assert.match(call.executable, /sdo-fs-durability\.exe$/);
    assert.equal(call.options.shell, false);
    assert.equal(call.options.stdio[0], 'ignore');
  }
});

test('Windows private-key ACL bridge rejects helper failure and ambiguous evidence', () => {
  const failed = createWindowsPrivateKeyAclBridge({
    platform: 'win32', fsPort: fakeFs(),
    processPort: { spawnSync: () => ({ status: 2, signal: null, stdout: '{}', stderr: '' }) }
  });
  assert.throws(
    () => failed.verifyPrivateKey('C:\\trusted\\private.pem'),
    /failed closed/i
  );

  const ambiguous = createWindowsPrivateKeyAclBridge({
    platform: 'win32', fsPort: fakeFs(),
    processPort: {
      spawnSync(executable, args) {
        const value = JSON.parse(evidence('VERIFY_PRIVATE_KEY_ACL', args[1]));
        value.authorizedPrincipalClasses = [...AUTHORIZED_PRINCIPALS, 'EVERYONE'];
        return { status: 0, signal: null, stdout: JSON.stringify(value), stderr: '' };
      }
    }
  });
  assert.throws(
    () => ambiguous.verifyPrivateKey('C:\\trusted\\private.pem'),
    /invalid or unbound/i
  );
});

test('Windows private-key ACL bridge fails closed when helper is unavailable', () => {
  const bridge = createWindowsPrivateKeyAclBridge({
    platform: 'win32', fsPort: fakeFs({ helperAvailable: false })
  });
  assert.equal(bridge.available(), false);
  assert.throws(
    () => bridge.verifyPrivateKey('C:\\trusted\\private.pem'),
    /helper is unavailable/i
  );
});

const ACL_MUTATION_SCRIPT = `
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Target,
  [Parameter(Mandatory = $true)]
  [ValidateSet('broad', 'unexpected-owner')][string]$Mode
)
$ErrorActionPreference = 'Stop'
$sidType = [System.Security.Principal.SecurityIdentifier]
$current = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$acl = Get-Acl -LiteralPath $Target -ErrorAction Stop
$ownerBefore = $acl.GetOwner($sidType).Value
$aceCountBefore = @($acl.Access).Count
if ($Mode -eq 'broad') {
  $everyone = [System.Security.Principal.SecurityIdentifier]::new('S-1-1-0')
  $read = [System.Security.AccessControl.FileSystemAccessRule]::new(
    $everyone,
    [System.Security.AccessControl.FileSystemRights]::Read,
    [System.Security.AccessControl.AccessControlType]::Allow
  )
  $acl.AddAccessRule($read)
} else {
  $unexpectedOwner = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
  $acl.SetOwner($unexpectedOwner)
}
Set-Acl -LiteralPath $Target -AclObject $acl -ErrorAction Stop
$after = Get-Acl -LiteralPath $Target -ErrorAction Stop
$ownerAfter = $after.GetOwner($sidType).Value
$readMask = [int][System.Security.AccessControl.FileSystemRights]::Read
$everyoneReadAllow = @($after.Access | Where-Object {
  $_.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow -and
  $_.IdentityReference.Translate($sidType).Value -eq 'S-1-1-0' -and
  (([int]$_.FileSystemRights -band $readMask) -eq $readMask)
}).Count -gt 0
[pscustomobject]@{
  mode = $Mode
  currentUserSid = $current.Value
  ownerBefore = $ownerBefore
  ownerAfter = $ownerAfter
  aceCountBefore = $aceCountBefore
  aceCountAfter = @($after.Access).Count
  everyoneReadAllow = $everyoneReadAllow
} | ConvertTo-Json -Compress
`;

function replaceAcl(root, target, mode) {
  const scriptPath = path.join(root, 'mutate-private-key-acl.ps1');
  fs.writeFileSync(scriptPath, ACL_MUTATION_SCRIPT, { encoding: 'utf8', mode: 0o600 });
  const stdout = childProcess.execFileSync(
    'powershell.exe',
    [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath, '-Target', target, '-Mode', mode
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const result = JSON.parse(stdout.trim());
  assert.equal(result.mode, mode);
  assert.equal(result.ownerBefore, result.currentUserSid);
  if (mode === 'broad') {
    assert.equal(result.everyoneReadAllow, true);
    assert.ok(result.aceCountAfter > result.aceCountBefore);
  } else {
    assert.notEqual(result.ownerAfter, result.currentUserSid);
    assert.equal(result.ownerAfter, 'S-1-5-32-544');
  }
  return result;
}

function nativeFixture(t, label) {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), `sdo-private-key-acl-${label}-`))
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, 'private-key.pkcs8.pem');
  fs.writeFileSync(target, 'test-private-key\n');
  return { root, target };
}

test('native Windows helper accepts its restricted private-key ACL', (t) => {
  if (process.platform !== 'win32') return t.skip('Windows-only native ACL qualification.');
  const { target } = nativeFixture(t, 'restricted');
  const bridge = createWindowsPrivateKeyAclBridge();
  assert.equal(bridge.available(), true);
  assert.equal(bridge.protectPrivateKey(target).decision, 'CONFIRMED');
  assert.equal(bridge.verifyPrivateKey(target).decision, 'CONFIRMED');
});

test('native Windows helper rejects a broad private-key ACL', (t) => {
  if (process.platform !== 'win32') return t.skip('Windows-only native ACL qualification.');
  const { root, target } = nativeFixture(t, 'broad');
  const bridge = createWindowsPrivateKeyAclBridge();
  bridge.protectPrivateKey(target);
  replaceAcl(root, target, 'broad');
  assert.throws(() => bridge.verifyPrivateKey(target), /failed closed/i);
});

test('native Windows helper rejects an unexpected private-key owner', (t) => {
  if (process.platform !== 'win32') return t.skip('Windows-only native ACL qualification.');
  const { root, target } = nativeFixture(t, 'owner');
  const bridge = createWindowsPrivateKeyAclBridge();
  bridge.protectPrivateKey(target);
  replaceAcl(root, target, 'unexpected-owner');
  assert.throws(() => bridge.verifyPrivateKey(target), /failed closed/i);
});

test('native Windows helper rejects a final-component reparse point', (t) => {
  if (process.platform !== 'win32') return t.skip('Windows-only native ACL qualification.');
  const { root, target } = nativeFixture(t, 'reparse');
  const bridge = createWindowsPrivateKeyAclBridge();
  bridge.protectPrivateKey(target);
  const link = path.join(root, 'private-key-link.pem');
  fs.symlinkSync(target, link, 'file');
  const result = childProcess.spawnSync(
    bridge.helperPath,
    ['verify-private-key-acl', link],
    { shell: false, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  assert.notEqual(result.status, 0);
});

test('native ACL helper source uses structured Win32 security descriptors, not icacls text', () => {
  const source = fs.readFileSync(path.join(
    __dirname, '..', '..', 'accelerator', 'native', 'windows', 'sdo-fs-durability.cpp'
  ), 'utf8');
  assert.match(source, /GetSecurityInfo/);
  assert.match(source, /SetSecurityInfo/);
  assert.match(source, /GetAce/);
  assert.match(source, /EqualSid/);
  assert.match(source, /FILE_FLAG_OPEN_REPARSE_POINT/);
  assert.doesNotMatch(source, /icacls|CreateProcess|WinExec|ShellExecute|system\s*\(/i);
});
