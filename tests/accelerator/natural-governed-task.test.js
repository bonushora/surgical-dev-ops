'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const {
  detectNaturalGovernedTask,
  formatTaskProposal,
  isAffirmative,
  isNegative
} = require(
  '../../accelerator/cli/natural-governed-task'
);

test(
  'natural workspace listing becomes a bounded governed task rather than cognitive guess',
  () => {
    const task =
      detectNaturalGovernedTask(
        'liste os arquivos deste diretório'
      );

    assert.ok(task);

    assert.equal(
      task.kind,
      'WORKSPACE_LIST'
    );

    assert.deepEqual(
      task.operations,
      [
        {
          capabilityType:
            'GIT_READ',

          target:
            'workspace-files'
        }
      ]
    );

    assert.equal(
      task.mutating,
      false
    );
  }
);

test(
  'explicit file analysis requests one bounded filesystem read',
  () => {
    const task =
      detectNaturalGovernedTask(
        'analise o arquivo package.json'
      );

    assert.ok(task);

    assert.equal(
      task.kind,
      'READ_AND_EXPLAIN_FILE'
    );

    assert.equal(
      task.target,
      'package.json'
    );

    assert.equal(
      task.operations[0]
        .capabilityType,
      'FILESYSTEM_READ'
    );
  }
);

test(
  'broad project analysis becomes an immutable non-mutating governed task',
  () => {
    const task =
      detectNaturalGovernedTask(
        'Explique este projeto para mim.'
      );

    assert.ok(task);

    assert.equal(
      task.kind,
      'PROJECT_ANALYSIS'
    );

    assert.equal(
      task.mutating,
      false
    );

    assert.deepEqual(
      task.operations,
      []
    );

    assert.equal(
      Object.isFrozen(task),
      true
    );

    assert.match(
      formatTaskProposal(
        task,
        'example-project'
      ),
      /no máximo 8 etapas/i
    );
  }
);

test(
  'proposal explains operation before authority',
  () => {
    const task =
      detectNaturalGovernedTask(
        'liste os arquivos deste diretorio'
      );

    const output =
      formatTaskProposal(
        task,
        'example-project'
      );

    assert.match(
      output,
      /preciso consultar/i
    );

    assert.match(
      output,
      /nenhum arquivo será alterado/i
    );

    assert.match(
      output,
      /posso prosseguir/i
    );
  }
);

test(
  'authorization language is interpreted only by bounded task state',
  () => {
    assert.equal(
      isAffirmative(
        'eu autorizo'
      ),
      true
    );

    assert.equal(
      isAffirmative(
        'sim'
      ),
      true
    );

    assert.equal(
      isNegative(
        'não'
      ),
      true
    );

    assert.equal(
      isAffirmative('yes'),
      true
    );

    assert.equal(
      isNegative('cancel'),
      true
    );
  }
);

test(
  'English project analysis receives the same governed authorization boundary',
  () => {
    const task =
      detectNaturalGovernedTask(
        'Explain this project to me in English.'
      );

    assert.equal(
      task.kind,
      'PROJECT_ANALYSIS'
    );
    assert.equal(task.mutating, false);
    assert.match(
      formatTaskProposal(
        task,
        'example-project'
      ),
      /May I proceed\?/i
    );
    assert.match(
      formatTaskProposal(
        task,
        'example-project'
      ),
      /No file will be changed/i
    );
  }
);
