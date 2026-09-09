'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPORT_LIMIT = 2 * 1024 * 1024;
const RECENT_MS = 20 * 60 * 1000;

function sanitize(value) {
  return String(value || '')
    .replaceAll(os.homedir(), '<USER_HOME>')
    .replace(/\/Users\/[^/\s]+/g, '<USER_HOME>')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 512);
}

function candidateReports(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return [];
  const directories = [root, path.join(root, 'Retired')];
  return directories.flatMap((directory) => {
    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) return [];
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^node.*\.ips$/i.test(entry.name))
      .map((entry) => path.join(directory, entry.name));
  }).filter((file) => {
    const stat = fs.statSync(file);
    return stat.size <= REPORT_LIMIT && Date.now() - stat.mtimeMs <= RECENT_MS;
  }).sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
}

function parseReport(file) {
  const source = fs.readFileSync(file, 'utf8');
  const lineBreak = source.indexOf('\n');
  const bodies = [source, lineBreak >= 0 ? source.slice(lineBreak + 1) : ''];
  for (const body of bodies) {
    try {
      const value = JSON.parse(body);
      if (value && typeof value === 'object') return value;
    } catch {}
  }
  return null;
}

function frameEvidence(report) {
  const threads = Array.isArray(report.threads) ? report.threads : [];
  const thread = threads.find((item) => item && item.triggered) ||
    threads[report.faultingThread || -1] || null;
  const images = Array.isArray(report.usedImages) ? report.usedImages : [];
  return thread && Array.isArray(thread.frames)
    ? thread.frames.slice(0, 32).map((frame) => ({
        image: images[frame.imageIndex] && sanitize(images[frame.imageIndex].name),
        symbol: sanitize(frame.symbol || frame.rawSymbol || ''),
        imageOffset: Number.isSafeInteger(frame.imageOffset) ? frame.imageOffset : null,
        symbolLocation: Number.isSafeInteger(frame.symbolLocation)
          ? frame.symbolLocation
          : null
      }))
    : [];
}

function sandboxDenials() {
  const result = childProcess.spawnSync('/usr/bin/log', [
    'show', '--last', '20m', '--style', 'compact',
    '--predicate', 'process == "sandboxd"'
  ], {
    encoding: 'utf8',
    shell: false,
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
    env: { PATH: '/usr/bin:/bin' }
  });
  return String(result.stdout || '').split(/\r?\n/)
    .filter((line) => /node|sdo-seatbelt|deny/i.test(line))
    .slice(-40)
    .map(sanitize);
}

if (process.platform !== 'darwin') {
  console.log('SDO_MACOS_NODE_ABORT {"status":"NOT_DARWIN"}');
  process.exitCode = 0;
} else {
  const root = path.join(os.homedir(), 'Library', 'Logs', 'DiagnosticReports');
  const file = candidateReports(root)[0] || null;
  const report = file ? parseReport(file) : null;
  const evidence = {
    schema: 'sdo.macos_node_abort_diagnostic.v1',
    status: report ? 'OBSERVED' : 'REPORT_UNAVAILABLE',
    report: report ? {
      file: path.basename(file),
      exception: report.exception || null,
      termination: report.termination || null,
      asi: Object.fromEntries(Object.entries(report.asi || {}).map(
        ([key, value]) => [sanitize(key), sanitize(JSON.stringify(value))]
      )),
      frames: frameEvidence(report)
    } : null,
    sandboxDenials: sandboxDenials()
  };
  console.log(`SDO_MACOS_NODE_ABORT ${JSON.stringify(evidence)}`);
}
