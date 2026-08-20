'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  prepareTask
} = require('../../accelerator/core/task-preparation');

test('task preparation blocks execution without explicit authorization', () => {
  const result = prepareTask(
    'SDO authorization contract',
    {
      mode: 'PATCH',
      risk: 'BAIXO'
    }
  );

  assert.equal(
    result.task.executionAllowed,
    false
  );

  assert.equal(
    result.governance.explicitExecutionAuthorizationRequired,
    true
  );
});

test('task preparation authorizes execution only with authorizeExecution=true', () => {
  const result = prepareTask(
    'SDO authorized execution',
    {
      mode: 'PATCH',
      risk: 'BAIXO',
      authorizeExecution: true
    }
  );

  assert.equal(
    result.task.executionAllowed,
    true
  );

  assert.equal(
    result.governance.explicitExecutionAuthorizationRequired,
    true
  );
});

test('task preparation does not accept unrelated authorization property names', () => {
  const result = prepareTask(
    'SDO authorization naming contract',
    {
      mode: 'PATCH',
      risk: 'BAIXO',
      executionAuthorization: true,
      explicitExecutionAuthorization: true
    }
  );

  assert.equal(
    result.task.executionAllowed,
    false
  );
});

test('task preparation rejects invalid execution mode', () => {
  assert.throws(
    () =>
      prepareTask(
        'Invalid mode',
        {
          mode: 'INVALID',
          risk: 'BAIXO'
        }
      ),
    /Invalid execution mode/
  );
});

test('task preparation rejects invalid risk', () => {
  assert.throws(
    () =>
      prepareTask(
        'Invalid risk',
        {
          mode: 'PATCH',
          risk: 'INVALID'
        }
      ),
    /Invalid risk level/
  );
});
