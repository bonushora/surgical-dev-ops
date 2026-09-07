'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const {
  createNaturalSessionControl,
  AUTHORIZED_TASK_REUSE_SCHEMA,
  naturalGovernedTaskFingerprint,
  naturalAuthorizedTaskReuseFingerprint,
  formatProviderStatus
} = require(
  '../../accelerator/cli/natural-session-control'
);

const {
  detectNaturalGovernedTask
} = require(
  '../../accelerator/cli/natural-governed-task'
);

function authorizedReuse(task, overrides = {}) {
  const taskFingerprint = naturalGovernedTaskFingerprint(task);
  const binding = {
    schema: AUTHORIZED_TASK_REUSE_SCHEMA,
    authorizationFingerprint: 'a'.repeat(64),
    sessionFingerprint: 'b'.repeat(64),
    taskFingerprint,
    envelopeFingerprint: 'c'.repeat(64),
    scopeFingerprint: taskFingerprint,
    workspace: '/tmp/example-project',
    objective: task.objective,
    taskKind: task.kind,
    risk: 'R1',
    validFrom: '2026-09-06T12:00:00.000Z',
    authorizedAt: '2026-09-06T12:00:01.000Z',
    reusedAt: '2026-09-06T12:01:00.000Z',
    expiresAt: '2026-09-06T12:10:00.000Z',
    physicalWorkspaceIdentity: 'd'.repeat(64),
    environmentFingerprint: 'e'.repeat(64),
    newHumanDecision: false,
    authorityExpanded: false,
    ...overrides
  };
  return Object.freeze({
    ...binding,
    reuseFingerprint:
      naturalAuthorizedTaskReuseFingerprint(binding)
  });
}

test(
  'NATURAL defaults to supervised microtasks',
  () => {
    const control =
      createNaturalSessionControl();

    assert.equal(
      control.currentWorkMode(),
      'SUPERVISED_MICROTASKS'
    );
  }
);

test('conversation memory controls remain deterministic session actions', () => {
  const control = createNaturalSessionControl();

  assert.deepEqual(
    control.handle('estado da conversa'),
    Object.freeze({ matched: true, action: 'CONVERSATION_STATUS' })
  );

  assert.deepEqual(
    control.handle('limpar conversa'),
    Object.freeze({ matched: true, action: 'CONVERSATION_RESET' })
  );
});

test(
  'explicit autonomy request changes cadence only to bounded autonomy mode',
  () => {
    const control =
      createNaturalSessionControl();

    const result =
      control.handle(
        'Trabalhe sozinha até a próxima fronteira arquitetural.'
      );

    assert.equal(
      result.matched,
      true
    );

    assert.equal(
      control.currentWorkMode(),
      'BOUNDED_AUTONOMY_TO_BOUNDARY'
    );

    assert.match(
      result.output,
      /não amplia minha autoridade/i
    );

    assert.match(
      result.output,
      /expansão de escopo/i
    );
  }
);

test(
  'user can return to supervised microtasks explicitly',
  () => {
    const control =
      createNaturalSessionControl();

    control.handle(
      'modo autonomia'
    );

    control.handle(
      'modo microtarefas'
    );

    assert.equal(
      control.currentWorkMode(),
      'SUPERVISED_MICROTASKS'
    );
  }
);

test(
  'provider replacement starts guided setup without selecting paid service',
  () => {
    const control =
      createNaturalSessionControl();

    const result =
      control.handle(
        'Quero trocar de IA.'
      );

    assert.equal(
      result.matched,
      true
    );

    assert.match(
      result.output,
      /passo a passo/i
    );

    assert.match(
      result.output,
      /fonte oficial/i
    );

    assert.match(
      result.output,
      /não recebe, intermedeia ou retém/i
    );
  }
);

test(
  'qualified local model commands produce selection data without operational authority',
  () => {
    const session =
      createNaturalSessionControl({
        workspace: 'example'
      });

    const qwen =
      session.handle(
        'usar qwen3:8b'
      );
    const gemma =
      session.handle(
        'usar gemma'
      );

    assert.deepEqual(qwen, {
      matched: true,
      action:
        'LOCAL_MODEL_SELECTION',
      model:
        'qwen3:8b'
    });

    assert.deepEqual(gemma, {
      matched: true,
      action:
        'LOCAL_MODEL_SELECTION',
      model:
        'gemma3:4b'
    });

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        qwen,
        'authority'
      ),
      false
    );
  }
);

test(
  'OpenAI request enters qualified guided setup without automatic activation',
  () => {
    const control =
      createNaturalSessionControl();

    const result =
      control.handle(
        'Quero usar o Codex.'
      );

    assert.equal(
      result.matched,
      true
    );

    assert.equal(result.action, 'FRONTIER_PROVIDER_SETUP');
    assert.equal(result.providerId, 'openai:gpt-5.6');
    assert.match(result.output, /CONFIGURATION_REQUIRED/);

    assert.match(
      result.output,
      /nunca é ativado automaticamente/i
    );

    assert.match(
      result.output,
      /preços não são hardcoded/i
    );

    assert.match(
      result.output,
      /FRONTEIRA ATUAL/
    );
  }
);

test(
  'verified local provider reports zero operational authority',
  () => {
    const discovery =
      Object.freeze({
        available: true,
        active: true,
        state: 'ACTIVE',
        provider: 'Ollama',
        model: 'qwen3:8b',
        providerKind: 'OLLAMA',
        cognitionLocation: 'LOCAL_MODEL',
        transportLocation: 'LOCAL_PROCESS',
        billing: 'LOCAL_RESOURCES_AND_LICENSES_APPLY',
        networkRequirement: 'LOOPBACK_SERVICE_ONLY',
        operationalAuthority: false
      });
    const output =
      formatProviderStatus(
        discovery
      );
    const english = formatProviderStatus(discovery, 'en');

    assert.match(
      output,
      /qwen3/i
    );

    assert.match(
      output,
      /Autoridade operacional da IA: nenhuma/i
    );

    assert.match(
      output,
      /Aceleração: automática pelo Ollama/i
    );

    assert.match(
      output,
      /contexto 4096.*10 minutos/i
    );

    assert.match(
      output,
      /não recebe, intermedeia ou retém/i
    );
    assert.match(english, /Cognition: local model/i);
    assert.match(english, /context 4096.*10 minutes/i);
  }
);

test('Codex status distinguishes local subprocess from external cognition in PT-BR and EN', () => {
  const discovery = Object.freeze({
    provider: 'OpenAI Codex SDK',
    model: 'configured-default',
    providerKind: 'CODEX',
    cognitionLocation: 'EXTERNAL_SERVICE',
    transportLocation: 'LOCAL_PROCESS',
    billing: 'UNKNOWN_OR_ACCOUNT_PLAN',
    networkRequirement: 'EXTERNAL_SERVICE_REQUIRED',
    networkCompatibility: 'BLOCKED_BY_CONTAINMENT_NETWORK',
    available: false,
    active: false,
    state: 'BLOCKED',
    reason: 'External cognitive service network is denied.',
    operationalAuthority: false
  });
  const portuguese = formatProviderStatus(discovery, 'pt-BR');
  const english = formatProviderStatus(discovery, 'en');

  for (const output of [portuguese, english]) {
    assert.doesNotMatch(output, /Ollama/i);
    assert.doesNotMatch(output, /provider cognitivo local/i);
    assert.doesNotMatch(output, /4096|10 minutos|10 minutes/i);
    assert.doesNotMatch(output, /sem cobrança|no charge|free/i);
    assert.match(output, /extern|external/i);
    assert.match(output, /subprocess/i);
    assert.match(output, /conta\/plano|account\/plan/i);
    assert.match(output, /mediad|sanitiz/i);
    assert.match(output, /rede|network/i);
  }
  assert.match(portuguese, /isso não torna a cognição local/i);
  assert.match(english, /does not make cognition local/i);
  assert.match(portuguese, /Autoridade operacional da IA: nenhuma/i);
  assert.match(english, /Operational authority of the AI: none/i);
});

test('provider status fails closed when mandatory location metadata is absent', () => {
  assert.throws(
    () => formatProviderStatus(Object.freeze({
      provider: 'OpenAI Codex SDK',
      model: 'configured-default',
      available: true,
      active: true,
      state: 'ACTIVE'
    })),
    /location metadata/i
  );
});

test(
  'session control exports no execution or filesystem authority',
  () => {
    const boundary =
      require(
        '../../accelerator/cli/natural-session-control'
      );

    for (const forbidden of [
      'exec',
      'execute',
      'spawn',
      'shell',
      'patch',
      'write',
      'readFile',
      'authorize',
      'approve',
      'grant',
      'credential'
    ]) {
      assert.equal(
        Object.prototype
          .hasOwnProperty.call(
            boundary,
            forbidden
          ),
        false
      );
    }
  }
);

test(
  'NATURAL help requests governed presentation without owning capability truth',
  () => {
    const control =
      createNaturalSessionControl();

    const result =
      control.handle(
        'ajuda'
      );

    assert.equal(
      result.matched,
      true
    );

    assert.equal(result.action, 'HELP_REQUEST');
    assert.equal(result.topic, 'GENERAL');
    assert.equal(result.observational, true);
    assert.equal(result.operationalAuthority, false);
    assert.equal(result.mutationAuthority, false);
    assert.equal(result.approvalAuthority, false);
    assert.equal(result.output, undefined);
  }
);

test(
  'NATURAL progressive disclosure exposes technical status only on explicit request',
  () => {
    const control =
      createNaturalSessionControl();

    const result =
      control.handle(
        'detalhes técnicos'
      );

    assert.equal(
      result.matched,
      true
    );

    assert.equal(
      result.action,
      'TECHNICAL_STATUS'
    );
  }
);

test(
  'workspace request creates pending authorization and affirmative response authorizes exact task',
  () => {
    const control =
      createNaturalSessionControl({
        workspace:
          'example-project'
      });

    const proposal =
      control.handle(
        'liste os arquivos deste diretório'
      );

    assert.equal(
      proposal.matched,
      true
    );

    assert.match(
      proposal.output,
      /Posso prosseguir/i
    );

    assert.equal(
      control.hasPendingAuthorization(),
      true
    );

    const approval =
      control.handle(
        'eu autorizo'
      );

    assert.equal(
      approval.action,
      'AUTHORIZED_GOVERNED_TASK'
    );

    assert.equal(
      approval.task.kind,
      'WORKSPACE_LIST'
    );

    assert.equal(
      control.hasPendingAuthorization(),
      false
    );
  }
);

test(
  'broad project analysis requires explicit human authorization',
  () => {
    const control =
      createNaturalSessionControl({
        workspace:
          'example-project'
      });

    const proposal =
      control.handle(
        'Explique este projeto para mim.'
      );

    assert.equal(
      proposal.matched,
      true
    );

    assert.match(
      proposal.output,
      /evidências do workspace/i
    );

    assert.equal(
      control.hasPendingAuthorization(),
      true
    );

    const approval =
      control.handle('sim');

    assert.equal(
      approval.action,
      'AUTHORIZED_GOVERNED_TASK'
    );

    assert.equal(
      approval.task.kind,
      'PROJECT_ANALYSIS'
    );
  }
);

test(
  'identical task uses explicit authorized reuse without affirmative parsing or a new human decision',
  () => {
    const task = detectNaturalGovernedTask(
      'Explique este projeto para mim.'
    );
    const control = createNaturalSessionControl({
      workspace: 'example-project',
      workspaceRoot: '/tmp/example-project'
    });

    control.handle('Explique este projeto para mim.');
    const provenance = authorizedReuse(task);
    const reused = control.reuseAuthorizedGovernedTask(provenance);

    assert.equal(reused.action, 'REUSE_AUTHORIZED_GOVERNED_TASK');
    assert.doesNotMatch(
      control.reuseAuthorizedGovernedTask.toString(),
      /isAffirmative/
    );
    assert.equal(reused.authorizationFingerprint, provenance.authorizationFingerprint);
    assert.equal(reused.sessionFingerprint, provenance.sessionFingerprint);
    assert.equal(reused.taskFingerprint, provenance.taskFingerprint);
    assert.equal(reused.envelopeFingerprint, provenance.envelopeFingerprint);
    assert.equal(reused.validFrom, provenance.validFrom);
    assert.equal(reused.authorizedAt, provenance.authorizedAt);
    assert.equal(reused.expiresAt, provenance.expiresAt);
    assert.equal(reused.humanDecision, null);
    assert.equal(reused.authorizationEvent, null);
    assert.equal(reused.authorityExpanded, false);
    assert.equal(control.hasPendingAuthorization(), false);
  }
);

test(
  'objective scope risk session environment and expiry divergence block authorized reuse',
  () => {
    const task = detectNaturalGovernedTask(
      'Explique este projeto para mim.'
    );
    const valid = authorizedReuse(task);
    const divergences = [
      { objective: 'Outro objetivo.' },
      { scopeFingerprint: 'f'.repeat(64) },
      { risk: 'R2' },
      { sessionFingerprint: '1'.repeat(64) },
      { environmentFingerprint: '2'.repeat(64) },
      {
        reusedAt: valid.expiresAt,
        reuseFingerprint: null
      }
    ];

    for (const divergence of divergences) {
      const control = createNaturalSessionControl({
        workspace: 'example-project',
        workspaceRoot: '/tmp/example-project'
      });
      control.handle('Explique este projeto para mim.');
      const candidate = divergence.reuseFingerprint === null
        ? authorizedReuse(task, {
            reusedAt: divergence.reusedAt
          })
        : Object.freeze({
            ...valid,
            ...divergence
          });

      assert.throws(
        () => control.reuseAuthorizedGovernedTask(candidate),
        /reuse|divergent/i
      );
      assert.equal(
        control.hasPendingAuthorization(),
        true,
        'a divergent reuse leaves the real human decision pending'
      );
    }
  }
);

test(
  'real typed confirmation still uses the affirmative parser and no artificial sim call remains',
  () => {
    const observedInputs = [];
    const control = createNaturalSessionControl({
      workspace: 'example-project'
    });
    const originalHandle = control.handle;
    const handle = (input) => {
      observedInputs.push(input);
      return originalHandle(input);
    };
    handle('Explique este projeto para mim.');
    const approval = handle('sim');

    assert.equal(approval.action, 'AUTHORIZED_GOVERNED_TASK');
    assert.equal(observedInputs.at(-1), 'sim');
    const source = fs.readFileSync(
      require.resolve('../../accelerator/cli/surgical'),
      'utf8'
    );
    assert.doesNotMatch(
      source,
      /sessionControl\.handle\(\s*['"]sim['"]\s*\)/
    );
  }
);

test(
  'confirmation without pending governed task is handled deterministically',
  () => {
    const control =
      createNaturalSessionControl({
        workspace:
          'example-project'
      });

    const result =
      control.handle(
        'eu autorizo'
      );

    assert.equal(result.matched, true);
    assert.equal(result.action, 'CONTINUE');
    assert.equal(result.output, 'Não há autorização pendente.\n');
    assert.equal(control.hasPendingAuthorization(), false);
  }
);

test(
  'pending task captures unrelated input instead of leaking ambiguous authorization to cognitive provider',
  () => {
    const control =
      createNaturalSessionControl({
        workspace:
          'example-project'
      });

    control.handle(
      'leia o arquivo package.json'
    );

    const result =
      control.handle(
        'talvez'
      );

    assert.equal(
      result.matched,
      true
    );

    assert.match(
      result.output,
      /aguardando sua decisão/i
    );
  }
);

test(
  'negative response cancels pending task without authority',
  () => {
    const control =
      createNaturalSessionControl({
        workspace:
          'example-project'
      });

    control.handle(
      'liste os arquivos deste diretório'
    );

    const result =
      control.handle(
        'não'
      );

    assert.match(
      result.output,
      /cancelada/i
    );

    assert.equal(
      control.hasPendingAuthorization(),
      false
    );
  }
);

test(
  'exit and quit always cross to the session boundary even while authorization is pending',
  () => {
    for (const command of ['exit', 'quit']) {
      const control =
        createNaturalSessionControl({
          workspace: 'example-project'
        });

      control.handle(
        'Explique este projeto para mim.'
      );

      const result =
        control.handle(command);

      assert.equal(result.matched, false);
      assert.equal(
        control.hasPendingAuthorization(),
        true
      );
    }
  }
);


test('RUNNER maps to autonomous-until-green without authority expansion', () => {
  const control = createNaturalSessionControl();
  const start = control.handle('runner');
  assert.equal(start.action, 'RUNNER_START');
  assert.equal(start.intent, 'AUTONOMOUS_UNTIL_GREEN');
  assert.equal(start.authorityExpansion, false);
  assert.equal(start.publicationAuthority, false);
  assert.equal(control.currentWorkMode(), 'BOUNDED_AUTONOMY_TO_BOUNDARY');
});

test('RUNNER STATUS is read-only and reports bounded authority', () => {
  const control = createNaturalSessionControl();
  control.handle('runner');
  const status = control.handle('runner status');
  assert.equal(status.action, 'RUNNER_STATUS');
  assert.equal(status.readOnly, true);
  assert.equal(status.intent, 'AUTONOMOUS_UNTIL_GREEN');
  assert.equal(status.authorityExpansion, false);
  assert.equal(status.publicationAuthority, false);
  assert.match(status.output, /publication denied|publicação negada/i);
});

test('RUNNER STOP revokes continuation without minting authority', () => {
  const control = createNaturalSessionControl();
  control.handle('runner');
  const stop = control.handle('runner stop');
  assert.equal(stop.action, 'RUNNER_STOP');
  assert.equal(stop.safeStopRequested, true);
  assert.equal(stop.authorityExpansion, false);
  assert.equal(stop.publicationAuthority, false);
  assert.equal(control.currentWorkMode(), 'SUPERVISED_MICROTASKS');
});
