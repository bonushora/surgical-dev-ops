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
  const qualified =
    typeof input.operationId === 'string' && input.operationId.length > 0 &&
    typeof input.requirementFingerprint === 'string' &&
    input.requirementFingerprint.length === 64 &&
    ['EACCES', 'EPERM', 'EROFS'].includes(writeOutcome) &&
    deniedRead('/etc/passwd') &&
    networkOutcome !== 'CONNECTED' &&
    (Boolean(shell.error) || shell.status !== 0) &&
    deniedRead(input.hostEscapeProbe) &&
    environmentKeys.every((key) => ['HOME', 'PATH', 'PWD'].includes(key)) &&
    process.platform === 'darwin' &&
    process.cwd() === input.workspace;

  /*
   * The deny-default profile grants no output write channel. A zero exit
   * status is the complete fixed-probe attestation; every failed predicate
   * remains a nonzero fail-closed result.
   */
  process.exitCode = qualified ? 0 : 1;
}

main().catch(() => { process.exitCode = 1; });
