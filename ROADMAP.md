# Surgical DevOps Roadmap

This roadmap describes the strategic evolution of the Surgical DevOps ecosystem.

Dates are intentionally omitted.
Progress is milestone-driven rather than time-driven.

---

# Version 1.0 — Foundation ✅

Completed

- BH-SEP (Safe Evolution Protocol)
- BH-SDP (Snapshot & Delivery Protocol)
- Bilingual documentation
- Technical papers
- LLM regression guides
- MIT License
- CHANGELOG
- CONTRIBUTING guide

---

# Version 1.1 — Adoption

Planned

- Practical implementation examples
- GitHub workflow examples
- Prompt activation templates
- Best practices documentation
- Real-world case studies

---

# Version 1.2 — Tooling

Planned

- GitHub Actions examples
- CI/CD validation examples
- Protocol validation checklists
- Documentation templates
- Multiplatform snapshot architecture (BH-SDP): separate logical snapshot requirements from platform-specific physical snapshot mechanisms

---

# Version 1.5 — Integrations

Planned

- MCP compatibility guidance
- IDE integration recommendations
- AI workflow examples
- Enterprise adoption guidelines

---

# Commercialization & Distribution Readiness

Planned

- Governed by [ADR-005](docs/adr/ADR-005-surgical-devops-commercial-distribution-strategy.md) and the revisionable [Commercial Baseline](docs/strategy/commercial-baseline.md)
- Community and early-access validation
- Technical launch and discovery
- Marketplace eligibility and direct commercial channel
- Enterprise and self-hosted readiness

---

# Version 2.0 — AI Governance Platform

Vision

- Multi-agent governance
- Cross-session orchestration
- Protocol federation
- Governance metrics
- Enterprise compliance
- Reference implementations

---

# Version 2.3 — Development Orchestration Layer ✅

Completed

- Surgical DevOps Accelerator / Orchestrator
- Deterministic repository discovery and task preparation
- Authenticated human authority boundary for R3 operations
- Exact-scope capability grants
- Governed FILESYSTEM_PATCH mutation transactions
- Exact-target mutation locking
- Durable mutation journal
- Persisted commit authority
- Deterministic process-crash / process-restart recovery
- Filesystem durability primitive enforcement
- Qualified mutation-provider boundary
- Hardened Git preflight
- Canonical 508-test conformance suite
- GitHub Actions conformance workflow
- Direct Linux / Windows / macOS canonical conformance matrix validated on
  GitHub Actions run 32545548306 at commit 0586fa4113de00c075113f12fd98059f44feba8f
- Safe Exclusive Write primitive qualified on Linux / Windows / macOS

Explicit qualification boundaries retained at v2.3 closure:

- POWER_LOSS_VALIDATED remains false pending platform/filesystem-specific
  qualification
- Strict Physical Identity-Conditional CAS remains UNQUALIFIED
- production physical mutation dependent on strict physical CAS remains
  fail-closed
- strict physical CAS qualification continues only as a separate specialized
  qualification line and is not a prerequisite for v2.3 closure

---

# Guiding Principle

The objective of Surgical DevOps is not merely to improve prompts.

Its long-term vision is to establish an open governance layer for AI-assisted software engineering that is independent of any specific LLM provider.
