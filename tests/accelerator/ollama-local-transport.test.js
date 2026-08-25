'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createLocalOllamaTransport
} = require('../../accelerator/adapters/ollama-local-transport');

const FIXED_ENDPOINT =
  'http://127.0.0.1:11434/api/chat';

function canonicalRequest(
  overrides = {}
) {
  return Object.freeze({
    operation:
      'CHAT',

    model:
      'llama3:latest',

    stream:
      false,

    temperature:
      0,

    maxOutputTokens:
      512,

    messages:
      Object.freeze([
        Object.freeze({
          role:
            'system',

          content:
            'Return JSON cognitive evidence.'
        }),

        Object.freeze({
          role:
            'user',

          content:
            'Plan safely.'
        })
      ]),

    ...overrides
  });
}

function jsonResponse(
  value,
  status = 200
) {
  return new Response(
    JSON.stringify(value),
    {
      status,

      headers: {
        'content-type':
          'application/json'
      }
    }
  );
}

test(
  'local Ollama transport exposes immutable fixed loopback authority',
  () => {
    const transport =
      createLocalOllamaTransport({
        fetchImplementation:
          async () =>
            jsonResponse({})
      });

    assert.equal(
      transport.schema,
      'sdo.ollama_local_transport.v1'
    );

    assert.equal(
      transport.endpoint,
      FIXED_ENDPOINT
    );

    assert.equal(
      typeof transport.invoke,
      'function'
    );

    assert.ok(
      Object.isFrozen(transport)
    );

    for (const forbidden of [
      'setEndpoint',
      'setHost',
      'setPort',
      'setHeaders',
      'authorization',
      'token',
      'apiKey'
    ]) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          transport,
          forbidden
        ),
        false
      );
    }
  }
);

test(
  'transport maps canonical protocol request to fixed Ollama chat HTTP request',
  async () => {
    let observedUrl;
    let observedOptions;

    const transport =
      createLocalOllamaTransport({
        fetchImplementation:
          async (url, options) => {
            observedUrl =
              url;

            observedOptions =
              options;

            return jsonResponse({
              message: {
                role:
                  'assistant',

                content:
                  '{"summary":"safe"}'
              },

              done:
                true
            });
          }
      });

    const result =
      await transport.invoke(
        canonicalRequest()
      );

    assert.equal(
      observedUrl,
      FIXED_ENDPOINT
    );

    assert.equal(
      observedOptions.method,
      'POST'
    );

    assert.deepEqual(
      observedOptions.headers,
      {
        'content-type':
          'application/json'
      }
    );

    assert.ok(
      observedOptions.signal
    );

    const body =
      JSON.parse(
        observedOptions.body
      );

    assert.equal(
      body.model,
      'llama3:latest'
    );

    assert.equal(
      body.stream,
      false
    );

    assert.equal(
      body.format,
      'json'
    );

    assert.equal(
      body.keep_alive,
      '10m'
    );

    assert.deepEqual(
      body.options,
      {
        temperature: 0,
        num_ctx: 4096,
        num_predict: 512
      }
    );

    assert.deepEqual(
      body.messages,
      canonicalRequest().messages
    );

    assert.equal(
      result.message.role,
      'assistant'
    );

    assert.equal(
      result.done,
      true
    );

    assert.ok(
      Object.isFrozen(result)
    );

    assert.ok(
      Object.isFrozen(
        result.message
      )
    );
  }
);

test(
  'caller cannot broaden local network authority through configuration',
  () => {
    for (const configuration of [
      {
        endpoint:
          'https://example.com/api/chat'
      },

      {
        url:
          'http://192.168.1.10:11434/api/chat'
      },

      {
        host:
          'example.com'
      },

      {
        port:
          9999
      },

      {
        headers:
          {}
      },

      {
        authorization:
          'Bearer secret'
      },

      {
        token:
          'secret'
      },

      {
        apiKey:
          'secret'
      }
    ]) {
      assert.throws(
        () =>
          createLocalOllamaTransport({
            fetchImplementation:
              async () =>
                jsonResponse({}),

            ...configuration
          }),
        /configuration|forbidden|authority/i
      );
    }
  }
);

test(
  'transport rejects broadened protocol requests before network dispatch',
  async () => {
    let calls = 0;

    const transport =
      createLocalOllamaTransport({
        fetchImplementation:
          async () => {
            calls += 1;

            return jsonResponse({});
          }
      });

    const invalid = [
      canonicalRequest({
        operation:
          'GENERATE'
      }),

      canonicalRequest({
        stream:
          true
      }),

      canonicalRequest({
        temperature:
          0.8
      }),

      canonicalRequest({
        maxOutputTokens:
          999999
      }),

      canonicalRequest({
        model:
          ''
      }),

      canonicalRequest({
        messages:
          Object.freeze([])
      }),

      canonicalRequest({
        endpoint:
          'http://example.com'
      }),

      canonicalRequest({
        authorization:
          'secret'
      })
    ];

    for (const request of invalid) {
      await assert.rejects(
        () =>
          transport.invoke(
            request
          ),
        /request|operation|stream|temperature|budget|model|messages|forbidden/i
      );
    }

    assert.equal(
      calls,
      0
    );
  }
);

test(
  'transport emits no credential-bearing headers',
  async () => {
    let headers;

    const transport =
      createLocalOllamaTransport({
        fetchImplementation:
          async (_url, options) => {
            headers =
              options.headers;

            return jsonResponse({
              message: {
                role:
                  'assistant',

                content:
                  '{"summary":"safe"}'
              },

              done:
                true
            });
          }
      });

    await transport.invoke(
      canonicalRequest()
    );

    const names =
      Object.keys(headers)
        .map(
          (name) =>
            name.toLowerCase()
        );

    for (const forbidden of [
      'authorization',
      'cookie',
      'proxy-authorization'
    ]) {
      assert.equal(
        names.includes(forbidden),
        false
      );
    }
  }
);

test(
  'non-success HTTP status fails closed without backend content disclosure',
  async () => {
    const transport =
      createLocalOllamaTransport({
        fetchImplementation:
          async () =>
            jsonResponse(
              {
                error:
                  'secret backend detail'
              },
              500
            )
      });

    await assert.rejects(
      async () => {
        try {
          await transport.invoke(
            canonicalRequest()
          );
        } catch (error) {
          assert.equal(
            error.message.includes(
              'secret backend detail'
            ),
            false
          );

          throw error;
        }
      },
      /ollama|http|failed/i
    );
  }
);

test(
  'malformed JSON response fails closed',
  async () => {
    const transport =
      createLocalOllamaTransport({
        fetchImplementation:
          async () =>
            new Response(
              'not-json',
              {
                status:
                  200,

                headers: {
                  'content-type':
                    'application/json'
                }
              }
            )
      });

    await assert.rejects(
      () =>
        transport.invoke(
          canonicalRequest()
        ),
      /json|response|malformed/i
    );
  }
);

test(
  'response beyond fixed byte bound fails closed',
  async () => {
    const transport =
      createLocalOllamaTransport({
        fetchImplementation:
          async () =>
            new Response(
              JSON.stringify({
                value:
                  'x'.repeat(
                    200000
                  )
              }),
              {
                status:
                  200,

                headers: {
                  'content-type':
                    'application/json'
                }
              }
            )
      });

    await assert.rejects(
      () =>
        transport.invoke(
          canonicalRequest()
        ),
      /size|large|limit|response/i
    );
  }
);

test(
  'timeout or fetch exception becomes bounded transport failure',
  async () => {
    const transport =
      createLocalOllamaTransport({
        fetchImplementation:
          async () => {
            const error =
              new Error(
                'secret socket detail'
              );

            error.name =
              'AbortError';

            throw error;
          }
      });

    await assert.rejects(
      async () => {
        try {
          await transport.invoke(
            canonicalRequest()
          );
        } catch (error) {
          assert.equal(
            error.message.includes(
              'secret socket detail'
            ),
            false
          );

          throw error;
        }
      },
      /ollama|transport|timeout|failed/i
    );
  }
);

test(
  'transport source contains fixed loopback authority and no shell process credentials or mutation authority',
  () => {
    const fs =
      require('node:fs');

    const source =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/adapters/ollama-local-transport'
        ),
        'utf8'
      );

    assert.ok(
      source.includes(
        '127.0.0.1'
      )
    );

    assert.ok(
      source.includes(
        '11434'
      )
    );

    assert.ok(
      source.includes(
        '/api/chat'
      )
    );

    for (const forbidden of [
      'child_process',
      'execSync',
      'spawnSync',
      'mutation-provider-internal',
      'mutation-provider-composition',
      'content-addressed-mutation-provider',
      'Bearer ',
      'privateKey',
      'apiKey'
    ]) {
      assert.equal(
        source.includes(
          forbidden
        ),
        false,
        `forbidden authority dependency: ${forbidden}`
      );
    }
  }
);
