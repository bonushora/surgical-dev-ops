'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  COMPONENTS,
  PROFILE_ID,
  MANIFEST_PATH,
  loadContainmentProfile
} = require('../../accelerator/core/containment-profile-loader');
const {
  createCodexCognitiveContainment
} = require('../../accelerator/adapters/codex-cognitive-containment-adapter');

const ROOT = path.resolve(__dirname, '../..');

function profileFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdo-containment-profile-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const relative of [MANIFEST_PATH, ...Object.keys(COMPONENTS)]) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(ROOT, relative), target);
  }
  return root;
}

test('trusted loader records every required profile path and anchored SHA-256', () => {
  const profile = loadContainmentProfile();
  assert.equal(profile.profileId, PROFILE_ID);
  assert.equal(profile.state, 'VERIFIED');
  assert.equal(profile.legacyRawIncludesContainment, false);
  assert.deepEqual(
    Object.fromEntries(profile.components.map((component) => [component.path, component.sha256])),
    COMPONENTS
  );
});

test('missing and byte-altered profile components fail closed', (t) => {
  const missing = profileFixture(t);
  fs.unlinkSync(path.join(missing, 'protocols/v2.3/BH-CONTAINMENT.md'));
  assert.throws(
    () => loadContainmentProfile({ repositoryRoot: missing }),
    /missing or unreadable/i
  );

  const altered = profileFixture(t);
  fs.appendFileSync(
    path.join(altered, 'protocols/v2.3/BH-CONTAINMENT-PROFILE_EN.md'),
    '\nchanged\n'
  );
  assert.throws(
    () => loadContainmentProfile({ repositoryRoot: altered }),
    /trusted runtime anchor/i
  );
});

test('invalid or incompatible profile output is rejected before native launch actions', () => {
  let nativeCalls = 0;
  assert.throws(() => createCodexCognitiveContainment({
    codexExecutable: process.execPath,
    credentialProvider: async () => 'fixture-host-credential',
    containmentProfileLoader: () => Object.freeze({
      schema: 'sdo.containment_profile.v1',
      profileId: 'BH-SEP-v2.3+BH-SDP-v2.3',
      state: 'VERIFIED'
    }),
    nativeFactories: {
      [process.platform]: () => { nativeCalls += 1; return null; }
    },
    registerSignalHandlers: false
  }), /containment profile was not verified/i);
  assert.equal(nativeCalls, 0);
});
