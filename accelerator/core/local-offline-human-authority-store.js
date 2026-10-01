'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  createLocalOfflineHumanSigner
} = require(
  '../adapters/local-offline-human-signer'
);

const AUTHORITY_FILES = Object.freeze([
  'authority.json',
  'private-key.pem',
  'public-key.pem'
]);

function requireText(value, label) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function requireAbsolute(value, label) {
  const normalized =
    requireText(value, label);

  if (
    !path.isAbsolute(normalized) ||
    path.normalize(normalized) !== normalized
  ) {
    throw new Error(
      `${label} must be an absolute canonical path.`
    );
  }

  return normalized;
}

function ensureNoExistingAuthority(root) {
  if (fs.existsSync(root)) {
    throw new Error(
      'Local human authority root already exists; overwrite is forbidden.'
    );
  }
}

function requirePhysicalAuthorityRoot(
  authorityRoot
) {
  const requested =
    requireAbsolute(
      authorityRoot,
      'authorityRoot'
    );

  const requestedStat =
    fs.lstatSync(requested);

  /*
   * Reject authority when the final component itself is a
   * symlink. An ancestor lexical alias is different: it may
   * legitimately materialize to the same physical directory
   * on platforms such as macOS (/var -> /private/var).
   */
  if (
    !requestedStat.isDirectory() ||
    requestedStat.isSymbolicLink()
  ) {
    throw new Error(
      'Authority root must be a physical canonical directory.'
    );
  }

  const physical =
    fs.realpathSync(requested);

  const physicalStat =
    fs.lstatSync(physical);

  if (
    !physicalStat.isDirectory() ||
    physicalStat.isSymbolicLink()
  ) {
    throw new Error(
      'Authority root must be a physical canonical directory.'
    );
  }

  if (
    typeof process.getuid === 'function' &&
    (
      physicalStat.uid !== process.getuid() ||
      (physicalStat.mode & 0o077) !== 0
    )
  ) {
    throw new Error(
      'Authority root permissions or ownership are unsafe.'
    );
  }

  return physical;
}

function requirePrivateAuthorityFile(root, name) {
  const target = path.join(root, name);
  let item;
  try {
    item = fs.lstatSync(target);
  } catch {
    throw new Error('Authority storage contains unknown or missing state.');
  }
  if (
    !item.isFile() ||
    item.isSymbolicLink() ||
    fs.realpathSync(target) !== target ||
    path.dirname(target) !== root
  ) {
    throw new Error('Authority storage contains unsafe files.');
  }
  if (
    typeof process.getuid === 'function' &&
    (
      item.uid !== process.getuid() ||
      (item.mode & 0o077) !== 0
    )
  ) {
    throw new Error('Authority file permissions or ownership are unsafe.');
  }
  return target;
}

function validatedAuthorityMaterial(authorityRoot) {
  const root = requirePhysicalAuthorityRoot(authorityRoot);
  const entries = fs.readdirSync(root).sort();
  if (JSON.stringify(entries) !== JSON.stringify(AUTHORITY_FILES)) {
    throw new Error('Authority storage contains unknown or missing state.');
  }
  const privateKeyPath = requirePrivateAuthorityFile(root, 'private-key.pem');
  const publicKeyPath = requirePrivateAuthorityFile(root, 'public-key.pem');
  const metadataPath = requirePrivateAuthorityFile(root, 'authority.json');
  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch {
    throw new Error('Authority metadata is malformed.');
  }
  if (
    !metadata ||
    Object.getPrototypeOf(metadata) !== Object.prototype ||
    JSON.stringify(Object.keys(metadata).sort()) !==
      JSON.stringify(['algorithm', 'issuer', 'schema', 'subjectId']) ||
    metadata.schema !== 'sdo.local_offline_human_authority.v1' ||
    metadata.algorithm !== 'Ed25519'
  ) {
    throw new Error('Authority metadata is malformed.');
  }
  const issuer = requireText(metadata.issuer, 'metadata.issuer');
  const subjectId = requireText(metadata.subjectId, 'metadata.subjectId');
  const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
  const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8');
  let privateKey;
  let publicKey;
  try {
    privateKey = crypto.createPrivateKey(privateKeyPem);
    publicKey = crypto.createPublicKey(publicKeyPem);
  } catch {
    throw new Error('Local human authority key material is malformed.');
  }
  if (
    privateKey.asymmetricKeyType !== 'ed25519' ||
    publicKey.asymmetricKeyType !== 'ed25519' ||
    !crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' })
      .equals(publicKey.export({ type: 'spki', format: 'der' }))
  ) {
    throw new Error('Local human signer and public authority are mismatched.');
  }
  return Object.freeze({
    root,
    privateKeyPem,
    publicKeyPem,
    issuer,
    subjectId
  });
}

function writeExclusive(
  target,
  content,
  mode
) {
  const descriptor =
    fs.openSync(
      target,
      'wx',
      mode
    );

  try {
    fs.writeFileSync(
      descriptor,
      content,
      {
        encoding: 'utf8'
      }
    );

    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function provisionLocalOfflineHumanAuthority({
  authorityRoot,
  issuer,
  subjectId
} = {}) {
  const root =
    requireAbsolute(
      authorityRoot,
      'authorityRoot'
    );

  const normalizedIssuer =
    requireText(
      issuer,
      'issuer'
    );

  const normalizedSubject =
    requireText(
      subjectId,
      'subjectId'
    );

  ensureNoExistingAuthority(root);

  const parent =
    path.dirname(root);

  const parentStat =
    fs.lstatSync(parent);

  if (
    !parentStat.isDirectory() ||
    parentStat.isSymbolicLink()
  ) {
    throw new Error(
      'Authority parent must be a physical directory.'
    );
  }

  fs.mkdirSync(
    root,
    {
      mode: 0o700
    }
  );

  try {
    const pair =
      crypto.generateKeyPairSync(
        'ed25519'
      );

    const privateKeyPem =
      pair.privateKey.export({
        type: 'pkcs8',
        format: 'pem'
      });

    const publicKeyPem =
      pair.publicKey.export({
        type: 'spki',
        format: 'pem'
      });

    const privateKeyPath =
      path.join(
        root,
        'private-key.pem'
      );

    const publicKeyPath =
      path.join(
        root,
        'public-key.pem'
      );

    const metadataPath =
      path.join(
        root,
        'authority.json'
      );

    writeExclusive(
      privateKeyPath,
      privateKeyPem,
      0o600
    );

    writeExclusive(
      publicKeyPath,
      publicKeyPem,
      0o600
    );

    writeExclusive(
      metadataPath,
      JSON.stringify(
        {
          schema:
            'sdo.local_offline_human_authority.v1',
          issuer:
            normalizedIssuer,
          subjectId:
            normalizedSubject,
          algorithm:
            'Ed25519'
        },
        null,
        2
      ) + '\n',
      0o600
    );

    return Object.freeze({
      authorityRoot:
        fs.realpathSync(root),

      publicKeyPath:
        fs.realpathSync(publicKeyPath),

      metadataPath:
        fs.realpathSync(metadataPath),

      issuer:
        normalizedIssuer,

      subjectId:
        normalizedSubject,

      algorithm:
        'Ed25519'
    });
  } catch (error) {
    try {
      fs.rmSync(
        root,
        {
          recursive: true,
          force: true
        }
      );
    } catch {}

    throw error;
  }
}

function loadLocalOfflineHumanSigner({
  authorityRoot
} = {}) {
  const material = validatedAuthorityMaterial(authorityRoot);

  return createLocalOfflineHumanSigner({
    privateKeyPem: material.privateKeyPem,
    issuer: material.issuer,
    subjectId: material.subjectId
  });
}

function readLocalOfflineHumanPublicAuthority({
  authorityRoot
} = {}) {
  const material = validatedAuthorityMaterial(authorityRoot);

  return Object.freeze({
    publicKeyPem: material.publicKeyPem,
    issuer: material.issuer,
    subjectId: material.subjectId
  });
}

function validateLocalOfflineHumanAuthority({ authorityRoot } = {}) {
  const material = validatedAuthorityMaterial(authorityRoot);
  return Object.freeze({
    authorityRoot: material.root,
    issuer: material.issuer,
    subjectId: material.subjectId,
    algorithm: 'Ed25519'
  });
}

module.exports = Object.freeze({
  provisionLocalOfflineHumanAuthority,
  loadLocalOfflineHumanSigner,
  readLocalOfflineHumanPublicAuthority,
  validateLocalOfflineHumanAuthority
});
