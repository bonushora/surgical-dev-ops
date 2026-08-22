'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const MANIFEST_SCHEMA = 'sdo.content_addressed_manifest.v1';
const RESULT_SCHEMA = 'sdo.manifest_cas_result.v1';
const REF_PREFIX = 'refs/surgical-devops/workspace/';

function freeze(value) {
  if (
    value &&
    typeof value === 'object' &&
    !Object.isFrozen(value)
  ) {
    for (const child of Object.values(value)) {
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

function requireText(value, name) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function runGit(
  workspace,
  args,
  {
    input = undefined,
    allowFailure = false
  } = {}
) {
  const result = childProcess.spawnSync(
    'git',
    [
      '-C',
      workspace,
      ...args
    ],
    {
      input,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      stdio: [
        input === undefined ? 'ignore' : 'pipe',
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
      `Bounded Git authority command failed: ${
        result.error
          ? result.error.message
          : String(result.stderr || '').trim()
      }`
    );
  }

  return {
    status: result.status,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || '')
  };
}

function canonicalWorkspace(workspace) {
  const requested =
    path.resolve(
      requireText(workspace, 'workspace')
    );

  const physical =
    fs.realpathSync(requested);

  if (
    !fs.statSync(physical).isDirectory()
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

  const physicalRoot =
    fs.realpathSync(root);

  if (physicalRoot !== physical) {
    throw new Error(
      'Workspace must be the physical Git repository root.'
    );
  }

  return physical;
}

function relativeTarget(workspace, target) {
  const absolute =
    path.resolve(
      requireText(target, 'target')
    );

  const relative =
    path.relative(
      workspace,
      absolute
    );

  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
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

function objectFormat(workspace) {
  const format =
    runGit(
      workspace,
      [
        'rev-parse',
        '--show-object-format'
      ]
    ).stdout.trim();

  if (
    format !== 'sha1' &&
    format !== 'sha256'
  ) {
    throw new Error(
      'Unsupported Git object format.'
    );
  }

  return format;
}

function zeroOid(workspace) {
  return objectFormat(workspace) === 'sha256'
    ? '0'.repeat(64)
    : '0'.repeat(40);
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

function hashObject(workspace, bytes) {
  const oid =
    runGit(
      workspace,
      [
        'hash-object',
        '-w',
        '--stdin'
      ],
      {
        input:
          Buffer.isBuffer(bytes)
            ? bytes
            : Buffer.from(bytes)
      }
    ).stdout.trim();

  if (!validOid(oid)) {
    throw new Error(
      'Git returned malformed object identity.'
    );
  }

  return oid;
}

function readObject(workspace, oid) {
  if (!validOid(oid)) {
    throw new Error(
      'Object identity is malformed.'
    );
  }

  return runGit(
    workspace,
    [
      'cat-file',
      'blob',
      oid
    ]
  ).stdout;
}

function readRef(workspace, ref) {
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
      'Authoritative ref contains malformed object identity.'
    );
  }

  return oid;
}

function manifestBytes({
  relative,
  blobOid,
  contentSha256
}) {
  if (
    !validOid(blobOid) ||
    !/^[a-f0-9]{64}$/.test(contentSha256)
  ) {
    throw new Error(
      'Manifest content identity is malformed.'
    );
  }

  return Buffer.from(
    JSON.stringify({
      schema: MANIFEST_SCHEMA,
      version: 1,
      path: relative,
      blobOid,
      contentSha256
    }) + '\n',
    'utf8'
  );
}

function parseManifest(
  workspace,
  oid,
  expectedRelative = null
) {
  let value;

  try {
    value =
      JSON.parse(
        readObject(workspace, oid)
      );
  } catch {
    throw new Error(
      'Authoritative manifest is malformed.'
    );
  }

  if (
    !value ||
    value.schema !== MANIFEST_SCHEMA ||
    value.version !== 1 ||
    typeof value.path !== 'string' ||
    !value.path ||
    !validOid(value.blobOid) ||
    !/^[a-f0-9]{64}$/.test(
      value.contentSha256 || ''
    ) ||
    (
      expectedRelative !== null &&
      value.path !== expectedRelative
    )
  ) {
    throw new Error(
      'Authoritative manifest is malformed or unbound.'
    );
  }

  const blob =
    Buffer.from(
      readObject(
        workspace,
        value.blobOid
      ),
      'utf8'
    );

  if (
    sha256(blob) !==
      value.contentSha256
  ) {
    throw new Error(
      'Manifest content object hash binding is invalid.'
    );
  }

  return freeze({
    oid,
    ...value
  });
}

function createManifest(
  workspace,
  relative,
  bytes
) {
  const content =
    Buffer.isBuffer(bytes)
      ? bytes
      : Buffer.from(bytes);

  const contentSha256 =
    sha256(content);

  const blobOid =
    hashObject(
      workspace,
      content
    );

  const manifestOid =
    hashObject(
      workspace,
      manifestBytes({
        relative,
        blobOid,
        contentSha256
      })
    );

  return freeze({
    manifestOid,
    blobOid,
    contentSha256,
    relative
  });
}

function createRefCas(
  workspace,
  ref,
  newOid,
  expectedOldOid
) {
  const result =
    runGit(
      workspace,
      [
        'update-ref',
        ref,
        newOid,
        expectedOldOid
      ],
      {
        allowFailure: true
      }
    );

  if (result.status === 0) {
    return true;
  }

  const current =
    readRef(
      workspace,
      ref
    );

  if (current !== expectedOldOid) {
    return false;
  }

  throw new Error(
    'Git ref CAS failed without a competing authority change.'
  );
}

function bootstrapManifestAuthority({
  workspace,
  target,
  expectedBeforeSha256
}) {
  const root =
    canonicalWorkspace(workspace);

  const relative =
    relativeTarget(
      root,
      target
    );

  if (
    !/^[a-f0-9]{64}$/.test(
      expectedBeforeSha256 || ''
    )
  ) {
    throw new Error(
      'Expected BEFORE SHA-256 is malformed.'
    );
  }

  const canonicalTarget =
    fs.realpathSync(
      path.join(
        root,
        relative
      )
    );

  if (
    !fs.statSync(
      canonicalTarget
    ).isFile()
  ) {
    throw new Error(
      'Bootstrap target must be an existing regular file.'
    );
  }

  const before =
    fs.readFileSync(
      canonicalTarget
    );

  if (
    sha256(before) !==
      expectedBeforeSha256
  ) {
    throw new Error(
      'Physical bootstrap state does not match authorized BEFORE hash.'
    );
  }

  const ref =
    refFor(relative);

  const existing =
    readRef(
      root,
      ref
    );

  if (existing) {
    const manifest =
      parseManifest(
        root,
        existing,
        relative
      );

    if (
      manifest.contentSha256 !==
        expectedBeforeSha256
    ) {
      throw new Error(
        'Existing authoritative manifest conflicts with authorized BEFORE state.'
      );
    }

    return freeze({
      schema: RESULT_SCHEMA,
      decision: 'EXISTING',
      workspace: root,
      target: canonicalTarget,
      relative,
      ref,
      manifestOid: existing,
      contentSha256:
        manifest.contentSha256
    });
  }

  const created =
    createManifest(
      root,
      relative,
      before
    );

  if (
    created.contentSha256 !==
      expectedBeforeSha256
  ) {
    throw new Error(
      'Bootstrap manifest does not bind authorized BEFORE state.'
    );
  }

  const won =
    createRefCas(
      root,
      ref,
      created.manifestOid,
      zeroOid(root)
    );

  if (!won) {
    const current =
      readRef(root, ref);

    const manifest =
      parseManifest(
        root,
        current,
        relative
      );

    if (
      manifest.contentSha256 !==
        expectedBeforeSha256
    ) {
      throw new Error(
        'Concurrent bootstrap established a conflicting authority.'
      );
    }

    return freeze({
      schema: RESULT_SCHEMA,
      decision: 'CONVERGED',
      workspace: root,
      target: canonicalTarget,
      relative,
      ref,
      manifestOid: current,
      contentSha256:
        manifest.contentSha256
    });
  }

  return freeze({
    schema: RESULT_SCHEMA,
    decision: 'CREATED',
    workspace: root,
    target: canonicalTarget,
    relative,
    ref,
    manifestOid:
      created.manifestOid,
    contentSha256:
      created.contentSha256
  });
}

function compareAndSwapManifest({
  workspace,
  target,
  expectedManifestOid,
  expectedBeforeSha256,
  replacement
}) {
  const root =
    canonicalWorkspace(workspace);

  const relative =
    relativeTarget(
      root,
      target
    );

  if (
    !validOid(expectedManifestOid) ||
    !/^[a-f0-9]{64}$/.test(
      expectedBeforeSha256 || ''
    ) ||
    !(
      typeof replacement === 'string' ||
      Buffer.isBuffer(replacement)
    )
  ) {
    throw new Error(
      'Manifest CAS request is malformed.'
    );
  }

  const ref =
    refFor(relative);

  const current =
    readRef(root, ref);

  if (current !== expectedManifestOid) {
    return freeze({
      schema: RESULT_SCHEMA,
      decision: 'MISMATCH',
      workspace: root,
      relative,
      ref,
      expectedManifestOid,
      observedManifestOid:
        current
    });
  }

  const before =
    parseManifest(
      root,
      current,
      relative
    );

  if (
    before.contentSha256 !==
      expectedBeforeSha256
  ) {
    throw new Error(
      'Expected manifest does not bind authorized BEFORE state.'
    );
  }

  const created =
    createManifest(
      root,
      relative,
      replacement
    );

  const won =
    createRefCas(
      root,
      ref,
      created.manifestOid,
      expectedManifestOid
    );

  if (!won) {
    return freeze({
      schema: RESULT_SCHEMA,
      decision: 'MISMATCH',
      workspace: root,
      relative,
      ref,
      expectedManifestOid,
      observedManifestOid:
        readRef(root, ref)
    });
  }

  const confirmed =
    readRef(root, ref);

  if (
    confirmed !==
      created.manifestOid
  ) {
    throw new Error(
      'Authoritative CAS result cannot be confirmed.'
    );
  }

  const manifest =
    parseManifest(
      root,
      confirmed,
      relative
    );

  if (
    manifest.contentSha256 !==
      created.contentSha256
  ) {
    throw new Error(
      'Committed manifest does not bind replacement content.'
    );
  }

  return freeze({
    schema: RESULT_SCHEMA,
    decision: 'APPLIED',
    workspace: root,
    relative,
    ref,
    beforeManifestOid:
      expectedManifestOid,
    afterManifestOid:
      created.manifestOid,
    beforeSha256:
      expectedBeforeSha256,
    replacementSha256:
      created.contentSha256,
    replacementBlobOid:
      created.blobOid
  });
}

module.exports = {
  MANIFEST_SCHEMA,
  RESULT_SCHEMA,
  bootstrapManifestAuthority,
  compareAndSwapManifest
};
