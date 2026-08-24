'use strict';

const fs = require('node:fs');
const net = require('node:net');

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

async function main() {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const networkOutcome = await networkProbe();
  let writeOutcome = null;
  try {
    fs.writeFileSync('/workspace/.sdo-sandbox-adapter-probe', 'forbidden\n', { flag: 'wx' });
    writeOutcome = 'UNEXPECTED_WRITE_SUCCESS';
  } catch (error) {
    writeOutcome = error.code || 'ERROR';
  }
  const status = fs.readFileSync('/proc/self/status', 'utf8');
  const field = (name) => {
    const match = status.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'));
    return match ? match[1].trim() : null;
  };
  const environmentKeys = Object.keys(process.env).sort();
  const result = {
    schema: 'sdo.linux_bwrap_probe_result.v1',
    operationId: input.operationId,
    requirementFingerprint: input.requirementFingerprint,
    platform: process.platform,
    cwd: process.cwd(),
    executable: process.execPath,
    workspaceReadOnly: ['EROFS', 'EACCES', 'EPERM'].includes(writeOutcome),
    workspaceBound: !fs.existsSync('/home') && !fs.existsSync('/root'),
    networkDenied: networkOutcome !== 'CONNECTED',
    genericProcessDenied: !fs.existsSync('/bin/sh') && !fs.existsSync('/usr/bin/env'),
    secretAccessDenied: !fs.existsSync('/home') && !fs.existsSync('/root') &&
      process.env.HOME === '/nonexistent',
    environmentMinimal: environmentKeys.every((key) => ['HOME', 'PATH', 'PWD'].includes(key)),
    writeOutcome,
    networkOutcome,
    noNewPrivs: field('NoNewPrivs'),
    effectiveCapabilities: field('CapEff')
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.workspaceReadOnly || !result.workspaceBound || !result.networkDenied ||
      !result.genericProcessDenied || !result.secretAccessDenied || !result.environmentMinimal ||
      result.noNewPrivs !== '1' || result.effectiveCapabilities !== '0000000000000000' ||
      result.platform !== 'linux' || result.cwd !== '/workspace' ||
      result.executable !== '/runtime/node') process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ schema: 'sdo.linux_bwrap_probe_error.v1',
    reason: error.message })}\n`);
  process.exitCode = 1;
});
