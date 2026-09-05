'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  detectNaturalGovernedTask
} = require('../../accelerator/cli/natural-governed-task');

const CASES = [
  [
    'pt-BR',
    'Investigue se existe algum problema simples neste projeto que possa ser corrigido com uma mudança pequena e segura. Não faça nenhuma alteração ainda.'
  ],
  [
    'pt-BR',
    'Procure um problema simples neste projeto, mas não altere nenhum arquivo.'
  ],
  [
    'pt-BR',
    'Analise o projeto em busca de um pequeno problema que poderíamos corrigir. Por enquanto não modifique nada.'
  ],
  [
    'en',
    'Investigate whether there is a simple problem in this project that could be fixed safely. Do not make any changes yet.'
  ],
  [
    'en',
    'Look for a small problem in this project, but do not change any files.'
  ],
  [
    'en',
    'Analyze the project for a small issue we could fix. For now do not modify anything.'
  ]
];

test(
  'read-only investigative project requests route to governed project analysis without requiring an explicit first token',
  () => {
    for (const [language, phrase] of CASES) {
      const task =
        detectNaturalGovernedTask(phrase);

      assert.ok(
        task,
        `${language}: expected governed task for: ${phrase}`
      );

      assert.equal(
        task.kind,
        'PROJECT_ANALYSIS',
        `${language}: ${phrase}`
      );

      assert.equal(
        task.mutating,
        false,
        `${language}: ${phrase}`
      );

      assert.deepEqual(
        task.operations,
        [],
        `${language}: ${phrase}`
      );
    }
  }
);
