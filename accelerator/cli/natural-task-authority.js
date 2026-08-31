'use strict';

/*
 * NATURAL task-authority containment envelope.
 *
 * IMPORTANT:
 *
 * This is NOT an operational capability grant.
 * This module cannot dispatch anything.
 *
 * Its only purpose is to determine whether an untrusted
 * cognitive evidence request remains inside the bounds of
 * a previously authorized human task.
 *
 * Even a CONTAINED decision must still cross the canonical
 * Surgical DevOps capability/grant/Orchestrator boundaries
 * before any physical operation may occur.
 */

const crypto =
  require('node:crypto');

const path =
  require('node:path');

const {
  evidenceRequestToIntent
} = require(
  './natural-evidence-request'
);

const ENVELOPE_SCHEMA =
  'sdo.natural_task_authority_envelope.v1';

const EVALUATION_SCHEMA =
  'sdo.natural_task_authority_evaluation.v1';

const DECISIONS =
  Object.freeze([
    'CONTAINED',
    'REQUIRES_HUMAN_AUTHORITY'
  ]);

const TASK_PROFILES =
  Object.freeze({
    WORKSPACE_LIST:
      Object.freeze({
        evidenceKinds:
          Object.freeze([
            'WORKSPACE_FILES'
          ]),

        pathScope:
          'NONE',

        exactTargets:
          Object.freeze([]),

        maxEvidenceSteps:
          1
      }),

    READ_FILE:
      Object.freeze({
        evidenceKinds:
          Object.freeze([
            'READ_FILE'
          ]),

        pathScope:
          'EXACT_TARGET',

        maxEvidenceSteps:
          1
      }),

    READ_AND_EXPLAIN_FILE:
      Object.freeze({
        evidenceKinds:
          Object.freeze([
            'READ_FILE'
          ]),

        pathScope:
          'EXACT_TARGET',

        maxEvidenceSteps:
          1
      }),

    /*
     * PROJECT_ANALYSIS is exposed only through an explicit
     * human-authorized recursive evidence task. The envelope
     * contains microreads, but never dispatch authority.
     */
    PROJECT_ANALYSIS:
      Object.freeze({
        evidenceKinds:
          Object.freeze([
            'WORKSPACE_FILES',
            'READ_FILE',
            'VALIDATE_JS'
          ]),

        pathScope:
          'WORKSPACE_DESCENDANTS',

        exactTargets:
          Object.freeze([]),

        maxEvidenceSteps:
          8
      })
  });

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

function canonicalWorkspaceRoot(
  value
) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    throw new Error(
      'Canonical absolute task workspace root is required.'
    );
  }

  const trimmed =
    value.trim();

  if (
    !path.isAbsolute(trimmed) ||
    path.normalize(trimmed) !==
      trimmed
  ) {
    throw new Error(
      'Task workspace root must be canonical and absolute.'
    );
  }

  return trimmed;
}

function normalizeRelativeTarget(
  value
) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    throw new Error(
      'Evidence target must be one explicit relative path.'
    );
  }

  const target =
    value.trim();

  if (
    target.length > 1024 ||
    target.includes('\0') ||
    /[\r\n]/.test(target)
  ) {
    throw new Error(
      'Evidence target is malformed.'
    );
  }

  if (
    path.posix.isAbsolute(target) ||
    path.win32.isAbsolute(target)
  ) {
    throw new Error(
      'Absolute evidence targets are outside task authority.'
    );
  }

  const portable =
    target.replace(/\\/g, '/');

  const parts =
    portable.split('/');

  if (
    parts.length === 0 ||
    parts.some(
      (part) =>
        !part ||
        part === '.' ||
        part === '..'
    )
  ) {
    throw new Error(
      'Evidence target is non-canonical or traverses scope.'
    );
  }

  const normalized =
    path.posix.normalize(
      portable
    );

  if (
    normalized !== portable ||
    normalized === '.' ||
    normalized.startsWith('../') ||
    normalized.includes('/../')
  ) {
    throw new Error(
      'Evidence target is outside canonical task scope.'
    );
  }

  return normalized;
}

function canonicalTaskBinding(
  task,
  workspaceRoot,
  profile
) {
  const binding = {
    schema:
      'sdo.natural_task_authority_binding.v1',

    taskSchema:
      task.schema,

    taskKind:
      task.kind,

    objective:
      task.objective,

    workspaceRoot,

    mutating:
      task.mutating,

    evidenceKinds:
      [...profile.evidenceKinds],

    pathScope:
      profile.pathScope,

    exactTargets:
      (
        profile.pathScope ===
          'EXACT_TARGET'
          ? [
              normalizeRelativeTarget(
                task.target
              )
            ]
          : []
      ),

    maxEvidenceSteps:
      profile.maxEvidenceSteps
  };

  return binding;
}

function fingerprintBinding(
  binding
) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify(binding),
      'utf8'
    )
    .digest('hex');
}

function createNaturalTaskAuthorityEnvelope(
  {
    task,
    workspaceRoot
  } = {}
) {
  if (
    !task ||
    typeof task !== 'object' ||
    task.schema !==
      'sdo.natural_governed_task.v1' ||
    Object.isFrozen(task) !== true
  ) {
    throw new Error(
      'Immutable canonical NATURAL governed task is required.'
    );
  }

  if (
    task.mutating !== false
  ) {
    throw new Error(
      'Recursive evidence authority must remain non-mutating.'
    );
  }

  if (
    typeof task.objective !== 'string' ||
    !task.objective.trim()
  ) {
    throw new Error(
      'Governed task objective is required.'
    );
  }

  const profile =
    TASK_PROFILES[
      task.kind
    ];

  if (!profile) {
    throw new Error(
      'NATURAL task kind has no qualified authority profile.'
    );
  }

  const root =
    canonicalWorkspaceRoot(
      workspaceRoot
    );

  const binding =
    canonicalTaskBinding(
      task,
      root,
      profile
    );

  const fingerprint =
    fingerprintBinding(
      binding
    );

  return deepFreeze({
    schema:
      ENVELOPE_SCHEMA,

    taskKind:
      binding.taskKind,

    objective:
      binding.objective,

    workspaceRoot:
      binding.workspaceRoot,

    mutating:
      false,

    operationalAuthority:
      false,

    grantAuthority:
      false,

    mutationAuthority:
      false,

    authority: {
      evidenceKinds:
        binding.evidenceKinds,

      pathScope:
        binding.pathScope,

      exactTargets:
        binding.exactTargets,

      maxEvidenceSteps:
        binding.maxEvidenceSteps
    },

    bindingFingerprint:
      fingerprint
  });
}

function deny(
  envelope,
  reason
) {
  return deepFreeze({
    schema:
      EVALUATION_SCHEMA,

    decision:
      'REQUIRES_HUMAN_AUTHORITY',

    reason,

    envelopeFingerprint:
      envelope.bindingFingerprint,

    governedIntent:
      null,

    operationalAuthority:
      false
  });
}

function contained(
  envelope,
  intent
) {
  return deepFreeze({
    schema:
      EVALUATION_SCHEMA,

    decision:
      'CONTAINED',

    reason:
      'Evidence request remains inside the authorized task envelope.',

    envelopeFingerprint:
      envelope.bindingFingerprint,

    governedIntent:
      intent,

    operationalAuthority:
      false
  });
}

function evaluateNaturalEvidenceRequest(
  envelope,
  evidenceRequest,
  {
    evidenceStep = 0
  } = {}
) {
  if (
    !envelope ||
    typeof envelope !== 'object' ||
    envelope.schema !==
      ENVELOPE_SCHEMA ||
    Object.isFrozen(envelope) !== true
  ) {
    throw new Error(
      'Immutable canonical task authority envelope is required.'
    );
  }

  if (
    !evidenceRequest ||
    typeof evidenceRequest !== 'object' ||
    Object.isFrozen(evidenceRequest) !== true
  ) {
    throw new Error(
      'Immutable canonical cognitive evidence request is required.'
    );
  }

  if (
    !Number.isInteger(evidenceStep) ||
    evidenceStep < 0
  ) {
    throw new Error(
      'Evidence step must be a non-negative integer.'
    );
  }

  if (
    evidenceStep >=
      envelope.authority.maxEvidenceSteps
  ) {
    return deny(
      envelope,
      'Authorized evidence-step bound has been reached.'
    );
  }

  const kind =
    evidenceRequest.kind;

  if (
    !envelope.authority
      .evidenceKinds
      .includes(kind)
  ) {
    return deny(
      envelope,
      'Requested evidence kind is outside the authorized task.'
    );
  }

  if (
    kind ===
      'WORKSPACE_FILES'
  ) {
    if (
      evidenceRequest.target !==
        null
    ) {
      return deny(
        envelope,
        'Workspace inventory cannot expand path authority.'
      );
    }

    return contained(
      envelope,
      evidenceRequestToIntent(
        evidenceRequest
      )
    );
  }

  let target;

  try {
    target =
      normalizeRelativeTarget(
        evidenceRequest.target
      );
  } catch {
    return deny(
      envelope,
      'Requested target is outside canonical workspace-relative scope.'
    );
  }

  if (
    envelope.authority.pathScope ===
      'NONE'
  ) {
    return deny(
      envelope,
      'This task contains no file-target authority.'
    );
  }

  if (
    envelope.authority.pathScope ===
      'EXACT_TARGET' &&
    !envelope.authority
      .exactTargets
      .includes(target)
  ) {
    return deny(
      envelope,
      'Requested file differs from the exact human-authorized target.'
    );
  }

  if (
    envelope.authority.pathScope !==
      'EXACT_TARGET' &&
    envelope.authority.pathScope !==
      'WORKSPACE_DESCENDANTS'
  ) {
    return deny(
      envelope,
      'Task path-scope semantics are unqualified.'
    );
  }

  if (
    kind ===
      'VALIDATE_JS' &&
    !/\.(?:js|cjs|mjs)$/i.test(
      target
    )
  ) {
    return deny(
      envelope,
      'JavaScript validation authority is limited to JavaScript targets.'
    );
  }

  const canonicalRequest =
    deepFreeze({
      kind,
      target,
      reason:
        evidenceRequest.reason
    });

  return contained(
    envelope,
    evidenceRequestToIntent(
      canonicalRequest
    )
  );
}

module.exports =
  Object.freeze({
    DECISIONS,
    TASK_PROFILES,
    createNaturalTaskAuthorityEnvelope,
    evaluateNaturalEvidenceRequest
  });
