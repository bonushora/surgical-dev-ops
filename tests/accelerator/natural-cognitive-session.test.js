'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const {
  extractText,
  formatCognitiveResult,
  createNaturalCognitiveSession
} = require(
  '../../accelerator/cli/natural-cognitive-session'
);

function activation() {
  return Object.freeze({
    workspace:
      'surgical-dev-ops',

    interactionMode:
      Object.freeze({
        mode:
          'NATURAL'
      })
  });
}

function response(payload) {
  return new Response(
    JSON.stringify(payload),
    {
      status: 200,
      headers: {
        'content-type':
          'application/json'
      }
    }
  );
}

test(
  'NATURAL extracts human text from bounded nested cognitive evidence',
  () => {
    assert.equal(
      extractText({
        response: {
          message:
            'Olá, posso explicar isso.'
        }
      }),
      'Olá, posso explicar isso.'
    );
  }
);

test(
  'NATURAL presentation explicitly identifies cognitive-only response',
  () => {
    const output =
      formatCognitiveResult(
        Object.freeze({
          schema:
            'sdo.ai_cognitive_result.v1',

          status:
            'COMPLETED',

          output:
            Object.freeze({
              summary:
                'Esta é apenas uma explicação.'
            })
        })
      );

    assert.match(
      output,
      /Esta é apenas uma explicação/
    );

    assert.match(
      output,
      /Esta é apenas uma explicação/
    );

    assert.doesNotMatch(
      output,
      /Resposta cognitiva do Llama 3 via Ollama/
    );
  }
);

test(
  'NATURAL cognitive session falls back safely when Ollama is unavailable',
  async () => {
    const session =
      createNaturalCognitiveSession({
        fetchImplementation:
          async () => {
            throw new Error(
              'offline'
            );
          }
      });

    const output =
      await session.ask(
        'Explique este projeto.',
        activation()
      );

    assert.match(
      output,
      /não está disponível/i
    );

    assert.match(
      output,
      /modo determinístico continua ativo/i
    );

    assert.match(
      output,
      /Nenhuma alteração foi realizada/i
    );
  }
);

test(
  'NATURAL free language crosses Ollama only as governed cognitive EXPLAIN',
  async () => {
    let chatBody = null;

    const session =
      createNaturalCognitiveSession({
        fetchImplementation:
          async (
            url,
            options
          ) => {
            if (
              url.endsWith(
                '/api/tags'
              )
            ) {
              return response({
                models: [
                  {
                    name:
                      'llama3:latest',
                    model:
                      'llama3:latest'
                  }
                ]
              });
            }

            assert.equal(
              url,
              'http://127.0.0.1:11434/api/chat'
            );

            chatBody =
              JSON.parse(
                options.body
              );

            return response({
              message: {
                role:
                  'assistant',

                content:
                  JSON.stringify({
                    response: {
                      message:
                        'Posso explicar o projeto, mas não executar alterações.'
                    }
                  })
              }
            });
          }
      });

    const output =
      await session.ask(
        'Explique este projeto para mim.',
        activation()
      );

    assert.ok(chatBody);

    assert.equal(
      chatBody.model,
      'llama3:latest'
    );

    assert.equal(
      chatBody.stream,
      false
    );

    assert.equal(
      chatBody.format,
      'json'
    );

    assert.match(
      output,
      /Posso explicar o projeto/
    );

    assert.doesNotMatch(
      output,
      /Resposta cognitiva do Llama 3 via Ollama/
    );
  }
);

test(
  'NATURAL materializes a cognitive patch only as a zero-authority governed proposal',
  async () => {
    let proposalBody = null;

    const session =
      createNaturalCognitiveSession({
        fetchImplementation:
          async (url, options) => {
            if (url.endsWith('/api/tags')) {
              return response({
                models: [
                  {
                    name: 'llama3:latest',
                    model: 'llama3:latest'
                  }
                ]
              });
            }

            proposalBody =
              JSON.parse(options.body);

            return response({
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  schema:
                    'sdo.ai_engineering_patch_proposal.v1',
                  objective:
                    'Corrigir accelerator/example.js.',
                  target:
                    'accelerator/example.js',
                  beforeSha256:
                    'a'.repeat(64),
                  replacementBase64:
                    Buffer.from(
                      "'use strict';\n"
                    ).toString('base64'),
                  reason:
                    'Correção limitada ao arquivo observado.',
                  validationKind:
                    'VALIDATE_JS'
                })
              }
            });
          }
      });

    const proposal =
      await session.proposePatch(
        'Corrigir accelerator/example.js.',
        activation(),
        'TYPE: READ_FILE\nTARGET: accelerator/example.js\nSHA256: ' +
          'a'.repeat(64)
      );

    assert.equal(
      proposal.schema,
      'sdo.governed_engineering_proposal.v1'
    );

    assert.equal(
      proposal.mutationAuthority,
      false
    );

    assert.equal(
      proposal.approvalAuthority,
      false
    );

    assert.equal(
      proposalBody.format,
      'json'
    );

    assert.match(
      proposalBody.messages
        .map((message) => message.content)
        .join('\n'),
      /não execute nada/i
    );
  }
);

test(
  'NATURAL refuses engineering proposal without governed evidence',
  async () => {
    const session =
      createNaturalCognitiveSession({
        fetchImplementation:
          async () => {
            throw new Error(
              'provider must not be reached'
            );
          }
      });

    await assert.rejects(
      () =>
        session.proposePatch(
          'Altere o projeto.',
          activation(),
          ''
        ),
      /evidence are required/
    );
  }
);

test(
  'NATURAL cognitive session exposes no operational authority',
  () => {
    const boundary =
      require(
        '../../accelerator/cli/natural-cognitive-session'
      );

    for (const forbidden of [
      'exec',
      'execute',
      'spawn',
      'shell',
      'command',
      'patch',
      'write',
      'approve',
      'authorize',
      'grant',
      'privateKey'
    ]) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          boundary,
          forbidden
        ),
        false
      );
    }
  }
);

test(
  'NATURAL retries at most once after failed cognitive evidence and performs no operational action',
  async () => {
    let chatCalls =
      0;

    const session =
      createNaturalCognitiveSession({
        fetchImplementation:
          async (
            url,
            options
          ) => {
            if (
              url.endsWith(
                '/api/tags'
              )
            ) {
              return response({
                models: [
                  {
                    name:
                      'llama3:latest',

                    model:
                      'llama3:latest'
                  }
                ]
              });
            }

            chatCalls += 1;

            if (chatCalls === 1) {
              throw new Error(
                'transient cognitive transport failure'
              );
            }

            const body =
              JSON.parse(
                options.body
              );

            assert.ok(
              Array.isArray(
                body.messages
              )
            );

            const userMessage =
              body.messages.find(
                (message) =>
                  message &&
                  typeof message === 'object' &&
                  message.role === 'user' &&
                  typeof message.content === 'string'
              );

            assert.ok(
              userMessage,
              'canonical Ollama user message is required'
            );

            const cognitiveEnvelope =
              JSON.parse(
                userMessage.content
              );

            assert.equal(
              cognitiveEnvelope.capability,
              'EXPLAIN'
            );

            assert.match(
              cognitiveEnvelope.objective,
              /uma única chave/i
            );

            assert.match(
              cognitiveEnvelope.objective,
              /"response"/
            );

            return response({
              message: {
                role:
                  'assistant',

                content:
                  JSON.stringify({
                    response:
                      'Resposta cognitiva recuperada com segurança.'
                  })
              }
            });
          }
      });

    const output =
      await session.ask(
        'Explique sua função.',
        activation()
      );

    assert.equal(
      chatCalls,
      2
    );

    assert.match(
      output,
      /Resposta cognitiva recuperada com segurança/
    );

    assert.doesNotMatch(
      output,
      /Resposta cognitiva do Llama 3 via Ollama/
    );
  }
);

test(
  'NATURAL canonical cognitive request explicitly asks for response-only JSON',
  async () => {
    let observedChat =
      null;

    const session =
      createNaturalCognitiveSession({
        fetchImplementation:
          async (
            url,
            options
          ) => {
            if (
              url.endsWith(
                '/api/tags'
              )
            ) {
              return response({
                models: [
                  {
                    name:
                      'llama3:latest',

                    model:
                      'llama3:latest'
                  }
                ]
              });
            }

            observedChat =
              JSON.parse(
                options.body
              );

            return response({
              message: {
                role:
                  'assistant',

                content:
                  JSON.stringify({
                    response:
                      'Contrato canônico respeitado.'
                  })
              }
            });
          }
      });

    const output =
      await session.ask(
        'Explique este projeto.',
        activation()
      );

    assert.ok(
      observedChat
    );

    const userEnvelope =
      JSON.parse(
        observedChat.messages[1].content
      );

    assert.match(
      userEnvelope.objective,
      /uma única chave/i
    );

    assert.match(
      userEnvelope.objective,
      /"response"/
    );

    assert.match(
      output,
      /Contrato canônico respeitado/
    );
  }
);

test(
  'NATURAL cognitive planner may request bounded evidence but cannot execute it',
  async () => {
    let observedRequest =
      null;

    function httpJsonResponse(
      payload
    ) {
      const bytes =
        new TextEncoder().encode(
          JSON.stringify(payload)
        );

      let delivered =
        false;

      return {
        status:
          200,

        body: {
          getReader() {
            return {
              async read() {
                if (delivered) {
                  return {
                    done:
                      true,

                    value:
                      undefined
                  };
                }

                delivered =
                  true;

                return {
                  done:
                    false,

                  value:
                    bytes
                };
              },

              releaseLock() {}
            };
          }
        }
      };
    }

    const session =
      createNaturalCognitiveSession({
        assistanceContext:
          null,

        getWorkMode:
          () =>
            'SUPERVISED_MICROTASKS',

        fetchImplementation:
          async (
            _url,
            options = {}
          ) => {
            /*
             * Discovery uses GET and consumes a bounded byte stream.
             */
            if (
              options.method ===
                'GET'
            ) {
              return httpJsonResponse({
                models: [
                  {
                    name:
                      'llama3:latest'
                  }
                ]
              });
            }

            /*
             * Cognitive invocation uses POST and the same bounded
             * byte-stream HTTP response contract.
             */
            if (
              options.method !==
                'POST' ||
              typeof options.body !==
                'string'
            ) {
              throw new Error(
                'Unexpected NATURAL cognitive test transport.'
              );
            }

            const body =
              JSON.parse(
                options.body
              );

            if (
              !body ||
              body.model !==
                'llama3:latest' ||
              !Array.isArray(
                body.messages
              ) ||
              body.messages.length !==
                2
            ) {
              throw new Error(
                'Unexpected Ollama cognitive request.'
              );
            }

            observedRequest =
              JSON.parse(
                body.messages[1].content
              );

            return httpJsonResponse({
              message: {
                role:
                  'assistant',

                content:
                  JSON.stringify({
                    decision:
                      'REQUEST_EVIDENCE',

                    response:
                      null,

                    evidenceRequest: {
                      kind:
                        'READ_FILE',

                      target:
                        'package.json',

                      reason:
                        'Preciso conhecer os scripts.'
                    }
                  })
              }
            });
          }
      });

    const result =
      await session.decideEvidence(
        'Analise este projeto.',
        {
          workspace:
            'example-project',

          interactionMode: {
            mode:
              'NATURAL'
          }
        },
        []
      );

    assert.equal(
      result.decision,
      'REQUEST_EVIDENCE'
    );

    assert.equal(
      result.evidenceRequest.kind,
      'READ_FILE'
    );

    assert.equal(
      result.evidenceRequest.target,
      'package.json'
    );

    assert.ok(
      observedRequest
    );

    assert.equal(
      observedRequest.capability,
      'PLAN'
    );

    assert.match(
      observedRequest.objective,
      /NÃO executa operações/i
    );

    assert.match(
      observedRequest.objective,
      /WORKSPACE_FILES/i
    );

    assert.match(
      observedRequest.objective,
      /READ_FILE/i
    );

    assert.match(
      observedRequest.objective,
      /VALIDATE_JS/i
    );

    assert.match(
      observedRequest.objective,
      /obrigatoriamente escrita em português brasileiro claro/i
    );
  }
);
