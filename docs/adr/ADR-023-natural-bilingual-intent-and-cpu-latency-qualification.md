# ADR-023 — NATURAL bilingual intent and CPU latency qualification

Status: Accepted and frozen
Date: 2026-08-25

## Decision

Equivalent Portuguese and English requests for project analysis cross the same
deterministic human-authorization and governed-evidence boundary. The requested
language selects the canonical README used for grounding and the language of the
final cognitive response; it never changes operational authority.

The qualified local CPU profile uses a 4,096-token context ceiling, a 256-token
PLAN response ceiling, a 512-token EXPLAIN ceiling and a 2,800-character
per-evidence ceiling. The 180-second fail-closed transport timeout remains
unchanged. Qwen 3 structured JSON requests use its documented no-thinking prompt
control so hidden reasoning does not consume the bounded interactive latency
budget. Gemma 3 remains the fast local profile.

## Invariants

- No language may bypass explicit authorization for broad workspace analysis.
- Grounding still crosses the canonical Orchestrator and retains target, byte
  count and SHA-256 evidence.
- The cognitive provider gains no filesystem, process, mutation, approval or
  capability authority.
- Cache reuse remains session-local, evidence-bound and non-persistent.
- Performance failure remains bounded and fail-closed.

## Acceptance

- Portuguese and English intent, approval and canonical README selection are
  covered by deterministic regression tests.
- Output and evidence bounds are executable contract tests.
- Linux, macOS and Windows canonical conformance remain green.
