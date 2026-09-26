# ADR-040 — Versioned Local Control Plane Protocol

- Status: PROPOSED
- Date: 2026-09-26
- Protocol: `sacp.sdo-local/v1`
- Related: ADR-004, ADR-007, ADR-009, ADR-037

## Context

Surgical DevOps owns governed physical authorization, exact workspace confinement, mutation lifecycle, journal and recovery. Its Integrated Governed Agent Gateway uses `sdo.integrated_governed_agent_gateway.v1`. The Surgical AI Control Plane separately owns task coordination, authorization checkpoints and its external-execution aggregate under `sacp.external-execution/v1`.

No inter-process protocol previously connected those ownership domains, no existing transport was qualified for reuse, and no Surgical Kernel source exists in the authorized scope. This decision defines only the logical, non-physical protocol foundation.

## Decision

Adopt the closed protocol `sacp.sdo-local/v1` with deterministic request/result contracts for `negotiate`, `capabilities`, `submit`, `reconcile`, `cancel` and `inspect`. Version negotiation is exact. Missing or incompatible versions fail before registry, gateway, orchestrator, mutation transaction or journal access. There is no downgrade or fallback.

Surgical DevOps remains sovereign over physical authorization and all physical effects. The Control Plane cannot bypass that authority. A protocol acceptance proves only registry ownership of a logical submission; it does not prove that a mutation started or completed. Checkpoint is not journal. Reconciliation is observation, never resubmission. Unknown is not success. Ambiguous submission never authorizes a physical retry.

## Canonical binding

Submit binds `protocolVersion`, `requestId`, `operationId`, `idempotencyKey`, the canonical SHA-256 `intentFingerprint`, authenticated principal, delegation and authority references, requested capability, exact workspace and physical identity, repository identity and HEAD, expected worktree/CAS state, approval reference and canonical `submittedAt`.

The Surgical DevOps facade owns `externalExecutionId`. Registry entries additionally bind current observation state and a monotonic sequence. Identical replay returns the same logical operation. Conflicting idempotency, principal substitution, authority widening, workspace/repository mismatch, forged external identity, stale sequence and result regression fail closed.

## Validation, secrets and error classes

All messages are closed and reject unknown fields. Identifiers, timestamps, fingerprints, repository state and authority fields are validated before use. Recursive validation excludes credentials, bearer and Authorization material, private keys, provider tokens, environment objects and raw HTTP requests. Such material must never enter canonical requests, fingerprints, results, registry entries, journals, checkpoints, errors or snapshots.

Sanitized classifications are `accepted`, `running`, `succeeded`, `failed`, `cancelled`, `rejected`, `unknown`, `indeterminate`, `authentication_failure`, `authorization_failure`, `protocol_failure`, `unsupported_capability`, `stale_state`, `transport_failure` and `internal_failure`.

## Non-physical facade

The facade uses injected registry, clock, identity factory and an optional injected governed gateway that must explicitly declare `physicalDispatch: false`. Physical dispatch is disabled by default and remains false in capability discovery. The facade imports no Surgical Orchestrator, mutation transaction or mutation journal module. It creates no listener, socket, server or provider invocation.

A deliberately injected non-physical test gateway may be observed only after version, schema, identity, authority, workspace, repository, CAS, capability and registry preconditions pass. A gateway failure after registry ownership becomes `indeterminate`; it is not success and does not permit retry.

## Registry, restart and rollout

The deterministic in-memory registry is a conformance implementation only. It does not claim durable cross-process acceptance. A production frontier requires a separately qualified persistent registry, split-brain policy and paired restart/reconciliation model. Restart must never restore spent authority, infer external success, or resubmit an ambiguous operation.

Static fixtures in both repositories cover negotiation, closed validation, credential exclusion, capability discovery, canonical submit/rejection, replay conflicts, identity and workspace substitution, unknown and ambiguous results, monotonic observation and unsupported cancellation. The shared schema digest is `6bdbd49023e0c76f8dff28fbb22bd905bba35823347cc5e4453d14570de401d4`. Incompatible evolution requires a new version and decision.

## Cancellation and observation

Cancellation requires advertised capability, the original principal and authority binding, exact workspace/repository identity and current sequence. This foundation does not claim safe interruption of an active mutation. Reconcile and inspect never submit. Terminal state cannot regress and stale observations fail closed.

## Kernel boundary

Surgical Kernel is outside qualified scope. No Kernel event, journal entry, authorization, result or behavior may be invented. Future Kernel integration must be separately authorized and preserve its owner's physical and journal sovereignty.

## Qualified

- closed logical schema and canonical serialization;
- exact negotiation and deterministic capability discovery;
- injected non-physical facade and Control Plane adapter;
- deterministic fixtures and compatibility digest;
- in-memory non-physical replay protection;
- recursive credential exclusion;
- disabled-by-default physical dispatch.

## Unqualified and non-goals

- concrete transport or authenticated OS peer;
- durable cross-process registry;
- real physical dispatch, event streaming, reconnect or resume;
- safe interruption of active mutation;
- split-brain ownership or paired process restart;
- Linux transport integration, macOS or Windows qualification;
- Surgical Kernel integration or production enablement;
- remote service, database, queue, credential or shared package.

## Stop conditions

Stop if progress would require authority weakening, protocol downgrade, credential persistence, physical dispatch by default, reconciliation by resubmission, inferred success, a real listener, an unqualified transport, or invented Kernel behavior.

ADR-040 remains **PROPOSED** and changes no accepted or frozen ADR state.
