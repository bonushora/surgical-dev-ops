#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const components = Object.entries(lock.packages || {}).filter(([name]) => name !== '').map(([name, value]) => ({
  type: 'library',
  name: value.name || name.replace(/^node_modules\//, ''),
  version: value.version,
  scope: value.optional ? 'optional' : 'required',
  license: value.license || 'NOT_DECLARED',
  integrity: value.integrity || null,
})).sort((left, right) => left.name.localeCompare(right.name));
const result = {
  schema: 'surgical.customer_supply_chain.v1',
  package: { name: manifest.name, version: manifest.version, license: manifest.license },
  lockfileVersion: lock.lockfileVersion,
  dependencyCount: components.length,
  components,
  sbom: {
    bomFormat: 'CycloneDX', specVersion: '1.5', version: 1,
    metadata: { component: { type: 'application', name: manifest.name, version: manifest.version } },
    components,
  },
  vulnerabilityAssessment: 'NOT_INVENTED_RUN_NPM_AUDIT_SEPARATELY',
};
process.stdout.write(`${JSON.stringify(result)}\n`);
