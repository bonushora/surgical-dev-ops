# ADR-017 — Multi-Jurisdiction Payments, Split and Marketplace Architecture

**Status:** APPROVED / FROZEN
**Target:** Post-v2.5 update
**Implementation:** NOT IMPLEMENTED
**Extends:** ADR-003, ADR-005, ADR-015, ADR-016
**Current v2.5 impact:** NONE

## 1. Context

Future Surgical DevOps commercialization requires payment architecture suitable
for Brazil, the United States and external marketplace channels without
hard-coding the product to one payment provider.

## 2. Provider-Neutral Architecture

Payment architecture SHALL remain provider-neutral.

The conceptual separation SHALL include:

CommercialPolicy
→ JurisdictionPolicy
→ BillingPolicy
→ PaymentProviderAdapter

Jurisdiction-specific adapters MAY be used.

## 3. Brazil

Brazilian payment qualification SHALL evaluate capabilities appropriate to the
market and applicable rules, including where supported:

- PIX;
- cards;
- subscriptions;
- split payments;
- payouts;
- refunds;
- chargebacks.

No specific Brazilian payment provider is frozen by this ADR.

## 4. United States

United States payment qualification SHALL evaluate capabilities including where
supported:

- cards;
- wallets;
- subscriptions;
- platform payments;
- connected accounts;
- split payments;
- payouts;
- refunds;
- disputes;
- tax-related integration;
- KYC/KYB requirements.

No specific United States payment provider is frozen by this ADR.

## 5. Split Payments

Split payment SHALL be represented as explicit financial policy.

The architecture SHOULD permit provider-supported models including:

- one-to-one allocation;
- one-to-many allocation;
- platform fees;
- destination allocation;
- auditable settlement evidence.

Actual availability SHALL depend on jurisdiction, provider rules and applicable
legal requirements.

## 6. GitHub Marketplace

GitHub Marketplace SHALL be treated as an independent commercial distribution
channel.

Marketplace transactions SHALL comply with the rules, eligibility requirements,
trial mechanics, fees and settlement mechanisms actually supported by GitHub.

Internal commercial policy SHALL NOT simulate or bypass Marketplace rules.

## 7. Direct Channel and Marketplace

The direct Surgical DevOps commercial channel MAY use independently qualified
payment providers and jurisdiction-specific payment methods.

Marketplace sales SHALL follow marketplace-specific payment architecture.

The two channels SHALL remain distinguishable in commercial evidence.

## 8. Jurisdiction Qualification Matrix

Before production financial implementation, a qualification matrix SHALL be
constructed for at least:

- Brazil;
- United States;
- GitHub Marketplace.

The matrix SHALL evaluate, as applicable:

- legal/entity eligibility;
- currency;
- payment methods;
- onboarding;
- KYC/KYB;
- subscriptions;
- split;
- trials;
- taxes;
- invoicing;
- refunds;
- chargebacks;
- payouts;
- settlement;
- webhooks;
- fees;
- provider/platform responsibilities.

## 9. Financial Authority Boundary

AI cognition SHALL NOT implicitly acquire authority to:

- create charges;
- capture charges;
- refund payments;
- transfer funds;
- change split rules;
- change prices;
- alter payout accounts;
- alter payment providers;
- create billing consent.

## 10. Telemetry Is Not Financial Authority

Installation counts, active-installation counts, sessions and other adoption
metrics SHALL NOT constitute:

- payment authorization;
- subscription authorization;
- billing consent;
- financial grant.

Telemetry MAY contribute evidence to commercial eligibility but SHALL NOT
authorize a financial transaction.

## 11. Automatic Readiness

The system MAY automatically determine conditions such as:

- commercial eligibility reached;
- marketplace eligibility reached;
- business trial eligibility reached;
- payment infrastructure ready.

Such determination SHALL NOT bypass consent, KYC/KYB, provider approval,
marketplace approval or applicable legal requirements.

## 12. GitHub App and Marketplace Readiness

After the current ADR freeze and completion of the v2.5 qualification frontier,
the project SHALL proceed to evaluate and configure the real GitHub App /
Marketplace environment.

This preparation SHALL include as applicable:

- GitHub App configuration;
- publisher readiness;
- installation measurement;
- Marketplace eligibility;
- pricing-plan readiness;
- event/webhook boundaries;
- commercial integration boundaries.

Commercial activation SHALL occur only after qualification.

## 13. Provider Selection

Provider selection SHALL consider:

- actual jurisdiction availability;
- compliance requirements;
- split capability;
- payout mechanics;
- fees;
- operational resilience;
- developer integration quality;
- portability;
- settlement model.

Popularity alone SHALL NOT determine provider selection.

## 14. Implementation Boundary

This ADR freezes architecture only.

No payment provider is activated by this ADR.

No charge is authorized by this ADR.

Implementation belongs to a post-v2.5 update.
