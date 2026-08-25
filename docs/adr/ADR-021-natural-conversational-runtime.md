# ADR-021 — NATURAL Conversational Runtime

**Status:** APPROVED / FROZEN
**Date:** 2026-08-25
**Scope:** Surgical DevOps / NATURAL / Conversational UX

## Decision

Surgical DevOps SHALL provide a bounded conversational runtime above the deterministic Orchestrator. It improves continuity and perceived latency without moving the AI provider inside the operational trust boundary.

The qualified initial implementation provides:

- session-local memory bounded to six exchanges and 6,000 formatted characters;
- per-message truncation at 1,200 characters;
- an in-memory cache of at most 16 cognitive evidence decisions;
- cache identity bound to the exact human objective and exact bounded governed evidence history;
- evidence presentation to the local provider bounded to 6,000 characters per planning cycle;
- final NATURAL analysis responses required in clear Brazilian Portuguese even when source evidence is in English;
- explicit progress observations emitted as presentation-only immutable data;
- reuse of an already authorized task envelope for its contained micro-reads.

## Security invariants

Conversational memory and cache are not persisted, emit no content telemetry, expose no operational API, create no authority, cannot suppress containment evaluation, and cannot reuse a decision when the evidence fingerprint changes. Presentation callback failure cannot alter governed execution.

The provider remains cognitive-only. The human remains sovereign. The Orchestrator remains the only operational authority and all existing fail-closed behavior remains mandatory.

## Streaming boundary

The local Ollama transport remains bounded and non-streaming JSON. Progress is exposed at deterministic orchestration boundaries instead of presenting unvalidated token fragments. Token streaming requires a later partial-output validation contract.

## Qualification

Mechanical tests cover memory bounds, exact cache binding, cache ceiling, absence of operational surfaces, conversational continuity and existing recursive evidence regressions. Linux, macOS and Windows conformance MUST remain green.
