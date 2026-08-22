'use strict';

const crypto = require('node:crypto');

const {
  createInternalMutationProviderBoundary
} = require('./mutation-provider-composition');

const {
  bootstrapManifestAuthority,
  compareAndSwapManifest
} = require('./git-manifest-cas');

const {
  recoverAuthoritativeMaterialization
} = require('./git-manifest-materializer');

function hash(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  if (ArrayBuffer.isView(value)) {
    return value;
  }

  for (const child of Object.values(value)) {
    freeze(child);
  }

  return Object.freeze(value);
}

function result(request, boundary, outcome, evidence = null) {
  return freeze({
    schema: 'sdo.compare_and_replace_result.v1',
    providerId: boundary.qualification.providerId,
    qualificationFingerprint: boundary.qualification.fingerprint,
    transactionId: request.transactionId,
    target: request.target,
    beforeSha256: request.beforeSha256,
    replacementSha256: request.replacementSha256,
    outcome,
    durability: evidence
  });
}

function validateRequest(request) {
  if (!request ||
      request.schema !== 'sdo.compare_and_replace_request.v1' ||
      request.operation !== 'COMPARE_AND_REPLACE' ||
      request.phase !== 'AUTHORIZED_PATCH' ||
      typeof request.workspace !== 'string' ||
      typeof request.target !== 'string' ||
      !/^[a-f0-9]{64}$/.test(request.beforeSha256 || '') ||
      !/^[a-f0-9]{64}$/.test(request.replacementSha256 || '') ||
      typeof request.replacementBase64 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(request.commitAuthorityFingerprint || '')) {
    throw new Error('Content-addressed provider request is malformed.');
  }
}

let boundary;

boundary = createInternalMutationProviderBoundary({
  providerId: 'sdo:git-manifest-cas-v1',
  qualificationState: 'QUALIFIED',
  operation: 'COMPARE_AND_REPLACE',
  platform: process.platform,
  compareAndReplaceCapability: true,

  compareAndReplace(request) {
    validateRequest(request);

    const replacement =
      Buffer.from(request.replacementBase64, 'base64');

    if (hash(replacement) !== request.replacementSha256) {
      return result(request, boundary, 'FAILED_PRECOMMIT');
    }

    let before;

    try {
      before = bootstrapManifestAuthority({
        workspace: request.workspace,
        target: request.target,
        expectedBeforeSha256: request.beforeSha256
      });
    } catch {
      return result(request, boundary, 'MISMATCH');
    }

    const cas = compareAndSwapManifest({
      workspace: request.workspace,
      target: request.target,
      expectedManifestOid: before.manifestOid,
      expectedBeforeSha256: request.beforeSha256,
      replacement
    });

    if (cas.decision === 'MISMATCH') {
      return result(request, boundary, 'MISMATCH');
    }

    if (cas.decision !== 'APPLIED') {
      return result(request, boundary, 'FAILED_PRECOMMIT');
    }

    const materialized =
      recoverAuthoritativeMaterialization({
        workspace: request.workspace,
        target: request.target,
        expectedManifestOid: cas.afterManifestOid
      });

    if (!['MATERIALIZED', 'ALREADY_MATERIALIZED']
      .includes(materialized.decision)) {
      return result(
        request,
        boundary,
        'AMBIGUOUS_POSTCOMMIT',
        freeze({
          authority: cas,
          materialization: materialized
        })
      );
    }

    return result(
      request,
      boundary,
      'APPLIED',
      freeze({
        schema: 'sdo.content_addressed_provider_evidence.v1',
        authority: cas,
        materialization: materialized,
        ordinaryWorktreeAuthoritative: false
      })
    );
  }
});

module.exports = Object.freeze({
  providerBoundary: boundary
});
