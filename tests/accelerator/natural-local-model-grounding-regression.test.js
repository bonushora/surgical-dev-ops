'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const {
  createNaturalCognitiveSession
} = require(
  '../../accelerator/cli/natural-cognitive-session'
);

const {
  createNaturalSessionControl
} = require(
  '../../accelerator/cli/natural-session-control'
);

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

test(
  'Portuguese provider command remains deterministic and never reaches cognition',
  () => {
    const control =
      createNaturalSessionControl({
        workspace:
          'surgical-dev-ops'
      });

    const result =
      control.handle(
        'provedores'
      );

    assert.equal(
      result.matched,
      true
    );

    assert.equal(
      result.action,
      'PROVIDER_STATUS'
    );
  }
);

test(
  'planner requires a textual response and further file evidence for broad analysis',
  async () => {
    let observedObjective =
      null;

    let observedEvidenceContext =
      null;

    const session =
      createNaturalCognitiveSession({
        assistanceContext:
          null,

        fetchImplementation:
          async (
            url,
            options = {}
          ) => {
            if (
              options.method ===
                'HEAD'
            ) {
              return new Response(
                null,
                {
                  status: 200
                }
              );
            }

            if (
              url.endsWith(
                '/api/tags'
              )
            ) {
              return response({
                models: [
                  {
                    name:
                      'qwen3:8b',
                    model:
                      'qwen3:8b'
                  }
                ]
              });
            }

            const body =
              JSON.parse(
                options.body
              );

            const envelope =
              JSON.parse(
                body.messages[1].content
              );

            observedObjective =
              envelope.objective;

            observedEvidenceContext =
              envelope.context
                .qualifiedGovernedEvidence;

            return response({
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
                        'README.md',

                      reason:
                        'A descrição do projeto exige conteúdo real.'
                    }
                  })
              }
            });
          }
      });

    const history =
      [
        'TYPE: WORKSPACE_FILES\n' +
          'x'.repeat(12000),

        'TYPE: READ_FILE\n' +
          'y'.repeat(12000)
      ];

    const result =
      await session.decideEvidence(
        'Explique este projeto.',
        activation(),
        history
      );

    assert.equal(
      result.decision,
      'REQUEST_EVIDENCE'
    );

    assert.match(
      observedObjective,
      /uma única string textual/i
    );

    assert.match(
      observedObjective,
      /WORKSPACE_FILES sozinho não basta/i
    );

    assert.match(
      observedObjective,
      /fato parcial verdadeiro.*limpeza do worktree.*não conclui/i
    );

    assert.match(
      observedObjective,
      /afirmação específica.*suportável pela evidência governada/i
    );

    assert.match(
      observedObjective,
      /fatos observados, inferências e recomendações/i
    );

    assert.ok(
      observedObjective.length <
        11000
    );

    assert.match(
      observedEvidenceContext
        .normalizedContext,
      /EVIDENCE_1/
    );

    assert.match(
      observedEvidenceContext
        .normalizedContext,
      /EVIDENCE_2/
    );

    assert.equal(
      observedEvidenceContext.status,
      'AVAILABLE'
    );

    assert.equal(
      observedEvidenceContext.evidenceCount,
      2
    );

    assert.doesNotMatch(
      observedObjective,
      /Nenhuma evidência governada foi obtida/i
    );
  }
);

test(
  'local provider timeout remains bounded by the qualified performance profile',
  () => {
    const {
      NATURAL_LOCAL_INFERENCE_PROFILE
    } = require(
      '../../accelerator/cli/natural-local-inference-profile'
    );

    const source =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/adapters/ollama-local-transport'
        ),
        'utf8'
      );

    assert.equal(
      NATURAL_LOCAL_INFERENCE_PROFILE.timeoutMs,
      60000
    );

    assert.match(
      source,
      /NATURAL_LOCAL_INFERENCE_PROFILE\s*\.timeoutMs/
    );

    assert.doesNotMatch(
      source,
      /const TIMEOUT_MS\s*=\s*30000;/
    );
  }
);


test(
  'generic NATURAL cognition performs one bounded provider attempt',
  () => {
    const source =
      fs.readFileSync(
        require.resolve(
          '../../accelerator/cli/natural-cognitive-session'
        ),
        'utf8'
      );

    const askStart =
      source.indexOf(
        '  async function ask('
      );

    const decideStart =
      source.indexOf(
        '  async function decideEvidence('
      );

    assert.ok(askStart >= 0);
    assert.ok(decideStart > askStart);

    const askSource =
      source.slice(
        askStart,
        decideStart
      );

    assert.equal(
      (
        askSource.match(
          /await invokeOnce\(\)/g
        ) || []
      ).length,
      1
    );

    assert.doesNotMatch(
      askSource,
      /Cognitive retry|additional attempt/
    );
  }
);
