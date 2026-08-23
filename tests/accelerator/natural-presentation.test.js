'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const {
  extractGovernedPayload,
  parseWorktreeStatus,
  formatNaturalPresentation
} = require(
  '../../accelerator/cli/natural-presentation'
);

test(
  'extracts bounded evidence from completed governed Git output',
  () => {
    const evidence =
      extractGovernedPayload(
        'Governed Git read: COMPLETED\n' +
        'Selector: CURRENT_BRANCH\n' +
        'main\n'
      );

    assert.deepEqual(
      evidence,
      {
        selector:
          'CURRENT_BRANCH',

        payload:
          'main'
      }
    );
  }
);

test(
  'malformed governed evidence is rejected by presentation parser',
  () => {
    assert.equal(
      extractGovernedPayload(
        'main\n'
      ),
      null
    );
  }
);

test(
  'worktree status counts modified and untracked entries deterministically',
  () => {
    const status =
      parseWorktreeStatus(
        JSON.stringify([
          ' M accelerator/cli/surgical.js',
          '?? new-file.js',
          '?? another-file.js'
        ])
      );

    assert.deepEqual(
      status,
      {
        total: 3,
        modified: 1,
        untracked: 2,
        other: 0
      }
    );
  }
);

test(
  'NATURAL repository status presents governed evidence in novice language',
  () => {
    const output =
      formatNaturalPresentation(
        'REPOSITORY_STATUS',
        'Governed Git read: COMPLETED\n' +
        'Selector: WORKTREE_STATUS\n' +
        JSON.stringify([
          ' M accelerator/cli/surgical.js',
          '?? new-file.js'
        ]) +
        '\n'
      );

    assert.match(
      output,
      /O projeto possui alterações locais/
    );

    assert.match(
      output,
      /1 arquivo modificado/
    );

    assert.match(
      output,
      /1 arquivo novo não rastreado/
    );

    assert.match(
      output,
      /Nenhuma alteração foi realizada/
    );

    assert.doesNotMatch(
      output,
      /Selector:/
    );
  }
);

test(
  'clean repository receives deterministic NATURAL presentation',
  () => {
    const output =
      formatNaturalPresentation(
        'REPOSITORY_STATUS',
        'Governed Git read: COMPLETED\n' +
        'Selector: WORKTREE_STATUS\n' +
        '[]\n'
      );

    assert.equal(
      output,
      'O projeto não possui alterações locais pendentes.\n' +
      'Nenhuma alteração foi realizada.\n'
    );
  }
);

test(
  'NATURAL branch presentation preserves governed branch evidence',
  () => {
    const output =
      formatNaturalPresentation(
        'CURRENT_BRANCH',
        'Governed Git read: COMPLETED\n' +
        'Selector: CURRENT_BRANCH\n' +
        'main\n'
      );

    assert.equal(
      output,
      'Você está trabalhando na branch "main".\n' +
      'Nenhuma alteração foi realizada.\n'
    );
  }
);

test(
  'NATURAL commit presentation preserves exact governed commit evidence',
  () => {
    const commit =
      '60b43f856bb859b3c417d8735841467f4e190166';

    const output =
      formatNaturalPresentation(
        'HEAD_COMMIT',
        'Governed Git read: COMPLETED\n' +
        'Selector: HEAD_COMMIT\n' +
        commit +
        '\n'
      );

    assert.equal(
      output,
      'O commit atual do projeto é:\n' +
      commit +
      '\n' +
      'Nenhuma alteração foi realizada.\n'
    );
  }
);

test(
  'presentation selector mismatch fails closed to original governed evidence',
  () => {
    const governed =
      'Governed Git read: COMPLETED\n' +
      'Selector: CURRENT_BRANCH\n' +
      'main\n';

    assert.equal(
      formatNaturalPresentation(
        'HEAD_COMMIT',
        governed
      ),
      governed
    );
  }
);

test(
  'unknown presentation fails closed to original governed evidence',
  () => {
    const governed =
      'Governed Git read: COMPLETED\n' +
      'Selector: CURRENT_BRANCH\n' +
      'main\n';

    assert.equal(
      formatNaturalPresentation(
        'UNKNOWN',
        governed
      ),
      governed
    );
  }
);
