'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(
  path.join(
    __dirname,
    '../../.github/workflows/accelerator-conformance.yml'
  ),
  'utf8'
);

test('manual conformance accepts and verifies an exact requested ref without release authority', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /qualification_ref:/);
  assert.match(workflow, /github\.event_name\s*==\s*['"]workflow_dispatch['"]/);
  assert.match(workflow, /QUALIFICATION_REF/);
  assert.match(workflow, /git\s+rev-parse\s+--verify\s+--end-of-options/);
  assert.match(workflow, /resolved_sha/);
  assert.match(workflow, /checked_out_sha/);
  assert.match(workflow, /test\s+"\$resolved_sha"\s*=\s*"\$checked_out_sha"/);
  assert.match(workflow, /qualification_branch/);
  assert.match(workflow, /qualification\/exact-ref/);
  assert.match(workflow, /RESOLVED_SHA:0:12/);
  assert.match(workflow, /git\s+switch\s+-c\s+"\$qualification_branch"/);
  assert.match(workflow, /git\s+branch\s+--show-current.*qualification_branch/);
  assert.match(workflow, /git\s+rev-parse\s+--verify\s+HEAD\^\{commit\}/);
  assert.match(workflow, /qualification_ref/);
  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /macos-latest/);
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /github\.event_name\s*!=\s*['"]workflow_dispatch['"]\s*&&\s*startsWith\(github\.ref, ['"]refs\/tags\/v['"]\)/);
  const publicationJob = workflow.split('  publish-npm:')[1] || '';
  assert.match(publicationJob, /if:\s*github\.event_name\s*!=\s*['"]workflow_dispatch['"]\s*&&/);
  assert.match(publicationJob, /npm publish/);
  assert.doesNotMatch(publicationJob, /deploy|vercel/i);
  assert.doesNotMatch(workflow, /qualification_branch[\s\S]{0,600}git\s+push/);
});
