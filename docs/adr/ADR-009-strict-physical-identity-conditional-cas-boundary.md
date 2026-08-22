# ADR-009 — Strict Physical Identity-Conditional CAS Qualification Boundary

**Status:** APPROVED / FROZEN
**Date:** 2026-08-21
**Decision ID:** SDO-7
**Scope:** Surgical DevOps / Production Physical Mutation Qualification
**Extends:** [ADR-004 — Surgical DevOps Orchestrator — Trust Boundary & Secure Execution](./ADR-004-surgical-devops-orchestrator-trust-boundary.md), [ADR-007 — Governed Mutation Transaction and Crash Recovery](./ADR-007-governed-mutation-transaction-recovery.md), and [ADR-008 — Windows Native Filesystem Safety and Durability Adapter](./ADR-008-windows-native-filesystem-safety-durability.md)
**Supersedes:** None

---

## 1. Context

Surgical DevOps v2.3 establishes a governed mutation architecture with
authenticated human authority, exact-scope capability grants, exact-target
locking, durable mutation journaling, persisted commit authority,
deterministic crash/restart recovery, filesystem durability enforcement and a
qualified mutation-provider boundary.

The filesystem foundation also includes a Safe Exclusive Write primitive
qualified directly on Linux, Windows and macOS.

The qualified baseline for this decision is:

- commit `0586fa4113de00c075113f12fd98059f44feba8f`;
- GitHub Actions run `32545548306`;
- Linux canonical conformance: PASS;
- Windows canonical conformance: PASS;
- macOS canonical conformance: PASS.

The remaining production physical mutation question is stricter than ordinary
atomic replacement.

The required contract is Strict Physical Identity-Conditional
Compare-and-Replace: publication may occur only if the target pathname still
refers to exactly the physical identity authorized by the BEFORE evidence at
the indivisible physical replacement boundary.

Atomic rename or replacement alone does not establish this condition.
Cooperative locking alone does not establish this condition against external
writers. A pre-replacement identity check followed by an independent rename
also does not establish this condition because the target may change between
the check and publication.

## 2. Decision

Strict Physical Identity-Conditional CAS is UNQUALIFIED for Surgical DevOps
v2.3.

Production physical mutation that depends on this strict CAS guarantee SHALL
remain fail-closed.

The project SHALL NOT qualify a production provider by relabeling ordinary
atomic replacement, advisory/cooperative locking, or a check-then-replace
sequence as strict physical CAS.

The v2.3 threat model and frozen mutation invariants SHALL NOT be weakened in
order to convert this qualification boundary into simulated support.

This boundary is an explicit closure condition for v2.3, not an unresolved
requirement that blocks v2.3 architectural closure.

Future Strict Physical CAS qualification SHALL proceed only as a separate
specialized qualification line.

## 3. Qualified Foundation

This decision does not invalidate or downgrade the filesystem primitives
already qualified.

The Safe Exclusive Write primitive is qualified on Linux, Windows and macOS at
the baseline identified in Section 1.

Its exclusive protected creation contract remains valid independently from
whether a later production provider can prove Strict Physical
Identity-Conditional CAS.

A failed exclusive creation does not grant authority to remove a pathname that
existed before the attempt.

Cleanup authority remains limited to an object whose ownership can be proven
at the destructive boundary. When that proof is unavailable, cleanup remains
non-destructive and fails closed.

## 4. Required Strict CAS Property

A future provider may be qualified only if evidence demonstrates an indivisible
physical boundary equivalent to:

1. an authorized BEFORE physical identity exists;
2. replacement content has been prepared under the required safety and
   durability contracts;
3. publication succeeds only if the destination pathname still names exactly
   that authorized BEFORE physical identity at the replacement boundary;
4. a changed, removed, redirected or substituted destination fails closed;
5. no successful result is reported when the identity condition cannot be
   proven;
6. crash/restart recovery preserves the same authority and does not create a
   second mutation;
7. the provider does not broaden authority through generic shell, process or
   filesystem capabilities.

A sequence consisting only of identity-check followed by independent
replacement does not satisfy this property.

## 5. Rejected Qualification Substitutes

The following SHALL NOT, by themselves, qualify Strict Physical
Identity-Conditional CAS:

- ordinary atomic rename;
- replace-if-exists semantics;
- replace-if-absent semantics;
- advisory or cooperative locks;
- process-local serialization;
- lexical pathname comparison;
- a pre-replacement stat/identity check followed by an independent rename;
- a post-replacement check used to retroactively claim that an unauthorized
  replacement was safe;
- a platform-specific mechanism whose guarantees are weaker than the normative
  contract.

These mechanisms may remain useful implementation components, but they cannot
be represented as proof of the strict CAS property unless the complete
indivisible identity condition is independently demonstrated.

## 6. Production Fail-Closed Rule

Until a provider satisfies Section 4 and passes the required qualification
suite, production physical mutation dependent on Strict Physical
Identity-Conditional CAS remains unsupported.

Unsupported production mutation SHALL:

- deny before an unqualified physical mutation is performed;
- expose an explicit unqualified/unsupported result;
- preserve existing human authority, grant, locking, journal and recovery
  invariants;
- never fall back to a weaker mutation mechanism;
- never convert missing proof into warning-only success.

## 7. Power-Loss Boundary

This ADR does not claim power-loss qualification.

`POWER_LOSS_VALIDATED` remains false until a separate
platform/filesystem-specific qualification demonstrates the required behavior.

A green process-crash/restart suite, durability receipt or native CI matrix
SHALL NOT be represented as proof of physical power-loss durability.

## 8. Cross-Platform Rule

Linux, Windows and macOS retain one normative mutation-security model.

Platform-specific adapters or native helpers MAY implement different physical
mechanics, but no platform may qualify production physical mutation using a
weaker Strict Physical CAS property merely to obtain a green conformance
matrix.

If one platform cannot prove the required property, that capability remains
unqualified on that platform.

## 9. Frozen Invariants

The following are frozen:

1. Strict Physical Identity-Conditional CAS remains UNQUALIFIED until directly
   proven.
2. Production physical mutation dependent on strict CAS remains fail-closed
   while that qualification is absent.
3. Atomic replacement alone is not equivalent to strict physical CAS.
4. Cooperative/advisory locking alone is not equivalent to strict physical
   CAS.
5. Check-then-replace is not equivalent to an indivisible identity-conditioned
   replacement.
6. No guarantee may be weakened merely to qualify a provider.
7. Existing human-authority, capability, locking, journal and recovery
   semantics remain authoritative.
8. Linux, Windows and macOS retain the same normative security contract.
9. `POWER_LOSS_VALIDATED` remains false until separately qualified.
10. Future Strict Physical CAS work is a specialized qualification line and is
    not a prerequisite for v2.3 architectural closure.

## 10. v2.3 Closure Consequence

Surgical DevOps v2.3 may close with the production physical CAS capability
explicitly UNQUALIFIED because the system fails closed at that boundary.

The architectural result is not a claim that every conceivable physical
mutation mechanism has been implemented.

It is a claim that the Development Orchestration Layer preserves its normative
authority and safety contracts through the qualified boundary and refuses to
cross an unproven production physical mutation boundary.

No artificial success claim is permitted.

## 11. Review Triggers

This ADR requires review before:

- qualifying any production physical compare-and-replace provider;
- claiming that a native rename/replace primitive satisfies strict physical
  CAS;
- weakening the physical identity condition;
- changing the external-writer threat model;
- replacing fail-closed behavior with fallback mutation;
- claiming power-loss qualification;
- broadening a native filesystem helper into generic process or shell
  authority.

## 12. Approval Record

Approved and frozen by project authority on 2026-08-21.

Implementation and future qualification work may refine internal names,
platform mechanics and evidence collection only while preserving every frozen
invariant in this ADR.
