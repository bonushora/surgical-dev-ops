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

## R3.2 qualified production evidence projection

R3.2 adds a pure compatibility projection from the existing trusted production
provider result into the R3.1 binding contract.

The projection:

- derives provider qualification from the fixed trusted production boundary;
- accepts no caller-selected provider or qualification decision;
- validates the deeply frozen compare-and-replace result through the canonical
  production validator;
- requires the exact request, transaction, target and content hashes;
- requires an `APPLIED` manifest CAS result;
- requires matching materialization and non-authoritative worktree evidence;
- reduces only qualified production fields into the R3.1 contract;
- fails closed for stale, mutable, substituted, incomplete or extra evidence;
- invokes no filesystem, Git, process, shell or mutation operation.

R3.2 does not migrate a production consumer and does not alter the production
provider, filesystem adapter, Orchestrator, CAS implementation or R3.1
contract.

Local R3.2 qualification:

- production projection tests: 7 passed, 0 failed;
- complete suite: 1001 discovered, 996 passed, 0 failed, 5 platform skips;
- dependency audits: 0 vulnerabilities;
- package dry run includes both the R3.1 contract and R3.2 projection.

## R3.3 production success qualification

R3.3 promotes the qualified R3.2 projection into the production filesystem
patch boundary.

For a content-addressed provider result to become successful production
evidence, the adapter now requires:

- a validated qualified provider result with outcome `APPLIED`;
- an `ALLOWED` R3.2 workspace/CAS projection;
- one immutable binding between physical workspace, target, provider,
  authoritative manifest transition and replacement content;
- explicit preservation of the ordinary worktree as non-authoritative.

If the physical provider reports `APPLIED` but the canonical projection is
denied, the operation never becomes successful. It is classified as
`RECOVERY_REQUIRED_AUTHORITATIVE_PROJECTION`, the transaction advances to
`RECOVERY_REQUIRED`, and the denied projection and provider evidence remain
available for diagnosis.

This closes the gap between a provider-reported physical result and canonical
workspace/CAS success without granting filesystem, Git, process, shell,
provider-selection or mutation authority to the reconstruction contracts.

R3.3 preserves:

- zero mutation before physical commit;
- explicit recovery after an ambiguous or unqualified post-commit state;
- exact R3 human authority and capability binding;
- immutable production success evidence;
- R1 and R2 semantics;
- historical finalized replay compatibility;
- the existing durability, journal and platform boundaries.

Local R3.3 qualification:

- directed production and reconstruction gate: 103 passed, 0 failed;
- complete suite: 1002 discovered, 997 passed, 0 failed,
  5 platform-specific skips;
- dependency audit: 0 vulnerabilities;
- production-only dependency audit: 0 vulnerabilities;
- package dry run: 178 files, including the R3.1 contract and R3.2 projection.

R3.3 is locally qualified. Promotion remains conditional on successful Linux,
macOS and Windows CI for the exact committed candidate.
