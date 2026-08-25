'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const PACKAGE_FILE = path.join(ROOT, 'package.json');
const CLI_FILE = path.join(ROOT, 'accelerator', 'cli', 'surgical.js');

test('package exposes the canonical surgical executable', () => {
  const packageJson = JSON.parse(
    fs.readFileSync(PACKAGE_FILE, 'utf8')
  );

  assert.ok(packageJson.bin);
  assert.equal(
    packageJson.bin.surgical,
    'accelerator/cli/surgical.js'
  );
  assert.equal(
    packageJson.bin['surgical-devops'],
    'accelerator/cli/surgical.js'
  );
  assert.equal(packageJson.name, 'surgical-dev-ops');
  assert.equal(packageJson.version, '2.5.1');
  assert.equal(packageJson.license, 'MIT');
  assert.deepEqual(packageJson.engines, {
    node: '>=24.18.0'
  });
});

test('canonical surgical CLI exists', () => {
  assert.equal(fs.existsSync(CLI_FILE), true);
});

test('surgical --version exposes the Surgical DevOps version', () => {
  const output = execFileSync(
    process.execPath,
    [CLI_FILE, '--version'],
    {
      cwd: ROOT,
      encoding: 'utf8'
    }
  ).trim();

  assert.equal(output, 'Surgical DevOps v2.5.1');
});

test('surgical --help exposes the stable human entrypoint', () => {
  const output = execFileSync(
    process.execPath,
    [CLI_FILE, '--help'],
    {
      cwd: ROOT,
      encoding: 'utf8'
    }
  );

  assert.match(output, /Surgical DevOps v2\.5\.1/);
  assert.match(output, /Usage:/);
  assert.match(output, /\bsurgical\b/);
  assert.match(output, /--help/);
  assert.match(output, /--version/);
});

test('CLI source delegates orchestration to the canonical orchestrator', () => {
  assert.equal(fs.existsSync(CLI_FILE), true);

  const source = fs.readFileSync(CLI_FILE, 'utf8');

  assert.match(
    source,
    /require\(['"]\.\.\/core\/surgical-orchestrator['"]\)/
  );

  assert.match(
    source,
    /\borchestrate\b/
  );
});
