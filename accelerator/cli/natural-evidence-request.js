'use strict';

/*
 * Provider output at this boundary is untrusted cognitive data.
 *
 * This module DOES NOT:
 * - dispatch operations;
 * - grant capabilities;
 * - authorize filesystem access;
 * - invoke Git;
 * - invoke processes;
 * - mutate files; or
 * - interpret arbitrary commands.
 *
 * It accepts only a tiny declarative vocabulary that Surgical
 * DevOps may later evaluate against an already-authorized task.
 */

const DECISIONS =
  Object.freeze([
    'RESPOND',
    'REQUEST_EVIDENCE'
  ]);

const REQUEST_KINDS =
  Object.freeze([
    'WORKSPACE_FILES',
    'READ_FILE',
    'VALIDATE_JS'
  ]);

const DECISION_SET =
  new Set(
    DECISIONS
  );

const REQUEST_KIND_SET =
  new Set(
    REQUEST_KINDS
  );

const TOP_LEVEL_KEYS =
  Object.freeze([
    'decision',
    'response',
    'evidenceRequest'
  ]);

const REQUEST_KEYS =
  Object.freeze([
    'kind',
    'target',
    'reason'
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

function exactKeys(
  value,
  allowed,
  label
) {
  const keys =
    Object.keys(value);

  for (const key of keys) {
    if (!allowed.includes(key)) {
      throw new Error(
        `${label} contains unsupported field: ${key}.`
      );
    }
  }
}

function requireBoundedText(
  value,
  name,
  maxLength
) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    throw new Error(
      `${name} is required.`
    );
  }

  const text =
    value.trim();

  if (text.length > maxLength) {
    throw new Error(
      `${name} exceeds its fixed bound.`
    );
  }

  if (
    text.includes('\0') ||
    /[\r\n]/.test(text)
  ) {
    throw new Error(
      `${name} contains unsafe control text.`
    );
  }

  return text;
}

function normalizeResponse(value) {
  if (value === null) {
    return null;
  }

  return requireBoundedText(
    value,
    'response',
    6000
  );
}

function normalizeEvidenceRequest(
  value
) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(
      'evidenceRequest must be an object.'
    );
  }

  exactKeys(
    value,
    REQUEST_KEYS,
    'evidenceRequest'
  );

  const kind =
    requireBoundedText(
      value.kind,
      'evidenceRequest.kind',
      64
    ).toUpperCase();

  if (!REQUEST_KIND_SET.has(kind)) {
    throw new Error(
      'Evidence request kind is unsupported.'
    );
  }

  const reason =
    requireBoundedText(
      value.reason,
      'evidenceRequest.reason',
      500
    );

  if (kind === 'WORKSPACE_FILES') {
    if (
      value.target !== null &&
      value.target !== undefined
    ) {
      throw new Error(
        'WORKSPACE_FILES cannot carry a target.'
      );
    }

    return deepFreeze({
      kind,
      target:
        null,
      reason
    });
  }

  const target =
    requireBoundedText(
      value.target,
      'evidenceRequest.target',
      1024
    );

  return deepFreeze({
    kind,
    target,
    reason
  });
}

function parseNaturalEvidenceDecision(
  result
) {
  if (
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    result.schema !==
      'sdo.ai_cognitive_result.v1' ||
    result.status !==
      'COMPLETED'
  ) {
    throw new Error(
      'Completed cognitive result is required.'
    );
  }

  const output =
    result.output;

  if (
    !output ||
    typeof output !== 'object' ||
    Array.isArray(output)
  ) {
    throw new Error(
      'Cognitive evidence-decision output is malformed.'
    );
  }

  exactKeys(
    output,
    TOP_LEVEL_KEYS,
    'cognitive evidence decision'
  );

  const decision =
    requireBoundedText(
      output.decision,
      'decision',
      64
    ).toUpperCase();

  if (!DECISION_SET.has(decision)) {
    throw new Error(
      'Cognitive evidence decision is unsupported.'
    );
  }

  if (decision === 'RESPOND') {
    if (
      output.evidenceRequest !== null &&
      output.evidenceRequest !== undefined
    ) {
      throw new Error(
        'RESPOND cannot carry an evidence request.'
      );
    }

    return deepFreeze({
      schema:
        'sdo.natural_evidence_decision.v1',

      decision:
        'RESPOND',

      response:
        normalizeResponse(
          output.response
        ),

      evidenceRequest:
        null
    });
  }

  if (
    output.response !== null &&
    output.response !== undefined
  ) {
    throw new Error(
      'REQUEST_EVIDENCE cannot carry a final response.'
    );
  }

  return deepFreeze({
    schema:
      'sdo.natural_evidence_decision.v1',

    decision:
      'REQUEST_EVIDENCE',

    response:
      null,

    evidenceRequest:
      normalizeEvidenceRequest(
        output.evidenceRequest
      )
  });
}

function evidenceRequestToIntent(
  request
) {
  if (
    !request ||
    typeof request !== 'object' ||
    Object.isFrozen(request) !== true
  ) {
    throw new Error(
      'Canonical immutable evidence request is required.'
    );
  }

  if (
    request.kind ===
      'WORKSPACE_FILES'
  ) {
    return deepFreeze({
      capabilityType:
        'GIT_READ',

      target:
        'workspace-files'
    });
  }

  if (
    request.kind ===
      'READ_FILE'
  ) {
    return deepFreeze({
      capabilityType:
        'FILESYSTEM_READ',

      target:
        request.target
    });
  }

  if (
    request.kind ===
      'VALIDATE_JS'
  ) {
    return deepFreeze({
      capabilityType:
        'PROCESS_VALIDATION',

      target:
        request.target
    });
  }

  throw new Error(
    'Unsupported evidence request cannot become a governed intent.'
  );
}

module.exports =
  Object.freeze({
    DECISIONS,
    REQUEST_KINDS,
    parseNaturalEvidenceDecision,
    evidenceRequestToIntent
  });
