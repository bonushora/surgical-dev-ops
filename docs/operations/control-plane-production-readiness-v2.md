# Governed Control Plane physical execution: operator contract

Status: **engineering qualification in progress; production dispatch remains disabled**.

This document describes only behavior supported by physical evidence. It does not authorize a production workspace, release, deployment, publication, generic filesystem mutation, shell execution, push, merge, or tag.

## Architecture and startup

The Control Plane requests and coordinates. Surgical DevOps independently decides whether local human authority, workspace identity, CAS, target confinement, journal, recovery, and the one qualified capability permit an effect.

The supported logical protocols are:

- `sacp.sdo-local/v1`, digest `cd4e3fa7d7086f78291ef35b87e1b450be15bc77cb6ae8527e299101e5a11935`: permanently non-physical; `physicalDispatchEnabled` is false.
- `sacp.sdo-local/v2`, digest `0276897c7e22dc2cc77f049a4a329842abff50290ada1f946bce9747660d31e4`: governed physical contract for `mutation.applyConditional`; disabled unless a governed Surgical executor is explicitly injected.

The transport is the persistent local `sacp.sdo-local-ipc/v1` session. It uses a Unix-domain socket on Linux/macOS and a named pipe on Windows. There is no HTTP or TCP fallback. A cold connection performs one negotiation and one capability discovery. A hot operation performs one request frame and one response frame, with no per-operation negotiation or discovery.

There is currently no production startup composition that injects the physical executor. Ordinary product startup therefore remains closed. Test and native qualification compositions use isolated temporary Git repositories only.

## Authority and enablement

Configuration, an environment variable, endpoint availability, code availability, a Control Plane approval reference, and a Control Plane checkpoint are not Surgical authority. The only accepted physical path resolves an existing local Surgical human authorization and binds it to the exact operation, canonical workspace, repository HEAD, clean worktree fingerprint, target, before hash, replacement hash, and CAS.

Production-capable enablement is not qualified. The frozen v2 capability request has no operation/authority binding, so it cannot truthfully report “current human authority valid” during discovery. Adding that distinction to the wire contract would change the frozen v2 schema digest and requires a separate architectural decision. Until that decision exists, production dispatch must remain disabled.

## State directories

Qualification uses distinct private physical directories for:

- the Control Plane physical submission registry;
- Surgical mutation journals and authorization-consumption records;
- local human authority material;
- local IPC runtime endpoints;
- content-addressed managed projections.

Roots must be canonical absolute paths, real directories rather than symlinks, owned by the current user where ownership is available, and writable by the owning Surgical process. Credential material is never written into the Control Plane registry or protocol frames.

## Single writer

Two layers protect different ownership domains:

1. The Control Plane registry writer record serializes a registry generation update with atomic exclusive creation. Its owner token is explicit and release rereads the physical record before unlinking. Contention, malformed evidence, symlink substitution, missing ownership, or replacement by another owner fails closed. There is no timeout stealing, polling, sleep, or retry delay.
2. The Surgical mutation lock binds the canonical physical workspace plus exact target, transaction, operation, and owner token. It remains held across journaled physical commit and is released only after a durable terminal journal state. Recovery requires trusted owner-termination evidence and a separate exclusive recovery claim.

The exact target is the narrow authority scope of `mutation.applyConditional`; independent targets are not silently treated as one authority. A stale owner cannot delete a replacement owner record. No fencing generation is claimed: a newer mutation owner cannot lawfully acquire the same target while the prior lock exists, and takeover based only on time, PID, or process existence is forbidden.

An orphan Control Plane registry-writer record is inspectable fail-closed evidence, but automated recovery of that record is not implemented. Removing it is a destructive recovery action and requires separately authorized operator evidence. This is a current Commercial Beta blocker.

## Crash and recovery truth table

Physical evidence wins over cached or intended state.

| Fault boundary | Classification | Qualified observation |
|---|---|---|
| Before durable logical claim | `NO_EFFECT` | No accepted registry generation and no physical dispatch. An orphan writer record blocks later writers. |
| After logical claim, before Surgical authority consumption | `NO_EFFECT / RECOVERABLE` | Durable accepted ownership exists; reconcile may inspect it, but it may not resubmit automatically. |
| After one-shot authority claim, before journal `PREPARED` | `NO_EFFECT / FAIL_CLOSED` | No commit may be inferred; the claimed authorization is not silently resurrected. |
| After journal `PREPARED`, before physical write | `NO_EFFECT` | BEFORE plus journal/lock evidence reconciles as not applied. |
| During temporary or managed-projection write | `RECOVERABLE` | An unpublished projection is not a committed authoritative effect. |
| After file flush, before atomic replacement | `NO_EFFECT` | The authoritative target/ref remains BEFORE. |
| After replacement, before directory durability confirmation | `INDETERMINATE` | Process observation may find AFTER, but universal power-loss survival is not claimed. |
| After physical commit, before terminal journal publication | `COMMITTED / RECOVERABLE` | AFTER plus durable historical commit-authority evidence can prove the effect without remutation. |
| After terminal journal publication, before registry terminal observation | `COMMITTED` | Reconcile projects Surgical journal/recovery truth into the registry. |
| After registry terminal observation, before IPC response | `COMMITTED` | Identical replay is zero-mutation and returns the stable external identity. |

Any mismatch among operation, external execution ID, authorization, transaction, journal, target, before/after hashes, registry sequence, or physical state is `CORRUPT / FAIL_CLOSED`, never success.

## Platform durability guarantees

| Platform | Qualified primitives | Guarantee boundary | Not claimed |
|---|---|---|---|
| Linux | file `fsync`, atomic replacement, directory `fsync`, durable journal/lock directory boundaries | ordered durable primitives are invoked and failures propagate | universal power-loss immunity or storage-hardware guarantees |
| macOS | Node file and directory `fsync`, atomic replacement, journal/lock ordering | the available primitives are invoked and failures propagate | Linux-equivalent persistence, `F_FULLFSYNC`, or universal power-loss immunity |
| Windows | Node file `fsync` plus the fixed native `CreateFileW` + `FlushFileBuffers` directory helper | helper-backed file/directory/replacement evidence | guarantees beyond the qualified helper and underlying filesystem |

Every receipt explicitly carries `powerLossValidated: false`.

## Cancellation

The current physical v2 service advertises no cancellation capability and returns `NON_INTERRUPTIBLE_MUTATION` for a physical cancel frame.

- Before physical dispatch, the caller may choose not to submit.
- Once Surgical begins the journaled mutation, the commit-authority recheck through atomic replacement is a non-interruptible window.
- After physical commit, cancellation cannot rewrite success into cancelled.
- During ambiguity, cancellation is observational only; reconciliation determines physical truth.

Safe active interruption is unqualified and requires a separate architectural decision.

## Inspection, recovery, and shutdown

Inspect registry, journal, authorization-consumption, mutation-lock, managed-projection, and physical target evidence as one correlated set. `ACCEPTED` is not commit; a Control Plane checkpoint is not the mutation journal; `reconcile` is not `resubmit`.

Close clients before listeners. Listener shutdown destroys accepted sockets and removes only the exact endpoint identity it created. A pre-existing or substituted endpoint is not removed automatically. Mutation locks are released only after durable terminal journal evidence; ambiguous locks remain for recovery.

## Latency structure

- Cold session: one local connection, one negotiation round trip, one capability-discovery round trip.
- Hot submit: one request frame and one response frame.
- Registry claim/observation: one exclusive writer acquisition and release per durable registry write.
- Physical commit: exact-target lock, authority claim/consumption, mutation journal transitions, CAS/materialization, required file flushes and directory durability confirmations.
- Sleeps: 0. Polls: 0. Retry delays: 0. Automatic resubmissions: 0.
- Timers: bounded transport failure deadlines only.

## Current limitations

- No production physical startup composition or production workspace allowlist is qualified.
- Capability discovery cannot express operation-bound current human authority without a new protocol decision.
- Orphan registry-writer recovery is manual and destructive; no automated takeover is authorized.
- No fencing generation is claimed because same-domain takeover is forbidden while ownership evidence exists.
- Active physical cancellation is unsupported.
- Stronger local peer-process authentication is not qualified.
- Universal power-loss immunity is not claimed.
- Only `mutation.applyConditional` is physical; no arbitrary path write, shell, process, network mutation, push, merge, publish, release, or deploy exists.
