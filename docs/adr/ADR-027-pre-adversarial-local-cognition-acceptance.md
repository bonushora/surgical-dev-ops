# ADR-027 — Pre-Adversarial Local Cognition Acceptance Corrections

Status: **APPROVED AND FROZEN**
Date: 2026-08-26

## Context

Manual acceptance after ADR-026 showed two reproducible usability failures.
First, a pending authorization intercepted `exit`, requiring cancellation before
the user could leave. Second, Qwen 3 reached the qualified 256-token PLAN ceiling
with `done_reason: length`; one execution returned complete JSON while another
failed closed after the same governed evidence. The earlier ceiling therefore
made successful completion depend on a boundary-token coincidence.

## Decision

1. `exit` and `quit` SHALL always reach the deterministic session boundary,
   including while an authorization is pending. Closing a session grants no
   authority and performs no pending operation.
2. The bounded local profile advances to `ollama-cpu-bounded-v3` with PLAN output
   increased from 256 to 512 tokens. EXPLAIN remains 512, PROPOSE remains 2048,
   context remains 4096 and timeout remains 180 seconds.
3. Ollama thinking remains disabled. Hidden reasoning is never accepted as final
   content or evidence.

## Preserved boundaries

These corrections add no filesystem, shell, process, network, mutation,
credential, approval or publication authority. Empty, malformed, truncated or
authority-bearing cognitive output continues to fail closed.

## Qualification

The change requires deterministic tests, real bilingual Qwen acceptance, a clean
worktree and the unchanged canonical Ubuntu, macOS and Windows workflow before
release publication.
