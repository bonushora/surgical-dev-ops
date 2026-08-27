# Reconstruction v3 — R2 Authority and Identity

Status: IMPLEMENTATION CANDIDATE

Baseline: R1 qualified at commit
`d3aa6071e15f8d45abde3f903e7c1b0b101ce2ba`.

## Objective

Create one canonical, immutable and provider-neutral contract that proves the
exact binding between:

1. externally verified human identity;
2. separate R3 approval authority;
3. the resulting capability grant.

## Preserved invariants

- Surgical DevOps is not an Identity Provider.
- Authentication never implies authorization.
- Cryptographic verification remains behind a controlled adapter.
- The human remains sovereign.
- The Orchestrator remains the operational trust boundary.
- Cognitive providers receive no identity, approval, grant, operational or
  mutation authority.
- Missing, malformed, stale, incomplete or mismatched authority fails closed.
- Tenant and project isolation remain exact.
- R1 remains qualified and unchanged.
- CAS, journal, recovery, filesystem and platform behavior remain unchanged.

## R2.1 boundary

R2.1 consumes normalized evidence. It does not:

- authenticate a human;
- verify signatures or tokens;
- trust an issuer;
- read keys or credentials;
- access filesystem, network, process or shell;
- issue an approval;
- mint a production capability grant;
- dispatch an operation;
- mutate physical state.

Its sole authority is to decide whether already-produced identity, approval and
grant evidence form one exact immutable chain.

## R2 promotion direction

Later controlled steps may introduce compatibility projections from existing
production contracts. No production consumer is migrated by R2.1.

R2 may be promoted only after:

1. provider neutrality is explicit;
2. authentication and authorization remain separate;
3. every cross-stage binding is exact;
4. incomplete and conflicting evidence fails closed;
5. cognitive authority remains zero;
6. existing R3 and non-R3 behavior remains compatible;
7. the complete historical suite remains green;
8. Linux, macOS and Windows CI passes.
## R2.2 qualified compatibility projection

R2.2 introduces an additive compatibility adapter between the qualified
production authority evidence and the pure R2.1 binding contract.

The adapter:

- accepts only an externally verified human identity result;
- reproduces and validates the R3 approval-authority fingerprint;
- reproduces and validates the capability-grant fingerprint;
- projects identity, approval and grant into the exact R2.1 shapes;
- derives one deterministic logical-scope fingerprint;
- excludes only the physical `canonicalPath` projection from logical scope;
- preserves path, before hash, replacement hash and every other scope field;
- rejects missing, substituted or mismatched evidence fail closed.

R2.2 does not replace a production consumer, mint authority, authenticate a
human, issue approval, dispatch an operation or mutate the workspace. Existing
identity, R3 approval and capability-grant contracts remain authoritative.

Local qualification at the R2.2 candidate boundary demonstrated:

- the real identity → R3 approval → capability-grant chain is accepted;
- post-qualification grant substitution is denied;
- logical scope remains stable across the qualified physical-path projection;
- the complete suite discovers 987 tests, with 982 passing, zero failures and
  five platform-specific skips;
- dependency audits report zero vulnerabilities.

An R2.2 commit is qualified for promotion only when that exact commit passes
the canonical Ubuntu, macOS and Windows workflow.
