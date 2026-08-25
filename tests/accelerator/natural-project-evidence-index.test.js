'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  MAX_ENTRY_BYTES,
  createNaturalProjectEvidenceIndex,
  createNaturalProjectEvidenceEntry,
  admitNaturalProjectEvidence,
  lookupNaturalProjectEvidence
} = require('../../accelerator/cli/natural-project-evidence-index');

const digest = (value) =>
  crypto.createHash('sha256').update(value, 'utf8').digest('hex');

const binding = (overrides = {}) => Object.freeze({
  physicalWorkspaceIdentity: digest('physical:/repo'),
  repositoryHead: digest('commit'),
  worktreeFingerprint: digest('clean-worktree'),
  parserVersion: 'natural-evidence-v1',
  ...overrides
});

const query = (overrides = {}) => Object.freeze({
  ...binding(),
  target: 'README_EN.md',
  freshPhysicalObservationRequired: false,
  ...overrides
});

function populated() {
  const index = createNaturalProjectEvidenceIndex(binding());
  const content = 'Governed project description.\n';
  const entry = createNaturalProjectEvidenceEntry(index, {
    target: 'README_EN.md',
    content,
    contentSha256: digest(content),
    bytes: Buffer.byteLength(content),
    observedAt: '2026-08-25T16:00:00.000Z'
  });
  return admitNaturalProjectEvidence(index, entry);
}

test('commit-bound index reuses exact governed project evidence at zero physical read cost', () => {
  const index = populated();
  const result = lookupNaturalProjectEvidence(index, query());

  assert.equal(result.status, 'HIT');
  assert.equal(result.physicalReadRequired, false);
  assert.equal(result.evidenceCost, 'INDEX_REUSE');
  assert.equal(result.entry.target, 'README_EN.md');
  assert.match(result.entry.content, /Governed project/);
  assert.equal(result.operationalAuthority, false);
  assert.equal(result.mutationAuthority, false);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.entry));
});

test('HEAD workspace worktree parser and content changes invalidate reuse', () => {
  const index = populated();
  const changes = [
    { repositoryHead: digest('next-commit') },
    { physicalWorkspaceIdentity: digest('other-workspace') },
    { worktreeFingerprint: digest('dirty-worktree') },
    { parserVersion: 'natural-evidence-v2' },
    { observedContentSha256: digest('changed-content') }
  ];

  for (const change of changes) {
    const result = lookupNaturalProjectEvidence(index, query(change));
    assert.equal(result.status, 'STALE');
    assert.equal(result.entry, null);
    assert.equal(result.physicalReadRequired, true);
  }
});

test('fresh-evidence policy bypasses an otherwise exact index hit', () => {
  const result = lookupNaturalProjectEvidence(
    populated(),
    query({ freshPhysicalObservationRequired: true })
  );

  assert.equal(result.status, 'MISS');
  assert.match(result.reason, /fresh physical evidence/);
  assert.equal(result.physicalReadRequired, true);
});

test('entry admission binds canonical target hash bytes parser and observation time', () => {
  const index = createNaturalProjectEvidenceIndex(binding());
  const content = 'x';

  assert.throws(() => createNaturalProjectEvidenceEntry(index, {
    target: '../secret', content, contentSha256: digest(content), bytes: 1,
    observedAt: '2026-08-25T16:00:00.000Z'
  }), /canonical workspace-relative/i);

  assert.throws(() => createNaturalProjectEvidenceEntry(index, {
    target: 'README.md', content, contentSha256: digest('y'), bytes: 1,
    observedAt: '2026-08-25T16:00:00.000Z'
  }), /content hash/i);

  assert.throws(() => createNaturalProjectEvidenceEntry(index, {
    target: 'README.md', content, contentSha256: digest(content), bytes: 2,
    observedAt: '2026-08-25T16:00:00.000Z'
  }), /bytes/i);

  assert.throws(() => createNaturalProjectEvidenceEntry(index, {
    target: 'README.md', content: 'x'.repeat(MAX_ENTRY_BYTES + 1),
    contentSha256: digest('x'.repeat(MAX_ENTRY_BYTES + 1)),
    bytes: MAX_ENTRY_BYTES + 1, observedAt: '2026-08-25T16:00:00.000Z'
  }), /bounded/i);
});

test('replacement is immutable deterministic and bounded to one canonical target', () => {
  const first = populated();
  const content = 'Replacement governed description.\n';
  const replacement = createNaturalProjectEvidenceEntry(first, {
    target: 'README_EN.md', content, contentSha256: digest(content),
    bytes: Buffer.byteLength(content), observedAt: '2026-08-25T16:01:00.000Z'
  });
  const second = admitNaturalProjectEvidence(first, replacement);

  assert.equal(first.entries[0].content, 'Governed project description.\n');
  assert.equal(second.entries.length, 1);
  assert.equal(second.entries[0].content, content);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(second));
});

test('index module exposes no filesystem process network provider or mutation surface', () => {
  const api = require('../../accelerator/cli/natural-project-evidence-index');
  assert.deepEqual(
    Object.keys(api).filter((key) => typeof api[key] === 'function').sort(),
    [
      'admitNaturalProjectEvidence',
      'createNaturalProjectEvidenceEntry',
      'createNaturalProjectEvidenceIndex',
      'lookupNaturalProjectEvidence'
    ]
  );

  const source = require('node:fs').readFileSync(
    require.resolve('../../accelerator/cli/natural-project-evidence-index'),
    'utf8'
  );
  assert.doesNotMatch(source, /child_process|fetch\(|node:http|node:https/);
});
