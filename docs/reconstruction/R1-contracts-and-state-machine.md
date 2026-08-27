# Reconstruction v3 — R1 Contracts and State Machine

Status: IMPLEMENTATION CANDIDATE

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

R1 is additive. It does not yet replace state-boundary.js or any production
Orchestrator path.
