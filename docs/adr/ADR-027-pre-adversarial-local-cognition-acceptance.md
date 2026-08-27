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

## Manual acceptance observation

During the first post-change manual run, an operator instruction intended for
the test procedure (`Confirm a complete response in Portuguese`) was entered at
the `surgical>` prompt while authorization was pending. The input was not an
affirmative authorization and the application correctly continued to require an
explicit `sim` or `não`. A subsequent English request was contained by the same
pending decision, and `exit` closed the session immediately.

This execution is recorded as **partially accepted**, not as successful
bilingual cognitive acceptance. It confirms that ambiguous text grants no
authority, unrelated input does not replace a pending decision, session exit
remains available, and the workspace remains unchanged. It does not qualify the
Portuguese or English cognitive response; those observations require separate
manual runs with test instructions clearly labelled `TYPE`, `WAIT`, and
`OBSERVE`.

The equivalent English and Portuguese acceptance record is maintained in
[NATURAL Manual Acceptance — Bilingual Record](../evaluation/NATURAL-MANUAL-ACCEPTANCE-BILINGUAL.md).


## Final manual acceptance

The exact continuation procedure was subsequently completed in two independent
sessions with the qualified local Qwen 3 8B provider. The Portuguese cognitive
response completed in 37.1 seconds and the English cognitive response completed
in 52.8 seconds. Each session obtained two governed evidence observations,
returned to the `surgical>` prompt and reported zero workspace mutation.

Result: **BILINGUAL COGNITIVE ACCEPTANCE PASSED**.

The English session retained Portuguese progress and completion-status messages.
This is recorded as a non-authority-bearing localization limitation; it does not
rewrite the observed complete English cognitive response as a fully localized
English terminal experience.
