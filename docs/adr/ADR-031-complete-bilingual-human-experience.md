# ADR-031 — Complete Bilingual Human Experience

**Status:** ACCEPTED / FROZEN

## Decision

Every human-facing Surgical DevOps surface SHALL provide semantically equivalent
Portuguese (PT-BR) and English (EN) experiences. This includes onboarding,
activation, help, session status, governed proposals, authorization boundaries,
cancellation, progress, provider guidance, evidence presentation, safe failure,
recovery guidance, installation documentation, and release documentation.

One package, executable, Node.js runtime floor, deterministic Orchestrator, and
authority model serve both languages. Language selection changes presentation
only. It MUST NOT change capabilities, risk, policy, identity, scope, CAS,
journal, anti-replay, dispatch, recovery, or fail-closed behavior.

The first-time onboarding persists the selected language and interaction profile.
Subsequent launches reuse both values. An explicit `--language en|pt-BR`
selection may override presentation for one launch without rewriting the stored
preference.

Machine contracts remain canonical in English: schema identifiers, JSON fields,
state names, fingerprints, selectors, capability names, protocol tokens, and
public API symbols are not translated. Human explanations surrounding those
tokens are bilingual.

## Qualification

Permanent tests SHALL exercise equivalent PT-BR and EN flows for NATURAL,
ENGINEER, and EXPERT, including persisted relaunch, help, proposals, denial,
cancellation, governed evidence, and session closure. Historical tests and the
native Linux, macOS, and Windows matrix remain mandatory.

No claim of translation completeness is valid unless the complete historical
suite, package dry run, and native matrix are green for the exact release commit.

Português: [ADR-031-complete-bilingual-human-experience_PT-BR.md](./ADR-031-complete-bilingual-human-experience_PT-BR.md)
