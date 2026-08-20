# ADR-006 — Authenticated Human Authority Boundary

**Status:** APPROVED / FROZEN
**Date:** 2026-08-20
**Decision ID:** SDO-4
**Scope:** Surgical DevOps / Authenticated R3 Human Authority
**Extends:** [ADR-004 — Surgical DevOps Orchestrator — Trust Boundary & Secure Execution](./ADR-004-surgical-devops-orchestrator-trust-boundary.md)
**Related:** [ADR-005 — Surgical DevOps Commercial Distribution Strategy](./ADR-005-surgical-devops-commercial-distribution-strategy.md)
**Supersedes:** None

---

## 1. Context

ADR-004 establishes the Surgical DevOps Orchestrator as the mandatory trust
boundary and preserves human architectural and critical operational authority.
The current R3 Approval Authority binds an approver identity immutably to an
operation, policy, risk, capability and scope. Structural integrity alone,
however, does not prove that the named human was authenticated by a trusted
authority.

Before any R3 mutation can be physically dispatched, Surgical DevOps requires
an explicit boundary between external authentication, internal authorization
and governed execution. That boundary must support different identity systems
without making the core an Identity Provider or granting an execution agent the
ability to invent or impersonate human authority.

## 2. Decision Drivers

The decision is driven by:

1. preservation of human authority for R3 operations;
2. fail-closed authentication and authorization;
3. identity-provider and execution-provider independence;
4. deterministic evidence, replay and conflict handling;
5. tenant and project isolation;
6. least privilege and attributable approval;
7. support for hosted, enterprise, self-hosted and future offline deployments;
8. separation of mutable external trust infrastructure from normative core
   policy.

## 3. Decision

Surgical DevOps SHALL NOT become an Identity Provider.

Human identity used for R3 approval SHALL originate from an external,
explicitly trusted authentication authority. Surgical DevOps core SHALL remain
identity-provider agnostic.

Authentication and authorization SHALL remain separate concerns:

- authentication establishes that an asserted subject was authenticated by a
  trusted issuer under a declared authentication context;
- authorization determines, through Surgical DevOps policy, whether that
  subject may approve the exact operation, capability, action and scope.

Authentication SHALL NOT imply authorization.

Cryptographic token, signature or assertion verification SHALL occur behind an
explicit identity-verification port and controlled adapter. Provider-specific
verification logic SHALL NOT be hardcoded into core policy, operation records,
capability grants or orchestration logic.

## 4. Provider Independence

No dependency on GitHub, Google, Microsoft, OpenAI, an enterprise SSO system,
a particular OIDC provider, a local authenticator or any single Identity
Provider SHALL be normative.

Conforming identity adapters MAY integrate those systems. Every adapter SHALL
produce the same normalized, immutable verified-identity contract and remain
subordinate to the same policy and evidence requirements.

## 5. Trust Model

The authority chain is:

**Human**
→ **External Trusted Authentication Authority**
→ **Identity Verification Port / Adapter**
→ **Verified Human Identity Assertion**
→ **Separate Role and Policy Authorization**
→ **R3 Approval Authority**
→ **Capability Grant**
→ **Operation Record**
→ **Orchestrator Enforcement**
→ **Controlled Adapter**

Issuer trust, audiences, keys, tenant mappings, project mappings and applicable
revocation data SHALL be externally configured and explicitly trusted. The
Orchestrator validates the resulting assertion and its bindings; it does not
create authentication facts.

The Orchestrator SHALL NOT:

- invent an identity;
- self-authenticate;
- self-approve;
- synthesize an approver identity;
- permit an AI agent, coding agent or execution provider to impersonate human
  authority;
- treat a caller boolean or unverified identity object as authentication.

## 6. Verified Human Identity Assertion

A verified human identity assertion SHALL bind at minimum:

- subject / approver identity;
- issuer;
- authentication context or method;
- issued-at time;
- expiry or validity boundary;
- intended audience;
- operationId;
- tenant and project context when applicable;
- an immutable assertion fingerprint derived internally from canonicalized
  assertion fields.

Caller-supplied arbitrary fingerprints SHALL NOT establish trust. The verifier
or trusted boundary implementation SHALL derive or verify the fingerprint from
the normalized assertion data.

Additional fields such as assertion identity, nonce, verification time, key
identifier and assurance level MAY be required by the conforming contract when
needed for replay resistance or deployment policy.

## 7. R3 Authority Binding

R3 Approval Authority SHALL require a valid verified-human-identity assertion.
The Approval Authority SHALL bind the assertion fingerprint and authenticated
subject to the same operationId, workspace, tenant/project context, capability,
action, exact scope/target, policy decision, risk level and validity boundary.

The capability grant, operation record and Orchestrator SHALL preserve and
validate that binding. Authentication evidence SHALL never weaken the
underlying R3 risk classification or replace the separate authorization
decision.

## 8. Failure, Replay and Conflict Semantics

Missing, malformed, unverifiable, expired, wrong-audience, wrong-operation,
wrong-tenant, wrong-project or untrusted-issuer assertions SHALL fail closed
before R3 authority can authorize execution.

Replay and conflict behavior SHALL be deterministic:

- identical immutable assertion and authority replay MAY yield the same
  deterministic authorization result;
- a conflicting subject, issuer, authentication context, audience, operation,
  tenant/project binding, validity boundary or fingerprint SHALL be denied;
- an expired or revoked-equivalent assertion SHALL NOT authorize a new physical
  operation;
- replay prevention SHALL use assertion identity, nonce, operation binding or
  equivalent immutable evidence where required by the deployment model.

Revocation status, issuer keys, key rotation and their lifecycle remain
external trust dependencies. Integrations SHALL define explicit freshness,
cache, failure and unavailable-provider semantics. An unknown or stale trust
state SHALL NOT be silently treated as valid.

## 9. Tenant and Project Isolation

Multi-tenant and project isolation SHALL be preserved. When tenant or project
context applies, the trusted assertion, authorization policy, R3 Approval
Authority, capability grant, operation record and Orchestrator request SHALL
bind the same context. Cross-tenant or cross-project authority reuse SHALL fail
closed.

## 10. Local and Offline Authentication

Local or offline authenticated human approval MAY be supported in the future
through a conforming identity adapter using explicitly trusted local keys,
hardware-backed credentials or another verifiable mechanism.

Offline support SHALL satisfy the same normalized assertion, authorization,
expiry, replay, audit and isolation requirements. It does not permit an
unverified local username, process identity or caller assertion to become human
authority.

## 11. Physical Mutation Gate

FILESYSTEM_PATCH physical dispatch SHALL remain disconnected until all of the
following are implemented and validated:

1. an authenticated human identity assertion exists;
2. its R3 Approval Authority binding is validated;
3. its capability-grant binding is validated;
4. its operation-record binding is validated;
5. Orchestrator enforcement is validated end to end.

This ADR does not authorize filesystem mutation, generic filesystem writes,
arbitrary processes or shells, Git mutation, network access, credential access
or any legacy execution fallback.

## 12. Rejected Alternatives

### 12.1 Surgical DevOps as Identity Provider

Rejected because it expands the trust surface, duplicates specialized identity
infrastructure and couples governance to authentication operations.

### 12.2 Caller-Supplied Identity or Boolean Approval

Rejected because structural claims without trusted verification do not prove
human identity and permit impersonation.

### 12.3 Hardcoded Identity Provider

Rejected because it creates vendor lock-in, conflicts with provider
independence and cannot serve all deployment models.

### 12.4 Authentication Implies Authorization

Rejected because proving identity does not prove permission to approve a
specific R3 operation or scope.

### 12.5 Verification Directly in Core

Rejected because provider protocols, token formats, key discovery and
cryptographic dependencies are infrastructure concerns. Core SHALL consume and
validate a normalized contract through an explicit port.

## 13. Security Consequences

Positive consequences include attributable human approval, reduced
impersonation risk, provider independence, explicit tenant isolation and a
testable chain from authentication through execution authority.

Operational consequences include management of trusted issuers, audiences,
keys, role policy, tenant mappings, clock behavior, revocation freshness and
adapter conformance. Failure or ambiguity in those dependencies results in
denial, not fallback.

## 14. Frozen Invariants

The following are frozen:

1. Surgical DevOps is not an Identity Provider.
2. Human R3 identity originates from an external trusted authority.
3. Core remains identity-provider agnostic.
4. Authentication and authorization remain separate.
5. Cryptographic verification occurs behind an identity port/adapter.
6. No single provider is normative.
7. Assertion and approval bindings are immutable and internally fingerprinted.
8. Issuer trust is explicit and externally configured.
9. The Orchestrator validates but never invents or self-approves identity.
10. Invalid, mismatched, stale or untrusted identity fails closed.
11. Multi-tenant/project isolation is preserved.
12. ADR-004 trust-boundary and human-authority invariants remain authoritative.
13. FILESYSTEM_PATCH physical dispatch remains disconnected until the full
    authenticated authority chain is validated.

## 15. Acceptance Criteria

An implementation conforms only when tests prove:

- provider-neutral verified assertion validation;
- internally derived assertion fingerprints;
- explicit trusted-issuer and audience evaluation;
- operation and tenant/project binding;
- separate authentication and role/policy authorization;
- expiry, replay, conflict and unavailable-trust failure behavior;
- binding through R3 Approval Authority, capability grant, operation record and
  Orchestrator;
- agents and callers cannot self-assert human identity;
- existing governed non-R3 behavior remains unchanged;
- physical FILESYSTEM_PATCH dispatch remains disabled until separately
  authorized after all prerequisites pass.

## 16. Review Triggers

Review this ADR through a superseding ADR if:

- Surgical DevOps is proposed to operate identity-provider functions;
- authentication and authorization responsibilities materially change;
- a provider-specific identity system is proposed as normative;
- tenant or project isolation semantics change;
- revocation or offline trust changes the authority model;
- R3 authority no longer requires external authenticated human identity;
- physical mutation is proposed without the complete binding chain.

External issuer policies, token formats, key services and platform features may
change without superseding this ADR when adapters continue to satisfy the frozen
contract.

## 17. Approval Record

**Decision:** APPROVED / FROZEN

**Authority:** Project authority, through the explicit ADR-006 documentation
freeze directive dated 2026-08-20.

**Effect:** This decision authorizes documentation of the identity trust
boundary only. It does not authorize runtime implementation or physical
FILESYSTEM_PATCH dispatch.

---

**Status: APPROVED / FROZEN**
