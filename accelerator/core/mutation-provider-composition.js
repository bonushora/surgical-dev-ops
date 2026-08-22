'use strict';

const trustedBoundaries = new WeakSet();
const STATES = new Set(['QUALIFIED', 'UNQUALIFIED', 'UNSUPPORTED', 'FAILED']);
const text = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
};
const freeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
};
const fingerprint = (value) => require('crypto').createHash('sha256')
  .update(JSON.stringify(value)).digest('hex');

// This is an internal composition seam; it is intentionally not re-exported
// by the production provider module or accepted from runtime/request input.
function createInternalMutationProviderBoundary(input) {
  const caller = (new Error().stack || '').replace(/\\/g, '/');
  if (!caller.includes('accelerator/core/mutation-provider.js') &&
      !caller.includes('accelerator/core/content-addressed-mutation-provider.js') &&
      !caller.includes('tests/accelerator/helpers/qualified-mutation-provider.js')) {
    throw new Error('Mutation provider authority is restricted to internal composition.');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Trusted mutation provider configuration is required.');
  }
  const providerId = text(input.providerId, 'providerId');
  const state = text(input.qualificationState, 'qualificationState');
  if (!STATES.has(state)) throw new Error('Mutation provider qualification state is invalid.');
  if (text(input.operation, 'operation') !== 'COMPARE_AND_REPLACE') {
    throw new Error('Mutation provider operation is unsupported.');
  }
  const platform = text(input.platform, 'platform');
  const capability = freeze({ operation: 'COMPARE_AND_REPLACE',
    compareAndReplace: input.compareAndReplaceCapability === true, platform });
  if (state === 'QUALIFIED' && (!capability.compareAndReplace ||
      typeof input.compareAndReplace !== 'function')) {
    throw new Error('QUALIFIED provider lacks compare-and-replace capability.');
  }
  const qualification = freeze({ schema: 'sdo.mutation_provider_qualification.v1',
    providerId, state, capability,
    fingerprint: fingerprint({ providerId, state, capability }) });
  const boundary = Object.freeze({ qualification,
    compareAndReplace: state === 'QUALIFIED' ? input.compareAndReplace : null });
  trustedBoundaries.add(boundary);
  return boundary;
}

function isTrustedMutationProviderBoundary(value) { return trustedBoundaries.has(value); }

module.exports = { createInternalMutationProviderBoundary, isTrustedMutationProviderBoundary };
