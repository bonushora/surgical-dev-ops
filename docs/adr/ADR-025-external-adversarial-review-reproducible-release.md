# ADR-025 — External Adversarial Review and Reproducible Release Qualification

Status: **APPROVED AND FROZEN**
Date: 2026-08-26

## Context

ADR-024-A through ADR-024-I are implemented and qualified by the canonical
Linux, macOS and Windows workflow at commit
`7cf628899e69c90078815ebb959f0bd97c077526`, run `32956401106`.

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
