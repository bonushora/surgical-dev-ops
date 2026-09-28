#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const artifact = process.argv[2];
if (!artifact || !path.isAbsolute(artifact) || !fs.statSync(artifact).isFile()) {
  throw new Error('Exact absolute customer artifact path is required');
}
const bytes = fs.readFileSync(artifact);
const manifest = Object.freeze({
  schema: 'surgical.customer_artifact_manifest.v1',
  artifact: path.basename(artifact),
  bytes: bytes.length,
  sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  signed: false,
  signingBoundary: 'FUTURE_QUALIFIED_RELEASE_INFRASTRUCTURE',
  privateSigningKeyCreated: false,
});
process.stdout.write(`${JSON.stringify(manifest)}\n`);
