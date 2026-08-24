'use strict';

const fs = require('node:fs');
const net = require('node:net');
const childProcess = require('node:child_process');

function networkProbe() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '1.1.1.1', port: 53 });
    let complete = false;
    const finish = (outcome) => {
      if (complete) return;
      complete = true;
      socket.destroy();
      resolve(outcome);
    };
    socket.setTimeout(1000, () => finish('TIMEOUT'));
    socket.once('connect', () => finish('CONNECTED'));
    socket.once('error', (error) => finish(error.code || 'ERROR'));
  });
}

function deniedRead(target) {
  try {
    fs.readFileSync(target);
    return false;
  } catch (error) {
    return ['EACCES', 'EPERM', 'ENOENT'].includes(error.code);
  }
}

async function main() {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  let writeOutcome = null;
  try {
    fs.writeFileSync(`${input.workspace}/.sdo-seatbelt-probe`, 'forbidden\n', { flag: 'wx' });
    writeOutcome = 'UNEXPECTED_WRITE_SUCCESS';
  } catch (error) {
    writeOutcome = error.code || 'ERROR';
  }
  const shell = childProcess.spawnSync('/bin/sh', ['-c', 'true'], {
    shell: false,
    encoding: 'utf8',
    timeout: 1000,
    env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent' }
  });
  const networkOutcome = await networkProbe();
  const environmentKeys = Object.keys(process.env).sort();
  const result = {
    schema: 'sdo.macos_seatbelt_probe_result.v1',
    operationId: input.operationId,
    requirementFingerprint: input.requirementFingerprint,
    platform: process.platform,
    cwd: process.cwd(),
    workspaceReadOnly: ['EACCES', 'EPERM', 'EROFS'].includes(writeOutcome),
    workspaceBound: deniedRead('/etc/passwd'),
    networkDenied: networkOutcome !== 'CONNECTED',
    genericProcessDenied: Boolean(shell.error) || shell.status !== 0,
    secretAccessDenied: deniedRead(input.hostEscapeProbe),
    environmentMinimal: environmentKeys.every((key) => ['HOME', 'PATH', 'PWD'].includes(key)),
    writeOutcome,
    networkOutcome,
    processOutcome: shell.error ? shell.error.code : shell.status
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.workspaceReadOnly || !result.workspaceBound || !result.networkDenied ||
      !result.genericProcessDenied || !result.secretAccessDenied || !result.environmentMinimal ||
      result.platform !== 'darwin' || result.cwd !== input.workspace) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ schema: 'sdo.macos_seatbelt_probe_error.v1',
    reason: error.message })}\n`);
  process.exitCode = 1;
});
