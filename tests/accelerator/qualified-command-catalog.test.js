'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createQualifiedCommandCatalog, admitQualifiedCommand } = require('../../accelerator/core/qualified-command-catalog');

test('catalog admits only exact Node syntax validation binding', () => {
  const catalog = createQualifiedCommandCatalog();
  const result = admitQualifiedCommand(catalog, { selector: 'NODE_SYNTAX_CHECK', workspace: '/project', target: 'src/app.js', environmentKeys: ['LANG', 'LC_ALL'] });
  assert.equal(result.admitted, true);
  assert.equal(result.shell, false);
  assert.equal(result.command.timeoutMs, 2000);
  assert.ok(Object.isFrozen(result));
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
