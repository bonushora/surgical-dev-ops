'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  execFileSync
} = require('node:child_process');

const ROOT =
  path.resolve(__dirname, '../..');

test(
  'public engineering demo stops with evidence-bound zero-mutation authority',
  () => {
    const output =
      execFileSync(
        process.execPath,
        [
          path.join(
            ROOT,
            'examples/governed-engineering-loop-demo.js'
          )
        ],
        {
          cwd: ROOT,
          encoding: 'utf8'
        }
      );

    const result =
      JSON.parse(output);

    assert.equal(
      result.status,
      'HUMAN_AUTHORITY_REQUIRED'
    );
    assert.equal(result.evidenceCount, 1);
    assert.equal(
      result.target,
      'accelerator/example.js'
    );
    assert.equal(
      result.beforeSha256,
      'a'.repeat(64)
    );
    assert.match(
      result.afterSha256,
      /^[a-f0-9]{64}$/
    );
    assert.equal(
      result.operationalAuthority,
      false
    );
    assert.equal(
      result.mutationAuthority,
      false
    );
    assert.equal(
      result.approvalAuthority,
      false
    );
  }
);
