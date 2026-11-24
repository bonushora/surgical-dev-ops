'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { provisionEphemeralTestStoreIntegrity } =
  require('../../accelerator/adapters/natural-development-store-integrity-identity');

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function provision(fixtureRoot, stateRoot, identityRoot, witnessRoot) {
  return provisionEphemeralTestStoreIntegrity({
    testOnly: true,
    fixtureRoot,
    stateRoot,
    identityRoot,
    witnessRoot,
    storeId: sha('test-store'),
    epoch: sha('test-epoch'),
    repositoryIdentity: sha('test-repository')
  });
}

test('test-only integrity provisioning binds lexical paths to physical fixture ancestry', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-physical-fixture-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  // Mix lexical and physically resolved aliases of the same safe fixture.
  const state = path.join(fs.realpathSync(root), 'nested', 'state');
  const identity = path.join(root, 'identity');
  const witness = path.join(root, 'witness');
  const evidence = provision(root, state, identity, witness);
  assert.equal(evidence.stateRoot, fs.realpathSync(state));
  assert.equal(evidence.operationalAuthority, false);
  assert.equal(evidence.mutationAuthority, false);
  assert.equal(evidence.dispatchAuthority, false);
  assert.equal(evidence.approvalAuthority, false);
  const physicalFixture = fs.realpathSync(root);
  assert.equal(path.relative(physicalFixture, evidence.stateRoot).startsWith('..'), false);
});

test('integrity provisioning refuses lexical fixture escapes before creating directories', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-fixture-reject-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outside = path.join(path.dirname(root), 'external-state-forbidden');
  assert.throws(
    () => provision(root, outside, path.join(root, 'identity'), path.join(root, 'witness')),
    /inside the isolated fixture/
  );
  assert.equal(fs.existsSync(outside), false);
});

test('integrity provisioning refuses symlinked descendants before writing identity', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-fixture-symlink-'));
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-fixture-target-'));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(external, { recursive: true, force: true });
  });
  const link = path.join(root, 'link');
  try {
    fs.symlinkSync(external, link, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    // This is a platform capability limitation, not a passing negative test.
    t.skip(`Unable to create test symlink: ${error.code || 'unknown'}`);
    return;
  }
  assert.throws(
    () => provision(root, path.join(link, 'nested'), path.join(root, 'identity'), path.join(root, 'witness')),
    /inside the isolated fixture/
  );
  assert.equal(fs.existsSync(path.join(external, 'nested')), false);
});
