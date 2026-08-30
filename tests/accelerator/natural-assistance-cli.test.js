'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const path =
  require('node:path');

const fs =
  require('node:fs');

const os =
  require('node:os');

const {
  execFileSync
} = require('node:child_process');

const cli =
  require(
    '../../accelerator/cli/surgical'
  );

function activationRepository(context) {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdo-activation-')
  );
  const repository = path.join(parent, 'surgical-dev-ops');

  fs.mkdirSync(repository);
  fs.writeFileSync(path.join(repository, 'package-lock.json'), '{}\n');
  fs.writeFileSync(path.join(repository, 'example.js'), "'use strict';\n");

  execFileSync('git', ['init', '-b', 'main'], { cwd: repository });
  execFileSync('git', ['config', 'user.name', 'Surgical Test'], { cwd: repository });
  execFileSync('git', ['config', 'user.email', 'test@surgical.invalid'], { cwd: repository });
  execFileSync('git', ['add', '.'], { cwd: repository });
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: repository });

  context.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  return repository;
}

test(
  'NATURAL activation announces provider auto-discovery without authority expansion',
  (context) => {
    const activation =
      cli.createInteractiveActivation(
        activationRepository(context),
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
  (context) => {
    const activation =
      cli.createInteractiveActivation(
        activationRepository(context),
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
  (context) => {
    const activation =
      cli.createInteractiveActivation(
        activationRepository(context),
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
  (context) => {
    const activation =
      cli.createInteractiveActivation(
        activationRepository(context),
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
