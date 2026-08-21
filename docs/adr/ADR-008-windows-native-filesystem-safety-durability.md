# ADR-008 — Windows Native Filesystem Safety and Durability Adapter

**Status:** APPROVED / FROZEN
**Date:** 2026-08-21
**Decision ID:** SDO-6
**Scope:** Surgical DevOps / Windows Native Filesystem Infrastructure
**Extends:** [ADR-004 — Surgical DevOps Orchestrator — Trust Boundary & Secure Execution](./ADR-004-surgical-devops-orchestrator-trust-boundary.md) and [ADR-007 — Governed Mutation Transaction and Crash Recovery](./ADR-007-governed-mutation-transaction-recovery.md)
**Supersedes:** None

---

## 1. Context

The Surgical DevOps core is required to preserve one normative execution model
across Linux, Windows and macOS. Native conformance evidence established that
some safety and durability mechanisms currently rely on POSIX-oriented Node.js
filesystem primitives that are not equivalent on Windows.

In particular, Windows does not expose `O_NOFOLLOW` through Node/libuv and a
POSIX-style directory `fsync` cannot be assumed to provide the required durable
metadata boundary. Treating these differences as ordinary test exceptions
would weaken the frozen cross-platform trust-boundary decision.

## 2. Decision

Surgical DevOps SHALL provide a Windows Native Filesystem Safety and Durability
Adapter.

The adapter SHALL preserve the same normative invariants as Linux and macOS
while implementing Windows-specific mechanics only behind infrastructure
boundaries. The orchestration core SHALL remain operating-system agnostic.

No safety or durability guarantee may be reduced merely to obtain a green CI
matrix. If an equivalent physical guarantee cannot be established and proven,
the affected operation SHALL fail closed.

## 3. Windows Safety Mapping

Windows filesystem safety MAY use native Win32 mechanisms equivalent to the
required logical contract, including:

- reparse-point-aware file opening and inspection;
- handle-based physical file identity verification;
- exact-target continuity checks before and after protected open;
- write-through file creation or replacement where required;
- atomic native move/replace operations with explicit persistence semantics;
- Windows-native file and volume identity evidence.

A POSIX flag name is not itself normative. The invariant is normative.
`O_NOFOLLOW`, for example, MAY be replaced by a Windows mechanism that proves
that a final-component reparse point cannot silently redirect the protected
operation.

## 4. Windows Durability Mapping

File-data durability SHALL use a primitive that causes buffered file data to be
submitted to the Windows storage stack before a confirmation receipt is issued.

Metadata publication boundaries such as replacement, journal publication and
lock publication SHALL use a Windows mechanism whose persistence semantics are
explicit and directly tested. A successful ordinary `rename`, `link`, `mkdir`
or directory open SHALL NOT by itself be treated as proof of a durable metadata
boundary.

The implementation SHALL NOT describe POSIX directory `fsync` as available on
Windows unless native evidence proves an equivalent supported operation.

## 5. Evidence Requirements

Every Windows-specific durability or safety confirmation SHALL expose immutable
evidence containing at minimum:

- platform;
- provider/native primitive identity;
- logical operation being confirmed;
- subject identity;
- confirmation decision;
- claim level;
- whether power-loss behavior has been directly validated.

A receipt SHALL NOT claim stronger guarantees than the primitive actually
proves.

## 6. Native Conformance

The Windows implementation SHALL be exercised on a native Windows runner.
Mocks and Linux simulations MAY prove deterministic core behavior, but SHALL
NOT qualify the Windows physical adapter.

Native tests SHALL cover at minimum:

1. protected regular-file read without POSIX `O_NOFOLLOW`;
2. reparse-point/symlink rejection or equivalent no-redirection proof;
3. file data flush;
4. durable replacement publication;
5. durable journal publication;
6. durable lock publication;
7. crash/restart recovery boundaries affected by those publications;
8. Git/workspace physical identity normalization;
9. fail-closed behavior when a required native primitive is unavailable.

## 7. Dependency and Process Boundary

Windows-native mechanics SHALL remain behind an explicit adapter contract.
They SHALL NOT introduce arbitrary shell or general process authority into the
core. Any native bridge, helper or dependency SHALL have fixed operation
contracts, bounded inputs, deterministic error mapping and no capability beyond
what the adapter requires.

## 8. Fail-Closed Rule

Until the native Windows adapter proves an equivalent required guarantee, the
operation dependent on that guarantee remains unsupported and MUST fail closed.
Unsupported capability SHALL be reported explicitly; it SHALL NOT be converted
into simulated success, warning-only behavior or a weaker receipt.

## 9. Frozen Invariants

The following are frozen by this decision:

1. Linux, Windows and macOS retain one normative security model.
2. Windows differences remain isolated behind adapters.
3. Physical identity and authorization remain authoritative over lexical path
   representation.
4. Symlink/reparse-point redirection cannot silently broaden authority.
5. Durability receipts cannot overstate persistence guarantees.
6. Missing native proof means fail closed.
7. Native Windows conformance is mandatory before declaring the adapter
   qualified.
8. The core does not gain Windows-specific branching to compensate for adapter
   limitations.

## 10. Review Triggers

This ADR requires review before:

- weakening any frozen invariant above;
- replacing a proven native primitive with a weaker one;
- claiming power-loss qualification;
- introducing privileged volume-wide flushing;
- broadening the native adapter into arbitrary process or shell execution;
- changing the Windows physical mutation persistence model.

## 11. Approval Record

Approved and frozen by project authority on 2026-08-21.

Implementation may refine internal names and native mechanics only while
preserving every invariant and evidence requirement in this ADR.
