# Surgical DevOps Commercial Baseline

**Status:** REVISIONABLE WORKING HYPOTHESIS
**Baseline date:** 2026-08-20
**Revalidation:** Required before commercial reliance or launch
**Governed by:** [ADR-005 — Surgical DevOps Commercial Distribution Strategy](../adr/ADR-005-surgical-devops-commercial-distribution-strategy.md)

This document is not an immutable ADR decision. It records an initial market,
distribution and pricing hypothesis for validation. Prices, fees, eligibility,
tax treatment, exchange rates, platform capabilities and platform policies are
external mutable assumptions and must be revalidated against then-current facts.

## Market and Positioning

The primary market hypothesis is the international software-development
market, with initial emphasis on visibility and adoption in the United States.

Surgical DevOps sells the governance and orchestration layer; it does not
require the sale of AI inference. The core commercial concept is:

> **Agent != Authority.**

The preferred provider model is BYOAI (Bring Your Own AI). Customers may connect
supported external or local providers and bear provider or token costs directly.
A future Managed AI option may complement BYOAI, but remains optional.

## Initial Channel Hypothesis

### Discovery and Technical Validation

- Hacker News / Show HN;
- technical communities;
- repository and working product demonstrations.

### Technical Distribution

- GitHub;
- a GitHub App where appropriate.

### Self-Service Commercialization

- GitHub Marketplace if and when then-current eligibility requirements are met;
- direct Surgical DevOps website and payment flow.

### Enterprise

- direct sales;
- negotiated contracts;
- private offers;
- self-hosted licensing or deployment where appropriate.

### Future or Optional

- a ChatGPT app or integration as a distribution or acquisition channel,
  subject to then-current platform capabilities and policies;
- other cloud or software marketplaces, subject to seller eligibility.

## Initial Pricing Hypothesis

All values are indicative market-validation hypotheses, not frozen prices.

| Segment | Indicative price |
|---|---:|
| Community | USD 0 |
| Developer | approximately USD 29/month |
| Professional / Pro | approximately USD 79/month |
| Team | approximately USD 199/month |
| Business | approximately USD 499–999/month |
| Enterprise | Contact Sales / negotiated annual contract |
| Enterprise Self-Hosted | negotiated annual contract |

Annual pricing may offer an economic incentive relative to monthly billing.
Enterprise pricing may be substantially higher according to scale, compliance,
support, deployment and governance requirements.

## Hacker News / Show HN Launch Principle

Hacker News is a technical discovery and feedback channel, not an advertising
channel. Any Show HN launch should:

- present a working or testable product;
- explain the technical problem and architecture;
- invite technical and security feedback;
- avoid aggressive sales language;
- avoid unsupported novelty claims such as “first in the world”;
- keep commercial availability secondary to the technical presentation;
- comply with the platform rules applicable at publication time.

## International Commercial Flow

```text
US / INTERNATIONAL CUSTOMER
        |
        +--> Marketplace when eligible
        |
        +--> Direct website/payment flow
        |
        v
SURGICAL DEVOPS PRODUCT
        |
        v
BRAZILIAN COMMERCIAL OPERATION
        |
        v
BRAZILIAN FINANCIAL / ACCOUNTING / TAX COMPLIANCE
```

This flow does not prescribe a permanent processor, bank, tax regime or
corporate structure. Professional accounting and legal review is required
before production commercialization.

## Revalidation Checklist

Before launch or material commercial decisions, revalidate:

- marketplace availability, seller eligibility, commissions and policies;
- payment-processor availability, terms and fees;
- platform monetization and integration capabilities;
- applicable tax, accounting, foreign-exchange and regulatory treatment;
- exchange-rate assumptions and displayed prices;
- customer evidence, willingness to pay and segment definitions.
