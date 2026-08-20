# ADR-007 — Governed Mutation Transaction and Crash Recovery

**Status:** APPROVED / FROZEN
**Date:** 2026-08-20
**Decision ID:** SDO-5
**Scope:** Surgical DevOps / Governed Physical Mutation Transactions
**Extends:** [ADR-004 — Surgical DevOps Orchestrator — Trust Boundary & Secure Execution](./ADR-004-surgical-devops-orchestrator-trust-boundary.md) and [ADR-006 — Authenticated Human Authority Boundary](./ADR-006-authenticated-human-authority-boundary.md)
**Supersedes:** None

---

## 1. Context and Purpose

ADR-004 establishes the Surgical DevOps Orchestrator as the mandatory trust
boundary for physical execution. ADR-006 requires authenticated external human
identity for R3 approval. The governed `FILESYSTEM_PATCH / PATCH_FILE` path adds
exact-target authorization, BEFORE-hash comparison, atomic replacement, AFTER
verification, immutable evidence and bounded compensating recovery.

Those controls do not alone define behavior under concurrent operations,
process or host crashes, incomplete evidence persistence, authority expiry, or
ambiguous physical state. This ADR defines the authoritative transaction,
locking, durability, crash-recovery, expiry and replay semantics for governed
physical mutations executed by the Surgical DevOps Orchestrator.

## 2. Decision Drivers

The decision is driven by:

1. deterministic behavior under concurrency and replay;
2. fail-closed handling of crashes and ambiguous state;
3. durable correlation of authority, physical mutation and audit evidence;
4. exact-target isolation and least privilege;
5. preservation of authenticated human R3 authority;
6. operating-system and infrastructure independence in the core;
7. honest guarantees that do not overstate exactly-once execution;
8. bounded recovery that does not overwrite unowned state.

## 3. Exact-Target Lock Scope

Mutation locking SHALL be scoped to the exact canonical physical target.
Canonical target identity SHALL be established before lock acquisition.
Sibling-prefix, traversal and symlink aliases SHALL NOT produce independent
lock identities for the same physical target.

Conflicting operations against the same target SHALL serialize or fail closed.
Independent targets MAY proceed independently in future concurrency models.
Lock ownership SHALL be bound to the operation and transaction. Stale or orphan
lock recovery SHALL follow explicit deterministic rules and SHALL NOT infer
ownership merely from elapsed time.

## 4. Mutation Transaction Identity

Every physical mutation transaction SHALL have an immutable transaction
identity bound to at minimum:

- operationId;
- canonical workspace;
- canonical physical target;
- BEFORE hash;
- replacement hash;
- capability-grant fingerprint;
- R3 approval-authority fingerprint;
- verified human identity assertion fingerprint;
- transactionId;
- idempotency/replay identity.

Different replacement content or conflicting authority MUST NOT collapse into
the same transaction identity. Transaction and replay fingerprints SHALL be
derived internally from canonicalized fields rather than trusted from arbitrary
caller input.

## 5. Durable Transaction Journal

A durable transaction journal SHALL exist independently of volatile in-memory
state. It SHALL record ordered transaction stages sufficient to distinguish at
minimum:

- `PREPARED`;
- `LOCKED`;
- `BEFORE_VERIFIED`;
- `MUTATION_STARTED`;
- `PHYSICAL_APPLIED`;
- `AFTER_VERIFIED`;
- `EVIDENCE_RECORDED`;
- `FINALIZED_SUCCESS`;
- `FINALIZED_FAILED`;
- `RECOVERY_REQUIRED`;
- `RECOVERED`;
- `RECOVERY_UNRESOLVED`.

Exact stage names MAY evolve only when their semantics remain equivalent.
Journal records SHALL be immutable and append-oriented, or use an equivalent
mechanism that preserves verifiable transition history. Journal transitions
SHALL be bound to the transactionId and operationId and SHALL reject invalid,
missing, reordered, conflicting or corrupted history.

## 6. Durability and Fsync

Where the supported platform and filesystem expose the required primitives:

- temporary mutation content SHALL be durably flushed before replacement;
- target replacement durability SHALL include directory fsync or an equivalent
  primitive when required by platform semantics;
- journal state required for crash recovery SHALL be durably persisted before
  crossing each corresponding irreversible physical boundary.

The core SHALL define the required durability semantics. Platform-specific
locking, flushing, replacement and persistence mechanics SHALL remain isolated
behind adapters. If required guarantees cannot be established, the operation
SHALL fail closed rather than claim stronger persistence guarantees.

## 7. Crash Windows

The implementation SHALL explicitly represent, test and recover from crashes:

A. before lock acquisition;
B. after lock acquisition but before BEFORE verification;
C. after BEFORE verification but before mutation;
D. during temporary replacement preparation;
E. after physical replacement but before AFTER verification;
F. after AFTER verification but before evidence persistence;
G. after evidence persistence but before lifecycle finalization;
H. during compensating recovery;
I. after recovery but before recovery evidence or finalization.

No crash window may be treated as implicitly successful. A missing terminal
journal state SHALL require deterministic reconciliation or an explicit
unresolved recovery outcome.

## 8. Restart Recovery

On restart, recovery SHALL use the durable journal together with authoritative
physical evidence. Recovery authority SHALL NOT silently create a new mutation
authorization.

Recovery may complete or reconcile a transaction only when durable authority
proves that the exact transaction was authorized before the crash. Recovery
SHALL verify:

- transaction identity;
- operation identity;
- canonical target identity;
- BEFORE, replacement and AFTER hashes where applicable;
- existing human, R3 and capability-grant authority;
- the last durable journal stage;
- current authoritative physical state.

Ambiguous, conflicting, corrupted or unprovable state SHALL fail closed as
`RECOVERY_UNRESOLVED`. Recovery SHALL NOT use a new or refreshed authorization
to disguise continuation as reconciliation.

## 9. Logical Idempotency, Physical Application and Ambiguity

Surgical DevOps SHALL NOT claim universal exactly-once execution. The precise
contract is:

- logical replay SHALL be deterministic;
- an identical completed replay SHALL not intentionally repeat physical
  mutation;
- conflicting replay SHALL fail closed;
- physical mutation SHALL aim for at-most-once application when durable
  evidence proves completion;
- after an ambiguous crash, recovery SHALL be evidence-driven and may result in
  `RECOVERED` or `RECOVERY_UNRESOLVED`;
- exactly-once SHALL never be reported unless journal and physical evidence can
  prove it.

Logical idempotency means an identical authorized request converges on the same
governed result. Physical at-most-once means a proven completed transaction is
not intentionally applied again. Crash recovery reconciles incomplete durable
stages. Ambiguous external state means neither success nor safe compensation is
provable and therefore forbids a success claim.

## 10. Concurrent Operations

For the same exact physical target:

- identical concurrent requests SHALL converge deterministically;
- they SHALL NOT produce duplicate independent physical mutations;
- conflicting concurrent requests SHALL serialize or fail closed;
- a stale BEFORE hash SHALL reject mutation;
- a conflicting replacement hash SHALL reject or reconcile only according to
  the immutable transaction identity and lock state.

Multi-target distributed transactions are outside the scope of this ADR.

## 11. Expiry and Authoritative Clock

An authoritative clock abstraction SHALL govern:

- verified identity assertion expiry;
- R3 approval-authority expiry;
- capability-grant expiry;
- transaction timing decisions.

Caller-supplied timestamps SHALL NOT be trusted as authority. All required
authority SHALL remain valid when mutation authorization crosses the defined
physical-commit boundary. Expiry before that boundary SHALL fail closed.

Expiry after an already-authorized irreversible physical commit SHALL NOT
retroactively invalidate physical reality. Subsequent recovery MAY use the
durable pre-crash authority record solely to reconcile that already-authorized
transaction; it SHALL NOT authorize a new mutation. The implementation SHALL
document the exact placement of its physical-commit boundary.

## 12. Recovery Authority

Recovery is narrowly scoped. It MAY:

- inspect the durable journal;
- inspect the physical target;
- finalize already-proven successful state;
- perform bounded compensating restore only under the already-established
  adapter ownership rules;
- record immutable recovery evidence.

Recovery SHALL NOT:

- broaden target scope;
- change replacement content;
- create a new approval;
- refresh an expired grant into new mutation authorization;
- execute arbitrary shell, process, network or Git mutation;
- silently overwrite state whose ownership cannot be proven.

## 13. Fail-Closed Physical Refresh

Physical refresh after mutation or recovery SHALL be authoritative. If the
target cannot be re-read, resolved or reconciled, the system SHALL NOT infer
success from stale preflight or cached state, SHALL NOT finalize success, SHALL
preserve failure and recovery evidence, and SHALL transition to `FAILED` or
`RECOVERY_UNRESOLVED` according to the transaction contract.

## 14. TOCTOU, Symlink and Ancestor Replacement

The implementation SHALL defend against:

- final-component symlink substitution;
- ancestor-directory replacement where detectable or controllable;
- target identity changes between inspection, lock, write and verification.

Where the platform cannot prove target continuity strongly enough, the
operation SHALL fail closed. Platform-specific file descriptors, handles,
identity primitives and atomic replacement mechanisms belong in adapters, not
the orchestration core.

## 15. Audit and Evidence Correlation

The durable transaction journal, Operation Record and lifecycle evidence SHALL
remain correlatable by transactionId and operationId. Crash and recovery
evidence SHALL clearly distinguish:

- requested state;
- last durable transaction stage;
- observed physical state;
- recovery action;
- final recovery classification.

Recovery evidence MUST never masquerade as ordinary successful execution. A
recovered successful state SHALL explicitly identify its recovery path and the
durable and physical proof supporting it.

## 16. Platform Independence

Core transaction semantics SHALL remain operating-system agnostic. Linux,
Windows and macOS specifics for locking, atomic replacement, fsync and
durability, file identity and crash-safe journal storage SHALL live behind
platform or infrastructure adapters.

If equivalent required guarantees cannot be provided on a platform, the
adapter SHALL expose that limitation and the core SHALL fail closed for the
unsupported guarantee.

## 17. Strictly Out of Scope

This ADR does not authorize:

- general filesystem write;
- arbitrary file creation or deletion;
- directory mutation;
- multi-file atomic transactions;
- Git mutation;
- arbitrary process or shell execution;
- network access;
- credential access;
- package installation;
- agent or provider self-approval;
- weakening ADR-004 or ADR-006.

## 18. Security Consequences

The architecture gains deterministic target serialization, durable crash
reconciliation, explicit ambiguity, authoritative timing and stronger audit
correlation. It also introduces sensitive persistence and locking components
whose integrity, permissions, corruption behavior, stale-state handling and
platform conformance require direct testing.

The system deliberately favors denial and explicit unresolved recovery over an
unprovable success claim or an unsafe overwrite.

## 19. Frozen Invariants

The following are frozen:

1. journal persistence precedes irreversible assumptions;
2. physical mutations use exact-target transaction locking;
3. no universal exactly-once claim is permitted;
4. recovery is driven by durable journal and physical evidence;
5. recovery creates no new authority;
6. authority timing uses an authoritative clock;
7. ambiguous recovery fails closed;
8. OS-specific durability remains behind adapters;
9. human identity, R3 approval and capability authority remain mandatory for
   the original mutation;
10. `Agent != Authority` remains authoritative.

## 20. Rejected Alternatives

### 20.1 In-Memory-Only Transaction State

Rejected because process restart destroys the evidence needed to distinguish
an unapplied transaction from an applied but unrecorded transaction.

### 20.2 Universal Exactly-Once Claim

Rejected because crashes, platform durability limits and external concurrent
writers may create state that cannot be proven uniquely from available facts.

### 20.3 Workspace-Wide Global Lock

Rejected as the normative lock identity because it unnecessarily couples
independent targets. Exact-target locking is the required boundary.

### 20.4 Caller Time as Authority

Rejected because callers could extend or replay expired identity, approval or
grant authority by supplying stale timestamps.

### 20.5 Recovery as New Execution

Rejected because recovery must reconcile the existing authorized transaction,
not create approval or broaden capability after a crash.

## 21. Acceptance Criteria

An implementation conforms only when tests prove at minimum:

- a two-process identical-operation race converges without duplicate mutation;
- a two-process conflicting-operation race serializes or fails closed;
- a stale BEFORE race fails closed;
- crash injection at every stage defined in Section 7;
- restart recovery from every recoverable durable stage;
- no duplicate physical mutation after a proven completed restart;
- ambiguous crash state never becomes false success;
- authority expiry crossing the documented physical-commit boundary;
- orphan lock recovery and stale-lock handling;
- concurrent recovery does not duplicate or broaden mutation;
- final-component symlink swap is denied;
- ancestor replacement is denied where the platform can control or detect it;
- journal corruption fails closed;
- journal and physical-state mismatch fails closed;
- physical refresh failure cannot finalize success;
- directory fsync or equivalent durability behavior where supported;
- explicit `RECOVERY_UNRESOLVED` semantics;
- no generic execution or mutation fallback exists.

## 22. Review Triggers

This ADR requires review before introducing:

- multi-file transactions;
- distributed locks;
- remote workspaces;
- networked mutation executors;
- database-backed transactional execution;
- Git mutation;
- cross-project transactions;
- new recovery authority;
- changed exactly-once guarantees;
- a new platform durability model.

## 23. Approval Record

This ADR is approved and frozen by the project authority on 2026-08-20.
Implementation may refine internal names and platform mechanics only while
preserving every frozen invariant and acceptance criterion above.
