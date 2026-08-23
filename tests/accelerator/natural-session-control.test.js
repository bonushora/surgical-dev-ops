'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const {
  createNaturalSessionControl,
  formatProviderStatus
} = require(
  '../../accelerator/cli/natural-session-control'
);

test(
  'NATURAL defaults to supervised microtasks',
  () => {
    const control =
      createNaturalSessionControl();

    assert.equal(
      control.currentWorkMode(),
      'SUPERVISED_MICROTASKS'
    );
  }
);

test(
  'explicit autonomy request changes cadence only to bounded autonomy mode',
  () => {
    const control =
      createNaturalSessionControl();

    const result =
      control.handle(
        'Trabalhe sozinha até a próxima fronteira arquitetural.'
      );

    assert.equal(
      result.matched,
      true
    );

    assert.equal(
      control.currentWorkMode(),
      'BOUNDED_AUTONOMY_TO_BOUNDARY'
    );

    assert.match(
      result.output,
      /não amplia minha autoridade/i
    );

    assert.match(
      result.output,
      /expansão de escopo/i
    );
  }
);

test(
  'user can return to supervised microtasks explicitly',
  () => {
    const control =
      createNaturalSessionControl();

    control.handle(
      'modo autonomia'
    );

    control.handle(
      'modo microtarefas'
    );

    assert.equal(
      control.currentWorkMode(),
      'SUPERVISED_MICROTASKS'
    );
  }
);

test(
  'provider replacement starts guided setup without selecting paid service',
  () => {
    const control =
      createNaturalSessionControl();

    const result =
      control.handle(
        'Quero trocar de IA.'
      );

    assert.equal(
      result.matched,
      true
    );

    assert.match(
      result.output,
      /passo a passo/i
    );

    assert.match(
      result.output,
      /fonte oficial/i
    );

    assert.match(
      result.output,
      /não recebe, intermedeia ou retém/i
    );
  }
);

test(
  'Codex request stops at remote provider qualification boundary',
  () => {
    const control =
      createNaturalSessionControl();

    const result =
      control.handle(
        'Quero usar o Codex.'
      );

    assert.equal(
      result.matched,
      true
    );

    assert.match(
      result.output,
      /Codex \/ OpenAI/
    );

    assert.match(
      result.output,
      /nenhuma credencial será solicitada/i
    );

    assert.match(
      result.output,
      /preços não são hardcoded/i
    );

    assert.match(
      result.output,
      /FRONTEIRA ATUAL/
    );
  }
);

test(
  'verified local provider reports zero operational authority',
  () => {
    const output =
      formatProviderStatus(
        Object.freeze({
          available:
            true,

          provider:
            'Ollama',

          model:
            'llama3:latest'
        })
      );

    assert.match(
      output,
      /llama3/i
    );

    assert.match(
      output,
      /Autoridade operacional da IA: nenhuma/i
    );

    assert.match(
      output,
      /não recebe, intermedeia ou retém/i
    );
  }
);

test(
  'session control exports no execution or filesystem authority',
  () => {
    const boundary =
      require(
        '../../accelerator/cli/natural-session-control'
      );

    for (const forbidden of [
      'exec',
      'execute',
      'spawn',
      'shell',
      'patch',
      'write',
      'readFile',
      'authorize',
      'approve',
      'grant',
      'credential'
    ]) {
      assert.equal(
        Object.prototype
          .hasOwnProperty.call(
            boundary,
            forbidden
          ),
        false
      );
    }
  }
);

test(
  'NATURAL help is conversational rather than command-list primary',
  () => {
    const control =
      createNaturalSessionControl();

    const result =
      control.handle(
        'ajuda'
      );

    assert.equal(
      result.matched,
      true
    );

    assert.match(
      result.output,
      /conversar comigo normalmente/i
    );

    assert.match(
      result.output,
      /Em que ponto estamos/i
    );

    assert.match(
      result.output,
      /Trabalhe sozinha até a próxima fronteira/i
    );

    assert.match(
      result.output,
      /detalhes técnicos/i
    );
  }
);

test(
  'NATURAL progressive disclosure exposes technical status only on explicit request',
  () => {
    const control =
      createNaturalSessionControl();

    const result =
      control.handle(
        'detalhes técnicos'
      );

    assert.equal(
      result.matched,
      true
    );

    assert.equal(
      result.action,
      'TECHNICAL_STATUS'
    );
  }
);
