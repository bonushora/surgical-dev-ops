'use strict';

/*
 * Materializes one untrusted cognitive patch proposal into a bounded,
 * immutable data contract.
 *
 * This module deliberately owns no filesystem, Git, process, shell,
 * provider, capability, grant, approval or mutation authority.
 */

const crypto = require('node:crypto');
const path = require('node:path');

const INPUT_SCHEMA =
  'sdo.ai_engineering_patch_proposal.v1';

const OUTPUT_SCHEMA =
  'sdo.governed_engineering_proposal.v1';

const MAX_REPLACEMENT_BYTES =
  256 * 1024;

const VALIDATION_KINDS =
  Object.freeze([
    'NONE',
    'VALIDATE_JS'
  ]);

function deepFreeze(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function exactKeys(value, expected) {
  const actual =
    Object.keys(value).sort();

  const canonical =
    [...expected].sort();

  if (
    actual.length !== canonical.length ||
    actual.some(
      (key, index) =>
        key !== canonical[index]
    )
  ) {
    throw new Error(
      'Engineering proposal shape is not canonical.'
    );
  }
}

function boundedText(
  value,
  label,
  maxLength
) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > maxLength ||
    value.includes('\0')
  ) {
    throw new Error(
      `${label} is malformed.`
    );
  }

  return value.trim();
}

function canonicalTarget(value) {
  const target =
    boundedText(
      value,
      'Engineering proposal target',
      1024
    );

  if (
    /[\r\n]/.test(target) ||
    path.posix.isAbsolute(target) ||
    path.win32.isAbsolute(target)
  ) {
    throw new Error(
      'Engineering proposal target must be one relative path.'
    );
  }

  const portable =
    target.replace(/\\/g, '/');

  const parts =
    portable.split('/');

  if (
    parts.some(
      (part) =>
        !part ||
        part === '.' ||
        part === '..'
    ) ||
    path.posix.normalize(portable) !== portable
  ) {
    throw new Error(
      'Engineering proposal target is non-canonical or traverses scope.'
    );
  }

  return portable;
}

function canonicalSha256(value) {
  if (
    typeof value !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value)
  ) {
    throw new Error(
      'Engineering proposal BEFORE SHA-256 is malformed.'
    );
  }

  return value;
}

function canonicalBase64(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value
    )
  ) {
    throw new Error(
      'Engineering proposal replacement Base64 is malformed.'
    );
  }

  const replacement =
    Buffer.from(value, 'base64');

  if (
    replacement.length === 0 ||
    replacement.length >
      MAX_REPLACEMENT_BYTES ||
    replacement.toString('base64') !== value
  ) {
    throw new Error(
      'Engineering proposal replacement is outside the bounded contract.'
    );
  }

  return replacement;
}

function materializeGovernedEngineeringProposal(
  input
) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error(
      'Untrusted AI engineering proposal is required.'
    );
  }

  exactKeys(
    input,
    [
      'schema',
      'objective',
      'target',
      'beforeSha256',
      'replacementBase64',
      'reason',
      'validationKind'
    ]
  );

  if (input.schema !== INPUT_SCHEMA) {
    throw new Error(
      'AI engineering proposal schema is not supported.'
    );
  }

  const objective =
    boundedText(
      input.objective,
      'Engineering objective',
      4096
    );

  const target =
    canonicalTarget(
      input.target
    );

  const beforeSha256 =
    canonicalSha256(
      input.beforeSha256
    );

  const replacement =
    canonicalBase64(
      input.replacementBase64
    );

  const reason =
    boundedText(
      input.reason,
      'Engineering proposal reason',
      4096
    );

  if (
    !VALIDATION_KINDS.includes(
      input.validationKind
    )
  ) {
    throw new Error(
      'Engineering proposal validation kind is not supported.'
    );
  }

  if (
    input.validationKind ===
      'VALIDATE_JS' &&
    !target.endsWith('.js')
  ) {
    throw new Error(
      'JavaScript validation requires an explicit .js target.'
    );
  }

  return deepFreeze({
    schema:
      OUTPUT_SCHEMA,

    objective,

    target,

    beforeSha256,

    replacementBase64:
      input.replacementBase64,

    replacementBytes:
      replacement.length,

    replacementSha256:
      crypto
        .createHash('sha256')
        .update(replacement)
        .digest('hex'),

    reason,

    validationKind:
      input.validationKind,

    operationalAuthority:
      false,

    mutationAuthority:
      false,

    approvalAuthority:
      false
  });
}

module.exports =
  Object.freeze({
    MAX_REPLACEMENT_BYTES,
    VALIDATION_KINDS,
    materializeGovernedEngineeringProposal
  });
