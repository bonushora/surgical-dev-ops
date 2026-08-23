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
      /Resposta cognitiva do Llama 3 via Ollama/
    );

    assert.match(
      output,
      /Nenhuma alteração foi realizada/
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

    assert.match(
      output,
      /Nenhuma alteração foi realizada/
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
