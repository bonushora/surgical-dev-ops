# Reconstruction v3 — R1 Contracts and State Machine

Status: QUALIFIED ON RECONSTRUCTION LINE

Baseline: v2.6.0-rc.1 at commit
66d89f205e6af58450d015d7181be91569347454.

## Objective

Create one canonical, immutable and side-effect-free vocabulary for operation
lifecycle and state-boundary classification before migrating any production
consumer.

## Preserved invariants

- Human authority remains sovereign.
- The Orchestrator remains the operational trust boundary.
- Cognitive providers receive no operational or mutation authority.
- Unknown, malformed and forbidden transitions fail closed.
- Existing lifecycle, CAS, journal, recovery and platform behavior remains
  unchanged during R1.
- The qualified baseline remains available through the immutable
  v2.6.0-rc.1 tag.

## R1 promotion gate

R1 may be promoted only when:

1. the reconstructed vocabulary is deeply immutable;
2. every allowed transition is explicit;
3. unknown and terminal transitions fail closed;
4. compatibility tests reproduce the current green lifecycle outcomes;
5. the new module has no filesystem, process, network or mutation authority;
6. the complete historical suite remains green;
7. Linux, macOS and Windows CI passes.

R1 began as an additive compatibility-first contract. After the additive
qualification passed, the production state-boundary.js consumer was migrated
incrementally to:

- delegate lifecycle transition resolution to the canonical contract;
- derive lifecycle, initial, terminal and transition vocabularies from it;
- delegate state-boundary classification while preserving the qualified legacy
  input behavior.

The public state-boundary.js surface remains stable. The Orchestrator trust
boundary, authority model, CAS, journal, recovery and platform adapters remain
unchanged.


## Qualification closure

R1 satisfies every promotion gate listed above.

Implementation lineage:

- `2e6222231c6531b04cd7f2f8ad5d4b8c033e6f4c` — canonical immutable
  operation-state contract;
- `f694d90ac4c7d8543b1038b9a86927a3a9a38ebf` — deterministic pull-request
  merge-branch identity without weakening detached-HEAD fail-closed behavior;
- `31bcbdbc2ca2a560d66152cc1211335d2dd094ab` — lifecycle resolution
  delegation;
- `dfcb5b536f6acb85466fe2cc7eac3eb5a43f2d57` — canonical lifecycle
  vocabulary migration;
- `7293e1882db6023fa14a4684bd3f67dd9364e65d` — state-boundary
  classification delegation.

Qualified implementation evidence:

- canonical suite: 978 tests discovered, 973 passed, 0 failed and 5
  platform-qualified skips;
- dependency audit: 0 vulnerabilities;
- package dry run: 172 files;
- pull-request workflow run: `33037930170`;
- Ubuntu, macOS and Windows: PASS;
- pull request #1 remains draft;
- `main` and immutable baseline tag `v2.6.0-rc.1` remain unchanged.

## Residual status vocabulary classification

The closure audit found additional `PENDING`, `COMPLETED` and `FAILED`
symbols in production. They do not define an alternative lifecycle transition
table:

- adapter statuses describe bounded adapter results;
- validation statuses describe validation outcomes;
- operation-record fields persist already-resolved lifecycle evidence;
- telemetry and NATURAL statuses belong to their own domain contracts;
- Orchestrator status fields project governed execution results.

Those domains must be evaluated in their corresponding reconstruction
milestones. R1 does not broaden its authority or rewrite unrelated contracts
merely because they share textual symbols.

## Final R1 status

R1 is **QUALIFIED** on `reconstruction/v3`.

This qualification establishes one canonical, immutable and side-effect-free
operation-state authority, with a compatibility-preserving production consumer.
It is not yet a claim that every status-bearing subsystem in Surgical DevOps
has been reconstructed.
