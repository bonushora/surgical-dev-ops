'use strict';

const MAX_DIAGNOSTIC_STDERR_BYTES = 2048;

function sanitize(value, redactions) {
  let output = String(value || '').replaceAll('\0', '');
  for (const item of [...redactions].filter(Boolean).sort((a, b) => b.length - a.length)) {
    output = output.replaceAll(item, '<redacted-path>');
  }
  return output.slice(0, MAX_DIAGNOSTIC_STDERR_BYTES);
}

function formatIsolationFailure(result, { redactions = [] } = {}) {
  return JSON.stringify({
    classification: result && result.classification || null,
    exitCode: (result && result.exitCode) ?? null,
    signal: result && result.signal || null,
    stderr: sanitize(result && result.stderr, redactions),
    planDigest: result && result.planDigest || null
  });
}

module.exports = Object.freeze({
  formatIsolationFailure,
  MAX_DIAGNOSTIC_STDERR_BYTES
});
