'use strict';

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const path =
  require('node:path');

const {
  telemetryStateRoot
} = require(
  '../../accelerator/telemetry/installation-identity'
);

test(
  'Linux telemetry uses XDG-compatible persistent state',
  () => {
    const resolved =
      telemetryStateRoot({
        platform:
          'linux',

        environment:
          {},

        home:
          '/home/tester'
      });

    assert.equal(
      resolved,
      path.join(
        '/home/tester',
        '.local',
        'state',
        'surgical-devops',
        'telemetry'
      )
    );
  }
);

test(
  'Linux telemetry honors explicit XDG_STATE_HOME',
  () => {
    const resolved =
      telemetryStateRoot({
        platform:
          'linux',

        environment: {
          XDG_STATE_HOME:
            '/qualified-state'
        },

        home:
          '/home/tester'
      });

    assert.equal(
      resolved,
      path.join(
        '/qualified-state',
        'surgical-devops',
        'telemetry'
      )
    );
  }
);

test(
  'macOS telemetry uses Application Support persistent state',
  () => {
    const resolved =
      telemetryStateRoot({
        platform:
          'darwin',

        environment:
          {},

        home:
          '/Users/tester'
      });

    assert.equal(
      resolved,
      path.join(
        '/Users/tester',
        'Library',
        'Application Support',
        'SurgicalDevOps',
        'telemetry'
      )
    );
  }
);

test(
  'Windows telemetry uses LOCALAPPDATA persistent state',
  () => {
    const base =
      'C:\\Users\\tester\\AppData\\Local';

    const resolved =
      telemetryStateRoot({
        platform:
          'win32',

        environment: {
          LOCALAPPDATA:
            base
        },

        home:
          'C:\\Users\\tester'
      });

    /*
     * This is a cross-platform semantic contract.
     * Native Win32 path semantics will be qualified
     * separately on windows-latest.
     */
    assert.equal(
      resolved,
      path.join(
        base,
        'SurgicalDevOps',
        'telemetry'
      )
    );
  }
);

test(
  'Windows telemetry fails closed when LOCALAPPDATA is unavailable',
  () => {
    assert.throws(
      () =>
        telemetryStateRoot({
          platform:
            'win32',

          environment:
            {},

          home:
            'C:\\Users\\tester'
        }),
      /LOCALAPPDATA/
    );
  }
);

test(
  'explicit telemetry state root overrides platform defaults',
  () => {
    const configured =
      path.resolve(
        'qualified-telemetry-state'
      );

    for (
      const platform
      of [
        'linux',
        'darwin',
        'win32'
      ]
    ) {
      const resolved =
        telemetryStateRoot({
          platform,

          environment: {
            SDO_TELEMETRY_STATE_ROOT:
              configured
          },

          home:
            '/ignored'
        });

      assert.equal(
        resolved,
        configured
      );
    }
  }
);
