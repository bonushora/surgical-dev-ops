'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createInternalMutationProviderBoundary } =
  require('../../../accelerator/core/mutation-provider-composition');
const { bindMutationProviderRuntime } =
  require('../../../accelerator/core/mutation-provider-internal');
const { requireDurabilityReceipt, durabilityClaims } =
  require('../../../accelerator/core/mutation-durability');
const { defaultFilesystemDurabilityAdapter } =
  require('../../../accelerator/adapters/filesystem-durability-adapter');

function frozen(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) frozen(child);
  return Object.freeze(value);
}

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');

function identityMatches(stat, identity) {
  return stat && identity &&
    String(stat.dev) === identity.dev &&
    String(stat.ino) === identity.ino &&
    String(stat.size) === identity.size &&
    String(stat.mtimeNs) === identity.mtimeNs &&
    String(stat.ctimeNs) === identity.ctimeNs;
}

function ancestorIdentityChainMatches(chain) {
  if (!Array.isArray(chain) || chain.length === 0) return false;

  for (const ancestor of chain) {
    if (!ancestor || typeof ancestor.path !== 'string' || !ancestor.identity) return false;

    let stat;
    try {
      stat = fs.statSync(ancestor.path, { bigint: true });
    } catch {
      return false;
    }

    if (!stat.isDirectory() ||
        String(stat.dev) !== ancestor.identity.dev ||
        String(stat.ino) !== ancestor.identity.ino) {
      return false;
    }
  }

  return true;
}

function createQualifiedTestMutationProvider(hooks = {}) {
  let boundary;
  boundary = createInternalMutationProviderBoundary({
    providerId: 'sdo:test-only-qualified-provider', qualificationState: 'QUALIFIED',
    operation: 'COMPARE_AND_REPLACE', platform: 'test', compareAndReplaceCapability: true,
    compareAndReplace(request, runtime = {}) {
      if (hooks.compareAndReplace) return hooks.compareAndReplace(request, runtime, boundary);
      if (hooks.beforeCompare) hooks.beforeCompare(request);
      const flags = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW;
      const descriptor = fs.openSync(request.target, flags);
      let stat;
      let current;
      try {
        stat = fs.fstatSync(descriptor, { bigint: true });
        current = fs.readFileSync(descriptor);
      } finally { fs.closeSync(descriptor); }
      const identity = request.expectedIdentity;
      const matches = stat.isFile() && identityMatches(stat, identity) &&
        digest(current) === request.beforeSha256;
      if (!matches) return result(request, boundary, 'MISMATCH');
      if (!ancestorIdentityChainMatches(request.expectedAncestorIdentityChain)) {
        return result(request, boundary, 'FAILED_PRECOMMIT');
      }
      const replacement = Buffer.from(request.replacementBase64, 'base64');
      if (digest(replacement) !== request.replacementSha256) {
        return result(request, boundary, 'FAILED_PRECOMMIT');
      }
      const durability = runtime.durabilityAdapter || defaultFilesystemDurabilityAdapter;
      const temporary = path.join(path.dirname(request.target),
        `.sdo-test-provider-${crypto.randomUUID()}.tmp`);
      let temporaryDescriptor;
      try {
        temporaryDescriptor = fs.openSync(temporary,
          fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL |
          fs.constants.O_NOFOLLOW, request.mode & 0o777);
        fs.writeFileSync(temporaryDescriptor, replacement);
        requireDurabilityReceipt(durability.flushFile(temporaryDescriptor,
          `replacement-temp:${temporary}`), 'FLUSH_FILE_DATA');
        fs.closeSync(temporaryDescriptor);
        temporaryDescriptor = undefined;
        if (hooks.beforePublish) hooks.beforePublish(request);
        if (!ancestorIdentityChainMatches(request.expectedAncestorIdentityChain)) {
          return result(request, boundary, 'FAILED_PRECOMMIT');
        }
        fs.renameSync(temporary, request.target);
        try {
          const renameBoundary = durability.confirmRename(path.dirname(request.target));
          requireDurabilityReceipt(renameBoundary, 'DURABLE_RENAME_BOUNDARY');
          return result(request, boundary, 'APPLIED', frozen({
            tempData: 'CONFIRMED', renameBoundary, claims: durabilityClaims()
          }));
        } catch {
          return result(request, boundary, 'AMBIGUOUS_POSTCOMMIT');
        }
      } finally {
        if (temporaryDescriptor !== undefined) fs.closeSync(temporaryDescriptor);
        try { fs.unlinkSync(temporary); } catch {}
      }
    }
  });
  return boundary;
}

function createTestBoundary(state, compareAndReplace) {
  return createInternalMutationProviderBoundary({ providerId: `test:${state.toLowerCase()}`,
    qualificationState: state, operation: 'COMPARE_AND_REPLACE', platform: 'test',
    compareAndReplaceCapability: state === 'QUALIFIED', compareAndReplace });
}

function result(request, boundary, outcome, durability = null) {
  return frozen({ schema: 'sdo.compare_and_replace_result.v1',
    providerId: boundary.qualification.providerId,
    qualificationFingerprint: boundary.qualification.fingerprint,
    transactionId: request.transactionId, target: request.target,
    beforeSha256: request.beforeSha256, replacementSha256: request.replacementSha256,
    outcome, durability });
}

module.exports = { createQualifiedTestMutationProvider, createTestBoundary, providerResult: result,
  bindMutationProviderRuntime };
