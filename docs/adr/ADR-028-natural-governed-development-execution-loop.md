# ADR-028 — NATURAL Governed Development Execution Loop

Português: [ADR-028 em PT-BR](./ADR-028-natural-governed-development-execution-loop_PT-BR.md)

**Status:** G1–G6 IMPLEMENTED / LATER STAGES NOT IMPLEMENTED
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

## G3 exact patch and diff proposal

G3 introduces `sdo.natural_development_patch_proposal.v1`. It accepts only an
immutable completed G2 result and an authority-free governed engineering
proposal. The objective, target and BEFORE SHA-256 must match the G1 contract
and one exact governed `READ_FILE` evidence item.

The G2 result now carries its own deterministic planning fingerprint. G3
revalidates that fingerprint and independently verifies the canonical Base64,
byte length and SHA-256 of the proposed replacement. A no-op replacement,
target substitution, stale BEFORE evidence or patch-attempt overflow fails
closed.

G3 emits `sdo.natural_development_exact_diff.v1` using the explicit
`FULL_FILE_REPLACEMENT` representation. The diff binds target, BEFORE and AFTER
hashes and byte counts into its own fingerprint. It is exact machine-review
data, not a claim that truncated evidence is a complete textual line diff.

The final state is `HUMAN_REVIEW_REQUIRED`. The proposal carries the complete
replacement bytes, validation kind and fingerprints needed by later authority
stages, but continues to expose zero operational, mutation, approval or
dispatch authority.

## G4 exact human authorization

G4 introduces `sdo.natural_development_patch_authorization.v1`. It accepts only
an immutable G3 proposal, an immutable explicit decision named
`APPROVE_EXACT_PATCH`, and a verified human identity assertion. The decision
must repeat the proposal and diff fingerprints, target and exact BEFORE and
AFTER hashes. Blanket, future, implicit or mutable approval fails closed.

The verified identity must identify the same human subject, include the fixed
`surgical-devops:natural-development-r3` audience and use an operation ID
derived exclusively from the G3 proposal fingerprint. Authorization time must
equal the identity verification time, remain inside the verified identity
interval and expire within at most ten minutes.

The authorization binds the complete G1–G4 fingerprint chain. It is marked
single-use, non-reusable and `AUTHORIZED_FOR_R3_COMPOSITION`, but remains
unconsumed and exposes zero operational, mutation, approval or dispatch
authority. Consumption, anti-replay state and physical mutation belong to G5
and G7 rather than this evidence-materialization boundary.

## G5 qualified R3 composition

G5 introduces `sdo.natural_development_r3_composition_result.v1` as the only
NATURAL development bridge into the existing production mutation path. It does
not implement a new signer, clock, approval evaluator, grant, mutation adapter,
journal or Manifest CAS provider. It prepares the exact patch through
`createGovernedPatchRequest` and dispatches that prepared request through the
canonical Surgical Orchestrator.

Before dispatch, G5 independently requires:

- the current physical repository HEAD to equal the G1 HEAD;
- the supplied physical workspace identity and target to remain inside G1;
- the canonical G3 replacement bytes to reproduce the exact AFTER hash;
- the production R3 preparation to reproduce the G3 target, BEFORE and AFTER;
- current authoritative-clock evidence for the G4 interval; and
- the G4 human subject and identity issuer to equal the production R3 local
  human authority.

Success requires `COMPLETED` and `APPLIED` production evidence, a bound mutation
transaction and journal, and equal expected, observed and authoritative AFTER
Manifest OIDs. The result records the managed projection and explicitly states
that the ordinary worktree pathname is not authoritative.

G5 records that this composition used the G4 authorization, but it does not
claim durable cross-process anti-replay qualification. Durable consumption and
conflicting replay enforcement remain G7 work. Qualified validation and the
bounded correction decision remain G6 work.

## G6 authoritative validation and bounded correction

G6 introduces `sdo.natural_development_validation_loop.v1`. It independently
reopens the exact Manifest CAS authority recorded by G5 and requires the
already-materialized projection, current Manifest OID, target and AFTER SHA-256
to converge. It never validates the non-authoritative ordinary worktree as a
substitute for the managed AFTER projection.

The canonical Orchestrator receives the existing R1 `PROCESS_VALIDATION` grant
for the logical target. Its controlled adapter is extended only to consume the
bound G5 projection evidence and runs the existing fixed
`NODE_SYNTAX_CHECK`; no caller-controlled executable, arguments, environment or
shell is introduced. The projection composition fingerprint is part of the
governed evidence identity.

A passed validation produces `VALIDATED` and advances only to G7 qualification.
A failed validation produces `CORRECTION_REQUIRED` only when the next patch
attempt remains below the G1 ceiling; otherwise it produces `STOPPED` with
`PATCH_ATTEMPT_BOUND_REACHED`. Correction is never automatic. Every corrected
patch must return through G3 review, a fresh G4 authorization and G5 R3
composition.

## Security invariants

- Cognitive output never becomes operational authority.
- Blanket or future approval is invalid and non-reusable.
- Absolute, traversing and non-canonical targets fail closed.
- Repository and physical workspace identity remain explicit bindings.
- Generic shell, credentials and external side effects are not smuggled through
  validation vocabulary.
- G1 exports no filesystem, process, execution, approval, grant or dispatch
  method.
- G4 exports no execution, mutation, dispatch, grant or consumption method.
- G5 reaches mutation only through the existing governed R3 preparation and
  canonical Orchestrator; it exports no generic process or shell surface.
- G6 validates only the independently recovered authoritative projection and
  cannot approve, mutate or dispatch a correction.
- The existing read-only task envelope remains unchanged.
- The existing production R3 boundary remains unchanged.
- `v2.6.0-rc.2` remains immutable.

## Explicit non-claims

G1 does not authorize evidence collection. G2 composes only already-qualified
read-only evidence and fixed validation boundaries. G3 materializes review data
only. G4 materializes exact human-authorization evidence only. G5 composes that
evidence with the already-qualified production R3, journal and Manifest CAS
path. G6 qualifies fixed validation of the authoritative AFTER projection and
the bounded decision to request a new human-reviewed attempt. It does not
qualify durable authorization consumption, recovery or conflicting anti-replay.
Those capabilities require independent later-stage qualification. A green
G1–G6 suite proves the canonical task contract, governed planning, evidence
containment, exact authority-free patch/diff proposal, exact non-reusable human
authorization binding, one exact production R3 composition and bounded fixed
validation of its authoritative projection.

---

## G7 — Durable single-use R3 authorization consumption

The exact G4 patch authorization SHALL become durably claimed before a new
physical mutation dispatch can be attempted through the G5 production R3
composition.

A durable claim is bound to the exact authorization fingerprint, physical
workspace identity, operation, canonical target, BEFORE hash and replacement
hash. Once the claim exists, the same authorization SHALL NOT be claimed again,
including after process restart.

Successful authoritative completion MAY replace the claim with immutable
consumption evidence bound to the mutation transaction, durable journal,
committed effect fingerprint and Manifest CAS AFTER identity. An identical
consumption replay is read-only evidence reconciliation only; it SHALL NOT
recreate dispatch, mutation, grant or approval authority.

A crash after durable claim but before successful completion does not resurrect
the human authorization. Recovery may inspect durable claim/journal/CAS evidence
but a new physical attempt requires new human authority unless existing
production recovery proves the already-authorized transaction can be reconciled
without remutation.

The G7 store has no delete, release, reset, generic execution, shell, network,
grant or authority-minting surface. G7 claims process-restart durability and does
not introduce a new universal power-loss claim beyond the already-qualified
durability adapters.

---

## G8 — Durable recovery reconciliation without authorization resurrection

After G7 has durably claimed or consumed an exact G4 authorization, restart
recovery SHALL NOT recreate dispatch or mutation authority from that historical
authorization.

G8 classifies recovery only from immutable evidence bound to the same operation,
physical workspace, exact target, BEFORE hash and replacement hash. The closed
recovery outcomes are:

- `COMPLETED`: terminal journal evidence, authoritative Manifest CAS evidence and
  physical AFTER evidence prove the already-authorized effect without remutation;
- `NOT_APPLIED_REAUTH_REQUIRED`: terminal finalized journal evidence proves the
  effect was not applied and physical state remains BEFORE, so any new physical
  attempt requires new human authority;
- `RECOVERY_UNRESOLVED`: evidence is incomplete, conflicting, unavailable or
  ambiguous, and the system remains fail-closed.

A durable `CLAIMED` state may corroborate an already-applied historical effect
when production journal, Manifest CAS and physical evidence agree, but it can
never itself authorize another attempt. A durable `CONSUMED` state must match its
exact transaction, journal, effect fingerprint and Manifest CAS AFTER identity.

G8 is a read-only reconciliation boundary. It exposes no filesystem mutation,
process, shell, network, delete, release, reset, authority factory or generic
execution surface. Recovery never turns expired or historical human authority
into fresh operational authority.

---

## G9 — Production-path durable anti-replay integration

G7 durable anti-replay SHALL be consumed by the real G5 production composition
boundary rather than remaining an isolated helper.

Immediately before the single canonical G5 call into the Surgical Orchestrator,
after G5 has already completed its exact G1-G4, stale-HEAD, identity, expiry,
workspace and patch-binding checks, G5 SHALL durably claim the exact G4
single-use authorization through the qualified G7 store.

The G9 claim is bound to the same operation, physical workspace identity, exact
target, BEFORE hash and replacement hash. Its durable state root is derived
under the already-authorized production mutation journal root; callers cannot
select a separate replay database or broaden its authority.

If durable claim confirmation fails, G5 SHALL fail closed before Orchestrator
dispatch. If the claim already exists after a process restart, the same
authorization SHALL NOT reach Orchestrator dispatch a second time. A crash after
the claim does not resurrect authorization; G8 may only reconcile historical
journal, Manifest CAS and physical evidence without remutation.

G9 introduces no new filesystem-patch primitive, shell, process, network,
provider, authority factory or generic execution surface. The existing
production R3 Journal + Manifest CAS path remains the sole physical mutation
authority.

---

## G9 Freeze — Production dispatch boundary

**Decision:** ACCEPTED / FROZEN.

The G9 production anti-replay boundary is accepted and frozen at commit
`3f0a6608ee1bd4bef7f28ed897951c9744a9f2fc`.

The qualified production ordering is:

1. exact G4 single-use authorization validation remains inside G5;
2. the durable G7 claim is recorded immediately before the one canonical
   production Orchestrator dispatch;
3. the real Orchestrator return value is preserved;
4. Journal and Manifest CAS evidence are validated from that real production
   result.

Qualification evidence at the freeze boundary:

- 1,091 tests;
- 1,086 passed;
- 0 failed;
- 5 skipped;
- dependency audits: 0 vulnerabilities;
- final worktree clean;
- no push performed by the qualification executor.

This freeze does **not** assert that the complete durable anti-replay lifecycle
is closed. G9 qualifies claim-before-dispatch on the real G5 production path.

### Next required gate — G10

G10 SHALL qualify durable post-dispatch consumption and close the remaining
anti-replay lifecycle boundary by requiring:

- transition from `CLAIMED` to `CONSUMED` bound to the actual production G5
  result;
- exact binding to the resulting Journal transaction and Manifest CAS/effect
  evidence;
- a linearizable `CLAIMED -> CONSUMED` transition under concurrent attempts;
- adversarial end-to-end proof that one exact G4 authorization cannot reach the
  real physical Orchestrator dispatch twice;
- fail-closed behavior for conflicting consumption, result substitution,
  restart ambiguity, and bypass attempts.

No new authority, generic shell, process, network, filesystem mutation surface,
or alternate production mutation path is authorized by this decision.
