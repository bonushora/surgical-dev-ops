'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const core = require('../../accelerator/cli/natural-development-authorization-consumption');
const store = require('../../accelerator/adapters/natural-development-authorization-consumption-store');
const identity = require('../../accelerator/adapters/natural-development-store-integrity-identity');
const witness = require('../../accelerator/adapters/natural-development-monotonic-witness');
const transition = require('../../accelerator/adapters/natural-development-store-transition');

const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');

function fixture(t, label) {
  const fixturePath = fs.mkdtempSync(path.join(os.tmpdir(), `sdo-store-integrity-${label}-`));
  const fixtureRoot = fs.realpathSync(fixturePath);
  const stateRoot = path.join(fixtureRoot, 'g7');
  fs.mkdirSync(stateRoot, { mode: 0o700 });
  identity.provisionEphemeralTestStoreIntegrity({
    testOnly: true,
    fixtureRoot,
    stateRoot,
    identityRoot: path.join(fixtureRoot, 'identity'),
    witnessRoot: path.join(fixtureRoot, 'witness'),
    storeId: sha(`store:${label}:${fixtureRoot}`),
    epoch: sha(`epoch:${label}:${fixtureRoot}`),
    repositoryIdentity: sha(`repository:${label}:${fixtureRoot}`)
  });
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));
  return { fixtureRoot, stateRoot, context: identity.loadIntegrityContext(stateRoot) };
}

function claim(label) {
  return core.createNaturalDevelopmentAuthorizationClaim({
    authorization: Object.freeze({
      authorizationFingerprint: sha(`authorization:${label}`),
      singleUse: true,
      reusable: false,
      operationalAuthority: false,
      mutationAuthority: false,
      dispatchAuthority: false
    }),
    operationId: `operation:${label}`,
    physicalWorkspaceIdentity: sha(`workspace:${label}`),
    target: `src/${label}.js`,
    beforeSha256: sha(`before:${label}`),
    replacementSha256: sha(`replacement:${label}`)
  });
}

function current(stateRoot, value) {
  return store.loadNaturalDevelopmentAuthorizationConsumption({
    stateRoot,
    authorizationFingerprint: value.authorizationFingerprint,
    readPurpose: store.READ_PURPOSE.CURRENT_AUTHORITY,
    expectedPhysicalWorkspaceIdentity: value.physicalWorkspaceIdentity
  });
}

function candidate(fixtureValue, payload) {
  const committed = witness.loadCommittedState(fixtureValue.context);
  const base = transition.baseEnvelope({
    context: fixtureValue.context,
    generation: committed.generation + 1,
    previousHead: committed.headDigest,
    payload,
    transitionType: 'CLAIM'
  });
  const storeRoot = transition.computeStoreRoot([base]);
  const envelope = transition.finalizeEnvelope({
    base,
    storeRoot,
    sign: (unsigned) => identity.signStoreTransition(fixtureValue.context, unsigned)
  });
  return { committed, envelope };
}

function publishEnvelope(stateRoot, envelope) {
  fs.writeFileSync(
    path.join(stateRoot, `${envelope.authorizationFingerprint}.json`),
    JSON.stringify(envelope, null, 2) + '\n',
    { mode: 0o600 }
  );
}

test('store-integrity identity is purpose-separated and exposes no authority surface', (t) => {
  const value = fixture(t, 'identity');
  assert.equal(value.context.purpose, 'sdo.store-integrity/v1');
  assert.notEqual(value.context.identityRoot, value.stateRoot);
  assert.notEqual(value.context.witnessRoot, value.stateRoot);
  assert.deepEqual(
    Object.keys(identity).filter((key) => /approve|dispatch|execute|provider|tool|recover|publish/i.test(key)),
    []
  );
  const metadata = identity.loadKeyMetadata(value.context, { requireActive: true });
  assert.equal(metadata.algorithm, 'Ed25519');
  assert.equal(metadata.lifecycle, 'ACTIVE');
  assert.equal(metadata.purpose, 'sdo.store-integrity/v1');
});

test('canonical encoding has a fixed byte-level vector and rejects ambiguous numbers', () => {
  const vector = { z: ['á', 2], a: { y: true, x: null } };
  assert.equal(
    transition.canonicalBytes(vector).toString('utf8'),
    '{"a":{"x":null,"y":true},"z":["á",2]}'
  );
  assert.equal(
    transition.digest(vector),
    '71aa648a5a3e0652a971d6bfc4f3dde771de672fbfc4d2763857e50ca4f35af3'
  );
  assert.throws(() => transition.canonicalBytes({ value: 1.5 }), /safe integers/i);
});

test('legacy unkeyed records remain historical-only and cannot become current authority', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-store-integrity-legacy-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const value = claim('legacy');
  fs.writeFileSync(
    path.join(root, `${value.authorizationFingerprint}.json`),
    JSON.stringify(value, null, 2) + '\n',
    { mode: 0o600 }
  );
  const historical = store.loadNaturalDevelopmentAuthorizationConsumption({
    stateRoot: root,
    authorizationFingerprint: value.authorizationFingerprint,
    readPurpose: store.READ_PURPOSE.HISTORICAL_RECONCILIATION
  });
  assert.equal(historical.claimFingerprint, value.claimFingerprint);
  assert.throws(() => current(root, value), /legacy unverified|integrity context/i);
});

test('an empty test-only G7 claim provisions independent identity and witness siblings once', (t) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-store-integrity-autobootstrap-'));
  const journalRoot = path.join(fixtureRoot, 'journal');
  const stateRoot = path.join(journalRoot, '.natural-development-authorization-consumption');
  fs.mkdirSync(journalRoot, { mode: 0o700 });
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));
  const authorization = claim('autobootstrap');

  const receipt = store.claimNaturalDevelopmentAuthorization({ stateRoot, claim: authorization });
  const context = identity.loadIntegrityContext(stateRoot);

  assert.equal(receipt.state, 'CLAIMED');
  assert.equal(context.repositoryIdentity, authorization.physicalWorkspaceIdentity);
  assert.equal(path.dirname(context.identityRoot), journalRoot);
  assert.equal(path.dirname(context.witnessRoot), journalRoot);
  assert.notEqual(context.identityRoot, stateRoot);
  assert.notEqual(context.witnessRoot, stateRoot);
  assert.equal(current(stateRoot, authorization).claimFingerprint, authorization.claimFingerprint);
});

test('a non-empty context-free G7 store is never implicitly provisioned or migrated', (t) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-store-integrity-no-migration-'));
  const journalRoot = path.join(fixtureRoot, 'journal');
  const stateRoot = path.join(journalRoot, '.natural-development-authorization-consumption');
  fs.mkdirSync(stateRoot, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(stateRoot, 'unknown.json'), '{}\n', { mode: 0o600 });
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

  assert.throws(
    () => store.claimNaturalDevelopmentAuthorization({ stateRoot, claim: claim('no-migration') }),
    /non-empty G7 store without integrity context/i
  );
  assert.equal(fs.existsSync(identity.contextPathForStateRoot(stateRoot)), false);
});

test('missing corrupt forked or unknown witness state blocks authority without repair', (t) => {
  for (const mode of ['missing', 'corrupt', 'unknown']) {
    const value = fixture(t, `witness-${mode}`);
    const authorization = claim(`witness-${mode}`);
    store.claimNaturalDevelopmentAuthorization({ stateRoot: value.stateRoot, claim: authorization });
    if (mode === 'missing') fs.unlinkSync(path.join(value.context.witnessRoot, 'current.json'));
    if (mode === 'corrupt') fs.writeFileSync(path.join(value.context.witnessRoot, 'current.json'), '{not-json\n');
    if (mode === 'unknown') fs.writeFileSync(path.join(value.context.witnessRoot, 'fork.json'), '{}\n');
    assert.throws(() => current(value.stateRoot, authorization));
  }
});

test('PREPARED before store publication blocks authority and a competing writer', (t) => {
  const value = fixture(t, 'prepared-before-store');
  const authorization = claim('prepared-before-store');
  const { committed, envelope } = candidate(value, authorization);
  witness.prepareTransition(value.context, { expected: committed, envelope });
  assert.throws(
    () => store.loadNaturalDevelopmentAuthorizationConsumption({
      stateRoot: value.stateRoot,
      authorizationFingerprint: authorization.authorizationFingerprint,
      readPurpose: store.READ_PURPOSE.HISTORICAL_RECONCILIATION
    }),
    /outstanding PREPARED/i
  );
  assert.throws(
    () => witness.prepareTransition(value.context, { expected: committed, envelope }),
    /PREPARED|contention/i
  );
});

test('exact prepared store publication can commit once and retry idempotently', (t) => {
  const value = fixture(t, 'prepared-store');
  const authorization = claim('prepared-store');
  const { committed, envelope } = candidate(value, authorization);
  const prepared = witness.prepareTransition(value.context, { expected: committed, envelope });
  publishEnvelope(value.stateRoot, envelope);
  assert.throws(() => current(value.stateRoot, authorization), /outstanding PREPARED/i);
  const first = witness.commitPreparedTransition(value.context, prepared);
  const second = witness.commitPreparedTransition(value.context, prepared);
  assert.deepEqual(second, first);
  assert.equal(current(value.stateRoot, authorization).state, 'CLAIMED');
});

test('a committed witness newer than the store is fail-closed', (t) => {
  const value = fixture(t, 'witness-ahead');
  const authorization = claim('witness-ahead');
  const { committed, envelope } = candidate(value, authorization);
  const prepared = witness.prepareTransition(value.context, { expected: committed, envelope });
  witness.commitPreparedTransition(value.context, prepared);
  assert.throws(
    () => current(value.stateRoot, authorization),
    /whole-store root/i
  );
});

test('fsync uncertainty leaves a blocking prepared transition and never reports success', (t) => {
  const value = fixture(t, 'fsync');
  const authorization = claim('fsync');
  const original = fs.fsyncSync;
  fs.fsyncSync = () => { throw new Error('test-only fsync failure'); };
  try {
    assert.throws(
      () => store.claimNaturalDevelopmentAuthorization({ stateRoot: value.stateRoot, claim: authorization }),
      /fsync failure/i
    );
  } finally {
    fs.fsyncSync = original;
  }
  assert.throws(
    () => current(value.stateRoot, authorization),
    /PREPARED|witness|root/i
  );
});

test('missing private key and interrupted rotation or revocation block authority use', (t) => {
  for (const mode of ['missing-private', 'rotating', 'revoked']) {
    const value = fixture(t, `key-${mode}`);
    const authorization = claim(`key-${mode}`);
    store.claimNaturalDevelopmentAuthorization({ stateRoot: value.stateRoot, claim: authorization });
    if (mode === 'missing-private') {
      fs.unlinkSync(path.join(value.context.identityRoot, 'private-key.pkcs8.pem'));
    } else {
      const target = path.join(value.context.identityRoot, 'key-lifecycle.json');
      const metadata = JSON.parse(fs.readFileSync(target, 'utf8'));
      metadata.lifecycle = mode === 'rotating' ? 'ROTATING' : 'REVOKED';
      fs.writeFileSync(target, JSON.stringify(metadata, null, 2) + '\n');
    }
    assert.throws(() => current(value.stateRoot, authorization), /key|signer|lifecycle|active/i);
  }
});

test('POSIX signer admission still rejects group or other access to the private key', (t) => {
  if (process.platform === 'win32') return t.skip('POSIX mode-bit policy does not apply on Windows.');
  const value = fixture(t, 'private-key-mode');
  const target = path.join(value.context.identityRoot, 'private-key.pkcs8.pem');
  fs.chmodSync(target, 0o640);
  assert.throws(
    () => identity.assertActiveSignerAvailable(value.context),
    /private key is unavailable or unsafe/i
  );
});

test('restoring an older witness cannot promote a newer store or reset its baseline', (t) => {
  const value = fixture(t, 'witness-rollback');
  const first = claim('witness-rollback-first');
  const second = claim('witness-rollback-second');
  store.claimNaturalDevelopmentAuthorization({ stateRoot: value.stateRoot, claim: first });
  const backup = path.join(value.fixtureRoot, 'witness-backup');
  fs.cpSync(value.context.witnessRoot, backup, { recursive: true });
  store.claimNaturalDevelopmentAuthorization({ stateRoot: value.stateRoot, claim: second });
  fs.rmSync(value.context.witnessRoot, { recursive: true });
  fs.cpSync(backup, value.context.witnessRoot, { recursive: true });
  assert.throws(() => current(value.stateRoot, second), /newer than|whole-store root|witness/i);
});

test('lost witness is never reconstructed from an otherwise valid G7 store', (t) => {
  const value = fixture(t, 'lost-witness');
  const authorization = claim('lost-witness');
  store.claimNaturalDevelopmentAuthorization({ stateRoot: value.stateRoot, claim: authorization });
  fs.rmSync(value.context.witnessRoot, { recursive: true });
  assert.throws(() => current(value.stateRoot, authorization));
  assert.equal(fs.existsSync(value.context.witnessRoot), false);
});
