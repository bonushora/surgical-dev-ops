'use strict';

const crypto = require('node:crypto');

const SIGNATURE_SCHEMA =
  'sdo.local_offline_human_signature.v1';

const CHALLENGE_SCHEMA =
  'sdo.local_offline_human_challenge.v1';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value)) {
    freeze(child);
  }

  return Object.freeze(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

function encoded(value) {
  return Buffer.from(
    JSON.stringify(canonicalize(value)),
    'utf8'
  );
}

function text(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : null;
}

function timestamp(value) {
  const normalized = text(value);

  if (!normalized) {
    return null;
  }

  const parsed = Date.parse(normalized);

  return Number.isFinite(parsed) &&
    new Date(parsed).toISOString() === normalized
    ? normalized
    : null;
}

function createLocalOfflineHumanVerifier({
  publicKeyPem,
  issuer,
  subjectId
} = {}) {
  const trustedIssuer = text(issuer);
  const trustedSubject = text(subjectId);

  if (
    !trustedIssuer ||
    !trustedSubject ||
    typeof publicKeyPem !== 'string' ||
    !publicKeyPem.trim()
  ) {
    throw new Error(
      'Explicit local human trust configuration is required.'
    );
  }

  let publicKey;

  try {
    publicKey = crypto.createPublicKey(publicKeyPem);
  } catch {
    throw new Error(
      'Local human public key is malformed.'
    );
  }

  if (publicKey.asymmetricKeyType !== 'ed25519') {
    throw new Error(
      'Local human authority requires an Ed25519 public key.'
    );
  }

  function verify(request) {
    if (
      !request ||
      typeof request !== 'object' ||
      !request.rawAssertion ||
      !request.expected ||
      !Array.isArray(request.trustedIssuers)
    ) {
      throw new Error(
        'Local human verification request is malformed.'
      );
    }

    const raw = request.rawAssertion;
    const expected = request.expected;

    if (
      raw.schema !== SIGNATURE_SCHEMA ||
      !raw.challenge ||
      raw.challenge.schema !== CHALLENGE_SCHEMA ||
      typeof raw.signatureBase64 !== 'string'
    ) {
      throw new Error(
        'Local human signature evidence is malformed.'
      );
    }

    const challenge = raw.challenge;

    if (
      challenge.issuer !== trustedIssuer ||
      challenge.subjectId !== trustedSubject ||
      !request.trustedIssuers.includes(trustedIssuer) ||
      challenge.operationId !== expected.operationId ||
      challenge.workspace !== expected.workspace ||
      challenge.tenantId !== (expected.tenantId ?? null) ||
      challenge.projectId !== (expected.projectId ?? null) ||
      !Array.isArray(challenge.audience) ||
      !challenge.audience.includes(expected.audience) ||
      !text(challenge.challengeId) ||
      !timestamp(challenge.issuedAt) ||
      !timestamp(challenge.expiresAt) ||
      Date.parse(challenge.expiresAt) <=
        Date.parse(challenge.issuedAt)
    ) {
      throw new Error(
        'Local human challenge is not bound to the requested authority.'
      );
    }

    let signature;

    try {
      signature = Buffer.from(
        raw.signatureBase64,
        'base64'
      );
    } catch {
      throw new Error(
        'Local human signature is malformed.'
      );
    }

    if (
      signature.length === 0 ||
      !crypto.verify(
        null,
        encoded(challenge),
        publicKey,
        signature
      )
    ) {
      throw new Error(
        'Local human signature verification failed.'
      );
    }

    const assertion = freeze({
      schema: 'sdo.verified_human_identity_assertion.v1',
      verification: 'VERIFIED',
      assertionId: challenge.challengeId,

      subject: {
        id: trustedSubject,
        type: 'HUMAN'
      },

      issuer: trustedIssuer,

      authentication: {
        method: 'PUBLIC_KEY',
        context: 'LOCAL_OFFLINE_HUMAN_AUTHORITY'
      },

      issuedAt: challenge.issuedAt,
      expiresAt: challenge.expiresAt,

      audience: [...challenge.audience],

      operationId: challenge.operationId,
      workspace: challenge.workspace,
      tenantId: challenge.tenantId,
      projectId: challenge.projectId,

      revocationStatus: 'NOT_REVOKED',

      verifiedAt: challenge.issuedAt
    });

    return freeze({
      status: 'VERIFIED',
      assertion,
      verifierId: 'sdo:local-offline-ed25519:v1'
    });
  }

  return freeze({
    verify
  });
}

module.exports = Object.freeze({
  createLocalOfflineHumanVerifier
});
