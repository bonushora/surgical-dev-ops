'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT =
  path.resolve(__dirname, '../..');

const WORKFLOW =
  path.join(
    ROOT,
    '.github/workflows/accelerator-conformance.yml'
  );

function source() {
  return fs.readFileSync(
    WORKFLOW,
    'utf8'
  );
}

test(
  'canonical CI uses Node 24 actions and the declared runtime floor',
  () => {
    const workflow = source();

    assert.match(
      workflow,
      /uses: actions\/checkout@v6/
    );
    assert.match(
      workflow,
      /uses: actions\/setup-node@v6/
    );
    assert.match(
      workflow,
      /node-version: '24\.18\.0'/
    );
    assert.doesNotMatch(
      workflow,
      /actions\/(?:checkout|setup-node)@v4/
    );
  }
);

test(
  'workflow preserves read-only token permissions and three native jobs',
  () => {
    const workflow = source();

    assert.match(
      workflow,
      /permissions:\s*\n\s+contents: read/
    );

    for (const platform of [
      'ubuntu-latest',
      'windows-latest',
      'macos-latest'
    ]) {
      assert.match(
        workflow,
        new RegExp(
          `- ${platform}`
        )
      );
    }
  }
);

test(
  'diagnostic continuation cannot hide canonical conformance failure',
  () => {
    const workflow = source();

    assert.match(
      workflow,
      /id: conformance\s*\n\s+continue-on-error: true/
    );
    assert.match(
      workflow,
      /name: Enforce canonical conformance result/
    );
    assert.match(
      workflow,
      /if: steps\.conformance\.outcome == 'failure'/
    );
    assert.match(
      workflow,
      /run: node -e "process\.exit\(1\)"/
    );
  }
);


test(
  'pull-request merge checkout receives deterministic physical branch identity',
  () => {
    const workflow = source();

    assert.match(
      workflow,
      /name: Materialize deterministic pull-request merge branch/
    );

    assert.match(
      workflow,
      /if: github\.event_name == 'pull_request'/
    );

    assert.match(
      workflow,
      /git switch -c sdo-ci-pr-merge/
    );

    assert.match(
      workflow,
      /test "\$\(git branch --show-current\)" = "sdo-ci-pr-merge"/
    );

    assert.doesNotMatch(
      workflow,
      /ref:\s*\$\{\{\s*github\.(?:head_ref|event\.pull_request\.head\.sha)/
    );
  }
);
