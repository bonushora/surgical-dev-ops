'use strict';

const fs = require('node:fs');
const net = require('node:net');

function networkProbe() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '1.1.1.1', port: 53 });
    let completed = false;
    const finish = (outcome) => {
      if (completed) return;
      completed = true;
      socket.destroy();
      resolve(outcome);
    };
    socket.setTimeout(1000, () => finish('TIMEOUT'));
    socket.once('connect', () => finish('CONNECTED'));
    socket.once('error', (error) => finish(error.code || 'ERROR'));
  });
}

function attemptWrite(target) {
  try {
    fs.writeFileSync(target, 'probe\n', { flag: 'wx', mode: 0o600 });
    fs.rmSync(target);
    return 'WRITTEN';
  } catch (error) {
    return error.code || 'ERROR';
  }
}

async function main() {
  const networkOutcome = await networkProbe();
  const internalWrite = attemptWrite('/cognitive/tmp/containment-probe');
  const externalWrite = attemptWrite('/containment-escape-probe');
  const status = fs.readFileSync('/proc/self/status', 'utf8');
  const field = (name) => {
    const match = status.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'));
    return match ? match[1].trim() : null;
  };
  const environmentKeys = Object.keys(process.env).sort();
  const result = {
    schema: 'sdo.codex_linux_containment_probe.v1',
    cwd: process.cwd(),
    executable: process.execPath,
    cognitiveWriteEnabled: internalWrite === 'WRITTEN',
    externalWriteDenied: externalWrite !== 'WRITTEN',
    hostFilesystemHidden: !fs.existsSync('/home') && !fs.existsSync('/root') &&
      !fs.existsSync('/workspace') && !fs.existsSync('/etc'),
    networkDenied: networkOutcome !== 'CONNECTED' && networkOutcome !== 'TIMEOUT',
    genericProcessDenied: !fs.existsSync('/bin/sh') && !fs.existsSync('/usr/bin/env'),
    environmentMinimal: environmentKeys.every((key) =>
      ['HOME', 'LANG', 'PATH', 'PWD', 'TMPDIR'].includes(key)),
    homeIsolated: process.env.HOME === '/cognitive/home',
    tempIsolated: process.env.TMPDIR === '/cognitive/tmp',
    networkOutcome,
    externalWrite,
    noNewPrivs: field('NoNewPrivs'),
    effectiveCapabilities: field('CapEff')
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.cognitiveWriteEnabled || !result.externalWriteDenied ||
      !result.hostFilesystemHidden || !result.networkDenied ||
      !result.genericProcessDenied || !result.environmentMinimal ||
      !result.homeIsolated || !result.tempIsolated ||
      result.cwd !== '/cognitive/workspace' ||
      result.executable !== '/runtime/node' ||
      result.noNewPrivs !== '1' ||
      result.effectiveCapabilities !== '0000000000000000') {
    process.exitCode = 1;
  }
}

main().catch(() => {
  process.stderr.write('Codex containment probe failed closed.\n');
  process.exitCode = 1;
});
