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

test(
  'NATURAL exposes and resets bounded conversation state without cognition',
  async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let observed = '';
    let resets = 0;

    output.on('data', (chunk) => {
      observed += chunk.toString();
    });

    cli.createInteractiveSession(
      naturalActivation(),
      {
        input,
        output,
        terminal: false,
        cognitiveSession: Object.freeze({
          conversationState() {
            return Object.freeze({
              turnCount: 2,
              decisionCacheEntries: 3,
              decisionCacheHits: 1
            });
          },
          resetConversation() {
            resets += 1;
            return Object.freeze({ turnCount: 0 });
          }
        })
      }
    );

    input.end(
      'estado da conversa\n' +
      'limpar conversa\n' +
      'exit\n'
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.match(observed, /Interações lembradas: 2/);
    assert.match(observed, /Decisões cognitivas em cache: 3/);
    assert.match(observed, /Persistência: não/);
    assert.match(observed, /memória e o cache temporários.*limpos/i);
    assert.equal(resets, 1);
  }
);

test(
  'NATURAL activates a qualified local model through the session boundary',
  async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let observed = '';
    let requested = null;

    output.on('data', (chunk) => {
      observed += chunk.toString();
    });

    cli.createInteractiveSession(
      naturalActivation(),
      {
        input,
        output,
        terminal: false,
        cognitiveSession: Object.freeze({
          async selectLocalModel(model) {
            requested = model;
            return Object.freeze({
              model,
              available: true,
              operationalAuthority: false
            });
          }
        })
      }
    );

    input.end(
      'usar gemma3:4b\n' +
      'exit\n'
    );

    await new Promise(
      (resolve) => setTimeout(resolve, 50)
    );

    assert.equal(
      requested,
      'gemma3:4b'
    );
    assert.match(
      observed,
      /Modelo local ativado nesta sessão: gemma3:4b/
    );
    assert.match(
      observed,
      /autoridade operacional.*inexistente/i
    );
  }
);

test(
  'NATURAL terminal renders the shared bilingual experience projection',
  async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let observed = '';

    output.on('data', (chunk) => {
      observed += chunk.toString();
    });

    cli.createInteractiveSession(
      naturalActivation(),
      {
        input,
        output,
        terminal: false,
        cognitiveSession: Object.freeze({
          async describe() {
            return Object.freeze({
              available: true,
              provider: 'Ollama',
              model: 'qwen3:8b'
            });
          },
          conversationState() {
            return Object.freeze({ turnCount: 1 });
          }
        })
      }
    );

    input.end('estado da experiência\nexperience status\nexit\n');
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.match(observed, /Estado da experiência/);
    assert.match(observed, /Experience state/);
    assert.match(observed, /Ollama\/qwen3:8b/);
    assert.match(observed, /Autoridade operacional.*nenhuma/);
    assert.match(observed, /Operational authority.*none/);
  }
);

test(
  'NATURAL CLI projects governed mission state without granting authority',
  async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let observed = '';

    output.on('data', (chunk) => {
      observed += chunk.toString();
    });

    cli.createInteractiveSession(
      naturalActivation(),
      {
        input,
        output,
        terminal: false,
        cognitiveSession: Object.freeze({})
      }
    );

    input.end(
      '/status\n' +
      '/plan\n' +
      '/authority\n' +
      '/resume\n' +
      'exit\n'
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.match(observed, /Mission: cli-natural-/);
    assert.match(observed, /State: PLANNING/);
    assert.match(observed, /Projection authority: none/);
    assert.match(
      observed,
      /ACTIVE: Maintain governed conversational session state\./
    );
    assert.match(observed, /Authority projection:/);
    assert.match(
      observed,
      /Local commit does not grant push\./
    );
    assert.doesNotMatch(
      observed,
      /No active governed mission/
    );
  }
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

function frozenDecision(
  decision
) {
  if (
    decision &&
    decision.evidenceRequest
  ) {
    decision.evidenceRequest =
      Object.freeze(
        decision.evidenceRequest
      );
  }

  return Object.freeze(
    decision
  );
}

function workspaceFilesEvidence(
  files
) {
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
        files
      }
    }
  };
}

function fileReadEvidence(
  target,
  content
) {
  return {
    orchestration: {
      status:
        'COMPLETED'
    },
    execution: {
      schema:
        'sdo.filesystem_read_result.v1',
      target: {
        requested:
          target
      },
      evidence: {
        bytes:
          Buffer.byteLength(
            content,
            'utf8'
          ),
        sha256:
          'a'.repeat(64),
        content
      }
    }
  };
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
  'NATURAL project analysis stops file reads outside the governed discovery index',
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

    let gitReads =
      0;
    let fileReads =
      0;

    const cognitiveSession =
      Object.freeze({
        async decideEvidence() {
          return frozenDecision({
            schema:
              'sdo.natural_evidence_decision.v1',
            decision:
              'REQUEST_EVIDENCE',
            response:
              null,
            evidenceRequest: {
              kind:
                'READ_FILE',
              target:
                'not-indexed.js',
              reason:
                'Try to expand beyond discovery.'
            }
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
        dispatchEvidence(intent) {
          if (intent.capabilityType === 'GIT_READ') {
            gitReads += 1;
            return workspaceFilesEvidence([
              'package.json'
            ]);
          }

          fileReads += 1;
          return fileReadEvidence(
            intent.target,
            'const leaked = true;\n'
          );
        }
      }
    );

    input.write(
      'Explique este projeto para mim.\n'
    );

    await new Promise(
      (resolve) => setTimeout(resolve, 10)
    );

    input.write('sim\n');

    await new Promise(
      (resolve) => setTimeout(resolve, 50)
    );

    input.end();

    assert.equal(
      gitReads,
      2
    );
    assert.equal(
      fileReads,
      0
    );
    assert.match(
      observed,
      /fora da autorização atual/i
    );
  }
);

test(
  'NATURAL file explanation redacts sensitive evidence before the provider',
  async () => {
    const input =
      new PassThrough();

    const output =
      new PassThrough();

    let observed =
      '';
    let governedEvidence =
      null;

    output.on(
      'data',
      (chunk) => {
        observed +=
          chunk.toString();
      }
    );

    const rawSecret =
      'sk-abcdefghijklmnopqrstuvwxyz123456';

    const cognitiveSession =
      Object.freeze({
        async ask(
          _objective,
          _activation,
          evidence
        ) {
          governedEvidence =
            evidence;
          return 'Explicação produzida sem segredo bruto.\n';
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
        dispatchEvidence(intent) {
          if (intent.capabilityType === 'GIT_READ') {
            return workspaceFilesEvidence([
              'secret.js'
            ]);
          }

          return fileReadEvidence(
            'secret.js',
            `const token = "${rawSecret}";\n`
          );
        }
      }
    );

    input.write(
      'explique o arquivo secret.js\n'
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
      /Explicação produzida/
    );
    assert.ok(
      governedEvidence
    );
    assert.doesNotMatch(
      governedEvidence,
      new RegExp(rawSecret)
    );
    assert.match(
      governedEvidence,
      /REDACTED_BY_SURGICAL_DEVOPS/
    );
  }
);

test(
  'NATURAL file explanation blocks private-key evidence before cognition',
  async () => {
    const input =
      new PassThrough();

    const output =
      new PassThrough();

    let observed =
      '';
    let cognitiveCalls =
      0;

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
          cognitiveCalls += 1;
          return 'must not be called\n';
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
        dispatchEvidence(intent) {
          if (intent.capabilityType === 'GIT_READ') {
            return workspaceFilesEvidence([
              'secret.js'
            ]);
          }

          return fileReadEvidence(
            'secret.js',
            '-----BEGIN PRIVATE KEY-----\nsecret\n'
          );
        }
      }
    );

    input.write(
      'explique o arquivo secret.js\n'
    );

    await new Promise(
      (resolve) => setTimeout(resolve, 10)
    );

    input.write('sim\n');

    await new Promise(
      (resolve) => setTimeout(resolve, 50)
    );

    input.end();

    assert.equal(
      cognitiveCalls,
      0
    );
    assert.match(
      observed,
      /falhou de forma segura/i
    );
    assert.doesNotMatch(
      observed,
      /PRIVATE KEY/
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

    const cognitiveSession =
      Object.freeze({
        async decideEvidence(
          _objective,
          _activation,
          history
        ) {
          histories.push([...history]);

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
        dispatchEvidence(intent) {
          if (intent.capabilityType === 'GIT_READ') {
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
                    'README.md',
                    'package.json'
                  ]
                }
              }
            };
          }

          return {
            orchestration: {
              status:
                'COMPLETED'
            },
            execution: {
              schema:
                'sdo.filesystem_read_result.v1',
              target: {
                requested:
                  'README.md'
              },
              evidence: {
                bytes:
                  19,
                sha256:
                  'a'.repeat(64),
                content:
                  '# Surgical DevOps\n'
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

    assert.match(
      observed,
      /foram fornecidas à síntese 2 evidências governadas/i
    );

    assert.match(
      observed,
      /inferências e recomendações permanecem cognitivas/i
    );

    assert.doesNotMatch(
      observed,
      /a resposta foi fundamentada/i
    );

    assert.match(
      observed,
      /obtendo evidência governada pelo Orchestrator/i
    );

    assert.match(
      observed,
      /aguardando a análise cognitiva do provider/i
    );

    assert.match(
      observed,
      /tentativa local permanece limitada a 180 segundos/i
    );

    assert.match(
      observed,
      /síntese cognitiva concluída.*resposta delimitada/i
    );

    assert.equal(
      histories.length,
      1
    );

    assert.equal(
      histories[0].length,
      2
    );

    assert.match(
      histories[0][0],
      /WORKSPACE_FILES/
    );

    assert.match(
      histories[0][1],
      /TARGET: README\.md/
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
        cognitiveSession,
        dispatchEvidence() {
          throw new Error(
            'governed evidence unavailable'
          );
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

    assert.doesNotMatch(
      observed,
      /Afirmação não fundamentada/
    );

    assert.match(
      observed,
      /não consegui concluir a análise.*governança permanece ativa/i
    );
  }
);

test(
  'NATURAL CLI reports provider failure separately after governed evidence acquisition',
  async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let observed = '';

    output.on('data', (chunk) => {
      observed += chunk.toString();
    });

    cli.createInteractiveSession(
      naturalActivation(),
      {
        input,
        output,
        terminal: false,
        cognitiveSession: Object.freeze({
          async decideEvidence() {
            throw new Error(
              'provider failed after acquisition'
            );
          }
        }),
        dispatchEvidence(intent) {
          if (intent.capabilityType === 'GIT_READ') {
            return {
              orchestration: { status: 'COMPLETED' },
              execution: {
                schema: 'sdo.git_read_result.v1',
                selector: 'WORKSPACE_FILES',
                result: {
                  files: [
                    'README.md',
                    'docs/ENGINEERING_EVIDENCE.md',
                    'ROADMAP.md'
                  ]
                }
              }
            };
          }

          return {
            orchestration: { status: 'COMPLETED' },
            execution: {
              schema: 'sdo.filesystem_read_result.v1',
              target: { requested: intent.target },
              evidence: {
                bytes: 64,
                sha256: 'a'.repeat(64),
                content:
                  `Qualified content from ${intent.target}.`
              }
            }
          };
        }
      }
    );

    input.write(
      'Avalie a saúde do projeto e recomende a próxima prioridade de engenharia.\n'
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
      /foram obtidas 4 evidências governadas.*provider não concluiu o processamento cognitivo/i
    );
    assert.doesNotMatch(
      observed,
      /não foi obtida evidência qualificada suficiente/i
    );
    assert.match(
      observed,
      /aguardando a análise cognitiva do provider/i
    );
    assert.match(
      observed,
      /nenhum arquivo foi alterado/i
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
        dispatchEvidence(intent) {
          if (intent.capabilityType === 'GIT_READ') {
            return {
              orchestration: {
                status: 'COMPLETED'
              },
              execution: {
                schema:
                  'sdo.git_read_result.v1',
                selector:
                  'WORKSPACE_FILES',
                result: {
                  files: [
                    'accelerator/example.js'
                  ]
                }
              }
            };
          }

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
