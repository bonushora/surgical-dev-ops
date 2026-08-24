'use strict';

const crypto = require('node:crypto');

const PLATFORMS = new Set(['linux', 'darwin', 'win32']);
const CONTROLS = Object.freeze([
  'workspaceReadOnly',
  'workspaceBound',
  'networkDenied',
  'genericProcessDenied',
  'secretAccessDenied'
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function fingerprint(schema, fields) {
  return crypto.createHash('sha256')
    .update(`${schema}\0${JSON.stringify(canonicalize(fields))}`, 'utf8')
    .digest('hex');
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

function time(value, name) {
  const result = text(value, name);
  const parsed = Date.parse(result);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== result) {
    throw new Error(`${name} must be a canonical timestamp.`);
  }
  return result;
}

function exact(input, keys, name) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).sort().join('\0') !== [...keys].sort().join('\0')) {
    throw new Error(`${name} shape is invalid.`);
  }
}

function validateOperation(operation) {
  if (!operation || !Object.isFrozen(operation) ||
      operation.schema !== 'sdo.machine_access_operation.v1' ||
      typeof operation.fingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(operation.fingerprint)) {
    throw new Error('Immutable machine access operation is required.');
  }
  return operation;
}

function createSandboxRequirement({ requirementId, operation, platform, requiredAt }) {
  const bound = validateOperation(operation);
  if (!PLATFORMS.has(platform)) throw new Error('Sandbox platform is unsupported.');
  const fields = {
    schema: 'sdo.sandbox_requirement.v1',
    requirementId: text(requirementId, 'Sandbox requirementId'),
    operationId: bound.operationId,
    workspace: bound.workspace,
    operationType: bound.operationType,
    operationFingerprint: bound.fingerprint,
    platform,
    requiredControls: Object.fromEntries(CONTROLS.map((control) => [control, true])),
    requiredAt: time(requiredAt, 'Sandbox requiredAt')
  };
  return deepFreeze({
    ...fields,
    fingerprint: fingerprint('sdo.sandbox_requirement.v1', fields)
  });
}

function createSandboxEvidence({ requirement, adapterEvidence, observedAt }) {
  if (!requirement || !Object.isFrozen(requirement) ||
      requirement.schema !== 'sdo.sandbox_requirement.v1') {
    throw new Error('Immutable sandbox requirement is required.');
  }
  exact(adapterEvidence, [
    'schema', 'decision', 'sandboxKind', 'adapterId', 'operationId', 'workspace',
    'platform', 'requirementFingerprint', 'controls', 'observedAt', 'expiresAt'
  ], 'Sandbox adapter evidence');
  if (!Object.isFrozen(adapterEvidence) ||
      adapterEvidence.schema !== 'sdo.sandbox_adapter_evidence.v1' ||
      adapterEvidence.decision !== 'ENFORCED' ||
      adapterEvidence.operationId !== requirement.operationId ||
      adapterEvidence.workspace !== requirement.workspace ||
      adapterEvidence.platform !== requirement.platform ||
      adapterEvidence.requirementFingerprint !== requirement.fingerprint) {
    throw new Error('Sandbox adapter evidence binding mismatch.');
  }
  exact(adapterEvidence.controls, CONTROLS, 'Sandbox controls');
  if (!CONTROLS.every((control) => adapterEvidence.controls[control] === true)) {
    throw new Error('Required sandbox controls are not enforced.');
  }
  const observation = time(observedAt, 'Sandbox evidence observedAt');
  const adapterObservation = time(adapterEvidence.observedAt, 'Adapter observedAt');
  const expiry = time(adapterEvidence.expiresAt, 'Adapter expiresAt');
  if (observation !== adapterObservation ||
      Date.parse(observation) < Date.parse(requirement.requiredAt) ||
      Date.parse(observation) >= Date.parse(expiry)) {
    throw new Error('Sandbox evidence is stale or temporally unbound.');
  }
  const fields = {
    schema: 'sdo.sandbox_evidence.v1',
    requirementId: requirement.requirementId,
    requirementFingerprint: requirement.fingerprint,
    operationId: requirement.operationId,
    operationFingerprint: requirement.operationFingerprint,
    workspace: requirement.workspace,
    platform: requirement.platform,
    sandboxKind: text(adapterEvidence.sandboxKind, 'Sandbox kind'),
    adapterId: text(adapterEvidence.adapterId, 'Sandbox adapterId'),
    controls: adapterEvidence.controls,
    observedAt: observation,
    expiresAt: expiry,
    adapterEvidence
  };
  return deepFreeze({
    ...fields,
    fingerprint: fingerprint('sdo.sandbox_evidence.v1', fields)
  });
}

module.exports = deepFreeze({ createSandboxRequirement, createSandboxEvidence });
