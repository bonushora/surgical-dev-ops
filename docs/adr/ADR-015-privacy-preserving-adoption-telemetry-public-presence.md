# ADR-015 — Privacy-Preserving Adoption Telemetry and Public Presence

**Status:** APPROVED / FROZEN
**Target:** Post-v2.5 update
**Implementation:** NOT IMPLEMENTED
**Extends:** ADR-003, ADR-005, ADR-011
**Current v2.5 impact:** NONE

## 1. Context

Surgical DevOps requires trustworthy adoption measurement without converting
telemetry into operational authority and without publishing fictitious,
inflated or privacy-invasive metrics.

The public ecosystem also requires a canonical bilingual presence and a
private administrative observability surface.

## 2. Decision

A provider-neutral Privacy-Preserving Adoption Telemetry subsystem SHALL be
introduced in a future post-v2.5 update.

Telemetry SHALL remain outside the operational authority of the Orchestrator.

Telemetry failure, absence or disablement SHALL NOT grant, deny, broaden or
reduce Surgical DevOps operational authority.

## 3. Measurement Model

The subsystem MAY measure qualified aggregate information including:

- unique installations;
- active installations;
- sessions;
- governed operations;
- platform distribution;
- version distribution;
- interaction-mode distribution;
- retention;
- qualified adoption growth.

An installation SHALL NOT automatically be represented as a unique human user.

## 4. Interaction Categories

Qualified adoption MAY be aggregated according to the canonical interaction
profiles defined by ADR-011:

- NATURAL;
- ENGINEER;
- EXPERT / DETERMINISTIC.

All profiles SHALL continue to use the same governed Orchestrator and security
model.

## 5. Privacy Boundary

Telemetry SHALL NOT collect adoption data consisting of:

- source-code contents;
- arbitrary file contents;
- prompts;
- complete AI responses;
- patches;
- credentials;
- secrets;
- private keys;
- authentication tokens;
- arbitrary workspace data.

Installation identifiers SHALL NOT constitute human identity or authority.

## 6. Visibility Model

Telemetry SHALL support three conceptual visibility levels:

1. LOCAL
2. PRIVATE ADMINISTRATIVE
3. PUBLIC AGGREGATED

Individual telemetry events SHALL NOT become public evidence.

## 7. Private Administrative Dashboard

The primary private administrative interface SHALL be terminal-first.

The intended operator surface is a Linux terminal.

The dashboard MAY be distributed as an npm package.

A future package MAY expose an interface conceptually equivalent to:

`surgical-metrics`

The exact npm package name remains an implementation decision subject to
namespace availability.

The administrative dashboard SHALL be read-only by default.

Administrative credentials SHALL NOT be embedded in the npm package.

## 8. Public Presence

`bonora.io` SHALL be the intended public web presence for the Surgical DevOps
ecosystem unless superseded by a future explicit architectural decision.

The public website SHALL support at minimum:

- Portuguese;
- English.

A bilingual website artifact already created locally MAY serve as implementation
input, but its current HTML, CSS and JavaScript bytes are NOT frozen as the
normative architecture.

## 9. Hidden-by-Default Public Metrics

The public metrics surface on the website SHALL be HIDDEN BY DEFAULT.

It SHALL NOT display empty, fictitious or artificially seeded adoption numbers.

Public visibility MAY be activated only after predetermined qualification gates
are satisfied.

## 10. Automatic Disclosure Eligibility

The future implementation SHALL support deterministic evaluation of public
disclosure eligibility.

Qualification SHALL consider at minimum:

- minimum qualified adoption;
- minimum sample size;
- privacy threshold;
- data integrity;
- data quality;
- freshness;
- disclosure policy.

A threshold SHALL be defined before it is used to justify a public claim.

## 11. Progressive Public Disclosure

Public disclosure MAY grow dynamically as the qualified sample becomes large
enough to support additional privacy-preserving aggregate metrics.

Conceptual states MAY include:

- PRIVATE_COLLECTION;
- PUBLIC_DISCLOSURE_ELIGIBLE;
- INITIAL_PUBLIC;
- GROWING_PUBLIC;
- MATURE_PUBLIC.

State transitions SHALL be evidence-driven.

## 12. Truthful Metrics Principle

Every public numerical claim SHALL satisfy:

PUBLIC CLAIM <= QUALIFIED OBSERVED METRIC

Rounding SHALL NOT create a public claim greater than qualified evidence.

Marketing SHALL NOT fabricate, inflate or retroactively manipulate adoption
evidence.

## 13. Data Degradation

Loss of freshness, integrity, privacy qualification or data quality SHALL be
capable of causing:

- public freeze;
- public hide;
- disclosure downgrade;
- historical-only marking.

Previously qualified evidence SHALL NOT automatically be represented as current
after qualification is lost.

## 14. GitHub Evidence

GitHub MAY receive periodic or milestone-based aggregate adoption snapshots.

GitHub SHALL NOT be used as the raw telemetry database.

Individual telemetry events SHALL NOT generate individual commits.

Public snapshots MAY contain qualified aggregate values and evidence
fingerprints.

## 15. Authority Boundary

Telemetry grants:

- human authority: NONE;
- mutation authority: NONE;
- AI authority: NONE;
- billing authority: NONE;
- Orchestrator authority: NONE.

Telemetry evidence SHALL NOT constitute an operational grant.

## 16. Implementation Boundary

This ADR freezes future architecture only.

Implementation belongs to a post-v2.5 update.

The current v2.5 qualification scope remains unchanged.
