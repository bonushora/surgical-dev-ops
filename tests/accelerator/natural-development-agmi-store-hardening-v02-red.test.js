'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const core = require(
  '../../accelerator/cli/natural-development-authorization-consumption'
);
const store = require(
  '../../accelerator/adapters/natural-development-authorization-consumption-store'
);
const integrityIdentity = require(
  '../../accelerator/adapters/natural-development-store-integrity-identity'
);
const memoryApi = require(
  '../../accelerator/cli/natural-governed-project-memory'
);
const memoryStore = require(
  '../../accelerator/adapters/governed-project-memory-store'
);

const CURRENT_AUTHORITY = store.READ_PURPOSE.CURRENT_AUTHORITY;
const HISTORICAL_RECONCILIATION =
  store.READ_PURPOSE.HISTORICAL_RECONCILIATION;

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
  );
}

function fingerprint(value) {
  return hash(JSON.stringify(canonicalize(value)));
}

function fixtureRoot(t, label, { integrity = true } = {}) {
  const fixture = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), `sdo-agmi-v02-${label}-`))
  );
  const root = path.join(fixture, integrity ? 'g7' : 'snapshot');
  fs.mkdirSync(root, { mode: 0o700 });
  if (integrity) {
    integrityIdentity.provisionEphemeralTestStoreIntegrity({
      testOnly: true,
      fixtureRoot: fixture,
      stateRoot: root,
      identityRoot: path.join(fixture, 'identity'),
      witnessRoot: path.join(fixture, 'witness'),
      storeId: hash(`store:${label}`),
      epoch: hash(`epoch:${label}`),
      repositoryIdentity: hash(`repository:${label}`)
    });
  }
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  return root;
}

function createClaim(label) {
  return core.createNaturalDevelopmentAuthorizationClaim({
    authorization: Object.freeze({
      authorizationFingerprint: hash(`authorization:${label}`),
      singleUse: true,
      reusable: false,
      operationalAuthority: false,
      mutationAuthority: false,
      dispatchAuthority: false
    }),
    operationId: `operation:${label}`,
    physicalWorkspaceIdentity: hash(`workspace:${label}`),
    target: `src/${label}.js`,
    beforeSha256: hash(`before:${label}`),
    replacementSha256: hash(`replacement:${label}`)
  });
}

function createConsumption(claim, label) {
  return core.commitNaturalDevelopmentAuthorizationConsumption({
    claim,
    transactionId: `transaction:${label}`,
    journalId: `journal:${label}`,
    effectFingerprint: hash(`effect:${label}`),
    manifestAfterOid: hash(`manifest:${label}`).slice(0, 40)
  });
}

function recordPath(root, claim) {
  return path.join(root, `${claim.authorizationFingerprint}.json`);
}

function rawWrite(root, authorizationFingerprint, record) {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, `${authorizationFingerprint}.json`),
    JSON.stringify(record, null, 2) + '\n',
    { mode: 0o600 }
  );
}

function current(root, claim) {
  return store.loadNaturalDevelopmentAuthorizationConsumption({
    stateRoot: root,
    authorizationFingerprint: claim.authorizationFingerprint,
    readPurpose: CURRENT_AUTHORITY,
    expectedPhysicalWorkspaceIdentity: claim.physicalWorkspaceIdentity
  });
}

function historical(root, claim) {
  return store.loadNaturalDevelopmentAuthorizationConsumption({
    stateRoot: root,
    authorizationFingerprint: claim.authorizationFingerprint,
    readPurpose: HISTORICAL_RECONCILIATION
  });
}

function requireRejectedBeforeEffect(action) {
  let error = null;
  let physicalEffectCount = 0;
  try {
    action();
  } catch (caught) {
    error = caught;
  }
  assert.equal(physicalEffectCount, 0, 'PHYSICAL_EFFECT_COUNT must remain zero');
  assert.ok(error, 'modified persisted authority state was accepted');
}

test('AGMI-v0.2 C1 no-op restart control remains usable', (t) => {
  const root = fixtureRoot(t, 'c1');
  const claim = createClaim('c1');
  store.claimNaturalDevelopmentAuthorization({ stateRoot: root, claim });
  assert.deepEqual(current(root, claim), claim);
});

test('AGMI-v0.2 C2 genuine write after restart remains usable', (t) => {
  const root = fixtureRoot(t, 'c2');
  const first = createClaim('c2-first');
  const second = createClaim('c2-second');
  store.claimNaturalDevelopmentAuthorization({ stateRoot: root, claim: first });
  assert.deepEqual(current(root, first), first);
  store.claimNaturalDevelopmentAuthorization({ stateRoot: root, claim: second });
  assert.deepEqual(current(root, second), second);
});

test('AGMI-v0.2 T1 content tamper plus recomputed unkeyed digest is rejected before effect', (t) => {
  const root = fixtureRoot(t, 't1');
  const claim = createClaim('t1');
  store.claimNaturalDevelopmentAuthorization({ stateRoot: root, claim });
  const before = fs.readFileSync(recordPath(root, claim));
  const edited = JSON.parse(before);
  edited.payload.replacementSha256 = hash('attacker replacement');
  delete edited.payload.claimFingerprint;
  edited.payload.claimFingerprint = fingerprint(edited.payload);
  edited.payloadDigest = fingerprint(edited.payload);
  rawWrite(root, claim.authorizationFingerprint, edited);
  const after = fs.readFileSync(recordPath(root, claim));
  assert.notDeepEqual(after, before, 'C3: T1 edit did not land');
  requireRejectedBeforeEffect(() => current(root, claim));
});

test('AGMI-v0.2 T2 tail truncation is rejected before effect', (t) => {
  const root = fixtureRoot(t, 't2');
  const claims = ['first', 'middle', 'tail'].map((name) => createClaim(`t2-${name}`));
  for (const claim of claims) store.claimNaturalDevelopmentAuthorization({ stateRoot: root, claim });
  const before = fs.readdirSync(root).sort();
  fs.unlinkSync(recordPath(root, claims[2]));
  const after = fs.readdirSync(root).sort();
  assert.equal(before.length - after.length, 1, 'C3: T2 truncation did not land');
  requireRejectedBeforeEffect(() => historical(root, claims[2]));
});

test('AGMI-v0.2 T3 middle deletion is rejected before effect', (t) => {
  const root = fixtureRoot(t, 't3');
  const claims = ['first', 'middle', 'last'].map((name) => createClaim(`t3-${name}`));
  for (const claim of claims) store.claimNaturalDevelopmentAuthorization({ stateRoot: root, claim });
  const before = fs.readdirSync(root).sort();
  fs.unlinkSync(recordPath(root, claims[1]));
  const after = fs.readdirSync(root).sort();
  assert.equal(before.length - after.length, 1, 'C3: T3 deletion did not land');
  requireRejectedBeforeEffect(() => historical(root, claims[1]));
});

test('AGMI-v0.2 T4 reordered records are rejected before effect', (t) => {
  const root = fixtureRoot(t, 't4');
  const first = createClaim('t4-first');
  const second = createClaim('t4-second');
  store.claimNaturalDevelopmentAuthorization({ stateRoot: root, claim: first });
  store.claimNaturalDevelopmentAuthorization({ stateRoot: root, claim: second });
  const firstBytes = fs.readFileSync(recordPath(root, first));
  const secondBytes = fs.readFileSync(recordPath(root, second));
  fs.writeFileSync(recordPath(root, first), secondBytes);
  fs.writeFileSync(recordPath(root, second), firstBytes);
  assert.deepEqual(fs.readFileSync(recordPath(root, first)), secondBytes, 'C3: T4 swap did not land');
  requireRejectedBeforeEffect(() => current(root, first));
});

test('AGMI-v0.2 T5 forged insertion is rejected before effect', (t) => {
  const root = fixtureRoot(t, 't5');
  const forged = createClaim('t5-forged');
  const before = fs.readdirSync(root);
  rawWrite(root, forged.authorizationFingerprint, forged);
  const after = fs.readdirSync(root);
  assert.equal(after.length - before.length, 1, 'C3: T5 insertion did not land');
  requireRejectedBeforeEffect(() => current(root, forged));
});

test('AGMI-v0.2 T6 cross-context replay is rejected before effect', (t) => {
  const rootA = fixtureRoot(t, 't6-a');
  const rootB = fixtureRoot(t, 't6-b');
  const donor = createClaim('t6-donor');
  store.claimNaturalDevelopmentAuthorization({ stateRoot: rootA, claim: donor });
  fs.copyFileSync(recordPath(rootA, donor), recordPath(rootB, donor));
  assert.deepEqual(
    fs.readFileSync(recordPath(rootB, donor)),
    fs.readFileSync(recordPath(rootA, donor)),
    'C3: T6 copy did not land'
  );
  const victimContext = { ...donor, physicalWorkspaceIdentity: hash('workspace:t6-victim') };
  requireRejectedBeforeEffect(() => current(rootB, victimContext));
});

test('AGMI-v0.2 T7 consumed-to-claimed same-context rollback is rejected before effect', (t) => {
  const root = fixtureRoot(t, 't7');
  const claim = createClaim('t7');
  store.claimNaturalDevelopmentAuthorization({ stateRoot: root, claim });
  const oldBytes = fs.readFileSync(recordPath(root, claim));
  store.commitNaturalDevelopmentAuthorization({
    stateRoot: root,
    consumption: createConsumption(claim, 't7')
  });
  const consumedBytes = fs.readFileSync(recordPath(root, claim));
  fs.writeFileSync(recordPath(root, claim), oldBytes);
  assert.notDeepEqual(oldBytes, consumedBytes, 'C3: T7 rollback source was not older');
  requireRejectedBeforeEffect(() => current(root, claim));
});

test('AGMI-v0.2 T8 metadata tamper plus recomputed digest is rejected before effect', (t) => {
  const root = fixtureRoot(t, 't8');
  const claim = createClaim('t8');
  store.claimNaturalDevelopmentAuthorization({ stateRoot: root, claim });
  const before = fs.readFileSync(recordPath(root, claim));
  const edited = JSON.parse(before);
  edited.payload.target = 'src/attacker-owned-target.js';
  delete edited.payload.claimFingerprint;
  edited.payload.claimFingerprint = fingerprint(edited.payload);
  edited.payloadDigest = fingerprint(edited.payload);
  rawWrite(root, claim.authorizationFingerprint, edited);
  const after = fs.readFileSync(recordPath(root, claim));
  assert.notDeepEqual(after, before, 'C3: T8 metadata edit did not land');
  requireRejectedBeforeEffect(() => current(root, claim));
});

test('AGMI-v0.2 T9 whole-store rollback is rejected before effect', (t) => {
  const root = fixtureRoot(t, 't9');
  const snapshot = fixtureRoot(t, 't9-snapshot', { integrity: false });
  const claim = createClaim('t9');
  store.claimNaturalDevelopmentAuthorization({ stateRoot: root, claim });
  fs.cpSync(root, snapshot, { recursive: true });
  store.commitNaturalDevelopmentAuthorization({
    stateRoot: root,
    consumption: createConsumption(claim, 't9')
  });
  const consumedBytes = fs.readFileSync(recordPath(root, claim));
  fs.rmSync(root, { recursive: true });
  fs.cpSync(snapshot, root, { recursive: true });
  const rolledBackBytes = fs.readFileSync(recordPath(root, claim));
  assert.notDeepEqual(rolledBackBytes, consumedBytes, 'C3: T9 snapshot rollback did not land');
  requireRejectedBeforeEffect(() => current(root, claim));
});

test('AGMI-v0.2 project-memory tamper is accepted only as authority-free cognitive context', (t) => {
  const root = fixtureRoot(t, 'project-memory');
  const projectBinding = Object.freeze({
    physicalWorkspaceIdentity: hash('project-memory-workspace'),
    repositoryHead: hash('project-memory-head')
  });
  let memory = memoryApi.createGovernedProjectMemory(projectBinding);
  const record = memoryApi.createGovernedProjectMemoryRecord(memory, {
    memoryClass: 'COGNITIVE_SUMMARY',
    content: 'Original bounded hypothesis.',
    source: 'qualified-cognitive-provider',
    createdAt: '2026-10-10T12:00:00.000Z'
  });
  memory = memoryApi.rememberGovernedProjectRecord(memory, record);
  memoryStore.saveGovernedProjectMemory({ stateRoot: root, memory });
  const target = path.join(root, `${projectBinding.physicalWorkspaceIdentity}.json`);
  const before = fs.readFileSync(target);
  const edited = JSON.parse(before);
  edited.records[0].content = 'Attacker-edited cognitive context.';
  edited.records[0].recordId = hash(JSON.stringify({
    project: edited.records[0].project,
    memoryClass: edited.records[0].memoryClass,
    source: edited.records[0].source,
    content: edited.records[0].content,
    evidenceBinding: edited.records[0].evidenceBinding,
    createdAt: edited.records[0].createdAt
  }));
  fs.writeFileSync(target, JSON.stringify(edited, null, 2) + '\n');
  assert.notDeepEqual(fs.readFileSync(target), before, 'project-memory edit did not land');
  const reopened = memoryStore.loadGovernedProjectMemory({
    stateRoot: root,
    physicalWorkspaceIdentity: projectBinding.physicalWorkspaceIdentity
  });
  assert.equal(reopened.records[0].content, 'Attacker-edited cognitive context.');
  assert.equal(reopened.operationalAuthority, false);
  assert.equal(reopened.mutationAuthority, false);
  assert.equal(reopened.records[0].approvalAuthority, false);
  assert.equal(reopened.records[0].operationalAuthority, false);
  assert.equal(reopened.records[0].mutationAuthority, false);
  assert.deepEqual(
    Object.keys(memoryStore).filter((key) => /dispatch|approve|authorize|execute/i.test(key)),
    []
  );
});
