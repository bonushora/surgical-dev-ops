'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const {
  parseNaturalEvidenceDecision,
  evidenceRequestToIntent
} = require(
  '../../accelerator/cli/natural-evidence-request'
);

function completed(output) {
  return {
    schema:
      'sdo.ai_cognitive_result.v1',

    status:
      'COMPLETED',

    output
  };
}

test(
  'cognitive provider may request one bounded workspace inventory as data only',
  () => {
    const result =
      parseNaturalEvidenceDecision(
        completed({
          decision:
            'REQUEST_EVIDENCE',

          response:
            null,

          evidenceRequest: {
            kind:
              'WORKSPACE_FILES',

            target:
              null,

            reason:
              'Preciso conhecer a estrutura do projeto.'
          }
        })
      );

    assert.equal(
      result.decision,
      'REQUEST_EVIDENCE'
    );

    assert.deepEqual(
      evidenceRequestToIntent(
        result.evidenceRequest
      ),
      {
        capabilityType:
          'GIT_READ',

        target:
          'workspace-files'
      }
    );

    assert.equal(
      Object.isFrozen(result),
      true
    );
  }
);

test(
  'cognitive provider may request one bounded file read without authority',
  () => {
    const result =
      parseNaturalEvidenceDecision(
        completed({
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
              'Preciso identificar scripts e metadados.'
          }
        })
      );

    assert.deepEqual(
      evidenceRequestToIntent(
        result.evidenceRequest
      ),
      {
        capabilityType:
          'FILESYSTEM_READ',

        target:
          'package.json'
      }
    );
  }
);

test(
  'cognitive provider may request only fixed JavaScript validation',
  () => {
    const result =
      parseNaturalEvidenceDecision(
        completed({
          decision:
            'REQUEST_EVIDENCE',

          response:
            null,

          evidenceRequest: {
            kind:
              'VALIDATE_JS',

            target:
              'accelerator/cli/surgical.js',

            reason:
              'Preciso verificar a sintaxe do arquivo.'
          }
        })
      );

    assert.deepEqual(
      evidenceRequestToIntent(
        result.evidenceRequest
      ),
      {
        capabilityType:
          'PROCESS_VALIDATION',

        target:
          'accelerator/cli/surgical.js'
      }
    );
  }
);

test(
  'provider can return final cognitive response without requesting evidence',
  () => {
    const result =
      parseNaturalEvidenceDecision(
        completed({
          decision:
            'RESPOND',

          response:
            'Já tenho evidência suficiente para responder.',

          evidenceRequest:
            null
        })
      );

    assert.equal(
      result.decision,
      'RESPOND'
    );

    assert.match(
      result.response,
      /evidência suficiente/
    );

    assert.equal(
      result.evidenceRequest,
      null
    );
  }
);

test(
  'arbitrary commands and authority-bearing shapes never become evidence requests',
  () => {
    for (const output of [
      {
        decision:
          'REQUEST_EVIDENCE',
        response:
          null,
        evidenceRequest: {
          kind:
            'SHELL',
          target:
            'rm -rf .',
          reason:
            'Execute.'
        }
      },
      {
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
            'Read.',
          command:
            'cat package.json'
        }
      },
      {
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
            'Read.'
        },
        authorization:
          true
      }
    ]) {
      assert.throws(
        () =>
          parseNaturalEvidenceDecision(
            completed(output)
          )
      );
    }
  }
);

test(
  'decision contract rejects ambiguous response and request combinations',
  () => {
    assert.throws(
      () =>
        parseNaturalEvidenceDecision(
          completed({
            decision:
              'REQUEST_EVIDENCE',

            response:
              'Também execute isto.',

            evidenceRequest: {
              kind:
                'READ_FILE',

              target:
                'package.json',

              reason:
                'Read.'
            }
          })
        )
    );

    assert.throws(
      () =>
        parseNaturalEvidenceDecision(
          completed({
            decision:
              'RESPOND',

            response:
              'Done.',

            evidenceRequest: {
              kind:
                'WORKSPACE_FILES',

              target:
                null,

              reason:
                'Unused.'
            }
          })
        )
    );
  }
);

test(
  'evidence request contract itself exposes no execution surface',
  () => {
    const surface =
      require(
        '../../accelerator/cli/natural-evidence-request'
      );

    assert.deepEqual(
      Object.keys(surface).sort(),
      [
        'DECISIONS',
        'REQUEST_KINDS',
        'evidenceRequestToIntent',
        'parseNaturalEvidenceDecision'
      ].sort()
    );

    assert.equal(
      'exec' in surface,
      false
    );

    assert.equal(
      'dispatch' in surface,
      false
    );

    assert.equal(
      'write' in surface,
      false
    );

    assert.equal(
      'shell' in surface,
      false
    );
  }
);
