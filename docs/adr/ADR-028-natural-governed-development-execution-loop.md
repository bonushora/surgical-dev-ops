# ADR-028 — NATURAL Governed Development Execution Loop

Português: [ADR-028 em PT-BR](./ADR-028-natural-governed-development-execution-loop_PT-BR.md)

**Status:** G1–G2 IMPLEMENTED / LATER STAGES NOT IMPLEMENTED
**Date:** 2026-08-28
**Scope:** Surgical DevOps / NATURAL governed development
**Extends:** ADR-004, ADR-006, ADR-007, ADR-010, ADR-014 and ADR-019

## Context

NATURAL can gather governed evidence and produce an authority-free engineering
proposal, while the existing R3 boundary can execute an exact authorized patch.
There was no canonical contract connecting those capabilities into a bounded
development task that may later repeat evidence, proposal and validation steps.

## Frozen decision

Surgical DevOps will implement a NATURAL Governed Development Execution Loop.
The cognitive provider understands, analyzes and proposes. The deterministic
Orchestrator remains the only operational boundary. The human remains sovereign
over exact authority and every expansion of scope, risk or architecture.

The qualified delivery sequence is:

1. G1 — canonical authority-free task contract;
2. G2 — governed planning and evidence acquisition;
3. G3 — exact patch and diff proposal;
4. G4 — content-bound, non-reusable human authorization;
5. G5 — existing R3 execution, journal and Manifest CAS composition;
6. G6 — qualified validation and bounded correction loop;
7. G7 — recovery, conflict and anti-replay qualification;
8. G8 — bilingual NATURAL experience;
9. GQ — adversarial and native multiplatform qualification.

## G1 contract

G1 introduces `sdo.natural_development_task_contract.v1`. It binds one
objective to an exact physical workspace identity, repository HEAD, work mode,
target allowlist, qualified validation vocabulary, risk ceiling, evidence-step
ceiling and patch-attempt ceiling.

The initial qualified validation vocabulary contains only `VALIDATE_JS`; its
operational mapping remains the existing fixed `NODE_SYNTAX_CHECK` boundary.

The contract declares these fixed policies:

- mutation requires a separate exact R3 authorization;
- only fixed qualified validation is permitted;
- credential use and generic shell are forbidden;
- external effects and architectural decisions stop for the human;
- workspace, target and risk expansion stop;
- stale evidence, exhausted bounds, conflict and recovery stop;
- success requires all authorized validations to pass.

G1 can only classify whether a proposed step remains within the declared task
boundary. A contained mutating proposal still carries
`requiresExactR3Authority: true` and zero mutation or dispatch authority.

## G2 governed planning and evidence

G2 introduces `sdo.natural_development_planning_loop.v1` as an authority-free
composition over the existing recursive read-only evidence loop. Before any
cognitive planning or governed dispatch, it verifies the task-contract
fingerprint, physical workspace identity and repository HEAD.

The cognitive provider may request only:

- `WORKSPACE_FILES`, a read-only inventory of the already-authorized repository;
- `READ_FILE` for a target present in the contract allowlist; or
- `VALIDATE_JS` for an allowed JavaScript target.

The G2 policy is evaluated after the existing NATURAL containment envelope and
before the canonical read-only dispatcher. Target or evidence-step expansion
returns `STOPPED`, preserves the pending request for human review and performs
zero dispatch. The existing deterministic project-grounding behavior remains
the default for all prior callers; G2 disables it only for its exact-target
planning composition so the provider cannot be redirected to an undeclared
README target.

G2 results bind all evidence and the final cognitive response to the G1
contract fingerprint. They remain deeply immutable and explicitly carry zero
operational, mutation, approval and dispatch authority.

## Security invariants

- Cognitive output never becomes operational authority.
- Blanket or future approval is invalid and non-reusable.
- Absolute, traversing and non-canonical targets fail closed.
- Repository and physical workspace identity remain explicit bindings.
- Generic shell, credentials and external side effects are not smuggled through
  validation vocabulary.
- G1 exports no filesystem, process, execution, approval, grant or dispatch
  method.
- The existing read-only task envelope remains unchanged.
- The existing production R3 boundary remains unchanged.
- `v2.6.0-rc.2` remains immutable.

## Explicit non-claims

G1 does not authorize evidence collection. G2 composes only already-qualified
read-only evidence and fixed validation boundaries; it does not apply a patch,
authorize mutation, resume recovery or implement the autonomous correction
loop. Those capabilities require independent later-stage qualification. A green
G1–G2 suite proves only the canonical task contract, governed planning and
fail-closed read-only evidence containment.
