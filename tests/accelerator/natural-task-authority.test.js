'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const path =
  require('node:path');

const {
  parseNaturalEvidenceDecision
} = require(
  '../../accelerator/cli/natural-evidence-request'
);

const {
  TASK_PROFILES,
  createNaturalTaskAuthorityEnvelope,
  evaluateNaturalEvidenceRequest
} = require(
  '../../accelerator/cli/natural-task-authority'
);

const WORKSPACE =
  path.resolve(
    '/tmp/surgical-natural-authority-project'
  );

function deepFreeze(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (
    const child
    of Object.values(value)
  ) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function task(
  kind,
  overrides = {}
) {
  return deepFreeze({
    schema:
      'sdo.natural_governed_task.v1',

    kind,

    objective:
      'Analyze the human-authorized task.',

    mutating:
      false,

    operations:
      [],

    ...overrides
  });
}

function evidence(
  kind,
  target = null
) {
  const result =
    parseNaturalEvidenceDecision({
      schema:
        'sdo.ai_cognitive_result.v1',

      status:
        'COMPLETED',

      output: {
        decision:
          'REQUEST_EVIDENCE',

        response:
          null,

        evidenceRequest: {
          kind,
          target,

          reason:
            'Evidence is required for the authorized objective.'
        }
      }
    });

  return result.evidenceRequest;
}

test(
  'task authority envelope carries containment bounds but zero operational authority',
  () => {
    const envelope =
      createNaturalTaskAuthorityEnvelope({
        task:
          task(
            'PROJECT_ANALYSIS'
          ),

        workspaceRoot:
          WORKSPACE
      });

    assert.equal(
      envelope.schema,
      'sdo.natural_task_authority_envelope.v1'
    );

    assert.equal(
      envelope.operationalAuthority,
      false
    );

    assert.equal(
      envelope.grantAuthority,
      false
    );

    assert.equal(
      envelope.mutationAuthority,
      false
    );

    assert.equal(
      envelope.authority
        .maxEvidenceSteps,
      8
    );

    assert.deepEqual(
      envelope.authority
        .evidenceKinds,
      [
        'WORKSPACE_FILES',
        'READ_FILE',
        'VALIDATE_JS'
      ]
    );

    assert.equal(
      Object.isFrozen(
        envelope
      ),
      true
    );

    assert.match(
      envelope.bindingFingerprint,
      /^[0-9a-f]{64}$/
    );
  }
);

test(
  'project-analysis envelope admits bounded workspace inventory',
  () => {
    const envelope =
      createNaturalTaskAuthorityEnvelope({
        task:
          task(
            'PROJECT_ANALYSIS'
          ),

        workspaceRoot:
          WORKSPACE
      });

    const evaluation =
      evaluateNaturalEvidenceRequest(
        envelope,
        evidence(
          'WORKSPACE_FILES'
        )
      );

    assert.equal(
      evaluation.decision,
      'CONTAINED'
    );

    assert.deepEqual(
      evaluation.governedIntent,
      {
        capabilityType:
          'GIT_READ',

        target:
          'workspace-files'
      }
    );

    assert.equal(
      evaluation.operationalAuthority,
      false
    );
  }
);

test(
  'project-analysis envelope admits canonical descendant read without minting authority',
  () => {
    const envelope =
      createNaturalTaskAuthorityEnvelope({
        task:
          task(
            'PROJECT_ANALYSIS'
          ),

        workspaceRoot:
          WORKSPACE
      });

    const evaluation =
      evaluateNaturalEvidenceRequest(
        envelope,
        evidence(
          'READ_FILE',
          'accelerator/cli/surgical.js'
        ),
        {
          evidenceStep:
            1
        }
      );

    assert.equal(
      evaluation.decision,
      'CONTAINED'
    );

    assert.deepEqual(
      evaluation.governedIntent,
      {
        capabilityType:
          'FILESYSTEM_READ',

        target:
          'accelerator/cli/surgical.js'
      }
    );
  }
);

test(
  'project-analysis envelope admits only fixed JavaScript validation',
  () => {
    const envelope =
      createNaturalTaskAuthorityEnvelope({
        task:
          task(
            'PROJECT_ANALYSIS'
          ),

        workspaceRoot:
          WORKSPACE
      });

    const allowed =
      evaluateNaturalEvidenceRequest(
        envelope,
        evidence(
          'VALIDATE_JS',
          'accelerator/cli/surgical.js'
        )
      );

    assert.equal(
      allowed.decision,
      'CONTAINED'
    );

    assert.deepEqual(
      allowed.governedIntent,
      {
        capabilityType:
          'PROCESS_VALIDATION',

        target:
          'accelerator/cli/surgical.js'
      }
    );

    const denied =
      evaluateNaturalEvidenceRequest(
        envelope,
        evidence(
          'VALIDATE_JS',
          'package.json'
        )
      );

    assert.equal(
      denied.decision,
      'REQUIRES_HUMAN_AUTHORITY'
    );

    assert.equal(
      denied.governedIntent,
      null
    );
  }
);

test(
  'exact file task cannot be broadened to another file',
  () => {
    const envelope =
      createNaturalTaskAuthorityEnvelope({
        task:
          task(
            'READ_AND_EXPLAIN_FILE',
            {
              target:
                'package.json'
            }
          ),

        workspaceRoot:
          WORKSPACE
      });

    const same =
      evaluateNaturalEvidenceRequest(
        envelope,
        evidence(
          'READ_FILE',
          'package.json'
        )
      );

    assert.equal(
      same.decision,
      'CONTAINED'
    );

    const other =
      evaluateNaturalEvidenceRequest(
        envelope,
        evidence(
          'READ_FILE',
          'README.md'
        )
      );

    assert.equal(
      other.decision,
      'REQUIRES_HUMAN_AUTHORITY'
    );

    assert.equal(
      other.governedIntent,
      null
    );
  }
);

test(
  'workspace-list task cannot silently acquire file-read authority',
  () => {
    const envelope =
      createNaturalTaskAuthorityEnvelope({
        task:
          task(
            'WORKSPACE_LIST'
          ),

        workspaceRoot:
          WORKSPACE
      });

    const evaluation =
      evaluateNaturalEvidenceRequest(
        envelope,
        evidence(
          'READ_FILE',
          'package.json'
        )
      );

    assert.equal(
      evaluation.decision,
      'REQUIRES_HUMAN_AUTHORITY'
    );

    assert.equal(
      evaluation.governedIntent,
      null
    );
  }
);

test(
  'absolute traversal and noncanonical cognitive targets require new human authority',
  () => {
    const envelope =
      createNaturalTaskAuthorityEnvelope({
        task:
          task(
            'PROJECT_ANALYSIS'
          ),

        workspaceRoot:
          WORKSPACE
      });

    for (const target of [
      '../outside.txt',
      'a/../outside.txt',
      '/etc/passwd',
      'C:\\Windows\\System32\\config',
      './package.json',
      'accelerator//cli/surgical.js'
    ]) {
      const evaluation =
        evaluateNaturalEvidenceRequest(
          envelope,
          evidence(
            'READ_FILE',
            target
          )
        );

      assert.equal(
        evaluation.decision,
        'REQUIRES_HUMAN_AUTHORITY',
        target
      );

      assert.equal(
        evaluation.governedIntent,
        null,
        target
      );
    }
  }
);

test(
  'evidence-step bound stops recursive continuation without dispatch authority',
  () => {
    const envelope =
      createNaturalTaskAuthorityEnvelope({
        task:
          task(
            'PROJECT_ANALYSIS'
          ),

        workspaceRoot:
          WORKSPACE
      });

    const evaluation =
      evaluateNaturalEvidenceRequest(
        envelope,
        evidence(
          'READ_FILE',
          'package.json'
        ),
        {
          evidenceStep:
            8
        }
      );

    assert.equal(
      evaluation.decision,
      'REQUIRES_HUMAN_AUTHORITY'
    );

    assert.match(
      evaluation.reason,
      /bound/i
    );

    assert.equal(
      evaluation.governedIntent,
      null
    );
  }
);

test(
  'envelope fingerprint deterministically binds task and workspace',
  () => {
    const authorizedTask =
      task(
        'READ_FILE',
        {
          target:
            'package.json'
        }
      );

    const first =
      createNaturalTaskAuthorityEnvelope({
        task:
          authorizedTask,

        workspaceRoot:
          WORKSPACE
      });

    const second =
      createNaturalTaskAuthorityEnvelope({
        task:
          authorizedTask,

        workspaceRoot:
          WORKSPACE
      });

    assert.equal(
      first.bindingFingerprint,
      second.bindingFingerprint
    );

    const otherWorkspace =
      createNaturalTaskAuthorityEnvelope({
        task:
          authorizedTask,

        workspaceRoot:
          path.resolve(
            '/tmp/other-project'
          )
      });

    assert.notEqual(
      first.bindingFingerprint,
      otherWorkspace.bindingFingerprint
    );
  }
);

test(
  'mutating or unknown task cannot become a recursive evidence envelope',
  () => {
    assert.throws(
      () =>
        createNaturalTaskAuthorityEnvelope({
          task:
            task(
              'PROJECT_ANALYSIS',
              {
                mutating:
                  true
              }
            ),

          workspaceRoot:
            WORKSPACE
        })
    );

    assert.throws(
      () =>
        createNaturalTaskAuthorityEnvelope({
          task:
            task(
              'UNQUALIFIED_TASK'
            ),

          workspaceRoot:
            WORKSPACE
        })
    );
  }
);

test(
  'task authority module exposes no dispatch grant filesystem process shell or mutation surface',
  () => {
    const surface =
      require(
        '../../accelerator/cli/natural-task-authority'
      );

    assert.deepEqual(
      Object.keys(surface)
        .sort(),
      [
        'DECISIONS',
        'TASK_PROFILES',
        'createNaturalTaskAuthorityEnvelope',
        'evaluateNaturalEvidenceRequest'
      ].sort()
    );

    for (const forbidden of [
      'dispatch',
      'exec',
      'spawn',
      'shell',
      'readFile',
      'writeFile',
      'grant',
      'patch',
      'mutate'
    ]) {
      assert.equal(
        forbidden in surface,
        false
      );
    }
  }
);

test(
  'task authority profiles are deeply immutable',
  () => {
    assert.equal(
      Object.isFrozen(
        TASK_PROFILES
      ),
      true
    );

    assert.equal(
      Object.isFrozen(
        TASK_PROFILES
          .PROJECT_ANALYSIS
      ),
      true
    );

    assert.equal(
      Object.isFrozen(
        TASK_PROFILES
          .PROJECT_ANALYSIS
          .evidenceKinds
      ),
      true
    );
  }
);
