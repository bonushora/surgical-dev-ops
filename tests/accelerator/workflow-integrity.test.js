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
      'macos-15'
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
  'Ubuntu installs and attests qualified Bubblewrap before conformance',
  () => {
    const workflow = source();
    const bubblewrapStep = workflow.indexOf(
      '- name: Install and attest qualified Linux Bubblewrap'
    );
    const conformanceStep = workflow.indexOf(
      '- name: Run canonical conformance suite'
    );

    assert.notEqual(bubblewrapStep, -1);
    assert.ok(bubblewrapStep < conformanceStep);

    const step = workflow.slice(bubblewrapStep, conformanceStep);
    assert.match(step, /if: matrix\.os == 'ubuntu-latest'/);
    assert.match(step, /set -euo pipefail/);
    assert.match(
      step,
      /sudo apt-get update[\s\S]+Dir::Etc::sourcelist="sources\.list\.d\/ubuntu\.sources"/
    );
    assert.match(step, /Dir::Etc::sourceparts="-"/);
    assert.match(
      step,
      /sudo apt-get install --yes --no-install-recommends \\\r?\n\s+apparmor-profiles apparmor-utils bubblewrap/
    );
    assert.match(
      step,
      /\/usr\/share\/apparmor\/extra-profiles\/bwrap-userns-restrict/
    );
    assert.match(
      step,
      /sudo apparmor_parser -r \/etc\/apparmor\.d\/bwrap-userns-restrict/
    );
    assert.doesNotMatch(step, /apparmor_restrict_unprivileged_userns=0/);
    assert.match(step, /bwrap_path="\$\(command -v bwrap\)"/);
    assert.match(step, /test "\$bwrap_path" = "\/usr\/bin\/bwrap"/);
    assert.match(step, /test -x "\$bwrap_path"/);
    assert.match(step, /"\$bwrap_path" --version/);
    assert.match(step, /"\$bwrap_path" --unshare-user --uid 0 --gid 0/);
    assert.match(step, /--unshare-pid --unshare-net/);
    assert.doesNotMatch(step, /unshare_path|\/usr\/bin\/unshare/);
    assert.doesNotMatch(step, /continue-on-error/);
  }
);

test('workflow captures bounded macOS Node abort evidence only for manual diagnosis', () => {
  const workflow = source();
  assert.match(
    workflow,
    /Observe macOS Node abort boundary[\s\S]+steps\.conformance\.outcome == 'failure'[\s\S]+matrix\.os == 'macos-15'[\s\S]+github\.event_name == 'workflow_dispatch'[\s\S]+continue-on-error: true[\s\S]+report-macos-node-abort\.js/
  );
});

test('workflow compares bounded macOS Seatbelt runtime contracts only after failure', () => {
  const workflow = source();
  assert.match(
    workflow,
    /Compare macOS Seatbelt runtime contracts[\s\S]+steps\.conformance\.outcome == 'failure'[\s\S]+matrix\.os == 'macos-15'[\s\S]+github\.event_name == 'workflow_dispatch'[\s\S]+continue-on-error: true[\s\S]+compare-macos-seatbelt-runtime\.js/
  );
});

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

test('canonical conformance serializes process-heavy test files', () => {
  const packageJson = JSON.parse(fs.readFileSync(
    require.resolve('../../package.json'), 'utf8'
  ));

  assert.match(packageJson.scripts.test, /--test-concurrency=1/);
});


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

test(
  'prerelease publication is isolated from the stable latest channel',
  () => {
    const workflow = source();

    assert.match(
      workflow,
      /npm publish --access public --provenance --tag next/
    );

    assert.doesNotMatch(
      workflow,
      /npm publish --access public --provenance\s*$/
    );
  }
);
