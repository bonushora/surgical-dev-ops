'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const path =
  require('node:path');

const {
  WORK_MODES,
  createNaturalAssistanceContext,
  formatNaturalProviderInstruction
} = require(
  '../../accelerator/cli/natural-assistance-context'
);

function activation() {
  return Object.freeze({
    repositoryPath:
      path.resolve(
        '/tmp',
        'example-project'
      ),

    workspace:
      'example-project',

    interactionMode:
      Object.freeze({
        mode:
          'NATURAL'
      }),

    protocols:
      Object.freeze({
        bhSep:
          '2.2',

        bhSdp:
          '2.2'
      })
  });
}

test(
  'governed assistance context binds exactly one explicit workspace root',
  () => {
    const context =
      createNaturalAssistanceContext(
        activation()
      );

    assert.deepEqual(
      context.workspace.allowedRoots,
      [
        path.resolve(
          '/tmp',
          'example-project'
        )
      ]
    );

    assert.equal(
      context.workspace
        .implicitParentAccess,
      false
    );

    assert.equal(
      context.workspace
        .implicitSiblingAccess,
      false
    );

    assert.equal(
      context.workspace
        .implicitHomeAccess,
      false
    );

    assert.equal(
      context.workspace
        .commonAncestorExpansion,
      false
    );

    assert.equal(
      context.workspace
        .explicitExpansionRequired,
      true
    );
  }
);

test(
  'assistance context is provider-independent and deeply immutable',
  () => {
    const context =
      createNaturalAssistanceContext(
        activation()
      );

    assert.equal(
      context.providerIndependent,
      true
    );

    assert.equal(
      context.providerRules
        .providerChangeMayChangeGovernance,
      false
    );

    assert.equal(
      context.providerRules
        .credentialCreatesOperationalAuthority,
      false
    );

    assert.ok(
      Object.isFrozen(context)
    );

    assert.ok(
      Object.isFrozen(
        context.workspace
      )
    );
  }
);

test(
  'bounded autonomy is explicitly continuity without authority expansion',
  () => {
    const context =
      createNaturalAssistanceContext(
        activation()
      );

    assert.equal(
      context.assistance
        .autonomyExpandsAuthority,
      false
    );

    assert.equal(
      context.assistance
        .autonomyExpandsWorkspace,
      false
    );

    assert.equal(
      context.assistance
        .autonomyGrantsR3,
      false
    );
  }
);

test(
  'provider instruction carries canonical Surgical method and selected work mode',
  () => {
    const context =
      createNaturalAssistanceContext(
        activation()
      );

    const instruction =
      formatNaturalProviderInstruction(
        context,
        WORK_MODES.AUTONOMY
      );

    assert.match(
      instruction,
      /BOUNDED_AUTONOMY_TO_BOUNDARY/
    );

    assert.match(
      instruction,
      /workspace explicitamente autorizado/i
    );

    assert.match(
      instruction,
      /Orchestrator é a autoridade operacional/i
    );

    assert.match(
      instruction,
      /pare diante de decisão arquitetural/i
    );
  }
);
