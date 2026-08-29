# ADR-032 — NATURAL Interactive Development Closure

**Status:** ACCEPTED / IMPLEMENTED
**Scope:** Surgical DevOps / NATURAL and ENGINEER / G1–G10

## Decision

One bounded JavaScript mutation request may enter the governed development
pipeline from the interactive terminal. The pipeline must preserve this exact
order:

1. G1 binds objective, physical workspace, repository HEAD and one target;
2. G2 obtains only governed read/validation evidence;
3. G3 materializes one immutable full-file proposal;
4. the terminal displays BEFORE, AFTER and proposal fingerprints;
5. only `approve patch <exact fingerprint>` (or its Portuguese equivalent)
   may become a G4 decision;
6. the existing local Ed25519 authority signs and verifies that exact decision;
7. G5 dispatches through the existing R3 Orchestrator;
8. G9 claims before physical dispatch and G10 consumes after qualified CAS;
9. G6 validates the authoritative managed projection.

An unrelated answer, blanket approval, different fingerprint, missing local
authority, dirty worktree, stale HEAD, failed evidence, failed validation or
missing runtime root fails closed. Cancellation creates no authority. Exit
remains available while a proposal is pending.

The cognitive provider still owns no filesystem, shell, Git, approval,
credential, mutation or dispatch authority. This closure does not add generic
execution and initially admits only a single `.js` target with the already
qualified `VALIDATE_JS` selector.

## Consequences

- The terminal no longer needs to ask the user to copy an authority-bearing
  replacement command for this bounded path.
- Human authority is content-bound, short-lived, signed, single-use and
  durably anti-replayed.
- Other file types remain outside this milestone until a dedicated validation
  selector is qualified.
