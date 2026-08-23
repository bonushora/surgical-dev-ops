'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const path =
  require('node:path');

const cli =
  require(
    '../../accelerator/cli/surgical'
  );

const ROOT =
  path.resolve(
    __dirname,
    '../..'
  );

test(
  'NATURAL activation announces provider auto-discovery without authority expansion',
  () => {
    const activation =
      cli.createInteractiveActivation(
        ROOT,
        'NATURAL'
      );

    const output =
      cli.formatInteractiveActivation(
        activation
      );

    assert.equal(
      activation.providers,
      'auto-discovery'
    );

    assert.match(
      output,
      /Llama 3 via Ollama/
    );

    assert.match(
      output,
      /sem cobrança por chamada de API do Ollama/i
    );

    assert.match(
      output,
      /não recebe, intermedeia ou retém taxas ou comissões/i
    );

    assert.equal(
      Object.prototype
        .hasOwnProperty.call(
          activation,
          'authorization'
        ),
      false
    );
  }
);

test(
  'EXPERT activation remains provider-independent default',
  () => {
    const activation =
      cli.createInteractiveActivation(
        ROOT,
        'EXPERT'
      );

    assert.equal(
      activation.providers,
      'none'
    );
  }
);
