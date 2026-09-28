'use strict';

const CONFIG_SCHEMA = 'surgical.customer_configuration.v1';
const PRODUCT_VERSION = '0.1.0-beta.1';
const PROFILES = Object.freeze(['developer', 'enterprise', 'financial']);
const EXACT_FIELDS = Object.freeze([
  'schema', 'productVersion', 'profile', 'runtime', 'provider', 'telemetry',
  'evidence', 'repository', 'production', 'network', 'supportBundle',
  'enterpriseIdentity', 'secretStore', 'policy', 'authority',
]);

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null);
}

function exact(value, fields, label) {
  if (!plain(value) || Object.keys(value).length !== fields.length
    || fields.some((field) => !Object.hasOwn(value, field))) {
    throw new TypeError(`${label} must use the exact supported schema; unknown keys are forbidden`);
  }
}

function immutable(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  return Object.freeze(Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, immutable(child)]),
  ));
}

function createDefaultConfiguration({ profile = 'developer' } = {}) {
  if (!PROFILES.includes(profile)) throw new TypeError('Deployment profile is unsupported');
  const regulated = profile === 'financial';
  const enterprise = profile !== 'developer';
  return immutable({
    schema: CONFIG_SCHEMA,
    productVersion: PRODUCT_VERSION,
    profile,
    runtime: { logLevel: 'info', stateSchema: 1 },
    provider: {
      kind: null,
      endpoint: null,
      credentialReference: null,
      networkAllowed: false,
      fallbackAllowed: false,
    },
    telemetry: {
      externalEnabled: false,
      destination: null,
      sourceContentAllowed: false,
      authorityMaterialAllowed: false,
    },
    evidence: { retentionDays: regulated ? 2555 : 90, exportEnabled: true },
    repository: { automaticEnrollment: false, requireCleanForMutation: true },
    production: { eligible: false, configuredRepositories: [] },
    network: {
      mode: regulated ? 'DENY_BY_DEFAULT' : 'EXPLICIT_ONLY',
      allowedDestinations: [],
    },
    supportBundle: { enabled: true, includeRepositoryContent: false },
    enterpriseIdentity: {
      adapter: null,
      status: 'UNSUPPORTED',
      requiredForProduction: enterprise,
    },
    secretStore: { adapter: null, status: 'UNSUPPORTED' },
    policy: {
      roles: ['operator', 'approver', 'auditor', 'administrator'],
      administratorImpliesApproval: false,
      automaticPush: false,
      automaticMerge: false,
      automaticDeploy: false,
      automaticPublish: false,
    },
    authority: {
      owner: 'surgical-dev-ops',
      configurationIsAuthority: false,
      profileIsAuthority: false,
      openingRepositoryIsAuthority: false,
    },
  });
}

function validateConfiguration(input) {
  exact(input, EXACT_FIELDS, 'Configuration');
  if (input.schema !== CONFIG_SCHEMA || input.productVersion !== PRODUCT_VERSION
    || !PROFILES.includes(input.profile)) throw new TypeError('Configuration version is incompatible');
  exact(input.runtime, ['logLevel', 'stateSchema'], 'Runtime configuration');
  exact(input.provider, ['kind', 'endpoint', 'credentialReference', 'networkAllowed', 'fallbackAllowed'], 'Provider configuration');
  exact(input.telemetry, ['externalEnabled', 'destination', 'sourceContentAllowed', 'authorityMaterialAllowed'], 'Telemetry configuration');
  exact(input.evidence, ['retentionDays', 'exportEnabled'], 'Evidence configuration');
  exact(input.repository, ['automaticEnrollment', 'requireCleanForMutation'], 'Repository configuration');
  exact(input.production, ['eligible', 'configuredRepositories'], 'Production configuration');
  exact(input.network, ['mode', 'allowedDestinations'], 'Network configuration');
  exact(input.supportBundle, ['enabled', 'includeRepositoryContent'], 'Support-bundle configuration');
  exact(input.enterpriseIdentity, ['adapter', 'status', 'requiredForProduction'], 'Enterprise identity configuration');
  exact(input.secretStore, ['adapter', 'status'], 'Secret-store configuration');
  exact(input.policy, ['roles', 'administratorImpliesApproval', 'automaticPush', 'automaticMerge', 'automaticDeploy', 'automaticPublish'], 'Policy configuration');
  exact(input.authority, ['owner', 'configurationIsAuthority', 'profileIsAuthority', 'openingRepositoryIsAuthority'], 'Authority configuration');
  const credentialReference = input.provider.credentialReference;
  if (credentialReference !== null
    && (typeof credentialReference !== 'string'
      || !/^(?:env|file|keychain|secret-store):[A-Za-z0-9._/-]{1,200}$/.test(credentialReference))) {
    throw new TypeError('Provider credential reference is invalid; plaintext credentials are forbidden');
  }
  if (![null, 'ollama', 'openai', 'codex'].includes(input.provider.kind)
    || typeof input.provider.networkAllowed !== 'boolean'
    || input.provider.fallbackAllowed !== false
    || input.telemetry.sourceContentAllowed !== false
    || input.telemetry.authorityMaterialAllowed !== false
    || input.repository.automaticEnrollment !== false
    || input.authority.owner !== 'surgical-dev-ops'
    || input.authority.configurationIsAuthority !== false
    || input.authority.profileIsAuthority !== false
    || input.authority.openingRepositoryIsAuthority !== false
    || input.policy.administratorImpliesApproval !== false
    || input.policy.automaticPush !== false
    || input.policy.automaticMerge !== false
    || input.policy.automaticDeploy !== false
    || input.policy.automaticPublish !== false
    || !Number.isSafeInteger(input.evidence.retentionDays)
    || input.evidence.retentionDays < 1
    || !Array.isArray(input.production.configuredRepositories)
    || !Array.isArray(input.network.allowedDestinations)) {
    throw new TypeError('Configuration would weaken the customer authority or data boundary');
  }
  if (input.profile === 'financial'
    && (input.telemetry.externalEnabled !== false
      || input.network.mode !== 'DENY_BY_DEFAULT'
      || input.enterpriseIdentity.requiredForProduction !== true)) {
    throw new TypeError('Financial profile secure defaults are required');
  }
  return immutable(input);
}

module.exports = Object.freeze({
  CONFIG_SCHEMA,
  PRODUCT_VERSION,
  PROFILES,
  createDefaultConfiguration,
  validateConfiguration,
});
