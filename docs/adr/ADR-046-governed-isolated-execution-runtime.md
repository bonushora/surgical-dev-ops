# ADR-046 — Governed Isolated Execution Runtime

- Status: EXPERIMENTAL / NOT PRODUCTION WIRED
- Date: 2026-10-08
- Protocol: `sdo.execution-isolation/v1`
- Related: ADR-009, ADR-038, ADR-042, ADR-045

## Decision

Isolation is a defense-in-depth enforcement layer subordinate to existing
Surgical DevOps authority. An isolation backend cannot mint, amplify, transfer,
renew, consume, or reinterpret authority. Natural-language requests are not
runtime authority. The orchestrator must supply an already-authorized execution
envelope; authority and operation fingerprints bind evidence only and this layer
cannot create authority from them.

The v1 runtime policy is closed, versioned, deterministic, canonically hashed,
and rejects unknown fields or values. Network defaults to `DENY`. The host
filesystem defaults to absent. Only the exact physically authorized workspace
may be writable host-backed storage. Temporary storage is ephemeral. Ambient
credentials and environment are absent unless a future, separately authorized
capability explicitly supplies them.

The Linux provider uses Bubblewrap with separate user, mount, PID, IPC, UTS, and
network namespaces, a minimal read-only system runtime, an isolated `/tmp` and
`HOME`, and the authorized workspace at `/workspace`. It exposes no Docker
socket, privileged execution, host PID/IPC/network namespace, arbitrary device,
arbitrary mount, or generic host-shell capability. Workloads are argv arrays
launched with `shell=false`; strings and shell interpolation are rejected.

Provider unavailability is fail-closed. There is never an automatic fallback
from isolated execution to native execution. Wall-clock and captured-output
bounds are enforced deterministically. These bounds are not represented as CPU
or memory cgroup quotas.

This experimental provider is instantiated only by explicit tests or future
unmistakably experimental diagnostics. It is not wired into NATURAL, Control
Plane, the default orchestrator, mutation, package installation, or customer
beta flows. An environment variable alone cannot authorize its use.

## Deferred providers and platforms

macOS and Windows are not qualified by this implementation. OCI, cgroup-backed,
VM, and SuperSandbox providers are future work and are not implied by v0.1.
Production integration requires a separate authority-preserving decision and
qualification campaign.

## Explicit nonclaims

- Namespace or container isolation is not proof against a kernel escape.
- This runtime does not contain a hypothetical ASI.
- It does not replace human, repository, workspace, CAS, replay, reconciliation,
  recovery, or Control Plane authority controls.
- It does not provide universal side-channel isolation.
- It does not provide universal power-loss guarantees.
- It does not qualify macOS or Windows.
- It does not certify production security.

This ADR creates no merge, release, publication, deployment, credential, or
production authority.
