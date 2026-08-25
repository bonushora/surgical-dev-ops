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
      /Qwen 3 8B via Ollama/
    );

    /*
     * Commercial/provider details remain available through the
     * explicit provider UX. They are intentionally not part of
     * the default NATURAL conversational startup.
     */
    assert.doesNotMatch(
      output,
      /sem cobrança por chamada de API/i
    );

    assert.doesNotMatch(
      output,
      /taxas ou comissões/i
    );

    assert.match(
      output,
      /conversar comigo normalmente/i
    );

    assert.match(
      output,
      /proteção determinística do projeto está ativa/i
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

test(
  'NATURAL activation is conversational and hides implementation terminology by default',
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

    assert.match(
      output,
      /Olá\. Estou conectado ao projeto "surgical-dev-ops"/
    );

    assert.match(
      output,
      /conversar comigo normalmente/i
    );

    assert.match(
      output,
      /proteção determinística do projeto está ativa/i
    );

    assert.match(
      output,
      /microtarefas supervisionadas/i
    );

    assert.doesNotMatch(
      output,
      /^Mode:/m
    );

    assert.doesNotMatch(
      output,
      /^Strategy:/m
    );

    assert.doesNotMatch(
      output,
      /^Orchestrator:/m
    );

    assert.doesNotMatch(
      output,
      /^Providers:/m
    );
  }
);

test(
  'EXPERT keeps the exact technical activation surface',
  () => {
    const activation =
      cli.createInteractiveActivation(
        ROOT,
        'EXPERT'
      );

    const output =
      cli.formatInteractiveActivation(
        activation
      );

    assert.match(
      output,
      /Mode: DETERMINISTIC/
    );

    assert.match(
      output,
      /Strategy: PATCH/
    );

    assert.match(
      output,
      /Orchestrator: ACTIVE/
    );

    assert.match(
      output,
      /Providers: none/
    );
  }
);
