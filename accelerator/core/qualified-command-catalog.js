'use strict';

const crypto = require('node:crypto');

const CATALOG_SCHEMA = 'sdo.qualified_command_catalog.v1';
const ADMISSION_SCHEMA = 'sdo.qualified_command_admission.v1';
const COMMANDS = Object.freeze({
  NODE_SYNTAX_CHECK: Object.freeze({ executable: 'NODE_RUNTIME', arguments: Object.freeze(['--check', '-']), targetExtensions: Object.freeze(['.js']), timeoutMs: 2000, maxInputBytes: 1024 * 1024, maxOutputBytes: 32 * 1024, environmentKeys: Object.freeze(['LANG', 'LC_ALL', 'NO_PROXY', 'NODE_NO_WARNINGS', 'no_proxy']) })
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function createQualifiedCommandCatalog() {
  const commands = Object.fromEntries(Object.entries(COMMANDS).sort(([left], [right]) => left.localeCompare(right)));
  return deepFreeze({ schema: CATALOG_SCHEMA, commands, arbitraryShell: false, providerGeneratedCommands: false, network: false, credentials: false, mutationAuthority: false });
}

function admitQualifiedCommand(catalog, { selector, workspace, target, environmentKeys = [] } = {}) {
  if (!catalog || catalog.schema !== CATALOG_SCHEMA || !Object.isFrozen(catalog)) throw new Error('Immutable qualified command catalog is required.');
  if (typeof selector !== 'string' || !catalog.commands[selector]) throw new Error('Command selector is not qualified.');
  if (typeof workspace !== 'string' || !workspace.trim()) throw new Error('Exact command working directory is required.');
  if (typeof target !== 'string' || !target.trim() || target.includes('\0') || /[\r\n]/.test(target)) throw new Error('Exact validation target is required.');
  const command = catalog.commands[selector];
  const extension = target.includes('.') ? target.slice(target.lastIndexOf('.')).toLowerCase() : '';
  if (!command.targetExtensions.includes(extension)) throw new Error('Target is outside the qualified command contract.');
  if (!Array.isArray(environmentKeys) || environmentKeys.some((key) => !command.environmentKeys.includes(key))) throw new Error('Command environment expansion is forbidden.');
  const binding = { selector, workspace: workspace.trim(), target: target.trim(), environmentKeys: [...environmentKeys].sort(), command };
  return deepFreeze({ schema: ADMISSION_SCHEMA, ...binding, admissionFingerprint: crypto.createHash('sha256').update(JSON.stringify(binding)).digest('hex'), admitted: true, shell: false, network: false, credentialUse: false, operationalAuthority: false, mutationAuthority: false });
}

module.exports = Object.freeze({ CATALOG_SCHEMA, ADMISSION_SCHEMA, createQualifiedCommandCatalog, admitQualifiedCommand });
