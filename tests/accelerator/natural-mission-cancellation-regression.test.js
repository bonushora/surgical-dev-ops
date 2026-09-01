'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  PassThrough
} = require('node:stream');

const {
  createNaturalSessionControl
} = require(
  '../../accelerator/cli/natural-session-control'
);

const {
  createInteractiveSession
} = require(
  '../../accelerator/cli/surgical'
);

const ROOT = path.resolve(__dirname, '../..');

function naturalActivation() {
  return Object.freeze({
    repositoryPath: ROOT,
    workspace: 'surgical-dev-ops',
    protocols: Object.freeze({
      bhSep: '2.2',
      bhSdp: '2.2'
    }),
    interactionMode: Object.freeze({
      mode: 'NATURAL'
    })
  });
}

test(
  'natural mission cancellation is a deterministic control action with zero authority',
  () => {
    for (const input of [
      'cancele esta missão',
      'cancelar a missão atual',
      'pare esta missão',
      'cancel this mission',
      'cancel the current mission',
      'stop this mission'
    ]) {
      const control =
        createNaturalSessionControl({
          workspace: 'surgical-dev-ops'
        });

      const result = control.handle(input);

      assert.equal(result.matched, true, input);
      assert.equal(result.action, 'MISSION_CANCEL', input);
      assert.equal(result.authorityExpansion, false, input);
      assert.equal(result.operationalAuthority, false, input);
      assert.equal(result.mutationAuthority, false, input);
      assert.equal(result.publicationAuthority, false, input);
    }

    const pending =
      createNaturalSessionControl({
        workspace: 'surgical-dev-ops'
      });

    pending.handle(
      'liste os arquivos deste diretório'
    );
    assert.equal(
      pending.hasPendingAuthorization(),
      true
    );

    assert.equal(
      pending.handle(
        'cancele esta missão'
      ).action,
      'MISSION_CANCEL'
    );
    assert.equal(
      pending.hasPendingAuthorization(),
      false
    );
  }
);

test(
  'real NATURAL session cannot let a provider claim cancellation without CANCELLED state',
  async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let observed = '';
    let providerCalls = 0;

    output.on('data', (chunk) => {
      observed += chunk.toString();
    });

    createInteractiveSession(
      naturalActivation(),
      {
        input,
        output,
        terminal: false,
        cognitiveSession: Object.freeze({
          async ask() {
            providerCalls += 1;
            return 'PROVIDER_FALSE_CANCELLATION_SUCCESS\n';
          }
        })
      }
    );

    input.end(
      'cancele esta missão\n' +
      '/status\n' +
      '/resume\n' +
      '/status\n' +
      'exit\n'
    );

    await new Promise(
      (resolve) => setTimeout(resolve, 100)
    );

    assert.equal(providerCalls, 0);
    assert.doesNotMatch(
      observed,
      /PROVIDER_FALSE_CANCELLATION_SUCCESS/
    );
    assert.doesNotMatch(observed, /State: PLANNING/);
    assert.match(
      observed,
      /Missão governada cancelada por solicitação humana/i
    );
    assert.match(
      observed,
      /missão cancelada é terminal.*não foi retomada/is
    );

    const cancelledProjections =
      observed.match(/State: CANCELLED/g) || [];

    assert.ok(
      cancelledProjections.length >= 3,
      observed
    );
    assert.match(
      observed,
      /Projection authority: none/
    );
  }
);
