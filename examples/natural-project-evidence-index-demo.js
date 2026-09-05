'use strict';

const crypto = require('node:crypto');
const {
  createNaturalProjectEvidenceIndex,
  createNaturalProjectEvidenceEntry,
  admitNaturalProjectEvidence,
  lookupNaturalProjectEvidence
} = require('../accelerator/cli/natural-project-evidence-index');

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const content = 'Bound project evidence.\n';
const binding = Object.freeze({
  physicalWorkspaceIdentity: hash('physical-workspace'),
  repositoryHead: hash('repository-head'),
  worktreeFingerprint: hash('clean-worktree'),
  parserVersion: 'natural-evidence-v1'
});

let index = createNaturalProjectEvidenceIndex(binding);
index = admitNaturalProjectEvidence(index, createNaturalProjectEvidenceEntry(index, {
  target: 'README.md', content, contentSha256: hash(content),
  bytes: Buffer.byteLength(content), observedAt: '2026-08-25T16:00:00.000Z'
}));

const result = lookupNaturalProjectEvidence(index, {
  ...binding,
  target: 'README.md',
  freshPhysicalObservationRequired: false
});

process.stdout.write(JSON.stringify({
  status: result.status,
  evidenceCost: result.evidenceCost,
  physicalReadRequired: result.physicalReadRequired,
  target: result.entry && result.entry.target,
  contentSha256: result.entry && result.entry.contentSha256,
  operationalAuthority: result.operationalAuthority,
  mutationAuthority: result.mutationAuthority
}, null, 2) + '\n');
