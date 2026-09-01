'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createNaturalCognitiveSession
} = require('../../accelerator/cli/natural-cognitive-session');
const {
  detectNaturalGovernedTask
} = require('../../accelerator/cli/natural-governed-task');
const {
  runNaturalRecursiveEvidenceLoop
} = require('../../accelerator/cli/natural-recursive-evidence-loop');

const OBJECTIVE =
  'Avalie a saúde e a prontidão do projeto e recomende a próxima prioridade de engenharia.';

function activation() {
  return Object.freeze({
    workspace: 'surgical-dev-ops',
    repositoryPath: '/qualified/project',
    interactionMode: Object.freeze({ mode: 'NATURAL' })
  });
}

function providerResponse(content) {
  return new Response(
    JSON.stringify({
      message: {
        role: 'assistant',
        content: JSON.stringify(content)
      }
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }
  );
}

function workspaceEvidence() {
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

function fileEvidence(target) {
  return {
    orchestration: { status: 'COMPLETED' },
    execution: {
      schema: 'sdo.filesystem_read_result.v1',
      target: { requested: target },
      evidence: {
        bytes: 64,
        sha256: 'a'.repeat(64),
        content: `Qualified governed content from ${target}.`
      }
    }
  };
}

test('acquired governed evidence remains explicit in the real cognitive provider invocation', async () => {
  let providerEnvelope = null;
  let chatInvocations = 0;

  const cognitiveSession = createNaturalCognitiveSession({
    assistanceContext: null,
    async fetchImplementation(url, options = {}) {
      if (url.endsWith('/api/tags')) {
        return new Response(
          JSON.stringify({ models: [{ name: 'qwen3:8b' }] }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        );
      }

      chatInvocations += 1;
      const transport = JSON.parse(options.body);
      providerEnvelope = JSON.parse(transport.messages[1].content);

      return providerResponse({
        decision: 'RESPOND',
        response:
          'A saúde e a prontidão foram avaliadas com as evidências fornecidas; a próxima prioridade é a recomendação fundamentada no roadmap.',
        evidenceRequest: null
      });
    }
  });

  const result = await runNaturalRecursiveEvidenceLoop({
    task: detectNaturalGovernedTask(OBJECTIVE),
    activation: activation(),
    cognitiveSession,
    dispatchEvidence(intent) {
      return intent.capabilityType === 'GIT_READ'
        ? workspaceEvidence()
        : fileEvidence(intent.target);
    }
  });

  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.evidence.length, 4);
  assert.equal(chatInvocations, 1);
  assert.ok(providerEnvelope);

  const handoff =
    providerEnvelope.context.qualifiedGovernedEvidence;

  assert.equal(handoff.status, 'AVAILABLE');
  assert.equal(handoff.evidenceCount, 4);
  assert.ok(
    handoff.normalizedContext.length <= 3200
  );
  assert.match(handoff.normalizedContext, /TYPE: WORKSPACE_FILES/);
  assert.match(handoff.normalizedContext, /TARGET: README\.md/);
  assert.match(
    handoff.normalizedContext,
    /TARGET: docs\/ENGINEERING_EVIDENCE\.md/
  );
  assert.match(handoff.normalizedContext, /TARGET: ROADMAP\.md/);
  assert.doesNotMatch(
    providerEnvelope.objective,
    /TYPE: WORKSPACE_FILES|TYPE: READ_FILE/
  );
  assert.doesNotMatch(
    providerEnvelope.objective,
    /Nenhuma evidência governada foi obtida/i
  );

  const serializedProviderEnvelope =
    JSON.stringify(
      providerEnvelope
    );

  assert.equal(
    (
      serializedProviderEnvelope.match(
        /TYPE: WORKSPACE_FILES/g
      ) || []
    ).length,
    1
  );

  assert.equal(
    (
      serializedProviderEnvelope.match(
        /TYPE: READ_FILE/g
      ) || []
    ).length,
    3
  );
});

test('cognitive failure after acquisition is distinct from zero qualified evidence', async () => {
  const result = await runNaturalRecursiveEvidenceLoop({
    task: detectNaturalGovernedTask(OBJECTIVE),
    activation: activation(),
    cognitiveSession: {
      async decideEvidence() {
        throw new Error('provider failed');
      }
    },
    dispatchEvidence(intent) {
      return intent.capabilityType === 'GIT_READ'
        ? workspaceEvidence()
        : fileEvidence(intent.target);
    }
  });

  assert.equal(result.status, 'FAILED');
  assert.equal(result.evidence.length, 4);
  assert.match(
    result.reason,
    /cognitive processing failed after qualified governed evidence was acquired/i
  );
  assert.equal(result.operationalAuthority, false);
  assert.equal(result.mutationAuthority, false);
});
