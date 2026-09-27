# ADR-041 — Low-Latency Persistent Local IPC Transport

- Status: PROPOSED
- Date: 2026-09-26
- Logical protocol: `sacp.sdo-local/v1`
- Transport envelope: `sacp.sdo-local-ipc/v1`
- Related: ADR-004, ADR-007, ADR-037, ADR-040

## Context

ADR-040 qualified the logical facade and durable registry but deliberately deferred transport. The local boundary now needs evidence-driven completion with no HTTP parsing, per-operation connection setup, polling, fixed sleeps or redundant negotiation, while preserving authority, CAS, idempotency, durability and credential exclusion.

## Decision

Use Node.js `node:net` local IPC over one persistent connection. Linux and macOS map to Unix Domain Sockets; Windows maps to Named Pipes. TCP loopback, HTTP, HTTPS and child-process stdio are rejected. Surgical DevOps owns the listener and the Control Plane owns the client. Transport establishment is not authorization, protocol acceptance is not physical dispatch, and Surgical DevOps remains the sole owner of physical authority.

The selection gives lower protocol overhead, no HTTP parsing, no connection per operation, cross-platform API convergence, local-only confinement, deterministic framing, direct event completion and the minimum transport round trips.

## Framing and session

Each frame is a 4-byte unsigned big-endian length followed by one canonical JSON object encoded as strict UTF-8. Maximum payload size is 65,536 bytes. Zero, oversized, truncated, invalid UTF-8/JSON and unknown envelopes fail closed. Fragmented and concatenated frames are processed in deterministic order with bounded memory. Errors are sanitized and canonical payloads remain recursively credential-free.

The cold path connects, negotiates the exact version, discovers capabilities and verifies the exact schema digest. The validated session freezes these characteristics. A hot submit/reconcile/inspect is exactly one request frame and one response frame, with no renegotiation or repeated discovery. Connection loss, mismatch, malformed frame, endpoint change or explicit restart invalidates the session immediately; there is no downgrade or fallback.

`node:net` events and complete-frame evidence drive completion. There are no sleeps, interval polls or retry delays. The Control Plane's connect/request timers are bounded failure deadlines and are cleared on evidence. Monotonic `process.hrtime.bigint()` measurements cover connect, negotiation, discovery, operation round trips, frame decode and durable claim without entering protocol records.

## Ambiguity and durable lookup

A disconnect before frame publication is not acceptance. A disconnect after a complete request but before response is `indeterminate`; it is never automatically resubmitted. `externalExecutionId` is optional only for `reconcile` in the v1 request schema so an ambiguous first submission can be recovered by its still-mandatory operation, idempotency, fingerprint, principal, authority, workspace, repository and sequence bindings. Surgical DevOps returns the durable external identity. The coordinated schema digest is `cd4e3fa7d7086f78291ef35b87e1b450be15bc77cb6ae8527e299101e5a11935`.

## Endpoint confinement

On Linux, the socket parent must be a real private directory owned by the current UID with no group/world bits. The endpoint must be a real same-owner socket with mode `0600`. A stale path fails startup and is not unlinked. Graceful close removes only the listener's own inode. Node built-ins do not establish portable SO_PEERCRED process identity here, so endpoint confinement is qualified independently from authenticated process identity.

## Qualified by this proposal

- deterministic bounded framing and persistent validated sessions;
- Surgical DevOps Linux UDS listener around the non-physical facade;
- restart/reconnect and durable binding-only reconciliation;
- monotonic non-persisted latency evidence;
- physical dispatch disabled and counted as zero.

## Unqualified

- authenticated OS process identity;
- physical mutation dispatch or safe interruption;
- physical macOS or Windows transport evidence;
- simultaneous writers, split-brain, event streaming, Kernel integration and production enablement.

ADR-041 remains **PROPOSED**.
