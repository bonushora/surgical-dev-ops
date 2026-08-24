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
      'Converse comigo sobre boas práticas.\\n' +
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

test(
  'NATURAL project analysis crosses authorization and governed evidence loop before response',
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

    const histories = [];
    let decisions = 0;

    const cognitiveSession =
      Object.freeze({
        async decideEvidence(
          _objective,
          _activation,
          history
        ) {
          histories.push([...history]);
          decisions += 1;

          if (decisions === 1) {
            return Object.freeze({
              schema:
                'sdo.natural_evidence_decision.v1',
              decision:
                'REQUEST_EVIDENCE',
              response:
                null,
              evidenceRequest:
                Object.freeze({
                  kind:
                    'WORKSPACE_FILES',
                  target:
                    null,
                  reason:
                    'Identificar a estrutura real do projeto.'
                })
            });
          }

          return Object.freeze({
            schema:
              'sdo.natural_evidence_decision.v1',
            decision:
              'RESPOND',
            response:
              'O projeto contém arquivos observados pelo Orchestrator.',
            evidenceRequest:
              null
          });
        }
      });

    cli.createInteractiveSession(
      naturalActivation(),
      {
        input,
        output,
        terminal:
          false,
        cognitiveSession,
        dispatchEvidence() {
          return {
            orchestration: {
              status:
                'COMPLETED'
            },
            execution: {
              schema:
                'sdo.git_read_result.v1',
              selector:
                'WORKSPACE_FILES',
              result: {
                files: [
                  'package.json',
                  'accelerator/cli/surgical.js'
                ]
              }
            }
          };
        }
      }
    );

    input.write(
      'Explique este projeto para mim.\n'
    );

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          10
        )
    );

    input.write(
      'sim\n'
    );

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          50
        )
    );

    input.end();

    assert.match(
      observed,
      /Posso prosseguir/i
    );

    assert.match(
      observed,
      /arquivos observados pelo Orchestrator/i
    );

    assert.match(
      observed,
      /evidências governadas do projeto/i
    );

    assert.equal(
      histories.length,
      2
    );

    assert.equal(
      histories[0].length,
      0
    );

    assert.match(
      histories[1][0],
      /WORKSPACE_FILES/
    );

    assert.doesNotMatch(
      observed,
      /falhou de forma segura/i
    );
  }
);

test(
  'NATURAL project analysis rejects cognitive response with zero governed evidence',
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
        async decideEvidence() {
          return Object.freeze({
            schema:
              'sdo.natural_evidence_decision.v1',
            decision:
              'RESPOND',
            response:
              'Afirmação não fundamentada sobre o projeto.',
            evidenceRequest:
              null
          });
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

    input.write(
      'Explique este projeto para mim.\n'
    );

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          10
        )
    );

    input.write(
      'sim\n'
    );

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          50
        )
    );

    input.end();

    assert.doesNotMatch(
      observed,
      /Afirmação não fundamentada/
    );

    assert.match(
      observed,
      /falhou de forma segura/i
    );
  }
);
