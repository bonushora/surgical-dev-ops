'use strict';

const crypto =
  require('node:crypto');

const fs =
  require('node:fs');

const path =
  require('node:path');

const childProcess =
  require('node:child_process');

const MANIFEST_SCHEMA =
  'sdo.content_addressed_manifest.v1';

const MATERIALIZATION_SCHEMA =
  'sdo.manifest_materialization_result.v1';

const REF_PREFIX =
  'refs/surgical-devops/workspace/';

function freeze(value) {
  if (
    value &&
    typeof value === 'object' &&
    !Object.isFrozen(value)
  ) {
    /*
     * Node.js Buffer and other typed-array views cannot be
     * Object.freeze()'d when they contain elements.
     *
     * Binary content is an internal materialization value,
     * never an exported authority surface. Treat it as an
     * opaque leaf while freezing the surrounding evidence.
     */
    if (ArrayBuffer.isView(value)) {
      return value;
    }

    for (
      const child
      of Object.values(value)
    ) {
      freeze(child);
    }

    Object.freeze(value);
  }

  return value;
}

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

function requireText(
  value,
  name
) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    throw new Error(
      `${name} is required.`
    );
  }

  return value.trim();
}

function validOid(value) {
  return (
    typeof value === 'string' &&
    (
      /^[a-f0-9]{40}$/.test(value) ||
      /^[a-f0-9]{64}$/.test(value)
    )
  );
}

function runGit(
  workspace,
  args,
  {
    allowFailure = false
  } = {}
) {
  const result =
    childProcess.spawnSync(
      'git',
      [
        '-C',
        workspace,
        ...args
      ],
      {
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
        maxBuffer:
          1024 * 1024,
        stdio: [
          'ignore',
          'pipe',
          'pipe'
        ]
      }
    );

  if (
    result.error ||
    (
      result.status !== 0 &&
      !allowFailure
    )
  ) {
    throw new Error(
      `Bounded Git materialization read failed: ${
        result.error
          ? result.error.message
          : String(
              result.stderr || ''
            ).trim()
      }`
    );
  }

  return {
    status:
      result.status,
    stdout:
      String(
        result.stdout || ''
      ),
    stderr:
      String(
        result.stderr || ''
      )
  };
}

function canonicalWorkspace(
  workspace
) {
  const requested =
    path.resolve(
      requireText(
        workspace,
        'workspace'
      )
    );

  const physical =
    fs.realpathSync(
      requested
    );

  if (
    !fs.statSync(
      physical
    ).isDirectory()
  ) {
    throw new Error(
      'Workspace must be a physical directory.'
    );
  }

  const root =
    runGit(
      physical,
      [
        'rev-parse',
        '--show-toplevel'
      ]
    ).stdout.trim();

  if (
    fs.realpathSync(root) !==
      physical
  ) {
    throw new Error(
      'Workspace must be the physical Git repository root.'
    );
  }

  return physical;
}

function relativeTarget(
  workspace,
  target
) {
  const absolute =
    path.resolve(
      requireText(
        target,
        'target'
      )
    );

  const relative =
    path.relative(
      workspace,
      absolute
    );

  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(
      `..${path.sep}`
    ) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      'Target must be inside the authorized workspace.'
    );
  }

  return relative
    .split(path.sep)
    .join('/');
}

function refFor(relative) {
  return (
    REF_PREFIX +
    sha256(relative)
  );
}

function readRef(
  workspace,
  ref
) {
  const result =
    runGit(
      workspace,
      [
        'rev-parse',
        '--verify',
        ref
      ],
      {
        allowFailure: true
      }
    );

  if (result.status !== 0) {
    return null;
  }

  const oid =
    result.stdout.trim();

  if (!validOid(oid)) {
    throw new Error(
      'Authoritative ref identity is malformed.'
    );
  }

  return oid;
}

function readBlob(
  workspace,
  oid
) {
  if (!validOid(oid)) {
    throw new Error(
      'Git object identity is malformed.'
    );
  }

  const type =
    runGit(
      workspace,
      [
        'cat-file',
        '-t',
        oid
      ]
    ).stdout.trim();

  if (type !== 'blob') {
    throw new Error(
      'Authoritative object is not a blob.'
    );
  }

  return Buffer.from(
    runGit(
      workspace,
      [
        'cat-file',
        'blob',
        oid
      ]
    ).stdout,
    'utf8'
  );
}

function parseManifest(
  workspace,
  manifestOid,
  expectedRelative
) {
  let value;

  try {
    value =
      JSON.parse(
        readBlob(
          workspace,
          manifestOid
        ).toString('utf8')
      );
  } catch {
    throw new Error(
      'Authoritative manifest is malformed.'
    );
  }

  if (
    !value ||
    value.schema !==
      MANIFEST_SCHEMA ||
    value.version !== 1 ||
    value.path !==
      expectedRelative ||
    !validOid(
      value.blobOid
    ) ||
    !/^[a-f0-9]{64}$/.test(
      value.contentSha256 || ''
    )
  ) {
    throw new Error(
      'Authoritative manifest is malformed or unbound.'
    );
  }

  const content =
    readBlob(
      workspace,
      value.blobOid
    );

  if (
    sha256(content) !==
      value.contentSha256
  ) {
    throw new Error(
      'Authoritative content does not match manifest SHA-256.'
    );
  }

  return freeze({
    manifestOid,
    path:
      value.path,
    blobOid:
      value.blobOid,
    contentSha256:
      value.contentSha256,
    content
  });
}

function gitDirectory(
  workspace
) {
  const gitDir =
    runGit(
      workspace,
      [
        'rev-parse',
        '--absolute-git-dir'
      ]
    ).stdout.trim();

  const physical =
    fs.realpathSync(
      gitDir
    );

  if (
    !fs.statSync(
      physical
    ).isDirectory()
  ) {
    throw new Error(
      'Git administrative directory is unavailable.'
    );
  }

  return physical;
}

function projectionPath(
  workspace,
  relative,
  manifestOid
) {
  const root =
    path.join(
      gitDirectory(workspace),
      'surgical-devops',
      'materialized',
      sha256(relative)
    );

  const file =
    path.join(
      root,
      `${manifestOid}.blob`
    );

  return {
    root,
    file
  };
}

function ensurePhysicalDirectory(
  directory
) {
  fs.mkdirSync(
    directory,
    {
      recursive: true,
      mode: 0o700
    }
  );

  const physical =
    fs.realpathSync(
      directory
    );

  if (
    physical !==
      path.resolve(directory) ||
    !fs.statSync(
      physical
    ).isDirectory()
  ) {
    throw new Error(
      'Managed projection directory is not a physical canonical directory.'
    );
  }

  return physical;
}

function verifyProjection(
  file,
  expectedSha256
) {
  let stat;

  try {
    stat =
      fs.lstatSync(file);
  } catch (error) {
    if (
      error &&
      error.code === 'ENOENT'
    ) {
      return {
        state: 'MISSING',
        sha256: null
      };
    }

    throw error;
  }

  if (
    stat.isSymbolicLink() ||
    !stat.isFile()
  ) {
    return {
      state: 'CORRUPT',
      sha256: null
    };
  }

  const content =
    fs.readFileSync(file);

  const observed =
    sha256(content);

  return {
    state:
      observed === expectedSha256
        ? 'MATCHED'
        : 'CORRUPT',
    sha256:
      observed
  };
}

function createImmutableProjection(
  directory,
  file,
  content,
  expectedSha256
) {
  ensurePhysicalDirectory(
    directory
  );

  let descriptor = null;

  try {
    descriptor =
      fs.openSync(
        file,
        'wx',
        0o600
      );

    fs.writeFileSync(
      descriptor,
      content
    );

    fs.fsyncSync(
      descriptor
    );
  } catch (error) {
    if (
      error &&
      error.code === 'EEXIST'
    ) {
      const existing =
        verifyProjection(
          file,
          expectedSha256
        );

      if (
        existing.state ===
          'MATCHED'
      ) {
        return 'CONVERGED';
      }

      throw new Error(
        'Existing managed projection is corrupt or conflicting.'
      );
    }

    throw error;
  } finally {
    if (descriptor !== null) {
      fs.closeSync(
        descriptor
      );
    }
  }

  const verified =
    verifyProjection(
      file,
      expectedSha256
    );

  if (
    verified.state !==
      'MATCHED'
  ) {
    throw new Error(
      'Managed projection cannot be verified after creation.'
    );
  }

  return 'CREATED';
}

function recoverAuthoritativeMaterialization({
  workspace,
  target,
  expectedManifestOid
}) {
  const root =
    canonicalWorkspace(
      workspace
    );

  const relative =
    relativeTarget(
      root,
      target
    );

  if (
    !validOid(
      expectedManifestOid
    )
  ) {
    throw new Error(
      'Expected authoritative manifest identity is malformed.'
    );
  }

  const ref =
    refFor(relative);

  const currentManifestOid =
    readRef(
      root,
      ref
    );

  if (
    currentManifestOid !==
      expectedManifestOid
  ) {
    return freeze({
      schema:
        MATERIALIZATION_SCHEMA,
      decision:
        'AUTHORITY_MISMATCH',
      workspace:
        root,
      relative,
      ref,
      expectedManifestOid,
      observedManifestOid:
        currentManifestOid,
      projection:
        null
    });
  }

  const manifest =
    parseManifest(
      root,
      currentManifestOid,
      relative
    );

  const projection =
    projectionPath(
      root,
      relative,
      currentManifestOid
    );

  const before =
    verifyProjection(
      projection.file,
      manifest.contentSha256
    );

  if (
    before.state ===
      'CORRUPT'
  ) {
    return freeze({
      schema:
        MATERIALIZATION_SCHEMA,
      decision:
        'RECOVERY_REQUIRED',
      reason:
        'Managed projection exists but is corrupt or conflicting.',
      workspace:
        root,
      relative,
      ref,
      expectedManifestOid,
      observedManifestOid:
        currentManifestOid,
      contentSha256:
        manifest.contentSha256,
      projection:
        projection.file
    });
  }

  if (
    before.state ===
      'MATCHED'
  ) {
    return freeze({
      schema:
        MATERIALIZATION_SCHEMA,
      decision:
        'ALREADY_MATERIALIZED',
      workspace:
        root,
      relative,
      ref,
      expectedManifestOid,
      observedManifestOid:
        currentManifestOid,
      contentSha256:
        manifest.contentSha256,
      projection:
        projection.file
    });
  }

  const creation =
    createImmutableProjection(
      projection.root,
      projection.file,
      manifest.content,
      manifest.contentSha256
    );

  const after =
    verifyProjection(
      projection.file,
      manifest.contentSha256
    );

  if (
    after.state !==
      'MATCHED'
  ) {
    return freeze({
      schema:
        MATERIALIZATION_SCHEMA,
      decision:
        'RECOVERY_REQUIRED',
      reason:
        'Managed projection creation is not durably verifiable.',
      workspace:
        root,
      relative,
      ref,
      expectedManifestOid,
      observedManifestOid:
        currentManifestOid,
      contentSha256:
        manifest.contentSha256,
      projection:
        projection.file
    });
  }

  return freeze({
    schema:
      MATERIALIZATION_SCHEMA,
    decision:
      creation === 'CREATED'
        ? 'MATERIALIZED'
        : 'ALREADY_MATERIALIZED',
    workspace:
      root,
    relative,
    ref,
    expectedManifestOid,
    observedManifestOid:
      currentManifestOid,
    contentSha256:
      manifest.contentSha256,
    projection:
      projection.file
  });
}

module.exports = {
  MATERIALIZATION_SCHEMA,
  recoverAuthoritativeMaterialization
};
