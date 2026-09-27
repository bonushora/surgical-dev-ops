# ADR-042 — Governed Control Plane Physical Execution Bridge

- Status: ACCEPTED / FROZEN
- Date: 2026-09-27
- Logical protocol: `sacp.sdo-local/v2`
- Transport envelope: `sacp.sdo-local-ipc/v1`
- Related: ADR-004, ADR-006, ADR-007, ADR-009, ADR-010, ADR-037, ADR-040, ADR-041

## Context

The qualified `sacp.sdo-local/v1` contract is deliberately non-physical. It provides durable logical submission ownership, exact binding, replay convergence and local IPC, but `physicalDispatchEnabled` is permanently false. Physical mutation is a material semantic expansion and cannot be introduced by widening v1.

Surgical DevOps already owns the governed physical path: local human authority, mission-scoped `mutation.applyConditional`, Integrated Governed Agent Gateway, `composeAndDispatchNaturalDevelopmentPatch`, Surgical Orchestrator, manifest CAS, mutation journal, durability, authorization consumption and recovery. The Control Plane must coordinate that path without becoming an authority issuer, authority store, journal owner, recovery authority or filesystem mutation engine.

## Decision

Introduce the closed logical protocol `sacp.sdo-local/v2` for explicitly governed physical execution while retaining the existing `sacp.sdo-local-ipc/v1` framing and persistent local session. `sacp.sdo-local/v1` remains frozen as non-physical and retains its coordinated digest `cd4e3fa7d7086f78291ef35b87e1b450be15bc77cb6ae8527e299101e5a11935`.

Physical dispatch remains disabled by default. It is advertised only when an injected governed physical executor proves the exact v2 protocol, the sole supported physical capability `mutation.applyConditional`, local Surgical authority, credential exclusion and the absence of generic shell or filesystem-write authority. IPC availability and code availability do not imply authority.

The v2 submit binds protocol, request, operation, idempotency, intent, principal, authority and delegation references, capability, canonical workspace identity, repository identity and expected CAS state, approval reference, canonical submission time, and one closed physical-execution binding. That binding contains only target and before/after, contract, proposal and authorization fingerprints plus a bounded local execution reference. Surgical DevOps resolves all trusted artifacts locally. Authority roots, journal roots, private keys, bearer/provider credentials, environment objects, raw HTTP and arbitrary execution payloads are forbidden.

## Physical ownership and dispatch

Durable logical ownership is established before dispatch. The bridge then resolves the pre-existing local Surgical artifacts, compares every request binding with those artifacts, and routes the operation through the Integrated Governed Agent Gateway and its existing `mutation.applyConditional` path. No second mutation primitive, authority implementation, physical journal or recovery authority is introduced.

Surgical DevOps independently validates local human authority. A Control Plane approval reference is correlation evidence only. Forged, expired, consumed, widened, stale or historically resurrected authority fails before physical write. Existing authorization-consumption and journal/recovery evidence remain authoritative.

An identical replay returns the stable external execution identity and existing terminal observation without a second physical dispatch or durable registry write. Changed intent, principal, authority, workspace, repository, expected state or physical fingerprints is a conflict. One logical physical operation may produce at most one qualified physical effect.

## Ambiguity and recovery

Acceptance is not completion. If the request was accepted and a durable physical commit occurred but publication of the response was lost, the Control Plane observes `indeterminate` and never automatically resubmits. Reconnect uses `reconcile`, which consults durable Surgical registry and journal/recovery evidence. Proven commit becomes `succeeded`; proven non-effect remains non-success; unresolved evidence remains `unknown` or `indeterminate`. Silence never becomes success.

Control Plane checkpoints remain coordination evidence only. Surgical mutation journal and recovery remain the source of truth for physical effect state. Any bounded correlation is non-authoritative and fails closed on disagreement.

## Latency and durability

The cold path performs one exact negotiation and one capability discovery per validated connection. The hot path performs one request frame and one response frame. Completion is evidence-driven. No sleeps, interval polling, retry delays, HTTP, TCP loopback, child-process stdio or redundant acknowledgements are introduced.

Monotonic latency may be measured for decode, protocol validation, registry claim, authority resolution, CAS validation, physical dispatch, journal/durability, encoding and total round trip, but high-resolution timing is not persisted into authority records. Required pre-effect ownership, authority consumption, journal and CAS durability boundaries are preserved. Replay should require no new write when durable evidence is already sufficient.

## Qualification boundary

Qualification uses isolated temporary Git repositories only. It must prove exact before/after hashes, one physical effect, one one-shot authority consumption, journal/recovery correlation, restart/reconnect, replay without resubmission, credential absence and native local endpoints on Linux, macOS and Windows.

This decision does not authorize production enablement, arbitrary production workspace mutation, human approval UI integration, safe interruption of an active non-interruptible mutation, stronger OS peer authentication, simultaneous split-brain writers, merge/release/deploy authority or Surgical Kernel integration.

ADR-042 is **ACCEPTED / FROZEN**.
