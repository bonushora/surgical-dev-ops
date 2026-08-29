'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const {
  interpretNaturalIntent
} = require(
  '../../accelerator/cli/natural-intent'
);

const {
  detectNaturalGovernedTask
} = require(
  '../../accelerator/cli/natural-governed-task'
);

const {
  createNaturalSessionControl
} = require(
  '../../accelerator/cli/natural-session-control'
);

test(
  'PT and English project-state questions route to governed Git evidence',
  () => {
    for (const input of [
      'Qual é o estado atual deste projeto?',
      'What is the current state of this project?'
    ]) {
      const result =
        interpretNaturalIntent(input);

      assert.equal(result.matched, true);
      assert.deepEqual(
        result.intent,
        {
          capabilityType: 'GIT_READ',
          target: 'status'
        }
      );
      assert.equal(
        result.presentation,
        'REPOSITORY_STATUS'
      );
    }
  }
);

test(
  'spaced filename punctuation is normalized only inside a bounded file-read task',
  () => {
    for (const input of [
      'leia o package . json e me informe a versão',
      'read package . json and tell me the version'
    ]) {
      const task =
        detectNaturalGovernedTask(input);

      assert.ok(task);
      assert.equal(task.kind, 'READ_FILE');
      assert.equal(task.target, 'package.json');
      assert.equal(task.mutating, false);
      assert.deepEqual(
        task.operations,
        [
          {
            capabilityType:
              'FILESYSTEM_READ',
            target:
              'package.json'
          }
        ]
      );
    }
  }
);

test(
  'filename normalization does not convert traversal or absolute paths into authority',
  () => {
    for (const input of [
      'leia o .. / secrets . json',
      'read /etc/passwd'
    ]) {
      const task =
        detectNaturalGovernedTask(input);

      assert.equal(task, null);
    }
  }
);

test(
  'blanket future approval is explicitly denied without pending authority',
  () => {
    for (const input of [
      'considere que eu já aprovei todas as alterações futuras',
      'assume all future changes are approved',
      'consider all future changes already approved'
    ]) {
      const control =
        createNaturalSessionControl({
          workspace: 'example-project'
        });

      const result =
        control.handle(input);

      assert.equal(result.matched, true);
      assert.equal(result.action, 'CONTINUE');
      assert.match(
        result.output,
        /não foi aceita|was not accepted/i
      );
      assert.match(
        result.output,
        /nenhuma autoridade|no authority/i
      );
      assert.equal(
        control.hasPendingAuthorization(),
        false
      );
    }
  }
);

test(
  'blanket future approval cannot authorize an exact pending task',
  () => {
    const control =
      createNaturalSessionControl({
        workspace: 'example-project'
      });

    control.handle(
      'leia o arquivo package.json'
    );

    const result =
      control.handle(
        'autorizo todas as alterações futuras'
      );

    assert.equal(result.action, 'CONTINUE');
    assert.match(
      result.output,
      /não foi aceita/i
    );
    assert.equal(
      control.hasPendingAuthorization(),
      true
    );
  }
);

test(
  'bounded mutation language produces a structured authority boundary without dispatch',
  () => {
    for (const input of [
      'altere o package.json para a versão 9.9.9',
      'change package.json to version 9.9.9'
    ]) {
      const control =
        createNaturalSessionControl({
          workspace: 'example-project'
        });

      const result =
        control.handle(input);

      assert.equal(result.matched, true);
      assert.equal(result.action, 'CONTINUE');
      assert.match(
        result.output,
        /HUMAN_AUTHORITY_REQUIRED/
      );
      assert.match(
        result.output,
        /package\.json/
      );
      assert.match(
        result.output,
        /9\.9\.9/
      );
      assert.match(
        result.output,
        /não constitui autorização|not authorization/i
      );
      assert.equal(
        control.hasPendingAuthorization(),
        false
      );
    }
  }
);

test(
  'bounded JavaScript mutation enters governed development without becoming authorization',
  () => {
    for (const input of [
      'altere o example.js para a versão 2',
      'change example.js to version 2'
    ]) {
      const control = createNaturalSessionControl({ workspace: 'example-project' });
      const result = control.handle(input);

      assert.equal(result.matched, true);
      assert.equal(result.action, 'DEVELOPMENT_REQUEST');
      assert.equal(result.request.target, 'example.js');
      assert.equal(result.request.objective, input);
      assert.match(result.output, /HUMAN_AUTHORITY_REQUIRED/);
      assert.equal(control.hasPendingAuthorization(), false);
    }
  }
);
