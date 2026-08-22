# ADR-010 — Governed Content-Addressed Workspace as Mutation Authority

**Status:** Accepted / Frozen
**Date:** 2026-08-22
**Project:** Surgical DevOps
**Target:** v2.4.0
**Protocols:** BH-SEP v2.2 + BH-SDP v2.2

---

## Context

Surgical DevOps requires mutation to remain fail-closed under explicit
human authority, bounded capabilities, deterministic inspection,
lifecycle evidence, journal, recovery and exact mutation scope.

Qualification demonstrated that ordinary pathname check-then-replace
cannot honestly provide Strict Physical Identity-Conditional CAS against
concurrent or non-cooperating writers.

Atomic rename is not identity-conditional CAS.

Advisory locking does not create that guarantee against external writers.

ADR-009 remains the normative record of this limitation.

---

## Decision

Surgical DevOps adopts the **Governed Content-Addressed Workspace** as
the authoritative mutation model.

Authoritative state consists of:

1. immutable content-addressed objects;
2. immutable manifests binding path and content identity;
3. a deterministic internal authoritative reference;
4. conditional compare-and-swap of that reference.

The authority transition is:

```text
BEFORE authority
      |
      v
immutable content
      |
      v
immutable manifest
      |
      v
CAS(expected BEFORE -> AFTER)
      |
      v
AFTER authority

A stale writer MUST fail closed.

Two writers starting from the same authority MUST NOT both commit
conflicting successors.

Worktree

The ordinary worktree is explicitly non-authoritative.

It is a projection/materialization of authoritative content-addressed
state.

An external writer may alter the worktree, but that change MUST NOT
redefine Surgical DevOps authority.

A physical projection MUST NOT self-promote into authority.

Materialization and recovery

Authoritative CAS and physical materialization are separate boundaries.

A successful CAS proves authoritative state advancement. It does not,
by itself, prove physical materialization.

The implementation MUST distinguish:

authoritative BEFORE validation;
immutable replacement creation;
AFTER-manifest construction;
authoritative CAS;
materialization;
materialization verification;
recovery.

Materialization MUST be idempotent.

Stale materialization MUST fail closed.

A corrupt managed projection MUST NOT be silently accepted or overwritten
as successful recovery.

After a crash following CAS but preceding materialization, restart
recovery MUST derive state from authoritative immutable evidence.

The worktree MUST NOT become recovery authority.

R3 governance

This ADR does not weaken R3 governance.

Production mutation continues to require the applicable controls:

declarative inspection;
canonical workspace identity;
exact target scope;
R3 risk classification;
verified human identity;
explicit human approval;
capability grant;
operation and grant binding;
lifecycle authority;
journal and recovery evidence;
bounded Mutation Provider;
post-operation evidence;
fail-closed finalization.

Authentication alone does not authorize mutation.

The caller MUST NOT self-approve or self-qualify mutation authority.

Production Mutation Provider

Manifest CAS alone does NOT qualify a production Mutation Provider.

QUALIFIED requires mechanical proof of the composed chain, including:

BEFORE-state binding;
immutable replacement and manifest;
genuine conditional CAS;
stale/conflicting writer rejection;
deterministic internal authority reference;
bounded Git authority;
no generic shell authority;
materialization and verification;
restart recovery;
recovery idempotency;
corruption detection;
R3 integration;
journal/lifecycle integration;
fail-closed failure semantics.

Until that contract passes qualification, the production Mutation
Provider MUST remain fail-closed.

Relationship to ADR-009

ADR-009 remains valid.

It establishes that ordinary pathname check-then-replace is not qualified
as Strict Physical Identity-Conditional CAS.

ADR-010 does not weaken that conclusion.

Instead, mutation authority moves from ordinary pathname state to governed
content-addressed Manifest CAS.

Threat model

The threat model continues to include:

stale and concurrent agents;
stale or expired capabilities;
conflicting mutations;
malformed or forged authority evidence;
process crash and restart;
partial or corrupt materialization;
external worktree writers;
attempts to enlarge filesystem, Git, provider or shell authority.

The threat model MUST NOT be reduced merely to obtain green tests.

When a required property cannot be proven, execution MUST remain
fail-closed.

Explicit non-goals

This ADR does not authorize:

generic shell access;
arbitrary Git commands or refs;
automatic git commit or push;
caller-supplied production providers;
caller self-qualification;
bypass of R3 approval;
ordinary worktree writes as authority;
successful CAS being treated as completed materialization.
Multiplatform invariant

Linux, Windows and macOS may use different infrastructure adapters.

They MUST preserve the same authority invariant:

governed authority
       |
       v
content-addressed state
       |
       v
conditional transition
       |
       v
verified materialization

No platform may receive weaker mutation semantics merely for
compatibility.

Approved closure sequence

Surgical DevOps v2.4.0 proceeds through:

Manifest CAS qualification;
managed materialization;
restart/recovery;
production Mutation Provider qualification;
R3 integration;
governed surgical> patch;
adversarial qualification;
canonical suite;
Linux / Windows / macOS qualification;
v2.4.0 operational closure.
Frozen rule

Authoritative mutation MUST be committed through a governed
content-addressed authority with a genuine conditional state
transition. The ordinary worktree is a projection and MUST NOT
independently establish authoritative mutation state.

Any future change that weakens this invariant, restores ordinary pathname
state as mutation authority, allows projection to redefine authority,
bypasses R3 governance or reduces the established threat model requires a
new ADR explicitly superseding this decision.

Final decision

Accepted and frozen.

Next frontier:

Manifest CAS + Managed Materialization + Restart Recovery -> Qualified
Production Mutation Provider -> R3 Governed CLI Patch -> Multiplatform
Operational Closure.
