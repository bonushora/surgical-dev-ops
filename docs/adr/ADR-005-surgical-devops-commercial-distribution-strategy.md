# ADR-005 — Surgical DevOps Commercial Distribution Strategy

**Status:** APPROVED / FROZEN
**Date:** 2026-08-20
**Decision ID:** SDO-3
**Scope:** Surgical DevOps / Development Orchestration Layer
**Extends:** [ADR-003 — Surgical DevOps Accelerator — Commercialization & Go-to-Market](./ADR-003-surgical-devops-commercialization.md)
**Constrained by:** [ADR-004 — Surgical DevOps Orchestrator — Trust Boundary & Secure Execution](./ADR-004-surgical-devops-orchestrator-trust-boundary.md)
**Revisable baseline:** [Commercial Baseline](../strategy/commercial-baseline.md)

---

## 1. Context

ADR-003 approved Surgical DevOps as a commercializable, provider-independent
engineering control and execution platform. ADR-004 established human authority
and the Orchestrator trust boundary. This ADR freezes the durable commercial
architecture and distribution principles that follow from those decisions,
while separating them from prices, platform rules and other mutable assumptions.

## 2. Decision

Surgical DevOps and its Development Orchestration Layer MAY be commercialized
as an independent product. Commercialization SHALL preserve repository,
provider and agent independence.

AI and coding agents are cognitive or execution providers subordinate to
Surgical DevOps governance. They are not the operational authority. Human
architectural authority, deterministic policy and controlled capability grants
remain authoritative regardless of commercial packaging or distribution.

The governing commercial principle is:

> **Agent != Authority.**

## 3. Provider Architecture

BYOAI (Bring Your Own AI) is an explicitly supported and preferred commercial
architecture. Customers MAY connect supported external or local providers and
MAY bear provider, inference or token costs directly.

Commercial viability SHALL NOT depend on reselling, embedding or receiving
favorable terms from one specific AI provider. A future Managed AI offering is
permitted, but it SHALL remain an optional commercial layer and SHALL NOT become
an architectural dependency or weaken provider replaceability.

## 4. Distribution

Multiple distribution channels MAY coexist, including:

- direct distribution;
- marketplaces;
- integrations and applications;
- enterprise or private distribution;
- self-hosted distribution where appropriate.

No channel receives authority to weaken the normative governance or security
model. Channel availability is not an architectural prerequisite.

## 5. Product Segmentation

Commercial packaging MAY include:

- Community;
- Developer or Professional;
- Team;
- Business;
- Enterprise;
- Enterprise Self-Hosted.

Enterprise and regulated-market offerings MAY use negotiated contracts,
private offers and self-hosted deployments where technically and legally
appropriate.

## 6. International Commercialization

International commercialization is intended, including visibility, adoption
and sales in the United States.

A Brazilian operation or entity MAY receive international revenue, subject to
all applicable Brazilian and foreign legal, tax, accounting, foreign-exchange
and regulatory requirements. This decision does not prescribe a processor,
bank, tax regime, legal opinion or corporate structure. Professional accounting
and legal review is required before production commercialization.

## 7. Invariants

Commercialization and distribution SHALL NOT weaken:

- deterministic governance;
- human authority;
- least privilege;
- capability boundaries;
- auditability;
- provider independence;
- the trust-boundary decisions frozen by prior ADRs.

## 8. Non-Durable External Assumptions

The following are explicitly **not frozen architectural facts**:

- prices;
- marketplace commissions or fees;
- marketplace eligibility requirements;
- payment-processor fees;
- tax rates or treatment;
- exchange-rate assumptions;
- platform policies;
- platform monetization capabilities;
- specific payment processors;
- specific marketplace availability.

These are mutable external assumptions. Any document that records them SHALL
identify its effective date, remain revisionable and require revalidation before
commercial reliance. The linked Commercial Baseline is such a working document,
not an immutable ADR decision.

## 9. Consequences

Surgical DevOps can pursue direct, marketplace, integration, private and
self-hosted routes without coupling its architecture to one provider or sales
channel. Customers can choose how inference is supplied and paid for. Managed
inference may be added later without redefining the authority model.

Operational complexity remains: international sales, marketplaces, contracts,
tax, accounting and regulatory compliance require current external validation
and qualified professional advice.

## 10. Frozen Decision

The independent-product, provider-independent, BYOAI-preferred, human-authority
and multi-channel principles in this ADR are **APPROVED / FROZEN**.

Indicative prices, vendors, marketplace details, launch tactics and external
commercial assumptions are not frozen. A change to the durable principles
requires a new ADR that explicitly supersedes this decision.

---

**Status: APPROVED / FROZEN**
