# R3 — Workspace and CAS reconstruction

Status: **R3.1 qualified candidate**

Baseline: `87deb3dc145b43022690bfb3fd8f96180efca800`.

## Objective

R3.1 introduces one additive deterministic contract binding four independently
qualified evidence stages:

1. physical workspace identity;
2. qualified compare-and-replace provider;
3. authoritative manifest CAS transition;
4. resulting materialized projection.

The default decision is `DENIED`.

An `ALLOWED` result requires an exact, complete and immutable chain. The
materialized manifest must equal the authoritative after-manifest, and its
content hash must equal the authoritative replacement hash.

Missing, extra, malformed, mutable, unqualified or conflicting evidence fails
closed.

## Authority boundary

R3.1 does not access the filesystem, execute Git, spawn processes, invoke a
shell, qualify providers, perform compare-and-replace, advance manifests,
materialize worktrees or mutate physical state.

The ordinary worktree remains a non-authoritative projection.

## Preserved invariants

- R1 state semantics remain unchanged.
- R2 identity, approval and capability authority remain unchanged.
- Human authority remains sovereign.
- The Orchestrator remains the operational trust boundary.
- Stale and conflicting writers fail closed.
- Journal, recovery and durability behavior remain unchanged.
- Cognitive providers receive no operational or mutation authority.

## Local qualification

- R3.1 formal contract: 6 passed, 0 failed.
- Directed workspace/CAS regression: 133 passed, 0 failed.
- Historical suite: 994 discovered, 989 passed, 0 failed, 5 platform skips.
- Dependency audits: 0 vulnerabilities.
- Package dry run includes the R3.1 contract.

R3.1 is an evidence-binding foundation. No production consumer is migrated by
this step. Production projection and promotion require later controlled gates
and successful Linux, macOS and Windows qualification.
