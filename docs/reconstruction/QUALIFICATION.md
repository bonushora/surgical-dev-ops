# Reconstruction v3 — Formal qualification

Status: **R1–R3 QUALIFIED ON RECONSTRUCTION LINE**

## Scope

The reconstruction line contains exactly three formally defined architectural
milestones:

1. R1 — Contracts and State Machine;
2. R2 — Authority and Identity;
3. R3 — Workspace and Manifest CAS.

No R4 milestone is defined by the reconstruction roadmap.

## Immutable baseline

The pre-reconstruction release candidate remains available at:

- tag: `v2.6.0-rc.1`;
- commit: `66d89f205e6af58450d015d7181be91569347454`.

The reconstruction is additive and compatibility-first relative to that
immutable baseline.

## Qualified milestones

### R1 — Contracts and State Machine

R1 establishes the canonical immutable operation-state vocabulary and delegates
the production state boundary without broadening authority.

Qualification evidence:

- final R1 lineage: `7293e1882db6023fa14a4684bd3f67dd9364e65d`;
- canonical workflow: `33037930170`;
- Ubuntu, macOS and Windows: PASS;
- historical compatibility: preserved.

### R2 — Authority and Identity

R2 binds external verified identity, separate human R3 approval and exact
capability authority, then enforces the canonical chain at production dispatch.

Qualification evidence:

- production enforcement:
  `d892d4436165816a4cf344e8e4bcf65747dd0048`;
- canonical workflow: `33042188598`;
- Ubuntu, macOS and Windows: PASS;
- incomplete, substituted and actionless authority: fail closed.

### R3 — Workspace and Manifest CAS

R3 binds physical workspace identity, qualified compare-and-replace provider,
authoritative Manifest CAS transition and materialized projection. Production
success and finalized replay require canonical evidence, while legitimate
historical replay remains compatible.

Qualification evidence:

- final R3 implementation:
  `aa5d798feaef72e64065d2304962f6b885b018cb`;
- canonical workflow: `33093386335`;
- Ubuntu, macOS and Windows: PASS;
- complete suite: 1004 discovered, 999 passed, 0 failed,
  5 platform-specific skips;
- dependency audits: 0 vulnerabilities;
- package dry run: 178 files;
- historical finalized CAS replay: preserved;
- provider, manifest and null binding substitution: denied with zero dispatch.

## Preserved authority boundaries

Across R1–R3:

- the human remains sovereign;
- the Orchestrator remains the operational trust boundary;
- authentication never implies authorization;
- cognitive providers receive no operational or mutation authority;
- the ordinary worktree remains non-authoritative;
- unknown, incomplete, stale, mutable and conflicting evidence fails closed;
- journal, recovery and platform durability contracts remain mandatory;
- Linux, macOS and Windows must independently pass.

## Promotion boundary

This document qualifies the reconstruction branch. It does not itself:

- merge pull request #1;
- redefine the ADR-025 public review baseline;
- update the release candidate version;
- create a release tag;
- claim that an independent adversarial audit has occurred.

Those actions require separate controlled promotion and post-merge
qualification gates.

## Final reconstruction status

R1, R2 and R3 are **QUALIFIED** on `reconstruction/v3`.

The formally defined reconstruction roadmap is 3 of 3 milestones complete.
