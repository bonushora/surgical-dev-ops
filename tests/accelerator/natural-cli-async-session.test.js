'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const {
  PassThrough
} = require('node:stream');

const path =
  require('node:path');

const cli =
  require(
    '../../accelerator/cli/surgical'
  );

function naturalActivation() {
  return Object.freeze({
    repositoryPath:
      path.resolve(
        __dirname,
        '../..'
      ),

    workspace:
      'surgical-dev-ops',

    protocols:
      Object.freeze({
        bhSep:
          '2.2',

        bhSdp:
          '2.2'
      }),

    interactionMode:
      Object.freeze({
        mode:
          'NATURAL'
      })
  });
}

test(
  'NATURAL async cognitive response survives input EOF without readline use-after-close',
  async () => {
    const input =
      new PassThrough();

    const output =
      new PassThrough();

    let observed =
      '';

    output.on(
      'data',
      (chunk) => {
        observed +=
          chunk.toString();
      }
    );

    const cognitiveSession =
      Object.freeze({
        async ask() {
          /*
           * Force asynchronous completion after stdin has
           * already had an opportunity to reach EOF.
           */
          await new Promise(
            (resolve) =>
              setImmediate(resolve)
          );

          return (
            'Resposta cognitiva simulada.\\n' +
            'Nenhuma alteração foi realizada.\\n'
          );
        }
      });

    cli.createInteractiveSession(
      naturalActivation(),
      {
        input,
        output,
        terminal:
          false,

        cognitiveSession
      }
    );

    input.end(
      'Explique este projeto para mim.\\n' +
      'exit\\n'
    );

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          50
        )
    );

    assert.match(
      observed,
      /Resposta cognitiva simulada/
    );

    assert.match(
      observed,
      /Nenhuma alteração foi realizada/
    );

    assert.doesNotMatch(
      observed,
      /failed closed while processing/i
    );

    assert.doesNotMatch(
      observed,
      /ERR_USE_AFTER_CLOSE/i
    );
  }
);
