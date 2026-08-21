'use strict';

// Internal composition only. This module is not imported by the public
// orchestrator API; callers cannot mint authority through request/runtime data.
const runtimeProviders = new WeakMap();

function bindMutationProviderRuntime(runtime, provider) {
  if (!runtime || typeof runtime !== 'object') throw new Error('Runtime composition is required.');
  runtimeProviders.set(runtime, provider);
  return runtime;
}

function resolveMutationProviderRuntime(runtime) {
  return runtimeProviders.get(runtime);
}

module.exports = { bindMutationProviderRuntime, resolveMutationProviderRuntime };
