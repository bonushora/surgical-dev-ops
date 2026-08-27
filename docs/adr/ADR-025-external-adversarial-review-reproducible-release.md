# ADR-025 — External Adversarial Review and Reproducible Release Qualification

Status: **APPROVED AND FROZEN**
Date: 2026-08-26

## Context

ADR-024-A through ADR-024-I are implemented and qualified by the canonical
Linux, macOS and Windows workflow at commit
`a3a4e2941914f14457ed1932ea4024fc495bfff1`, run `33110168939`.

Internal green tests are necessary evidence, but they are not independent
security review. The next release must make its claims, limitations, reproduction
steps and failure-reporting channel inspectable without asking reviewers to trust
private context or promotional language.

## Decision

Surgical DevOps will publish a bounded “Try to Break It” review package before
promoting the next stable release. The package SHALL contain:

1. a machine-readable qualification manifest bound to the reviewed source
   baseline, workflow run and immutable protocol hashes;
2. exact clean-checkout reproduction commands;
3. high-value adversarial targets and expected fail-closed boundaries;
4. a structured GitHub issue form that forbids live secrets;
5. coordinated-disclosure guidance and explicit non-claims;
6. an automated integrity gate executed by the canonical multiplatform suite.

The review target is the deterministic authority boundary around probabilistic
cognition. Reviewers are invited to demonstrate a bypass, not merely to confirm
the project’s own tests.

## Mandatory deep white-box scope

The adversarial review SHALL NOT be limited to adjacent layers, public
interfaces, CLI, API, configuration, cognitive providers or ordinary malformed
input. Boundary-only and black-box testing are useful but insufficient.

Reviewers SHALL be permitted and explicitly invited to attack the internal
deterministic core directly, including:

1. operation-state vocabulary, lifecycle transitions and terminal-state rules;
2. identity, approval, capability, action, scope and fingerprint bindings;
3. physical workspace identity, Manifest CAS and managed materialization;
4. journal ordering, locks, durability receipts and terminal records;
5. recovery, restart, idempotency and finalized replay;
6. authoritative clock progression and exact-expiry boundaries;
7. filesystem identity races, ancestor substitution and native adapters;
8. Orchestrator sequencing between validation, authorization, dispatch and
   finalization;
9. immutable in-memory structures and persisted evidence after qualification;
10. cognitive-provider attempts to acquire operational or mutation authority.

The campaign SHALL include white-box review, mutation testing, property-based
or structured fuzzing, concurrency and multiprocess tests, fault injection at
internal transition boundaries, crash/restart testing and direct tampering with
journal, Manifest CAS, materialization and replay evidence. Native Linux, macOS
and Windows behavior SHALL be exercised where the claim is platform-dependent.

A deep review must attempt to produce at least one of the following forbidden
outcomes from inside the system: false success, mutation without authority,
loss of atomicity, accepted conflicting replay, false recovery, silent
durability downgrade or divergence between logical evidence and physical
state.

Testing only the adjacent layers does not satisfy ADR-025.

## Release gate

No stable tag or release may claim ADR-025 completion until the ADR-025 commit
passes the unchanged canonical workflow on Ubuntu, macOS and Windows. A tag,
release publication, CI rerun or external announcement remains a separately
governed side effect.

## Required report

A useful finding identifies the smallest reproducible input, expected boundary,
observed result, platform/runtime and security impact. Credentials, private keys,
production data and unrelated personal information must never be submitted.

## Explicit non-claims

- Passing CI is not proof of absolute security.
- This package is not an independent audit and does not claim one has occurred.
- The language model is not deterministic or inherently trusted.
- Physical power-loss safety and ADR-009 strict pathname CAS remain unqualified.
- A disclosed latency miss is not rewritten as a performance success.

## Consequences

The project gains a reproducible external-review boundary and a falsifiable public
challenge. Findings may turn the release candidate red; that is expected evidence,
not a failure of the review process.
