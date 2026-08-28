# ADR-030 — Unified bilingual interaction onboarding

Português: [ADR-030-unified-bilingual-interaction-onboarding_PT-BR.md](./ADR-030-unified-bilingual-interaction-onboarding_PT-BR.md)

**Status:** IMPLEMENTED AND LOCALLY QUALIFIED

## Decision

Surgical DevOps ships as one npm package, one Node.js runtime requirement and
one deterministic Orchestrator. `NATURAL`, `ENGINEER` and `EXPERT` are bounded
presentation profiles over the same canonical governance authority; they are
not separate products, packages or security levels.

A first-time human terminal receives a bilingual onboarding flow and selects
one profile. The resulting preference stores only language and interaction
mode. Its schema explicitly carries zero operational, mutation or approval
authority. It cannot authorize, dispatch, widen scope or weaken BH-SEP/BH-SDP.

`--interaction` is an invocation-scoped override and never rewrites the saved
preference. `--configure` reruns the bounded onboarding. Non-interactive use
without a saved preference remains `EXPERT` for compatibility and never creates
configuration as a side effect.

## Persistence boundary

The preference is stored in the operating system's user configuration area,
outside the governed project workspace. The adapter rejects noncanonical
directories, symbolic links, oversized files, corrupt JSON, unknown modes and
any authority-bearing record. Publication of the npm package remains a later
release operation and requires green Linux, macOS and Windows CI.

## Non-claims

Onboarding does not make model output deterministic, authenticate a human,
grant filesystem or process access, or replace the existing R3, journal,
Manifest CAS, recovery and anti-replay boundaries.
