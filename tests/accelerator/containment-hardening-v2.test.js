'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const {
  MANIFEST_PATH,
  MANIFEST_SHA256,
  MINIMUM_GENERATION,
  loadContainmentProfile
} = require('../../accelerator/core/containment-profile-loader');
const { run } = require('../../accelerator/qualification/containment-real-provider-e2e');

test('containment v2 manifest is the single anchored component map and forbids WebSocket enablement', () => {
  const profile = loadContainmentProfile();
  assert.equal(profile.state, 'VERIFIED');
  assert.equal(profile.manifest.path, MANIFEST_PATH);
  assert.equal(profile.manifest.sha256, MANIFEST_SHA256);
  assert.ok(profile.manifest.generation >= MINIMUM_GENERATION);
  assert.equal(profile.manifest.webSocketPolicy, 'BLOCKED_BEFORE_UPGRADE');
  assert.equal(profile.trustedAnchor, 'HOST_RUNTIME_EMBEDDED_MANIFEST_SHA256');
});

test('manifest declares honest qualification boundaries instead of promoting unexecuted evidence', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST_PATH), 'utf8'));
  assert.equal(manifest.qualificationClaims.realProviderEndToEnd, 'NOT_EXECUTED');
  assert.equal(manifest.qualificationClaims.macosNativeIsolation, 'NOT_EXECUTED');
  assert.equal(manifest.qualificationClaims.windowsNativeIsolation, 'NOT_EXECUTED');
  assert.equal(manifest.qualificationClaims.linuxNativeIsolation, 'PASS');
});

test('real-provider qualification is opt-in and defaults to NOT_EXECUTED', async () => {
  const previous = process.env.SDO_CONTAINMENT_REAL_PROVIDER_E2E;
  delete process.env.SDO_CONTAINMENT_REAL_PROVIDER_E2E;
  try {
    const observed = await run();
    assert.equal(observed.state, 'NOT_EXECUTED');
  } finally {
    if (previous === undefined) delete process.env.SDO_CONTAINMENT_REAL_PROVIDER_E2E;
    else process.env.SDO_CONTAINMENT_REAL_PROVIDER_E2E = previous;
  }
});

test('runtime source keeps WebSocket fail-closed and has no permissive upgrade path', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'accelerator/adapters/codex-provider-only-transport.js'), 'utf8'
  );
  assert.match(source, /server\.on\('upgrade',[\s\S]*writeSocketResponse\(socket, 426\)/);
  assert.match(source, /webSocketPolicy: 'BLOCKED_BEFORE_UPGRADE'/);
  assert.doesNotMatch(source, /webSocketPolicy:\s*'ALLOWED'/);
});
