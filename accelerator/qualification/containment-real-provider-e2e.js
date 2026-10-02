'use strict';

const https = require('node:https');

function result(state, detail) {
  return Object.freeze({
    schema: 'sdo.containment_real_provider_e2e.v1',
    state,
    detail
  });
}

async function run() {
  if (process.env.SDO_CONTAINMENT_REAL_PROVIDER_E2E !== '1') {
    return result('NOT_EXECUTED', 'Explicit real-provider qualification opt-in is absent.');
  }
  const key = process.env.OPENAI_API_KEY;
  if (typeof key !== 'string' || !key.trim()) {
    return result('BLOCKED', 'OPENAI_API_KEY is absent.');
  }

  // Deliberately bounded capability probe. It does not exercise tools or WebSocket.
  const response = await new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.openai.com',
      port: 443,
      method: 'GET',
      path: '/v1/models',
      headers: { authorization: `Bearer ${key.trim()}` },
      agent: false,
      timeout: 30000
    }, (res) => {
      res.resume();
      res.once('end', () => resolve(res.statusCode || 0));
    });
    req.once('timeout', () => { req.destroy(); resolve(0); });
    req.once('error', () => resolve(0));
    req.end();
  });

  if (response >= 200 && response < 500) {
    return result('OBSERVED_PROVIDER_REACHABLE',
      'Provider reachability was observed. This is not containment qualification by itself.');
  }
  return result('BLOCKED', 'Provider could not be reached through the explicit qualification probe.');
}

if (require.main === module) {
  run().then((value) => {
    process.stdout.write(JSON.stringify(value, null, 2) + '\n');
    process.exitCode = value.state === 'BLOCKED' ? 2 : 0;
  });
}

module.exports = Object.freeze({ run });
