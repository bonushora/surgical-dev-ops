# ADR-29 — Bilingual Product Contract

- **Status:** ACCEPTED / FROZEN
- **Decision date:** 2026-08-28
- **Product:** Surgical DevOps
- **Contract:** `BILINGUAL_PRODUCT_CONTRACT = EN_US + PT_BR`

## Context

Surgical DevOps is intended for both international engineering use and
Portuguese-speaking users. Language presentation must therefore be treated as
a product-level architectural contract rather than an incidental
documentation concern.

The deterministic Orchestrator, authority model, trust boundaries, fail-closed
behavior, evidence requirements, authorization semantics, mutation rules,
error identities, and security invariants must remain independent from the
selected human language.

## Decision

English (United States) and Portuguese (Brazil) are first-class official
product languages.

All user-facing product surfaces introduced or materially changed after this
decision SHALL provide semantically equivalent EN-US and PT-BR presentation
before the affected feature can be considered product-complete.

This includes, where applicable:

- NATURAL interaction;
- CLI help and status output;
- governed authorization and approval prompts;
- governed error explanations;
- provider setup and provider-selection guidance;
- human-readable recovery and reconciliation output;
- public-facing product documentation intended for end users;
- other user-visible messages introduced by product features.

## Deterministic language boundary

Localization SHALL NOT:

1. mint, broaden, reduce, or reinterpret operational authority;
2. change authorization identity, scope, lifetime, target, or replay rules;
3. alter fail-closed outcomes;
4. change Journal, Manifest CAS, R3, recovery, or mutation semantics;
5. create language-specific execution paths with different privileges;
6. use an LLM translation result as an authority-bearing decision;
7. make localized prose the canonical machine identity of an error or policy.

Machine-stable identifiers and deterministic state transitions remain
language-neutral. Human-readable localized messages are projections of those
stable identities and states.

## Semantic parity requirement

EN-US and PT-BR surfaces SHALL be tested for semantic parity at the level
appropriate to the feature.

A feature is not product-complete when a newly introduced user-facing surface
exists only in one official language, unless the surface is explicitly
classified as non-product/internal evidence.

Tests SHOULD prefer stable message keys, schemas, or deterministic semantic
identifiers rather than coupling security behavior to translated prose.

## Existing surface migration

This decision does not claim that every historical user-facing string in the
repository is already bilingual.

Existing surfaces SHALL be migrated incrementally through explicitly bounded
implementation gates. No historical monolingual string is silently declared
qualified by this ADR.

## Relationship to G9 and G10

G9 remains ACCEPTED / FROZEN at commit
`3f0a6608ee1bd4bef7f28ed897951c9744a9f2fc`.

The documentation freeze commit immediately preceding this ADR is
`450eaa53fd820ae95a2c1d93251cd3481322fd39`.

This bilingual contract is orthogonal to the G10 anti-replay lifecycle gate.
G10 must preserve this contract for any new user-facing surface it introduces,
but language presentation MUST NOT change G10 authority or execution
semantics.

## Qualification rule

For future user-facing milestones:

`PRODUCT_GREEN = DETERMINISTIC_GREEN + EN_US/PT_BR_SEMANTIC_PARITY`

This formula is a product-completion rule. It does not replace existing
security, correctness, audit, platform, or deterministic qualification gates.

## Consequences

- International review can use English as a native product surface.
- Brazilian users receive equivalent PT-BR behavior and explanation.
- Deterministic security semantics remain language-independent.
- New user-facing capabilities carry a bilingual completion obligation.
- Localization becomes testable architecture rather than best-effort copy.
