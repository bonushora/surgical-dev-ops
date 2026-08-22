'use strict';

const crypto = require('node:crypto');
const path = require('node:path');

const CHALLENGE_SCHEMA =
  'sdo.local_offline_human_challenge.v1';

const SIGNATURE_SCHEMA =
  'sdo.local_offline_human_signature.v1';

function freeze(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
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

function text(value, label) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function canonicalTimestamp(value, label) {
  const normalized =
    text(value, label);

  const parsed =
    Date.parse(normalized);

  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString() !== normalized
  ) {
    throw new Error(
      `${label} must be a canonical ISO timestamp.`
    );
  }

  return normalized;
}

function validateChallenge(
  challenge,
  issuer,
  subjectId
) {
  if (
    !challenge ||
    typeof challenge !== 'object' ||
    Array.isArray(challenge) ||
    challenge.schema !== CHALLENGE_SCHEMA
  ) {
    throw new Error(
      'Local human challenge is malformed.'
    );
  }

  if (
    challenge.issuer !== issuer ||
    challenge.subjectId !== subjectId
  ) {
    throw new Error(
      'Local human challenge identity is mismatched.'
    );
  }

  const workspace =
    text(
      challenge.workspace,
      'challenge.workspace'
    );

  if (
    !path.isAbsolute(workspace) ||
    path.normalize(workspace) !== workspace
  ) {
    throw new Error(
      'Local human challenge workspace must be canonical and absolute.'
    );
  }

  if (
    !Array.isArray(challenge.audience) ||
    challenge.audience.length === 0 ||
    challenge.audience.some(
      (entry) =>
        typeof entry !== 'string' ||
        !entry.trim()
    )
  ) {
    throw new Error(
      'Local human challenge audience is malformed.'
    );
  }

  text(
    challenge.challengeId,
    'challenge.challengeId'
  );

  text(
    challenge.operationId,
    'challenge.operationId'
  );

  const issuedAt =
    canonicalTimestamp(
      challenge.issuedAt,
      'challenge.issuedAt'
    );

  const expiresAt =
    canonicalTimestamp(
      challenge.expiresAt,
      'challenge.expiresAt'
    );

  if (
    Date.parse(expiresAt) <=
    Date.parse(issuedAt)
  ) {
    throw new Error(
      'Local human challenge validity interval is invalid.'
    );
  }

  return freeze({
    ...challenge,
    workspace,
    audience:
      Object.freeze(
        [...challenge.audience]
      )
  });
}

function createLocalOfflineHumanSigner({
  privateKeyPem,
  issuer,
  subjectId
} = {}) {
  const normalizedIssuer =
    text(issuer, 'issuer');

  const normalizedSubject =
    text(subjectId, 'subjectId');

  if (
    typeof privateKeyPem !== 'string' ||
    !privateKeyPem.trim()
  ) {
    throw new Error(
      'Explicit local human private key is required.'
    );
  }

  let privateKey;

  try {
    privateKey =
      crypto.createPrivateKey(
        privateKeyPem
      );
  } catch {
    throw new Error(
      'Local human private key is malformed.'
    );
  }

  if (
    privateKey.asymmetricKeyType !==
    'ed25519'
  ) {
    throw new Error(
      'Local human signing authority requires an Ed25519 private key.'
    );
  }

  function signChallenge(challenge) {
    const normalized =
      validateChallenge(
        challenge,
        normalizedIssuer,
        normalizedSubject
      );

    const signature =
      crypto.sign(
        null,
        encoded(normalized),
        privateKey
      );

    return freeze({
      schema: SIGNATURE_SCHEMA,
      challenge: normalized,
      signatureBase64:
        signature.toString('base64')
    });
  }

  return freeze({
    signChallenge
  });
}

module.exports = Object.freeze({
  createLocalOfflineHumanSigner
});
