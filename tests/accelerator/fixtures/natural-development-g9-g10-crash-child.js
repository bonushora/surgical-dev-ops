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
  if (mode === 'RESTART_REPLAY_PROBE') {
    fs.writeFileSync(
      evidencePath,
      JSON.stringify({
        schema: 'sdo.test_only_g9_restart_replay_probe.v1',
        r3PreparationCount,
        error: null
      }) + '\n'
    );
  }
  process.exitCode = 0;
} catch (error) {
  if (mode === 'RESTART_REPLAY_PROBE') {
    fs.writeFileSync(
      evidencePath,
      JSON.stringify({
        schema: 'sdo.test_only_g9_restart_replay_probe.v1',
        r3PreparationCount,
        error: error.message
      }) + '\n'
    );
    process.exitCode = 0;
  } else {
    throw error;
  }
}
