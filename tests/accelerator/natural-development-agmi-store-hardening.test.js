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

const CURRENT_AUTHORITY = 'CURRENT_AUTHORITY';
const HISTORICAL_RECONCILIATION = 'HISTORICAL_RECONCILIATION';

function hash(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

function fingerprint(value) {
  return hash(JSON.stringify(canonicalize(value)));
}

function fixtureRoot(t, label = 'store') {
  const value = fs.mkdtempSync(
    path.join(os.tmpdir(), `sdo-agmi-${label}-`)
  );
  t.after(() => fs.rmSync(value, { recursive: true, force: true }));
  return value;
}

function createClaim(label, overrides = {}) {
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
    physicalWorkspaceIdentity: hash(`physical-workspace:${label}`),
    target: `src/${label}.js`,
    beforeSha256: hash(`before:${label}`),
    replacementSha256: hash(`replacement:${label}`),
    ...overrides
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

function recordPath(stateRoot, authorizationFingerprint) {
  return path.join(stateRoot, `${authorizationFingerprint}.json`);
}

function writeRecord(stateRoot, authorizationFingerprint, record) {
  fs.writeFileSync(
    recordPath(stateRoot, authorizationFingerprint),
    JSON.stringify(record, null, 2) + '\n',
    { mode: 0o600 }
  );
}

function loadHistorical(stateRoot, authorizationFingerprint) {
  return store.loadNaturalDevelopmentAuthorizationConsumption({
    stateRoot,
    authorizationFingerprint,
    readPurpose: HISTORICAL_RECONCILIATION
  });
}

function loadCurrent(
  stateRoot,
  authorizationFingerprint,
  expectedPhysicalWorkspaceIdentity
) {
  return store.loadNaturalDevelopmentAuthorizationConsumption({
    stateRoot,
    authorizationFingerprint,
    readPurpose: CURRENT_AUTHORITY,
    expectedPhysicalWorkspaceIdentity
  });
}

test(
  'AGMI-T6-POSITION-BINDING denies A bytes in the B filename for CLAIMED and CONSUMED records',
  (t) => {
    const claimA = createClaim('A');
    const claimB = createClaim('B');

    for (const record of [
      claimA,
      createConsumption(claimA, 'A')
    ]) {
      const stateRoot = fixtureRoot(t, record.state.toLowerCase());
      writeRecord(stateRoot, claimB.authorizationFingerprint, record);

      assert.throws(
        () => loadHistorical(
          stateRoot,
          claimB.authorizationFingerprint
        ),
        /requested storage position/i
      );
    }
  }
);

test(
  'AGMI position binding preserves correct CLAIMED and CONSUMED process-style reopen',
  (t) => {
    const stateRoot = fixtureRoot(t, 'reopen');
    const claim = createClaim('reopen');

    store.claimNaturalDevelopmentAuthorization({ stateRoot, claim });
    assert.equal(
      loadCurrent(
        stateRoot,
        claim.authorizationFingerprint,
        claim.physicalWorkspaceIdentity
      ).state,
      'CLAIMED'
    );

    store.commitNaturalDevelopmentAuthorization({
      stateRoot,
      consumption: createConsumption(claim, 'reopen')
    });
    assert.equal(
      loadCurrent(
        stateRoot,
        claim.authorizationFingerprint,
        claim.physicalWorkspaceIdentity
      ).state,
      'CONSUMED'
    );
  }
);

test(
  'G7 read purpose is explicit and current-authority reads require an expected physical identity',
  (t) => {
    const stateRoot = fixtureRoot(t, 'explicit-read-purpose');
    const claim = createClaim('explicit-read-purpose');
    store.claimNaturalDevelopmentAuthorization({ stateRoot, claim });

    assert.throws(
      () => store.loadNaturalDevelopmentAuthorizationConsumption({
        stateRoot,
        authorizationFingerprint: claim.authorizationFingerprint
      }),
      /read purpose is required/i
    );
    assert.throws(
      () => store.loadNaturalDevelopmentAuthorizationConsumption({
        stateRoot,
        authorizationFingerprint: claim.authorizationFingerprint,
        readPurpose: CURRENT_AUTHORITY
      }),
      /expected physical workspace identity/i
    );
  }
);

test(
  'AGMI-CROSS-CONTEXT allows historical inspection but denies current authority in another physical workspace',
  (t) => {
    const stateRootA = fixtureRoot(t, 'context-a');
    const stateRootB = fixtureRoot(t, 'context-b');
    const claimA = createClaim('context-a');
    const workspaceB = hash('physical-workspace:context-b');

    store.claimNaturalDevelopmentAuthorization({
      stateRoot: stateRootA,
      claim: claimA
    });
    fs.copyFileSync(
      recordPath(stateRootA, claimA.authorizationFingerprint),
      recordPath(stateRootB, claimA.authorizationFingerprint)
    );

    const historical = loadHistorical(
      stateRootB,
      claimA.authorizationFingerprint
    );
    assert.equal(historical.state, 'CLAIMED');
    assert.equal(historical.operationalAuthority, false);
    assert.equal(historical.mutationAuthority, false);
    assert.equal(historical.dispatchAuthority, false);

    assert.throws(
      () => loadCurrent(
        stateRootB,
        claimA.authorizationFingerprint,
        workspaceB
      ),
      /physical workspace context/i
    );
  }
);

test(
  'AGMI T1 T4 T5 T6 T7 and T8 corrupt or position-substituted records are detected',
  (t) => {
    const base = createClaim('matrix-a');
    const other = createClaim('matrix-b');
    const mutations = [
      (record) => { record.target = 'src/tampered.js'; },
      (record) => { record.claimFingerprint = hash('forged'); },
      (record) => {
        record.physicalWorkspaceIdentity = hash('metadata-tamper');
      },
      (record) => { record.authorizationFingerprint = 'malformed'; }
    ];

    for (const [index, mutate] of mutations.entries()) {
      const stateRoot = fixtureRoot(t, `integrity-${index}`);
      const record = JSON.parse(JSON.stringify(base));
      mutate(record);
      writeRecord(stateRoot, base.authorizationFingerprint, record);
      assert.throws(
        () => loadHistorical(stateRoot, base.authorizationFingerprint),
        /integrity|canonical SHA-256|required/i
      );
    }

    for (const [index, record] of [base, other].entries()) {
      const stateRoot = fixtureRoot(t, `position-${index}`);
      const requested = index === 0 ? other : base;
      writeRecord(stateRoot, requested.authorizationFingerprint, record);
      assert.throws(
        () => loadHistorical(
          stateRoot,
          requested.authorizationFingerprint
        ),
        /requested storage position/i
      );
    }
  }
);

test(
  'AGMI T2 T3 T9 and CONSUMED_TO_CLAIMED expose the absence of authenticated monotonic state',
  (t) => {
    const stateRoot = fixtureRoot(t, 'monotonic-gap');
    const first = createClaim('first');
    const middle = createClaim('middle');
    const last = createClaim('last');

    for (const claim of [first, middle, last]) {
      store.claimNaturalDevelopmentAuthorization({ stateRoot, claim });
    }

    fs.unlinkSync(recordPath(stateRoot, middle.authorizationFingerprint));
    assert.equal(loadHistorical(
      stateRoot,
      middle.authorizationFingerprint
    ), null);
    assert.equal(loadHistorical(
      stateRoot,
      first.authorizationFingerprint
    ).state, 'CLAIMED');
    assert.equal(loadHistorical(
      stateRoot,
      last.authorizationFingerprint
    ).state, 'CLAIMED');

    const claimedBytes = fs.readFileSync(
      recordPath(stateRoot, first.authorizationFingerprint)
    );
    store.commitNaturalDevelopmentAuthorization({
      stateRoot,
      consumption: createConsumption(first, 'first')
    });
    assert.equal(loadHistorical(
      stateRoot,
      first.authorizationFingerprint
    ).state, 'CONSUMED');

    fs.writeFileSync(
      recordPath(stateRoot, first.authorizationFingerprint),
      claimedBytes
    );
    assert.equal(loadHistorical(
      stateRoot,
      first.authorizationFingerprint
    ).state, 'CLAIMED');
  }
);

test(
  'AGMI RECOMPUTED_UNKEYED_FINGERPRINT remains an explicit authenticity architecture gap',
  (t) => {
    const stateRoot = fixtureRoot(t, 'unkeyed-gap');
    const claim = createClaim('unkeyed-gap');
    const edited = JSON.parse(JSON.stringify(claim));

    edited.target = 'src/recomputed-attacker.js';
    delete edited.claimFingerprint;
    edited.claimFingerprint = fingerprint(edited);
    writeRecord(stateRoot, claim.authorizationFingerprint, edited);

    const reopened = loadHistorical(
      stateRoot,
      claim.authorizationFingerprint
    );
    assert.equal(reopened.target, 'src/recomputed-attacker.js');
  }
);
