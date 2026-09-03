'use strict';

function createLocalDashboardTransport({ endpoint, token } = {}) {
  if (!endpoint || typeof endpoint.ingest !== 'function' || typeof token !== 'string') throw new TypeError('local Dashboard endpoint contract required');
  return async (payload) => {
    const result = endpoint.ingest({ token, ...payload });
    if (!result.accepted) return { status: 'FAILED', reason: result.reason, operationalAuthority: false };
    return { status: 'SENT', reason: null, operationalAuthority: false };
  };
}

module.exports = { createLocalDashboardTransport };
