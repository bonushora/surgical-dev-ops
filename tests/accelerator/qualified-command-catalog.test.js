'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createQualifiedCommandCatalog, admitQualifiedCommand } = require('../../accelerator/core/qualified-command-catalog');

test('catalog admits exact Node syntax validation and test-file bindings', () => {
  const catalog = createQualifiedCommandCatalog();
  const result = admitQualifiedCommand(catalog, { selector: 'NODE_SYNTAX_CHECK', workspace: '/project', target: 'src/app.js', environmentKeys: ['LANG', 'LC_ALL'] });
  assert.equal(result.admitted, true);
  assert.equal(result.shell, false);
  assert.equal(result.command.timeoutMs, 2000);
  assert.ok(Object.isFrozen(result));

  const testFile = admitQualifiedCommand(catalog, { selector: 'NODE_TEST_FILE', workspace: '/project', target: 'tests/app.test.js', environmentKeys: ['LANG'] });
  assert.equal(testFile.admitted, true);
  assert.equal(testFile.shell, false);
  assert.equal(testFile.command.timeoutMs, 30000);
  assert.equal(testFile.network, false);
});

test('arbitrary shell arguments environments targets and selectors fail closed', () => {
  const catalog = createQualifiedCommandCatalog();
  assert.throws(() => admitQualifiedCommand(catalog, { selector: 'SHELL', workspace: '/project', target: 'x.js' }), /not qualified/);
  assert.throws(() => admitQualifiedCommand(catalog, { selector: 'NODE_SYNTAX_CHECK', workspace: '/project', target: 'x.py' }), /outside/);
  assert.throws(() => admitQualifiedCommand(catalog, { selector: 'NODE_SYNTAX_CHECK', workspace: '/project', target: 'x.js', environmentKeys: ['NODE_OPTIONS'] }), /environment expansion/);
});

test('catalog source contains no execution primitive', () => {
  const source = require('node:fs').readFileSync(require.resolve('../../accelerator/core/qualified-command-catalog'), 'utf8');
  assert.doesNotMatch(source, /child_process|spawn|execFile|fetch\(/);
});
