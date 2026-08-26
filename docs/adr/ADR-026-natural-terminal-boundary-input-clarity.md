# ADR-026 — NATURAL Terminal Boundary and Input Clarity

Status: **APPROVED AND FROZEN**
Date: 2026-08-26

## Context

Manual evaluation showed that shell commands pasted at the `surgical>` prompt
were treated as conversation. No shell authority was gained, but the resulting
cognitive answers made a functioning fail-closed application appear broken.
Ambiguous input at an authorization boundary is also a user-experience and
security concern.

## Decision

NATURAL SHALL classify common system-shell syntax before cognitive routing and
before interpreting a pending authorization. Shell-looking input is
presentation-only: it is never executed, never becomes evidence, never grants
authority and never cancels a pending task. The user is told to leave with
`exit` and run the command at the external system prompt.

Canonical Surgical read commands remain available. An authorization remains an
exact isolated decision. A multiline value presented as one input is rejected
instead of being decomposed into an implicit sequence of decisions.

## Non-goals

- This boundary is not a shell parser or security sandbox.
- It does not execute, rewrite or forward system commands.
- It does not expand the Orchestrator capability set.
- It does not claim to recognize every possible command language.

## Qualification

The boundary requires deterministic unit tests, session-control integration,
manual bilingual acceptance and the unchanged canonical Linux, macOS and
Windows conformance gate before adversarial publication.
