'use strict';

/*
 * Read-only observation of one logical target's current governed state.
 *
 * This boundary may inspect only deterministic Git refs/objects and an
 * already-existing managed projection. It cannot create materializations,
 * update refs, perform CAS, authorize, dispatch or mutate.
 */

const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  openVerifiedRegularRead
} = require('../adapters/filesystem-safe-read-adapter');
const {
  canonicalizeAuthorizedRoot,
  samePhysicalWorkspaceIdentity,
  resolveInspectedFile
} = require('./workspace-boundary');

const OBSERVATION_SCHEMA =
  'sdo.authoritative_target_observation.v1';
const MANIFEST_SCHEMA =
  'sdo.content_addressed_manifest.v1';
const REF_PREFIX =
  'refs/surgical-devops/workspace/';
const MAX_CONTENT_BYTES = 256 * 1024;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function requireText(value, label) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value !== value.trim() ||
    value.includes('\0')
  ) {
    throw new Error(`${label} is malformed.`);
  }
  return value;
}

function validOid(value) {
  return (
    typeof value === 'string' &&
    (/^[a-f0-9]{40}$/.test(value) || /^[a-f0-9]{64}$/.test(value))
  );
}

function runGit(workspace, args) {
  const result = childProcess.spawnSync(
    'git',
    ['-C', workspace, ...args],
    {
      shell: false,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
  if (result.error) {
    throw new Error('Authoritative Git observation failed safely.');
  }
  if (result.status !== 0) {
    throw new Error('Authoritative Git observation failed safely.');
  }
  return Buffer.from(result.stdout || Buffer.alloc(0));
}

function canonicalWorkspace(workspace) {
  const root = canonicalizeAuthorizedRoot(
    requireText(workspace, 'Authoritative workspace')
  );
  const gitMarker = path.join(root, '.git');
  let marker;
  try {
    marker = fs.lstatSync(gitMarker);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { root, gitBacked: false };
    }
    throw new Error('Authoritative Git boundary is unavailable or unsafe.');
  }
  if (
    marker.isSymbolicLink() ||
    (!marker.isDirectory() && !marker.isFile())
  ) {
    throw new Error('Authoritative Git boundary is unavailable or unsafe.');
  }
  const gitRoot = runGit(root, ['rev-parse', '--show-toplevel'])
    .toString('utf8').trim();
  const physicalGitRoot = fs.realpathSync(gitRoot);
  if (!samePhysicalWorkspaceIdentity(physicalGitRoot, root)) {
    throw new Error('Authoritative workspace is not the physical Git root.');
  }
  return { root, gitBacked: true };
}

function logicalTarget(root, target) {
  const requested = requireText(target, 'Authoritative logical target');
  if (
    path.posix.isAbsolute(requested) ||
    path.win32.isAbsolute(requested) ||
    requested.includes('\\')
  ) {
    throw new Error('Authoritative logical target is not canonical.');
  }
  const resolved = resolveInspectedFile(root, requested);
  const relative = path.relative(root, resolved.canonicalTarget)
    .split(path.sep).join('/');
  if (
    relative !== requested ||
    !relative ||
    relative === '..' ||
    relative.startsWith('../')
  ) {
    throw new Error('Authoritative logical target is not canonical.');
  }
  return { relative, ordinaryPath: resolved.canonicalTarget };
}

function readRegular(file, label) {
  let opened;
  try {
    opened = openVerifiedRegularRead(file, {
      maxBytes: MAX_CONTENT_BYTES
    });
    const content = fs.readFileSync(opened.descriptor);
    if (content.byteLength > MAX_CONTENT_BYTES) {
      throw new Error(`${label} exceeds the bounded read contract.`);
    }
    return content;
  } catch (error) {
    if (error && /bounded read contract/.test(error.message || '')) {
      throw error;
    }
    throw new Error(`${label} is unavailable or unsafe.`);
  } finally {
    if (opened) fs.closeSync(opened.descriptor);
  }
}

function objectFormat(workspace) {
  const format = runGit(workspace, ['rev-parse', '--show-object-format'])
    .toString('utf8').trim();
  if (!['sha1', 'sha256'].includes(format)) {
    throw new Error('Authoritative Git object format is unsupported.');
  }
  return format;
}

function gitObjectOid(format, type, content) {
  return crypto.createHash(format)
    .update(Buffer.from(`${type} ${content.byteLength}\0`, 'utf8'))
    .update(content)
    .digest('hex');
}

function readVerifiedBlob(workspace, oid, format, label) {
  if (!validOid(oid)) {
    throw new Error(`${label} identity is malformed.`);
  }
  const type = runGit(workspace, ['cat-file', '-t', oid])
    .toString('utf8').trim();
  if (type !== 'blob') {
    throw new Error(`${label} is not a Git blob.`);
  }
  const content = runGit(workspace, ['cat-file', 'blob', oid]);
  if (content.byteLength > MAX_CONTENT_BYTES) {
    throw new Error(`${label} exceeds the bounded read contract.`);
  }
  if (gitObjectOid(format, 'blob', content) !== oid) {
    throw new Error(`${label} object identity mismatch.`);
  }
  return content;
}

function parseManifest(workspace, manifestOid, format, expectedTarget) {
  const bytes = readVerifiedBlob(
    workspace,
    manifestOid,
    format,
    'Authoritative manifest'
  );
  let manifest;
  try {
    manifest = JSON.parse(canonicalUtf8(bytes, 'Authoritative manifest'));
  } catch {
    throw new Error('Authoritative manifest is malformed.');
  }
  const manifestKeys = manifest && typeof manifest === 'object'
    ? Object.keys(manifest).sort()
    : [];
  if (
    !manifest ||
    typeof manifest !== 'object' ||
    Array.isArray(manifest) ||
    manifestKeys.join('\0') !== [
      'blobOid',
      'contentSha256',
      'path',
      'schema',
      'version'
    ].join('\0') ||
    manifest.schema !== MANIFEST_SCHEMA ||
    manifest.version !== 1 ||
    manifest.path !== expectedTarget ||
    !validOid(manifest.blobOid) ||
    !/^[a-f0-9]{64}$/.test(manifest.contentSha256 || '')
  ) {
    throw new Error('Authoritative manifest is malformed or unbound.');
  }
  const content = readVerifiedBlob(
    workspace,
    manifest.blobOid,
    format,
    'Authoritative content'
  );
  if (sha256(content) !== manifest.contentSha256) {
    throw new Error('Authoritative content SHA-256 mismatch.');
  }
  return { manifest, content };
}

function gitDirectory(workspace) {
  const gitDir = runGit(workspace, ['rev-parse', '--absolute-git-dir'])
    .toString('utf8').trim();
  const physical = fs.realpathSync(gitDir);
  if (!fs.statSync(physical).isDirectory()) {
    throw new Error('Git administrative directory is unavailable.');
  }
  return physical;
}

function readTargetRef(workspace, gitDir, ref) {
  const looseRef = path.join(gitDir, ...ref.split('/'));
  let metadata = null;
  try {
    metadata = fs.lstatSync(looseRef);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      throw new Error('Authoritative target ref is unavailable or unsafe.');
    }
  }
  if (metadata) {
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error('Authoritative target ref is unavailable or unsafe.');
    }
    const refText = canonicalUtf8(
      readRegular(looseRef, 'Authoritative target ref'),
      'Authoritative target ref'
    );
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})\n?$/.test(refText)) {
      throw new Error('Authoritative target ref identity is malformed.');
    }
    return refText.trim();
  }

  const packed = runGit(
    workspace,
    ['for-each-ref', '--format=%(objectname)', ref]
  ).toString('utf8').trim();
  if (!packed) return null;
  if (packed.includes('\n') || !validOid(packed)) {
    throw new Error('Authoritative target ref identity is malformed.');
  }
  return packed;
}

function canonicalUtf8(content, label) {
  const text = content.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(content)) {
    throw new Error(`${label} is not canonical UTF-8.`);
  }
  return text;
}

function observeCurrentAuthoritativeTarget({ workspace, target } = {}) {
  const workspaceObservation = canonicalWorkspace(workspace);
  const { root } = workspaceObservation;
  const logical = logicalTarget(root, target);
  const ref = REF_PREFIX + sha256(logical.relative);
  if (!workspaceObservation.gitBacked) {
    const content = readRegular(
      logical.ordinaryPath,
      'Ordinary bootstrap source'
    );
    return deepFreeze({
      schema: OBSERVATION_SCHEMA,
      source: 'ORDINARY_BOOTSTRAP',
      workspace: root,
      logicalTarget: logical.relative,
      ordinaryPath: logical.ordinaryPath,
      ref,
      currentSha256: sha256(content),
      currentBytes: content.byteLength,
      currentContent: canonicalUtf8(content, 'Ordinary bootstrap source'),
      operationalAuthority: false,
      mutationAuthority: false,
      dispatchAuthority: false
    });
  }
  const gitDir = gitDirectory(root);
  const manifestOid = readTargetRef(root, gitDir, ref);

  if (manifestOid === null) {
    const content = readRegular(
      logical.ordinaryPath,
      'Ordinary bootstrap source'
    );
    return deepFreeze({
      schema: OBSERVATION_SCHEMA,
      source: 'ORDINARY_BOOTSTRAP',
      workspace: root,
      logicalTarget: logical.relative,
      ordinaryPath: logical.ordinaryPath,
      ref,
      currentSha256: sha256(content),
      currentBytes: content.byteLength,
      currentContent: canonicalUtf8(content, 'Ordinary bootstrap source'),
      operationalAuthority: false,
      mutationAuthority: false,
      dispatchAuthority: false
    });
  }

  const format = objectFormat(root);
  const { manifest, content } = parseManifest(
    root,
    manifestOid,
    format,
    logical.relative
  );
  const managedProjection = path.join(
    gitDir,
    'surgical-devops',
    'materialized',
    sha256(logical.relative),
    `${manifestOid}.blob`
  );
  let physicalProjection;
  try {
    physicalProjection = fs.realpathSync(managedProjection);
  } catch {
    throw new Error('Managed authoritative projection is unavailable or unsafe.');
  }
  if (physicalProjection !== path.resolve(managedProjection)) {
    throw new Error('Managed authoritative projection identity mismatch.');
  }
  const projection = readRegular(
    physicalProjection,
    'Managed authoritative projection'
  );
  if (
    sha256(projection) !== manifest.contentSha256 ||
    !projection.equals(content)
  ) {
    throw new Error('Managed authoritative projection identity mismatch.');
  }

  return deepFreeze({
    schema: OBSERVATION_SCHEMA,
    source: 'MANIFEST_CAS',
    workspace: root,
    logicalTarget: logical.relative,
    ordinaryPath: logical.ordinaryPath,
    ref,
    currentSha256: manifest.contentSha256,
    currentBytes: content.byteLength,
    currentContent: canonicalUtf8(content, 'Authoritative content'),
    manifestOid,
    blobOid: manifest.blobOid,
    managedProjection,
    ordinaryWorktreeAuthoritative: false,
    operationalAuthority: false,
    mutationAuthority: false,
    dispatchAuthority: false
  });
}

module.exports = Object.freeze({
  OBSERVATION_SCHEMA,
  MAX_CONTENT_BYTES,
  observeCurrentAuthoritativeTarget
});
