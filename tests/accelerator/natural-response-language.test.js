'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  detectNaturalResponseLanguage
} = require(
  '../../accelerator/cli/natural-response-language'
);

test(
  'NATURAL response language is deterministic for qualified Portuguese and English intents',
  () => {
    assert.equal(
      detectNaturalResponseLanguage(
        'Explique este projeto para mim.'
      ),
      'pt-BR'
    );
    assert.equal(
      detectNaturalResponseLanguage(
        'Explain this project to me in English.'
      ),
      'en'
    );
    assert.equal(
      detectNaturalResponseLanguage(
        'Analyze the file README.md'
      ),
      'en'
    );
  }
);

test(
  'language detection exports no operational surface',
  () => {
    const surface = require(
      '../../accelerator/cli/natural-response-language'
    );

    assert.deepEqual(
      Object.keys(surface),
      ['detectNaturalResponseLanguage']
    );
    assert.ok(Object.isFrozen(surface));
  }
);
