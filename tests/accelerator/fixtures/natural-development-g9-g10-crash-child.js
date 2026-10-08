'use strict';

const fs = require('node:fs');

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const inputPath = process.argv[2];
const mode = process.argv[3];
const evidencePath = process.argv[4];

const input = deepFreeze(
  JSON.parse(fs.readFileSync(inputPath, 'utf8'))
);
let r3PreparationCount = null;
let dispatchCount = null;

function installRuntimeCounters({ captureClaim = false } = {}) {
  const dispatchPath = require.resolve(
    '../../../accelerator/cli/governed-patch-dispatch'
  );
  const dispatch = require(dispatchPath);
  r3PreparationCount = 0;

  require.cache[dispatchPath].exports = Object.freeze({
    ...dispatch,
    createGovernedPatchRequest(values) {
      r3PreparationCount += 1;
      return dispatch.createGovernedPatchRequest(values);
    }
  });

  const orchestratorPath = require.resolve(
    '../../../accelerator/core/surgical-orchestrator'
  );
  const orchestrator = require(orchestratorPath);
  dispatchCount = 0;

  require.cache[orchestratorPath].exports = Object.freeze({
    ...orchestrator,
    orchestrate(...values) {
      dispatchCount += 1;

      if (captureClaim) {
        const stateRoot = require('node:path').join(
          input.journalStorageRoot,
          '.natural-development-authorization-consumption'
        );
        const record =
          `${input.patchAuthorization.authorizationFingerprint}.json`;
        fs.copyFileSync(
          require('node:path').join(
            stateRoot,
            record
          ),
          `${evidencePath}.claim`
        );
        fs.cpSync(
          stateRoot,
          `${evidencePath}.store-snapshot`,
          { recursive: true }
        );
      }

      return orchestrator.orchestrate(...values);
    }
  });
}

if (mode === 'CRASH_AFTER_CAS_BEFORE_G10') {
  const adapterPath = require.resolve(
    '../../../accelerator/adapters/natural-development-linearizable-consumption'
  );
  const adapter = require(adapterPath);

  require.cache[adapterPath].exports = Object.freeze({
    ...adapter,
    commitLinearizableNaturalDevelopmentAuthorizationConsumption(values) {
      fs.writeFileSync(
        evidencePath,
        JSON.stringify({
          schema: 'sdo.test_only_g9_g10_interruption.v1',
          interruption: 'AFTER_SUCCESSFUL_CAS_BEFORE_G10',
          childProcessId: process.pid,
          transactionId: values.transactionId,
          journalId: values.journalId,
          effectFingerprint: values.effectFingerprint,
          manifestAfterOid: values.manifestAfterOid
        }) + '\n'
      );
      process.exit(86);
    }
  });
} else if (mode === 'RESTART_REPLAY_PROBE') {
  installRuntimeCounters();
} else if (mode === 'COMPLETE_PROBE') {
  installRuntimeCounters({ captureClaim: true });
} else {
  throw new Error('Unknown G9/G10 adversarial child mode.');
}

const {
  composeAndDispatchNaturalDevelopmentPatch
} = require(
  '../../../accelerator/cli/natural-development-r3-composition'
);

try {
  composeAndDispatchNaturalDevelopmentPatch(input);
  if (
    mode === 'RESTART_REPLAY_PROBE' ||
    mode === 'COMPLETE_PROBE'
  ) {
    fs.writeFileSync(
      evidencePath,
      JSON.stringify({
        schema: 'sdo.test_only_g9_restart_replay_probe.v1',
        r3PreparationCount,
        dispatchCount,
        completed: true,
        error: null
      }) + '\n'
    );
  }
  process.exitCode = 0;
} catch (error) {
  if (
    mode === 'RESTART_REPLAY_PROBE' ||
    mode === 'COMPLETE_PROBE'
  ) {
    fs.writeFileSync(
      evidencePath,
      JSON.stringify({
        schema: 'sdo.test_only_g9_restart_replay_probe.v1',
        r3PreparationCount,
        dispatchCount,
        completed: false,
        error: error.message
      }) + '\n'
    );
    process.exitCode = 0;
  } else {
    throw error;
  }
}
