# ADR-016 — Commercial Activation, User Segmentation and Trial Policy

**Status:** APPROVED / FROZEN
**Target:** Post-v2.5 update
**Implementation:** NOT IMPLEMENTED
**Extends:** ADR-003, ADR-005, ADR-011, ADR-015
**Current v2.5 impact:** NONE

## 1. Context

Surgical DevOps requires explicit commercial segmentation without allowing
telemetry, AI cognition or installation identity to become financial authority.

## 2. Commercial User Categories

The following initial policy is frozen.

### Developers

Developers SHALL remain OPEN SOURCE until a future explicit decision changes
that policy.

Mandatory commercial charging is DISABLED.

### Natural Users

Natural users SHALL remain FREE until a future explicit decision changes that
policy.

Mandatory commercial charging is DISABLED.

### Business Users

Business use MAY evolve from free/pre-commercial availability into a commercial
model after predetermined business-adoption and commercial-readiness criteria
are satisfied.

## 3. Automatic Commercial Eligibility

The future system MAY automatically determine that commercial activation has
become eligible.

Eligibility SHALL be based on predetermined criteria including as applicable:

- qualified business adoption;
- minimum sample size;
- telemetry integrity;
- commercial readiness;
- jurisdiction readiness;
- payment infrastructure readiness.

Thresholds SHALL NOT be chosen retroactively merely because observed adoption
makes a particular threshold commercially convenient.

## 4. Commercial State Model

A future state machine MAY include:

BUSINESS_FREE
→ COMMERCIAL_ELIGIBLE
→ COMMERCIAL_MODE
→ BUSINESS_TRIAL
→ BILLING_CONSENT
→ PAID

Commercial eligibility alone SHALL NOT authorize charging.

## 5. Trial

For the direct commercial channel, the intended business policy is:

ONE MONTH FREE TRIAL

before paid operation.

External marketplaces SHALL use the trial duration and mechanics actually
permitted by that marketplace.

## 6. Billing Consent

Payment SHALL require valid billing consent and the required financial
authorization.

The following SHALL NOT constitute billing consent:

- installation;
- telemetry;
- product usage;
- AI cognition;
- authentication alone;
- crossing an adoption threshold.

## 7. No Retroactive Billing

A future change from free to paid SHALL NOT create retroactive debt for periods
previously represented as free.

## 8. Commercial Authority

AI cognition SHALL NOT independently:

- alter prices;
- activate charges;
- modify trials;
- grant financial discounts;
- modify payment splits;
- transfer funds;
- alter payout destinations.

Financial authority SHALL remain explicitly governed.

## 9. Relationship to ADR-003 and ADR-005

This ADR extends rather than replaces the existing Surgical DevOps
commercialization and distribution architecture.

Where this ADR introduces explicit user-category policy, automatic eligibility
and trial semantics, those rules govern those specific subjects.

## 10. Implementation Boundary

This ADR SHALL NOT activate billing during v2.5.

Implementation belongs to a post-v2.5 update.
