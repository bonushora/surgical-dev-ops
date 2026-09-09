'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

if (process.platform !== 'win32') process.exit(2);

const helper = path.resolve(__dirname, 'windows-appcontainer-environment-diagnostic.exe');
const result = childProcess.spawnSync(
  helper,
  ['--node-startup-diagnostic', process.execPath],
  {
    cwd: __dirname,
    shell: false,
    windowsHide: true,
    env: {},
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 64 * 1024
  }
);

try {
  const lines = typeof result.stdout === 'string'
    ? result.stdout.trim().split(/\r?\n/).filter(Boolean)
    : [];
  const evidence = /^step=N1 processCreated=(?:true|false) exitCode=(?:\d+|null) stage=[a-z-]+ stderrClass=(?:NATIVE_ABORT|EMPTY|OTHER|OUTPUT_LIMIT) fatalReason=[A-Za-z0-9_+-]+ subsystem=[A-Z_]+ nativeEventObserved=(?:true|false) exceptionCode=(?:0x[0-9A-F]+|NOT_OBSERVED) exceptionClass=[A-Z_]+ firstChance=(?:true|false|NOT_APPLICABLE) terminationClass=[A-Z_]+ terminationOrigin=[A-Z_]+ exitProcessCode=(?:\d+|NOT_OBSERVED) debugLoopStatus=[A-Z_]+ firstNativeFrame=[A-Za-z0-9_:<>~.+-]+ nativeFrames=[A-Za-z0-9_:<>~.+,-]+ markerPresent=true cleanup=(?:PASS|FAIL)$/;
  const transition = /^state=(?:CONTROL_N1|TEST_USERPROFILE_ONLY|VERIFY_USERPROFILE_CONTROL|TEST_APPDATA_ONLY|VERIFY_APPDATA_CONTROL|SUFFICIENT_EVIDENCE|NO_PROGRESS|BLOCKED|COMPLETE) evidence=[A-Z0-9_]+ nextState=(?:CONTROL_N1|TEST_USERPROFILE_ONLY|VERIFY_USERPROFILE_CONTROL|TEST_APPDATA_ONLY|VERIFY_APPDATA_CONTROL|SUFFICIENT_EVIDENCE|NO_PROGRESS|BLOCKED|COMPLETE) equivalentAttempts=\d+ breakerDecision=[A-Z0-9_]+$/;
  const invalidLine = lines.find((line) => !evidence.test(line) && !transition.test(line));
  if (lines.length === 0 || invalidLine) {
    const stepLines = lines.filter((line) => line.startsWith('step=')).length;
    const stateLines = lines.filter((line) => line.startsWith('state=')).length;
    const transitionStates = new Set([
      'CONTROL_N1', 'TEST_USERPROFILE_ONLY', 'VERIFY_USERPROFILE_CONTROL',
      'TEST_APPDATA_ONLY', 'VERIFY_APPDATA_CONTROL', 'SUFFICIENT_EVIDENCE',
      'NO_PROGRESS', 'BLOCKED', 'COMPLETE'
    ]);
    let invalidLineClass = lines.length === 0 ? 'EMPTY_OUTPUT' : 'UNSANITIZED_LINE';
    let invalidField = 'NOT_APPLICABLE';
    let invalidState = 'NOT_APPLICABLE';
    if (invalidLine?.startsWith('step=')) {
      invalidLineClass = 'EVIDENCE';
      invalidField = 'EVIDENCE_CONTRACT';
    } else if (invalidLine?.startsWith('state=')) {
      invalidLineClass = 'TRANSITION';
      invalidField = 'TRANSITION_CONTRACT';
      const fields = invalidLine.split(' ');
      for (const fieldName of ['state', 'nextState']) {
        const prefix = `${fieldName}=`;
        const field = fields.find((candidate) => candidate.startsWith(prefix));
        const value = field?.slice(prefix.length);
        if (value && !transitionStates.has(value)) {
          invalidField = fieldName;
          invalidState = /^[A-Z0-9_]+$/.test(value) ? value : 'UNSANITIZED';
          break;
        }
      }
    }
    const invalidExitStatus = Number.isInteger(result.status) ? result.status : 'null';
    console.error(
      'WINDOWS_NODE_STARTUP_DIAGNOSTIC_INVALID_OUTPUT' +
      ` invalidLineClass=${invalidLineClass}` +
      ` invalidField=${invalidField}` +
      ` invalidState=${invalidState}` +
      ` invalidExitStatus=${invalidExitStatus}` +
      ` totalLines=${lines.length}` +
      ` stepLines=${stepLines}` +
      ` stateLines=${stateLines}`
    );
    process.exitCode = 2;
  } else {
    for (const line of lines) console.log(line);
    process.exitCode = result.status === 0 ? 0 : result.status === 1 ? 1 : 2;
  }
} finally {
  try {
    fs.unlinkSync(helper);
  } catch {
    console.error('WINDOWS_NODE_STARTUP_DIAGNOSTIC_HELPER_CLEANUP_FAILED');
    process.exitCode = 2;
  }
}
