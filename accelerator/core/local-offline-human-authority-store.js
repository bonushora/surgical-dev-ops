'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  createLocalOfflineHumanSigner
} = require(
  '../adapters/local-offline-human-signer'
);

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

  return physical;
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
      0o644
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
  const root =
    requirePhysicalAuthorityRoot(
      authorityRoot
    );

  const privateKeyPath =
    path.join(
      root,
      'private-key.pem'
    );

  const metadataPath =
    path.join(
      root,
      'authority.json'
    );

  for (const target of [
    privateKeyPath,
    metadataPath
  ]) {
    const item =
      fs.lstatSync(target);

    if (
      !item.isFile() ||
      item.isSymbolicLink()
    ) {
      throw new Error(
        'Authority storage contains unsafe files.'
      );
    }
  }

  const metadata =
    JSON.parse(
      fs.readFileSync(
        metadataPath,
        'utf8'
      )
    );

  if (
    !metadata ||
    metadata.schema !==
      'sdo.local_offline_human_authority.v1' ||
    metadata.algorithm !==
      'Ed25519'
  ) {
    throw new Error(
      'Authority metadata is malformed.'
    );
  }

  const privateKeyPem =
    fs.readFileSync(
      privateKeyPath,
      'utf8'
    );

  return createLocalOfflineHumanSigner({
    privateKeyPem,
    issuer:
      requireText(
        metadata.issuer,
        'metadata.issuer'
      ),
    subjectId:
      requireText(
        metadata.subjectId,
        'metadata.subjectId'
      )
  });
}

function readLocalOfflineHumanPublicAuthority({
  authorityRoot
} = {}) {
  const root =
    requirePhysicalAuthorityRoot(
      authorityRoot
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

  const publicStat =
    fs.lstatSync(publicKeyPath);

  const metadataStat =
    fs.lstatSync(metadataPath);

  if (
    !publicStat.isFile() ||
    publicStat.isSymbolicLink() ||
    !metadataStat.isFile() ||
    metadataStat.isSymbolicLink()
  ) {
    throw new Error(
      'Public authority storage is unsafe.'
    );
  }

  const metadata =
    JSON.parse(
      fs.readFileSync(
        metadataPath,
        'utf8'
      )
    );

  if (
    metadata.schema !==
      'sdo.local_offline_human_authority.v1' ||
    metadata.algorithm !==
      'Ed25519'
  ) {
    throw new Error(
      'Public authority metadata is malformed.'
    );
  }

  return Object.freeze({
    publicKeyPem:
      fs.readFileSync(
        publicKeyPath,
        'utf8'
      ),

    issuer:
      requireText(
        metadata.issuer,
        'metadata.issuer'
      ),

    subjectId:
      requireText(
        metadata.subjectId,
        'metadata.subjectId'
      )
  });
}

module.exports = Object.freeze({
  provisionLocalOfflineHumanAuthority,
  loadLocalOfflineHumanSigner,
  readLocalOfflineHumanPublicAuthority
});
