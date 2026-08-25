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

const {
  materializeGovernedEngineeringProposal
} = require(
  '../../accelerator/core/governed-engineering-proposal'
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

function engineerActivation() {
  const current =
    naturalActivation();

  return Object.freeze({
    ...current,
    interactionMode:
      Object.freeze({
        mode:
          'ENGINEER'
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

test(
  'ENGINEER produces an evidence-bound proposal and stops before R3 mutation',
  async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let observed = '';
    let decision = 0;

    output.on('data', (chunk) => {
      observed += chunk.toString();
    });

    const cognitiveSession =
      Object.freeze({
        async decideEvidence() {
          decision += 1;

          if (decision === 1) {
            return Object.freeze({
              schema:
                'sdo.natural_evidence_decision.v1',
              decision:
                'REQUEST_EVIDENCE',
              response:
                null,
              evidenceRequest:
                Object.freeze({
                  kind: 'READ_FILE',
                  target: 'accelerator/example.js',
                  reason: 'Observar BEFORE.'
                })
            });
          }

          return Object.freeze({
            schema:
              'sdo.natural_evidence_decision.v1',
            decision: 'RESPOND',
            response: 'Evidência suficiente.',
            evidenceRequest: null
          });
        },

        async proposePatch(objective) {
          return materializeGovernedEngineeringProposal({
            schema:
              'sdo.ai_engineering_patch_proposal.v1',
            objective,
            target:
              'accelerator/example.js',
            beforeSha256:
              'a'.repeat(64),
            replacementBase64:
              Buffer.from(
                "'use strict';\nmodule.exports = {};\n"
              ).toString('base64'),
            reason:
              'Correção limitada ao arquivo observado.',
            validationKind:
              'VALIDATE_JS'
          });
        }
      });

    cli.createInteractiveSession(
      engineerActivation(),
      {
        input,
        output,
        terminal: false,
        cognitiveSession,
        dispatchEvidence() {
          return {
            orchestration: {
              status: 'COMPLETED'
            },
            execution: {
              schema:
                'sdo.filesystem_read_result.v1',
              target: {
                requested:
                  'accelerator/example.js'
              },
              evidence: {
                bytes: 14,
                sha256: 'a'.repeat(64),
                content: "'use strict';\n"
              }
            }
          };
        }
      }
    );

    input.write(
      'Analise este projeto e proponha uma correção.\n'
    );

    await new Promise(
      (resolve) => setTimeout(resolve, 10)
    );

    input.write('sim\n');

    await new Promise(
      (resolve) => setTimeout(resolve, 50)
    );

    input.end();

    assert.match(
      observed,
      /Proposta de engenharia qualificada/
    );
    assert.match(
      observed,
      /BEFORE SHA256: a{64}/
    );
    assert.match(
      observed,
      /patch accelerator\/example\.js --content-base64/
    );
    assert.match(
      observed,
      /nenhuma alteração foi executada/i
    );
    assert.doesNotMatch(
      observed,
      /falhou de forma segura/i
    );
  }
);
