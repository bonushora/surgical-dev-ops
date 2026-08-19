# ADR-003 — Surgical DevOps Accelerator — Commercialization & Go-to-Market

**Status:** APPROVED / FROZEN
**Date:** 2026-08-19
**Decision ID:** SDO-1
**Scope:** Surgical DevOps / Surgical DevOps Accelerator
**Related ADRs:**
- ADR-002 — Surgical DevOps Accelerator
- BH-SEP v2.2 — Safe Evolution Protocol
- BH-SDP v2.2 — Snapshot & Deterministic Preservation

---

## 1. Context

The Surgical DevOps Accelerator is being developed as an independent,
repository-agnostic, Git-aware and protocol-governed engineering harness
capable of orchestrating deterministic software-development workflows.

The Accelerator is intended to reduce unnecessary manual development cycles
while preserving:

- correctness;
- reproducibility;
- traceability;
- physical repository anchoring;
- validation;
- worktree preservation;
- controlled execution;
- regression resistance.

The capability may provide value beyond the Surgical Kernel ecosystem because
its architecture is repository-agnostic and provider-independent.

Therefore, the Accelerator shall be treated not only as an internal
engineering capability but also as a potentially commercial software product.

---

## 2. Decision

The Surgical DevOps Accelerator is approved as a **commercializable product**.

The product shall be positioned as a:

> **Deterministic Engineering Control and Execution Platform**

rather than merely an AI coding assistant.

Its commercial value proposition is based on controlling and governing the
software-engineering process around code-generation and code-modification
agents.

The Accelerator shall therefore occupy a control/orchestration layer between:

**Engineering Task**

→ **Surgical DevOps Governance**

→ **Execution Agent**

→ **Repository**

→ **Validation**

→ **Physical State Verification**

→ **Delivery**

---

## 3. Product Positioning

The Accelerator shall NOT primarily compete on:

- raw code-generation speed;
- autocomplete;
- IDE convenience;
- generic chatbot functionality;
- model intelligence alone.

The primary differentiation shall be:

**controlled engineering execution.**

The product shall emphasize:

- deterministic workflows;
- repository awareness;
- declarative inspection;
- explicit authorization;
- risk classification;
- change planning;
- controlled execution;
- physical state verification;
- snapshot preservation;
- diff inspection;
- validation gates;
- provider independence;
- auditability.

The commercial narrative shall therefore be closer to:

> "AI can generate code. Surgical DevOps controls how that code is
> introduced into a real software system."

---

## 4. Target Customers

The initial commercial strategy shall prioritize organizations where
uncontrolled AI-assisted development creates material operational,
security, compliance or maintenance risk.

Priority segments:

### Tier 1 — Software Development Teams

- startups with AI-assisted development;
- software houses;
- engineering teams adopting coding agents;
- teams using Codex, Claude Code, Gemini-based agents or equivalent systems;
- organizations with large Git repositories.

### Tier 2 — Enterprise Engineering

- financial institutions;
- telecommunications;
- industrial companies;
- technology companies;
- organizations operating critical internal software;
- organizations requiring stronger engineering governance.

### Tier 3 — Government and Regulated Environments

- government technology teams;
- public-sector software projects;
- regulated organizations;
- organizations requiring traceability and controlled change processes.

### Tier 4 — Professional Services

The platform may also support:

- DevOps consultancies;
- software-audit firms;
- cybersecurity companies;
- software modernization teams;
- forensic computing organizations.

---

## 5. Initial Commercial Entry Strategy

The initial product shall not attempt to sell a large enterprise platform
before the engineering core has demonstrated operational reliability.

The recommended commercial progression is:

### Phase A — Technical Demonstration

Demonstrate the Accelerator operating against real repositories.

Primary objective:

**prove that the system can safely transform an explicit engineering task
into a validated repository state.**

### Phase B — Design Partner Program

Select a small number of engineering teams willing to operate the system on
real development tasks.

The purpose is to collect:

- execution data;
- failure modes;
- developer feedback;
- workflow friction;
- measurable productivity gains;
- safety/regression metrics.

### Phase C — Paid Pilot

Convert successful design partners into paid pilots.

The commercial unit may initially be:

- team;
- repository;
- organization;
- controlled execution volume.

### Phase D — SaaS / Enterprise Product

After operational validation, introduce standardized commercial plans.

Potential structure:

- Developer / Individual;
- Team;
- Business;
- Enterprise;
- Government / Regulated.

Pricing shall be determined after pilot data is available.

---

## 6. Distribution Strategy

The primary distribution strategy shall be developer-first.

The product should be discoverable through:

- GitHub;
- technical documentation;
- command-line distribution;
- developer communities;
- technical demonstrations;
- open-source components where strategically appropriate;
- integration with coding agents;
- enterprise engineering partnerships.

The Surgical DevOps Accelerator may also use AI platforms and coding-agent
ecosystems as acquisition and demonstration channels.

The Accelerator must remain provider-independent.

---

## 7. Marketing Strategy

Marketing shall focus on the emerging problem of **uncontrolled AI-assisted
software development**.

The central market narrative shall be:

> As AI agents become capable of modifying production repositories,
> organizations need an engineering control layer between AI intent and
> physical code changes.

Content strategy should demonstrate concrete engineering scenarios.

Examples:

- AI agent proposes a broad refactor;
- repository contains unrelated uncommitted work;
- declarative inspection detects scope mismatch;
- risk classification blocks unauthorized execution;
- snapshot preserves the before-state;
- controlled execution modifies only the authorized scope;
- validation runs automatically;
- physical repository state is verified;
- delivery becomes auditable.

The product shall be marketed through demonstrations of behavior rather than
through abstract claims of intelligence.

---

## 8. Competitive Differentiation

The Accelerator shall differentiate itself from generic AI coding tools by
positioning itself as a **governance and execution-control layer**.

The conceptual distinction is:

| Category | Primary Function |
|---|---|
| AI Coding Assistant | Generate/modify code |
| IDE | Development environment |
| CI/CD | Build/test/deploy |
| Git | Version control |
| AI Agent | Autonomous engineering execution |
| Surgical DevOps Accelerator | Govern and control engineering execution |

The Accelerator may integrate with these categories rather than replace
them.

---

## 9. Business Model

The initial business model shall support a hybrid strategy.

### Developer / Team

Subscription-based access for individual developers and small teams.

### Business

Subscription based on organization/team usage and governance capabilities.

### Enterprise

Commercial contracts incorporating:

- centralized governance;
- auditability;
- policy controls;
- organization-level configuration;
- execution controls;
- support;
- security requirements;
- integration capabilities.

### Government / Regulated

Specialized contracts may include:

- controlled deployment;
- audit requirements;
- local execution;
- restricted environments;
- compliance requirements;
- enterprise support.

The final pricing model remains intentionally unfrozen and shall be
validated through market pilots.

---

## 10. Open-Core / Commercial Boundary

The project may use an open-core or source-available strategy if this proves
commercially advantageous.

The architectural core of Surgical DevOps shall remain independently useful.

Commercial differentiation may eventually include:

- enterprise governance;
- centralized policy management;
- audit dashboards;
- fleet management;
- organizational controls;
- advanced integrations;
- managed execution;
- enterprise support;
- compliance capabilities.

No specific licensing model is frozen by this ADR.

---

## 11. Relationship With Surgical Kernel

The Surgical Kernel shall remain an important reference consumer and
validation environment for the Accelerator.

However:

**The Accelerator must not depend commercially on the Surgical Kernel.**

The Accelerator shall remain capable of operating against unrelated
repositories and projects.

The Surgical Kernel may therefore function as:

- a reference implementation;
- a demanding validation target;
- a demonstration environment;
- an ecosystem product.

This preserves the commercial independence of Surgical DevOps.

---

## 12. Product-Led Growth Principle

The initial adoption strategy should favor a low-friction developer entry
point.

The user should be able to understand the product through a simple sequence:

1. install;
2. point to a repository;
3. define a task;
4. inspect;
5. authorize;
6. execute;
7. validate;
8. inspect resulting state.

The product experience must make the safety model visible rather than hiding
it.

---

## 13. Success Metrics

Commercial validation shall measure more than revenue.

Primary technical/product metrics:

- reduction in manual development cycles;
- prevented unsafe executions;
- successful task completion rate;
- validation coverage;
- regression rate;
- execution reproducibility;
- developer adoption;
- time-to-validated-change.

Commercial metrics:

- pilot conversion;
- retention;
- expansion from team to organization;
- willingness to pay;
- cost of acquisition;
- recurring revenue;
- enterprise conversion.

---

## 14. Strategic Principle

The product shall not be marketed as:

> "another AI that writes code."

It shall be marketed as:

> **the engineering control layer for AI-assisted software development.**

This distinction is considered strategically important.

---

## 15. Frozen Decision

The following decision is APPROVED and FROZEN:

> **Surgical DevOps Accelerator is approved as a commercializable
> deterministic engineering control and execution platform.**

The initial go-to-market strategy shall be developer-first, progressing from
technical demonstrations to design partners, paid pilots and subsequently
team, business and enterprise offerings.

The product shall remain provider-independent and repository-agnostic.

No specific pricing model, licensing model or final packaging is frozen by
this ADR; these shall be determined through market validation.

Future changes to the fundamental commercial positioning defined herein
require a new ADR explicitly superseding this decision.

---

**Status: APPROVED / FROZEN**
